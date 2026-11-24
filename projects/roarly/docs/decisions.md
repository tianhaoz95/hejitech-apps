# Roarly decisions

1. **What it is (owner, 2026-11-17).** A phone + watch app that listens while a parent tells a story
   and adds sound effects (animals, weather, things) to color play and bedtime stories. Existing apps
   (Novel Effect: book-tied; Noisy Book, Sound Stories: open-ended but screen-centric and unreliable)
   leave a gap for hands-free, context-aware, watch-friendly listening.
2. **Context over keywords.** A mention isn't enough: "a tiger is chasing you" plays, "the tiger is
   running away" doesn't. RoarlyKit's rules decide most cases at once (negation, leaving/sleeping,
   remembering, arriving, the sound word itself); unsure finished sentences go to a language model.
3. **Suggestions (owner).** Unsure sounds appear as cards to tap on the phone and the watch, and go
   away after ~9 s or when the story moves on. A tap uses up the cue (no double play).
4. **Phone detects, watch is the remote/speaker (owner).** While the phone app runs it listens and
   decides; sounds play on the phone or, if chosen, the watch. The watch-alone keyword detector was
   discussed but not built yet.
5. **Purely local (owner).** No account, backend or database (`BACKEND=none`). Sounds and the
   three ~1.3 MB story-sense classifiers (`en`, `es`, `zh`) ship in the app; the experimental
   Qwen3-0.6B-4bit model (~335 MB) is downloaded on demand in Settings via `MLXLMCommon` instead of
   bloating every install (`scripts/fetch_model.sh` still fetches it locally for `evals/`).
6. **Models (measured, `evals/director_cases.json`).** Apple's on-device model where available
   (18/22, ~0.25 s, misses only on the quiet side). Everywhere else the **story-sense classifier**:
   Create ML text classifiers (BERT embeddings, 1.3 MB each, ~10 ms on an iPhone 13) trained on
   sentences that Apple's model wrote across 10 situations (`ml/generate.swift`, `ml/train.swift`),
   with the sound's words masked (`THING` / `COSA` / `东西`) so one model covers every sound:
   English 20/22 on `director_cases` and 96.9% held-out; Spanish 96.1% held-out (345/359);
   Mandarin 90.5% held-out (323/357). The optional Qwen3-0.6B answered at chance (11/22), so it is
   an on-demand "experimental" download in Settings (ready if fine-tuned later).
7. **Speech.** `SpeechAnalyzer` + `SpeechTranscriber` (falls back to `DictationTranscriber`), with
   the catalog's words as contextual strings. iOS 26+. Verified on an iPhone 13 (iOS 27.2).
8. **Pricing (owner).** Free download; Roarly Pro = yearly subscription with a 1-week free trial, or
   a lifetime unlock. Free: 12 starter sounds and everything else. Pro: all sounds, your own words,
   the watch remote. Prices are placeholders the owner sets in App Store Connect.
9. **Sounds.** Public domain/CC0 recordings (Wikimedia Commons, OpenGameArt, NPS Yellowstone), one
   CC BY 4.0 (thunder, credited), a few synthesized (`tools/build_sounds.py`). Clips were chosen and
   trimmed with Apple's sound classifier (`tools/classify_sound.swift`). Duck, rooster, pig and goat
   were left out until a good free recording turns up.
10. **App Review 4.3.** Own look (storybook night: indigo, lantern amber, serif), own paywall
    ("Open the whole storybook"), own store text.
11. **Device testing without the mic prompt.** Stories read by Kokoro (mlx-audio, four voices) are
    streamed through the real on-device SpeechAnalyzer (`-listenFile`) and scored against
    `evals/stories/key.json` by `scripts/device_story_eval.sh`: 60/60 on 2026-11-17.
12. **Story languages as data (2026-11-18, owner).** English, Mandarin and Spanish, chosen in
    Settings. Each language is one i18n-style file, `RoarlyKit/Sources/RoarlyKit/Lexicons/<id>.json`
    (every sound's words plus the words for arriving, leaving, negation and endings, and how the
    language is read); no code is specific to a language, so adding one is adding a file and its
    `stories_<id>.json` eval. The app's screens stay in English for now. Checked on an iPhone 13
    with stories spoken by system voices (zh_CN, es_US).
