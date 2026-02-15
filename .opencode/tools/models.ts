import { z } from "zod";

export const Direction = z.enum(["up", "down", "left", "right"]);
export type Direction = z.infer<typeof Direction>;

export const Position = z.object({
  x: z.number().describe("x-Coordinate of the position to move to"),
  y: z.number().describe("y-Coordinate of the position to move to"),
  last_move: Direction.describe("Last move before moving to the position"),
});
export type Position = z.infer<typeof Position>;

export const GameMoves = z.object({
  moves: z.array(Position).describe("A list of moves"),
  goal: z.string().describe("Description of the goal for the moves"),
});
export type GameMoves = z.infer<typeof GameMoves>;

export const MoveOptions = z.object({
  options: z.array(GameMoves),
});
export type MoveOptions = z.infer<typeof MoveOptions>;

export const AugmentedGameMoves = GameMoves.extend({
  is_valid: z.boolean(),
});
export type AugmentedGameMoves = z.infer<typeof AugmentedGameMoves>;

export const AugmentedMoveOptions = z.object({
  options: z.array(AugmentedGameMoves),
});
export type AugmentedMoveOptions = z.infer<typeof AugmentedMoveOptions>;

export const Rule = z.object({
  entity: z.string(),
  state: z.string(),
});
export type Rule = z.infer<typeof Rule>;

export const GameInsights = z.object({
  active_rules: z.array(Rule),
  reachable_entities: z.array(z.array(z.tuple([z.number(), z.number(), z.string()]))),
  you_positions: z.array(z.tuple([z.number(), z.number()])),
  win_positions: z.array(z.tuple([z.number(), z.number()])),
  path_to_win: GameMoves.nullable(),
});
export type GameInsights = z.infer<typeof GameInsights>;
