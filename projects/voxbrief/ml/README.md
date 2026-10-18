# Lite fine-tuning (synthetic data → LoRA → MLX)

Makes Voxbrief's bundled on-device model, Lite (Qwen3-0.6B), better at its three Stage 2 jobs
(picking a template, writing the JSON note, light proofreading), and above all at fixing
personal-dictionary terms that speech recognition mishears ("Wotsbrief" → "Voxbrief") without
forcing terms where they don't belong. There is no user data, so the data is synthetic:

```
terms ─ plan ─ scenarios ─ tts ─ asr ─ targets ─ filter ─ build ─ train ─ merge ─ convert ─ publish
 bank    mix    teacher     Kokoro Whisper teacher  eval     app     LoRA    bf16    MLX 4-bit  Hugging Face
                writes      reads  base.en writes   checks   prompts                 + eval
                the memo    aloud  hears   the note
```

- A large **teacher** model (any OpenAI-compatible server, e.g. vLLM on the DGX Spark) writes
  realistic voice memos and the ideal answer for each.
- The **errors are real**: each memo is read aloud (Kokoro TTS, varied voices, noise, room echo)
  and transcribed by **Whisper base.en**, the weights the app runs. Whisper is only used, never
  trained. The teacher sees what was said; Lite's training input is what Whisper heard.
- Every example uses the **app's own prompts**: the dictionary-free prompts come from the app
  (the "kit" in the prompt export), the dictionary block and user message are ported in
  `voxbrief_ml/app_prompts.py`, and `verify` / the tests check the port against every prompt the
  app builds for the eval.
- The **filter is the eval's own checks** (`evals/llm/checks.py`), so "good training data" and
  "good model output" mean the same thing.
- **Held-out terms** (`terms/heldout.jsonl` and every term in `evals/llm/cases.json`) never appear
  in training, nor anything close to them, so the eval measures fixing *any* term, not memory.

## Layout

| Path | What |
|---|---|
| `configs/pilot.toml`, `configs/full.toml` | One file drives every stage: mix, teacher, TTS, ASR, LoRA, publish repo. Pilot = 200 scenarios, full = 20k. |
| `terms/seed_train.jsonl` | Hand-written training terms (the teacher adds more) |
| `terms/heldout.jsonl` | Eval-only terms |
| `voxbrief_ml/stages/*.py` | One module per stage; `python -m voxbrief_ml <stage>` |
| `tests/` | Standard-library tests (CI: `voxbrief-ml.yml`; prompt parity in `voxbrief-llm-eval.yml`) |
| `runs/<name>/` | Git-ignored outputs: JSONL per stage, audio, dataset, adapter, merged and MLX models, manifest |

Each stage appends one record per item and skips items already done, so a long run can be
stopped and resumed. `--limit N` processes at most N items for a quick try.

## Where each stage runs

| Stage | Machine | Needs |
|---|---|---|
| prompt export | Mac (Xcode) | see below |
| `terms`, `scenarios`, `targets` | DGX Spark | teacher server, `pip install -e '.[teacher]'` |
| `plan`, `filter`, `build`, `verify` | anywhere | standard library |
| `tts` | DGX Spark | `.[tts]`, `espeak-ng` (`apt install espeak-ng`) |
| `asr` | DGX Spark | `.[asr]` with a CUDA PyTorch |
| `train`, `merge` | DGX Spark | `.[train]` with a CUDA PyTorch |
| `convert` | Apple silicon Mac | `.[convert]` (MLX), runs the eval |
| `publish` | anywhere | `.[publish]`, `hf auth login` |

On the Spark (aarch64 + CUDA), use NVIDIA's containers rather than pip wheels for the heavy
parts: the NGC **vLLM** container to serve the teacher, and the NGC **PyTorch** container for
`tts`/`asr`/`train`/`merge` (then `pip install -e '.[tts,asr,train]'` inside it; it keeps the
container's torch).

## Running it

**1. Prompt export (Mac, whenever the app's prompts change).** From `projects/voxbrief`:

```sh
xcodegen generate
TEST_RUNNER_VOXBRIEF_PROMPT_EXPORT="$PWD/evals/llm/out/prompts.json" xcodebuild test \
  -project Voxbrief.xcodeproj -scheme VoxbriefMac -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO -only-testing:VoxbriefMacTests/LLMPromptExportTests
```

Copy `evals/llm/out/prompts.json` to the same path on the Spark (it's git-ignored), then from
`projects/voxbrief/ml`: `python -m voxbrief_ml verify --config configs/pilot.toml`.

**2. Teacher (Spark).** Serve any instruction-tuned model with a license that allows training on
its outputs (Apache-2.0 models like gpt-oss or Qwen are clean); a mixture-of-experts model is
several times faster than a dense one of the same size on the Spark. Set `[teacher]` in the config.

```sh
vllm serve openai/gpt-oss-120b --port 8000      # inside the NGC vLLM container
```

**3. Data (Spark), pilot first:**

```sh
python -m voxbrief_ml datagen --config configs/pilot.toml   # terms → build
```

Then read `runs/pilot/manifest.json` (counts, mix, filter pass rates), `runs/pilot/rejected.jsonl`
(why examples were dropped) and a sample of `runs/pilot/dataset/train.jsonl`. Things to check:
the filter keeps most targets, `with_mishearing` is a healthy share of corrections (Whisper does
mishear the terms), and the memos read like speech, not prose. Then `configs/full.toml`.

**4. Train and merge (Spark):**

```sh
python -m voxbrief_ml train --config configs/full.toml
python -m voxbrief_ml merge --config configs/full.toml
```

**5. Convert and evaluate (Mac).** Copy `runs/full/merged/` (and `manifest.json`) to the Mac, then:

```sh
python -m voxbrief_ml convert --config configs/full.toml
```

It writes the MLX 4-bit model to `runs/full/mlx/` and runs `evals/llm` on it and on the stock
Lite: compare `runs/full/eval_finetuned.md` with `eval_stock.md`. Ship only if dictionary and
false-positive rates improve and classification doesn't drop.

**6. Publish:** set `[publish] repo`, then `python -m voxbrief_ml publish --config configs/full.toml`
(model card with the eval tables; the commit is tagged with the run name).

Rough timings on the Spark for the full run (measure with the pilot): teacher 1–2 h with a MoE
model (6–18 h dense ~60B), TTS + ASR ~1–2 h, LoRA training 1–3 h.

## Shipping a model

Publishing doesn't change the app. To switch Lite to a fine-tuned model:

1. Point the model downloads at the new repo/revision: `voxbrief-ci.yml`, `voxbrief-llm-eval.yml`,
   `voxbrief-testflight.yml`, `voxbrief-mac-release.yml` (bump each `voxbrief-qwen3-0.6b-4bit-*`
   cache key), and `evals/llm/model.env`.
2. Keep the folder name the app loads (`OnDeviceLLMService.smallModelResourceName`) or change both.
3. Add a What's New entry, run the eval workflow, and refresh `evals/llm/baseline.json`.
