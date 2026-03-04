#!/usr/bin/env python3
"""
Full automation pipeline for Baba Is You solver.
Orchestrates: game start -> overworld -> level -> solver -> cleanup.

Usage:
    uv run python -m automation.evaluator --level 1 --model opencode/glm-5-free
"""

import argparse
import subprocess
import time
import sys
import shutil
from pathlib import Path

from automation.config import (
    DEFAULT_MODEL,
    DEFAULT_TIMEOUT,
    WINDOW_WAIT_TIMEOUT,
    COMMANDS_DIR,
)
from automation.gui_controller import (
    wait_for_window,
    press_key_pyautogui,
    set_verbose,
    reset_game_process_name,
)
from automation.enter_overworld import enter_overworld
from automation.enter_level import enter_level
from automation.run_solver import run_solver


def start_game():
    """Start the game process."""
    print("Starting game...")
    return subprocess.Popen(
        ["uv", "run", "python", "start_game.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def kill_game():
    """Kill any running game instances."""
    import subprocess

    try:
        subprocess.run(["pkill", "-f", "Chowdren"], check=False, capture_output=True)
        time.sleep(1)
    except Exception:
        pass


def clear_commands():
    """Clear old command files."""
    if COMMANDS_DIR.exists():
        shutil.rmtree(COMMANDS_DIR)
    COMMANDS_DIR.mkdir(parents=True, exist_ok=True)
    print("Cleared old command files")


def evaluate_level(
    level: str,
    model: str = DEFAULT_MODEL,
    timeout: int = DEFAULT_TIMEOUT,
    no_shutdown: bool = False,
    verbose: bool = False,
) -> int:
    """Run full automation pipeline for a level.

    Args:
        level: Level number to solve
        model: Model to use (provider/model format)
        timeout: Solver timeout in seconds
        no_shutdown: Don't kill game process after completion
        verbose: Enable verbose logging

    Returns:
        Exit code (0=success, 1=timeout, 2=error, 3=window not found)
    """
    set_verbose(verbose)

    print(f"=== Evaluating level {level} with model {model} ===")

    # Kill any existing game instances
    kill_game()
    reset_game_process_name()

    # Clear old commands
    clear_commands()

    # Start game
    game_process = start_game()

    # Wait for window
    print("Waiting for game window...")
    if not wait_for_window(WINDOW_WAIT_TIMEOUT):
        print("Error: Game window not found")
        game_process.terminate()
        return 3

    # Give game time to fully initialize - splash screen needs to be ready
    print("Game window detected, waiting 5s for initialization...")
    time.sleep(5)

    # Get to overworld
    print("Navigating to overworld...")
    if not enter_overworld(verbose=verbose):
        print("Error: Failed to enter overworld")
        game_process.terminate()
        return 2

    # Wait for overworld to fully load
    time.sleep(2)

    # Enter target level
    print(f"Entering level {level}...")
    if not enter_level(int(level), clear_commands=False, verbose=verbose):
        print("Error: Failed to enter level")
        game_process.terminate()
        return 2

    # Wait for level to load
    time.sleep(2)

    # Run solver
    print("Running solver...")
    solver_result = run_solver(level, model, timeout)

    # Cleanup
    print("Exiting level...")
    if not press_key_pyautogui("escape"):
        print("Warning: Failed to press Escape to exit level")
    time.sleep(1)

    # Shutdown (optional)
    if not no_shutdown:
        print("Shutting down game...")
        game_process.terminate()
        game_process.wait()

    # Report results
    print(f"\n=== Evaluation Complete ===")
    print(f"Status: {solver_result['status']}")
    print(f"Duration: {solver_result['duration']}")
    print(f"Results: {solver_result['results_dir']}")

    if solver_result["status"] == "won":
        return 0
    elif solver_result["status"] == "timeout":
        return 1
    else:
        return 2


def main():
    parser = argparse.ArgumentParser(
        description="Full automation pipeline for Baba Is You solver"
    )
    parser.add_argument(
        "--level", required=True, help="Level number to solve (e.g., 1, 2, 3)"
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Model to use (default: {DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"Solver timeout in seconds (default: {DEFAULT_TIMEOUT})",
    )
    parser.add_argument(
        "--no-shutdown",
        action="store_true",
        help="Don't kill game process after completion",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    exit_code = evaluate_level(
        level=args.level,
        model=args.model,
        timeout=args.timeout,
        no_shutdown=args.no_shutdown,
        verbose=args.verbose,
    )

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
