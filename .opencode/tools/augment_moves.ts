import { tool } from "@opencode-ai/plugin";
import { getGameState } from "./utils/get_game_state.js";
import { augmentGameMoves } from "./augment.js";

export default tool({
  description: "Validate proposed moves are reachable",
  args: {
    moves: tool.schema.object({}).describe("Move options to validate"),
  },
  async execute(args) {
    const gameState = await getGameState();
    const result = augmentGameMoves(gameState, args.moves as any);
    return JSON.stringify(result);
  },
});
