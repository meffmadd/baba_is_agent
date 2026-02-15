import { tool } from "@opencode-ai/plugin";
import { z } from "zod";
import { augmentGameMoves } from "./augment.js";
import { MoveOptions } from "./models.js";

export default tool({
  description: "Validate proposed moves are reachable",
  args: {
    game_state: z.string().describe("Current game state string"),
    moves: MoveOptions.describe("Move options to validate"),
  },
  async execute(args) {
    const moveOptions = args.moves;
    const result = augmentGameMoves(args.game_state, moveOptions);
    return JSON.stringify(result);
  },
});
