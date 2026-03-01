import { tool } from "@opencode-ai/plugin";
import { restartLevel } from "./utils/execute_commands.js";

export default tool({
  description: "Restart the current Baba Is You level.",
  args: {
    return_state: tool.schema.boolean().default(true).describe("Return minimal game state after restart. Set false to skip."),
  },
  async execute(args: { return_state: boolean }) {
    return await restartLevel(args.return_state);
  },
});
