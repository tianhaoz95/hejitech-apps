import pytest
from conftest import PROMPTS_EXPORT

from voxbrief_ml.app_prompts import app_transcript, apply_aliases, strip_asr_tokens, verify_against_export
from voxbrief_ml.config import EVAL_DIR


@pytest.mark.skipif(not PROMPTS_EXPORT.exists(), reason="needs the app's prompt export (see README)")
def test_port_matches_every_prompt_the_app_built():
    assert verify_against_export(PROMPTS_EXPORT, EVAL_DIR / "cases.json") == []


def test_dictionary_block_renders_hints_and_aliases(kit):
    block = kit.dictionary_block([
        {"term": "Voxbrief", "aliases": ["fox brief", " ", "vox brief", "a", "b"], "contextHint": "our app"},
        {"term": "Kubernetes"},
    ])
    assert block.startswith("\n\nPersonal dictionary:")
    assert '- Voxbrief (our app; often misheard as "fox brief", "vox brief", "a")' in block
    assert block.endswith("- Kubernetes")


def test_no_dictionary_leaves_prompts_untouched(kit):
    assert kit.dictionary_block([]) == ""
    assert kit.user_prompt("Just text.", []) == "Just text."
    assert kit.generation_system("Task List", []) == "GEN tasks."


def test_user_prompt_reminds_of_terms(kit):
    prompt = kit.user_prompt("For the Wotsbrief project.", [{"term": "Voxbrief"}, {"term": "Supabase"}])
    assert prompt == ("Dictionary terms (anything that sounds like one is that term): Voxbrief, Supabase"
                      "\n\nTranscript:\nFor the Wotsbrief project.")


def test_aliases_and_asr_tags_like_the_app():
    dictionary = [{"term": "Voxbrief", "aliases": ["fox brief"]}]
    assert apply_aliases("FOX BRIEF is great, not foxbriefs.", dictionary) == "Voxbrief is great, not foxbriefs."
    assert apply_aliases("costs $5", [{"term": "a$1\\b", "aliases": ["costs"]}]) == "a$1\\b $5"
    assert strip_asr_tokens(" Hello [Music]  there [ Laughter ] ") == "Hello there"
    assert app_transcript("[BLANK_AUDIO] fox brief rocks", dictionary) == "Voxbrief rocks"
