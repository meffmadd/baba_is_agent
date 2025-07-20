from typing import Self
from typing import List
from typing import Literal
from typing import Tuple
from pydantic import BaseModel
from textwrap import dedent, indent

__all__ = ['GameMoves', 'MoveOptions', 'Reasoning', 'Rule', 'get_rules', 'augment_game_moves']

class GameMoves(BaseModel):
    moves: List[Literal["up", "down", "left", "right"]]
    goal: str

class AugmentedGameMoves(GameMoves):
    stop_positions: List[Tuple[int, int]]
    objects_on_path: List[str]
    # is_winning: bool

    def __str__(self) -> str:
        return dedent(f"""
        Moves: {self.moves}
        Goal of moves: {self.goal}
        Assuming movement is not affected, stop positions for this move are: {self.stop_positions}
        Assuming movement is not affected, "YOU" would encounter the following objects along the path (unordered): {self.objects_on_path}
        """).strip()

class MoveOptions(BaseModel):
    options: List[GameMoves]

class AugmentedMoveOptions(BaseModel):
    options: List[AugmentedGameMoves]
    you_positions: List[Tuple[int, int]]
    win_positions: List[Tuple[int, int]]

    def __str__(self) -> str:
        return dedent(f"""
        "YOU" are currently at position(s): {self.you_positions}
        Positions leading to a win state are currently at position: {self.win_positions if len(self.win_positions) > 0 else "Corrently no win positions active..."}
        Move options:
        {"\n\t".join([f"- Option {i+1}:\n{indent(str(opt), prefix="\t\t")}" for i, opt in enumerate(self.options)])}
        """).strip()

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

def _entities_at_pos(state_matrix: list[list[str]], pos: tuple[int, int]) -> set[str]:
    try:
        entities = state_matrix[pos[0] - 1][pos[1] - 1]
    except IndexError:
        return set()
    return set(e for e in entities.split("<") if e)

def _apply_moves(start: tuple[int, int], moves: list[Literal["up", "down", "left", "right"]], state_matrix: list[list[str]]) -> tuple[tuple[int, int], set[str]]:
    pos = start
    objects: set[str] = set()
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

        objects |= _entities_at_pos(state_matrix, pos)
    return pos, objects

def _augment_move(game_state: str, move: GameMoves, you_positions: list[tuple[int, int]], win_positions: list[tuple[int, int]]) -> AugmentedGameMoves:
    matrix = _parse_game_state(game_state)
    move_applications = [_apply_moves(start, move.moves, matrix) for start in you_positions]
    stop_positions: list[tuple[int, int]] = []
    objects_on_path: set[str] = set()
    for stop, objects in move_applications:
        stop_positions.append(stop)
        objects_on_path |= objects

    return AugmentedGameMoves(
        moves=move.moves,
        goal=move.goal,
        stop_positions=stop_positions,
        objects_on_path=list(objects_on_path)
    )

def augment_game_moves(game_state: str, moves: MoveOptions) -> AugmentedMoveOptions:
    you_positions = _get_state_positions(game_state, "you")
    win_positions = _get_state_positions(game_state, "win")
    augmented_moves = [_augment_move(game_state, m, you_positions, win_positions) for m in moves.options]
    return AugmentedMoveOptions(options=augmented_moves, you_positions=you_positions, win_positions=win_positions)

def shortest_path_to_win(game_state: str) -> list[Literal["up", "down", "left", "right"]]:
    # TODO: implement (simple) path finding
    # TODO: let LLM not pick moves but instead let it pick either an entity (e.g. text_stop or flag) and coordinates (if multiple otherwise None) and let pathfinding determine the moves
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
        matrix = _parse_game_state(state)
        rules = get_rules(state)
        you_pos = _get_state_positions(state, "you")
        win_pos = _get_state_positions(state, "win")
        print("Rules: ", rules)
        print(str(augment_game_moves(state, MoveOptions(options=[GameMoves(moves=["right", "right", "right", "right"], goal='r r r r')]))))
        break
        time.sleep(3)
