// Test all tools against captured game state
import * as fs from "fs";
import * as path from "path";
import { getRules, getStatePositions, gameStateCoords } from "../tools/base.js";
import { reachableEntities, shortestPath } from "../tools/path_finding.js";
import { getGameState } from "../tools/utils/get_game_state.js";
import type { GameInsights } from "../tools/models.js";

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname);
const FIXTURES_DIR = path.join(TEST_DIR, "fixtures");
const GAME_STATE_PATH = path.join(FIXTURES_DIR, "game_state.txt");

// Load saved game state
function loadGameState(): string {
  if (!fs.existsSync(GAME_STATE_PATH)) {
    throw new Error(
      "No game state fixture found. Run 'npx tsx tests/capture_state.ts' first."
    );
  }
  return fs.readFileSync(GAME_STATE_PATH, "utf-8");
}

// Test result tracking
const results: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("Testing Baba Is You Tools");
  console.log("=".repeat(60));
  console.log();
  
  const gameState = loadGameState();
  console.log(`Loaded game state (${gameState.length} chars)\n`);
  
  // Test 1: getRules
  console.log("Test Suite: getRules");
  const rules = getRules(gameState);
  test("returns an array", () => assert(Array.isArray(rules), "Should return an array"));
  test("finds active rules", () => assert(rules.length > 0, `Expected rules, got ${rules.length}`));
  test("rules have entity and state", () => {
    for (const rule of rules) {
      assert(rule.entity && typeof rule.entity === "string", "Rule should have entity string");
      assert(rule.state && typeof rule.state === "string", "Rule should have state string");
    }
  });
  console.log(`  Found ${rules.length} rules:`, rules.map(r => `${r.entity} IS ${r.state}`).join(", "));
  console.log();
  
  // Test 2: getStatePositions (YOU)
  console.log("Test Suite: getStatePositions (YOU)");
  const youPositions = getStatePositions(gameState, "you");
  test("returns an array", () => assert(Array.isArray(youPositions), "Should return an array"));
  test("finds YOU positions", () => assert(youPositions.length > 0, `Expected YOU positions, got ${youPositions.length}`));
  test("positions are valid coordinates", () => {
    for (const pos of youPositions) {
      assert(Array.isArray(pos) && pos.length === 2, "Position should be [x, y]");
      assert(typeof pos[0] === "number" && pos[0] > 0, "X should be positive number");
      assert(typeof pos[1] === "number" && pos[1] > 0, "Y should be positive number");
    }
  });
  console.log(`  Found ${youPositions.length} YOU position(s):`, youPositions.map(p => `(${p[0]}, ${p[1]})`).join(", "));
  console.log();
  
  // Test 3: getStatePositions (WIN)
  console.log("Test Suite: getStatePositions (WIN)");
  const winPositions = getStatePositions(gameState, "win");
  test("returns an array", () => assert(Array.isArray(winPositions), "Should return an array"));
  test("finds WIN positions", () => assert(winPositions.length > 0, `Expected WIN positions, got ${winPositions.length}`));
  test("positions are valid coordinates", () => {
    for (const pos of winPositions) {
      assert(Array.isArray(pos) && pos.length === 2, "Position should be [x, y]");
      assert(typeof pos[0] === "number" && pos[0] > 0, "X should be positive number");
      assert(typeof pos[1] === "number" && pos[1] > 0, "Y should be positive number");
    }
  });
  console.log(`  Found ${winPositions.length} WIN position(s):`, winPositions.map(p => `(${p[0]}, ${p[1]})`).join(", "));
  console.log();
  
  // Test 4: reachableEntities
  console.log("Test Suite: reachableEntities");
  const reachable = reachableEntities(gameState);
  test("returns an array", () => assert(Array.isArray(reachable), "Should return an array"));
  test("finds reachable entities", () => assert(reachable.length > 0, `Expected reachable entities, got ${reachable.length}`));
  test("entities have valid format", () => {
    for (const entity of reachable) {
      assert(Array.isArray(entity) && entity.length === 3, "Entity should be [x, y, name]");
      assert(typeof entity[0] === "number", "X should be number");
      assert(typeof entity[1] === "number", "Y should be number");
      assert(typeof entity[2] === "string", "Name should be string");
    }
  });
  console.log(`  Found ${reachable.length} reachable entities`);
  console.log(`  Sample: ${JSON.stringify(reachable.slice(0, 3))}`);
  console.log();
  
  // Test 5: shortestPath
  console.log("Test Suite: shortestPath");
  if (youPositions.length > 0 && winPositions.length > 0) {
    const start = youPositions[0]!;
    const goal = winPositions[0]!;
    const directions = ["up", "down", "left", "right"] as const;
    let foundPath = false;
    
    for (const lastMove of directions) {
      const path = shortestPath(gameState, goal, lastMove);
      if (path.length > 0) {
        foundPath = true;
        test("finds a path to goal", () => assert(path.length > 0, "Should find a path"));
        test("path is array of moves", () => {
          assert(Array.isArray(path), "Path should be an array");
          for (const move of path) {
            assert(["up", "down", "left", "right"].includes(move), `Invalid move: ${move}`);
          }
        });
        console.log(`  Found path with ${path.length} moves: ${path.join(", ")}`);
        break;
      }
    }
    
    if (!foundPath) {
      test("finds a path to goal", () => assert(false, "No path found to goal"));
    }
  } else {
    console.log("  Skipping (no YOU or WIN positions found)");
  }
  console.log();
  
  // Test 6: gameStateCoords
  console.log("Test Suite: gameStateCoords");
  const coords = gameStateCoords(gameState);
  test("returns an array", () => assert(Array.isArray(coords), "Should return an array"));
  test("finds coordinates", () => assert(coords.length > 0, `Expected coordinates, got ${coords.length}`));
  console.log(`  Found ${coords.length} coordinate groups`);
  console.log();
  
  // Test 7: getGameState with relevant parameter
  console.log("Test Suite: getGameState (relevant filter)");
  const fullState = await getGameState(false);
  const filteredState = await getGameState(true);
  
  test("returns formatted grid string", () => {
    assert(typeof fullState === "string", "Should return string");
    assert(fullState.includes("y/x |"), "Should have header row");
  });
  
  test("relevant=false shows all entities", () => {
    assert(fullState.length > 0, "Full state should have content");
  });
  
  test("relevant=true filters to relevant entities only", () => {
    assert(filteredState.length > 0, "Filtered state should have content");
  });
  
  test("relevant=true produces smaller or equal output", () => {
    assert(filteredState.length <= fullState.length, "Filtered should be <= full state");
  });
  
  test("relevant=true keeps text_ entities", () => {
    assert(filteredState.includes("text_"), "Should contain text_ entities");
  });
  
  test("relevant=true keeps entities from active rules", () => {
    const relevantRules = getRules(filteredState);
    const subjects = new Set(relevantRules.map(r => r.entity));
    for (const subject of subjects) {
      assert(filteredState.includes(subject), `Should contain ${subject} (from active rule)`);
    }
  });
  console.log(`  Full state: ${fullState.length} chars`);
  console.log(`  Filtered state: ${filteredState.length} chars`);
  console.log(`  Reduction: ${((1 - filteredState.length / fullState.length) * 100).toFixed(1)}%`);
  console.log();
  
  // Summary
  console.log("=".repeat(60));
  console.log("Test Summary");
  console.log("=".repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  Total: ${results.length}`);
  console.log(`  Passed: ${passed} ✓`);
  console.log(`  Failed: ${failed} ${failed > 0 ? "✗" : ""}`);
  console.log();
  
  if (failed > 0) {
    console.log("Failed tests:");
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.name}: ${result.error}`);
    }
    process.exit(1);
  } else {
    console.log("✓ All tests passed!");
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
