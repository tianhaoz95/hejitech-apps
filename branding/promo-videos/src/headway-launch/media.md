# headway-launch media

Files in `public/headway-launch/` (git-ignored). Keep this list in step with the folder so the
edit can be rebuilt from a backup. The plan (story, characters, Flow prompts) is the report
`reports/2026-10-30-headway-promo-video`.

| File                                             | What it is                                                                                                            | Source                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `shot-1_3dd25f09_1080p.mp4`                      | Shot 1, the city runs, Lin strolls with her coffee                                                                    | Google Flow, by the owner, 1080p 24 fps 7.9 s                                                                |
| `shot-2_8a274762_1080p.mp4`                      | Shot 2, Max: "Hold the door!" (0.1–0.9 s), doors close; Lin: "Me? I don't run." (6.6–7.6 s)                           | Google Flow, with the characters' voices                                                                     |
| `shot-3_71eace70_1080p.mp4`                      | Shot 3, Lin glances up, green glow (~1 s)                                                                             | Google Flow                                                                                                  |
| `shot-4_e9ea69f9_1080p.mp4`                      | Shot 4, the ring on her coffee hand, then her smug nod                                                                | Google Flow                                                                                                  |
| `shot-5_5067d91a_1080p.mp4`                      | Shot 5, café: croissant, the phone, she strolls out                                                                   | Google Flow (its own line "Looks like it's time to head out!" is not used)                                   |
| `shot-6_615d6383_1080p.mp4`                      | Shot 6, Lin reading on the train; Max asleep (5–6 s)                                                                  | Google Flow (laptop logo at the end: not used)                                                               |
| `shot-7_f2f5bf02_1080p.mp4`                      | Shot 7, Max at the window: "Oh no! Wait! Stop the train! Let me off!" (1.8–5.0 s); Lin: "Bye, Max!" (5.2–5.9 s)       | Google Flow                                                                                                  |
| `30-sec-music-take-2.mp3`                        | Music for the 30 s cut (40 s, ~99 BPM, stop-start opening, groove from ~6.5 s into the cut); the edit uses 7.4–37.7 s | Flow Music, by the owner (picked over take 1: a flat 112 BPM groove)                                         |
| `15-sec-music-take-2.mp3`                        | Music for the 15 s cuts (65 s, ~103 BPM, a stop then a final hit); the edit uses 46.6–61.9 s                          | Flow Music (picked over take 1: no ending accent)                                                            |
| `30-sec-music.mp3`, `15-sec-music.mp3`           | Take 1 of each, unused                                                                                                | Flow Music                                                                                                   |
| `rec-glasses-board.mp4`, `rec-glasses-swipe.mp4` | The glasses display (SF → Palo Alto, 618 ok, 620 +4), then three ring swipes down and one up; 1728×864 green on black | Even Hub simulator, local stack, `scripts/headway-launch-record.mjs glasses`                                 |
| `rec-phone-leave.mp4`                            | Trains tab, then the "Leave now for the 11:55" banner (lands at 3.77 s); 1320×2868                                    | iPhone 17 Pro Max simulator, `simctl push`, `scripts/headway-launch-record.mjs phone`                        |
| `rec-phone-stop.mp4`                             | Commute tab, then "Palo Alto in 5 min" (lands at 3.2 s)                                                               | same                                                                                                         |
| `vo-af_heart-<line>.wav`                         | The narration used, one file per line (city, wear, ring, taps, stop, tag; puts, go for the 15 s cut)                  | Kokoro-82M, `scripts/headway-launch-vo.py`; af_heart is closest in pitch to Lin's Flow voice (199 vs 204 Hz) |
| `vo-<voice>-<line>.wav`                          | Other voices (af_bella, af_nicole, af_sky, af_aoede), unused                                                          | same                                                                                                         |
| `icon.png`                                       | The app icon on the end card                                                                                          | `projects/headway/branding/icon-1024.png`                                                                    |

Caption timings and the music's beat grids (`voiceover.ts`) come from faster-whisper and librosa;
redo them if a file changes.

Renders: `npx remotion render headway-launch-30|headway-launch-15|headway-launch-15-vertical
out/<id>.mp4`, then `ffmpeg -i out/<id>.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k
out/final/<id>.mp4`.

Backup: _(not set up yet)_

## Subtitles

`node scripts/headway-launch-srt.mjs out/final` writes `headway-launch-30.srt`, `-15.srt` and
`-15-vertical.srt` from the composition's `SPEECH` table (copies in the report's `site/media/youtube/`,
with the thumbnails: end-card frames at 29.0 s and 14.6 s). Re-run and recopy after any re-cut.

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/dAxVDil4ARA (id `dAxVDil4ARA`)
- 15 s 9:16 Short: https://youtube.com/shorts/g0088LeISt8 (id `g0088LeISt8`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
