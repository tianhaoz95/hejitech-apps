# Laya fine-tuning (synthetic utterances → laya.train → GGUF)

Makes Wee Hours' on-device decision model, Laya (`convaiinnovations/laya`, ModernBERT-large,
421M, a non-generative scorer), better at the questions the app asks about what a parent said:
category × phase plus the field questions (amount, side, contents, diaper kind, solids amount).
Stock Laya is a zero-shot base; its authors report domain fine-tuning taking a benchmark from
0.36 to 0.77; on our eval stock Laya picked the right category 37% of the time. The fine-tune
the app ships gets 98–99% (history and numbers below). There is no user data, so the
data is synthetic:

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
| `runs/<name>/` | Git-ignored: JSONL per stage, audio, dataset, laya checkpoint, GGUFs, eval, manifest. The text data of every published run is also on Hugging Face (below). |
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
| `publish`, `publish_data`, `fetch` | anywhere | `.[publish]`, `HF_TOKEN` (write; `fetch` needs none) |

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
   configs/full.toml` → `runs/full/eval.md` (fine-tuned vs the model the app ships now, raw and
   calibrated) and `runs/full/calibration.json`. Ship only if category, phase and type accuracy
   rise and wrong auto-commits don't. `evaluate` takes the shipped model from
   `apps/ios/App/Models/Laya-Q8_0.gguf` if present, so make sure that file is what the app ships
   (`scripts/fetch-models.sh` after deleting it).
7. **Publish**: `python -m weehours_ml publish --config configs/<name>.toml` uploads
   `runs/<name>/gguf/` to `[publish] repo` (`tianhaoz95/wee-hours-baby-activity`, the user's
   account, no org) and tags the commit with the run name. It needs a write token as `HF_TOKEN`
   (ask the user where it is; don't commit it).

## Data on Hugging Face

Each run's text data lives in the dataset repo
[`tianhaoz95/wee-hours-baby-activity-data`](https://huggingface.co/datasets/tianhaoz95/wee-hours-baby-activity-data)
under `<run>/`, tagged with the run name like the model repo: `plan.jsonl`, `utterances.jsonl`,
`tts.jsonl`, `asr.jsonl`, `dataset/train.jsonl` + `val.jsonl` (a top-up's rows include the runs it
builds on), `manifest.json`, `train_summary.json`. Audio isn't uploaded: `tts` regenerates it
from `utterances.jsonl`, and the rows already hold what Whisper heard. `pilot`, `full` and
`topup` are there.

- `publish` uploads the run's data too (`publish_data` alone does just that), plus a snapshot of
  the eval sentences into the model repo (`eval/utterances.jsonl`).
- `fetch` downloads the runs in `[run] include` (at their tags) into `runs/`, so a top-up can be
  built on a machine that doesn't hold the earlier runs. Run it before `build`.
- The eval set stays in git (`spec/utterances.jsonl`, generated by `eval/generate_dataset.py`;
  edit the generator, not the file): it changes with the spec wording and label decisions, and
  CI reads it.

## Shipping a model

Publishing doesn't change the app. To switch:

1. `eval/laya.env` → the new repo/file and `LAYA_REVISION` = the run's tag, and
   `ModelManager.modelURL` in `apps/ios/App/Sources/Services.swift` to the same URL
   (`…/resolve/<tag>/<file>`; a test checks they match). Never point the app at `main`: a later
   publish would change what an already released version downloads. Keep the
   local file name `Laya-Q8_0.gguf` or change it everywhere.
2. Calibration: compare the raw and calibrated tables in `eval.md`. For the top-up, the fitted
   calibration was worse (3.7% wrong auto-commits vs 0.6% raw; it's fitted on only 89 rows), so
   `spec/calibration.json` has every temperature at 1.0. Adopt a fitted one only if it wins on
   wrong auto-commits; either way set its `modelVersion` and run `scripts/sync-spec.sh`.
3. Run `LayaParityTests` (on-device port == llama-server) with the new GGUF and refresh
   `eval/results` with `scripts/eval.sh`. That script also overwrites `spec/calibration.json`
   (and its LogCore copy) with a fitted one: restore them with git afterwards if you ship raw.
4. Ship the spec wording the model was trained on in the same change (see Conventions), add the
   change to What's New, and release with `scripts/cut_release.sh weehours`. The TestFlight
   workflow's model cache is keyed on `eval/laya.env`, so CI downloads the new file.

## Models so far

All scored with `logeval` on `spec/utterances.jsonl`, raw, hierarchical: 178 typed sentences
until 2026-10-19, then 208 (30 more not-a-log), 239 since the groups redesign (43 new or
relabelled for the trackers; `--categories default` scores the 187 a new household can log). Hugging Face tags = run names; `eval/laya.env`'s
`LAYA_REVISION` pins the one the app downloads.

| Model | Data | Type | Category | Phase | Side | Auto-commit | Wrong auto |
|---|---|---|---|---|---|---|---|
| Stock (`ggml-org/Laya-GGUF`) | – | 83.7 | 37.1 | 67.5 | | 2.8 | 0 |
| v1 (`full`, 2026-10-18) | 10,958 rows | 97.2 | 98.3 | 96.7 | | 92.1 | 4 |
| v2 (`full`, corrected export) | 10,958 rows | 97.8 | 97.8 | 98.3 | | 91.6 | 3 |
| top-up (`topup` = full + 1,200 plans), shipped in 0.4.0 | 12,653 rows | 99.4 | 98.3 | 100 | 90.3 | 88.2 | 1 |
| top-up on the 208-row eval, category wording | | 99.5 | 94.7 | 100 | 90.3 | 75.5 | 1 |
| none (`none` = + 1,000 not-a-log plans), shipped in 0.4.1 | 14,490 rows | 99.0 | 98.6 | 98.3 | 96.8 | 76.9 | 1 |
| care (`care`: one "care" option + `care_type`), not shipped, 239 rows | | 97.5 | 97.5 | 98.3 | | 84.9 | 5 |
| groups (two-level questions, from base), not shipped, 239 rows | | 97.1 | 97.1 | 100 | | 84.1 | 6 |
| **groups2** (`groups` + 700 near-miss plans), **shipped in 0.4.2**, 239 rows | | 97.1 | 97.1 | 99.2 | 100 | 84.1 | 4 |
| groups2, a new household's defaults (187 rows) | | 99.5 | 100 | 99.2 | 100 | 81.8 | 1 |

Every run is on Hugging Face as its own commit and tag (`pilot`, `full`, `topup`, `none`, `care`,
`groups`, `groups2`; the data repo also has `nearmiss`), each card with its eval and the eval set
it was scored on; `main` is the shipped model (`groups2`, sha256 `00a0f9ee…`).

`groups2` with a new household's defaults matches `none` (one wrong auto-commit each: "she
unlatched, done" → Start breastfeeding vs "eyes open, she's awake" → Fell asleep), asks less and
keeps every not-a-log sentence as a note. With every tracker on it gets 40 of the 43 tracker
sentences right; its wrong auto-commits there are plans and near misses (see Known weaknesses).

`none` keeps 95.2% of the not-a-log sentences as notes without asking (the top-up 47.6%) and
says "none" for 40 of 42; it missed the README's bar by one sentence each on type and phase, and
its one wrong auto-commit is "eyes open, she's awake" → Fell asleep (the top-up's was "the
formula tin is almost empty" → bottle). Shipped on balance (the user's call to release); fix
that sleep confusion first.

The full run: 7,000 plans → 20,966 utterances, blind agreement 0.605, about 1 h 40 min of
teacher time and 40 min of training on the Spark. The top-up added one-entry bottles (190 → 1,195
rows), bottle start/finish and none-of-these, with the new phase wording, and trained on full +
top-up together. Hugging Face tag `topup` (sha256 `a0bc06ea…`). The run report (charts, misses,
timeline) is `reports/archive/wee-hours-model-train-v0` at the repo root
(`script/serve.sh` serves it).

## Conventions

- **The questions are two levels** (spec `modelGroups`): the category question asks for a group
  (feeding, diaper, sleep, growth, health, care, activity, or none of these), a group with
  several enabled categories gets a `<group>_entry` question (feeding_entry: bottle, breast,
  pumping, solids), and sessions keep the phase question. The app combines them:
  P(type) = P(group) × P(category | group) × P(phase). Every question stays at 8 options or fewer
  (laya caps a question and its options at 192 tokens).
- **Labels come from today's spec at build time**, not from the plan: `build` recomputes each
  row's labels from its type and fields (`Registry.labels`, the port of logeval's `gold()`). A
  question redesign relabels every earlier run's rows for free; only new types need new data.
- **Households turn categories off**, and the app then asks with fewer options. `subset_fraction`
  asks that share of training rows with a random subset of categories on
  (`Registry.questions_for`, checked against `logeval --categories default --export`), and
  `logeval --categories default` scores a new household's setup (its 187 answerable rows).

- **The option descriptions in `spec/event-types.json` are part of the prompt.** Laya scores
  `[MASK] key: description` per option, so rewording one changes both stock and fine-tuned
  behaviour. Score the shipped model with any wording change, and ship a model together with the
  wording it was trained on: stock Laya with the 0.4.0 phase wording fell from 83.7% to 72.5%.
  Never merge wording to main ahead of its model: TestFlight builds `main` every Wednesday.
- **Label conventions are the user's decisions** (2026-10-18), shared by the eval and `plan`:
  a bottle told after it was over ("had a bottle an hour ago, drank half") is one entry
  (`feed.bottle.single`), not a finish; "done"/"finished" alone leaves the amount `not_stated`;
  "finished his bottle" is `full`. Change a convention in `spec/utterances.jsonl` and the
  descriptions together, and ask the user first.
- **The eval stays held out** and is typed text, so it never sees recognition errors (see Known
  weaknesses). One sentence is about 0.6 points: read the misses, not just the percentages.
- **`"model": false`** keeps a category out of the questions entirely (tap-only, so its option
  text isn't in the prompt). Until 0.4.2 the care, health and activity categories were that way;
  a new tracker category starts there until a model is trained with it. Turning one on is a
  relabel: earlier `NONE_TOPICS` and eval rows about it become entries (build drops stale
  not-a-log rows with `drop_none_matching` / `drop_none_prefixes`).
- **Only enabled categories are asked.** The questions are built from the household's tracked
  categories (`Registry.questions_for`, `subset_fraction` in build trains on random subsets), so
  score with both `logeval` and `logeval --categories default`.
- **Ship raw unless the fitted calibration wins** (see Shipping). The trainer's own temperatures
  are inside the GGUF already.

## Iterating on a model

1. **Find the misses.** `eval/results/laya-hierarchical.review.json` lists every sentence the
   shipped model got wrong or asked about (tier: auto, pick = choose from two, full_list), with
   the question that decided it. `runs/<name>/eval/` has the same for a candidate.
2. **Decide what kind of miss it is.** A wording or label ambiguity (two readings a person would
   accept) is fixed in the spec, with the user. A type the data is short of gets a top-up. A
   wrong number comes from the deterministic parsers in LogCore, not the model.
3. **Top up rather than redo.** Copy `configs/topup.toml`: a new `name`, `seed` and
   `id_prefix` (ids must not clash), `include = ["full", "topup"]` to train on the earlier runs'
   data too, and `[plan] types` weighted to the gaps. Check `weehours_ml/stages/utterances.py`'s
   `describe()` and `NONE_TOPICS`: the teacher writes what the plan describes, and a phrase like
   "happening now" turned past bottles into starts until it was special-cased.
4. **Pilot, then run.** `spark/run.sh configs/<name>.toml teacher-up plan utterances teacher-down
   tts asr build train convert` on the Spark (`BULK=/mnt/AIML/heji-remote-dev`; `runs/` is a
   symlink to `$BULK/weehours-runs`). Use `--limit` or a small config first and read the manifest
   and a sample of `dataset/train.jsonl`.
5. **Evaluate on the Mac** against the shipped model, then ship as above.

## Pitfalls we hit

- **A question's options share a 192-token budget** (laya's `head_max_len`, the question plus
  every option description). That's why the questions are two levels (spec `modelGroups`,
  then a `<group>_entry` question) instead of 21 category options.
- **Changing labels in `spec/utterances.jsonl` by hand gets reverted**: it's generated by
  `eval/generate_dataset.py`. Edit the generator, regenerate, and check the diff.

- **Training loss** is RLCD: soft cross-entropy plus a noisy policy-gradient term, so steps swing
  and dip below zero, and the epoch mean comes mostly from a few spikes (likely teacher-label
  noise). Still falling at epoch 4 doesn't mean more epochs help: the trainer scores the
  validation split only before and after, and the fitted temperature (3.7 for the top-up) says
  the model is already overconfident. Measure per-epoch validation before training longer.
- **Kokoro fails on the Spark's GPU**: TTS runs on CPU worker processes (`[tts] device = "cpu"`),
  about 3.6 sentences/s.
- **gpt-oss reasoning counts against `max_tokens`**: keep `reasoning_effort = "low"` or utterances
  come back empty.
- **The Mac's system Python is 3.9**; the pipeline needs 3.11+ (`tomllib`): `uv run --python 3.12
  python -m weehours_ml …`.
- **`scripts/eval.sh` replaces `spec/calibration.json`** (see Shipping).

## Known weaknesses (groups2, 0.4.2)

1. **Plans and near misses about trackers are logged**: "bath at seven tonight" → Bath and
   "hiccups again" → Symptom, both auto-committed; "playtime on the mat" → Tummy time. More
   near-miss plans per tracker (the `nearmiss` round's `none_topics`) and a play/tummy-time
   distinction in the descriptions.
2. **"she unlatched, done" → Start breastfeeding**, auto-committed: finish without "finished".
3. **Goopy eyes and infant Tylenol** go to the full list with a wrong top answer (Lotion, Bath):
   symptoms and medicine named only by brand need data.
4. With every tracker on, wrong auto-commits are 2% (0.7% with the defaults) and each answer
   takes about 520 ms instead of 300 (more questions).

## Known weaknesses (none, 0.4.1), kept for the record

1. **"eyes open, she's awake" → Fell asleep**, auto-committed: wake-ups phrased without "woke"
   need more sleep.end data.
2. **Numbers read as growth**: "temperature is 37.2" and "booked the six week check" → growth
   99%. The care round makes temperature an entry; "six week check" needs near-miss data.
3. **"giving him a bottle now"** goes to the full list (start vs one entry).

## Known weaknesses (top-up, 0.4.0), kept for the record

1. **Sentences that aren't log entries.** Read with care: until 2026-10-19 the app sent every
   "none of these" answer to the full list on purpose, and the review file showed the first
   listed entry as "got", so "hiccups again → Diaper" meant the model had said none. logeval's
   review rows now carry `model_category` / `model_event_type` (the model's own top answer) and
   `none_confidence`; read those. On the 42 not-a-log eval sentences the top-up says none for
   32 (mostly 89–97%); the 10 misses are near misses that name a log topic without reporting
   one ("we need more nappies" → diaper 94%, "remember to buy more formula" → bottle,
   "booked the six week check" → growth). The `none` top-up (configs/none.toml) and the
   category wording target them; the app now keeps a confident not-a-log as a note instead of
   asking (`Interpretation.isNotALog`, logeval's `none_noted_rate` and `lost_entry_rate`).
2. **Side on a switch** (side 90.3%): "switching sides, now left/right" leaves the side unsure.
   Settle in the spec whether `side` on a switch is the side switched to, then add data.
3. **"Done" without an amount**: "finished drinking" reads as drank all. A convention to confirm
   with the user.
4. **Untested**: real speech (record 100–200 sentences at night volume through the app's
   Whisper), latency on the iPhone, two events in one sentence, corrections ("no, the left").
