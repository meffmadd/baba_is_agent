from typing import Self
from typing import List
from typing import Literal
from typing import Tuple
from pydantic import BaseModel

__all__ = ['GameMoves', 'MoveOptions', 'Reasoning', 'Rule', 'get_rules', 'augment_game_moves']

class GameMoves(BaseModel):
    moves: List[Literal["up", "down", "left", "right"]]
    goal: str

class AugmentedGameMoves(GameMoves):
    stop_positions: List[Tuple[int, int]]
    # encountered_entities: List[str]
    # is_winning: bool

class MoveOptions(BaseModel):
    options: List[GameMoves]

class AugmentedMoveOptions(BaseModel):
    options: List[AugmentedGameMoves]
    you_positions: List[Tuple[int, int]]
    win_positions: List[Tuple[int, int]]

class Reasoning(BaseModel):
    reasoning: str
    suggestion: GameMoves

class Rule(BaseModel):
    entity: str
    state: str

    def __str__(self) -> str:
        return f'{self.entity} is {self.state}'

    def __hash__(self) -> int:
        return str(self).__hash__()

    @classmethod
    def from_string(cls, s: str) -> Self:
        entity, state = [e.strip() for e in s.strip().split("is")]
        return cls(entity=entity, state=state)

_transpose = lambda matrix: [list(row) for row in zip(*matrix)]

def _parse_game_state(game_state: str) -> list[list[str]]:
    lines = game_state.splitlines()[2:]
    return [[c.strip() for c in l.split("|")[1:]] for l in lines]

def _rules_from_row(row: str) -> list[Rule]:
    tokens = row.split(sep=" ")
    rules = []
    for i in range(len(tokens)):
        if "is" in tokens[i]:
            if i > 0 and i < len(tokens) - 1 and tokens[i-1] and tokens[i+1]:
                entity = tokens[i-1].rsplit("<", maxsplit=1)[-1].removeprefix("text_")
                state = tokens[i+1].rsplit("<", maxsplit=1)[-1].removeprefix("text_")
                rules.append(Rule(entity=entity, state=state))
    return rules

def get_rules(game_state: str) -> set[Rule]:
    matrix = _parse_game_state(game_state)
    cells = [[c if "text_" in c else "" for c in row] for row in matrix]
    row_rules = {rule for row in cells for rule in _rules_from_row(" ".join(row))}
    column_rules = {rule for col in _transpose(cells) for rule in _rules_from_row(" ".join(col))}
    return row_rules | column_rules

def _get_coords_of_element(game_state: str, target: str) -> list[tuple[int, int]]:
    matrix = _parse_game_state(game_state)
    coords = []
    for i in range(len(matrix)):
        for j in range(len(matrix[i])):
            if target in matrix[i][j] and "text_" not in matrix[i][j]:
                coords.append((i + 1, j + 1))  # Convert 0-index to 1-index
    return coords

def _get_state_positions(game_state: str, state: str) -> list[tuple[int, int]]:
    you_rule = [r for r in get_rules(game_state) if r.state == state]
    if len(you_rule) == 0:
        return []
    else:
        return _get_coords_of_element(game_state, you_rule[0].entity)

def _apply_moves(start: tuple[int, int], moves: list[Literal["up", "down", "left", "right"]], win_positions: list[tuple[int, int]]) -> tuple[int, int]:
    pos = start
    for move in moves:
        match move:
            case "up":
                pos = (pos[0] - 1, pos[1])
            case "down":
                pos = (pos[0] + 1, pos[1])
            case "left":
                pos = (pos[0], pos[1] - 1)
            case "right":
                pos = (pos[0], pos[1] + 1)
    return pos

def _augment_move(move: GameMoves, you_positions: list[tuple[int, int]], win_positions: list[tuple[int, int]]) -> AugmentedGameMoves:
    move_applications = [_apply_moves(start, move.moves, win_positions) for start in you_positions]
    stop_positions: list[tuple[int, int]] = []
    for stop in move_applications:
        stop_positions.append(stop)

    return AugmentedGameMoves(
        moves=move.moves,
        goal=move.goal,
        stop_positions=stop_positions,
    )

def augment_game_moves(game_state: str, moves: MoveOptions) -> AugmentedMoveOptions:
    you_positions = _get_state_positions(game_state, "you")
    win_positions = _get_state_positions(game_state, "win")
    augmented_moves = [_augment_move(m, you_positions, win_positions) for m in moves.options]
    return AugmentedMoveOptions(options=augmented_moves, you_positions=you_positions, win_positions=win_positions)

def shortest_path_to_win(game_state: str) -> list[Literal["up", "down", "left", "right"]]:
    # TODO: implement (simple) path finding
    pass

if __name__ == "__main__":
    import time
    import asyncio
    import os
    from pathlib import Path
    from langchain_mcp_adapters.client import MultiServerMCPClient

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
        state = asyncio.run(game_state_tool.ainvoke(input={}))
        parsed = _parse_game_state(state)
        rules = get_rules(state)
        you_pos = _get_state_positions(state, "you")
        win_pos = _get_state_positions(state, "win")
        print("Rules: ", rules)
        print("You: ", you_pos)
        print("Winning: ", win_pos)
        # print(state)
        break
        time.sleep(3)
