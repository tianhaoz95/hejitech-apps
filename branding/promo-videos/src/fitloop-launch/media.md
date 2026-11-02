# fitloop-launch media

Files in `public/fitloop-launch/` (git-ignored). Keep this list in step with the folder so the
edit can be rebuilt from a backup. The plan (story, characters, Flow prompts) and the review are the
report `reports/2026-11-01-fitloop-promo-video`.

| File | What it is | Source |
| ---- | ---------- | ------ |
| `Shot_1_draft_8b07ecbb_1080p.mp4` | Shot 1, the gym is guessing; Maya walks past Theo (used from 3.4 s) | Google Flow, by the owner, 1080p 24 fps 7.9 s |
| `Shot_2_draft_2dbd05aa_1080p.mp4` | Shot 2, Theo: "Wait, how many sets is this?" (1.0–2.8 s); Maya: "My agent wrote mine." (5.4–6.5 s) | Google Flow, with the characters' voices (Theo has no cap here) |
| `Shot_3_draft_09a6abcf_1080p.mp4` | Shot 3, the glance (0.4–2 s used; Flow's own fake display from ≈2 s and the ad-lib "Let's increase the weight for this set." are not used) | Google Flow |
| `Shot_4_draft_03caaeb0_1080p.mp4` | Shot 4, dumbbell down, the ring tap (used from 1.6 s) | Google Flow |
| `Shot_5_draft_dfd56833_1080p.mp4` | Shot 5, Maya's wince (0.7 s) and Theo toppling (4.5–6.2 s); its ad-libs are muted | Google Flow |
| `Shot_6_draft_caff71ad_1080p.mp4` | Shot 6, kitchen, the phone buzz (3.6–5.0 s, kept as a sound effect) | Google Flow |
| `Shot_7_draft_654094cd_1080p.mp4` | Shot 7, step-ups; Theo: "Okay. I'm getting an agent." (5.4–7.3 s); the first ≈3.5 s have a black film-frame border (not used) | Google Flow |
| `music-30s-take2-form-check.mp3` | Music for the 30 s cut (63 s, 103.4 BPM) | Flow Music, by the owner (picked by measurement over take 1) |
| `music-15s-take1-gym-sting.mp3` | Music for the 15 s cuts (61.5 s, 103.4 BPM) | Flow Music (picked over take 2) |
| `music-30s-take1-gym-pro-grooves.mp3`, `music-15s-take2-workout-hit.mp3` | The other takes, unused | Flow Music |
| `music-30-edit.wav` | The 30 s music as used: take 2 at 2.0–27.96 s, then 55.96 s to the end (48 beats later), 40 ms crossfade | ffmpeg `atrim` + `acrossfade` (command below) |
| `music-15-edit.wav` | The 15 s music as used: take 1 at 6.5–17.55 s, then 54.71 s to the end (64 beats later) | same |
| `rec-glasses-set.mp4`, `rec-glasses-rest.mp4`, `rec-glasses-hurts.mp4`, `rec-glasses-today.mp4` (spare) | The G2 display, 1728×864 green on black: goblet squat set 1 of 4 with heart rate; a tap and the rest timer; the hold menu on the reverse lunge to "Tell agent: It hurts" | Even Hub simulator, local stack, `scripts/fitloop-launch-record.mjs glasses` |
| `still-phone-reply.png`, `still-phone-today.png` (+ `rec-phone-*.mp4`, 4 s clips of them) | iPhone Feedback with the agent's reply; Today for Tue 2026-11-03 with the change note. 1206×2622 | iPhone 17 Pro simulator (iOS 26.5, "FL Promo iPhone"), `… phone` |
| `vo-af_sarah-<line>.wav` | The narration used (guess, plans, tap, hurts, reads, tag; puts for the 15 s) | Kokoro-82M, `scripts/fitloop-launch-vo.py`; af_sarah is closest in pitch to Maya's Flow voice (207 vs 197 Hz) |
| `vo-<voice>-<line>.wav` | af_heart, af_bella, af_nicole, bf_emma, unused | same |
| `icon.png` | The app icon on the end card | `projects/fitloop/branding/icon-1024.png` |

Caption timings and the beat grids (`voiceover.ts`) come from faster-whisper and librosa; redo them if
a file changes.

Music edits (from `public/fitloop-launch`):

```sh
ffmpeg -i music-30s-take2-form-check.mp3 -filter_complex "[0:a]atrim=2.0:27.98,asetpts=PTS-STARTPTS[a];[0:a]atrim=55.94:61.2,asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=0.04:c1=tri:c2=tri" -ar 48000 music-30-edit.wav
ffmpeg -i music-15s-take1-gym-sting.mp3 -filter_complex "[0:a]atrim=6.5:17.57,asetpts=PTS-STARTPTS[a];[0:a]atrim=54.69:59.6,asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=0.04:c1=tri:c2=tri" -ar 48000 music-15-edit.wav
```

Renders, one at a time. On 2026-11-01 Remotion's own headless shell never fired
`requestAnimationFrame` on this Mac (every composition, even a blank one, timed out "Waiting for root
component to load"), so the renders use Playwright's headless shell; with it the canvas-backed
`@remotion/media` `Video` doesn't scale to its box, which is why this composition uses `OffthreadVideo`
for the Flow shots and the glasses:

```sh
C=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
npx remotion render fitloop-launch-30 out/fitloop-launch-30.mp4 --concurrency=2 --browser-executable="$C"
# same for fitloop-launch-15 and fitloop-launch-15-vertical, then the two-pass loudnorm
# (measure with print_format=json, apply with the measured values and linear=true, -c:v copy) into out/final/
```

Measured after loudness: 30 s −14.5 LUFS (true peak −0.7 dBTP), 15 s cuts −14.5 LUFS (−1.4 dBTP).

## Subtitles

`node scripts/fitloop-launch-srt.mjs out/final` writes `fitloop-launch-30.srt`, `-15.srt` and
`-15-vertical.srt` from the composition's `SPEECH` table (copies in the report's `site/media/youtube/`,
with the thumbnails: end-card frames at 29.6 s and 14.8 s). Re-run and recopy after any re-cut.


Backup: _(not set up yet)_

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/yNye1ZyYcoQ (id `yNye1ZyYcoQ`)
- 15 s 9:16 Short: https://youtube.com/shorts/YGC6bK1CoMk (id `YGC6bK1CoMk`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
