import * as fs from "fs";
import * as path from "path";
import { getGameState, getRawGameState, getGameStateAsJson } from "./get_game_state.js";
import { getRules, getStatePositions, getStatePositionsFromGrid } from "./base.js";
import type { ToolResponse, CommandExecutionData, LevelControlData, StateDiff, PositionChanges, RuleChanges } from "./models.js";
import type { Rule } from "./models.js";

const GAME_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";
const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");
const COMMANDS_DIR = path.join(GAME_DIR, "commands");

const VALID_COMMANDS = ["right", "up", "left", "down", "idle"];
const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 100;

// Helper type for entity positions
export interface EntityPosition {
  entity: string;
  x: number;
  y: number;
}

// Extract all entity positions from grid
export function extractEntityPositions(grid: string[][]): EntityPosition[] {
  const positions: EntityPosition[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];
      if (cell) {
        const entities = cell.split("<");
        for (const entity of entities) {
          positions.push({ entity, x: x + 1, y: y + 1 });
        }
      }
    }
  }
  return positions;
}

// Calculate diff between two game states
export function calculateStateDiff(
  beforeGrid: string[][],
  afterGrid: string[][],
  beforeRules: Rule[],
  afterRules: Rule[]
): StateDiff {
  const beforePositions = extractEntityPositions(beforeGrid);
  const afterPositions = extractEntityPositions(afterGrid);

  // Create maps for easier lookup
  const beforeMap = new Map<string, EntityPosition[]>();
  const afterMap = new Map<string, EntityPosition[]>();

  for (const pos of beforePositions) {
    if (!beforeMap.has(pos.entity)) {
      beforeMap.set(pos.entity, []);
    }
    beforeMap.get(pos.entity)!.push(pos);
  }

  for (const pos of afterPositions) {
    if (!afterMap.has(pos.entity)) {
      afterMap.set(pos.entity, []);
    }
    afterMap.get(pos.entity)!.push(pos);
  }

  const moved: { entity: string; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  const created: { entity: string; at: { x: number; y: number } }[] = [];
  const destroyed: { entity: string; at: { x: number; y: number } }[] = [];

  // All unique entities
  const allEntities = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const entity of allEntities) {
    const beforeList = beforeMap.get(entity) || [];
    const afterList = afterMap.get(entity) || [];

    // Match positions to find moves
    const matchedBefore = new Set<number>();
    const matchedAfter = new Set<number>();

    // Find exact matches (no change)
    for (let i = 0; i < beforeList.length; i++) {
      for (let j = 0; j < afterList.length; j++) {
        if (matchedBefore.has(i) || matchedAfter.has(j)) continue;
        if (beforeList[i].x === afterList[j].x && beforeList[i].y === afterList[j].y) {
          matchedBefore.add(i);
          matchedAfter.add(j);
        }
      }
    }

    // Find moves (same entity, different position)
    for (let i = 0; i < beforeList.length; i++) {
      if (matchedBefore.has(i)) continue;
      for (let j = 0; j < afterList.length; j++) {
        if (matchedAfter.has(j)) continue;
        // Consider it a move if positions are different
        moved.push({
          entity,
          from: { x: beforeList[i].x, y: beforeList[i].y },
          to: { x: afterList[j].x, y: afterList[j].y }
        });
        matchedBefore.add(i);
        matchedAfter.add(j);
        break;
      }
    }

    // Remaining before positions are destroyed
    for (let i = 0; i < beforeList.length; i++) {
      if (!matchedBefore.has(i)) {
        destroyed.push({
          entity,
          at: { x: beforeList[i].x, y: beforeList[i].y }
        });
      }
    }

    // Remaining after positions are created
    for (let j = 0; j < afterList.length; j++) {
      if (!matchedAfter.has(j)) {
        created.push({
          entity,
          at: { x: afterList[j].x, y: afterList[j].y }
        });
      }
    }
  }

  // Calculate rule changes
  const beforeRuleSet = new Set(beforeRules.map(r => `${r.entity} IS ${r.state}`));
  const afterRuleSet = new Set(afterRules.map(r => `${r.entity} IS ${r.state}`));

  const added: string[] = [];
  const removed: string[] = [];

  for (const rule of afterRuleSet) {
    if (!beforeRuleSet.has(rule)) {
      added.push(rule);
    }
  }

  for (const rule of beforeRuleSet) {
    if (!afterRuleSet.has(rule)) {
      removed.push(rule);
    }
  }

  return {
    positions: { moved, created, destroyed },
    rules: { added, removed }
  };
}

