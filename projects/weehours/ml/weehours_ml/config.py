"""Run configuration (a TOML file in configs/) and the paths every stage reads and writes."""

import json
import tomllib
from dataclasses import dataclass
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = ML_DIR.parent
SPEC_DIR = PROJECT_DIR / "spec"


@dataclass(frozen=True)
class Run:
    config: dict
    config_path: Path

    @classmethod
    def load(cls, path):
        path = Path(path).resolve()
        with path.open("rb") as f:
            config = tomllib.load(f)
        for section in ("types", "when"):
            total = sum(config[section].values())
            if abs(total - 1) > 1e-6:
                raise ValueError(f"[{section}] must sum to 1, got {total}")
        return cls(config, path)

    def __getitem__(self, section):
        return self.config[section]

    @property
    def dir(self):
        path = ML_DIR / "runs" / self.config["run"]["name"]
        path.mkdir(parents=True, exist_ok=True)
        return path

    def path(self, name):
        """A file or folder inside the run directory (plan.jsonl, audio/, dataset/train.jsonl...)."""
        return self.dir / name

    @property
    def laya_export(self):
        return (ML_DIR / self.config["run"]["laya_export"]).resolve()

    def snapshot(self):
        return json.loads(json.dumps(self.config))
