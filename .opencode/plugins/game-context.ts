import type { Plugin } from "@opencode-ai/plugin";

let gameRules = "";

export const GameContextPlugin: Plugin = async ({ directory }) => {
  const worktree = directory;
  const getGameStateScript = `${worktree}/.opencode/tools/utils/get_game_state.ts`;
  const getGameRulesScript = `${worktree}/.opencode/tools/utils/get_game_rules.ts`;

  return {
    "session.created": async () => {
      try {
        gameRules = await Bun.$`bun run ${getGameRulesScript}`.text();
        console.log("[game-context] Loaded game rules");
      } catch (e) {
        console.error("[game-context] Failed to load game rules:", e);
      }
    },
    "experimental.session.compacting": async (input, output) => {
      try {
        const currentState = await Bun.$`bun run ${getGameStateScript}`.text();
        output.context.push(`
## Game Rules Help
${gameRules}

## Current Game State
\`\`\`
${currentState}
\`\`\`
        `);
      } catch (e) {
        console.error("[game-context] Failed to get game state:", e);
        output.context.push(`## Game Rules Help\n${gameRules}`);
      }
    },
  };
};