function getNextCommandFile(): number {
  let k = 0;
  while (true) {
    const cmdPath = path.join(COMMANDS_DIR, `${k}.lua`);
    if (!fs.existsSync(cmdPath)) {
      return k;
    }
    k++;
  }
}

function getLastProcessed(): number {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    for (const line of content.split("\n")) {
      if (line.startsWith("last_processed=")) {
        return parseInt(line.split("=")[1].trim(), 10);
      }
    }
  } catch {
    return -1;
  }
  return -1;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkWinStatus(): boolean {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    let currentSection = "";
    
    for (const line of content.split("\n")) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        currentSection = trimmedLine.slice(1, -1);
        continue;
      }
      
      if (currentSection === "status" && trimmedLine.startsWith("level_won=")) {
        return trimmedLine.split("=")[1].trim() === "true";
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function waitForRestartCompletion(cmdFileNum: number): Promise<boolean> {
  // Wait for initial command execution - after restart, last_processed resets to 0
  // So we can't reliably use last_processed >= cmdFileNum
  // Instead, we wait for the restart to complete by detecting state stability
  
  const startTime = Date.now();
  const TIMEOUT_MS = 5000;
  const POLL_MS = 100;
  
  // After restart, last_processed will be 0 (reset by level_start hook)
  // Wait for either:
  // 1. last_processed >= cmdFileNum (old behavior, in case restart is async)
  // 2. last_processed === 0 for at least 3 consecutive reads (restart completed)
  
  let zeroCount = 0;
  
  while (Date.now() - startTime < TIMEOUT_MS) {
    const lastProcessed = getLastProcessed();
    
    if (lastProcessed >= cmdFileNum) {
      // Restart may have been processed without reset (oldbehavior)
      await sleep(200);
      return true;
    }
    
    if (lastProcessed === 0) {
      zeroCount++;
      if (zeroCount >= 3) {
        // last_processed has been 0 for 3 consecutive reads
        // This indicates restart completed and level_start reset the counter
        await sleep(200);
        return true;
      }
    } else {
      // Reset zero count if we see non-zero value
      zeroCount = 0;
    }
    
    await sleep(POLL_MS);
  }
  
  // Timeout - check if last_processed is 0 (restart may have completed)
  return getLastProcessed() === 0;
}

async function waitForCommandExecution(cmdFileNum: number, maxRetries: number = 0): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < TIMEOUT_MS) {
      const lastProcessed = getLastProcessed();
      if (lastProcessed >= cmdFileNum) {
        return true;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    
    if (attempt < maxRetries) {
      await sleep(RETRY_DELAY_MS);
    }
  }
  
  return false;
}

