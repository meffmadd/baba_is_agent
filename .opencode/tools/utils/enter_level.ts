import * as fs from "fs";
import * as path from "path";

const GAME_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";
const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const COMMANDS_DIR = path.join(GAME_DIR, "commands");
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

function getNextCommandFile(): string {
  let k = 0;
  while (true) {
    const filePath = path.join(COMMANDS_DIR, `${k}.lua`);
    if (!fs.existsSync(filePath)) {
      return filePath;
    }
    k++;
  }
}

export function enterLevel(level: string, world: string = "top"): string {
  try {
    const sequence: string[] = [];

    if (world === "top") {
      if (level.match(/^\d+$/)) {
        const levelNum = parseInt(level);
        if (levelNum >= 1) {
          sequence.push("right", "up", "up");
        }

        const levelMoves: Record<number, string[]> = {
          2: ["up"],
          3: ["right"],
          4: ["up", "right"],
          5: ["up", "up"],
          6: ["up", "right", "right"],
          7: ["up", "up", "right"],
        };

        if (levelMoves[levelNum]) {
          sequence.push(...levelMoves[levelNum]);
        }
      }
    }

    if (sequence.length === 0) {
      return `Error: Unknown level ${level} in world ${world}`;
    }

    if (!fs.existsSync(COMMANDS_DIR)) {
      fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    }

    const commandFile = getNextCommandFile();
    const commands = sequence.map(cmd => `command("${cmd}",1)`).join("\n");
    fs.writeFileSync(commandFile, commands + "\n");

    if (fs.existsSync(STATE_PATH)) {
      let content = fs.readFileSync(STATE_PATH, "utf-8");
      content = content.replace(/level_won=true/g, "level_won=false");
      fs.writeFileSync(STATE_PATH, content);
    }

    return `Navigating to level ${level}. Movement sequence: ${sequence.join(", ")}. Press ENTER in the game to enter the level.`;
  } catch (error) {
    return `Error entering level: ${error}`;
  }
}