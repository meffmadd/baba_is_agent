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

export default tool({
  description:
    "Navigate to a specific level from the overworld. Only works when not currently in a level.",
  args: {
    level: tool.schema.string().describe("Level number to enter (e.g., '1', '2', '3')"),
    world: tool.schema.string().optional().describe("World name (default: 'top')"),
  },
  async execute(args: { level: string; world?: string }) {
    try {
      const level = args.level;
      const world = args.world || "top";
      
      // Calculate movement sequence to reach the level
      const sequence: string[] = [];
      
      if (world === "top") {
        if (level.match(/^\d+$/)) {
          const levelNum = parseInt(level);
          if (levelNum >= 1) {
            sequence.push("right", "up", "up");
          }
          
          // Level-specific movement patterns
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
      
      // Ensure commands directory exists
      if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
      }
      
      // Write movement commands
      const commandFile = getNextCommandFile();
      const commands = sequence.map(cmd => `command("${cmd}",1)`).join("\n");
      fs.writeFileSync(commandFile, commands + "\n");
      
      // Reset level_won status
      if (fs.existsSync(STATE_PATH)) {
        let content = fs.readFileSync(STATE_PATH, "utf-8");
        content = content.replace(/level_won=true/g, "level_won=false");
        fs.writeFileSync(STATE_PATH, content);
      }
      
      return `Navigating to level ${level}. Movement sequence: ${sequence.join(", ")}. Press ENTER in the game to enter the level.`;
    } catch (error) {
      return `Error entering level: ${error}`;
    }
  },
});
