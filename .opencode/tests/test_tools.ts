// Test all tools against captured game state
import * as fs from "fs";
import * as path from "path";
import { getRules, getStatePositions, gameStateCoords } from "../tools/utils/base.js";
import { reachableEntities, shortestPath } from "../tools/utils/path_finding.js";
import { getGameState, getGameStateAsJson, getGameStateAsGrid, getGameStateAsCompact } from "../tools/utils/get_game_state.js";

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

// Helper: parse compact markdown table back to 2D char array
function parseCompactTable(table: string, width: number, height: number): string[][] {
  const lines = table.split("\n");
  const grid: string[][] = [];
  // Skip header line (first line)
  for (let i = 1; i < lines.length && grid.length < height; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split("|");
    // parts[0] is row number, parts[1..width] are cells
    const cells: string[] = [];
    for (let x = 0; x < width; x++) {
      cells.push((parts[x + 1] || "").trim());
    }
    grid.push(cells);
  }
  return grid;
}

// Helper: build reverse lookup from display char to entity name
function buildReverseLegend(legend: Record<string, string>): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [entity, char] of Object.entries(legend)) {
    reverse[char] = entity;
  }
  return reverse;
}

// Helper: reconstruct grid from entities format
function entitiesToGrid(
  entities: Record<string, { x: number; y: number }[]>,
  width: number,
  height: number
): string[][] {
  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(""));
  for (const [entity, positions] of Object.entries(entities)) {
    for (const pos of positions) {
      const x = pos.x - 1;
      const y = pos.y - 1;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        if (grid[y][x]) {
          grid[y][x] = grid[y][x] + "<" + entity;
        } else {
          grid[y][x] = entity;
        }
      }
    }
  }
  return grid;
}

