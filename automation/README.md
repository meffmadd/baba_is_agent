# Baba Is Agent Automation

Automated evaluation pipeline for running the Baba Is You solver agent.

## Quick Start

Run automation scripts as Python modules (required for import paths):

```bash
# Start game manually first
python start_game.py

# Get to overworld from startup screen
uv run -m automation.enter_overworld

# Enter a specific level (1-7)
uv run -m automation.enter_level --level 1

# Run solver on current level
uv run -m automation.run_solver --level 1 --model openrouter/anthropic/claude-opus-4.6

# Full pipeline (all steps automated)
uv run -m automation.evaluator --level 1

# Manual full pipeline (start game + navigate to level)
uv run python start_game.py & sleep 5 && uv run python -m automation.enter_overworld --verbose && sleep 2 && uv run python -m automation.enter_level --level 1 --verbose
```

## Requirements

### macOS Accessibility Permissions

The automation uses `pyautogui` for keyboard input, which requires macOS accessibility permissions:

1. Open **System Settings → Privacy & Security → Accessibility**
2. Add:
   - Terminal (or your shell app)
   - Python (`/Library/Frameworks/Python.framework/.../bin/python*`)
   - Or `uv` if using `uv run`
3. Test with: `python3 -c "import pyautogui; pyautogui.press('enter'); print('OK')"`

### Dependencies

```bash
uv pip install pyautogui
```

## Current Status

### Working
- `enter_overworld.py` - Navigates from startup screen to overworld (uses pyautogui)
- `enter_level.py` - Select level from overworld (reads last_processed from world_data.txt, uses pyautogui)
- `run_solver.py` - Runs solver agent with timeout and result capture
- `evaluator.py` - Full pipeline orchestration

## Architecture

Modular design for easy debugging:

1. **`enter_overworld.py`** - Get to overworld from startup screen (wait 5s, click to focus, pyautogui.press x2)
2. **`enter_level.py`** - Select level from overworld (clear commands, reset to 0, navigate, pyautogui.press x3)
3. **`run_solver.py`** - Run solver with timeout, capture trace, check win
4. **`evaluator.py`** - Full pipeline orchestration

## Files

| File | Purpose |
|------|---------|
| `config.py` | Constants: default model, timeout, paths, level navigation moves |
| `gui_controller.py` | Window management + keyboard input (osascript) |
| `enter_overworld.py` | Navigate from startup to overworld |
| `enter_level.py` | Select level from overworld |
| `run_solver.py` | Run `/solve` command, capture JSON trace |
| `evaluator.py` | Full automation orchestration |

## Command File System

The game reads Lua command files from:
```
Data/baba_is_eval/commands/{N}.lua
```

### How It Works
1. Game maintains `last_processed` counter in `world_data.txt`
2. Game polls for file `{last_processed + 1}.lua` every ~1 second
3. When found, executes commands and increments counter
4. Commands are written as: `command("right", 1)`

### Implementation
`enter_level.py` correctly reads `last_processed` from `world_data.txt` and writes
command files starting from `last_processed + 1`. It also clears old command files
when called standalone to ensure clean state.

## Testing (Step by Step)

### 1. Start game manually
```bash
python start_game.py
```

### 2. Get to overworld
```bash
uv run python -m automation.enter_overworld
```
- Waits 5s for game to load
- Focuses window via osascript click
- Presses Enter twice (0.5s delay)

### 3. Enter a level
```bash
uv run python -m automation.enter_level --level 1
```
- Clears old command files
- Resets cursor to level 0 position (8 moves)
- Navigates to target level (3 moves for level 1)
- Presses Enter 3 times to enter

### 4. Run solver (game already in level)
```bash
uv run python -m automation.run_solver --level 1 --model opencode/glm-5-free
```

### Full Pipeline (all steps automated)
```bash
uv run python -m automation.evaluator --level 1
```

## GUI Controller Functions

### Window Management
```python
find_game_window() -> bool              # Check if game running
wait_for_window(timeout=30) -> bool     # Poll for window
position_window(x, y, w, h) -> bool     # Set window bounds
focus_game() -> bool                    # Click window center
```

### Keyboard Input
```python
press_key_code(key_code: int) -> bool   # Press key by macOS code

KEY_CODES = {
    "enter": 36,
    "escape": 53,
    "up": 126,
    "down": 125,
    "left": 123,
    "right": 124,
}
```

## Results

Each run creates a directory: `results/{level}_{model}_{commit_hash}/`

```
results/level_1_glm-5-free_a1b2c3d/
├── run.json       # Metadata: level, model, status, tokens, cost
├── trace.jsonl    # Full NDJSON trace from opencode
└── summary.md     # Human-readable summary
```

**Status values**: `won`, `timeout`, `error`, `not_won`

## Exit Codes

| Code | run_solver.py | evaluator.py |
|------|---------------|--------------|
| 0 | Level won | Level won |
| 1 | Not won | Timeout |
| 2 | - | Error |
| 3 | - | Window not found |

## Level Navigation

From `config.py`:
```python
RESET_TO_LEVEL_0 = ["left", "left", "left", "down", "down", "down", "down", "left"]

LEVEL_MOVES = {
    1: ["right", "up", "up"],
    2: ["right", "up", "up", "up"],
    3: ["right", "up", "up", "right"],
    4: ["right", "up", "up", "up", "right"],
    5: ["right", "up", "up", "up", "up"],
    6: ["right", "up", "up", "up", "right", "right"],
    7: ["right", "up", "up", "up", "up", "right"],
}
```

macOS only (uses osascript for window control and keyboard input).