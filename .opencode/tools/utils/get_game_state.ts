import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCP_DIR = "/Users/matthiasmatt/Library/Application Support/Steam/steamapps/common/Baba Is You/Baba Is You.app/Contents/Resources/Data/baba_is_eval";

export async function getGameState(): Promise<string> {
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "python", "game_mcp.py"],
    cwd: MCP_DIR,
  });

  const client = new Client(
    {
      name: "baba-is-agent",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  
  const result = await client.callTool({
    name: "get_game_state",
    arguments: {},
  });
  
  await client.close();
  
  // @ts-ignore
  if (result.content && result.content[0] && result.content[0].type === "text") {
    // @ts-ignore
    return result.content[0].text;
  }
  return "";
}

// Only run if called directly
// @ts-ignore
if (import.meta.main) {
  const result = await getGameState();
  console.log(result);
}
