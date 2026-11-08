# fitloop-demo media

The FitLoop walkthrough (skill `heji-demo-video`). Files live in the main checkout only:
`/Volumes/proj/github/hejitech-apps/branding/promo-videos/public/fitloop-demo/` (git-ignored, flat).
Keep this list in step with the folder so the edit can be rebuilt from a backup (Flow takes and agent
runs can't be regenerated exactly). The plan and review: `reports/2026-11-02-fitloop-demo-video`.

## Used by the edit

| File | What it is | Source |
| ---- | ---------- | ------ |
| `icon.png` | App icon (opener, end card, thumbnails) | `projects/fitloop/branding/icon-1024.png` |
| `music.mp3` | The music: "Gym Pro Grooves" (103.4 BPM, 59 s), fitted to the cut on bar lines by `MusicBed` | owner, Flow Music (= `public/fitloop-launch/music-30s-take1-gym-pro-grooves.mp3`) |
| `vo-af_sarah-<id>.wav` | Narration, one file per line (c0-1 … c5-2, s-1 … s-6) | Kokoro-82M, `scripts/fitloop-demo-vo.py` |
| `Athletic_training_studio_interior_02060045_1080p.mp4` | A1 opener | owner, Google Flow video |
| `Empty_gym_interior_at_night_f9e49980_2K.jpg` | A3 end card, intro and recap backdrop | owner, Google Flow image |
| `Minimalist_modern_desk_setup_fac639df_2K.jpg`, `Espresso_cup_on_modern_desk_b9287a95_1080p.mp4` | B1 backdrop, chapter 1 | owner, Google Flow |
| `Adjustable_leather_workout_bench…_71ffa9b3_2K.jpg`, `Workout_bench_in_quiet_gym_49b56c2a_1080p.mp4` | B2 backdrop, chapter 2 | owner, Google Flow |
| `Chalked_hands_gripping_pull_up_14681e3e_2K.jpg`, `Chalked_hands_gripping_pull_up_a1b0e94e_1080p.mp4` | B3 backdrop, chapter 3, the Short, thumbnails | owner, Google Flow |
| `Chicken_salad_on_kitchen_island_4af1f987_2K.jpg` (portrait, fallback only), `Kitchen_island_with_healthy_food_805a1d69_1080p.mp4` | B4 backdrop, chapter 4 | owner, Google Flow |
| `Kettlebells_on_gym_floor_sunrise_1ac14484_1080p.mp4` | A2 bridge into the recap, recap backdrop | owner, Google Flow video |
| `rec-1-connect.mp4` | Web Settings → Agents (MCP) → Copy URL | `fitloop-demo-record.mjs connect` (Playwright) |
| `agent-run-1.json` | Live run 1: the pty byte stream with times and marks (sign-in, "Set up my training plan…", publish) | `… agent1` (Claude Code, local MCP) |
| `rec-1-consent.mp4` | FitLoop's consent page → Allow, recorded during run 1 | `… agent1` (Playwright) |
| `rec-1-terminal.mp4`, `rec-1-connected.mp4`, `rec-1-agent.mp4` | Run 1 replayed: `/mcp` sign-in; connected; the build (time-lapse) and summary | `… term 1` |
| `rec-1-today.mp4` | Phone: the agent's note and today's workout | `… phone1` (ios-uidriver) |
| `rec-2-workout.mp4` | Phone: open the workout, cues, Set done, rest timer | `… workout` |
| `rec-3-pair.mp4` | Phone: Settings → Pair glasses → code | `… pair` |
| `rec-3-glasses.mp4` | G2: today, open, set done + rest, next exercise, hold → It hurts (heart rate sent by the recorder) | `… glasses` (Even Hub simulator) |
| `rec-4-meal.mp4` | Phone: lunch → Ate it | `… meal` |
| `agent-run-2.json`, `rec-4-agent.mp4` | Live run 2 ("I left a note…"): reads it, publishes v2, replies; replayed | `… agent2`, `… term 2` |
| `rec-4-reply.mp4`, `rec-4-next.mp4` | Phone: the note and the reply; today's workout in v2 | `… phone2` |
| `still-1-connect.png`, `still-1-today.png`, `still-2-workout.png`, `still-3-today.png`, `still-4-reply.png`, `still-4-next.png` | Stills for the intro, recap and thumbnails | the same runs |

Every `rec-*.mp4` has a `rec-*.events.json` next to it (copied into `src/fitloop-demo/events/`, which the edit imports).

## Left from the first pass (not used)

`rec-glasses-*.mp4`, `rec-phone-*.mp4` (promo clips), the old `vo-af_sarah-*` takes were replaced.

## Rebuild

```sh
V=/Volumes/proj/scratch/heji-video/kokoro-venv/bin/python
$V -I branding/promo-videos/scripts/fitloop-demo-vo.py /Volumes/proj/github/hejitech-apps/branding/promo-videos/public/fitloop-demo af_sarah
$V -I branding/promo-videos/scripts/fitloop-demo-words.py /Volumes/proj/github/hejitech-apps/branding/promo-videos/public/fitloop-demo af_sarah branding/promo-videos/src/fitloop-demo/voiceover.ts
cp branding/promo-videos/public/fitloop-demo/rec-*.events.json branding/promo-videos/src/fitloop-demo/events/

cd branding/promo-videos
B=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)   # Remotion's own shell hangs here
npx remotion render fitloop-demo out/fitloop-demo.mp4 --concurrency=2 --browser-executable=$B
npx remotion render fitloop-demo-short out/fitloop-demo-short.mp4 --concurrency=2 --browser-executable=$B
npx remotion still fitloop-demo-thumb out/final/fitloop-demo-thumbnail.jpg --browser-executable=$B
npx remotion still fitloop-demo-short-thumb out/final/fitloop-demo-short-thumbnail.jpg --browser-executable=$B
# two-pass loudnorm to -14 LUFS / -1.5 dBTP into out/final/, then:
node scripts/fitloop-demo-srt.mjs out/final
```
