// Print game state as compact grid
import { getRawGameState } from "../tools/utils/get_game_state.js";
import { getGameInsights } from "../tools/utils/get_game_insights.js";
import { executeCommands } from "../tools/utils/execute_commands.js";
import { getRules } from "../tools/utils/base.js";
import { extractEntityPositions, calculateStateDiff } from "../tools/utils/execute_commands.js";

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

async function printGameState() {
  const rawState = await getRawGameState();
  const { grid, width, height } = rawState;

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
  console.log("Legend: B=baba, W=wall, R=rock, F=flag, S=SKULL, g=grass, f=flower, t=tile, b=brick");
  console.log("Text objects: lowercase (b=text_baba, w=text_wall, r=text_rock, f=text_flag, s=text_skull)");
  console.log("Special: ==text_is, y=text_you, +=text_win, .=text_stop, x=text_defeat");
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
  console.log();
  
  console.log("Text Entities:");
  for (const entity of insights.text_entities) {
    console.log(`  ${entity.text} at (${entity.position.x}, ${entity.position.y})`);
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
