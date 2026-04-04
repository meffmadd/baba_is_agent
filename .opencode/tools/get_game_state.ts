import { tool } from "@opencode-ai/plugin";
import { getGameStateAsJson, getGameStateAsGrid } from "./utils/get_game_state.js";
import type { ToolResponse, GameStateData } from "./utils/models.js";

export default tool({
  description:
    "Get current game state. Returns JSON with dimensions and either entities mapped by name to their positions, or a 2D grid of the game state. Coordinates use x (horizontal/left-to-right) and y (vertical/top-to-bottom), starting at (1,1) at top-left. Text objects prefixed with 'text_' (e.g., 'text_baba').",
  args: {
    active_only: tool.schema.boolean().default(false).describe("When true, show only entities with active rules (e.g., 'baba' with YOU, 'wall' with STOP). When false, show all entities including those without active rules."),
    format: tool.schema.enum(["entities", "grid"]).default("entities").describe("Output format: 'entities' returns entities mapped by name to coordinates, 'grid' returns a 2D array representing the game grid.")
  },
  async execute(args: { active_only: boolean; format: "entities" | "grid" }) {
    let jsonData: GameStateData;
    if (args.format === "grid") {
      jsonData = await getGameStateAsGrid(args.active_only);
    } else {
      jsonData = await getGameStateAsJson(args.active_only);
    }
    const response: ToolResponse<GameStateData> = {
      success: true,
      data: jsonData,
      message: "Game state retrieved"
    };
    return JSON.stringify(response);
  },
});
