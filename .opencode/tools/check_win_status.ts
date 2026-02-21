import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const STATE_PATH = path.join(WORLDS_DIR, "world_data.txt");

export default tool({
  description:
    "Check if the current level has been won. Returns win status and level completion info.",
  args: {},
  async execute() {
    try {
      const content = fs.readFileSync(STATE_PATH, "utf-8");
      
      let levelWon = false;
      let levelId = "";
      let currentSection = "";
      
      for (const line of content.split("\n")) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
          currentSection = trimmedLine.slice(1, -1);
          continue;
        }
        
        if (currentSection === "status" && trimmedLine.startsWith("level_won=")) {
          levelWon = trimmedLine.split("=")[1].trim() === "true";
        }
        if (trimmedLine.startsWith("levelid=")) {
          levelId = trimmedLine.split("=")[1].trim();
        }
      }
      
      if (levelWon) {
        return JSON.stringify({
          won: true,
          level_id: levelId,
          message: "🎉 Level completed! You can now enter another level.",
        });
      } else {
        return JSON.stringify({
          won: false,
          level_id: levelId,
          message: "Level not yet won. Keep trying!",
        });
      }
    } catch (error) {
      return JSON.stringify({
        won: false,
        error: `Error checking win status: ${error}`,
      });
    }
  },
});
