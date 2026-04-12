// Print game state as compact grid
import { getRawGameState, getEntityChar } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands } from "../tools/utils/execute_commands.js";
import { getRules } from "../tools/utils/base.js";
import { extractEntityPositions, calculateStateDiff } from "../tools/utils/execute_commands.js";

async function printGameState() {
  const rawState = await getRawGameState();
  const { grid, width, height } = rawState;

  // Collect entities present in the grid
  const presentEntities = new Set<string>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y]?.[x] || "";
      if (cell) {
        const cellEntities = cell.split("<");
        for (const entity of cellEntities) {
          presentEntities.add(entity);
        }
      }
    }
  }

  // Build legend entries for present entities
  const legendEntries: string[] = [];
  for (const entity of presentEntities) {
    const char = getEntityChar(entity);
    legendEntries.push(`${char}=${entity}`);
  }

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
  console.log();

  // Print dynamic legend
  if (legendEntries.length > 0) {
    console.log("Legend: " + legendEntries.join(", "));
  }
}

async function printGameInsights() {
  console.log("Active Rules:");
  const insights = await getGameInsights();
  for (const rule of insights.active_rules) {
    console.log(`  ${rule.entity} IS ${rule.state}`);
  }
  console.log();
  
  console.log("YOU Positions:", insights.you_positions.map(p => `(${p.x}, ${p.y})`).join(", "));
  console.log("WIN Positions:", insights.win_positions.map(p => `(${p.x}, ${p.y})`).join(", "));
  console.log();
  
  if (insights.path_to_win) {
    console.log("Path to Win:");
    console.log(`  Moves: ${insights.path_to_win.moves.join(", ")}`);
  } else {
    console.log("Path to Win: No path found");
  }
}

async function main() {
  try {
    const beforeState = await getRawGameState();
    const beforeStateStr = await (await import("../tools/utils/get_game_state.js")).getGameState();
    const beforeRules = getRules(beforeStateStr);
    
    await executeCommands("idle", false);
    
    const afterState = await getRawGameState();
    const afterStateStr = await (await import("../tools/utils/get_game_state.js")).getGameState();
    const afterRules = getRules(afterStateStr);
    
    const diff = calculateStateDiff(beforeState.grid, afterState.grid, beforeRules, afterRules);
    
    console.log("=== State Diff (after idle) ===");
    if (diff.positions.moved.length > 0) {
      console.log("Moved:");
      for (const m of diff.positions.moved) {
        console.log(`  ${m.entity}: (${m.from.x}, ${m.from.y}) -> (${m.to.x}, ${m.to.y})`);
      }
    }
    if (diff.positions.created.length > 0) {
      console.log("Created:");
      for (const c of diff.positions.created) {
        console.log(`  ${c.entity} at (${c.at.x}, ${c.at.y})`);
      }
    }
    if (diff.positions.destroyed.length > 0) {
      console.log("Destroyed:");
      for (const d of diff.positions.destroyed) {
        console.log(`  ${d.entity} at (${d.at.x}, ${d.at.y})`);
      }
    }
    if (diff.rules.added.length > 0) {
      console.log("Rules Added:");
      for (const r of diff.rules.added) {
        console.log(`  ${r}`);
      }
    }
    if (diff.rules.removed.length > 0) {
      console.log("Rules Removed:");
      for (const r of diff.rules.removed) {
        console.log(`  ${r}`);
      }
    }
    if (diff.positions.moved.length === 0 && diff.positions.created.length === 0 && 
        diff.positions.destroyed.length === 0 && diff.rules.added.length === 0 && 
        diff.rules.removed.length === 0) {
      console.log("  (no changes)");
    }
    console.log();
    
    await printGameState();
    console.log();
    console.log("=".repeat(60));
    console.log();
    await printGameInsights();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
