import { tool } from "@opencode-ai/plugin";
import { getGameState } from "./utils/get_game_state.js";
import { getRules, getStatePositions } from "./base.js";
import { reachableEntities, shortestPath } from "./path_finding.js";
import type { GameInsights } from "./models.js";

export default tool({
  description:
    "Analyze the current Baba Is You game state. Returns active rules, " +
    "reachable entities, YOU position, win position, and path to win if exists.",
  args: {},
  async execute(args, context: { directory: string }) {
    console.log("[game_insights] Fetching game state...");
    const gameState = await getGameState();
    
    console.log("[game_insights] Game state received, analyzing...");
    
    const rules = getRules(gameState);
    const youPositions = getStatePositions(gameState, "you");
    const winPositions = getStatePositions(gameState, "win");
    const reachable = reachableEntities(gameState);
    
    // Group reachable entities by Y coordinate to match schema
    const reachableGrouped: [number, number, string][][] = [];
    const rows = new Map<number, [number, number, string][]>();
    
    for (const item of reachable) {
      const y = item[1];
      if (!rows.has(y)) {
        rows.set(y, []);
      }
      rows.get(y)!.push(item);
    }
    // Sort by Y
    const sortedYs = Array.from(rows.keys()).sort((a, b) => a - b);
    for (const y of sortedYs) {
      reachableGrouped.push(rows.get(y)!);
    }

    let pathToWin = null;
    
    if (winPositions.length > 0) {
      const directions = ["up", "down", "left", "right"] as const;
      for (const lastMove of directions) {
        const path = shortestPath(gameState, winPositions[0]!, lastMove);
        if (path.length > 0) {
          pathToWin = {
            moves: [
              {
                x: winPositions[0]![0],
                y: winPositions[0]![1],
                last_move: lastMove,
              }
            ],
            goal: "Move to Goal",
          };
          break;
        }
      }
    }

    const result: GameInsights = {
      active_rules: rules,
      reachable_entities: reachableGrouped,
      you_positions: youPositions,
      win_positions: winPositions,
      path_to_win: pathToWin,
    };

    console.log("[game_insights] Analysis complete");
    return JSON.stringify(result);
  },
});
