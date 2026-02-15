import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";

async function getGameRules(): Promise<string> {
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "python", "game_mcp.py"],
    cwd: MCP_DIR,
  });

  const client = new Client(
    { name: "baba-is-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  const result = await client.callTool({
    name: "game_rules",
    arguments: { topic: "basic" },
  });

  await client.close();

  if (result.content && result.content[0].type === "text") {
    return result.content[0].text;
  }
  return "";
}

const result = await getGameRules();
console.log(result);
