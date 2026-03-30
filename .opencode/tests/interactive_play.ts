// Interactive Baba Is You CLI - Arrow key recorder with tool output display
import * as fs from "fs";
import * as path from "path";
import { getRawGameState } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands, restartLevel, undoMultiple } from "../tools/utils/execute_commands.js";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

// Entity character mapping for compact display
function getEntityChar(entity: string): string {
  if (!entity) return " ";
  const first = entity.split("<")[0] || "";
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
  return entityMap[first] || first.charAt(0).toUpperCase();
}

// Print compact game grid
async function printCompactGrid() {
  const rawState = await getRawGameState();
  const { grid, width, height } = rawState;

  console.log("\n=== Game Grid ===");
  const header = "    " + Array.from({ length: width }, (_, i) => String((i + 1) % 10)).join(" ");
  console.log(header);
  for (let y = 0; y < height; y++) {
    let rowStr = String(y + 1).padStart(2, " ") + " |";
    for (let x = 0; x < width; x++) {
      const cell = grid[y]?.[x] || "";
      const char = getEntityChar(cell);
      rowStr += char + "|";
    }
    console.log(rowStr);
  }
  console.log("\nLegend: B=baba, W=wall, R=rock, F=flag, S=skull");
  console.log("        g=grass, f=flower, t=tile, b=brick");
  console.log("Text: b=text_baba, w=text_wall, ==text_is, y=text_you");
  console.log("      +=text_win, .=text_stop, x=text_defeat, p=text_push");
}

// Check win status
async function checkWinStatus(): Promise<{ won: boolean; level_id: string; message: string }> {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    
    let levelWon = false;
    let levelId = "";
    let currentSection = "";
    
    for (const line of content.split("\n")) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        currentSection = trimmedLine.slice(1, -1);
        continue;
      }
      
      if (currentSection === "status" && trimmedLine.startsWith("level_won=")) {
        levelWon = trimmedLine.split("=")[1].trim() === "true";
      }
      if (trimmedLine.startsWith("levelid=")) {
        levelId = trimmedLine.split("=")[1].trim();
      }
    }
    
    if (levelWon) {
      return {
        won: true,
        level_id: levelId,
        message: "🎉 Level completed! You can now enter another level.",
      };
    } else {
      return {
        won: false,
        level_id: levelId,
        message: "Level not yet won. Keep trying!",
      };
    }
  } catch (error) {
    return {
      won: false,
      level_id: "",
      message: `Error checking win status: ${error}`,
    };
  }
}

// Print all tool outputs
async function printToolOutputs(includeExecuteResult: string | null = null) {
  console.log("\n" + "=".repeat(70));
  
  // 1. Game Insights
  console.log("=== Game Insights ===");
  const insights = await getGameInsights();
  console.log(JSON.stringify(insights, null, 2));
  
  // 2. Check Win Status
  console.log("\n" + "=".repeat(70));
  console.log("=== Win Status ===");
  const winStatus = await checkWinStatus();
  console.log(JSON.stringify(winStatus, null, 2));
  
  // 3. Execute Commands Result (if available)
  if (includeExecuteResult) {
    console.log("\n" + "=".repeat(70));
    console.log("=== Execute Commands Result ===");
    const parsed = JSON.parse(includeExecuteResult);
    console.log(JSON.stringify(parsed, null, 2));
  }
  
  // 4. Compact Game Grid (replaces get_game_state) - shown last
  console.log("\n" + "=".repeat(70));
  await printCompactGrid();
  
  console.log("\n" + "=".repeat(70));
}

// Command buffer
let commandBuffer: string[] = [];

// Convert arrow key to command
function arrowToCommand(key: string): string | null {
  switch (key) {
    case "up": return "up";
    case "down": return "down";
    case "left": return "left";
    case "right": return "right";
    default: return null;
  }
}

// Display current buffer
function displayBuffer() {
  const display = commandBuffer.map(cmd => {
    switch (cmd) {
      case "up": return "↑";
      case "down": return "↓";
      case "left": return "←";
      case "right": return "→";
      default: return cmd;
    }
  }).join(" ");
  process.stdout.write(`\rCommands: [${display || " "}] _                    `);
}

// Clear screen and show header
function showHeader() {
  console.clear();
  console.log("=".repeat(70));
  console.log("Baba Is You - Interactive Play");
  console.log("=".repeat(70));
  console.log("Controls:");
  console.log("  Arrow keys = Queue move (↑↓←→)");
  console.log("  Enter      = Execute queued moves");
  console.log("  r          = Restart level");
  console.log("  u          = Undo last move");
  console.log("  c          = Clear command buffer");
  console.log("  q          = Quit");
  console.log("-".repeat(70));
}

// Setup raw input handling
function setupInput(): Promise<void> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    
    stdin.on("data", async (key: string) => {
      const byte = key.charCodeAt(0);
      
      // Ctrl+C or q to quit
      if (byte === 3 || key === "q") {
        console.log("\n\nGoodbye!");
        stdin.setRawMode(false);
        stdin.pause();
        resolve();
        return;
      }
      
      // Enter to execute
      if (byte === 13) {
        if (commandBuffer.length > 0) {
          console.log("\n\nExecuting commands...");
          const commandsStr = commandBuffer.join(",");
          const result = await executeCommands(commandsStr, true);
          commandBuffer = [];
          showHeader();
          await printToolOutputs(result);
        } else {
          console.log("\n\nNo commands to execute");
          await printToolOutputs();
        }
        displayBuffer();
        return;
      }
      
      // r to restart
      if (key === "r") {
        console.log("\n\nRestarting level...");
        await restartLevel(true);
        commandBuffer = [];
        showHeader();
        await printToolOutputs();
        displayBuffer();
        return;
      }
      
      // u to undo
      if (key === "u") {
        console.log("\n\nUndoing last move...");
        await undoMultiple(1, true);
        commandBuffer = [];
        showHeader();
        await printToolOutputs();
        displayBuffer();
        return;
      }
      
      // c to clear buffer
      if (key === "c") {
        commandBuffer = [];
        displayBuffer();
        return;
      }
      
      // Arrow keys (escape sequences)
      if (byte === 27 && key.length >= 3) {
        const arrowCode = key.charCodeAt(2);
        let arrow: string | null = null;
        
        // ANSI escape codes: ESC [ A = up, ESC [ B = down, ESC [ C = right, ESC [ D = left
        switch (arrowCode) {
          case 65: arrow = "up"; break;
          case 66: arrow = "down"; break;
          case 67: arrow = "right"; break;
          case 68: arrow = "left"; break;
        }
        
        if (arrow) {
          commandBuffer.push(arrow);
          displayBuffer();
        }
        return;
      }
      
      // Also handle wasd
      if (key === "w") { commandBuffer.push("up"); displayBuffer(); return; }
      if (key === "s") { commandBuffer.push("down"); displayBuffer(); return; }
      if (key === "a") { commandBuffer.push("left"); displayBuffer(); return; }
      if (key === "d") { commandBuffer.push("right"); displayBuffer(); return; }
    });
  });
}

async function main() {
  try {
    showHeader();
    await printToolOutputs();
    displayBuffer();
    await setupInput();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
