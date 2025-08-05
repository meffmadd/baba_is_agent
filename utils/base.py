from typing import Literal
from .models import Rule

RELEVANT_ENTITIES = ["baba", "rock", "flag", "wall", "water"]

_transpose = lambda matrix: [list(row) for row in zip(*matrix)]
pos2coord = lambda pos: (pos[0] - 1, pos[1] - 1)
coord2pos = lambda coord: (coord[0] + 1, coord[1] + 1)

def _parse_game_state(game_state: str) -> list[list[str]]:
    lines = game_state.splitlines()[2:]
    return [[c.strip() for c in l.split("|")[1:]] for l in lines]

def game_state_coords(game_state: str) -> list[list[tuple[int, int, str]]]:
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
