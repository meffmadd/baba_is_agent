#!/usr/bin/env python3
"""
Stage 1: Run solver with timeout, capture trace, check win status.

Usage:
    python automation/run_solver.py --level 1 --model opencode/glm-5-free --timeout 900
"""

import argparse
import json
import os
import select
import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime
from automation.config import DEFAULT_TOKEN_BUDGET
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


def format_event_console(event: Dict[str, Any]) -> str:
    """Format an NDJSON event for simplified console output."""
    event_type = event.get("type", "unknown")
    part = event.get("part", {})

    if event_type == "step_start":
        return f"[START] step"

    elif event_type == "tool_use":
        tool_name = part.get("tool", "unknown")
        state = part.get("state", {})
        status = state.get("status", "unknown")
        status_symbol = (
            "✓" if status == "completed" else "✗" if status == "error" else "..."
        )
        return f"[TOOL] {tool_name} {status_symbol}"

    elif event_type == "text":
        text = part.get("text", "")
        if len(text) > 100:
            text = text[:100] + "..."
        return f"[TEXT] {text}"

    elif event_type == "step_finish":
        tokens = part.get("tokens", {})
        total = tokens.get("total", 0)
        cost = part.get("cost", 0.0)
        reason = part.get("reason", "")
        return f"[DONE] {reason} | tokens: {total:,} | cost: ${cost:.4f}"

    elif event_type == "message_start":
        return f"[MSG_START]"

    elif event_type == "message_end":
        return f"[MSG_END]"

    elif event_type == "error":
        return f"[ERROR] {part.get('text', 'Unknown error')}"

    return f"[{event_type.upper()}]"


def run_solver(
    level: str, model: str, timeout: int, token_budget: int = DEFAULT_TOKEN_BUDGET
) -> Dict[str, Any]:
    """Run the solver with timeout and capture results.

    Args:
        level: Level number to solve
        model: Model to use (provider/model format)
        timeout: Timeout in seconds
        token_budget: Max cumulative tokens before killing the solver

    Returns:
        Dictionary with run results and metadata
    """
    commit_hash = get_commit_hash()
    model_sanitized = sanitize_model_name(model)
    timestamp = datetime.utcnow().strftime("%Y-%m-%d_%H-%M-%S")
    results_dir = (
        Path(__file__).parent
        / "results"
        / model_sanitized
        / f"level_{level}_{commit_hash}_{timestamp}"
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
    cumulative_tokens = 0

    trace_path = results_dir / "trace.jsonl"
    trace_file = open(trace_path, "w")

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=Path(__file__).parent.parent,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )

        start_time = time.time()

        while True:
            if timeout and (time.time() - start_time) > timeout:
                process.kill()
                error = f"Timeout after {timeout} seconds"
                won = False
                break

            if token_budget and cumulative_tokens > token_budget:
                process.kill()
                error = (
                    f"Token budget exceeded: {cumulative_tokens:,} / {token_budget:,}"
                )
                won = False
                break

            if process.stdout is None:
                break

            ready, _, _ = select.select([process.stdout], [], [], 1.0)

            if ready:
                line = process.stdout.readline()
                if not line:
                    break

                if line.strip():
                    try:
                        event = json.loads(line)
                        trace_events.append(event)
                        trace_file.write(line)
                        trace_file.flush()

                        if event.get("type") == "step_finish":
                            cumulative_tokens = (
                                event.get("part", {}).get("tokens", {}).get("total", 0)
                            )

                        console_output = format_event_console(event)
                        print(console_output, flush=True)

                        if event.get("type") == "error":
                            error_msg = event.get("error", {}).get("data", {}).get(
                                "message"
                            ) or event.get("part", {}).get("text", "")
                            if error_msg:
                                error = error_msg

                        if event.get("type") == "tool_use":
                            tool_name = event.get("part", {}).get("tool", "")
                            output = (
                                event.get("part", {}).get("state", {}).get("output", "")
                            )
                            if output:
                                try:
                                    win_data = json.loads(output)
                                    if (
                                        win_data.get("won")
                                        or win_data.get("data", {}).get("won")
                                        or win_data.get("level_won")
                                    ):
                                        won = True
                                except json.JSONDecodeError:
                                    pass
                    except json.JSONDecodeError:
                        pass

            if process.poll() is not None:
                break

    except subprocess.TimeoutExpired:
        error = f"Timeout after {timeout} seconds"
        won = False
    except Exception as e:
        error = str(e)
        won = False
    finally:
        trace_file.close()

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
    if won:
        status = "won"
    elif "Token budget" in str(error):
        status = "token_budget"
    elif "Timeout" in str(error):
        status = "timeout"
    elif error:
        status = "error"
    else:
        status = "not_won"

    # Write run.json
    run_data = {
        "level": f"level_{level}",
        "model": model,
        "model_sanitized": model_sanitized,
        "commit_hash": commit_hash,
        "timestamp_start": timestamp_start,
        "timestamp_end": timestamp_end,
        "timeout_seconds": timeout,
        "token_budget": token_budget,
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
        "duration": duration_seconds,
        "results_dir": str(results_dir),
        "won": won,
        "error": error,
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
    parser.add_argument(
        "--token-budget",
        type=int,
        default=DEFAULT_TOKEN_BUDGET,
        help=f"Max cumulative tokens before killing solver (default: {DEFAULT_TOKEN_BUDGET})",
    )

    args = parser.parse_args()

    result = run_solver(
        level=args.level,
        model=args.model,
        timeout=args.timeout,
        token_budget=args.token_budget,
    )

    print(f"Solver completed: {result['status']}")
    print(f"Results saved to: {result['results_dir']}")

    sys.exit(0 if result["won"] else 1)


if __name__ == "__main__":
    main()
