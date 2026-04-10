import * as fs from "fs";
import * as path from "path";
import { getRawGameState, getGameStateAsJson } from "./get_game_state.js";
import { getRulesFromGrid, getStatePositionsFromGrid } from "./base.js";
import { waitForStateSettle, checkWinStatus } from "./poll_state.js";
import type { ToolResponse, CommandExecutionData, LevelControlData, StateDiff, Rule } from "./models.js";

const GAME_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";
const COMMANDS_DIR = path.join(GAME_DIR, "commands");

const VALID_COMMANDS = ["right", "up", "left", "down", "idle"];

export interface EntityPosition {
  entity: string;
  x: number;
  y: number;
}

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

export function calculateStateDiff(
  beforeGrid: string[][],
  afterGrid: string[][],
  beforeRules: Rule[],
  afterRules: Rule[]
): StateDiff {
  const beforePositions = extractEntityPositions(beforeGrid);
  const afterPositions = extractEntityPositions(afterGrid);

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

  const allEntities = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const entity of allEntities) {
    const beforeList = beforeMap.get(entity) || [];
    const afterList = afterMap.get(entity) || [];

    const matchedBefore = new Set<number>();
    const matchedAfter = new Set<number>();

    for (let i = 0; i < beforeList.length; i++) {
      for (let j = 0; j < afterList.length; j++) {
        if (matchedBefore.has(i) || matchedAfter.has(j)) continue;
        if (beforeList[i].x === afterList[j].x && beforeList[i].y === afterList[j].y) {
          matchedBefore.add(i);
          matchedAfter.add(j);
        }
      }
    }

    for (let i = 0; i < beforeList.length; i++) {
      if (matchedBefore.has(i)) continue;
      for (let j = 0; j < afterList.length; j++) {
        if (matchedAfter.has(j)) continue;
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

    for (let i = 0; i < beforeList.length; i++) {
      if (!matchedBefore.has(i)) {
        destroyed.push({
          entity,
          at: { x: beforeList[i].x, y: beforeList[i].y }
        });
      }
    }

    for (let j = 0; j < afterList.length; j++) {
      if (!matchedAfter.has(j)) {
        created.push({
          entity,
          at: { x: afterList[j].x, y: afterList[j].y }
        });
      }
    }
  }

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

  let beforeGrid: string[][];
  let beforeRules: Rule[];
  try {
    const beforeState = await getRawGameState();
    beforeGrid = beforeState.grid;
    beforeRules = getRulesFromGrid(beforeState.grid);
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

  const pollResult = await waitForStateSettle();

  const afterGrid = pollResult.rawState.grid;
  const afterRules = getRulesFromGrid(pollResult.rawState.grid);

  const diff = calculateStateDiff(beforeGrid, afterGrid, beforeRules, afterRules);

  if (!pollResult.confirmed) {
    const gameStateJson = await getGameStateAsJson();
    const youPositions = getStatePositionsFromGrid(gameStateJson, afterGrid, "you");
    const winPositions = getStatePositionsFromGrid(gameStateJson, afterGrid, "win");
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

  const gameStateJson = await getGameStateAsJson();
  const youPositions = getStatePositionsFromGrid(gameStateJson, afterGrid, "you");
  const winPositions = getStatePositionsFromGrid(gameStateJson, afterGrid, "win");
  const levelWon = checkWinStatus();

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
    active_rules: afterRules,
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

  const pollResult = await waitForStateSettle();

  try {
    const gameStateJson = await getGameStateAsJson();
    const rules = getRulesFromGrid(pollResult.rawState.grid);

    if (pollResult.rawState.grid.length === 0) {
      const errorResponse: ToolResponse<null> = {
        success: false,
        data: null,
        message: `Failed to execute restart command ${cmdFileNum}. Game state empty.`
      };
      return JSON.stringify(errorResponse);
    }

    if (!returnInsights) {
      const response: ToolResponse<null> = {
        success: pollResult.confirmed,
        data: null,
        message: pollResult.confirmed ? "Level restarted successfully" : "Level restart may have partially completed. Verify state before continuing."
      };
      return JSON.stringify(response);
    }

    const youPositions = getStatePositionsFromGrid(gameStateJson, pollResult.rawState.grid, "you");
    const winPositions = getStatePositionsFromGrid(gameStateJson, pollResult.rawState.grid, "win");
    const levelWon = checkWinStatus();
    const data: LevelControlData = {
      active_rules: rules,
      you_positions: youPositions,
      win_positions: winPositions,
      level_won: levelWon,
    };
    const response: ToolResponse<LevelControlData> = {
      success: pollResult.confirmed,
      data,
      message: pollResult.confirmed ? "Level restarted successfully" : "Level restart may have partially completed. Verify state before continuing."
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

  const pollResult = await waitForStateSettle();

  try {
    if (pollResult.rawState.grid.length === 0) {
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

    const gameStateJson = await getGameStateAsJson();
    const rules = getRulesFromGrid(pollResult.rawState.grid);
    const youPositions = getStatePositionsFromGrid(gameStateJson, pollResult.rawState.grid, "you");
    const winPositions = getStatePositionsFromGrid(gameStateJson, pollResult.rawState.grid, "win");
    const levelWon = checkWinStatus();
    const data: LevelControlData = {
      active_rules: rules,
      you_positions: youPositions,
      win_positions: winPositions,
      level_won: levelWon,
    };
    const response: ToolResponse<LevelControlData> = {
      success: pollResult.confirmed,
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