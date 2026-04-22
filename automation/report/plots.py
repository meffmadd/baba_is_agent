#!/usr/bin/env python3
"""
Plotting utilities for evaluation reports.

Uses matplotlib and seaborn. Install with:
    uv sync --extra reporting
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
import seaborn as sns

REPORT_DIR = Path(__file__).parent


def parse_trace(trace_path: Path) -> tuple[list[int], list[int]]:
    """Parse trace.jsonl and return cumulative tool_calls and tokens per step."""
    tool_calls = []
    tokens = []
    current_tool_calls = 0
    current_tokens = 0

    with trace_path.open("r") as f:
        for line in f:
            event = json.loads(line)

            if event.get("type") == "tool_use":
                current_tool_calls += 1

            elif event.get("type") == "step_finish":
                tokens_data = event.get("part", {}).get("tokens", {})
                current_tokens += tokens_data.get("input", 0)
                current_tokens += tokens_data.get("output", 0)
                tool_calls.append(current_tool_calls)
                tokens.append(current_tokens)

    # Traces often end mid-step (no step_finish after winning).
    # Append final state so last tool calls aren't lost.
    if current_tool_calls > 0 and (not tool_calls or tool_calls[-1] != current_tool_calls):
        tool_calls.append(current_tool_calls)
        tokens.append(current_tokens)

    # Always start from (0, 0) so short runs don't look weird.
    if tool_calls:
        tool_calls.insert(0, 0)
        tokens.insert(0, 0)

    return tool_calls, tokens


def generate_level_progress_plots(runs: list[dict]) -> list[Path]:
    """Generate per-level progress plots showing cumulative tokens vs tool calls."""
    sns.set_theme(style="whitegrid")
    saved_paths = []

    for level in sorted({run["level"] for run in runs}):
        level_runs = [run for run in runs if run["level"] == level]

        plt.figure(figsize=(10, 6))

        for run in level_runs:
            trace_path = Path(run["_run_dir"]) / "trace.jsonl"
            tool_calls, tokens = parse_trace(trace_path)
            plt.plot(tool_calls, tokens, marker="o", markersize=4, alpha=0.7)

        plt.xlabel("# Tool Calls")
        plt.ylabel("Cumulative Tokens")
        plt.title(f"{level}: Cumulative Tokens vs Tool Calls")
        plt.tight_layout()

        plot_path = REPORT_DIR / f"{level}_progress.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        plt.close()

        saved_paths.append(plot_path)
        print(f"Plot saved: {plot_path}")

    return saved_paths
