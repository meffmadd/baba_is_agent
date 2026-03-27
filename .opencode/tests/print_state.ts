// Print game state and insights for debugging
import { getGameState, getGameStateAsJson, getRawGameState } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands, calculateStateDiff, extractEntityPositions } from "../tools/utils/execute_commands.js";
import { getRules } from "../tools/utils/base.js";
import type { StateDiff } from "../tools/utils/models.js";

function formatDiff(diff: StateDiff): string {
  const lines: string[] = [];
  
  // Position changes
  if (diff.positions.moved.length > 0) {
    lines.push("  Moved:");
    for (const m of diff.positions.moved) {
      lines.push(`    ${m.entity}: (${m.from[0]}, ${m.from[1]}) → (${m.to[0]}, ${m.to[1]})`);
    }
  }
  
  if (diff.positions.created.length > 0) {
    lines.push("  Created:");
    for (const c of diff.positions.created) {
      lines.push(`    ${c.entity} at (${c.at[0]}, ${c.at[1]})`);
    }
  }
  
  if (diff.positions.destroyed.length > 0) {
    lines.push("  Destroyed:");
    for (const d of diff.positions.destroyed) {
      lines.push(`    ${d.entity} at (${d.at[0]}, ${d.at[1]})`);
    }
  }
  
  // Rule changes
  if (diff.rules.added.length > 0) {
    lines.push("  Rules Added:");
    for (const r of diff.rules.added) {
      lines.push(`    ${r}`);
    }
  }
  
  if (diff.rules.removed.length > 0) {
    lines.push("  Rules Removed:");
    for (const r of diff.rules.removed) {
      lines.push(`    ${r}`);
    }
  }
  
  if (lines.length === 0) {
    lines.push("  No changes detected");
  }
  
  return lines.join("\n");
}

async function printGameState() {
  console.log("=".repeat(80));
  console.log("GAME STATE - MARKDOWN FORMAT (active_only=true)");
  console.log("=".repeat(80));
  console.log();

  const activeState = await getGameState(true);
  console.log(activeState);
  console.log();

  console.log("=".repeat(80));
  console.log("GAME STATE - MARKDOWN FORMAT (active_only=false)");
  console.log("=".repeat(80));
  console.log();

  const fullState = await getGameState(false);
  console.log(fullState);
  console.log();

  console.log("=".repeat(80));
  console.log("GAME STATE - JSON FORMAT (active_only=false)");
  console.log("=".repeat(80));
  console.log();

  const jsonState = await getGameStateAsJson(false);
  console.log(JSON.stringify(jsonState, null, 2));
  console.log();
}

async function printGameInsights() {
  console.log("=".repeat(80));
  console.log("GAME INSIGHTS");
  console.log("=".repeat(80));
  console.log();
  
  const insights = await getGameInsights();
  
  console.log("Active Rules:");
  for (const rule of insights.active_rules) {
    console.log(`  ${rule.entity} IS ${rule.state}`);
  }
  console.log();
  
  console.log("YOU Positions:", insights.you_positions.map(p => `(${p[0]}, ${p[1]})`).join(", "));
  console.log("WIN Positions:", insights.win_positions.map(p => `(${p[0]}, ${p[1]})`).join(", "));
  console.log();
  
  if (insights.path_to_win) {
    console.log("Path to Win:");
    console.log(`  Moves: ${insights.path_to_win.moves.join(", ")}`);
    console.log(`  Goal: ${insights.path_to_win.goal}`);
  } else {
    console.log("Path to Win: No path found");
  }
  console.log();
  
  console.log("Reachable Entities (by row):");
  for (const row of insights.reachable_entities) {
    const items = row.map(([x, y, entity]) => `${entity}@(${x},${y})`).join(", ");
    console.log(`  ${items}`);
  }
  console.log();
  
  console.log("Manipulable Rule Text Blocks:");
  for (const rule of insights.manipulable_rules) {
    console.log(`  ${rule.text} at (${rule.position[0]}, ${rule.position[1]})`);
  }
  console.log();
}

async function main() {
  try {
    // Read state BEFORE execution
    console.log("Reading initial state...");
    const beforeState = await getRawGameState();
    const beforeRules = getRules(await getGameState());
    
    // Force state update by sending idle command
    console.log("Forcing state update (idle command)...");
    await executeCommands("idle", false);
    
    // Read state AFTER execution
    console.log("Reading updated state...");
    const afterState = await getRawGameState();
    const afterRules = getRules(await getGameState());
    
    // Calculate diff
    const diff = calculateStateDiff(beforeState.grid, afterState.grid, beforeRules, afterRules);
    
    console.log("=".repeat(80));
    console.log("STATE CHANGES (DIFF)");
    console.log("=".repeat(80));
    console.log();
    console.log(formatDiff(diff));
    console.log();
    
    await printGameState();
    await printGameInsights();
    console.log("=".repeat(80));
    console.log("Done!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
