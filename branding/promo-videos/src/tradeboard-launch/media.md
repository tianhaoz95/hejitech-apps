# tradeboard-launch media

Files in `public/tradeboard-launch/` (git-ignored). Keep this list in step with the folder so the
edit can be rebuilt from a backup.

| File                                                                       | What it is                                               | Source                                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Shot-1_87539a4b_1080p.mp4`                                                | Shot 1, kitchen at night, the hesitating thumb           | Google Flow (Veo), kept take, 1080p 24 fps 7.9 s                                                          |
| `Shot-2_a833eec8_1080p.mp4`                                                | Shot 2, laptop with a green screen, dolly in             | Google Flow, kept take                                                                                    |
| `Shot-3_c4b1bc1f_1080p.mp4`                                                | Shot 3, glowing spheres debate around a sheet            | Google Flow, kept take                                                                                    |
| `Shot-4_a56449eb_1080p.mp4`                                                | Shot 4, phone with a green screen on a sidewalk, one tap | Google Flow, kept take                                                                                    |
| `Shot-5_81ca53f9_1080p.mp4`                                                | Shot 5, small computer on a shelf, teal light            | Google Flow, kept take                                                                                    |
| `Shot-6_aa07334d_1080p.mp4`                                                | Shot 6, six lights turn teal, the last stays amber       | Google Flow, kept take                                                                                    |
| `Shot-7_23b429a3_1080p.mp4`                                                | Shot 7, animated end card                                | Google Flow, from `end-card-16x9.jpg`                                                                     |
| `board.jpg`, `plan-msft.jpg`                                               | On the laptop in shot 2                                  | report `site/media/screens/`                                                                              |
| `plan-cost-phone.jpg`                                                      | On the phone in shot 4                                   | report `site/media/screens/`                                                                              |
| `msft-thread.jpg`, `cost-actions.jpg`, `msft-receipt.jpg`                  | Close-up cutaways in shots 3, 4, 5                       | report `site/media/closeups/`                                                                             |
| `executor.jpg`                                                             | Cutaway in shot 5                                        | report `site/media/screens/`                                                                              |
| `end-card-16x9.jpg`                                                        | Still end card (spare)                                   | report `site/media/brand/`                                                                                |
| `rec-board.mp4`, `rec-debate.mp4`, `rec-receipt.mp4`, `rec-failclosed.mp4` | Real portal recordings, 1920×1080 30 fps                 | `scripts/tradeboard-launch-record.mjs` (local stack, dry-run); copies in the report's `media/recordings/` |
| `rec-approve.mp4`                                                          | Phone recording of the approve tap, 1080×2340            | same script                                                                                               |

v2 plan (report §3): shots 2 and 4 are being regenerated without green screens (`Shot-2v2.mp4`, `Shot-4v2.mp4`).
| `vo-30-<voice>.wav`, `vo-15-<voice>.wav` | Voiceover takes, voices af_heart, af_bella, am_michael, am_fenrir, bf_emma (24 kHz mono) | Kokoro-82M, `scripts/tradeboard-launch-vo.py`; the owner picks one |

Not yet: `music-30.wav`, `music-15.wav` (Flow Music, made by the owner from report §5).

The green-screen tracks in `tracks/` come from `node scripts/track-green.mjs <clip> <out.json>`;
rerun it when a green-screen take is replaced.

Backup: _(not set up yet)_
| File | What it is | Source |
|---|---|---|
| `Shot-1_87539a4b_1080p.mp4` | Shot 1, kitchen at night, the hesitating thumb | Google Flow (Veo), kept take, 1080p 24 fps 7.9 s |
| `Shot-2-v2_ab3266c7_1080p.mp4` | Shot 2 v2, laptop lid to camera, face lit by the screen | Google Flow, regenerated (report §4) |
| `Shot-3_c4b1bc1f_1080p.mp4` | Shot 3, glowing spheres debate (film border baked in, zoomed past) | Google Flow, kept take |
| `Shot-4-v2_56e49459_1080p.mp4` | Shot 4 v2, phone seen from the front, the tap | Google Flow, regenerated |
| `Shot-5_81ca53f9_1080p.mp4` | Shot 5, small computer on a shelf, teal light | Google Flow, kept take |
| `Shot-6_aa07334d_1080p.mp4` | Shot 6, six lights, the last stays amber | Google Flow, kept take |
| `Shot-7_23b429a3_1080p.mp4` | Shot 7, animated end card (16:9 cuts) | Google Flow, from `end-card-16x9.jpg` |
| `end-card-9x16.jpg` | End card still for the 9:16 cut | report `site/media/brand/` |
| `rec-board.mp4`, `rec-debate.mp4`, `rec-receipt.mp4`, `rec-failclosed.mp4` | Real portal recordings, 1920×1080 30 fps | `scripts/tradeboard-launch-record.mjs` (local stack, dry-run) |
| `rec-approve.mp4` | Phone recording of the approve tap, 1080×2340 | same script |
| `vo-30-am_michael.wav`, `vo-15-am_michael.wav` | The voiceover used (picked by the owner) | Kokoro-82M, `scripts/tradeboard-launch-vo.py` |
| `vo-<cut>-<voice>.wav` (other voices) | Unused voiceover takes | same |
| `30-sec-music.mp3` (116 s), `15-sec-music.mp3` (59 s) | Music; the edit uses each track's last 30.8 s / 15.7 s (from 85.217 s / 43.328 s), 103.4 BPM | Flow Music (Lyria), by the owner |
| `Shot-2_…`, `Shot-4_…` (v1), `board.jpg`, `plan-*.jpg`, closeups, `end-card-16x9.jpg` | v1 green-screen takes and stills, no longer used | Google Flow / report |

Caption timings (`voiceover.ts`) come from a Whisper pass over the am_michael takes; redo them if
the voiceover changes.

Renders: `npx remotion render tradeboard-launch-30|tradeboard-launch-15|tradeboard-launch-15-vertical
out/<id>.mp4`, then `ffmpeg -i out/<id>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k
out/final/<id>.mp4`.

Backup: _(not set up yet)_

## YouTube

The 30 s cut is on YouTube as `7zRrCZNjr8s` (uploaded from `out/final/tradeboard-launch-30.mp4`).
Its captions file comes from the voiceover timings:
`node --experimental-strip-types scripts/tradeboard-launch-srt.mjs > out/tradeboard-launch-30.srt`.
