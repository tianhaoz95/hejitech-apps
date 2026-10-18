"""The eval's output checks (`evals/llm/checks.py`), loaded from the eval itself so the data
filter and the eval judge a note by the same rules."""

import importlib.util

from .config import EVAL_DIR

_spec = importlib.util.spec_from_file_location("voxbrief_eval_checks", EVAL_DIR / "checks.py")
_checks = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_checks)

extract_json = _checks.extract_json
strings_in = _checks.strings_in
score_output = _checks.score_output
LEAK_MARKERS = _checks.LEAK_MARKERS
