import os
from typing import Annotated, Literal, List
import asyncio
import configparser
import time
import json

from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    SystemMessage,
    AIMessage,
    ToolMessage,
)
from langchain_core.tools import BaseTool, InjectedToolArg, StructuredTool
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from dotenv import load_dotenv
from pathlib import Path
from textwrap import dedent

from utils import (
    MoveOptions,
    Reasoning,
    AugmentedMoveOptions,
    augment_game_moves,
    GameInsights,
    shortest_path,
    Position,
    GameMoves,
)

load_dotenv()

# Start Baba Is You sub-process to read stdout
DATA_PATH = Path(
    f"/Users/{os.getenv('USER')}/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data"
)
STATE_PATH = DATA_PATH / "Worlds" / "baba" / "world_data.txt"
MCP_PATH = DATA_PATH / "baba_is_eval" / "game_mcp.py"
RULES_PATH = DATA_PATH / "baba_is_eval" / "help_rules.json"

assert STATE_PATH.is_file()
assert MCP_PATH.is_file()
assert RULES_PATH.is_file()


client = MultiServerMCPClient(
    {
        "baba_is_you": {
            "command": "uv",
            # Make sure to update to the full absolute path to your math_server.py file
            "args": ["run", str(MCP_PATH)],
            "transport": "stdio",
        },
    }
)


allowed_tools = ["undo_multiple", "restart_level"]

all_tools: list[BaseTool] = asyncio.run(client.get_tools())
tools_by_name: dict[str, BaseTool] = {t.name: t for t in all_tools}

POSITION_LIST_EXPLAINER = """
Positions are lists of (JSON) objects with x and y coordinates and the direction of the last move ("up", "down", "left", "right").
A single postion in the list represents a move within the game. The path to get to the specified x,y-coordinates is found automatically (if possible).
Assuming only a single entity satisfies the "YOU" rule, executing a valid move to a position results in the entity to end up at that position.
The "last_move" field allows control over how to get to this final position, e.g. to deactivate a rule correctly. So it is NOT executed after the final position at (x, y) is reached but instead at the penultimate step to get to (x, y).

Examples of moves using positions:
1. To simply move to a position (e.g. coming from above) specify a Position [{"x": 13, "y": 22, "last_move": "down"}]. You only have to specify the final position you want to end up and if it can be reached the shortest path of the move will be automatically determined.
2. To deactivate a specific vertical rule you can specify the position of the "text_is" part of the rule, for example at (9, 18) and push it to the right. So the move is [{"x": 9, "y": 18, "last_move": "right"}]. After this you will be at coordinates (9, 18) and you moved the "text_is" block to the right, which is now at coordinates (10, 18) and the rule is deactivated.
3. To move a block (e.g. a "rock") at position (5,5) 3 steps down and 2 steps to the left (ending up at (8, 3)), move to the position of the "rock" with the last move of "down", specify your new positon two steps down ("rock" will be 3 steps down), then specify the new position of the block with the last move "left" and specify the position one step to the left. So the moves are [{"x": 5, "y": 5, "last_move": "down"}, {"x": 5, "y": 7, "last_move": "down"}, {"x": 5, "y": 8, "last_move": "down"}, {"x": 4, "y": 8, "last_move": "left"}]. The "rock" is now at position (8, 3).
"""

GAME_MOVE_EXPLAINER = f"""A game move is a JSON object with the fields "moves" and "goal". The field "moves" specifes a list of positions on the grid to move to.
{POSITION_LIST_EXPLAINER}

An example of a game move:
{GameMoves(moves=[Position(x=10, y=7, last_move="down")], goal="Move to flag").model_dump_json()}
"""

MOVE_OPTIONS_EXPLAINER = f"""Move options are a JSON object with the field "options" that describes a list of game moves.
{GAME_MOVE_EXPLAINER}

Putting it all together the move options might be specified as:
{
    MoveOptions(
        options=[
            GameMoves(
                moves=[Position(x=1, y=7, last_move="down")], goal="Move to flag"
            ),
            GameMoves(
                moves=[Position(x=1, y=1, last_move="up")], goal="Move to origin"
            ),
            GameMoves(
                moves=[Position(x=7, y=19, last_move="left")], goal="Move to text_is"
            ),
        ]
    ).model_dump_json()
}
"""

