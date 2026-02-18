import { tool } from "@opencode-ai/plugin";
import { getGameState } from "./utils/get_game_state.js";
import { augmentGameMoves } from "./augment.js";

export default tool({
  description: "Validate whether a sequence of proposed moves can actually be executed. Checks if each intermediate position is reachable from the current YOU position. Returns the moves with is_valid flag set to true/false.",
  args: {
    moves: tool.schema.object({}).describe("Move options to validate containing 'options' array with 'moves' (array of positions with x, y, last_move) and 'goal' (string describing the objective)"),
  },
  async execute(args) {
    const gameState = await getGameState();
    const result = augmentGameMoves(gameState, args.moves as any);
    return JSON.stringify(result);
  },
});
