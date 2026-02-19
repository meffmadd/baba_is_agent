import { tool } from "@opencode-ai/plugin";
import { getGameState, getRawGameState } from "./utils/get_game_state.js";
import { getRules, getStatePositions } from "./base.js";
import { reachableEntities, shortestPath } from "./path_finding.js";
import type { GameInsights } from "./models.js";

export default tool({
  description:
    "Get current game state as a text grid showing entity positions. Grid uses coordinates (1,1) at top-left. Multiple entities in same cell shown as 'entity1<entity2'. Text objects prefixed with 'text_' (e.g., 'text_baba').",
  args: {
    relevant: tool.schema.boolean().default(true).describe("Filter to show only entities with active rules (text_ entities always shown)")
  },
  async execute(args: { relevant: boolean }) {
    return await getGameState(args.relevant);
  },
});
