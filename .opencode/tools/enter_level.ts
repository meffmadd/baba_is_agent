import { tool } from "@opencode-ai/plugin";
import { enterLevel } from "./utils/enter_level.js";

export default tool({
  description:
    "Navigate to a specific level from the overworld. Supports levels 1-7 in the 'top' world. Must be in overworld (not currently playing a level) to use this tool.",
  args: {
    level: tool.schema.string().describe("Level number to enter (e.g., '1', '2', '3'). Supports levels 1-7 in the top world."),
    world: tool.schema.string().optional().describe("World name (default: 'top')"),
  },
  async execute(args: { level: string; world?: string }) {
    return enterLevel(args.level, args.world);
  },
});