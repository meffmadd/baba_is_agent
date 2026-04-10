import { tool } from "@opencode-ai/plugin";
import { leaveLevel } from "./utils/leave_level.js";

export default tool({
  description:
    "Exit the current level and return to the overworld. Optionally reverses movement to return to starting position.",
  args: {
    reverse_moves: tool.schema.boolean().optional().describe("If true, reverse the movement sequence to return to starting position (default: true)"),
  },
  async execute(args: { reverse_moves?: boolean }) {
    return leaveLevel(args.reverse_moves);
  },
});