export async function executeCommands(commandsStr: string, returnInsights: boolean = true): Promise<string> {
  const commands = commandsStr.split(",").map(c => c.trim()).filter(c => c);
  const validCmds = commands.filter(c => VALID_COMMANDS.includes(c));
  
  if (validCmds.length === 0) {
    const errorResponse: ToolResponse<null> = {
      success: false,
      data: null,
      message: `No valid commands. Valid: ${VALID_COMMANDS.join(", ")}`
    };
    return JSON.stringify(errorResponse);
  }
  
  // Get state BEFORE execution
  let beforeGrid: string[][];
  let beforeRules: Rule[];
  try {
    const beforeState = await getRawGameState();
    beforeGrid = beforeState.grid;
    const beforeStateStr = await getGameState();
    beforeRules = getRules(beforeStateStr);
  } catch {
    const errorResponse: ToolResponse<null> = {
      success: false,
      data: null,
      message: `Failed to read initial game state. Game may not be running.`
    };
    return JSON.stringify(errorResponse);
  }
  
  const cmdFileNum = getNextCommandFile();
  const cmdPath = path.join(COMMANDS_DIR, `${cmdFileNum}.lua`);
  
  const luaContent = validCmds.map(cmd => {
    if (cmd === "undo") {
      return "undo()";
    }
    return `command("${cmd}",1)`;
  }).join("\n") + "\n";
  fs.writeFileSync(cmdPath, luaContent);
  
  const executed = await waitForCommandExecution(cmdFileNum, 2);
  
  // Get state AFTER execution (even on timeout/partial failure)
  let afterGrid: string[][];
  let afterRules: Rule[];
  try {
    const afterState = await getRawGameState();
    afterGrid = afterState.grid;
    const afterStateStr = await getGameState();
    afterRules = getRules(afterStateStr);
  } catch {
    const errorResponse: ToolResponse<null> = {
      success: false,
      data: null,
      message: `Failed to read game state after command. Game may not be running.`
    };
    return JSON.stringify(errorResponse);
  }
  
  // Calculate diff
  const diff = calculateStateDiff(beforeGrid, afterGrid, beforeRules, afterRules);
  
  if (!executed) {
    // Even on timeout, commands may have partially executed
    // Include diff to show what actually happened
    const youPositions = getStatePositions(await getGameState(), "you");
    const winPositions = getStatePositions(await getGameState(), "win");
    
  // Check if YOU entity was lost and win status
  const levelWon = checkWinStatus();
  let message = `Partial execution. Commands may have partially executed.`;
  if (youPositions.length === 0) {
    message += " Warning: No YOU entity found! You may have broken the 'X IS YOU' rule. Options: 1) Use restart_level to restart the level 2) Use undo_multiple(n=1) to undo the last move and restore YOU";
  }
  
  const data: CommandExecutionData & { diff: StateDiff } = {
    executed: validCmds,
    active_rules: afterRules,
    you_positions: youPositions,
    win_positions: winPositions,
    level_won: levelWon,
    diff
  };
  const response: ToolResponse<typeof data> = {
    success: false,
    data,
    message
  };
  return JSON.stringify(response);
}
  
  if (!returnInsights) {
    const response: ToolResponse<{ executed: string[]; diff: StateDiff }> = {
      success: true,
      data: { executed: validCmds, diff },
      message: `Executed ${validCmds.length} command(s)`
    };
    return JSON.stringify(response);
  }
  
  const gameState = await getGameState();
  const rules = getRules(gameState);
  const youPositions = getStatePositions(gameState, "you");
  const winPositions = getStatePositions(gameState, "win");
  const levelWon = checkWinStatus();
  
  // Check if YOU entity was lost or level won
  let message = `Executed ${validCmds.length} command(s)`;
  let success = true;
  if (levelWon) {
    message = "Level won!";
  } else if (youPositions.length === 0) {
    success = false;
    message += " Warning: No YOU entity found! You may have broken the 'X IS YOU' rule. Options: 1) Use restart_level to restart the level 2) Use undo_multiple(n=1) to undo the last move and restore YOU";
  }
  
  const data: CommandExecutionData & { diff: StateDiff } = {
    executed: validCmds,
    active_rules: rules,
    you_positions: youPositions,
    win_positions: winPositions,
    level_won: levelWon,
    diff
  };
  
  const response: ToolResponse<typeof data> = {
    success,
    data,
    message
  };
  
  return JSON.stringify(response);
}

