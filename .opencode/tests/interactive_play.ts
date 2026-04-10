// Interactive Baba Is You CLI - Arrow key recorder with tool output display
import { getRawGameState } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands, restartLevel, undoMultiple } from "../tools/utils/execute_commands.js";
import { getGameStateFormatted } from "../tools/utils/get_game_state_tool.js";
import { waitForStateSettle } from "../tools/utils/poll_state.js";

interface ToolResultData {
  active_rules?: { entity: string; state: string }[];
  you_positions?: { x: number; y: number }[];
  win_positions?: { x: number; y: number }[];
  level_won?: boolean;
  success?: boolean;
  message?: string;
  diff?: unknown;
  executed?: string[];
}

interface ParsedToolResult {
  success: boolean;
  data: ToolResultData | null;
  message: string;
}

function parseToolResult(toolResult: string | null): ParsedToolResult | null {
  if (!toolResult) return null;
  try {
    return JSON.parse(toolResult) as ParsedToolResult;
  } catch {
    return null;
  }
}

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

function printCompactGrid(rawState: { grid: string[][]; width: number; height: number }) {
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

async function printToolOutputs(toolResult: string | null = null) {
  console.log("\n" + "=".repeat(70));

  const parsed = parseToolResult(toolResult);
  const toolData = parsed?.data ?? null;

  let rawState: { grid: string[][]; width: number; height: number };

  if (toolResult !== null) {
    const pollResult = await waitForStateSettle();
    rawState = pollResult.rawState;
  } else {
    rawState = await getRawGameState();
  }

  // 1. Game State (JSON format)
  console.log(`=== Game State (active_only: ${showActiveOnly}, format: ${showGridFormat ? 'grid' : 'entities'}) ===`);
  const gameStateResult = await getGameStateFormatted(showActiveOnly, showGridFormat ? "grid" : "entities");
  const gameStateParsed = JSON.parse(gameStateResult);
  if (showGridFormat && gameStateParsed.data) {
    const gs = gameStateParsed.data;
    console.log(JSON.stringify({ dimensions: gs.dimensions }, null, 2));
    console.log("grid:");
    for (let y = 0; y < gs.grid.length; y++) {
      const row = gs.grid[y];
      const formattedRow = row.map((cell: string) => `"${cell}"`).join(", ");
      console.log(`  [${formattedRow}]`);
    }
  } else if (gameStateParsed.data) {
    console.log(JSON.stringify(gameStateParsed.data, null, 2));
  }

  // 2. Game Insights (use tool data if available, otherwise fetch)
  console.log("\n" + "=".repeat(70));
  console.log("=== Game Insights ===");

  if (toolData && toolData.active_rules && toolData.you_positions) {
    const insights = {
      success: true,
      data: {
        active_rules: toolData.active_rules,
        you_positions: toolData.you_positions,
        win_positions: toolData.win_positions || [],
        path_to_win: null,
        level_won: toolData.level_won || false
      },
      message: "From tool result"
    };
    console.log(JSON.stringify(insights, null, 2));
  } else {
    const insights = await getGameInsights();
    console.log(JSON.stringify(insights, null, 2));
  }

  // 3. Execute Commands Result (if available)
  if (toolResult) {
    console.log("\n" + "=".repeat(70));
    console.log("=== Tool Result ===");
    console.log(JSON.stringify(JSON.parse(toolResult), null, 2));
  }

  // 4. Compact Game Grid - uses the single read from above
  console.log("\n" + "=".repeat(70));
  printCompactGrid(rawState);

  console.log("\n" + "=".repeat(70));
}

// Command buffer
let commandBuffer: string[] = [];
let showActiveOnly: boolean = false;
let showGridFormat: boolean = false;

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
  console.log("  a          = Toggle active_only (show only entities with rules)");
  console.log("  f          = Toggle format (entities/grid)");
  console.log("  q          = Quit");
  console.log("-".repeat(70));
}

function setupInput(): Promise<void> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    stdin.on("data", async (key: string) => {
      const byte = key.charCodeAt(0);

      if (byte === 3 || key === "q") {
        console.log("\n\nGoodbye!");
        stdin.setRawMode(false);
        stdin.pause();
        resolve();
        return;
      }

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

      if (key === "r") {
        console.log("\n\nRestarting level...");
        const result = await restartLevel(true);
        commandBuffer = [];
        showHeader();
        await printToolOutputs(result);
        displayBuffer();
        return;
      }

      if (key === "u") {
        console.log("\n\nUndoing last move...");
        const result = await undoMultiple(1, true);
        commandBuffer = [];
        showHeader();
        await printToolOutputs(result);
        displayBuffer();
        return;
      }

      if (key === "c") {
        commandBuffer = [];
        displayBuffer();
        return;
      }

      if (key === "a") {
        showActiveOnly = !showActiveOnly;
        console.log(`\n\nToggled active_only to: ${showActiveOnly}`);
        showHeader();
        await printToolOutputs();
        displayBuffer();
        return;
      }

      if (key === "f") {
        showGridFormat = !showGridFormat;
        console.log(`\n\nToggled format to: ${showGridFormat ? 'grid' : 'entities'}`);
        showHeader();
        await printToolOutputs();
        displayBuffer();
        return;
      }

      if (byte === 27 && key.length >= 3) {
        const arrowCode = key.charCodeAt(2);
        let arrow: string | null = null;

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

      // wasd (d already handled by 'a' toggle above, skip conflicts)
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