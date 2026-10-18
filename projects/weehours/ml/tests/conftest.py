import sys
from pathlib import Path

import pytest

ML_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML_DIR))

from weehours_ml.config import Run  # noqa: E402


@pytest.fixture
def run():
    return Run.load(ML_DIR / "configs" / "pilot.toml")
