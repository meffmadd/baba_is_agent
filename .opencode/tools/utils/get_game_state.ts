import * as fs from "fs";
import * as path from "path";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

export async function getGameState(): Promise<string> {
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  
  let levelId = "";
  let roomSize = { width: 35, height: 20 };
  
  for (const line of content.split("\n")) {
    if (line.startsWith("levelid=")) {
      levelId = line.split("=")[1].trim();
    }
    if (line.startsWith("room_size=")) {
      const [w, h] = line.split("=")[1].split("|").map(Number);
      roomSize = { width: w, height: h };
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
        const x = parseInt(parts[3]);
        const y = parseInt(parts[4]);
        
        if (x >= 0 && x < roomSize.width && y >= 0 && y < roomSize.height) {
          // Use name directly - text objects already have "text_" prefix in raw data
          if (grid[y][x]) {
            grid[y][x] = grid[y][x] + "<" + name;
          } else {
            grid[y][x] = name;
          }
        }
      }
    }
  }
  
  let output = `y/x |`;
  for (let x = 0; x < roomSize.width; x++) {
    output += ` ${String(x + 1).padStart(3)} |`;
  }
  output += "\n" + "-".repeat(output.length - 1) + "\n";
  
  for (let y = 0; y < roomSize.height; y++) {
    output += `${String(y + 1).padStart(3)} |`;
    for (let x = 0; x < roomSize.width; x++) {
      const cell = grid[y][x] || "";
      output += ` ${cell.padEnd(15).slice(0, 15)} |`;
    }
    output += "\n";
  }

  return output;
}

export async function getRawGameState(): Promise<{ grid: string[][]; width: number; height: number }> {
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  
  let roomSize = { width: 35, height: 20 };
  
  for (const line of content.split("\n")) {
    if (line.startsWith("room_size=")) {
      const [w, h] = line.split("=")[1].split("|").map(Number);
      roomSize = { width: w, height: h };
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
        const x = parseInt(parts[3]);
        const y = parseInt(parts[4]);
        
        if (x >= 0 && x < roomSize.width && y >= 0 && y < roomSize.height) {
          // Use name directly - text objects already have "text_" prefix in raw data
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
