# Roarly

An iPhone + Apple Watch app that listens while a parent tells a story and adds sound effects at the
right moment: the lion roars when it jumps out, rain falls when it starts to pour, a tiger running
away stays quiet. Purely local (`BACKEND=none`): no account, no backend, no data collection.
Decisions and their reasons: `docs/decisions.md`. Root `CLAUDE.md` has the monorepo rules.

## Layout

```
apps/ios/project.yml        XcodeGen (Roarly.xcodeproj is git-ignored): Roarly (iOS 26), RoarlyWatch
                            (watchOS 26, embedded), RoarlyUITests
apps/ios/RoarlyKit/         Swift package, no UI: SoundCatalog, TextNormalizer, CueMatcher,
                            ContextJudge, StoryEngine, DirectorPrompt, WatchLink (+ tests, story eval)
apps/ios/App/Sources/       AppModel (ties it together), Audio/AudioHub, Listening/SpeechListener,
                            Director/SmallModelDirector, Store/ProStore, Watch/PhoneWatchBridge,
                            Views/*, Debug/DebugFlags
apps/ios/App/Resources/     Sounds/*.m4a + CREDITS.txt (built by tools/build_sounds.py),
                            Models/Qwen3-0.6B-4bit (git-ignored: scripts/fetch_model.sh)
apps/ios/Watch/Sources/     WatchModel (remote + speaker), WatchViews
tools/                      build_sounds.py, classify_sound.swift (Apple's sound classifier as a
                            judge), make_icon.swift
evals/                      director_cases.json + director_eval.py (mlx-lm, bundled model) and
                            apple_director_eval.swift (Apple's model on a Mac)
scripts/                    fetch_model.sh, release_testflight.sh, asc_build_status.swift
docs/                       site pages (privacy, support, decisions) at /hejitech-apps/roarly/
```

## Commands

```sh
cd apps/ios/RoarlyKit && swift test           # engine, matcher, story eval, catalog ↔ sound files
scripts/fetch_model.sh                        # once per checkout (335 MB)
cd apps/ios && xcodegen generate
xcodebuild -project Roarly.xcodeproj -scheme Roarly -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

On the attached iPhone (preferred): build `-destination generic/platform=iOS` with the ASC key flags
(`-allowProvisioningUpdates -authenticationKey…`), `xcrun devicectl device install app`, then launch
with `xcrun devicectl device process launch --console com.hejitech.roarly -- <flags>`. The app logs
every decision as `[Roarly …]` lines.

Debug launch flags (`App/Sources/Debug/DebugFlags.swift`): `-skipOnboarding`, `-resetOnboarding`,
`-proUnlocked`, `-mode play|bedtime`, `-automation auto|balanced|ask`, `-showPaywall`, `-autoListen`,
`-demoStory` (scripted story through the real decision path, no mic), `-selfTest` (small model on the
director cases, logs answers + latency), `-listenFile <name>` (a recording copied into the app's
Documents with `devicectl device copy to --domain-type appDataContainer` is streamed through the
real SpeechAnalyzer instead of the mic: tests on-device speech without the permission prompt).

## How a decision is made

1. `SpeechListener` streams the mic (16 kHz via the analyzer's best format) into `SpeechAnalyzer`
   with `SpeechTranscriber` (`DictationTranscriber` on iPhones without it); the catalog's words are
   contextual strings. Partial ("volatile") and final text both go to `AppModel.heard`.
2. `StoryEngine.ingest` finds mentions (`CueMatcher`: triggers, inflections, multi-word phrases,
   shared sound words like "roared" go to the most recent matching cue) and scores each with
   `ContextJudge` (negation, leaving/asleep/quiet after, remembering before, arriving/acting, the
   sound word itself → 0.95). Thresholds per `Automation`, a bit stricter in Bedtime.
3. Sure → `.play` / `.startAmbient` at once, often from partial text (~1 s before the sentence
   ends). Unsure → `.suggest` (card on phone and watch, 9 s). Final unsure → `reviews` for
   `SmallModelDirector` (Apple's model; the bundled 0.6B only when opted in), 2.5 s limit; no answer
   leaves the card up. "The rain stopped", "the sun came out", "the end/good night" stop loops.
4. `AudioHub`: one `AVAudioEngine` with voice processing on the input (echo cancellation uses our
   own output as reference), a pool of one-shot player nodes, one looping node per bed with fades.

## Pitfalls

- **MLX never runs in the Simulator** (Metal allocator abort): `SmallModelDirector.builtInAvailable`
  is false there. Test the bundled model on the device (`-selfTest`).
- **The bundled 0.6B is weak at this task** (chance on the director eval). Don't make it the default
  without re-running `evals/director_eval.py`; Apple's model scored 18/22.
- **Audio tap blocks are built off the main actor** (`AudioHub.makeTap`, `SpeechListener.makeFeeder`):
  a closure formed in a `@MainActor` method and run on the audio thread trips isolation checks.
- **Sounds**: every catalog file must exist (RoarlyKit `SoundFileTests`). Add a sound in
  `tools/build_sounds.py` (with its credit) and the cue's `files`; keep the watch app under 75 MB
  (it bundles the same Sounds folder, ~4 MB now).
- **UI tests on the iPhone** need Settings › Developer › Enable UI Automation; otherwise
  "Timed out while enabling automation mode".
- What's New (`Views/WhatsNewView.swift`) must describe a version before `cut_release.sh` will cut it.

## Releasing

`scripts/cut_release.sh roarly --dry-run`, then `scripts/cut_release.sh roarly` from the repo root.
It bumps `MARKETING_VERSION` in `apps/ios/project.yml` and publishes `roarly-v<version>`, which runs
`.github/workflows/roarly-testflight.yml` (fetches the model, archives Roarly with RoarlyWatch,
uploads, waits for Apple's verdict). App Store Connect app: "Roarly: Story Sound Effects"
(6836171344, bundle `com.hejitech.roarly`). Pro products: `com.hejitech.roarly.pro.yearly`
(subscription, 1-week free trial) and `com.hejitech.roarly.pro.lifetime`.
