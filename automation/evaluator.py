#!/usr/bin/env python3
"""
Full automation pipeline for Baba Is You solver.
Orchestrates: game start -> overworld -> level -> solver -> cleanup.

Usage:
    uv run python -m automation.evaluator --level 1 --model opencode/glm-5-free
    uv run python -m automation.evaluator --level 0-7 --model opencode/glm-5-free
"""

import argparse
import subprocess
import time
import sys
import shutil
from pathlib import Path
from typing import List, Dict, Any

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


def parse_levels(range_str: str) -> List[int]:
    """Parse level string into list of level numbers.

    Args:
        range_str: Level spec (e.g., "1" or "0-7")

    Returns:
        List of level numbers

    Raises:
        ValueError: Invalid format or bounds
    """
    if "-" in range_str:
        parts = range_str.split("-")
        if len(parts) != 2:
            raise ValueError(f"Invalid range format: {range_str}")
        try:
            start = int(parts[0])
            end = int(parts[1])
        except ValueError:
            raise ValueError(f"Invalid numbers in range: {range_str}")
        if start < 0 or end < 0:
            raise ValueError(f"Level numbers cannot be negative: {range_str}")
        if start > end:
            raise ValueError(f"Start level > end level: {range_str}")
        return list(range(start, end + 1))
    else:
        try:
            level = int(range_str)
        except ValueError:
            raise ValueError(f"Invalid level number: {range_str}")
        if level < 0:
            raise ValueError(f"Level number cannot be negative: {range_str}")
        return [level]


def print_summary_table(results: List[Dict[str, Any]]):
    """Print summary table of evaluation results.

    Args:
        results: List of result dicts with level, status, duration keys
    """
    print("\n" + "=" * 50)
    print("=== Evaluation Summary ===")
    print("-" * 50)

    print(f"{'Level':<6} | {'Status':<10} | {'Duration':<10}")
    print("-" * 35)

    for result in results:
        level = result["level"]
        status = result["status"]
        duration = result["duration"]
        if isinstance(duration, (int, float)):
            duration = f"{duration:.1f}s"
        print(f"{level:<6} | {status:<10} | {duration:<10}")

    print("-" * 35)

    won = sum(1 for r in results if r["status"] == "won")
    timeout = sum(1 for r in results if r["status"] == "timeout")
    error = sum(1 for r in results if r["exit_code"] in (2, 3))

    print(f"\nTotal: {len(results)} | Won: {won} | Timeout: {timeout} | Error: {error}")
    print("=" * 50)


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
) -> Dict[str, Any]:
    """Run full automation pipeline for a level.

    Args:
        level: Level number to solve
        model: Model to use (provider/model format)
        timeout: Solver timeout in seconds
        no_shutdown: Don't kill game process after completion
        verbose: Enable verbose logging

    Returns:
        Dict with status, exit_code, duration, results_dir, level
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
        return {
            "level": int(level),
            "status": "window_not_found",
            "exit_code": 3,
            "duration": 0,
            "results_dir": None,
        }

    # Give game time to fully initialize - splash screen needs to be ready
    print("Game window detected, waiting 5s for initialization...")
    time.sleep(5)

    # Get to overworld
    print("Navigating to overworld...")
    if not enter_overworld(verbose=verbose):
        print("Error: Failed to enter overworld")
        game_process.terminate()
        return {
            "level": int(level),
            "status": "error",
            "exit_code": 2,
            "duration": 0,
            "results_dir": None,
        }

    # Wait for overworld to fully load
    time.sleep(2)

    # Enter target level
    print(f"Entering level {level}...")
    if not enter_level(int(level), verbose=verbose):
        print("Error: Failed to enter level")
        game_process.terminate()
        return {
            "level": int(level),
            "status": "error",
            "exit_code": 2,
            "duration": 0,
            "results_dir": None,
        }

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
    if solver_result.get("error"):
        print(f"Error: {solver_result['error']}")
    print(f"Duration: {solver_result['duration']}")
    print(f"Results: {solver_result['results_dir']}")

    exit_code = 0
    if solver_result["status"] == "won":
        exit_code = 0
    elif solver_result["status"] == "timeout":
        exit_code = 1
    else:
        exit_code = 2

    return {
        "level": int(level),
        "status": solver_result["status"],
        "exit_code": exit_code,
        "duration": solver_result["duration"],
        "results_dir": solver_result["results_dir"],
        "error": solver_result.get("error"),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Full automation pipeline for Baba Is You solver"
    )
    parser.add_argument(
        "--level", required=True, help="Level number or range (e.g., 1 or 0-7)"
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

    try:
        levels = parse_levels(args.level)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    results = []
    all_won = True

    for level in levels:
        result = evaluate_level(
            level=str(level),
            model=args.model,
            timeout=args.timeout,
            no_shutdown=args.no_shutdown,
            verbose=args.verbose,
        )
        results.append(result)

        # Stop on error or window failure
        if result["exit_code"] in (2, 3):
            print(f"\nFatal error at level {level}, stopping evaluation")
            all_won = False
            break

        # Mark not all won if timeout or error
        if result["exit_code"] != 0:
            all_won = False

    # Print summary table for multiple levels
    if len(levels) > 1:
        print_summary_table(results)

    # Exit code: 0 if all won, 1 otherwise
    sys.exit(0 if all_won else 1)


if __name__ == "__main__":
    main()