REASONING_EXPLAINER = f"""The reasoning is a JSON object with fields "reasoning" and "suggestion" (a game move).
{GAME_MOVE_EXPLAINER}

The "reasoning" field is just a string with a justification/reasoning why the suggested game move is useful in the current state of the game.

Putting it all toghther: {
    Reasoning(
        reasoning="The path to the flat (which is winning) is clear.",
        suggestion=GameMoves(
            moves=[Position(x=10, y=15, last_move="up")], goal="Move to the flat."
        ),
    ).model_dump_json()
}
"""


# TODO: add tool to move_entity -> carry a pushable entity to a position
def _apply_moves(
    moves: List[Position],
    goal: str,
    game_state: Annotated[str, InjectedToolArg],
) -> str:
    status: list[str] = []
    paths = []
    for move in moves:
        x, y, last_move = move.x, move.y, move.last_move
        path = shortest_path(game_state, (x, y), last_move)
        if len(path) == 0:
            status.append(
                f"Finding path to {(x, y)} was not possible... Stopping executing moves!"
            )
            break
        paths += path
        status.append(f"Move successful! Path {','.join(path)} was executed.")

    if len(status) != len(moves):
        message = f"Could not apply moves! Goal '{goal}' could not be accomplished. Intermediate step failed:\n"
    else:
        execute_commands = tools_by_name["execute_commands"]
        result = asyncio.run(
            execute_commands.ainvoke(input={"commands": ",".join(paths)})
        )
        message = f"Applying moves successful! Tool message: '{result}' The specified goal '{goal}' was accomplished. Paths executed: '{','.join(paths)}'."
    return message + "\n".join(status)


apply_moves = StructuredTool.from_function(
    func=_apply_moves,
    name="apply_moves",
    description=f"""Apply a list of Positions to accomplish a goal.
    {POSITION_LIST_EXPLAINER}

    The tool returns the status of each individual step with a success or error message at the beginning.
    """,
    # args_schema=GameMoves,
)

tools_by_name["apply_moves"] = apply_moves
tools: list[BaseTool] = [t for t in all_tools if t.name in allowed_tools] + [
    apply_moves
]


def level_won() -> bool:
    config = configparser.ConfigParser()
    config.read(STATE_PATH, encoding="utf-8")
    level_won = config["status"]["level_won"]
    won = level_won == "true"
    if won:
        print("LEVEL WON!!")
    return won


class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    game_state: str
    game_insights: str
    self_evaluation: str
    options: AugmentedMoveOptions
    reasoning: Reasoning


builder = StateGraph(State)

llm = ChatOpenAI(
    model=os.getenv("MODEL") or "gpt-4.1",
    base_url=os.getenv("BASE_URL"),
    api_key=os.getenv("API_KEY"),
)
llm_with_tools = llm.bind_tools(tools, tool_choice="required")
llm_move_generator = llm.with_structured_output(MoveOptions.model_json_schema())
llm_reasoner = llm.with_structured_output(Reasoning.model_json_schema())


def init(state: State) -> State:
    """Init state with initial goal etc."""
    rules = RULES_PATH.read_text(encoding="utf-8")
    system_prompt = SystemMessage(
        content=f'Your are an LLM Agent tasked to solve a given level of the puzzle game "Baba is You". Here are the rules in JSON format:\n{rules}'
    )
    state["messages"] = [system_prompt]
    system_prompt.pretty_print()

    # set level_won to "false"
    config = configparser.ConfigParser()
    config.read(STATE_PATH, encoding="utf-8")

    # Set level_won to false
    config["status"]["level_won"] = "false"
    config["file"]["last_processed"] = "0"

    # Write the updated config back to the file
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        config.write(f)

    assert not level_won()

    return state


def game_state(state: State) -> State:
    """Retrieve the game state"""
    game_state_tool = tools_by_name["get_game_state"]
    time.sleep(2)
    game_state = asyncio.run(game_state_tool.ainvoke(input={}))
    state["game_state"] = game_state
    state["game_insights"] = str(GameInsights.from_state(game_state))
    return state


