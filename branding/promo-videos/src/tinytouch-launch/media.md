# tinytouch-launch media

The TinyTouch launch promo. Plan, prompts, review and YouTube kit: `reports/2026-10-31-tinytouch-promo-video`
(serve with its `script/serve.sh`, port 8826). Media goes in `public/tinytouch-launch/` (git-ignored);
list every file here, since Flow takes can't be regenerated exactly. Back them up outside the repo.

| File | What | Source |
|---|---|---|
| `shot-1_2a383874_1080p.mp4` … `shot-6_7282292c_1080p.mp4` | Flow shots 1–6, every line landed, all used. Shot 2 has Flow's own "Hiii!" text burned in from 4.25 s (zoomed out of frame); shot 6 opens on a pink lit watch (used from 2.85 s); shot 5's ad-lib is muted | Google Flow (owner) |
| `30-sec-music-take-{1,2}.mp3`, `15-sec-music-take-{1,2}.mp3` | Music: full 1–2 min songs. In the edit: 30 s take 2, 15 s take 1 (104.1 BPM) | Flow Music (owner) |
| `rec-watch-{bubbles,animals,swipe,garden,shield}.mp4`, `rec-phone-remote.mp4`; spares `rec-watch-crown`, `rec-watch-moon` | The apps on paired iPhone 17 Pro + Watch Ultra 3 simulators (iOS/watchOS 26.5), touches by XCUITest | `scripts/tinytouch-launch-record.mjs` |
| `vo-<voice>-<line>.wav` | Narration in am_echo (in the edit, speed 1.16), am_fenrir, am_michael, am_puck, bm_george (1.08) | `scripts/tinytouch-launch-vo.py` (Kokoro-82M) |
| `icon.png` | End card icon | `projects/tinytouch/site/assets/images/app_icon.png` |

## Renders

`npx remotion render <id> out/<id>.mp4 --concurrency=2` for `tinytouch-launch-30`, `-15`, `-15-vertical`,
**one at a time**, then the two-pass loudnorm (−14 LUFS, TP −1.5, `linear=true`) into `out/final/` and
`node scripts/tinytouch-launch-srt.mjs out/final` for the subtitles. Copy `out/final/tinytouch-launch-*`
(MP4s, SRTs) and the posters/thumbnails into the report's `media/edit` and `media/youtube`.

## Published

See "On YouTube" below.

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/Q1qmSJNQtOw (id `Q1qmSJNQtOw`)
- 15 s 9:16 Short: https://youtube.com/shorts/JRmy2gbIT38 (id `JRmy2gbIT38`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
