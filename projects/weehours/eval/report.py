#!/usr/bin/env python3
"""Markdown table comparing `logeval` summaries (the JSON it prints and writes to --out).

    python3 eval/report.py --title "Laya eval" now=/tmp/eval/laya-hierarchical.json \\
        baseline=eval/results/laya-hierarchical.json

Used by the LLM eval workflow (this run vs the committed eval/results) and by the fine-tuning
pipeline's `evaluate` stage (fine-tuned vs the shipped Laya). With exactly two columns a third shows
the first minus the second. Missing files are skipped. Standard library only.
"""

import argparse
import json
from pathlib import Path

METRICS = [
    ("type_accuracy", "Type accuracy"),
    ("full_accuracy", "Full accuracy (type + fields + time)"),
    ("auto_commit_rate", "Auto-commit rate"),
    ("wrong_auto_commit_rate", "Wrong auto-commits (share of auto)"),
    ("pick_contains_correct", "Pick-two contains the right entry"),
    ("full_list_rate", "Full-list rate"),
    ("ms_per_utterance", "ms per utterance"),
]


def load(spec):
    name, _, path = spec.partition("=")
    return name, json.loads(Path(path).read_text())


def _fmt(value):
    return "–" if value is None else f"{value:g}"


def render(title, columns):
    names = [n for n, _ in columns]
    delta = len(columns) == 2
    header = names + ([f"{names[0]} − {names[1]}"] if delta else [])
    lines = [f"## {title}", "", "| Metric | " + " | ".join(header) + " |", "|---|" + "---|" * len(header)]

    def row(label, values):
        cells = [_fmt(v) for v in values]
        if delta:
            a, b = values
            cells.append("–" if a is None or b is None else f"{a - b:+.1f}")
        lines.append(f"| {label} | " + " | ".join(cells) + " |")

    for key, label in METRICS:
        row(label, [s.get(key) for _, s in columns])
    for q in sorted({q for _, s in columns for q in s.get("per_question_accuracy", {})}):
        row(f"`{q}` accuracy", [s.get("per_question_accuracy", {}).get(q) for _, s in columns])
    lines += ["", " · ".join(f"{n}: {s.get('model', '?')}, {s.get('rows_evaluated', '?')} rows" for n, s in columns), ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--title", default="Laya decision eval")
    parser.add_argument("columns", nargs="+", help="name=path/to/logeval-summary.json")
    args = parser.parse_args()
    print(render(args.title, [load(c) for c in args.columns if Path(c.partition("=")[2]).exists()]))


if __name__ == "__main__":
    main()
