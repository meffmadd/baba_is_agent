import * as fs from "fs";
import * as path from "path";
import { getGameState, getRawGameState } from "../tools/utils/get_game_state.js";

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname);
const FIXTURES_DIR = path.join(TEST_DIR, "fixtures");

const name = process.argv[2] || "game_state";

async function capture() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  const gameState = await getGameState();
  const statePath = path.join(FIXTURES_DIR, `${name}.txt`);
  fs.writeFileSync(statePath, gameState);
  console.log(`Saved: ${statePath}`);

  const rawState = await getRawGameState();
  console.log(`Grid: ${rawState.width}x${rawState.height}`);
  
  const counts: Record<string, number> = {};
  for (let y = 0; y < rawState.height; y++) {
    for (let x = 0; x < rawState.width; x++) {
      const cell = rawState.grid[y]?.[x] || "";
      for (const match of cell.matchAll(/\b(?!text_)(\w+)/g)) {
        counts[match[1]] = (counts[match[1]] || 0) + 1;
      }
    }
  }
  
  for (const [entity, count] of Object.entries(counts)) {
    console.log(`${entity}: ${count}`);
  }
}

capture().catch(console.error);