export async function restartLevel(returnInsights: boolean = true): Promise<string> {
  const cmdFileNum = getNextCommandFile();
  const cmdPath = path.join(COMMANDS_DIR, `${cmdFileNum}.lua`);
  fs.writeFileSync(cmdPath, `command("restart_instant", 1)\n`);

  const executed = await waitForRestartCompletion(cmdFileNum);

  // Verify game is responding by reading state
  try {
    const gameState = await getGameState();
    const gameStateJson = await getGameStateAsJson();
    const rawGrid = await getRawGameState();
    
    if (gameState.length === 0) {
      const errorResponse: ToolResponse<null> = {
        success: false,
        data: null,
        message: `Failed to execute restart command ${cmdFileNum}. Game state empty.`
      };
      return JSON.stringify(errorResponse);
    }

    if (!returnInsights) {
      const response: ToolResponse<null> = {
        success: executed,
        data: null,
        message: executed ? "Level restarted successfully" : "Level restart may have partially completed. Verify state before continuing."
      };
      return JSON.stringify(response);
    }

    const rules = getRules(gameState);
    const youPositions = getStatePositionsFromGrid(gameStateJson, rawGrid.grid, "you");
    const winPositions = getStatePositionsFromGrid(gameStateJson, rawGrid.grid, "win");
    const levelWon = checkWinStatus();
    const data: LevelControlData = {
      active_rules: rules,
      you_positions: youPositions,
      win_positions: winPositions,
      level_won: levelWon,
    };
    const response: ToolResponse<LevelControlData> = {
      success: executed,
      data,
      message: executed ? "Level restarted successfully" : "Level restart may have partially completed. Verify state before continuing."
    };
    return JSON.stringify(response);
  } catch {
    const errorResponse: ToolResponse<null> = {
      success: false,
      data: null,
      message: `Failed to execute restart command ${cmdFileNum}. Game may not be running.`
    };
    return JSON.stringify(errorResponse);
  }
}

export async function undoMultiple(n: number, returnInsights: boolean = true): Promise<string> {
  const numUndos = Math.min(n, 50);
  const cmdFileNum = getNextCommandFile();
  const cmdPath = path.join(COMMANDS_DIR, `${cmdFileNum}.lua`);
  let luaContent = "";
  for (let i = 0; i < numUndos; i++) {
    luaContent += "undo()\n";
  }
  fs.writeFileSync(cmdPath, luaContent);

  // Wait for undo command to execute
  await waitForCommandExecution(cmdFileNum, 2);

  // Verify game is responding by reading state
  try {
    const gameState = await getGameState();
    if (gameState.length === 0) {
      const errorResponse: ToolResponse<null> = {
        success: false,
        data: null,
        message: `Failed to execute undo command ${cmdFileNum}. Game state empty.`
      };
      return JSON.stringify(errorResponse);
    }

    if (!returnInsights) {
      const response: ToolResponse<{ undos: number }> = {
        success: true,
        data: { undos: numUndos },
        message: `Undid ${numUndos} moves`
      };
      return JSON.stringify(response);
    }

    const rules = getRules(gameState);
    const youPositions = getStatePositions(gameState, "you");
    const winPositions = getStatePositions(gameState, "win");
    const levelWon = checkWinStatus();
    const data: LevelControlData = {
      active_rules: rules,
      you_positions: youPositions,
      win_positions: winPositions,
      level_won: levelWon,
    };
    const response: ToolResponse<LevelControlData> = {
      success: true,
      data,
      message: `Undid ${numUndos} moves`
    };
    return JSON.stringify(response);
  } catch {
    const errorResponse: ToolResponse<null> = {
      success: false,
      data: null,
      message: `Failed to execute undo command ${cmdFileNum}. Game may not be running.`
    };
    return JSON.stringify(errorResponse);
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "exec" && args[1]) {
    console.log(await executeCommands(args[1]));
  } else if (args[0] === "restart") {
    console.log(await restartLevel());
  } else if (args[0] === "undo" && args[1]) {
    console.log(await undoMultiple(parseInt(args[1])));
  }
}
