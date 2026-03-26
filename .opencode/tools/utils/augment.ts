import { GameMoves, AugmentedGameMoves, MoveOptions, AugmentedMoveOptions, type Position } from "./models.js";
import { shortestPath } from "./path_finding.js";

function augmentMove(gameState: string, move: GameMoves): AugmentedGameMoves {
  let isValid = true;

  for (const m of move.moves) {
    const path = shortestPath(gameState, [m.x, m.y], m.last_move);
    if (path.length === 0) {
      isValid = false;
      break;
    }
  }

  return {
    moves: move.moves,
    goal: move.goal,
    is_valid: isValid,
  };
}

export function augmentGameMoves(
  gameState: string,
  moves: MoveOptions
): AugmentedMoveOptions {
  const augmentedMoves = moves.options.map((m) => augmentMove(gameState, m));
  return { options: augmentedMoves };
}
