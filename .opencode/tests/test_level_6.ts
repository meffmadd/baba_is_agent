import * as fs from "fs";
import * as path from "path";
import { parseGameState, applyMove } from "../tools/utils/base.js";
import type { Direction } from "../tools/utils/base.js";
import { blockedEntities, aStar, convertPathToMoves, shortestPath } from "../tools/utils/path_finding.js";

const EXPECTED_REACHABLE = 20;

const FIXTURE_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "fixtures",
  "wall_flag_state.txt"
);

function findEntity(gameState: string, name: string): { x: number; y: number }[] {
  const matrix = parseGameState(gameState);
  const entities: { x: number; y: number }[] = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y]!.length; x++) {
      if (matrix[y]![x]!.includes(name) && !matrix[y]![x]!.includes("text_")) {
        entities.push({ x: x + 1, y: y + 1 });
      }
    }
  }
  return entities;
}

function canReach(gameState: string, start: [number, number], goal: [number, number]): boolean {
  const blocked = blockedEntities(gameState);
  const startCoord: [number, number] = [start[0] - 1, start[1] - 1];
  
  for (const dir of ["up", "down", "left", "right"] as Direction[]) {
    const goalCoord: [number, number] = [goal[0] - 1, goal[1] - 1];
    const goalPrev = applyMove(goalCoord, dir, true);
    
    if (blocked[goalCoord[1]]?.[goalCoord[0]] === 1) continue;
    if (blocked[goalPrev[1]]?.[goalPrev[0]] === 1) continue;
    
    const path = aStar(blocked, startCoord, goalPrev);
    if (path !== null) return true;
  }
  return false;
}

function testShortestPath(gameState: string, lastMove: Direction, expected: Direction[]) {
  const flags = findEntity(gameState, "flag");
  if (flags.length === 0) {
    console.log("FAIL: No flag found");
    process.exit(1);
  }
  const flag = flags[0]!;
  
  const result = shortestPath(gameState, [flag.x, flag.y], lastMove);
  
  if (result.length !== expected.length || !result.every((r, i) => r === expected[i])) {
    console.log(`FAIL: ${lastMove} -> expected [${expected.map(r => `"${r}"`).join(", ")}], got [${result.map(r => `"${r}"`).join(", ")}]`);
    process.exit(1);
  }
  
  console.log(`PASS: ${lastMove} -> [${result.map(r => `"${r}"`).join(", ")}]`);
}

function testMultiYouShortestPath(gameState: string) {
  testShortestPath(gameState, "left", ["left", "left"]);
  testShortestPath(gameState, "down", ["down", "down"]);
  testShortestPath(gameState, "up", ["up", "up"]);
}

async function main() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`Fixture not found: ${FIXTURE_PATH}`);
    process.exit(1);
  }

  const gameState = fs.readFileSync(FIXTURE_PATH, "utf-8");
  const walls = findEntity(gameState, "wall");
  const flags = findEntity(gameState, "flag");
  
  if (flags.length === 0) {
    console.error("No FLAG found");
    process.exit(1);
  }
  
  const flag = flags[0]!;
  let reachable = 0;
  
  for (const wall of walls) {
    if (canReach(gameState, [wall.x, wall.y], [flag.x, flag.y])) {
      reachable++;
    }
  }

  console.log(`Reachable walls: ${reachable}/${walls.length}`);
  
  if (reachable === EXPECTED_REACHABLE) {
    console.log(`PASS: ${EXPECTED_REACHABLE} walls can reach FLAG`);
  } else {
    console.log(`FAIL: Expected ${EXPECTED_REACHABLE}, got ${reachable}`);
    process.exit(1);
  }
  
  testMultiYouShortestPath(gameState);
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});