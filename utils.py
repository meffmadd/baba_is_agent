from typing import Self, List, Literal, Tuple
from pydantic import BaseModel
from textwrap import dedent, indent
from heapq import heappush, heappop

__all__ = ['GameMoves', 'MoveOptions', 'Reasoning', 'Rule', 'get_rules', 'augment_game_moves', 'game_state_coords', 'get_state_positions']

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

RELEVANT_ENTITIES = ["baba", "rock", "flag", "wall", "water"]

_transpose = lambda matrix: [list(row) for row in zip(*matrix)]
pos2coord = lambda pos: (pos[0] - 1, pos[1] - 1)
coord2pos = lambda coord: (coord[0] + 1, coord[1] + 1)

def _parse_game_state(game_state: str) -> list[list[str]]:
    lines = game_state.splitlines()[2:]
    return [[c.strip() for c in l.split("|")[1:]] for l in lines]

def game_state_coords(game_state: str) -> list[list[str]]:
    """Returns coordinates of relevant entities."""
    matrix = _parse_game_state(game_state)
    coords = []
    for y, row in enumerate(matrix):
        row_coords = []
        for x, entity in enumerate(row):
            entities = entity.split("<")
            for e in entities:
                if e in RELEVANT_ENTITIES or e.startswith("text_"):
                    row_coords.append((x + 1, y + 1, e))
        if len(row_coords) > 0:
            coords.append(row_coords)
    return coords

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
    for y in range(len(matrix)):
        for x in range(len(matrix[y])):
            if target in matrix[y][x] and "text_" not in matrix[y][x]:
                coords.append((x + 1, y + 1))  # Convert 0-index to 1-index
    return coords

def get_state_positions(game_state: str, state: str) -> list[tuple[int, int]]:
    you_rule = [r for r in get_rules(game_state) if r.state == state]
    if len(you_rule) == 0:
        return []
    else:
        return _get_coords_of_element(game_state, you_rule[0].entity)

def _entities_at_pos(state_matrix: list[list[str]], pos: tuple[int, int]) -> set[str]:
    try:
        entities = state_matrix[pos[1] - 1][pos[0] - 1]
    except IndexError:
        return set()
    return set(e for e in entities.split("<") if e)

def apply_move(pos: tuple[int, int], move: Literal["up", "down", "left", "right"], reverse: bool = False) -> tuple[int, int]:
    quantity = -1 if reverse else 1
    match move:
        case "left":
            return (pos[0] - quantity, pos[1])
        case "right":
            return (pos[0] + quantity, pos[1])
        case "up":
            return (pos[0], pos[1] - quantity)
        case "down":
            return (pos[0], pos[1] + quantity)

def _apply_moves(start: tuple[int, int], moves: list[Literal["up", "down", "left", "right"]], state_matrix: list[list[str]]) -> tuple[tuple[int, int], set[str]]:
    pos = start
    objects: set[str] = set()
    for move in moves:
        pos = apply_move(pos, move)
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
    you_positions = get_state_positions(game_state, "you")
    win_positions = get_state_positions(game_state, "win")
    augmented_moves = [_augment_move(game_state, m, you_positions, win_positions) for m in moves.options]
    return AugmentedMoveOptions(options=augmented_moves, you_positions=you_positions, win_positions=win_positions)

def _blocked_entities(game_state: str, avoid_text: bool = True) -> list[list[int]]:
    """ Build simple "blocked" grid, where 1 means blocked (based on rules (e.g. wall is stop, lava is hot + you is melt)) and 0 means allowed. """
    rules = get_rules(game_state)
    _blocked_entities: list[tuple[str | None, str]] = [(None, "stop"), (None, "defeat"), ("melt", "hot")]
    yous = [r.entity for r in rules if r.state == "you"]
    matrix = _parse_game_state(game_state)
    blocked_matrix = []
    for y, row in enumerate(matrix):
        row_blocked = []
        for x, entity in enumerate(row):
            entities = entity.split("<")
            blocked = 0
            for e in entities:
                for you in yous:
                    for you_req, blocked_state in _blocked_entities:
                        rs = [r for r in rules if r.entity == e]
                        for r in rs:
                            if not you_req and r.state == blocked_state:
                                blocked = 1
                            elif you_req == you and r.state == blocked_state:
                                blocked = 1
                        if avoid_text and e.startswith("text_"):
                            blocked = 1
            row_blocked.append(blocked)
        blocked_matrix.append(row_blocked)
    return blocked_matrix


