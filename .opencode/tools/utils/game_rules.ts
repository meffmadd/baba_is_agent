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

export function getGameRules(topic: string = "basic"): string {
  try {
    const topicLower = topic.toLowerCase();

    const rulesData: RulesData = JSON.parse(fs.readFileSync(HELP_RULES_PATH, "utf-8"));

    if (!rulesData[topicLower]) {
      const availableTopics = Object.keys(rulesData).join(", ");
      return `Unknown topic '${topicLower}'. Available topics are: ${availableTopics}`;
    }

    const ruleInfo = rulesData[topicLower];
    return `${ruleInfo.title}\n\n${ruleInfo.content}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return `Help rules file not found at ${HELP_RULES_PATH}`;
    }
    return `Error reading help rules: ${error}`;
  }
}