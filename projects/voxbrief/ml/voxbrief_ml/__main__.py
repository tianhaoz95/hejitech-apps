"""python -m voxbrief_ml <stage> --config configs/pilot.toml [--limit N]

Stages run in this order; `datagen` runs terms..build in one go. See README.md."""

import argparse
import importlib

from .config import Run

STAGES = ["terms", "plan", "scenarios", "tts", "asr", "targets", "filter", "build",
          "train", "merge", "convert", "publish", "verify"]
DATAGEN = STAGES[:8]


def verify(run, limit=None):
    """Checks the prompt port against the app's export and the term banks for leaks."""
    from .app_prompts import verify_against_export
    from .config import EVAL_DIR, TERMS_DIR
    from . import jsonl
    from .stages.terms import heldout_terms, leaks

    problems = verify_against_export(run.prompts_export, EVAL_DIR / "cases.json")
    heldout = heldout_terms()
    for path in [TERMS_DIR / "seed_train.jsonl", run.path("terms.jsonl")]:
        problems += [f"{path.name}: {t['term']} is too close to a held-out term"
                     for t in jsonl.read(path) if leaks(t["term"], heldout)]
    for problem in problems:
        print(f"verify: {problem}")
    if problems:
        raise SystemExit(f"verify: {len(problems)} problems")
    print("verify: prompts match the app and no training term leaks into the eval")


def main():
    parser = argparse.ArgumentParser(prog="python -m voxbrief_ml", description=__doc__)
    parser.add_argument("stage", choices=STAGES + ["datagen"])
    parser.add_argument("--config", required=True, help="e.g. configs/pilot.toml")
    parser.add_argument("--limit", type=int, help="process at most N items (quick tries)")
    args = parser.parse_args()
    run = Run.load(args.config)
    for stage in (DATAGEN if args.stage == "datagen" else [args.stage]):
        print(f"== {stage} ({run['run']['name']})", flush=True)
        if stage == "verify":
            verify(run, args.limit)
        else:
            importlib.import_module(f".stages.{stage}", __package__).run_stage(run, args.limit)


if __name__ == "__main__":
    main()