// Helper: normalize cell entity ordering for comparison
function normalizeCell(cell: string): string {
  if (!cell) return "";
  return cell.split("<").sort().join("<");
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
      assert(typeof rule.entity === "string" && rule.entity.length > 0, "Rule should have entity string");
      assert(typeof rule.state === "string" && rule.state.length > 0, "Rule should have state string");
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
      assert(typeof pos === "object" && pos !== null, "Position should be an object");
      assert(typeof pos.x === "number" && pos.x > 0, "X should be positive number");
      assert(typeof pos.y === "number" && pos.y > 0, "Y should be positive number");
    }
  });
  console.log(`  Found ${youPositions.length} YOU position(s):`, youPositions.map(p => `(${p.x}, ${p.y})`).join(", "));
  console.log();
  
  // Test 3: getStatePositions (WIN)
  console.log("Test Suite: getStatePositions (WIN)");
  const winPositions = getStatePositions(gameState, "win");
  test("returns an array", () => assert(Array.isArray(winPositions), "Should return an array"));
  test("finds WIN positions", () => assert(winPositions.length > 0, `Expected WIN positions, got ${winPositions.length}`));
  test("positions are valid coordinates", () => {
    for (const pos of winPositions) {
      assert(typeof pos === "object" && pos !== null, "Position should be an object");
      assert(typeof pos.x === "number" && pos.x > 0, "X should be positive number");
      assert(typeof pos.y === "number" && pos.y > 0, "Y should be positive number");
    }
  });
  console.log(`  Found ${winPositions.length} WIN position(s):`, winPositions.map(p => `(${p.x}, ${p.y})`).join(", "));
  console.log();
  
  // Test 4: reachableEntities
  console.log("Test Suite: reachableEntities");
  const reachable = reachableEntities(gameState);
  test("returns an array", () => assert(Array.isArray(reachable), "Should return an array"));
  test("finds reachable entities", () => assert(reachable.length > 0, `Expected reachable entities, got ${reachable.length}`));
  test("entities have valid format", () => {
    for (const entity of reachable) {
      assert(typeof entity === "object" && entity !== null, "Entity should be an object");
      assert(typeof entity.x === "number", "X should be number");
      assert(typeof entity.y === "number", "Y should be number");
      assert(typeof entity.entity === "string", "Entity name should be string");
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
  
  // Test 7: getGameState with active_only parameter
  console.log("Test Suite: getGameState (active_only filter)");
  const fullState = await getGameState(false);
  const filteredState = await getGameState(true);
  
  test("returns formatted grid string", () => {
    assert(typeof fullState === "string", "Should return string");
    assert(fullState.includes("y/x |"), "Should have header row");
  });
  
  test("active_only=false shows all entities", () => {
    assert(fullState.length > 0, "Full state should have content");
  });
  
  test("active_only=true filters to active entities only", () => {
    assert(filteredState.length > 0, "Filtered state should have content");
  });
  
  test("active_only=true produces smaller or equal output", () => {
    assert(filteredState.length <= fullState.length, "Filtered should be <= full state");
  });
  
  test("active_only=true keeps text_ entities", () => {
    assert(filteredState.includes("text_"), "Should contain text_ entities");
  });
  
  test("active_only=true keeps entities from active rules", () => {
    const activeRules = getRules(filteredState);
    const subjects = new Set(activeRules.map(r => r.entity));
    for (const subject of subjects) {
      assert(filteredState.includes(subject), `Should contain ${subject} (from active rule)`);
    }
  });
  console.log(`  Full state: ${fullState.length} chars`);
  console.log(`  Filtered state: ${filteredState.length} chars`);
  console.log(`  Reduction: ${((1 - filteredState.length / fullState.length) * 100).toFixed(1)}%`);
  console.log();

  // Test 8: getGameStateAsCompact
  console.log("Test Suite: getGameStateAsCompact");
  const compactState = await getGameStateAsCompact(false);

  test("returns object with dimensions", () => {
    assert(typeof compactState === "object" && compactState !== null, "Should return object");
    assert(typeof compactState.dimensions === "object", "Should have dimensions");
    assert(typeof compactState.dimensions.width === "number", "Width should be number");
    assert(typeof compactState.dimensions.height === "number", "Height should be number");
  });

  test("returns compact table string", () => {
    assert(typeof compactState.table === "string", "Table should be string");
    assert(compactState.table.includes("|"), "Table should contain pipe characters");
    // Compact format: each line should be short (row number + pipe + chars)
    const lines = compactState.table.split("\n");
    assert(lines.length > 1, "Table should have multiple lines");
    // First line is header with column numbers, rest are data rows
    assert(lines[0].length > 3, "Header should have content");
  });

  test("returns legend object", () => {
    assert(typeof compactState.legend === "object" && compactState.legend !== null, "Should have legend object");
    // Legend should only contain present entities
    const legendKeys = Object.keys(compactState.legend);
    assert(legendKeys.length > 0, "Legend should have at least one entry");
    for (const key of legendKeys) {
      assert(typeof compactState.legend[key] === "string", `Legend entry ${key} should be string`);
      assert(compactState.legend[key].length === 1, `Legend entry ${key} should be single character`);
    }
  });

test("legend only contains present entities", () => {
    const tableLines = compactState.table.split("\n");
    const presentChars = new Set<string>();
    for (const line of tableLines) {
      if (/^\s*\d+\|/.test(line)) {
        const parts = line.split("|");
        const cells = parts.slice(1).map(c => c.trim()).filter(c => c.length > 0);
        for (const cell of cells) {
          presentChars.add(cell);
        }
      }
    }
    const presentEntities = new Set<string>();
    for (const cell of presentChars) {
      for (const [entity, char] of Object.entries(compactState.legend)) {
        if (char === cell) {
          presentEntities.add(entity);
        }
      }
    }
    const legendKeys = Object.keys(compactState.legend);
    for (const key of legendKeys) {
      assert(presentEntities.has(key), `Legend key "${key}" not found in table`);
    }
  });

  console.log(`  Dimensions: ${compactState.dimensions.width}x${compactState.dimensions.height}`);
  console.log(`  Legend entries: ${Object.keys(compactState.legend).length}`);
  console.log(`  Table lines: ${compactState.table.split("\n").length}`);
  console.log();

  // Test 9: Format Equivalence
  console.log("Test Suite: Format Equivalence");
  for (const activeOnly of [false, true]) {
    const label = activeOnly ? "active_only=true" : "active_only=false";
    const entitiesState = await getGameStateAsJson(activeOnly);
    const gridState = await getGameStateAsGrid(activeOnly);
    const compactStateAO = await getGameStateAsCompact(activeOnly);

    test(`[${label}] dimensions match across all formats`, () => {
      assert(entitiesState.dimensions.width === gridState.dimensions.width, "entities width != grid width");
      assert(entitiesState.dimensions.height === gridState.dimensions.height, "entities height != grid height");
      assert(compactStateAO.dimensions.width === gridState.dimensions.width, "compact width != grid width");
      assert(compactStateAO.dimensions.height === gridState.dimensions.height, "compact height != grid height");
    });

    test(`[${label}] entities and grid are perfectly equivalent`, () => {
      const { width, height } = gridState.dimensions;
      const reconstructedGrid = entitiesToGrid(entitiesState.entities, width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gridCell = gridState.grid[y]?.[x] || "";
          const reconCell = reconstructedGrid[y]?.[x] || "";
          assert(normalizeCell(gridCell) === normalizeCell(reconCell), `Mismatch at (${x + 1}, ${y + 1}): grid="${gridCell}" entities="${reconCell}"`);
        }
      }
    });

    test(`[${label}] compact cells project valid grid entities`, () => {
      const { width, height } = compactStateAO.dimensions;
      const reverseLegend = buildReverseLegend(compactStateAO.legend);
      const compactGrid = parseCompactTable(compactStateAO.table, width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const compactChar = compactGrid[y]?.[x] || "";
          const gridCell = gridState.grid[y]?.[x] || "";

          if (compactChar === "") {
            assert(gridCell === "", `Empty compact cell at (${x + 1}, ${y + 1}) but grid has "${gridCell}"`);
          } else {
            const entity = reverseLegend[compactChar];
            assert(entity !== undefined, `Compact char "${compactChar}" at (${x + 1}, ${y + 1}) not in legend`);
            const firstEntity = gridCell.split("<")[0] || "";
            assert(firstEntity === entity, `Compact shows "${compactChar}"->${entity} at (${x + 1}, ${y + 1}) but grid first entity is "${firstEntity}"`);
          }
        }
      }
    });

    test(`[${label}] compact legend entities exist in entities format`, () => {
      for (const entity of Object.keys(compactStateAO.legend)) {
        assert(entity in entitiesState.entities, `Legend entity "${entity}" not found in entities format`);
      }
    });
  }
  console.log();

  // Test 10: Entities to Grid Round-trip
  console.log("Test Suite: Entities to Grid Round-trip");
  for (const activeOnly of [false, true]) {
    const label = activeOnly ? "active_only=true" : "active_only=false";
    const entitiesState = await getGameStateAsJson(activeOnly);
    const gridState = await getGameStateAsGrid(activeOnly);
    const { width, height } = gridState.dimensions;

    test(`[${label}] entities -> grid reconstruction matches original`, () => {
      const reconstructed = entitiesToGrid(entitiesState.entities, width, height);
      assert(reconstructed.length === height, "Reconstructed height mismatch");
      for (let y = 0; y < height; y++) {
        assert(reconstructed[y].length === width, `Reconstructed row ${y} width mismatch`);
        for (let x = 0; x < width; x++) {
          const original = gridState.grid[y][x] || "";
          const rebuilt = reconstructed[y][x] || "";
          assert(normalizeCell(original) === normalizeCell(rebuilt), `Round-trip mismatch at (${x + 1}, ${y + 1}): original="${original}" rebuilt="${rebuilt}"`);
        }
      }
    });
  }
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
