import * as fs from "fs";
import * as path from "path";
import { getRules } from "./base.js";
import type { GameStateDataEntities, GameStateDataGrid, GameStateDataCompact } from "./models.js";

// Entity to single character mapping for compact display
const entityMap: Record<string, string> = {
  "baba": "B",
  "wall": "W",
  "rock": "R",
  "flag": "F",
  "skull": "S",
  "grass": "g",
  "flower": "f",
  "tile": "t",
  "brick": "b",
  "text_baba": "b",
  "text_wall": "w",
  "text_rock": "r",
  "text_flag": "f",
  "text_skull": "s",
  "text_is": "=",
  "text_you": "y",
  "text_win": "+",
  "text_stop": ".",
  "text_defeat": "x",
  "text_push": "p",
};

export function getEntityChar(entity: string): string {
  if (!entity) return " ";
  const first = entity.split("<")[0] || "";
  return entityMap[first] || first.charAt(0).toUpperCase();
}

export function getEntityLegend(): Record<string, string> {
  return { ...entityMap };
}

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

function buildMarkdownTable(grid: string[][], width: number, height: number): string {
  // Build compact header row with | separators
  // "  |" aligns with data row prefix " 1|" (2 char row label + "|")
  let header = "  |";
  for (let x = 0; x < width; x++) {
    header += String((x + 1) % 10) + "|";
  }
  // Remove trailing | from header
  header = header.slice(0, -1);

  let table = header + "\n";

  // Build data rows with compact formatting - | separator between cells
  for (let y = 0; y < height; y++) {
    let row = String(y + 1).padStart(2, " ") + "|";
    for (let x = 0; x < width; x++) {
      const cell = grid[y]?.[x] || "";
      const char = getEntityChar(cell);
      row += char + "|";
    }
    table += row + "\n";
  }

  return table.replace(/\n+$/, "");
}

export async function getGameStateAsCompact(active_only: boolean = false): Promise<GameStateDataCompact> {
  const { grid, width, height } = parseGameStateGrid(active_only);
  
  // Collect entities actually present in the grid
  const presentEntities = new Set<string>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      if (cell) {
        const cellEntities = cell.split("<");
        for (const entity of cellEntities) {
          presentEntities.add(entity);
        }
      }
    }
  }
  
  // Build legend with only present entities
  const fullLegend = getEntityLegend();
  const legend: Record<string, string> = {};
  for (const entity of presentEntities) {
    legend[entity] = fullLegend[entity] || entity.charAt(0).toUpperCase();
  }
  
  const table = buildMarkdownTable(grid, width, height);
  
  return {
    dimensions: { width, height },
    table,
    legend
  };
}

if (import.meta.main) {
  console.log(await getGameState());
}
