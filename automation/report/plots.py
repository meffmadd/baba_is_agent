#!/usr/bin/env python3
"""
Plotting utilities for evaluation reports.

Uses matplotlib and seaborn. Install with:
    uv sync --extra reporting
"""

import json
from datetime import datetime
from pathlib import Path
from math import sqrt
from statistics import mean, stdev

import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

REPORT_DIR = Path(__file__).parent


MODEL_DISPLAY_NAMES: dict[str, str] = {
    "opencode-go/deepseek-v4-pro": "DeepSeek V4 Pro",
    "opencode-go/glm-5.1": "GLM 5.1",
    "opencode-go/kimi-k2.6": "Kimi K2.6",
    "opencode-go/minimax-m2.7": "MiniMax M2.7",
    "opencode-go/qwen3.6-plus": "Qwen 3.6 Plus",
    "opencode/claude-opus-4-7": "Claude Opus 4.7",
    "opencode/gemini-3.1-pro": "Gemini 3.1 Pro",
    "opencode/gpt-5.5": "GPT 5.5",
}


def short_model_name(model: str) -> str:
    """Map model names to human-readable display names."""
    if model in MODEL_DISPLAY_NAMES:
        return MODEL_DISPLAY_NAMES[model]
    for prefix in ("opencode-go/", "opencode/"):
        if model.startswith(prefix):
            return model[len(prefix):].replace("-", " ").title()
    return model


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

    models = sorted({short_model_name(run.get("model", "Unknown")) for run in runs})
    palette = sns.color_palette("husl", n_colors=len(models))
    model_colors = dict(zip(models, palette))

    for level in sorted({run["level"] for run in runs}):
        level_runs = [run for run in runs if run["level"] == level]

        fig, ax = plt.subplots(figsize=(10, 7))
        parsed_runs: list[tuple[dict, str, list[int], list[int]]] = []

        for run in level_runs:
            model = short_model_name(run.get("model", "Unknown"))
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
        ax.set_title(f"{level.replace('level_', 'Level ')}: Cumulative Tokens vs Tool Calls")

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

        # Model legend below the plot
        model_handles, model_labels = ax.get_legend_handles_labels()
        model_by_label = dict(zip(model_labels, model_handles))
        if model_by_label:
            n_models = len(model_by_label)
            n_cols = min(n_models, 4)
            lg1 = ax.legend(model_by_label.values(), model_by_label.keys(), loc="upper center", bbox_to_anchor=(0.5, -0.10), ncol=n_cols)
            ax.add_artist(lg1)

        # Status glyphs legend in lower right of plot
        status_items = []
        if has_won:
            status_items.append(("Won", "*", 15))
        if has_lost:
            status_items.append(("Not Won", "X", 10))
        if has_timeout:
            status_items.append(("Timeout", "s", 10))

        if status_items:
            status_handles = [
                Line2D([0], [0], marker=m, color="w", markerfacecolor="gray",
                       markeredgecolor="black", markersize=ms, linestyle="None")
                for _, m, ms in status_items
            ]
            ax.legend(status_handles, [s for s, _, _ in status_items], title="Status", loc="lower right")

        plot_path = REPORT_DIR / f"{level}_progress.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight", bbox_extra_artists=(lg1,) if model_by_label else None)
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
        "not_won": "#f39c12",
        "timeout": "#c0392b",
    }

    saved_paths: list[Path] = []

    for level in levels:
        fig, ax = plt.subplots(figsize=(8, max(2.5, len(level_runs[level]) * 0.35 + 1)))
        runs_for_level = level_runs[level]

        # Pre-compute durations and sort ascending
        scored = [(_duration_seconds(r), r) for r in runs_for_level]
        scored.sort(key=lambda x: x[0])

        models = [short_model_name(r.get("model", "Unknown")) for _, r in scored]
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
        ax.legend(handles=legend_elements, loc="upper right")

        plt.tight_layout()

        plot_path = REPORT_DIR / f"{level}_duration.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        plt.close()

        saved_paths.append(plot_path)
        print(f"Duration bar chart saved: {plot_path}")

    return saved_paths


def generate_averaged_tool_calls_plot(runs: list[dict]) -> Path:
    """Generate a line chart showing average cumulative tokens vs tool calls per model.

    Traces from all runs of each model are aligned by tool call index,
    then mean and std of cumulative tokens are computed at each step.
    X-axis capped at 20 tool calls. Shaded band shows ±1 std.
    """
    sns.set_theme(style="whitegrid")

    model_runs: dict[str, list[dict]] = {}
    for run in runs:
        model = short_model_name(run.get("model", "Unknown"))
        model_runs.setdefault(model, []).append(run)

    if not model_runs:
        return REPORT_DIR / "tool_calls_averaged.png"

    models = sorted(model_runs.keys())
    palette = sns.color_palette("husl", n_colors=len(models))
    model_colors = dict(zip(models, palette))

    MAX_TOOL_CALLS = 10

    fig, ax = plt.subplots(figsize=(10, 6))

    for model in models:
        traces: list[tuple[list[int], list[int]]] = []
        for run in model_runs[model]:
            trace_path = Path(run["_run_dir"]) / "trace.jsonl"
            if trace_path.exists():
                tc, tokens = parse_trace(trace_path)
                if tc:
                    traces.append((tc, tokens))

        if not traces:
            continue

        max_len = max(len(tc) for tc, _ in traces)
        max_len = min(max_len, MAX_TOOL_CALLS + 1)

        means: list[float] = []
        stds: list[float] = []

        for i in range(max_len):
            values = [tokens[i] for _tc, tokens in traces if i < len(tokens)]
            if len(values) >= 2:
                means.append(mean(values))
                stds.append(stdev(values) / sqrt(len(values)))
            elif len(values) == 1:
                means.append(values[0])
                stds.append(0)
            else:
                break

        x = list(range(len(means)))
        color = model_colors[model]

        ax.plot(x, means, color=color, linewidth=2, label=model)
        ax.fill_between(
            x,
            [m - s for m, s in zip(means, stds)],
            [m + s for m, s in zip(means, stds)],
            color=color, alpha=0.15,
        )

    ax.set_xlabel("# Tool Calls")
    ax.set_ylabel("Average Cumulative Tokens")
    ax.set_title("Average Token Usage")
    ax.set_xlim(0, MAX_TOOL_CALLS)
    plt.tight_layout()
    ax.legend(title="Model", bbox_to_anchor=(1.05, 1), loc="upper left")

    plot_path = REPORT_DIR / "tool_calls_averaged.png"
    plt.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"Plot saved: {plot_path}")
    return plot_path
