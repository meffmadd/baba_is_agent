#!/usr/bin/env python3
"""
Get to overworld from game startup screen.
Wait for game to load, then press Enter twice using pyautogui.

Usage:
    uv run python -m automation.enter_overworld
"""

import argparse
import time
from automation.gui_controller import (
    press_key_pyautogui,
    set_verbose,
)


def enter_overworld(verbose: bool = False) -> bool:
    """Navigate from startup screen to overworld.

    Args:
        verbose: Enable verbose logging

    Returns:
        True if successful, False otherwise
    """
    set_verbose(verbose)

    if verbose:
        print("Pressing Enter twice to enter overworld...")
    if not press_key_pyautogui("enter", delay=1.5, hold_duration=0.2):
        print("Error: Failed to press first Enter")
        return False
    if not press_key_pyautogui("enter", delay=1.5, hold_duration=0.2):
        print("Error: Failed to press second Enter")
        return False

    print("Should now be in overworld")
    return True


def main():
    parser = argparse.ArgumentParser(description="Navigate to overworld")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    args = parser.parse_args()

    success = enter_overworld(verbose=args.verbose)
    if not success:
        exit(1)


if __name__ == "__main__":
    main()
