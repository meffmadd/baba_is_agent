#!/usr/bin/env python3
"""
Configuration constants for Baba Is You automation.
"""

from pathlib import Path


# Model defaults
DEFAULT_MODEL = "aqueduct/glm-4.7-355b"
MODEL_PROVIDERS = ["openrouter", "opencode", "anthropic", "openai", "google"]

# Timing
DEFAULT_TIMEOUT = 900  # 15 minutes
DEFAULT_TOKEN_BUDGET = 100000  # max cumulative tokens before killing solver
WINDOW_WAIT_TIMEOUT = 30  # seconds
STARTUP_DELAY = 2  # seconds after game launch
GAME_INIT_DELAY = 7  # seconds after window detection for game to fully initialize

# Window geometry
GAME_WINDOW_BOUNDS = {
    "x": 0,
    "y": 0,
    "width": 1600,
    "height": 900,
}

# Click positions (relative to window origin)
FOCUS_CLICK_POSITION = (800, 500)
SLOT_1_POSITION = (800, 300)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
RESULTS_DIR = PROJECT_ROOT / "automation" / "results"

STATE_PATH = (
    Path.home()
    / "Library/Application Support/Steam/steamapps/common/Baba Is You"
    / "Baba Is You.app"
    / "Contents/Resources/Data/Worlds/baba"
    / "world_data.txt"
)

COMMANDS_DIR = (
    Path.home()
    / "Library/Application Support/Steam/steamapps/common/Baba Is You"
    / "Baba Is You.app"
    / "Contents/Resources/Data/baba_is_eval/commands"
)

# Reset to level 0 position (from any level)
RESET_TO_LEVEL_0 = ["left", "left", "left", "down", "down", "down", "down", "left"]

# Level navigation sequences (from enter_level tool)
# From level 0 (RESAT_TO_LEVEL_0 position), apply moves to reach target level, then press Enter
RESET_TO_LEVEL_0 = ["left", "left", "left", "down", "down", "down", "down", "left"]

LEVEL_MOVES = {
    0: [],  # Already at level 0 after reset, just press Enter
    1: ["right", "up", "up"],
    2: ["right", "up", "up", "up"],
    3: ["right", "up", "up", "right"],
    4: ["right", "up", "up", "up", "right"],
    5: ["right", "up", "up", "up", "up"],
    6: ["right", "up", "up", "up", "right", "right"],
    7: ["right", "up", "up", "up", "up", "right"],
}
