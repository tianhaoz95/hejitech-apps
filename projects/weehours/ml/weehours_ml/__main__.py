"""python -m weehours_ml <stage> --config configs/pilot.toml [--limit N]

Stages run in this order; `datagen` runs plan..build in one go. See README.md."""

import argparse
import importlib

from .config import Run

STAGES = ["plan", "utterances", "tts", "asr", "build", "train", "convert", "evaluate", "publish", "verify"]
DATAGEN = STAGES[:5]
EXTRA = ["fetch", "publish_data"]   # earlier runs' data from Hugging Face; this run's data to it


def checks(run):
    """Problems keeping this pipeline in step with the app (empty when in sync)."""
    from .config import PROJECT_DIR
    from .laya import load_export, verify_against_export

    problems = []
    if run.laya_export.exists():
        problems += verify_against_export(load_export(run.laya_export))
    else:
        problems.append(f"{run.laya_export} missing: run `logeval --export` (README)")
    services = (PROJECT_DIR / "apps/ios/App/Sources/Services.swift").read_text()
    if f'let prompt = "{run["asr"]["prompt"]}"' not in services:
        problems.append("[asr] prompt differs from the Whisper prompt in Services.swift")
    build = (PROJECT_DIR / "scripts/build-llama-xcframework.sh").read_text()
    if f'LLAMA_COMMIT="${{LLAMA_COMMIT:-{run["convert"]["llama_cpp_commit"]}}}"' not in build:
        problems.append("[convert] llama_cpp_commit differs from scripts/build-llama-xcframework.sh")
    env = dict(line.split("=", 1) for line in (PROJECT_DIR / "eval/laya.env").read_text().splitlines()
               if "=" in line and not line.startswith("#"))
    url = f"https://huggingface.co/{env['LAYA_REPO']}/resolve/main/{env['LAYA_FILE']}"
    if url not in services:
        problems.append(f"Services.swift's ModelManager.modelURL isn't eval/laya.env's {url}")
    return problems


def verify(run, limit=None):
    problems = checks(run)
    for problem in problems:
        print(f"verify: {problem}")
    if problems:
        raise SystemExit(f"verify: {len(problems)} problems")
    print("verify: labels, ASR prompt, llama.cpp commit and model URL match the app")


def main():
    parser = argparse.ArgumentParser(prog="python -m weehours_ml", description=__doc__)
    parser.add_argument("stage", choices=STAGES + EXTRA + ["datagen"])
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
