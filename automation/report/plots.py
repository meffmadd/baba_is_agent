#!/usr/bin/env python3
"""
Plotting utilities for evaluation reports.

Uses matplotlib and seaborn. Install with:
    uv sync --extra reporting
"""

import json
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

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

    models = sorted({run.get("model", "Unknown") for run in runs})
    palette = sns.color_palette("husl", n_colors=len(models))
    model_colors = dict(zip(models, palette))

    for level in sorted({run["level"] for run in runs}):
        level_runs = [run for run in runs if run["level"] == level]

        fig, ax = plt.subplots(figsize=(10, 6))
        parsed_runs: list[tuple[dict, str, list[int], list[int]]] = []

        for run in level_runs:
            model = run.get("model", "Unknown")
            trace_path = Path(run["_run_dir"]) / "trace.jsonl"
            tool_calls, tokens = parse_trace(trace_path)
            parsed_runs.append((run, model, tool_calls, tokens))
            if tool_calls:
                ax.plot(
                    tool_calls, tokens,
                    color=model_colors[model],
                    marker="o", markersize=4, alpha=0.7,
                    label=model,
                )

        ax.set_xlabel("# Tool Calls")
        ax.set_ylabel("Cumulative Tokens")
        ax.set_title(f"{level}: Cumulative Tokens vs Tool Calls")

        # Secondary axis for win/loss glyphs at final positions
        ax2 = ax.twinx()
        ax2.set_ylim(ax.get_ylim())
        ax2.set_yticks([])
        ax2.spines["right"].set_visible(False)

        has_won = False
        has_lost = False
        has_timeout = False

        for run, model, tool_calls, tokens in parsed_runs:
            if not tool_calls:
                continue
            final_tc = tool_calls[-1]
            final_tok = tokens[-1]
            status = run.get("status", "")
            color = model_colors[model]

            if status == "won":
                ax2.scatter(
                    final_tc, final_tok,
                    marker="*", s=350,
                    color=color, edgecolors="black", linewidths=1.2,
                    zorder=10,
                )
                has_won = True
            elif status == "timeout":
                ax2.scatter(
                    final_tc, final_tok,
                    marker="s", s=150,
                    color=color, edgecolors="black", linewidths=1.2,
                    zorder=10,
                )
                has_timeout = True
            else:
                ax2.scatter(
                    final_tc, final_tok,
                    marker="X", s=150,
                    color=color, edgecolors="black", linewidths=1.2,
                    zorder=10,
                )
                has_lost = True

        # Build custom legend combining models and status glyphs
        handles, labels = ax.get_legend_handles_labels()
        by_label = dict(zip(labels, handles))

        if has_won:
            by_label["Won"] = Line2D(
                [0], [0], marker="*", color="w", markerfacecolor="gray",
                markeredgecolor="black", markersize=15, linestyle="None",
            )
        if has_lost:
            by_label["Not Won"] = Line2D(
                [0], [0], marker="X", color="w", markerfacecolor="gray",
                markeredgecolor="black", markersize=10, linestyle="None",
            )
        if has_timeout:
            by_label["Timeout"] = Line2D(
                [0], [0], marker="s", color="w", markerfacecolor="gray",
                markeredgecolor="black", markersize=10, linestyle="None",
            )

        ax.legend(by_label.values(), by_label.keys(), title="Model / Status", loc="upper left")
        plt.tight_layout()

        plot_path = REPORT_DIR / f"{level}_progress.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        plt.close()

        saved_paths.append(plot_path)
        print(f"Plot saved: {plot_path}")

    return saved_paths


def _duration_seconds(run: dict) -> float:
    """Calculate task duration in seconds from ISO timestamps."""
    try:
        start = run.get("timestamp_start", "")
        end = run.get("timestamp_end", "")
        if not start or not end:
            return 0.0
        start = start.rstrip("Z")
        end = end.rstrip("Z")
        if "." in start:
            start = start[: start.index(".")]
        if "." in end:
            end = end[: end.index(".")]
        dt_start = datetime.fromisoformat(start)
        dt_end = datetime.fromisoformat(end)
        return (dt_end - dt_start).total_seconds()
    except Exception:
        return 0.0


def generate_duration_bar_charts(runs: list[dict]) -> list[Path]:
    """Generate individual horizontal bar charts of task duration per model, one per level."""
    sns.set_theme(style="whitegrid")

    # Group runs by level
    level_runs: dict[str, list[dict]] = {}
    for run in runs:
        level = run.get("level", "unknown")
        level_runs.setdefault(level, []).append(run)

    levels = sorted(level_runs.keys())
    if not levels:
        return []

    status_colors = {
        "won": "#2ecc71",
        "not_won": "#e74c3c",
        "timeout": "#c0392b",
    }

    saved_paths: list[Path] = []

    for level in levels:
        fig, ax = plt.subplots(figsize=(8, max(3, len(level_runs[level]) * 0.5 + 1)))
        runs_for_level = level_runs[level]

        # Pre-compute durations and sort ascending
        scored = [(_duration_seconds(r), r) for r in runs_for_level]
        scored.sort(key=lambda x: x[0])

        models = [r.get("model", "Unknown") for _, r in scored]
        durations = [sec / 60 for sec, _ in scored]  # minutes
        colors = [status_colors.get(r.get("status", ""), "#95a5a6") for _, r in scored]

        ax.barh(models, durations, color=colors, edgecolor="white", height=0.6)
        ax.set_title(f"{level.replace('level_', 'Level ')}: Duration per Model")
        ax.set_xlabel("Duration (min)")
        ax.invert_yaxis()

        legend_elements = [
            Patch(facecolor=status_colors["won"], edgecolor="white", label="Won"),
            Patch(facecolor=status_colors["not_won"], edgecolor="white", label="Not Won"),
            Patch(facecolor=status_colors["timeout"], edgecolor="white", label="Timeout"),
        ]
        ax.legend(handles=legend_elements, loc="lower right")

        plt.tight_layout()

        plot_path = REPORT_DIR / f"{level}_duration.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        plt.close()

        saved_paths.append(plot_path)
        print(f"Duration bar chart saved: {plot_path}")

    return saved_paths
