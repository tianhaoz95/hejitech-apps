# weehours-launch media

The Wee Hours launch promo. Plan, prompts and status: `reports/2026-10-30-weehours-promo-video`
(serve with its `script/serve.sh`, port 8825). Media goes in `public/weehours-launch/` (git-ignored);
list every file here, since Flow takes can't be regenerated exactly. Back them up outside the repo.

| File | What | Source |
|---|---|---|
| `shot-1_65cc9fbe_1080p.mp4` … `shot-7_10fad4de_1080p.mp4` | Flow shots 1–7, every line landed | Google Flow (owner) |
| `shot-5-remake_e1a99771_1080p.mp4` | Shot 5 again: the first take showed a child, not Mei. The edit uses this one (2.6 s phone, 4.5 s back to sleep) | Google Flow (owner) |
| `30-sec-music-take-{1,2}.mp3`, `15-sec-music-take-{1,2}.mp3` | Music; take 2 of each is in the edit | Flow Music (owner) |
| `rec-watch-listen`, `rec-phone-log`, `rec-watch-logged`, `rec-partner`, `rec-watch-tilt-{aim,confirm,done}`, `rec-watch-home` (spare) `.mp4` | The apps on paired iPhone + Watch simulators | `scripts/weehours-launch-record.mjs` |
| `vo-<voice>-<line>.wav` | Narration; `am_fenrir` is in the edit | `scripts/weehours-launch-vo.py` (Kokoro-82M) |
| `icon.png` | End card icon | `projects/weehours/apps/ios/App/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png` |

## Renders

`npx remotion render <id> out/<id>.mp4 --concurrency=2` for `weehours-launch-30`, `-15`, `-15-vertical`,
**one at a time** (parallel renders ran a 16 GB Mac out of memory), then the two-pass loudnorm into
`out/final/` and `node scripts/weehours-launch-srt.mjs out/final` for the subtitles.

## Published

See "On YouTube" below.

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/To1mquGs_JQ (id `To1mquGs_JQ`)
- 15 s 9:16 Short: https://youtube.com/shorts/KlSPWSPLU8Y (id `KlSPWSPLU8Y`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
