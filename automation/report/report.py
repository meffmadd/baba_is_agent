#!/usr/bin/env python3
"""
Generate a markdown report from evaluation results.

Usage:
    python -m automation.report
    python automation/report/report.py

Output: automation/report/report.md
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from string import Template

try:
    from .plots import generate_averaged_tool_calls_plot, generate_duration_bar_charts, generate_level_progress_plots, short_model_name
except ImportError:
    from plots import generate_averaged_tool_calls_plot, generate_duration_bar_charts, generate_level_progress_plots, short_model_name


REPORT_DIR = Path(__file__).parent
TEMPLATE_PATH = REPORT_DIR / "template.md"
OUTPUT_PATH = REPORT_DIR / "report.md"
RESULTS_DIR = Path(__file__).parent.parent / "results"


def format_level_name(level: str) -> str:
    """Convert 'level_0' to 'Level 0', etc."""
    return level.replace("level_", "Level ").replace("_", " ").title()


def parse_iso_timestamp(ts: str) -> datetime:
    """Parse an ISO 8601 timestamp string into a datetime object."""
    ts = ts.rstrip("Z")
    if "." in ts:
        ts = ts[: ts.index(".")]
    return datetime.fromisoformat(ts)


def format_duration(start: str, end: str) -> str:
    """Calculate and format duration as 'Xm Ys'."""
    try:
        dt_start = parse_iso_timestamp(start)
        dt_end = parse_iso_timestamp(end)
        delta = dt_end - dt_start
        total_seconds = int(delta.total_seconds())
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes}m {seconds}s"
    except Exception:
        return "-"


def format_timestamp(ts: str) -> str:
    """Format ISO timestamp for display."""
    try:
        dt = parse_iso_timestamp(ts)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ts


def format_number(n) -> str:
    """Format a number with thousand separators."""
    try:
        return f"{int(n):,}"
    except (ValueError, TypeError):
        return str(n)


def format_cost(cost) -> str:
    """Format cost as currency."""
    try:
        c = float(cost)
        if c == 0:
            return "$0.0000"
        return f"${c:.4f}"
    except (ValueError, TypeError):
        return "$0.0000"


def format_error(error) -> str:
    """Truncate long error messages."""
    if not error:
        return "-"
    error = str(error).replace("|", "\\|").replace("\n", " ")
    if len(error) > 80:
        return error[:77] + "..."
    return error


def collect_runs() -> list[dict]:
    """Walk results directory and collect all run.json entries."""
    runs = []
    if not RESULTS_DIR.exists():
        print(f"Results directory not found: {RESULTS_DIR}")
        return runs

    for run_json in sorted(RESULTS_DIR.rglob("run.json")):
        try:
            data = json.loads(run_json.read_text())
            data["_run_dir"] = str(run_json.parent)
            runs.append(data)
        except (json.JSONDecodeError, OSError) as e:
            print(f"Warning: skipping {run_json}: {e}")

    return runs


def build_table_row(run: dict) -> str:
    """Build a single markdown table row from a run dict."""
    model = short_model_name(run.get("model", "-"))
    level = format_level_name(run.get("level", "-"))
    status = run.get("status", "-")
    hash_val = run.get("commit_hash") or run.get("tools_hash", "-")
    start_time = format_timestamp(run.get("timestamp_start", ""))
    duration = format_duration(
        run.get("timestamp_start", ""), run.get("timestamp_end", "")
    )
    tokens = format_number(run.get("tokens_total", 0))
    tokens_input = format_number(run.get("tokens_input", 0))
    tokens_output = format_number(run.get("tokens_output", 0))
    tool_calls = format_number(run.get("tool_calls", 0))
    cost = format_cost(run.get("cost_total", 0))
    error = format_error(run.get("error"))

    return (
        f"| {model} | {level} | {status} | {hash_val} | {start_time} | "
        f"{duration} | {tokens} | {tokens_input} | {tokens_output} | "
        f"{tool_calls} | {cost} | {error} |"
    )


def get_latest_by_model_level(runs: list[dict]) -> list[dict]:
    """Get the latest run for each unique (model, level) combination."""
    latest = {}
    for run in runs:
        key = (run.get("model", ""), run.get("level", ""))
        # Since runs are sorted by timestamp, later runs overwrite earlier ones
        latest[key] = run
    # Sort for consistent output: by model name, then level number
    return sorted(latest.values(), key=lambda r: (r.get("model", ""), r.get("level", "")))


STATUS_ICON = {
    "won": "✅",
}


def build_matrix_table(runs: list[dict]) -> str:
    """Build a markdown matrix table with models as rows and levels as columns."""
    # Collect unique models and levels
    models = sorted({run.get("model", "") for run in runs if run.get("model")})
    levels = sorted({run.get("level", "") for run in runs if run.get("level")})

    if not models or not levels:
        return "No data available for matrix."

    # Build lookup: (model, level) -> status
    status_lookup = {}
    for run in runs:
        key = (run.get("model", ""), run.get("level", ""))
        status_lookup[key] = run.get("status", "")

    # Compute passed counts and sort models by increasing passed count
    model_passed_counts = []
    for model in models:
        passed_count = sum(
            1 for level in levels if status_lookup.get((model, level), "") == "won"
        )
        model_passed_counts.append((model, passed_count))
    model_passed_counts.sort(key=lambda x: (x[1], x[0]))

    # Build header
    display_levels = [format_level_name(l) for l in levels]
    header = "| Model | Passed | " + " | ".join(display_levels) + " |"
    separator = "|" + "---|" * (len(display_levels) + 2)

    # Build rows
    rows = []
    for model, passed_count in model_passed_counts:
        cells = []
        for level in levels:
            status = status_lookup.get((model, level), "")
            if status == "":
                icon = "—"
            else:
                icon = STATUS_ICON.get(status, "❌")
            cells.append(icon)
        passed_str = f"{passed_count}/{len(levels)}"
        row = f"| {short_model_name(model)} | {passed_str} | " + " | ".join(cells) + " |"
        rows.append(row)

    return "\n".join([header, separator] + rows), [model for model, _ in model_passed_counts]


def build_duration_matrix_table(runs: list[dict], model_order: list[str] | None = None) -> str:
    """Build a markdown matrix table showing execution duration per model/level."""
    models = model_order or sorted({run.get("model", "") for run in runs if run.get("model")})
    levels = sorted({run.get("level", "") for run in runs if run.get("level")})

    if not models or not levels:
        return "No data available for duration matrix."

    # Build lookup: (model, level) -> duration string
    duration_lookup = {}
    for run in runs:
        key = (run.get("model", ""), run.get("level", ""))
        duration_lookup[key] = format_duration(
            run.get("timestamp_start", ""), run.get("timestamp_end", "")
        )

    display_levels = [format_level_name(l) for l in levels]
    header = "| Model | " + " | ".join(display_levels) + " |"
    separator = "|" + "---|" * (len(display_levels) + 1)

    rows = []
    for model in models:
        cells = []
        for level in levels:
            duration = duration_lookup.get((model, level), "—")
            cells.append(duration)
        row = f"| {short_model_name(model)} | " + " | ".join(cells) + " |"
        rows.append(row)

    return "\n".join([header, separator] + rows)


def build_cost_matrix_table(runs: list[dict], model_order: list[str] | None = None) -> str:
    """Build a markdown matrix table showing cost per model/level with a total column."""
    models = model_order or sorted({run.get("model", "") for run in runs if run.get("model")})
    levels = sorted({run.get("level", "") for run in runs if run.get("level")})

    if not models or not levels:
        return "No data available for cost matrix."

    # Build lookup: (model, level) -> cost float
    cost_lookup = {}
    for run in runs:
        key = (run.get("model", ""), run.get("level", ""))
        try:
            cost_lookup[key] = float(run.get("cost_total", 0))
        except (ValueError, TypeError):
            cost_lookup[key] = 0.0

    display_levels = [format_level_name(l) for l in levels]
    header = "| Model | " + " | ".join(display_levels) + " | Total |"
    separator = "|" + "---|" * (len(display_levels) + 2)

    rows = []
    for model in models:
        cells = []
        total = 0.0
        for level in levels:
            cost = cost_lookup.get((model, level), 0.0)
            total += cost
            cells.append(format_cost(cost))
        row = f"| {short_model_name(model)} | " + " | ".join(cells) + f" | {format_cost(total)} |"
        rows.append(row)

    return "\n".join([header, separator] + rows)


def collect_game_state_format_usage(runs: list[dict]) -> dict[str, dict[str, int]]:
    """Parse trace.jsonl files and count get_game_state calls by format per model."""
    usage: dict[str, dict[str, int]] = {}

    for run in runs:
        model = run.get("model", "")
        run_dir = run.get("_run_dir", "")
        if not model or not run_dir:
            continue

        trace_path = Path(run_dir) / "trace.jsonl"
        if not trace_path.exists():
            continue

        if model not in usage:
            usage[model] = {"entities": 0, "grid": 0, "unknown": 0}

        try:
            with trace_path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if entry.get("type") != "tool_use":
                        continue

                    part = entry.get("part", {})
                    if part.get("type") != "tool":
                        continue
                    if part.get("tool") != "get_game_state":
                        continue

                    state = part.get("state", {})
                    input_args = state.get("input", {})
                    fmt = input_args.get("format", "unknown")

                    if fmt in ("entities", "grid"):
                        usage[model][fmt] += 1
                    else:
                        usage[model]["unknown"] += 1
        except (OSError, json.JSONDecodeError):
            continue

    return usage


def build_format_usage_table(usage: dict[str, dict[str, int]], model_order: list[str] | None = None) -> str:
    """Build a markdown table showing get_game_state format preference per model."""
    if not usage:
        return "No data available for format usage."

    # Sort by model order if provided, else alphabetical
    models = model_order or sorted(usage.keys())

    rows = []
    for model in models:
        counts = usage.get(model, {"entities": 0, "grid": 0, "unknown": 0})
        entities = counts.get("entities", 0)
        grid = counts.get("grid", 0)
        unknown = counts.get("unknown", 0)
        total = entities + grid + unknown

        if total == 0:
            pct_entities = "0%"
            pct_grid = "0%"
        else:
            pct_entities = f"{entities / total * 100:.0f}%"
            pct_grid = f"{grid / total * 100:.0f}%"

        pref = "entities" if entities > grid else "grid" if grid > entities else "tie"
        row = f"| {short_model_name(model)} | {entities} ({pct_entities}) | {grid} ({pct_grid}) | {pref} |"
        rows.append(row)

    header = "| Model | Entities Calls | Grid Calls | Preferred |"
    separator = "|---|---|---|---|"

    return "\n".join([header, separator] + rows)


def collect_tool_usage(runs: list[dict]) -> dict[str, dict[str, int]]:
    """Parse trace.jsonl files and count tool calls per model per tool."""
    usage: dict[str, dict[str, int]] = {}

    for run in runs:
        model = run.get("model", "")
        run_dir = run.get("_run_dir", "")
        if not model or not run_dir:
            continue

        trace_path = Path(run_dir) / "trace.jsonl"
        if not trace_path.exists():
            continue

        if model not in usage:
            usage[model] = {}

        try:
            with trace_path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if entry.get("type") != "tool_use":
                        continue

                    part = entry.get("part", {})
                    if part.get("type") != "tool":
                        continue

                    tool_name = part.get("tool", "unknown")
                    # Normalize misspelled todowrite variants
                    if tool_name in ("todowrite", "todowwrite"):
                        tool_name = "todowrite"
                    usage[model][tool_name] = usage[model].get(tool_name, 0) + 1
        except (OSError, json.JSONDecodeError):
            continue

    return usage


def build_tool_usage_matrix(tool_usage: dict[str, dict[str, int]], model_order: list[str] | None = None) -> str:
    """Build a markdown matrix table with models as rows and tools as columns."""
    if not tool_usage:
        return "No data available for tool usage."

    # Collect all tools across all models
    all_tools = sorted({tool for counts in tool_usage.values() for tool in counts})

    # Sort by model order if provided, else alphabetical
    models = model_order or sorted(tool_usage.keys())

    if not models or not all_tools:
        return "No data available for tool usage."

    # Build header
    header = "| Model | " + " | ".join(all_tools) + " |"
    separator = "|" + "---|" * (len(all_tools) + 1)

    # Build rows
    rows = []
    for model in models:
        counts = tool_usage.get(model, {})
        total = sum(counts.values())
        cells = []
        for tool in all_tools:
            count = counts.get(tool, 0)
            if total == 0:
                pct = 0
            else:
                pct = count / total * 100
            cells.append(f"{count} ({pct:.0f}%)")
        row = f"| {short_model_name(model)} | " + " | ".join(cells) + " |"
        rows.append(row)

    return "\n".join([header, separator] + rows)


def generate_report() -> None:
    """Generate the markdown report."""
    runs = collect_runs()

    if not runs:
        print("No runs found.")
        return

    # Sort by start time
    runs.sort(key=lambda r: r.get("timestamp_start", ""))

    rows = "\n".join(build_table_row(run) for run in runs)

    # Build latest-only table
    latest_runs = get_latest_by_model_level(runs)
    latest_rows = "\n".join(build_table_row(run) for run in latest_runs)

    # Build model x level matrix
    matrix_table, model_order = build_matrix_table(latest_runs)

    # Build duration matrix (same model order)
    duration_matrix_table = build_duration_matrix_table(latest_runs, model_order)

    # Build cost matrix (same model order)
    cost_matrix_table = build_cost_matrix_table(latest_runs, model_order)

    # Build game state format usage table
    format_usage = collect_game_state_format_usage(runs)
    format_usage_table = build_format_usage_table(format_usage, model_order)

    # Build tool usage matrix
    tool_usage = collect_tool_usage(runs)
    tool_usage_matrix = build_tool_usage_matrix(tool_usage, model_order)

    # Generate per-level progress plots (latest run per model/level only)
    level_plot_paths = generate_level_progress_plots(latest_runs)
    level_plots_md = "\n".join(
        f"### {format_level_name(p.name.replace('_progress.png', ''))}\n\n"
        f"![{p.name}]({p.name})"
        for p in sorted(level_plot_paths)
    )

    # Generate duration bar charts (one per level)
    duration_plot_paths = generate_duration_bar_charts(latest_runs)
    duration_plots_md = "\n".join(
        f"### {format_level_name(p.name.replace('_duration.png', ''))}\n\n"
        f"![{p.name}]({p.name})"
        for p in sorted(duration_plot_paths)
    )

    # Generate averaged tool calls plot
    tool_calls_plot_path = generate_averaged_tool_calls_plot(latest_runs)
    tool_calls_plot_md = f"![{tool_calls_plot_path.name}]({tool_calls_plot_path.name})"

    template_content = TEMPLATE_PATH.read_text()
    template = Template(template_content)

    report = template.substitute(
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        rows=rows,
        latest_rows=latest_rows,
        matrix_table=matrix_table,
        duration_matrix_table=duration_matrix_table,
        cost_matrix_table=cost_matrix_table,
        format_usage_table=format_usage_table,
        tool_usage_matrix=tool_usage_matrix,
        level_plots=level_plots_md,
        duration_plots=duration_plots_md,
        tool_calls_plot=tool_calls_plot_md,
    )

    OUTPUT_PATH.write_text(report)
    print(f"Report generated: {OUTPUT_PATH}")
    print(f"Total runs: {len(runs)}")
    print(f"Unique model/level combinations: {len(latest_runs)}")


if __name__ == "__main__":
    generate_report()
