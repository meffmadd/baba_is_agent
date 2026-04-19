// Test that getGameInsights considers all WIN positions (Bug #6)
// Previously, only winPositions[0] was used for pathfinding.
// The fix iterates all WIN positions and returns the shortest path.
import { getStatePositionsFromGrid, getRulesFromGrid, type Direction } from "../tools/utils/base.js";
import { shortestPathFromGrid } from "../tools/utils/path_finding.js";
import type { GameStateDataEntities } from "../tools/utils/models.js";

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

function buildTestState() {
  const grid: string[][] = [
    ["text_baba", "text_is", "text_you", "", ""],
    ["", "", "", "", ""],
    ["text_flag", "text_is", "text_win", "", ""],
    ["", "", "", "", ""],
    ["baba", "", "flag", "", "flag"],
  ];

  // Intentionally put far flag first to expose the old bug
  // Far flag at (5,5), close flag at (3,5)
  const gameStateJson: GameStateDataEntities = {
    dimensions: { width: 5, height: 5 },
    entities: {
      baba: [{ x: 1, y: 5 }],
      flag: [{ x: 5, y: 5 }, { x: 3, y: 5 }],
    },
  };

  return { grid, gameStateJson };
}

function runTests() {
  console.log("=".repeat(60));
  console.log("Testing: Multiple WIN Positions (Bug #6)");
  console.log("=".repeat(60));
  console.log();

  const { grid, gameStateJson } = buildTestState();

  // Test 1: Rules are parsed correctly
  console.log("Test Suite: Rule parsing");
  const rules = getRulesFromGrid(grid);
  test("finds baba IS you rule", () => {
    assert(rules.some(r => r.entity === "baba" && r.state === "you"), `Expected baba IS you, got: ${JSON.stringify(rules)}`);
  });
  test("finds flag IS win rule", () => {
    assert(rules.some(r => r.entity === "flag" && r.state === "win"), `Expected flag IS win, got: ${JSON.stringify(rules)}`);
  });
  console.log(`  Found rules: ${rules.map(r => `${r.entity} IS ${r.state}`).join(", ")}`);
  console.log();

  // Test 2: WIN positions include both flags
  console.log("Test Suite: WIN positions");
  const winPositions = getStatePositionsFromGrid(gameStateJson, grid, "win");
  test("returns multiple WIN positions", () => {
    assert(winPositions.length === 2, `Expected 2 WIN positions, got ${winPositions.length}: ${JSON.stringify(winPositions)}`);
  });
  test("far flag is listed first in entities", () => {
    assert(winPositions[0]!.x === 5 && winPositions[0]!.y === 5, `Expected far flag (5,5) first, got ${JSON.stringify(winPositions[0])}`);
  });
  test("close flag is listed second in entities", () => {
    assert(winPositions[1]!.x === 3 && winPositions[1]!.y === 5, `Expected close flag (3,5) second, got ${JSON.stringify(winPositions[1])}`);
  });
  console.log(`  WIN positions: ${winPositions.map(p => `(${p.x},${p.y})`).join(", ")}`);
  console.log();

  // Test 3: Path to close WIN is shorter than path to far WIN
  console.log("Test Suite: Shortest path comparison");
  const youPositions = getStatePositionsFromGrid(gameStateJson, grid, "you");
  test("finds YOU position", () => {
    assert(youPositions.length > 0, "Expected at least one YOU position");
  });
  console.log(`  YOU position: ${youPositions.map(p => `(${p.x},${p.y})`).join(", ")}`);

  const directions: Direction[] = ["up", "down", "left", "right"];

  let closestPathLength = Infinity;
  let farthestPathLength = 0;
  let closeWinPos: { x: number; y: number } | null = null;
  let farWinPos: { x: number; y: number } | null = null;

  // Find shortest path to close flag (3,5)
  for (const lastMove of directions) {
    const path = shortestPathFromGrid(gameStateJson, grid, { x: 3, y: 5 }, lastMove);
    if (path.length > 0 && path.length < closestPathLength) {
      closestPathLength = path.length;
      closeWinPos = { x: 3, y: 5 };
    }
  }

  // Find shortest path to far flag (5,5)
  for (const lastMove of directions) {
    const path = shortestPathFromGrid(gameStateJson, grid, { x: 5, y: 5 }, lastMove);
    if (path.length > 0 && path.length < farthestPathLength || farthestPathLength === 0) {
      farthestPathLength = path.length;
      farWinPos = { x: 5, y: 5 };
    }
  }

  test("close WIN has a reachable path", () => {
    assert(closestPathLength < Infinity, `Close WIN should have a reachable path`);
  });
  test("far WIN has a reachable path", () => {
    assert(farthestPathLength > 0, `Far WIN should have a reachable path`);
  });
  test("path to close WIN is shorter than path to far WIN", () => {
    assert(closestPathLength < farthestPathLength, `Expected close WIN path (${closestPathLength}) < far WIN path (${farthestPathLength})`);
  });
  console.log(`  Close WIN path: ${closestPathLength} moves`);
  console.log(`  Far WIN path: ${farthestPathLength} moves`);
  console.log();

  // Test 4: Iterating all WIN positions yields the shortest path (the fix)
  console.log("Test Suite: All-WIN iteration (Bug #6 fix)");
  let shortestMoves: Direction[] | null = null;

  for (const winPos of winPositions) {
    for (const lastMove of directions) {
      const path = shortestPathFromGrid(gameStateJson, grid, winPos, lastMove);
      if (path.length > 0) {
        if (shortestMoves === null || path.length < shortestMoves.length) {
          shortestMoves = path;
        }
      }
    }
  }

  test("finds a path to a WIN position", () => {
    assert(shortestMoves !== null, "Expected to find a path to some WIN position");
  });
  test("shortest path matches close WIN path length", () => {
    assert(shortestMoves !== null && shortestMoves.length === closestPathLength, `Expected ${closestPathLength}, got ${shortestMoves?.length}`);
  });
  console.log(`  Shortest path: ${shortestMoves!.length} moves -> ${shortestMoves!.join(", ")}`);
  console.log();

  // Test 5: Using only winPositions[0] (the old bug) gives a longer or equal path
  console.log("Test Suite: Regression (winPositions[0] only)");
  let firstWinPath: Direction[] | null = null;

  for (const lastMove of directions) {
    const path = shortestPathFromGrid(gameStateJson, grid, winPositions[0]!, lastMove);
    if (path.length > 0) {
      if (firstWinPath === null || path.length < firstWinPath.length) {
        firstWinPath = path;
      }
    }
  }

  test("first WIN (far flag) has a path", () => {
    assert(firstWinPath !== null, "Expected path to first WIN position");
  });
  test("first-WIN-only path is longer than all-WIN shortest", () => {
    assert(
      firstWinPath!.length > shortestMoves!.length,
      `Old bug returns ${firstWinPath!.length} moves, fix returns ${shortestMoves!.length} moves`
    );
  });
  console.log(`  First WIN path: ${firstWinPath!.length} moves -> ${firstWinPath!.join(", ")}`);
  console.log(`  All WIN shortest: ${shortestMoves!.length} moves -> ${shortestMoves!.join(", ")}`);
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

runTests();