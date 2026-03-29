import { tool } from "@opencode-ai/plugin";
import { undoMultiple } from "./utils/execute_commands.js";
import type { ToolResponse } from "./utils/models.js";

export default tool({
  description:
    "Undo the last N moves by executing multiple undo commands. Useful for backtracking when stuck.",
  args: {
    n: tool.schema.number().describe("Number of moves to undo (must be positive)"),
    return_insights: tool.schema.boolean().default(true).describe("Return game insights after execution (active rules, YOU positions, WIN positions, path to win). Set false to return only the diff."),
  },
  async execute(args: { n: number; return_insights: boolean }) {
    if (args.n <= 0) {
      const errorResponse: ToolResponse<null> = {
        success: false,
        data: null,
        message: "Error: Number of undos must be positive"
      };
      return JSON.stringify(errorResponse);
    }
    return await undoMultiple(args.n, args.return_insights);
  },
});
