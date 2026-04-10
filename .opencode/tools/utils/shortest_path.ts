import { getGameStateAsJson, getRawGameState } from "./get_game_state.js";
import { type Direction } from "./base.js";
import { shortestPathFromGrid } from "./path_finding.js";
import type { ToolResponse, ShortestPathData } from "./models.js";

const VALID_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

export async function findShortestPath(
  target_x: number,
  target_y: number,
  last_move: string
): Promise<string> {
  if (!VALID_DIRECTIONS.includes(last_move as Direction)) {
    const errorResponse: ToolResponse<null> = {
      success: false,
      data: null,
      message: `last_move must be one of: up, down, left, right`
    };
    return JSON.stringify(errorResponse);
  }

  const gameStateJson = await getGameStateAsJson();
  const rawGrid = await getRawGameState();
  const path = shortestPathFromGrid(
    gameStateJson,
    rawGrid.grid,
    { x: target_x, y: target_y },
    last_move as Direction
  );

  const data: ShortestPathData = { path };
  const message = path.length > 0
    ? `Path found (${path.length} steps)`
    : "No path available";

  const response: ToolResponse<ShortestPathData> = {
    success: path.length > 0,
    data,
    message
  };

  return JSON.stringify(response);
}