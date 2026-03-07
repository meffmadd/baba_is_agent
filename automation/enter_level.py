#!/usr/bin/env python3
"""
Enter a specific level from overworld using pyautogui.
First resets to level 0, then navigates to target level.

Usage:
    uv run python -m automation.enter_level --level 1
"""

import argparse

from automation.config import LEVEL_MOVES, RESET_TO_LEVEL_0
from automation.gui_controller import (
    press_key_pyautogui,
    set_verbose,
)

_verbose = False


def set_verbose_wrapper(verbose: bool):
    """Set verbose logging."""
    global _verbose
    _verbose = verbose
    set_verbose(verbose)


def _log(message: str):
    """Log message if verbose mode is enabled."""
    if _verbose:
        print(f"[enter_level] {message}")


def reset_to_level_0(verbose: bool = False) -> bool:
    """Reset cursor to level 0 position by pressing moves directly.

    Returns:
        True if successful, False otherwise
    """
    _log("Resetting to level 0 position...")
    print("Resetting to level 0 position...")

    try:
        # Execute the reset move sequence directly with pyautogui
        # Each move gets 0.1s hold + 0.5s pyautogui pause + 1.0s delay = 1.6s total per move
        for move in RESET_TO_LEVEL_0:
            if not press_key_pyautogui(move, delay=1.0, hold_duration=0.1):
                print(f"Warning: Failed to press {move} during reset")
                return False
        _log(f"Reset sequence completed: {RESET_TO_LEVEL_0}")
        return True
    except Exception as e:
        _log(f"Error during reset: {e}")
        print(f"Error during reset: {e}")
        return False


def enter_level(level: int, verbose: bool = False) -> bool:
    """Navigate from overworld to specific level using pyautogui.

    Args:
        level: Level number (0-7)
        verbose: Enable verbose logging

    Returns:
        True if successful, False otherwise
    """
    set_verbose_wrapper(verbose)

    if level not in LEVEL_MOVES:
        print(f"Error: Unknown level {level}")
        return False

    # First reset to known position
    if not reset_to_level_0(verbose):
        print("Warning: Reset may have failed")

    # Navigate to target level
    moves = LEVEL_MOVES[level]
    print(f"Navigating to level {level} via moves: {moves}")
    _log(f"Navigating to level {level} with moves: {moves}")
    try:
        # Each move gets 0.1s hold + 0.5s pyautogui pause + 1.0s delay = 1.6s total per move
        for move in moves:
            if not press_key_pyautogui(move, delay=1.0, hold_duration=0.1):
                print(f"Warning: Failed to press {move} during navigation")
                return False
    except Exception as e:
        _log(f"Error during navigation: {e}")
        print(f"Error during navigation: {e}")
        return False

    # Press Enter to enter level
    print("Entering level...")
    if not press_key_pyautogui("enter", delay=0.5, hold_duration=0.1):
        print("Error: Failed to press Enter")
        return False
    print(f"Should now be in level {level}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Enter a level from overworld")
    parser.add_argument("--level", type=int, required=True, help="Level number (0-7)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    args = parser.parse_args()

    success = enter_level(args.level, verbose=args.verbose)
    if not success:
        exit(1)


if __name__ == "__main__":
    main()
