import { tool } from "@opencode-ai/plugin";
import { getGameStateAsJson } from "./utils/get_game_state.js";
import type { ToolResponse, GameStateData } from "./utils/models.js";

export default tool({
  description:
    "Get current game state. Returns JSON with dimensions and entities mapped by name to their positions. Coordinates use x (horizontal/left-to-right) and y (vertical/top-to-bottom), starting at (1,1) at top-left. Text objects prefixed with 'text_' (e.g., 'text_baba').",
  args: {
    active_only: tool.schema.boolean().default(false).describe("When true, show only entities with active rules (e.g., 'baba' with YOU, 'wall' with STOP). When false, show all entities including those without active rules.")
  },
  async execute(args: { active_only: boolean }) {
    const jsonData = await getGameStateAsJson(args.active_only);
    const response: ToolResponse<GameStateData> = {
      success: true,
      data: jsonData,
      message: "Game state retrieved"
    };
    return JSON.stringify(response);
  },
});
