import { tool } from "@opencode-ai/plugin";
import { restartLevel } from "./execute_commands.js";

export default tool({
  description: "Restart the current Baba Is You level.",
  args: {},
  async execute(args) {
    return await restartLevel();
  },
});
