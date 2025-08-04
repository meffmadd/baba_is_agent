from .models import GameMoves, AugmentedGameMoves, MoveOptions, AugmentedMoveOptions
from .path_finding import shortest_path

def _augment_move(game_state: str, move: GameMoves) -> AugmentedGameMoves:
    is_valid = True
    for m in move.moves:
        path = shortest_path(game_state, (m.x, m.y), m.last_move)
        if len(path) == 0:
            is_valid = False
        break

    return AugmentedGameMoves(
        moves=move.moves,
        goal=move.goal,
        is_valid=is_valid
    )

def augment_game_moves(game_state: str, moves: MoveOptions) -> AugmentedMoveOptions:
    augmented_moves = [_augment_move(game_state, m) for m in moves.options]
    return AugmentedMoveOptions(options=augmented_moves)
