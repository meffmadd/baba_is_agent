# AGENTS.md - Baba Is Agent

OpenCode AI agent that plays "Baba Is You" using TypeScript tools.

## Quick Start

```bash
./setup.sh                    # One-command setup
python start_game.py          # Start game (terminal 1)
opencode run "solve the level" --agent baba  # Run agent (terminal 2)
```

## Development

```bash
cd .opencode
npx tsx tests/capture_state.ts  # Update fixtures
npx tsx tests/test_tools.ts     # Run tests
npx tsc --noEmit                # Type check
```

## Tools

All tools fetch game state automatically. Key tools:

- **game_insights** - Analyze game state, rules, positions
- **execute_game_commands** - Run moves (up, down, left, right, undo)
- **shortest_path** - A* pathfinding to target
- **check_win_status** - Check level completion
- **restart_level** / **undo_multiple** - Level control
- **enter_level** / **leave_level** - Navigate levels

## Project Structure

```
.opencode/tools/     # TypeScript tools
.opencode/agents/    # Agent config
lua/io.lua           # Game integration mod
start_game.py        # Game launcher
```

## Code Style

TypeScript with strict types. Files: `snake_case.ts`, Functions: `camelCase`, Types: `PascalCase`.

## OpenCode Docs

- [Tools](https://opencode.ai/docs/tools/) - Built-in tools
- [Custom Tools](https://opencode.ai/docs/custom-tools/) - Create your own
- [Agents](https://opencode.ai/docs/agents/) - Agent configuration
- [Commands](https://opencode.ai/docs/commands/) - Slash commands
- [Permissions](https://opencode.ai/docs/permissions/) - Security settings
- [Config](https://opencode.ai/docs/config/) - Configuration
