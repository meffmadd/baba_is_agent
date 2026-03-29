import { tool } from "@opencode-ai/plugin";
import { restartLevel } from "./utils/execute_commands.js";

export default tool({
  description: "Restart the current Baba Is You level.",
  args: {
    return_insights: tool.schema.boolean().default(true).describe("Return game insights after restart (active rules, YOU positions, WIN positions, path to win). Set false to return only minimal info."),
  },
  async execute(args: { return_insights: boolean }) {
    return await restartLevel(args.return_insights);
  },
});