def evaluate(state: State) -> State:
    """Evaluate current understanding"""
    message = HumanMessage(
        content=f"Evaluate the current game state as best as possible in a short paragraph!\nCurrent game state:\n\n{state['game_state']}\n\n{state['game_insights']}"
    )
    response = llm.invoke(state["messages"] + [message])
    response.pretty_print()
    state["self_evaluation"] = str(response.content)
    return state


def generate_options(state: State) -> State:
    """Generate multiple approaches based on evaluation"""
    message = HumanMessage(
        content=dedent(f"""
        The evaluation of the current game state is:
        {state["self_evaluation"]}

        The current game state is:
        {state["game_state"]}

        {state["game_insights"]}

        Come up with 3 different game moves. Return the move options as a JSON objects.
        {MOVE_OPTIONS_EXPLAINER}
        """).strip()
    )

    response = llm_move_generator.invoke(state["messages"] + [message])
    options = MoveOptions.model_validate(response)
    state["options"] = augment_game_moves(state["game_state"], options)
    return state


def reason(state: State) -> State:
    """Reasoning through options in detail"""
    message = HumanMessage(
        content=dedent(f"""
        Reason about the current state and the move options generated.
        Return a brief but to the point analysis of the current plan!
        {REASONING_EXPLAINER}

        Current game state:
        {state["game_state"]}

        {state["game_insights"]}

        Choose one of these moves:
        {str(state["options"])}

        You can change the moves and/or the goal after you reasoned about the current state of the game.
        """).strip()
    )

    response = llm_reasoner.invoke(state["messages"] + [message])
    state["reasoning"] = Reasoning.model_validate(response)
    AIMessage(content=json.dumps(response, indent=2)).pretty_print()
    return state


def stop_condition(state: State) -> Literal["evaluate", "__end__"]:
    """Decide to stop or use tool (level won or not)"""
    if level_won():
        return "__end__"
    else:
        return "evaluate"


def call_tools(state: State) -> State:
    message = HumanMessage(
        content=dedent(f"""
        You are tasked with calling a tool to get into a winning state. The current game state is:
        {state["game_state"]}

        {state["game_insights"]}

        Reasoning about the game state got the following conclusion with a suggested move:
        {state["reasoning"].model_dump_json(indent=2)}

        You can execute the suggested moves by using the "apply_moves" tool.
        {POSITION_LIST_EXPLAINER}

        If you are unsure that the suggested moves are useful, you can also undo steps with the "undo_multiple" tool,
        or restart the level using the "restart_level" tool.
        """).strip()
    )

    response = llm_with_tools.invoke(state["messages"] + [message])
    response.pretty_print()
    state["messages"] = state["messages"] + [message, response]
    return state


def execute_tools(state: State) -> State:
    """Performs the tool call"""
    messages = state["messages"]
    message = state["messages"][-1]
    if not isinstance(message, AIMessage):
        return state

    for tool_call in message.tool_calls:
        if tool_call["name"] != "apply_moves":
            tool = tools_by_name[tool_call["name"]]
            observation = asyncio.run(tool.ainvoke(tool_call["args"]))
        else:
            args = tool_call["args"]
            args["game_state"] = state["game_state"]
            observation = apply_moves.invoke(input=args)
        messages.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    return state


builder.add_node("init", init)
builder.add_node("game_state", game_state)
builder.add_node("evaluate", evaluate)
builder.add_node("generate_options", generate_options)
builder.add_node("reason", reason)
builder.add_node("call_tools", call_tools)
builder.add_node("tool_node", execute_tools)

builder.add_edge(START, "init")
builder.add_edge("init", "game_state")
builder.add_conditional_edges("game_state", stop_condition)
builder.add_edge("evaluate", "generate_options")
builder.add_edge("generate_options", "reason")
builder.add_edge("reason", "call_tools")
builder.add_edge("call_tools", "tool_node")
builder.add_edge("tool_node", "game_state")  # Loop

graph = builder.compile()


def main():
    print(graph.get_graph().draw_ascii())
    graph.invoke(input={}, config={"recursion_limit": 100})
    # for message_chunk, metadata in graph.stream({}, stream_mode="messages"):
    #     if message_chunk:
    #         print(message_chunk.content, end="", flush=True)


if __name__ == "__main__":
    main()
