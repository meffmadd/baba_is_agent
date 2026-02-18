export type Direction = "up" | "down" | "left" | "right";

export interface Position {
  x: number;
  y: number;
  last_move: Direction;
}

export interface MoveOptions {
  options: {
    moves: Position[];
    goal: string;
  }[];
}

export interface AugmentedMoveOptions {
  options: {
    moves: Position[];
    goal: string;
    is_valid: boolean;
  }[];
}

export interface Rule {
  entity: string;
  state: string;
}

export interface ManipulableRule {
  text: string;
  position: number[];
}

export interface GameInsights {
  active_rules: Rule[];
  reachable_entities: [number, number, string][][];
  you_positions: [number, number][];
  win_positions: [number, number][];
  path_to_win: { moves: Direction[]; goal: string } | null;
  manipulable_rules: ManipulableRule[];
}
