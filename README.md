<div align="center">
  <img src="./docs/baba_is_agent.png" width="60%" alt="Baba Is Agent Logo" />
</div>

# Baba Is Agent

OpenCode AI agent that plays *[Baba Is You](https://store.steampowered.com/app/736260/Baba_Is_You/)*.

Inspired by the [baba_is_eval](https://github.com/lennart-finke/baba_is_eval) repository.

## Allowed Tools

- **get_game_state** - Get current game state with entities/grid
- **execute_game_commands** - Execute movement commands (up, down, left, right, idle)
- **restart_level** - Restart the current level
- **game_insights** - Analyze game state, rules, positions, and win path
- **shortest_path** - A* pathfinding to target position
- **undo_multiple** - Undo last N moves
- **todowrite** - Track task progress

## Setup

Requires macOS with the Steam version of *Baba is You*.

1. Install the Lua mod:
   ```bash
   ./setup.sh
   ```

## Manual Mode

1. Start the game and enter a level manually:
   ```bash
   python start_game.py
   ```

2. Solve the level:
   ```bash
   opencode run --command solve --agent baba
   ```

## Automated Evaluation

Run full automation (game start → level navigation → solver → cleanup):

```bash
uv run python -m automation.evaluator --level 0-4 --model opencode-go/glm-5.1
```

