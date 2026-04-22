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
    from .plots import generate_level_progress_plots
except ImportError:
    from plots import generate_level_progress_plots


REPORT_DIR = Path(__file__).parent
TEMPLATE_PATH = REPORT_DIR / "template.md"
OUTPUT_PATH = REPORT_DIR / "report.md"
RESULTS_DIR = Path(__file__).parent.parent / "results"


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
    model = run.get("model", "-")
    level = run.get("level", "-")
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

    # Generate per-level progress plots (latest run per model/level only)
    level_plot_paths = generate_level_progress_plots(latest_runs)
    level_plots_md = "\n".join(
        f"### {p.name.replace('_progress.png', '').replace('level_', 'Level ')}\n\n"
        f"![{p.name}]({p.name})"
        for p in sorted(level_plot_paths)
    )

    template_content = TEMPLATE_PATH.read_text()
    template = Template(template_content)

    report = template.substitute(
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        rows=rows,
        latest_rows=latest_rows,
        level_plots=level_plots_md,
    )

    OUTPUT_PATH.write_text(report)
    print(f"Report generated: {OUTPUT_PATH}")
    print(f"Total runs: {len(runs)}")
    print(f"Unique model/level combinations: {len(latest_runs)}")


if __name__ == "__main__":
    generate_report()
