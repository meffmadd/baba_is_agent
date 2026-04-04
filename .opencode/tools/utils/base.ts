import { Rule, type GameStateDataEntities } from "./models.js";

const RELEVANT_ENTITIES = ["baba", "rock", "flag", "wall", "water"];

function transpose<T>(matrix: T[][]): T[][] {
  return matrix[0]!.map((_, i) => matrix.map((row) => row[i]!));
}

function pos2coord(pos: { x: number; y: number }): { x: number; y: number } {
  return { x: pos.x - 1, y: pos.y - 1 };
}

function coord2pos(coord: { x: number; y: number }): { x: number; y: number } {
  return { x: coord.x + 1, y: coord.y + 1 };
}

export function parseGameState(gameState: string): string[][] {
  const lines = gameState.split("\n").slice(2);
  const result: string[][] = [];
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const parts = line.split("|").slice(1);
    const row: string[] = [];
    for (const part of parts) {
      row.push(part.trim());
    }
    const nonEmptyCount = row.filter((c) => c.length > 0).length;
    if (nonEmptyCount === 0) continue;
    result.push(row);
  }
  if (result.length === 0) return result;
  // Find the maximum width across all rows (not just the first one)
  let width = 0;
  for (const row of result) {
    // Find the last non-empty column in this row
    let rowWidth = row.length;
    while (rowWidth > 0 && row[rowWidth - 1]!.trim() === "") {
      rowWidth--;
    }
    width = Math.max(width, rowWidth);
  }
  return result.map((row) => row.slice(0, width));
}

export function gameStateCoords(gameState: string): { x: number; y: number; entity: string }[] {
  const matrix = parseGameState(gameState);
  const coords: { x: number; y: number; entity: string }[] = [];

  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < row.length; x++) {
      const entity = row[x]!;
      const entities = entity.split("<");
      for (const e of entities) {
        if (RELEVANT_ENTITIES.includes(e) || e.startsWith("text_")) {
          coords.push({ x: x + 1, y: y + 1, entity: e });
        }
      }
    }
  }
  return coords;
}

function rulesFromRow(row: string): Rule[] {
  const tokens = row.split(" ");
  const rules: Rule[] = [];

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.includes("is")) {
      if (i > 0 && i < tokens.length - 1 && tokens[i - 1] && tokens[i + 1]) {
        const entity = tokens[i - 1]!.split("<").pop()?.replace(/^text_/, "") ?? "";
        const state = tokens[i + 1]!.split("<").pop()?.replace(/^text_/, "") ?? "";
        rules.push({ entity, state });
      }
    }
  }
  return rules;
}

export function getRules(gameState: string): Rule[] {
  const matrix = parseGameState(gameState);
  return getRulesFromGrid(matrix);
}

export function getRulesFromGrid(grid: string[][]): Rule[] {
  const cells = grid.map((row) =>
    row.map((c) => (c && c.includes("text_") ? c : ""))
  );

  const rowRules = new Set<Rule>();
  for (const row of cells) {
    const rules = rulesFromRow(row.join(" "));
    rules.forEach((r) => rowRules.add(r));
  }

  const transposed = transpose(cells);
  const colRules = new Set<Rule>();
  for (const col of transposed) {
    const rules = rulesFromRow(col.join(" "));
    rules.forEach((r) => colRules.add(r));
  }

  return [...new Set([...rowRules, ...colRules])];
}

function getCoordsOfElement(gameState: string, target: string): { x: number; y: number }[] {
  const matrix = parseGameState(gameState);
  const coords: { x: number; y: number }[] = [];

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y]!.length; x++) {
      if (matrix[y]![x]!.includes(target) && !matrix[y]![x]!.includes("text_")) {
        coords.push({ x: x + 1, y: y + 1 });
      }
    }
  }
  return coords;
}

function getCoordsOfElementFromGrid(grid: string[][], target: string): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = [];

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y]!.length; x++) {
      const cell = grid[y]![x];
      if (cell && cell.includes(target) && !cell.includes("text_")) {
        coords.push({ x: x + 1, y: y + 1 });
      }
    }
  }
  return coords;
}

export function getStatePositions(
  gameState: string,
  state: string
): { x: number; y: number }[] {
  const rules = getRules(gameState);
  const matchingRules = rules.filter((r) => r.state === state);

  if (matchingRules.length === 0) {
    return [];
  }

  return getCoordsOfElement(gameState, matchingRules[0]!.entity);
}

export function getStatePositionsFromGrid(
  gameStateJson: GameStateDataEntities,
  grid: string[][],
  state: string
): { x: number; y: number }[] {
  const rules = getRulesFromGrid(grid);
  const matchingRules = rules.filter((r) => r.state === state);

  if (matchingRules.length === 0) {
    return [];
  }

  // Get positions directly from the JSON entities data
  const entityName = matchingRules[0]!.entity;
  return gameStateJson.entities[entityName] || [];
}

export function getTextBlockPositions(gameState: string): { x: number; y: number; text: string }[] {
  const matrix = parseGameState(gameState);
  const coords: { x: number; y: number; text: string }[] = [];

  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < row.length; x++) {
      const entity = row[x]!;
      const entities = entity.split("<");
      for (const e of entities) {
        if (e.startsWith("text_")) {
          coords.push({ x: x + 1, y: y + 1, text: e });
        }
      }
    }
  }
  return coords;
}

export type Direction = "up" | "down" | "left" | "right";

export function applyMove(
  pos: { x: number; y: number },
  move: Direction,
  reverse: boolean = false
): { x: number; y: number } {
  const quantity = reverse ? -1 : 1;

  switch (move) {
    case "left":
      return { x: pos.x - quantity, y: pos.y };
    case "right":
      return { x: pos.x + quantity, y: pos.y };
    case "up":
      return { x: pos.x, y: pos.y - quantity };
    case "down":
      return { x: pos.x, y: pos.y + quantity };
  }
}
