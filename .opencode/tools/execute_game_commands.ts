import { tool } from "@opencode-ai/plugin";
import { executeCommands } from "./utils/execute_commands.js";

export default tool({
  description:
    "Execute movement and game commands in Baba Is You. Valid commands: 'right', 'up', 'left', 'down' (movement), 'undo' (revert last move), 'restart_instant' (reset level). Commands execute in order.",
  args: {
    commands: tool.schema.string().describe("Comma-separated list of commands to execute. Valid: 'right', 'up', 'left', 'down' (move YOU), 'undo' (revert one move), 'restart_instant' (restart current level). Example: 'right,up,up,left'"),
    return_state: tool.schema.boolean().default(true).describe("Return minimal game state after execution (rules, positions). Set false to skip for simple moves."),
  },
  async execute(args) {
    return await executeCommands(args.commands, args.return_state);
  },
});
