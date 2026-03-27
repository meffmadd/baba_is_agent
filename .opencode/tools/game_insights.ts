import { tool } from "@opencode-ai/plugin";
import { getGameInsights } from "./utils/get_game_insights.js";
import type { ToolResponse, GameInsights } from "./utils/models.js";

export default tool({
  description:
    "Analyze the current Baba Is You game state. Returns: active rules (e.g., 'baba IS you'), " +
    "reachable entities grouped by row, YOU positions, WIN positions, path to win if reachable, " +
    "and positions of manipulable rule text blocks.",
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
