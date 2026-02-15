import { tool } from "@opencode-ai/plugin";
import { executeCommands, restartLevel, undoMultiple } from "./execute_commands.js";

export default tool({
  description:
    "Execute a sequence of Baba Is You commands. Commands should be comma-separated (e.g., 'right,up,down').",
  args: {
    commands: tool.schema.string().describe("Comma-separated list of commands (right, up, left, down, undo, restart_instant)"),
  },
  async execute(args) {
    return await executeCommands(args.commands);
  },
});
