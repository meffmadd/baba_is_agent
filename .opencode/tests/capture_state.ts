// Capture current game state and save to test fixture
import * as fs from "fs";
import * as path from "path";
import { getGameState, getRawGameState } from "../tools/utils/get_game_state.js";

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname);
const FIXTURES_DIR = path.join(TEST_DIR, "fixtures");

async function captureGameState() {
  console.log("Capturing current game state...\n");
  
  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  
  // Get formatted game state
  const gameState = await getGameState();
  const gameStatePath = path.join(FIXTURES_DIR, "game_state.txt");
  fs.writeFileSync(gameStatePath, gameState);
  console.log(`✓ Saved formatted game state to: ${gameStatePath}`);
  
  // Get raw game state (grid data)
  const rawState = await getRawGameState();
  const rawStatePath = path.join(FIXTURES_DIR, "raw_state.json");
  fs.writeFileSync(rawStatePath, JSON.stringify(rawState, null, 2));
  console.log(`✓ Saved raw game state to: ${rawStatePath}`);
  
  // Summary
  console.log("\nGame State Summary:");
  console.log(`  Grid size: ${rawState.width}x${rawState.height}`);
  
  // Count objects
  let objectCount = 0;
  let textCount = 0;
  for (const row of rawState.grid) {
    for (const cell of row) {
      if (cell) {
        objectCount++;
        if (cell.includes("text_")) {
          textCount++;
        }
      }
    }
  }
  console.log(`  Total cells with objects: ${objectCount}`);
  console.log(`  Text objects: ${textCount}`);
  
  console.log("\n✓ Game state captured successfully!");
  console.log("  Run 'npm test' to validate tools against this state.");
}

captureGameState().catch(console.error);
