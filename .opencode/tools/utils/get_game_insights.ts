import { getGameStateAsJson, getRawGameState } from "./get_game_state.js";
import { getRulesFromGrid, getStatePositionsFromGrid, type Direction } from "./base.js";
import { shortestPathFromGrid } from "./path_finding.js";
import type { GameInsights, GameStateDataEntities } from "./models.js";

export async function getGameInsights(): Promise<GameInsights> {
  const gameState = await getGameStateAsJson();
  const rawGrid = await getRawGameState();

  const rules = getRulesFromGrid(rawGrid.grid);
  const youPositions = getStatePositionsFromGrid(gameState, rawGrid.grid, "you");
  const winPositions = getStatePositionsFromGrid(gameState, rawGrid.grid, "win");

  let pathToWin = null;

  if (winPositions.length > 0) {
    const directions = ["up", "down", "left", "right"] as const;
    let shortestMoves: Direction[] | null = null;

    for (const lastMove of directions) {
      const path = shortestPathFromGrid(gameState, rawGrid.grid, winPositions[0]!, lastMove);
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

  return {
    active_rules: rules,
    you_positions: youPositions,
    win_positions: winPositions,
    path_to_win: pathToWin,
  };
}
