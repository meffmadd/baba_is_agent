import { tool } from "@opencode-ai/plugin";
import { getGameInsights } from "./utils/get_game_insights.js";

export default tool({
  description:
    "Analyze the current Baba Is You game state. Returns: active rules (e.g., 'baba IS you'), " +
    "reachable entities grouped by row, YOU positions, WIN positions, path to win if reachable, " +
    "and positions of manipulable rule text blocks.",
  args: {},
  async execute(args, context: { directory: string }) {
    const result = await getGameInsights();
    return JSON.stringify(result);
  },
});
