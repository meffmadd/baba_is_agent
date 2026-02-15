# Tests for Baba Is You Tools

This directory contains tests for the TypeScript tools in `.opencode/tools/`.

## Quick Start

```bash
# 1. Capture current game state from the running game
cd .opencode
npx tsx tests/capture_state.ts

# 2. Run tests against captured state
npx tsx tests/test_tools.ts
```

## Files

- `capture_state.ts` - Captures the current game state and saves it to `fixtures/`
- `test_tools.ts` - Runs all tool tests against the captured state
- `fixtures/` - Contains saved game states for testing
  - `game_state.txt` - Formatted game state (text grid)
  - `raw_state.json` - Raw grid data as JSON

## Tested Tools

1. **getRules** - Parses active game rules from text objects
2. **getStatePositions** - Finds positions of entities with specific states (YOU, WIN, etc.)
3. **reachableEntities** - Lists all reachable entities from current position
4. **shortestPath** - Finds A* path between positions
5. **gameStateCoords** - Extracts coordinates of all relevant entities

## Adding New Tests

Edit `test_tools.ts` and add new test cases using the `test()` helper:

```typescript
test("my new test", () => {
  assert(condition, "Error message if condition is false");
});
```
