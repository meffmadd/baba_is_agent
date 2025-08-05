from typing import Literal
from heapq import heappush, heappop

from langchain_core.runnables.config import P

from .base import get_rules, _parse_game_state, apply_move, get_state_positions, game_state_coords

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
    # TODO: raise appropriate exceptions to pass reason for failure (e.g. goal is blocked, prev_goal is blocked etc.)
    # TODO: if goal is on text (e.g. to deactivate) it is handled not gracefully -> it should avoid text within the path but not if the goal is text
    goal = (goal[0] - 1, goal[1] - 1)
    goal_prev = apply_move(goal, last_move, reverse=True)
    blocked = _blocked_entities(game_state)
    blocked_no_text = _blocked_entities(game_state, avoid_text=False)
    if blocked_no_text[goal[1]][goal[0]]:
        return []
    prev_blocked = blocked[goal_prev[1]][goal_prev[0]]
    if prev_blocked:
        return []
    you_pos = get_state_positions(game_state, "you") # only take on "you" position

    for you in you_pos:
        you_coord = (you[0] - 1, you[1] - 1)

        path = a_star(blocked, you_coord, goal_prev)
        if path is None:
            continue
        moves = convert_path_to_moves([you_coord] + path)
        return moves + [last_move]
    return []


def reachable_entities(game_state: str) -> list[list[tuple[int, int, str]]]:
    coords = game_state_coords(game_state)
    reachable_entities: list[list[tuple[int, int, str]]] = []
    for row in coords:
        row_reachable = []
        for x, y, entity in row:
            path = None
            last_moves: list[Literal["up", "down", "left", "right"]] = ["up", "down", "left", "right"]
            for last_move in last_moves:
                p = shortest_path(game_state, (x, y), last_move)
                if len(p) > 0:
                    path = p
                    break
            if path:
                row_reachable.append((x, y, entity))
        if len(row_reachable) > 0:
            reachable_entities.append(row_reachable)
    return reachable_entities
