#!/usr/bin/env python3
"""
Stage 1: Run solver with timeout, capture trace, check win status.

Usage:
    python automation/run_solver.py --level 1 --model opencode/glm-5-free --timeout 900
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


def get_commit_hash() -> str:
    """Get the first 7 characters of the current git commit hash."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=Path(__file__).parent.parent,
        )
        return result.stdout.strip()[:7]
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return "unknown"


def sanitize_model_name(model: str) -> str:
    """Sanitize model name for directory naming.

    Example: "opencode/glm-5-free" -> "glm-5-free"
    """
    return model.replace("opencode/", "").replace("/", "-")


def run_solver(level: str, model: str, timeout: int) -> Dict[str, Any]:
    """Run the solver with timeout and capture results.

    Args:
        level: Level number to solve
        model: Model to use (provider/model format)
        timeout: Timeout in seconds

    Returns:
        Dictionary with run results and metadata
    """
    commit_hash = get_commit_hash()
    model_sanitized = sanitize_model_name(model)
    results_dir = (
        Path(__file__).parent
        / "results"
        / f"level_{level}_{model_sanitized}_{commit_hash}"
    )
    results_dir.mkdir(parents=True, exist_ok=True)

    timestamp_start = datetime.utcnow().isoformat() + "Z"

    # Build opencode command
    cmd = [
        "opencode",
        "run",
        "--command",
        "solve",
        "--agent",
        "baba",
        "--model",
        model,
        "--format",
        "json",
    ]

    # Run solver
    trace_events = []
    won = False
    error = None

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=Path(__file__).parent.parent,
        )

        # Parse NDJSON output line by line
        for line in result.stdout.splitlines():
            if line.strip():
                try:
                    event = json.loads(line)
                    trace_events.append(event)

                    # Check for win status in tool_use events
                    if (
                        event.get("type") == "tool_use"
                        and event.get("part", {}).get("tool") == "check_win_status"
                    ):
                        output = (
                            event.get("part", {}).get("state", {}).get("output", "")
                        )
                        if output:
                            try:
                                win_data = json.loads(output)
                                won = win_data.get("won", False)
                            except json.JSONDecodeError:
                                pass
                except json.JSONDecodeError:
                    pass

        # Write trace.jsonl
        trace_path = results_dir / "trace.jsonl"
        with open(trace_path, "w") as f:
            for event in trace_events:
                f.write(json.dumps(event) + "\n")

    except subprocess.TimeoutExpired:
        error = f"Timeout after {timeout} seconds"
        won = False
    except Exception as e:
        error = str(e)
        won = False

    timestamp_end = datetime.utcnow().isoformat() + "Z"

    # Extract metrics from trace
    tokens_input = 0
    tokens_output = 0
    cost_total = 0.0
    tool_calls = 0

    for event in trace_events:
        if event.get("type") == "step_finish":
            part = event.get("part", {})
            tokens = part.get("tokens", {})
            tokens_input += tokens.get("input", 0)
            tokens_output += tokens.get("output", 0)
            cost_total += part.get("cost", 0.0)
        elif event.get("type") == "tool_use":
            tool_calls += 1

    # Determine status
    status = (
        "won"
        if won
        else ("timeout" if "Timeout" in str(error) else "error" if error else "not_won")
    )

    # Write run.json
    run_data = {
        "level": f"level_{level}",
        "model": model,
        "model_sanitized": model_sanitized,
        "commit_hash": commit_hash,
        "timestamp_start": timestamp_start,
        "timestamp_end": timestamp_end,
        "timeout_seconds": timeout,
        "status": status,
        "cost_total": cost_total,
        "tokens_total": tokens_input + tokens_output,
        "tokens_input": tokens_input,
        "tokens_output": tokens_output,
        "tool_calls": tool_calls,
        "error": error,
    }

    with open(results_dir / "run.json", "w") as f:
        json.dump(run_data, f, indent=2)

    # Write summary.md
    duration_seconds = (
        datetime.fromisoformat(timestamp_end.rstrip("Z"))
        - datetime.fromisoformat(timestamp_start.rstrip("Z"))
    ).total_seconds()

    summary = f"""# Level {level} - {model_sanitized}

**Status**: {"Won" if won else "Not Won"}
**Duration**: {duration_seconds:.0f}s
**Cost**: ${cost_total:.2f}
**Tokens**: {tokens_input + tokens_output:,} (input: {tokens_input:,}, output: {tokens_output:,})
**Tool Calls**: {tool_calls}
**Commit**: {commit_hash}

## Timeline

- {timestamp_start} - Started
"""

    if trace_events:
        first_tool = next(
            (e for e in trace_events if e.get("type") == "tool_use"), None
        )
        if first_tool:
            first_tool_time = datetime.fromtimestamp(
                first_tool.get("timestamp", 0) / 1000
            )
            summary += f"- {first_tool_time.strftime('%H:%M:%S')} - First tool call: {first_tool.get('part', {}).get('tool', 'unknown')}\n"

    summary += f"- {timestamp_end} - Completed\n"

    if error:
        summary += f"\n## Error\n{error}\n"

    with open(results_dir / "summary.md", "w") as f:
        f.write(summary)

    return {
        "status": status,
        "duration": f"{duration_seconds:.0f}s",
        "results_dir": str(results_dir),
        "won": won,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Run solver with timeout and capture results"
    )
    parser.add_argument(
        "--level", required=True, help="Level number to solve (e.g., 1, 2, 3)"
    )
    parser.add_argument(
        "--model",
        default="opencode/glm-5-free",
        help="Model to use (default: opencode/glm-5-free)",
    )
    parser.add_argument(
        "--timeout", type=int, default=900, help="Timeout in seconds (default: 900)"
    )

    args = parser.parse_args()

    result = run_solver(level=args.level, model=args.model, timeout=args.timeout)

    print(f"Solver completed: {result['status']}")
    print(f"Results saved to: {result['results_dir']}")

    sys.exit(0 if result["won"] else 1)


if __name__ == "__main__":
    main()
