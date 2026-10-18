import sys
from pathlib import Path

import pytest

ML_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML_DIR))

from voxbrief_ml.app_prompts import Kit  # noqa: E402
from voxbrief_ml.config import EVAL_DIR, Run  # noqa: E402

PROMPTS_EXPORT = EVAL_DIR / "out" / "prompts.json"


@pytest.fixture
def kit():
    """A small stand-in for the app's prompt kit (the real one needs the Swift export)."""
    return Kit({
        "classification": {"system": "CLASSIFY", "maxTokens": 24},
        "fallbackTemplate": "General Notes",
        "generation": {
            "General Notes": {"system": "GEN notes.", "fieldKeys": ["notes"]},
            "Task List": {"system": "GEN tasks.", "fieldKeys": ["tasks"]},
        },
        "light": {"system": "LIGHT."},
        "maxDictionaryTermsInPrompt": 50,
        "maxAliasesPerTermInPrompt": 3,
    })


@pytest.fixture
def run():
    return Run.load(ML_DIR / "configs" / "pilot.toml")
