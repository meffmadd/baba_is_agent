import { tool } from "@opencode-ai/plugin";
import { getGameRules } from "./utils/game_rules.js";

export default tool({
  description:
    "Get help on Baba Is You game rules. Use 'basic' for general rules, or specify a rule name like 'stop', 'push', 'win', etc. for specific explanations.",
  args: {
    topic: tool.schema.string().optional().describe("Rule topic to explain (e.g., 'basic', 'stop', 'push', 'win', 'you', 'defeat'). Default: 'basic'"),
  },
  async execute(args: { topic?: string }) {
    return getGameRules(args.topic);
  },
});