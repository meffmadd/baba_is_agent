import { tool } from "@opencode-ai/plugin";
import { getGameState } from "./utils/get_game_state.js";
import { type Direction } from "./utils/base.js";
import { shortestPath as tsShortestPath } from "./utils/path_finding.js";
import type { ToolResponse, ShortestPathData } from "./utils/models.js";

export default tool({
  description: "Find shortest path from YOU to target position using A* pathfinding",
  args: {
    target_x: tool.schema.number().describe("Target x-coordinate"),
    target_y: tool.schema.number().describe("Target y-coordinate"),
    last_move: tool.schema.enum(["up", "down", "left", "right"]).describe("Direction to approach target from. The path goes to the adjacent cell first, then moves this direction to reach the target. Example: 'up' means approach from below (standing at target_x, target_y+1 and moving up). Required for interacting with objects at the target position."),
  },
  async execute(args) {
    const validDirections: Direction[] = ["up", "down", "left", "right"];
    if (!validDirections.includes(args.last_move as Direction)) {
      const errorResponse: ToolResponse<null> = {
        success: false,
        data: null,
        message: `last_move must be one of: up, down, left, right`
      };
      return JSON.stringify(errorResponse);
    }
    const gameState = await getGameState();
    const path = tsShortestPath(
      gameState,
      { x: args.target_x, y: args.target_y },
      args.last_move as Direction
    );

    const data: ShortestPathData = { path };
    const message = path.length > 0
      ? `Path found (${path.length} steps)`
      : "No path available";

    const response: ToolResponse<ShortestPathData> = {
      success: path.length > 0,
      data,
      message
    };

    return JSON.stringify(response);
  },
});
