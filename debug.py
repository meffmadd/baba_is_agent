from utils import get_rules, get_state_positions, shortest_path

if __name__ == "__main__":
    import time
    import asyncio
    import os
    from pathlib import Path
    from langchain_mcp_adapters.client import MultiServerMCPClient
    from utils.base import _parse_game_state

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

    all_tools = asyncio.run(client.get_tools())
    tools_by_name = {t.name: t for t in all_tools}

    while True:
        game_state_tool = tools_by_name["get_game_state"]
        execute_commands_tool = tools_by_name["execute_commands"]
        commands = "left,left,up,up"
        # asyncio.run(execute_commands_tool.ainvoke(input={"commands": commands}))
        time.sleep(0.1)
        state = asyncio.run(game_state_tool.ainvoke(input={}))
        matrix = _parse_game_state(state)
        rules = get_rules(state)
        you_pos = get_state_positions(state, "you")
        win_pos = get_state_positions(state, "win")
        print(you_pos)
        print(win_pos)
        moves = shortest_path(state, win_pos[0], "up")
        print(moves)
        # print("Rules: ", rules)
        # print(str(augment_game_moves(state, MoveOptions(options=[GameMoves(moves=["right", "right", "right", "right"], goal='r r r r')]))))
        break
        time.sleep(3)
