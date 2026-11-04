# fitloop-demo media

The FitLoop walkthrough video (skill `heji-demo-video`). Files live in the main checkout only:

`/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/fitloop-demo/` (git-ignored, flat)

Keep this list in step with the folder so the edit can be rebuilt from a backup (Flow takes can't be
regenerated exactly). The plan (chapters, step tables, Flow and music prompts) is the report
`reports/2026-11-02-fitloop-demo-video`.

| File | What it is | Source |
| ---- | ---------- | ------ |
| `icon.png` | App icon on end card | `projects/fitloop/branding/icon-1024.png` |
| `vo-af_sarah-<id>.wav` | Narration takes, one clip per line | Kokoro-82M (`scripts/fitloop-demo-vo.py`) |
| `Athletic_training_studio_interior_02060045_1080p.mp4` | A1 opener: modern athletic training studio with warm daylight | owner, Google Flow video |
| `Empty_gym_interior_at_night_f9e49980_2K.jpg` | A3 end card & opener still: empty gym at night | owner, Google Flow image |
| `Minimalist_modern_desk_setup_fac639df_2K.jpg` | B1 backdrop (chapter 1): desk workstation with tablet | owner, Google Flow image |
| `Espresso_cup_on_modern_desk_b9287a95_1080p.mp4` | B1 backdrop loop (chapter 1): espresso cup on modern desk | owner, Google Flow video |
| `Adjustable_leather_workout_bench…_71ffa9b3_2K.jpg` | B2 backdrop (chapter 2): workout bench with neatly racked dumbbells | owner, Google Flow image |
| `Workout_bench_in_quiet_gym_49b56c2a_1080p.mp4` | B2 backdrop loop (chapter 2): quiet gym workout bench | owner, Google Flow video |
| `Chalked_hands_gripping_pull_up_14681e3e_2K.jpg` | B3 backdrop (chapter 3): chalked hands gripping pull-up bar | owner, Google Flow image |
| `Chalked_hands_gripping_pull_up_a1b0e94e_1080p.mp4` | B3 backdrop loop (chapter 3): chalked hands video loop | owner, Google Flow video |
| `Chicken_salad_on_kitchen_island_4af1f987_2K.jpg` | B4 backdrop (chapter 4): sunlit kitchen island with healthy meal | owner, Google Flow image |
| `Kitchen_island_with_healthy_food_805a1d69_1080p.mp4` | B4 backdrop loop (chapter 4): kitchen island video loop | owner, Google Flow video |
| `Kettlebells_on_gym_floor_sunrise_1ac14484_1080p.mp4` | A2 bridge / recap: gym floor at sunrise with kettlebells | owner, Google Flow video |
| `music.mp3` | **The music** (warm tech-athletic groove) | `public/fitloop-launch/music-30s-take1-gym-pro-grooves.mp3` |
| `rec-glasses-today.mp4`, `rec-glasses-set.mp4`, `rec-glasses-rest.mp4`, `rec-glasses-hurts.mp4` | Even G2 workout display, set check-off, rest timer, pain feedback | Even Hub simulator |
| `rec-phone-today.mp4`, `rec-phone-reply.mp4` | iPhone Today tab workout player & pain replan reply | iPhone 17 Pro simulator |

## Expected

| Piece | File name | From |
| ----- | --------- | ---- |
| A1 opener, A2 bridge / recap, A3 end card art | `art-A1_…png`, `art-A2_…png`, `art-A3_…png` | owner, Google Flow images |
| B1–B4 backdrops (stills / loops) | `art-B1_…png` … / `B1_…1080p.mp4` … | owner, Google Flow |
| Music | `music-115s-take<n>-<title>.mp3`, trimmed edit `music-115-edit.wav` | owner, Flow Music |
| Recordings | `rec-1-agent`, `rec-2-workout`, `rec-3-glasses`, `rec-4-loop` (`.mp4` + `.events.json`) | `scripts/fitloop-demo-record.mjs`, local stack |
| Stills | `still-<screen>-<light/dark>.png` | same runs |
| Voiceover | `vo-af_sarah-<id>.wav` | `scripts/fitloop-demo-vo.py` (Kokoro) |

## Rebuild

```sh
# Generate voiceover audio
/tmp/heji-demo-venv/bin/python -I branding/promo-videos/scripts/fitloop-demo-vo.py \
  branding/promo-videos/public/fitloop-demo af_sarah

# Extract caption timings with faster-whisper
/tmp/heji-demo-venv/bin/python -I branding/promo-videos/scripts/fitloop-demo-words.py \
  branding/promo-videos/public/fitloop-demo af_sarah branding/promo-videos/src/fitloop-demo/voiceover.ts

# Render video compositions
npx remotion render fitloop-demo out/fitloop-demo.mp4 --concurrency=2
npx remotion render fitloop-demo-short out/fitloop-demo-short.mp4 --concurrency=2

# Two-pass loudnorm (-14 LUFS, TP -1.5)
ffmpeg -y -i out/fitloop-demo.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/final/fitloop-demo.mp4
ffmpeg -y -i out/fitloop-demo-short.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/final/fitloop-demo-short.mp4
```
