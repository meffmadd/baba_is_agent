from .models import GameMoves, AugmentedGameMoves, MoveOptions, AugmentedMoveOptions
from typing import Literal
from .base import _parse_game_state, _entities_at_pos, apply_move, get_state_positions

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
