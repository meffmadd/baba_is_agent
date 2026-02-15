import { tool } from "@opencode-ai/plugin";
import { getGameState, getRawGameState } from "./utils/get_game_state.js";
import { getRules, getStatePositions } from "./base.js";
import { reachableEntities, shortestPath } from "./path_finding.js";
import type { GameInsights } from "./models.js";

export default tool({
  description:
    "Get the current Baba Is You game state as a grid. Returns entities and their positions.",
  args: {},
  async execute(args) {
    return await getGameState();
  },
});
