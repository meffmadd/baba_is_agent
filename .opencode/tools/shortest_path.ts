import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { type Direction } from "./base.js";
import { shortestPath as tsShortestPath } from "./path_finding.js";

export default tool({
  description: "Find shortest path from YOU to target position using A* pathfinding",
  args: {
    game_state: z.string().describe("Current game state string"),
    target_x: z.number().describe("Target x-coordinate"),
    target_y: z.number().describe("Target y-coordinate"),
    last_move: z.enum(["up", "down", "left", "right"]).describe("Final move direction"),
  },
  async execute(args) {
    const path = tsShortestPath(
      args.game_state,
      [args.target_x, args.target_y],
      args.last_move as Direction
    );
    return JSON.stringify({ path });
  },
});
