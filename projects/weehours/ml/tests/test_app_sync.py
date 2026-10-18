"""The pipeline must ask, hear and convert exactly like the app."""
import pytest

from weehours_ml.__main__ import checks
from weehours_ml.laya import load_export, verify_against_export


def test_asr_prompt_llama_commit_and_model_url_match_the_app(run):
    problems = [p for p in checks(run) if "laya_export" not in p and "logeval --export" not in p]
    assert problems == []


def test_label_port_matches_logeval_on_every_eval_row(run):
    if not run.laya_export.exists():
        pytest.skip("needs `logeval --export` (see README)")
    assert verify_against_export(load_export(run.laya_export)) == []
