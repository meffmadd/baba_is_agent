export type Direction = "up" | "down" | "left" | "right";

export interface Position {
  x: number;
  y: number;
  last_move: Direction;
}

export interface GameMoves {
  moves: Position[];
  goal: string;
}

export interface AugmentedGameMoves {
  moves: Position[];
  goal: string;
  is_valid: boolean;
}

export interface MoveOptions {
  options: GameMoves[];
}

export interface AugmentedMoveOptions {
  options: AugmentedGameMoves[];
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

// Standardized Tool Response Format
export interface ToolResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

// Game State JSON Data Structure
export interface GameStateEntity {
  type: string;
  x: number;
  y: number;
}

export interface GameStateGrid {
  dimensions: {
    width: number;
    height: number;
  };
  entities: GameStateEntity[];
}

export interface GameStateData {
  grid: GameStateGrid;
}

// Command Execution Data Structure
export interface CommandExecutionData {
  executed: string[];
  active_rules: Rule[];
  you_positions: [number, number][];
  win_positions: [number, number][];
}

// Shortest Path Data Structure
export interface ShortestPathData {
  path: Direction[];
}

// Level Control Data Structure
export interface LevelControlData {
  active_rules: Rule[];
  you_positions: [number, number][];
  win_positions: [number, number][];
}
