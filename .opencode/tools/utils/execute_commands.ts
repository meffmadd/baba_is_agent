import * as fs from "fs";
import * as path from "path";
import { getGameState } from "./get_game_state.js";
import { getRules, getStatePositions } from "../base.js";

const GAME_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";
const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");
const COMMANDS_DIR = path.join(GAME_DIR, "commands");

const VALID_COMMANDS = ["right", "up", "left", "down", "idle", "undo", "restart_instant", "quit"];
const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 10000;

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

async function waitForCommandExecution(cmdFileNum: number): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < TIMEOUT_MS) {
    const lastProcessed = getLastProcessed();
    if (lastProcessed >= cmdFileNum) {
      return true;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  
  return false;
}

export async function executeCommands(commandsStr: string, returnState: boolean = true): Promise<string> {
  const commands = commandsStr.split(",").map(c => c.trim()).filter(c => c);
  const validCmds = commands.filter(c => VALID_COMMANDS.includes(c));
  
  if (validCmds.length === 0) {
    return `No valid commands. Valid: ${VALID_COMMANDS.join(", ")}`;
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
  
  const executed = await waitForCommandExecution(cmdFileNum);
  
  if (!executed) {
    return `Timeout waiting for command ${cmdFileNum} to execute. Game may not be running.`;
  }
  
  if (!returnState) {
    return `Executed: ${validCmds.join(", ")}`;
  }
  
  const gameState = await getGameState();
  const rules = getRules(gameState);
  const youPositions = getStatePositions(gameState, "you");
  const winPositions = getStatePositions(gameState, "win");
  
  const minimalState = {
    active_rules: rules,
    you_positions: youPositions,
    win_positions: winPositions,
  };
  
  return `Executed: ${validCmds.join(", ")}\n\nUpdated game state:\n${JSON.stringify(minimalState)}`;
}

export async function restartLevel(returnState: boolean = true): Promise<string> {
  return executeCommands("restart_instant", returnState);
}

export async function undoMultiple(n: number, returnState: boolean = true): Promise<string> {
  const undos = Array(Math.min(n, 50)).fill("undo").join(",");
  return executeCommands(undos, returnState);
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
