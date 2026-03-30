import { getGameState } from "./get_game_state.js";
import { getRules, getStatePositions, getTextBlockPositions, type Direction } from "./base.js";
import { reachableEntities, shortestPath } from "./path_finding.js";
import type { GameInsights, ManipulableRule } from "./models.js";

export async function getGameInsights(): Promise<GameInsights> {
  const gameState = await getGameState();

  const rules = getRules(gameState);
  const youPositions = getStatePositions(gameState, "you");
  const winPositions = getStatePositions(gameState, "win");
  const reachable = reachableEntities(gameState);

  let pathToWin = null;

  if (winPositions.length > 0) {
    const directions = ["up", "down", "left", "right"] as const;
    let shortestMoves: Direction[] | null = null;

    for (const lastMove of directions) {
      const path = shortestPath(gameState, winPositions[0]!, lastMove);
      if (path.length > 0) {
        if (shortestMoves === null || path.length < shortestMoves.length) {
          shortestMoves = path;
        }
      }
    }

    if (shortestMoves !== null) {
      pathToWin = {
        moves: shortestMoves,
        goal: "Move to Goal",
      };
    }
  }

  const textBlocks = getTextBlockPositions(gameState);
  const manipulableRules: ManipulableRule[] = textBlocks.map(({ x, y, text }) => ({
    text,
    position: { x, y },
  }));

  return {
    active_rules: rules,
    reachable_entities: reachable,
    you_positions: youPositions,
    win_positions: winPositions,
    path_to_win: pathToWin,
    manipulable_rules: manipulableRules,
  };
}
