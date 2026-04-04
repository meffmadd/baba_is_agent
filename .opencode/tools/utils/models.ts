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

export interface TextEntity {
  text: string;
  position: { x: number; y: number };
}

export interface ReachableEntity {
  x: number;
  y: number;
  entity: string;
}

export interface GameInsights {
  active_rules: Rule[];
  you_positions: { x: number; y: number }[];
  win_positions: { x: number; y: number }[];
  path_to_win: { moves: Direction[]; goal: string } | null;
  text_entities: TextEntity[];
}

// Standardized Tool Response Format
export interface ToolResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

// Game State JSON Data Structure
export interface GameStateData {
  dimensions: {
    width: number;
    height: number;
  };
  entities: Record<string, { x: number; y: number }[]>;
}

// Command Execution Data Structure
export interface CommandExecutionData {
  executed: string[];
  active_rules: Rule[];
  you_positions: { x: number; y: number }[];
  win_positions: { x: number; y: number }[];
}

// Shortest Path Data Structure
export interface ShortestPathData {
  path: Direction[];
}

// Level Control Data Structure
export interface LevelControlData {
  active_rules: Rule[];
  you_positions: { x: number; y: number }[];
  win_positions: { x: number; y: number }[];
}

// Position change tracking
export interface PositionMoved {
  entity: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface PositionCreated {
  entity: string;
  at: { x: number; y: number };
}

export interface PositionDestroyed {
  entity: string;
  at: { x: number; y: number };
}

export interface PositionChanges {
  moved: PositionMoved[];
  created: PositionCreated[];
  destroyed: PositionDestroyed[];
}

// Rule change tracking
export interface RuleChanges {
  added: string[];
  removed: string[];
}

// Diff structure
export interface StateDiff {
  positions: PositionChanges;
  rules: RuleChanges;
}

// Command Execution Data Structure with Diff
export interface CommandExecutionDataWithDiff extends CommandExecutionData {
  diff: StateDiff;
}
