import { tool } from "@opencode-ai/plugin";
import { getGameState } from "./utils/get_game_state.js";
import { type Direction } from "./base.js";
import { shortestPath as tsShortestPath } from "./path_finding.js";

export default tool({
  description: "Find shortest path from YOU to target position using A* pathfinding",
  args: {
    target_x: tool.schema.number().describe("Target x-coordinate"),
    target_y: tool.schema.number().describe("Target y-coordinate"),
    last_move: tool.schema.string().describe("Final move direction (up, down, left, or right)"),
  },
  async execute(args) {
    const gameState = await getGameState();
    const path = tsShortestPath(
      gameState,
      [args.target_x, args.target_y],
      args.last_move as Direction
    );
    return JSON.stringify({ path });
  },
});
