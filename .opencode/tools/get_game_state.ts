import { tool } from "@opencode-ai/plugin";
import { getGameState, getRawGameState } from "./utils/get_game_state.js";
import { getRules, getStatePositions } from "./utils/base.js";
import { reachableEntities, shortestPath } from "./utils/path_finding.js";
import type { GameInsights } from "./utils/models.js";

export default tool({
  description:
    "Get current game state as a text grid showing entity positions. Grid uses coordinates (1,1) at top-left. Multiple entities in same cell shown as 'entity1<entity2'. Text objects prefixed with 'text_' (e.g., 'text_baba').",
  args: {
    active_only: tool.schema.boolean().default(false).describe("When true, show only entities with active rules (e.g., 'baba' with YOU, 'wall' with STOP). When false, show all entities including those without active rules.")
  },
  async execute(args: { active_only: boolean }) {
    return await getGameState(args.active_only);
  },
});
