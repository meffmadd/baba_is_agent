import type { Plugin } from "@opencode-ai/plugin";

export const GameUpdaterPlugin: Plugin = async ({ directory }) => {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "baba_is_you_execute_commands") return;

      const worktree = directory;
      const scriptPath = `${worktree}/.opencode/tools/utils/get_game_state.ts`;

      try {
        const gameState = await Bun.$`bun run ${scriptPath}`.text();
        console.log("Game updated after move:", gameState);
      } catch (error) {
        console.error("Failed to update game state:", error);
      }
    },
  };
};
