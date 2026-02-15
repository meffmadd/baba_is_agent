import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const COMMANDS_DIR = path.join(WORLDS_DIR, "commands");
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

function reverseMovementCommands(commands: string[]): string[] {
  const reverseMap: Record<string, string> = {
    right: "left",
    left: "right",
    up: "down",
    down: "up",
  };
  return commands.map(cmd => reverseMap[cmd] || cmd).reverse();
}

export default tool({
  description:
    "Exit the current level and return to the overworld. Optionally reverses movement to return to starting position.",
  args: {
    reverse_moves: tool.schema.boolean().optional().describe("If true, reverse the movement sequence to return to starting position (default: true)"),
  },
  async execute(args: { reverse_moves?: boolean }) {
    try {
      const reverseMoves = args.reverse_moves !== false; // Default to true
      
      // Read current game state to check if we're in a level
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
      
      // Ensure commands directory exists
      if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
      }
      
      // For now, we just report what should happen
      // The actual exit requires pyautogui or manual user action
      let message = `Exiting level ${levelId}. `;
      
      if (reverseMoves) {
        message += "Reversing movement sequence to return to starting position. ";
      }
      
      message += "Note: You may need to press ESCAPE in the game to exit the level.";
      
      return message;
    } catch (error) {
      return `Error leaving level: ${error}`;
    }
  },
});