def heuristic(a: tuple[int,int], b: tuple[int,int]):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])

def a_star(grid: list[list[int]], start: tuple[int,int], goal: tuple[int, int]) -> list[tuple[int,int]] | None:
    """Performs A* search on the grid. Returns the grid positions of the solution. Returns None if no solution has been found."""
    if grid[start[1]][start[0]] == 1 or grid[goal[1]][goal[0]] == 1:
            return None

    neighbors = [(0,1),(0,-1),(1,0),(-1,0)]
    shape = (len(grid[0]), len(grid))

    close_set: set[tuple[int, int]] = set()
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    gscore: dict[tuple[int, int], float] = {start:0}
    fscore: dict[tuple[int, int], float] = {start: heuristic(start, goal)}
    oheap = []

    heappush(oheap, (fscore[start], start))
    while oheap:
        current = heappop(oheap)[1]
        if current == goal:
            data: list[tuple[int,int]] = []
            while current in came_from:
                data.append(current)
                current = came_from[current]
            return data[::-1]
        close_set.add(current)
        for i, j in neighbors:
            neighbor = current[0] + i, current[1] + j
            tentative_g_score = gscore[current] + heuristic(current, neighbor)
            if 0 <= neighbor[0] < shape[0]:
                if 0 <= neighbor[1] < shape[1]:
                    if grid[neighbor[1]][neighbor[0]] == 1:
                        continue
                else:
                    # array bound y walls
                    continue
            else:
                # array bound x walls
                continue

            if neighbor in close_set and tentative_g_score >= gscore.get(neighbor, 0):
                continue

            if  tentative_g_score < gscore.get(neighbor, 0) or neighbor not in [i[1] for i in oheap]:
                came_from[neighbor] = current
                gscore[neighbor] = tentative_g_score
                fscore[neighbor] = tentative_g_score + heuristic(neighbor, goal)
                heappush(oheap, (fscore[neighbor], neighbor))

    return None

def convert_path_to_moves(path: list[tuple[int,int]]) -> list[Literal["up", "down", "left", "right"]]:
    lookup: dict[tuple, Literal["up", "down", "left", "right"]] = {
        (0,1): "down",
        (0,-1): "up",
        (1,0): "right",
        (-1,0): "left"
    }
    diff = lambda a, b: (a[0]-b[0], a[1]-b[1])
    diffs = [diff(b, a) for a, b in zip(path, path[1:])]
    return [lookup[p] for p in diffs]

# TODO: add tool to convert input to path and execute via
def shortest_path(game_state: str, goal: tuple[int, int], last_move: Literal["up", "down", "left", "right"]) -> list[Literal["up", "down", "left", "right"]]:
    goal = (goal[0] - 1, goal[1] - 1)
    goal_prev = apply_move(goal, last_move, reverse=True)
    blocked = _blocked_entities(game_state)
    assert not blocked[goal[1]][goal[0]]
    prev_blocked = blocked[goal_prev[1]][goal_prev[0]]
    if prev_blocked:
        blocked = _blocked_entities(game_state, avoid_text=False)
    assert not blocked[goal_prev[1]][goal_prev[0]]
    you_pos = get_state_positions(state, "you")[0] # only take on "you" position
    you_coord = (you_pos[0] - 1, you_pos[1] - 1)

    path = a_star(blocked, you_coord, goal_prev)
    if path is None:
        return []
    moves = convert_path_to_moves([you_coord] + path)
    return moves + [last_move]

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
