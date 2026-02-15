import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";

const HELP_RULES_PATH = path.join(process.cwd(), "..", "help_rules.json");

interface RuleInfo {
  title: string;
  content: string;
}

interface RulesData {
  [key: string]: RuleInfo;
}

export default tool({
  description:
    "Get help on Baba Is You game rules. Use 'basic' for general rules, or specify a rule name like 'stop', 'push', 'win', etc. for specific explanations.",
  args: {
    topic: tool.schema.string().optional().describe("Rule topic to explain (e.g., 'basic', 'stop', 'push', 'win', 'you', 'defeat'). Default: 'basic'"),
  },
  async execute(args: { topic?: string }) {
    try {
      const topic = (args.topic || "basic").toLowerCase();
      
      // Read help rules from JSON file
      const rulesData: RulesData = JSON.parse(fs.readFileSync(HELP_RULES_PATH, "utf-8"));
      
      // Check if topic exists
      if (!rulesData[topic]) {
        const availableTopics = Object.keys(rulesData).join(", ");
        return `Unknown topic '${topic}'. Available topics are: ${availableTopics}`;
      }
      
      const ruleInfo = rulesData[topic];
      return `${ruleInfo.title}\n\n${ruleInfo.content}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return `Help rules file not found at ${HELP_RULES_PATH}`;
      }
      return `Error reading help rules: ${error}`;
    }
  },
});
