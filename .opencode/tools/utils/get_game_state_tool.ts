import { getGameStateAsJson, getGameStateAsGrid, getGameStateAsCompact } from "./get_game_state.js";
import type { ToolResponse, GameStateData } from "./models.js";

export async function getGameStateFormatted(
  active_only: boolean = false,
  format: "entities" | "grid" | "compact" = "entities"
): Promise<string> {
  let jsonData: GameStateData;
  if (format === "grid") {
    jsonData = await getGameStateAsGrid(active_only);
  } else if (format === "compact") {
    jsonData = await getGameStateAsCompact(active_only);
  } else {
    jsonData = await getGameStateAsJson(active_only);
  }
  const response: ToolResponse<GameStateData> = {
    success: true,
    data: jsonData,
    message: "Game state retrieved"
  };
  return JSON.stringify(response);
}