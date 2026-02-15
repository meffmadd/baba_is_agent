import * as fs from "fs";
import * as path from "path";

const GAME_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";
const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");
const COMMANDS_DIR = path.join(GAME_DIR, "commands");

const VALID_COMMANDS = ["right", "up", "left", "down", "idle", "undo", "restart_instant", "quit"];

function getNextCommandFile(): number {
  let k = 0;
  while (true) {
    const cmdPath = path.join(COMMANDS_DIR, `${k}.lua`);
    if (!fs.existsSync(cmdPath)) {
      return k;
    }
    k++;
  }
}

function parseWorldData(): { grid: string[][]; levelWon: boolean; levelId: string } {
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  const lines = content.split("\n");
  
  let levelWon = false;
  let levelId = "";
  let roomSize = { width: 35, height: 20 };
  
  for (const line of lines) {
    if (line.startsWith("levelid=")) {
      levelId = line.split("=")[1].trim();
    }
    if (line.startsWith("level_won=")) {
      levelWon = line.split("=")[1].trim() === "true";
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
        const unitType = parts[2];
        const x = parseInt(parts[3]);
        const y = parseInt(parts[4]);
        
        if (x >= 0 && x < roomSize.width && y >= 0 && y < roomSize.height) {
          // Store text_ prefix for text objects to enable rule detection
          const displayName = unitType === "text" ? `text_${name}` : name;
          if (grid[y][x]) {
            grid[y][x] = grid[y][x] + "<" + displayName;
          } else {
            grid[y][x] = displayName;
          }
        }
      }
    }
  }
  
  return { grid, levelWon, levelId };
}

function formatGrid(grid: string[][]): string {
  const width = grid[0]?.length || 0;
  const height = grid.length;
  
  let output = "y/x |";
  for (let x = 0; x < width; x++) {
    output += `   ${x + 1}  |`;
  }
  output += "\n" + "-".repeat(output.length - 1) + "\n";
  
  for (let y = 0; y < height; y++) {
    output += `${String(y + 1).padStart(2)}  |`;
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x] || "";
      output += ` ${cell.slice(0, 4).padStart(5)} |`;
    }
    output += "\n";
  }
  
  return output;
}

export async function getGameStateDirect(): Promise<string> {
  const { grid, levelWon, levelId } = parseWorldData();
  
  let result = `Level: ${levelId}\n`;
  result += `Level Won: ${levelWon}\n\n`;
  result += formatGrid(grid);
  
  return result;
}

export async function executeCommandsDirect(commands: string): Promise<string> {
  const cmdList = commands.split(",").map(c => c.trim()).filter(c => c);
  const validCmds = cmdList.filter(c => VALID_COMMANDS.includes(c));
  
  if (validCmds.length === 0) {
    return `No valid commands. Valid: ${VALID_COMMANDS.join(", ")}`;
  }
  
  const cmdFileNum = getNextCommandFile();
  const cmdPath = path.join(COMMANDS_DIR, `${cmdFileNum}.lua`);
  
  const luaContent = validCmds.map(cmd => `command("${cmd}",1)`).join("\n") + "\n";
  fs.writeFileSync(cmdPath, luaContent);
  
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  const lines = content.split("\n");
  const newLines = lines.map(line => {
    if (line.startsWith("last_processed=")) {
      return `last_processed=${cmdFileNum}`;
    }
    return line;
  });
  fs.writeFileSync(STATE_PATH, newLines.join("\n"));
  
  return `Executed: ${validCmds.join(", ")} (file ${cmdFileNum}.lua)`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "get") {
    console.log(await getGameStateDirect());
  } else if (args[0] === "exec" && args[1]) {
    console.log(await executeCommandsDirect(args[1]));
  }
}
