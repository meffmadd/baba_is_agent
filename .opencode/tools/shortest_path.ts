import { tool } from "@opencode-ai/plugin";
import { findShortestPath } from "./utils/shortest_path.js";

export default tool({
  description: "Find shortest path from YOU to target position using A* pathfinding",
  args: {
    target_x: tool.schema.number().describe("Target x-coordinate"),
    target_y: tool.schema.number().describe("Target y-coordinate"),
    last_move: tool.schema.enum(["up", "down", "left", "right"]).describe("Direction to approach target from. The path goes to the adjacent cell first, then moves this direction to reach the target. Example: 'up' means approach from below (standing at target_x, target_y+1 and moving up). Required for interacting with objects at the target position."),
  },
  async execute(args) {
    return await findShortestPath(args.target_x, args.target_y, args.last_move);
  },
});