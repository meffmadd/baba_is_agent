import * as fs from "fs";
import * as path from "path";
import { getRules } from "./base.js";
import type { GameStateDataEntities, GameStateDataGrid } from "./models.js";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

function filterGridByRelevance(grid: string[][], relevantSubjects: Set<string>): string[][] {
  return grid.map(row =>
    row.map(cell => {
      if (!cell) return "";
      const entities = cell.split("<");
      const filtered = entities.filter(e =>
        e.startsWith("text_") || relevantSubjects.has(e)
      );
      return filtered.join("<");
    })
  );
}

function buildFormattedOutput(grid: string[][], width: number, height: number): string {
  let output = `y/x |`;
  for (let x = 0; x < width; x++) {
    output += ` ${String(x + 1).padStart(3)} |`;
  }
  output += "\n" + "-".repeat(output.length - 1) + "\n";

  for (let y = 0; y < height; y++) {
    output += `${String(y + 1).padStart(3)} |`;
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x] || "";
      output += ` ${cell.padEnd(15).slice(0, 15)} |`;
    }
    output += "\n";
  }

  return output;
}

function parseGameStateGrid(active_only: boolean = false): { grid: string[][]; width: number; height: number } {
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  
  let roomSize = { width: 33, height: 18 };
  
  for (const line of content.split("\n")) {
    if (line.startsWith("room_size=")) {
      const [w, h] = line.split("=")[1].split("|").map(Number);
      // Game engine reports 2 extra rows/columns beyond actual playable area
      roomSize = { width: w - 2, height: h - 2 };
    }
  }
  
  const stateMatch = content.match(/^state=(.+)$/m);
  const grid: string[][] = Array(roomSize.height).fill(null).map(() => Array(roomSize.width).fill(""));
  
  if (stateMatch) {
    const stateData = stateMatch[1];
    const units = stateData.split("€").filter(u => u);

    for (const unit of units) {
      const parts = unit.split("|");
      if (parts.length >= 21) {
        const name = parts[1];
        const gameX = parseInt(parts[3]);
        const gameY = parseInt(parts[4]);
        const x = gameX - 1;
        const y = gameY - 1;

        if (x >= 0 && x < roomSize.width && y >= 0 && y < roomSize.height) {
          if (grid[y][x]) {
            grid[y][x] = grid[y][x] + "<" + name;
          } else {
            grid[y][x] = name;
          }
        }
      }
    }
  }

  if (active_only) {
    const tempOutput = buildFormattedOutput(grid, roomSize.width, roomSize.height);
    const rules = getRules(tempOutput);
    const relevantSubjects = new Set(rules.map(r => r.entity));
    return { grid: filterGridByRelevance(grid, relevantSubjects), width: roomSize.width, height: roomSize.height };
  }
  
  return { grid, width: roomSize.width, height: roomSize.height };
}

export async function getGameState(active_only: boolean = false): Promise<string> {
  const { grid, width, height } = parseGameStateGrid(active_only);
  return buildFormattedOutput(grid, width, height);
}

export async function getGameStateAsJson(active_only: boolean = false): Promise<GameStateDataEntities> {
  const { grid, width, height } = parseGameStateGrid(active_only);

  const entities: Record<string, { x: number; y: number }[]> = {};

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      if (cell) {
        const cellEntities = cell.split("<");
        for (const entity of cellEntities) {
          if (!entities[entity]) {
            entities[entity] = [];
          }
          entities[entity].push({ x: x + 1, y: y + 1 });
        }
      }
    }
  }

  return {
    dimensions: { width, height },
    entities
  };
}

export async function getGameStateAsGrid(active_only: boolean = false): Promise<GameStateDataGrid> {
  const { grid, width, height } = parseGameStateGrid(active_only);

  return {
    dimensions: { width, height },
    grid
  };
}

export async function getRawGameState(): Promise<{ grid: string[][]; width: number; height: number }> {
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  
  let roomSize = { width: 33, height: 18 };
  
  for (const line of content.split("\n")) {
    if (line.startsWith("room_size=")) {
      const [w, h] = line.split("=")[1].split("|").map(Number);
      // Game engine reports 2 extra rows/columns beyond actual playable area
      roomSize = { width: w - 2, height: h - 2 };
    }
  }
  
  const stateMatch = content.match(/^state=(.+)$/m);
  const grid: string[][] = Array(roomSize.height).fill(null).map(() => Array(roomSize.width).fill(""));
  
  if (stateMatch) {
    const stateData = stateMatch[1];
    const units = stateData.split("€").filter(u => u);

    for (const unit of units) {
      const parts = unit.split("|");
      if (parts.length >= 21) {
        const name = parts[1];
        const gameX = parseInt(parts[3]);
        const gameY = parseInt(parts[4]);
        const x = gameX - 1;
        const y = gameY - 1;

        if (x >= 0 && x < roomSize.width && y >= 0 && y < roomSize.height) {
          if (grid[y][x]) {
            grid[y][x] = grid[y][x] + "<" + name;
          } else {
            grid[y][x] = name;
          }
        }
      }
    }
  }
  
  return { grid, width: roomSize.width, height: roomSize.height };
}

if (import.meta.main) {
  console.log(await getGameState());
}
