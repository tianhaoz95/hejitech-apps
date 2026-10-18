# Laya fine-tuning (synthetic utterances → laya.train → GGUF)

Makes Wee Hours' on-device decision model, Laya (`convaiinnovations/laya`, ModernBERT-large,
421M, a non-generative scorer), better at the questions the app asks about what a parent said:
category × phase plus the field questions (amount, side, contents, diaper kind, solids amount).
Stock Laya is a zero-shot base; its authors report domain fine-tuning taking a benchmark from
0.36 to 0.77, and on our eval it picks the right category 36% of the time (eval/results). There
is no user data, so the data is synthetic:

```
plan ─ utterances ─ tts ─ asr ─ build ─ train ─ convert ─ evaluate ─ publish
labels  teacher     Kokoro Whisper laya   laya.   GGUF      app's      Hugging Face
fixed   writes +    reads  base.en rows   train   Q8_0      logeval
first   labels      aloud  hears          (RLCD)            vs stock
        blind
```

- The **labels come first**: `plan` fixes each entry (type, field values, how the time is said,
  whether the child is named) with the app's own labelling rule (logeval's `gold()`, ported in
  `weehours_ml/laya.py` from `spec/event-types.json`).
- A large **teacher** (any OpenAI-compatible server, e.g. vLLM on the DGX Spark) writes a few
  things a tired parent would say for each, then **labels each one blind** with the app's
  questions; only utterances whose blind labels equal the plan survive.
- The **errors are real**: Kokoro TTS reads them (varied voices, slower speech, night-room
  noise), Whisper base.en transcribes them with the app's closed-vocabulary prompt. Whisper is
  used, never trained.
- Training rows are **the app's request verbatim** (`{state, questions, expected}`; the questions
  come from `logeval --export`, option order kept), trained with the Laya authors' own
  `laya.train.finetune` (RLCD), which also fits calibration temperatures that travel into the GGUF.
- The **eval stays held out**: anything close to an utterance in `spec/utterances.jsonl` is
  dropped, and `evaluate` scores with the app's own `logeval`, fine-tuned vs stock.

## Layout

| Path | What |
|---|---|
| `configs/pilot.toml`, `configs/full.toml`, `configs/topup.toml` | One file drives every stage. Pilot = 200 plans × 3, full = 7,000 × 3; topup adds 1,200 plans of the types full was short of and trains on both (`include`, `id_prefix`). |
| `weehours_ml/laya.py` | Labels, questions, training rows; checked against the app |
| `weehours_ml/stages/*.py` | One module per stage; `python -m weehours_ml <stage>` |
| `spark/` | `run.sh` (one step), `all.sh` (pilot → gate → full), `Dockerfile` (CUDA stages) |
| `tests/` | Standard-library tests (CI: `weehours-ml.yml`; label parity in `weehours-llm-eval.yml`) |
| `runs/<name>/` | Git-ignored: JSONL per stage, audio, dataset, laya checkpoint, GGUFs, eval, manifest |
| `../eval/laya.env` | The Laya model in use (bundled, downloaded, evaluated) |
| `../eval/report.py` | Markdown comparison of `logeval` summaries |

Stages append one record per item and skip what's done, so long runs resume. `--limit N` for
quick tries. `python -m weehours_ml verify` checks the labels, the Whisper prompt, the llama.cpp
commit and the model URL against the app.

## Where each stage runs

| Stage | Machine | Needs |
|---|---|---|
| question export | Mac | Swift: `cd apps/ios/LogCore && swift run -c release logeval --export "$PWD/../../../ml/runs/laya_export.json"` |
| `plan`, `build`, `verify` | anywhere | standard library |
| `utterances` | DGX Spark | teacher server, `pip install -e '.[teacher]'` |
| `tts` | DGX Spark | `.[tts]`, `espeak-ng` |
| `asr` | DGX Spark | `.[asr]` with a CUDA PyTorch |
| `train` | DGX Spark | `.[train]` (the `laya` package) with a CUDA PyTorch |
| `convert` | Spark or Mac | `cmake`, git; llama.cpp's `gguf-py` + `transformers` for the converter |
| `evaluate` | Mac | Swift (`logeval`); builds llama-server at the app's commit |
| `publish` | anywhere | `.[publish]`, `hf auth login` |

On the Spark everything CUDA runs in NVIDIA's NGC vLLM image: it serves the teacher, and
`spark/Dockerfile` adds Kokoro, espeak-ng and `laya` on top of it (keeping its torch) as `heji-ml`
for `tts`/`asr`/`train`/`convert`. `spark/run.sh <config> <step...>` runs single steps
(`teacher-up`, `teacher-down`, or a stage); `spark/all.sh` runs the pilot, stops unless its
manifest passes a sanity gate, then the full run through `convert`. Keep `runs/` on a big disk
(a symlink is fine) and set `BULK` to where the Hugging Face cache should live.

## Running it

1. **Export** the questions on the Mac (command above), copy `ml/runs/laya_export.json` to the
   Spark, and run `python -m weehours_ml verify --config configs/pilot.toml`.
2. **Teacher**: `vllm serve openai/gpt-oss-120b --port 8000` (or any model whose license allows
   training on its outputs; mixture-of-experts models are much faster on the Spark). Set
   `[teacher]`.
3. **Data, pilot first**: `python -m weehours_ml datagen --config configs/pilot.toml`, then read
   `runs/pilot/manifest.json` (blind agreement, drops, mix) and sample `dataset/train.jsonl`:
   do the states read like what a parent says at 3 am, after Whisper? Then `configs/full.toml`.
4. **Train** (Spark): `python -m weehours_ml train --config configs/full.toml` (the authors
   report ~4-5 h on 2×T4 for ~30k questions; the Spark should be faster).
5. **Convert**: `python -m weehours_ml convert --config configs/full.toml` → `runs/full/gguf/`.
6. **Evaluate** (Mac, copy `runs/full/gguf` over): `python -m weehours_ml evaluate --config
   configs/full.toml` → `runs/full/eval.md` (fine-tuned vs stock, raw and calibrated) and
   `runs/full/calibration.json`. Ship only if category, phase and type accuracy rise and wrong
   auto-commits don't.
7. **Publish**: set `[publish] repo`, then `python -m weehours_ml publish --config configs/full.toml`.

## Shipping a model

Publishing doesn't change the app. To switch:

1. `eval/laya.env` → the new repo/file, and `ModelManager.modelURL` in
   `apps/ios/App/Sources/Services.swift` to the same URL (a test checks they match). Keep the
   local file name `Laya-Q8_0.gguf` or change it everywhere.
2. Copy `runs/<name>/calibration.json` over `spec/calibration.json` and run `scripts/sync-spec.sh`
   (or re-fit with `scripts/eval.sh`).
3. Run `LayaParityTests` (on-device port == llama-server) with the new GGUF, the LLM eval
   workflow, and refresh `eval/results` with `scripts/eval.sh`.
