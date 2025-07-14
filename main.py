import os
from typing import Annotated, List, Literal
import asyncio
import json
import configparser

from typing_extensions import TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from dotenv import load_dotenv
from pathlib import Path
from textwrap import dedent

load_dotenv()

# Start Baba Is You sub-process to read stdout
DATA_PATH = Path(f"/Users/{os.getenv("USER")}/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data")
STATE_PATH = DATA_PATH / "Worlds" / "baba"/ "world_data.txt"
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


allowed_tools = ["execute_commands", "undo_multiple", "restart_level"]
all_tools = asyncio.run(client.get_tools())
tools_by_name = {t.name: t for t in all_tools}

tools = [t for t in all_tools if t.name in allowed_tools]

def level_won() -> bool:
    config = configparser.ConfigParser()
    config.read(STATE_PATH, encoding="utf-8")
    level_won = config["status"]["level_won"]
    return level_won == "true"

class GameMoves(BaseModel):
    moves: List[Literal["up", "down", "left", "right"]]
    goal: str

class MoveOptions(BaseModel):
    options: List[GameMoves]

class Reasoning(BaseModel):
    reasoning: str
    suggestion: GameMoves

class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    game_state: str
    self_evaluation: str
    options: MoveOptions
    reasoning: Reasoning
    mistake_detection: str


builder = StateGraph(State)

llm = ChatOpenAI(model=os.getenv("MODEL") or "gpt-4.1", base_url=os.getenv("BASE_URL"), api_key=os.getenv("API_KEY"))
llm_with_tools = llm.bind_tools(tools, tool_choice="required")
llm_move_generator = llm.with_structured_output(MoveOptions.model_json_schema())
llm_reasoner = llm.with_structured_output(Reasoning.model_json_schema())

def init(state: State) -> State:
    """Init state with initial goal etc."""
    rules = RULES_PATH.read_text(encoding="utf-8")
    system_prompt = SystemMessage(content=f'Your are an LLM Agent tasked to solve a given level of the puzzle game "Baba is You". Here are the rules in JSON format:\n{rules}')
    state["messages"] = [system_prompt]
    system_prompt.pretty_print()

    # set level_won to "false"
    config = configparser.ConfigParser()
    config.read(STATE_PATH, encoding="utf-8")

    # Set level_won to false
    config["status"]["level_won"] = "false"

    # Write the updated config back to the file
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        config.write(f)

    return state

def game_state(state: State) -> State:
    """Retrieve the game state"""
    game_state_tool = tools_by_name["get_game_state"]
    result = asyncio.run(game_state_tool.ainvoke(input={}))
    state["game_state"] = result
    return state

def evaluate(state: State) -> State:
    """Evaluate current understanding"""
    message = HumanMessage(content=f'Evaluate the current game state as best as possible in a short paragraph! Current game state:\n\n {state["game_state"]}')
    response = llm.invoke(state['messages'] + [message])
    response.pretty_print()
    state["self_evaluation"] = str(response.content)
    return state


def generate_options(state: State) -> State:
    """Generate multiple approaches based on evaluation"""
    message = HumanMessage(content=dedent(f'''
        Based on the previous evaluation, come up with 3 different options.
        Return a JSON object with the fields "moves" and "goal".
        Moves should accomplish a specific broader goal, like "deactivate rule", so the list of moves can contain easily contain 10+ individual moves.
        Moves are a list of strings of either "up", "down", "left", or "right". In the goal field specify what your goal with the moves is.

        For example, move options might be:
        {{"options": [{{"moves": ["up", "up","right" ,"right", "down"], "goal": "Go into the corner to move the text."}}]}}

        The evaluation of the current game state is:
        {state["self_evaluation"]}
        ''').strip())

    response = llm_move_generator.invoke(state['messages'] + [message])
    state["options"] = MoveOptions.model_validate(response)
    return state

def reason(state: State) -> State:
    """Reasoning through options in detail"""
    message = HumanMessage(content=dedent(f'''
        Reason about the current state and the move options generated.
        Return a brief but to the point analysis of the current plan in a single sentence!
        The reasoning should be returned as a JSON object with fields "reasoning" and "suggestion" (a game move).
        For example: {{"reasoning": "There are ...", "suggestion": "{{"moves": ["..."], "goal": "Reach ..."}}}}

        Current game state:
        {state["game_state"]}

        Choose one of these moves:
        {state["options"].model_dump_json(indent=2)}

        You can change the moves and/or the goal after you reasoned about the current state of the game.
        ''').strip())

    response = llm_reasoner.invoke(state['messages'] + [message])
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
    message = HumanMessage(content=dedent(f'''
        You are tasked with calling a tool to get into a winning state. The current game state is:
        {state["game_state"]}

        Reasoning about the game state got the following conclusion with a suggested move:
        {state["reasoning"].model_dump_json(indent=2)}

        You can execute the suggested moves by using the "execute_commands" tool.
        If you are unsure that the suggested moves are useful, you can also undo steps with the "undo_multiple" tool,
        or restart the level using the "restart_level" tool.
        ''').strip())

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
        tool = tools_by_name[tool_call["name"]]
        observation = asyncio.run(tool.ainvoke(tool_call["args"]))
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
builder.add_edge("tool_node", "game_state") # Loop

graph = builder.compile()
# print(graph.get_graph().draw_mermaid())
print(graph.get_graph().draw_ascii())

def main():
    graph.invoke(input={}, config={"recursion_limit": 100})
    # for message_chunk, metadata in graph.stream({}, stream_mode="messages"):
    #     if message_chunk.content:
    #         print(message_chunk.content, end="", flush=True)

if __name__ == "__main__":
    main()
