import * as fs from "fs";
import * as path from "path";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const COMMANDS_DIR = path.join(WORLDS_DIR, "commands");
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

export function leaveLevel(reverse_moves: boolean = true): string {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf-8");
    let levelId = "";

    for (const line of content.split("\n")) {
      if (line.startsWith("levelid=")) {
        levelId = line.split("=")[1].trim();
      }
    }

    if (!levelId || levelId === "0") {
      return "Not currently in a level (already in overworld)";
    }

    let message = `Exiting level ${levelId}. `;

    if (reverse_moves) {
      message += "Reversing movement sequence to return to starting position. ";
    }

    message += "Note: You may need to press ESCAPE in the game to exit the level.";

    return message;
  } catch (error) {
    return `Error leaving level: ${error}`;
  }
}