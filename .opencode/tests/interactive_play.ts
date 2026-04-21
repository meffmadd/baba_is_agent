// Interactive Baba Is You CLI - Arrow key recorder with tool output display
import { getGameStateAsCompact } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands, restartLevel, undoMultiple } from "../tools/utils/execute_commands.js";
import { getGameStateFormatted } from "../tools/utils/get_game_state_tool.js";

async function printCompactGrid(active_only: boolean = false) {
  const compactState = await getGameStateAsCompact(active_only);

  console.log("\n=== Game Grid (Compact) ===");
  console.log(compactState.table);

  // Print legend from compact state
  const legendEntries = Object.entries(compactState.legend).map(
    ([entity, char]) => `${char}=${entity}`
  );
  if (legendEntries.length > 0) {
    console.log("\nLegend: " + legendEntries.join(", "));
  }
}

async function printToolOutputs(toolResult: string | null = null) {
  console.log("\n" + "=".repeat(70));

  // 1. Game State (JSON format)
  console.log(`=== Game State (active_only: ${showActiveOnly}, format: ${showGridFormat ? 'grid' : 'entities'}) ===`);
  const gameStateResult = await getGameStateFormatted(showActiveOnly, showGridFormat ? "grid" : "entities");
  const gameStateParsed = JSON.parse(gameStateResult);
  if (!gameStateParsed.success) {
    console.log("Error: " + (gameStateParsed.message || "Failed to get game state"));
  } else if (showGridFormat && gameStateParsed.data) {
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

  // 2. Game Insights — always fetch real insights (including path_to_win)
  console.log("\n" + "=".repeat(70));
  console.log("=== Game Insights ===");
  const insights = await getGameInsights();
  console.log(JSON.stringify(insights, null, 2));

  // 3. Execute Commands Result (if available)
  if (toolResult) {
    console.log("\n" + "=".repeat(70));
    console.log("=== Tool Result ===");
    console.log(JSON.stringify(JSON.parse(toolResult), null, 2));
  }

  // 4. Compact Game Grid
  console.log("\n" + "=".repeat(70));
  await printCompactGrid(showActiveOnly);

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