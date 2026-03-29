import { tool } from "@opencode-ai/plugin";
import { executeCommands } from "./utils/execute_commands.js";

export default tool({
  description:
    "Execute movement commands in Baba Is You. Valid commands: 'right', 'up', 'left', 'down' (movement), 'idle' (wait turn). Commands execute in order.",
  args: {
    commands: tool.schema.string().describe("Comma-separated list of commands to execute. Valid: 'right', 'up', 'left', 'down' (move YOU), 'idle' (wait turn). Example: 'right,up,up,left'"),
    return_insights: tool.schema.boolean().default(true).describe("Return game insights after execution (active rules, YOU positions, WIN positions, path to win). Set false to return only the diff."),
  },
  async execute(args) {
    return await executeCommands(args.commands, args.return_insights);
  },
});
