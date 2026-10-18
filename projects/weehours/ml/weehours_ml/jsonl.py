"""Append-only JSON Lines files. Every stage writes one record per id and skips ids already
written, so a long run on the Spark can be stopped and resumed without redoing work."""

import json
from pathlib import Path


def read(path):
    path = Path(path)
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def write(path, records):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def done_ids(path):
    return {record["id"] for record in read(path)}


class Appender:
    """Appends records as they finish (so a crash loses at most the one in flight)."""

    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.file = self.path.open("a", encoding="utf-8")

    def __call__(self, record):
        self.file.write(json.dumps(record, ensure_ascii=False) + "\n")
        self.file.flush()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.file.close()
