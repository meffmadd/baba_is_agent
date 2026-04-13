import { getGameStateAsJson, getGameStateAsGrid } from "./get_game_state.js";
import type { ToolResponse, GameStateDataEntities, GameStateDataGrid } from "./models.js";

export async function getGameStateFormatted(
  active_only: boolean = false,
  format: "entities" | "grid" = "entities"
): Promise<string> {
  let jsonData: GameStateDataEntities | GameStateDataGrid;
  if (format === "grid") {
    jsonData = await getGameStateAsGrid(active_only);
  } else {
    jsonData = await getGameStateAsJson(active_only);
  }
  const response: ToolResponse<GameStateDataEntities | GameStateDataGrid> = {
    success: true,
    data: jsonData,
    message: "Game state retrieved"
  };
  return JSON.stringify(response);
}