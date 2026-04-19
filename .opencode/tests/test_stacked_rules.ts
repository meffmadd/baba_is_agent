// Test rule parsing with stacked cells (text_ entities stacked with non-text entities)
// Bug #3: rulesFromRow uses .split("<").pop() which discards text_ entities in stacked cells
import { getRulesFromGrid, parseGameState } from "../tools/utils/base.js";

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

function ruleKey(r: { entity: string; state: string }): string {
  return `${r.entity} IS ${r.state}`;
}

function hasRule(rules: { entity: string; state: string }[], entity: string, state: string): boolean {
  return rules.some((r) => r.entity === entity && r.state === state);
}

function runTests() {
  console.log("=".repeat(60));
  console.log("Testing: Rule Parsing with Stacked Cells (Bug #3)");
  console.log("=".repeat(60));
  console.log();

  // Test 1: Baseline — non-stacked text rules work correctly
  console.log("Test Suite: Baseline (non-stacked)");
  const baselineGrid = [
    ["text_baba", "text_is", "text_you", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const baselineRules = getRulesFromGrid(baselineGrid);
  test("finds baba IS you from non-stacked cells", () => {
    assert(hasRule(baselineRules, "baba", "you"), `Expected baba IS you, got: ${baselineRules.map(ruleKey).join(", ")}`);
  });
  console.log(`  Found rules: ${baselineRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Test 2: Stacked text entity on the entity side (the core bug)
  // text_baba<rock in a cell means text_baba is stacked with rock
  // .pop() returns "rock" -> rule becomes "rock IS you" instead of "baba IS you"
  console.log("Test Suite: Stacked entity cell (text_baba<rock)");
  const stackedEntityGrid = [
    ["text_baba<rock", "text_is", "text_you", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const stackedEntityRules = getRulesFromGrid(stackedEntityGrid);
  test("finds baba IS you from stacked entity cell", () => {
    assert(hasRule(stackedEntityRules, "baba", "you"), `Expected baba IS you, got: ${stackedEntityRules.map(ruleKey).join(", ")}`);
  });
  test("does not produce incorrect rock IS you rule", () => {
    assert(!hasRule(stackedEntityRules, "rock", "you"), `Should not have rock IS you, got: ${stackedEntityRules.map(ruleKey).join(", ")}`);
  });
  console.log(`  Found rules: ${stackedEntityRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Test 3: Stacked text entity on the state side
  // text_win<rock in a cell -> .pop() returns "rock" -> rule becomes "flag IS rock" instead of "flag IS win"
  console.log("Test Suite: Stacked state cell (text_win<rock)");
  const stackedStateGrid = [
    ["text_flag", "text_is", "text_win<rock", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const stackedStateRules = getRulesFromGrid(stackedStateGrid);
  test("finds flag IS win from stacked state cell", () => {
    assert(hasRule(stackedStateRules, "flag", "win"), `Expected flag IS win, got: ${stackedStateRules.map(ruleKey).join(", ")}`);
  });
  test("does not produce incorrect flag IS rock rule", () => {
    assert(!hasRule(stackedStateRules, "flag", "rock"), `Should not have flag IS rock, got: ${stackedStateRules.map(ruleKey).join(", ")}`);
  });
  console.log(`  Found rules: ${stackedStateRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Test 4: Stacked IS keyword (text_is<rock)
  // The IS cell itself is stacked — .includes("is") should still match
  console.log("Test Suite: Stacked IS cell (text_is<rock)");
  const stackedIsGrid = [
    ["text_baba", "text_is<rock", "text_you", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const stackedIsRules = getRulesFromGrid(stackedIsGrid);
  test("finds baba IS you with stacked IS cell", () => {
    assert(hasRule(stackedIsRules, "baba", "you"), `Expected baba IS you, got: ${stackedIsRules.map(ruleKey).join(", ")}`);
  });
  console.log(`  Found rules: ${stackedIsRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Test 5: Stacked cells in a column (vertical rule)
  console.log("Test Suite: Stacked entity in column");
  const stackedColGrid = [
    ["text_baba<rock", "", ""],
    ["text_is", "", ""],
    ["text_you", "", ""],
    ["", "", ""],
  ];
  const stackedColRules = getRulesFromGrid(stackedColGrid);
  test("finds baba IS you from stacked entity in column", () => {
    assert(hasRule(stackedColRules, "baba", "you"), `Expected baba IS you, got: ${stackedColRules.map(ruleKey).join(", ")}`);
  });
  console.log(`  Found rules: ${stackedColRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Test 6: Both entity and state stacked
  console.log("Test Suite: Both entity and state stacked");
  const bothStackedGrid = [
    ["text_baba<rock", "text_is", "text_win<wall", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
  const bothStackedRules = getRulesFromGrid(bothStackedGrid);
  test("finds baba IS win with both sides stacked", () => {
    assert(hasRule(bothStackedRules, "baba", "win"), `Expected baba IS win, got: ${bothStackedRules.map(ruleKey).join(", ")}`);
  });
  test("does not produce rock IS wall rule", () => {
    assert(!hasRule(bothStackedRules, "rock", "wall"), `Should not have rock IS wall, got: ${bothStackedRules.map(ruleKey).join(", ")}`);
  });
  console.log(`  Found rules: ${bothStackedRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Test 7: End-to-end with formatted grid string
  console.log("Test Suite: End-to-end parseGameState with stacked cells");
  const stackedGameState = [
    "y/x |   1 |   2 |   3 |   4 |",
    "-----|-----|-----|-----|-----|",
    "  1 |text_baba<rock|text_is|text_you|                 |",
    "  2 |                 |                 |                 |                 |",
    "  3 |                 |                 |                 |                 |",
  ].join("\n");

  const matrix = parseGameState(stackedGameState);
  const e2eRules = getRulesFromGrid(matrix);
  test("parses stacked cell from formatted grid string", () => {
    assert(hasRule(e2eRules, "baba", "you"), `Expected baba IS you, got: ${e2eRules.map(ruleKey).join(", ") || "none"}`);
  });
  test("does not produce rock IS you from stacked cell", () => {
    assert(!hasRule(e2eRules, "rock", "you"), `Should not have rock IS you, got: ${e2eRules.map(ruleKey).join(", ") || "none"}`);
  });
  console.log(`  Found rules: ${e2eRules.map(ruleKey).join(", ") || "none"}`);
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("Test Summary");
  console.log("=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`  Total: ${results.length}`);
  console.log(`  Passed: ${passed} ✓`);
  console.log(`  Failed: ${failed} ${failed > 0 ? "✗" : ""}`);
  console.log();

  if (failed > 0) {
    console.log("Failed tests:");
    for (const result of results.filter((r) => !r.passed)) {
      console.log(`  - ${result.name}: ${result.error}`);
    }
    process.exit(1);
  } else {
    console.log("✓ All tests passed!");
    process.exit(0);
  }
}

runTests();