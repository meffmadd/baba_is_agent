import os
from typing import Annotated, List, Literal
import asyncio
import json
import configparser

from langchain_mcp_adapters.prompts import AIMessage
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

load_dotenv()

# Start Baba Is You sub-process to read stdout
DATA_PATH = Path(f"/Users/{os.getenv("USER")}/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data")
STATE_PATH = DATA_PATH / "Worlds" / "baba"/ "world_data.txt"
MCP_PATH = DATA_PATH / "baba_is_eval" / "game_mcp.py"

assert STATE_PATH.exists()
assert MCP_PATH.exists()

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


allowed_tools = ["game_rules", "execute_commands", "undo_multiple", "restart_level"]
all_tools = asyncio.run(client.get_tools())
tools_by_name = {t.name: t for t in all_tools}

tools = [t for t in all_tools if t.name in allowed_tools]
# tool_node = ToolNode(tools, messages_key="chat_history")

# asyncio.run(tools_by_name["execute_commands"].ainvoke(input={"commands": "up,up"}))

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
    suggestion: str

class State(TypedDict):
    chat_history: Annotated[list[BaseMessage], add_messages]
    game_state: str
    # self_evaluation: str
    # options: MoveOptions
    # reasoning: Reasoning
    # mistake_detection: str

builder = StateGraph(State)

llm = ChatOpenAI(model=os.getenv("MODEL") or "gpt-4.1", base_url=os.getenv("BASE_URL"), api_key=os.getenv("API_KEY"))
llm_with_tools = llm.bind_tools(tools, tool_choice="required")
llm_move_generator = llm.with_structured_output(MoveOptions.model_json_schema())
llm_reasoner = llm.with_structured_output(Reasoning.model_json_schema())

def init(state: State) -> State:
    """Init state with initial goal etc."""
    game_rules_tool = {t.name: t for t in all_tools}["game_rules"]
    basic_rules = asyncio.run(game_rules_tool.ainvoke(input={"topic": "basic"}))
    system_prompt = SystemMessage(content=f'Your are an LLM Agent tasked to solve a given level of the puzzle game "Baba is You". This requires extensive reasoning. Here are the basic rules:\n\n{basic_rules}')
    state["chat_history"] = [system_prompt]
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
    state["chat_history"].append(
        HumanMessage(content=f'Evaluate the current game state as best as possible in a single sentence! Current game state:\n\n {state["game_state"]}')
    )
    response = llm.invoke(state['chat_history'])
    response.pretty_print()
    state["chat_history"].append(
        AIMessage(content=response.content)
    )
    return state


def generate_options(state: State) -> State:
    """Generate multiple approaches based on evaluation"""
    state["chat_history"].append(
        HumanMessage(content='Based on the previous evaluation, come up with 3 different options. Return a JSON object with the fields "moves" and "goal". Moves should accomplish a specific broader goal, like "deactivate rule", so the list of moves can contain easily contain 10+ individual moves. Moves are a list of strings of either "up", "down", "left", or "right". In the goal field specify what your goal with the moves is. For example, move option might be: {"options": [{"moves": ["up", "up", "right", "right", "down"], "goal": "Go into the corner to move the text."}]}')
    )
    response = llm_move_generator.invoke(state['chat_history'])
    message = AIMessage(content=json.dumps(response, indent=2))
    message.pretty_print()
    state["chat_history"].append(message)
    return state

def reason(state: State) -> State:
    """Reasoning through options in detail"""
    state["chat_history"].append(
        HumanMessage(content='Reason about the current state, the evaluation, and the move options generated. Return a brief but to the point analysis of the current plan in a single sentence! The reasoning should be returned as a JSON object with fields "reasoning" and "suggestion", e.g. {"reasoning": "There are ...", "suggestion": "Based on ..."}')
    )
    response = llm_reasoner.invoke(state['chat_history'])
    message = AIMessage(content=json.dumps(response, indent=2))
    message.pretty_print()
    state["chat_history"].append(message)
    return state

def detect_mistakes(state: State) -> State:
    """Check for reasoning errors"""
    state["chat_history"].append(
        HumanMessage(content='Check for reasoning mistakes in the previous response!')
    )
    response = llm.invoke(state['chat_history'])
    response.pretty_print()
    state["chat_history"].append(response)
    return state

def stop_condition(state: State) -> Literal["evaluate", "__end__"]:
    """Decide to stop or use tool (level won or not)"""
    if level_won():
        return "__end__"
    else:
        return "evaluate"

def call_tools(state: State) -> State:
    response = llm_with_tools.invoke(state["chat_history"])
    response.pretty_print()
    state["chat_history"].append(response)
    return state

def execute_tools(state: State) -> State:
    """Performs the tool call"""

    messages = state["chat_history"]
    message = state["chat_history"][-1]
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
builder.add_node("detect_mistakes", detect_mistakes)
builder.add_node("call_tools", call_tools)
builder.add_node("tool_node", execute_tools)

builder.add_edge(START, "init")
builder.add_edge("init", "game_state")
builder.add_conditional_edges("game_state", stop_condition)
builder.add_edge("evaluate", "generate_options")
builder.add_edge("generate_options", "reason")
builder.add_edge("reason", "detect_mistakes")
builder.add_edge("detect_mistakes", "call_tools")
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
