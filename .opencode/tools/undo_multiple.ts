import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";

const WORLDS_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/Worlds/baba";
const COMMANDS_DIR = path.join(WORLDS_DIR, "commands");

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
    "Undo the last N moves by executing multiple undo commands. Useful for backtracking when stuck.",
  args: {
    n: tool.schema.number().describe("Number of moves to undo (must be positive)"),
  },
  async execute(args: { n: number }) {
    try {
      const n = args.n;
      
      if (n <= 0) {
        return "Error: Number of undos must be positive";
      }
      
      // Ensure commands directory exists
      if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
      }
      
      // Create command file with n undo commands
      const commandFile = getNextCommandFile();
      const commands = Array(n).fill("undo()").join("\n");
      fs.writeFileSync(commandFile, commands + "\n");
      
      return `Undoing ${n} moves. Command file created: ${path.basename(commandFile)}`;
    } catch (error) {
      return `Error undoing moves: ${error}`;
    }
  },
});
