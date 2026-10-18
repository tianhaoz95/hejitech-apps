"""Run configuration (a TOML file in configs/) and the paths every stage reads and writes."""

import json
import tomllib
from dataclasses import dataclass
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = ML_DIR.parent
EVAL_DIR = PROJECT_DIR / "evals" / "llm"
TERMS_DIR = ML_DIR / "terms"


@dataclass(frozen=True)
class Run:
    config: dict
    config_path: Path

    @classmethod
    def load(cls, path):
        path = Path(path).resolve()
        with path.open("rb") as f:
            config = tomllib.load(f)
        mix = config["mix"]
        if abs(sum(mix.values()) - 1) > 1e-6:
            raise ValueError(f"[mix] must sum to 1, got {sum(mix.values())}")
        templates = config["templates"]
        if abs(sum(templates.values()) - 1) > 1e-6:
            raise ValueError(f"[templates] must sum to 1, got {sum(templates.values())}")
        return cls(config, path)

    def __getitem__(self, section):
        return self.config[section]

    @property
    def dir(self):
        path = ML_DIR / "runs" / self.config["run"]["name"]
        path.mkdir(parents=True, exist_ok=True)
        return path

    def path(self, name):
        """A file or folder inside the run directory (terms.jsonl, audio/, dataset/train.jsonl...)."""
        return self.dir / name

    @property
    def prompts_export(self):
        return (self.config_path.parent.parent / self.config["run"]["prompts_export"]).resolve()

    def snapshot(self):
        """The config as recorded in the manifest."""
        return json.loads(json.dumps(self.config))
