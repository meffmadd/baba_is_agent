import { tool } from "@opencode-ai/plugin";
import { getGameInsights } from "./utils/get_game_insights.js";
import type { ToolResponse, GameInsights } from "./utils/models.js";

export default tool({
  description:
    "Analyze the current Baba Is You game state. Returns: active rules (e.g., 'baba IS you'), " +
    "YOU positions {x, y}, WIN positions {x, y}, path to win if reachable, " +
    "and positions of text entities (text blocks that can form rules). Coordinates: x is horizontal (left-to-right), y is vertical (top-to-bottom), starting at (1,1) at top-left.",
  args: {},
  async execute(args, context: { directory: string }) {
    const result = await getGameInsights();
    const response: ToolResponse<GameInsights> = {
      success: true,
      data: result,
      message: "Game state analyzed"
    };
    return JSON.stringify(response);
  },
});
