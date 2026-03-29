import { Rule } from "./models.js";

const RELEVANT_ENTITIES = ["baba", "rock", "flag", "wall", "water"];

function transpose<T>(matrix: T[][]): T[][] {
  return matrix[0]!.map((_, i) => matrix.map((row) => row[i]!));
}

function pos2coord(pos: [number, number]): [number, number] {
  return [pos[0] - 1, pos[1] - 1];
}

function coord2pos(coord: [number, number]): [number, number] {
  return [coord[0] + 1, coord[1] + 1];
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
  const firstRow = result[0]!;
  let width = firstRow.length;
  while (width > 0 && firstRow[width - 1]!.trim() === "") {
    width--;
  }
  return result.map((row) => row.slice(0, width));
}

export function gameStateCoords(gameState: string): [number, number, string][] {
  const matrix = parseGameState(gameState);
  const coords: [number, number, string][] = [];

  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < row.length; x++) {
      const entity = row[x]!;
      const entities = entity.split("<");
      for (const e of entities) {
        if (RELEVANT_ENTITIES.includes(e) || e.startsWith("text_")) {
          coords.push([x + 1, y + 1, e]);
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
  const cells = matrix.map((row) =>
    row.map((c) => (c.includes("text_") ? c : ""))
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

function getCoordsOfElement(gameState: string, target: string): [number, number][] {
  const matrix = parseGameState(gameState);
  const coords: [number, number][] = [];

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y]!.length; x++) {
      if (matrix[y]![x]!.includes(target) && !matrix[y]![x]!.includes("text_")) {
        coords.push([x + 1, y + 1]);
      }
    }
  }
  return coords;
}

export function getStatePositions(
  gameState: string,
  state: string
): [number, number][] {
  const rules = getRules(gameState);
  const matchingRules = rules.filter((r) => r.state === state);

  if (matchingRules.length === 0) {
    return [];
  }

  return getCoordsOfElement(gameState, matchingRules[0]!.entity);
}

export function getTextBlockPositions(gameState: string): [number, number, string][] {
  const matrix = parseGameState(gameState);
  const coords: [number, number, string][] = [];

  for (let y = 0; y < matrix.length; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < row.length; x++) {
      const entity = row[x]!;
      const entities = entity.split("<");
      for (const e of entities) {
        if (e.startsWith("text_")) {
          coords.push([x + 1, y + 1, e]);
        }
      }
    }
  }
  return coords;
}

export type Direction = "up" | "down" | "left" | "right";

export function applyMove(
  pos: [number, number],
  move: Direction,
  reverse: boolean = false
): [number, number] {
  const quantity = reverse ? -1 : 1;

  switch (move) {
    case "left":
      return [pos[0] - quantity, pos[1]];
    case "right":
      return [pos[0] + quantity, pos[1]];
    case "up":
      return [pos[0], pos[1] - quantity];
    case "down":
      return [pos[0], pos[1] + quantity];
  }
}
