import * as fs from "fs";
import * as path from "path";
import { getRawGameState } from "./utils/get_game_state.js";

const GAME_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";
const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");
const COMMANDS_DIR = path.join(GAME_DIR, "commands");

const VALID_COMMANDS = ["right", "up", "left", "down", "idle", "undo", "restart_instant", "quit"];

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

export async function executeCommands(commandsStr: string): Promise<string> {
  const commands = commandsStr.split(",").map(c => c.trim()).filter(c => c);
  const validCmds = commands.filter(c => VALID_COMMANDS.includes(c));
  
  if (validCmds.length === 0) {
    return `No valid commands. Valid: ${VALID_COMMANDS.join(", ")}`;
  }
  
  const cmdFileNum = getNextCommandFile();
  const cmdPath = path.join(COMMANDS_DIR, `${cmdFileNum}.lua`);
  
  const luaContent = validCmds.map(cmd => `command("${cmd}",1)`).join("\n") + "\n";
  fs.writeFileSync(cmdPath, luaContent);
  
  const content = fs.readFileSync(STATE_PATH, "utf-8");
  const lines = content.split("\n");
  const newLines = lines.map(line => {
    if (line.startsWith("last_processed=")) {
      return `last_processed=${cmdFileNum}`;
    }
    return line;
  });
  fs.writeFileSync(STATE_PATH, newLines.join("\n"));
  
  return `Executed: ${validCmds.join(", ")}`;
}

export async function restartLevel(): Promise<string> {
  return executeCommands("restart_instant");
}

export async function undoMultiple(n: number): Promise<string> {
  const undos = Array(Math.min(n, 50)).fill("undo").join(",");
  return executeCommands(undos);
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
