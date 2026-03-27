import { tool } from "@opencode-ai/plugin";
import { undoMultiple } from "./utils/execute_commands.js";
import type { ToolResponse } from "./utils/models.js";

export default tool({
  description:
    "Undo the last N moves by executing multiple undo commands. Useful for backtracking when stuck.",
  args: {
    n: tool.schema.number().describe("Number of moves to undo (must be positive)"),
    return_state: tool.schema.boolean().default(true).describe("Return minimal game state after execution. Set false to skip."),
  },
  async execute(args: { n: number; return_state: boolean }) {
    if (args.n <= 0) {
      const errorResponse: ToolResponse<null> = {
        success: false,
        data: null,
        message: "Error: Number of undos must be positive"
      };
      return JSON.stringify(errorResponse);
    }
    return await undoMultiple(args.n, args.return_state);
  },
});
