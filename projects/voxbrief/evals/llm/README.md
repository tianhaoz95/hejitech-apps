# Stage 2 LLM eval

Scores the prompts Voxbrief sends its bundled on-device model (Qwen3-0.6B-4bit, shown as "Lite")
so a prompt change is measured instead of shipped blind. Apple Intelligence can't run in CI and
isn't covered; Flash (Qwen3-4B-4bit) can be picked with `--model`.

- `cases.json`: transcripts, optional personal dictionary and templates, and what the output must
  (not) contain. Categories: `dictionary` (sound-alike mishearings), `false-positive` (terms must
  not be inserted or forced onto common words), `classification` (template choice and its fields),
  `light` (proofread keeps content, drops fillers and ASR tags).
- `Tests/MacUnitTests/LLMPromptExportTests.swift` builds every prompt with the app's own code
  (alias correction, `buildClassificationSystemPrompt`, `buildGenerationSystemPrompt`,
  `buildLightSystemPrompt`, `transcriptUserPrompt`) and writes `prompts.json`. It runs in the
  normal macOS suite too, where it only checks that every case builds.
- `run_eval.py` runs those prompts like `OnDeviceLLMService` (`enable_thinking: false`,
  temperature 0.3, 1024 tokens, 24 for classification), `--samples` times per case with seeds
  0..n-1, scores them and writes `out/results.json` and `out/report.md`.
- `baseline.json`: the summary of a CI run to compare against (the report's "vs baseline").
  Refresh it from a run's `voxbrief-llm-eval-results` artifact after a deliberate prompt change:
  `python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); json.dump({"meta": r["meta"], "summary": r["summary"]}, open("baseline.json", "w"), indent=2)' results.json`.
- `checks.py`: the checks on one output, shared with the fine-tuning pipeline's data filter (`ml/`).
- `model.env`: the model the eval scores by default (the app's Lite).

CI: `.github/workflows/voxbrief-llm-eval.yml`. The eval is slow and costly, so it runs only when
the prompts or the model in use change (the Swift files that build or feed the prompts,
`OnDeviceLLMService.swift`, `model.env`), on the 15th of each month, and from the Actions tab
(samples, model; use this after editing the cases or the harness). The macOS job exports the
prompts and runs the `ml/` tests against them; four Linux jobs run a quarter of the cases each
(`--shard k/4`) through mlx-lm on CPU; the last merges them (`--merge`) and posts the report to
the run summary. It reports, it doesn't gate.

Locally (from `projects/voxbrief`, after `xcodegen generate`; write the export outside
`/Volumes/...` if the checkout lives there, since the unsigned test host can't write to it
without a privacy prompt):

```sh
TEST_RUNNER_VOXBRIEF_PROMPT_EXPORT=/tmp/prompts.json xcodebuild test -project Voxbrief.xcodeproj \
  -scheme VoxbriefMac -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO \
  -only-testing:VoxbriefMacTests/LLMPromptExportTests
python3 -m venv .venv && .venv/bin/pip install mlx-lm   # Apple silicon (Metal)
.venv/bin/python evals/llm/run_eval.py --prompts /tmp/prompts.json \
  --model VoxbriefApp/Resources/Models/Qwen3-0.6B-4bit --only 'dict-'
```

Numbers on Metal and on CI's CPU differ slightly for the same seed; compare like with like.
