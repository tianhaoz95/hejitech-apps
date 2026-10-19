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


def test_question_cutting_matches_the_app_for_a_new_household(run):
    """build's option subsets (households with categories off) ask exactly what the app asks."""
    from weehours_ml.laya import Registry

    default = run.laya_export.parent / "laya_export_groups_default.json"
    if not run.laya_export.exists() or not default.exists():
        pytest.skip("needs `logeval --export` and `logeval --categories default --export` (README)")
    r = Registry()
    defaults = {c["id"] for c in r.spec["categories"] if c["defaultEnabled"]}
    assert r.questions_for(load_export(run.laya_export), defaults)["questions"] == load_export(default)["questions"]
