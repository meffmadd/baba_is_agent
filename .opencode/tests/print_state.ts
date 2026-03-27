// Print game state and insights for debugging
import { getGameState, getGameStateAsJson } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands } from "../tools/utils/execute_commands.js";

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
    // Force state update by sending idle command
    console.log("Forcing state update...");
    await executeCommands("idle", false);
    
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
