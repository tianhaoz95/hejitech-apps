# waypack-launch media

Files in `public/waypack-launch/` (git-ignored). Keep this list in step with the folder so the
edit can be rebuilt from a backup. The plan (story, characters, Flow prompts) and the review are the
report `reports/2026-11-01-waypack-promo-video`.

| File | What it is | Source |
| ---- | ---------- | ------ |
| `Shot_1_draft_0053f221_1080p.mp4` | Shot 1, the snowy pullout: Rosa and Pip by the car, Gus hunting for a bar (used from 4.4 s; ad-libs "I just need one bar to load the map", "He's been searching for an hour" muted) | Google Flow, by the owner, 1080p 24 fps 7.9 s |
| `Shot_2_draft_7f6bcbf6_1080p.mp4` | Shot 2, Gus: "Does anyone have a single bar?" (1.0–2.8 s); Rosa: "Don't need one." (4.3–5.1 s) | Google Flow, with the characters' voices |
| `Shot_3_draft_b1eb4bdb_1080p.mp4` | Shot 3, the glance (0.2–2.5 s; ad-libs muted) | Google Flow, 6 s |
| `Shot_4_draft_96bd62cb_1080p.mp4` | Shot 4, the car; Gus at the window (0.25–1.4 s). Not used after ≈3.5 s: the toddler sits in the front passenger seat | Google Flow, 6 s |
| `Shot_5_draft_0479c9b2_1080p.mp4` | Shot 5, the cabin lockbox; Gus topples off the porch (4.85–6 s) | Google Flow |
| `Shot_6_draft_3fd44a22_1080p.mp4` | Shot 6, at home with the laptop (0.4–1.6 s; the phone turns toward the camera after ≈3 s) | Google Flow |
| `Shot_7_draft_cf6f09dc_1080p.mp4` | Shot 7, sledding (0.15–1.3 s); Gus: "Okay. Where's the sledding hill?" (4.5–7.3 s) | Google Flow |
| `music-30s-take1-lost-on-the-mountain.mp3` | Music for the 30 s cut (66.8 s, 103.4 BPM) | Flow Music, by the owner (picked by measurement over take 2) |
| `music-15s-take1-road-trip-sting.mp3` | Music for the 15 s cuts (67.4 s, 103.4 BPM) | Flow Music (picked over take 2) |
| `music-30s-take2-lost-on-the-mountain.mp3`, `music-15s-take2-road-trip-sting.mp3` | The other takes, unused | Flow Music |
| `music-30-edit.wav` | The 30 s music as used: take 1 from 35.0 s to the end | ffmpeg `atrim` (below) |
| `music-15-edit.wav` | The 15 s music as used: take 1 at 5.35–8.59 s (intro into the stop), then 52.76 s to the end, 40 ms crossfade in the silence | ffmpeg `atrim` + `acrossfade` |
| `rec-phone-download.mp4`, `rec-phone-today.mp4`, `rec-phone-stay.mp4`, `rec-phone-plan.mp4`, `rec-phone-map.mp4` | The iPhone app, 1206×2622 30 fps: Download on Wi-Fi; Today (Now: Sledding & snow play) with zero bars; Where you're staying; day 2 and the backup plans; the offline map with the GPS dot along day 2's route | iPhone 17 Pro simulator ("WP Promo iPhone", iOS 27), local stack, `scripts/waypack-launch-record.mjs <udid> phone` |
| `rec-web-preview.mp4` | The live preview (1920×1080) as days 2 and 3 arrive | Playwright on the local Worker, `… web` |
| `vo-af_heart-<line>.wav` | The narration used (signal, planned, next, lodging, home, tag; agent for the 15 s) | Kokoro-82M, `scripts/waypack-launch-vo.py` |
| `vo-<voice>-<line>.wav` | af_bella, af_nicole, af_sarah, bf_emma, unused (af_sarah is closest in pitch to Rosa: 195 vs 186 Hz) | same |
| `icon.png` | App icon for the end card | `projects/waypack/site/img/logo-512.png` |

Caption timings and the beat grids (`voiceover.ts`) come from faster-whisper and librosa; redo them if
a file changes.

Music edits (from `public/waypack-launch`):

```sh
ffmpeg -i music-30s-take1-lost-on-the-mountain.mp3 -af "atrim=35.0:65.3,asetpts=PTS-STARTPTS" -ar 48000 music-30-edit.wav
ffmpeg -i music-15s-take1-road-trip-sting.mp3 -filter_complex "[0:a]atrim=5.35:8.59,asetpts=PTS-STARTPTS[a];[0:a]atrim=52.76:65.0,asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=0.04:c1=tri:c2=tri" -ar 48000 music-15-edit.wav
```

Recordings: the local stack (`supabase start`; in `projects/waypack/services/mcp`:
`node scripts/gen-sdk-assets.mjs` then `npx wrangler dev --var MAP_EXTRACTS:device`), then
`node projects/waypack/services/mcp/scripts/seed-dev.mjs promo@waypack.test`. The phone run copies
`scripts/waypack-launch-driver/promo_test.dart` into the app's `integration_test/` for the run. If a
system prompt is left on the simulator from an earlier run, `xcrun simctl erase <udid>` first.

Renders, one at a time, with Playwright's headless shell (Remotion's own shell timed out on this Mac):

```sh
C=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
npx remotion render waypack-launch-30 out/waypack-launch-30.mp4 --concurrency=2 --browser-executable="$C"
# same for waypack-launch-15 and waypack-launch-15-vertical, then the two-pass loudnorm
# (measure with print_format=json, apply with the measured values and linear=true, -c:v copy) into out/final/
```

Measured after loudness: 30 s −13.9 LUFS (true peak −1.4 dBTP), 15 s cuts −14.2 LUFS (−1.4 dBTP).

## Subtitles

`node scripts/waypack-launch-srt.mjs out/final` writes `waypack-launch-30.srt`, `-15.srt` and
`-15-vertical.srt` from the composition's `SPEECH` table (copies in the report's `site/media/youtube/`,
with the thumbnails: end-card frames at 29.6 s and 14.8 s). Re-run and recopy after any re-cut.


Backup: _(not set up yet)_

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/U1Hhwjfqh7c (id `U1Hhwjfqh7c`)
- 15 s 16:9: https://youtu.be/Ox_PClFfDcs (id `Ox_PClFfDcs`)
- 15 s 9:16 Short: https://youtube.com/shorts/fjj1S9f8iAE (id `fjj1S9f8iAE`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
