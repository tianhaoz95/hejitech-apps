# Stage 2 LLM eval

Scores the prompts Voxbrief sends its bundled on-device model (Qwen3-0.6B-4bit, shown as "Lite")
so a prompt change is measured instead of shipped blind. Apple Intelligence can't run in CI and
isn't covered; Flash (Qwen3-4B-4bit) can be picked with `--model`.

- `cases.json`: transcripts, optional personal dictionary and templates, and what the output must
  (not) contain. Categories: `dictionary` (sound-alike mishearings), `false-positive` (terms must
  not be inserted or forced onto common words), `classification` (template choice and its fields),
  `light` (proofread keeps content, drops fillers and ASR tags), `conversation` (a conversation's
  "Speaker N: ..." turns, sent as JSON, written up as a third-person report: details kept, prose
  not a script; Lite fails these and the app gives it the light cleanup instead), `brief` (title and one-line
  summary from cleaned text: mode `brief`, or `brief-overview` with a long memo's part summaries
  one per line as `transcript`), `turns` (a conversation's turns proofread turn by turn, one turn
  per line as `transcript`: same count back, content kept).
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
prompts and runs the `ml/` tests against them; four macOS jobs run a quarter of the cases each
(`--shard k/4`) through mlx-lm (MLX's Linux CPU backend took 40 minutes per sample); the last
merges them (`--merge`) and posts the report to the run summary. It reports, it doesn't gate.

Locally (from `projects/voxbrief`, after `xcodegen generate`; a checkout on an external volume
needs the test host's one-time "removable volumes" permission to write the export there):

```sh
TEST_RUNNER_VOXBRIEF_PROMPT_EXPORT=/tmp/prompts.json xcodebuild test -project Voxbrief.xcodeproj \
  -scheme VoxbriefMac -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO \
  -only-testing:VoxbriefMacTests/LLMPromptExportTests
python3 -m venv .venv && .venv/bin/pip install mlx-lm   # Apple silicon (Metal)
.venv/bin/python evals/llm/run_eval.py --prompts /tmp/prompts.json \
  --model VoxbriefApp/Resources/Models/Qwen3-0.6B-4bit --only 'dict-'
```

Numbers on Metal and on CI's CPU differ slightly for the same seed; compare like with like.

## Ask Voxbrief tool use (`ask_eval.py`)

Ask Voxbrief is a chat in which the model searches the user's notes with one tool,
`search_notes`, and answers from the passages it read (`AskConversation` in
`VoxbriefApp/Services/AskService.swift`). `ask_eval.py` runs that loop on the real model with
Qwen3's native tool format, the same prompt and tool text (keep them in step) and the app's two
rules: Lite's first reply to each question is started as a search call (it never calls tools
by itself), and an answer given before any search is redone as one. Ten short conversations
over seven stand-in notes, follow-ups included, scored by expected words; it prints each
question's tool calls and answer.

    python ask_eval.py ../../VoxbriefApp/Resources/Models/Qwen3-0.6B-4bit   # Lite
    python ask_eval.py mlx-community/Qwen3-4B-4bit                           # Flash

First run (2026-11-20): Lite 12 of 13 correct, searching on every question; Flash 13 of 13,
searching on every new question and answering 3 follow-ups from the conversation. Without the
first-reply rule Lite searched 0 of 10 times, and Flash 0 of 10 with a softer prompt.

Small talk and copying (2026-11-20, 1.34.1): on a phone Lite answered "Hi" by searching "money"
(the example word in the query description) and pasting the passage with its
`Note "…" (date, transcript):` heading. The eval now uses the app's exact passage format (it had
used a shorter one, which hid the pasting), fails any answer that copies a heading, runs the
app's small-talk check ("CHAT or NOTES?", Lite on every message, Flash only when it answered
before searching) and starts with a "Hi … Thanks!" conversation. `ASK_FORMAT=A|B|C` compares
passage formats: A, the old `[n] Note "Title" (date, transcript): text`, Lite 6 of 16; B (the
source after the text) 8 of 16; C, `Passage n, from "Title" (date):` with the text on its own
line, Lite 13 of 16 and Flash 16 of 16, which the app uses.
