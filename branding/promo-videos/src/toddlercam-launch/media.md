# toddlercam-launch media

The ToddlerCam launch promo. Plan, prompts and status: `reports/2026-10-31-toddlercam-promo-video`
(serve with its `script/serve.sh`, port 8827). Media goes in `public/toddlercam-launch/` (git-ignored);
list every file here, since Flow takes can't be regenerated exactly. Back them up outside the repo.

| File | What | Source |
|---|---|---|
| `shot-1_960421d8_1080p.mp4` … `shot-7_2990a114_1080p.mp4` | Flow shots 1–7; the lines "Milo! Look at Mommy!", "Mine!", "Mommy!", "Quack." landed; shots 3, 4, 6 have ad-libs (muted) | Google Flow (owner) |
| `30-sec-music-take-1.mp3`, `30-sec-music-take-2.mp3` | Music, 30 s prompt; take 2 is in the edit (the only take with the full stop) | Flow Music (owner) |
| `15-sec-music.mp3` | Music, 15 s prompt (one take) | Flow Music (owner) |
| `rec-dual`, `rec-watch-snap`, `rec-phone-snap`, `rec-lock` `.mp4` | The app on paired iPhone 17 Pro + Watch Series 11 simulators, its cameras fed with frames of shots 2, 3, 5 and 7; `T` in `Composition.tsx` says where the action is | `scripts/toddlercam-launch-record.mjs` |
| `rec-keepsake.mp4` | The gate and the gallery; its keepsake caught the back of Milo's head: not used, re-record after the simulator fix | same |
| `vo-<voice>-<line>.wav` | Narration in af_heart, af_bella, af_nicole, af_sarah, bf_emma; `af_heart` is in the edit | `scripts/toddlercam-launch-vo.py` (Kokoro-82M) |
| `quack.wav`, `shutter.wav` | The app's own sounds | `projects/toddlercam/KidsCam/Audio/` |
| `icon.png` | End card icon | `projects/toddlercam/AppStore/AppIcon-1024.png` |

The two "feed clips" from the plan weren't made: the recordings' camera feeds are cut from the story
shots instead (`SCENES` in the record script).

## Recording

Simulators only (never the real cameras). Build the Debug apps for the simulator into a derivedData
folder, and the small XCUITest driver (`scripts/toddlercam-launch-driver`, built outside the repo: an iOS and a watchOS UI-test bundle
whose tests drive `com.hejitech.kidscam` / `.watchkitapp` by bundle id: tap the bubble, the shutter,
Lock + taps, the parental gate's multiplication and the gallery; on the watch, Face Masks → Lion, Quack → shutter →
Review Last Photo, cueing the feed server at `127.0.0.1:8089/cue`). Then:

```sh
export TODDLERCAM_BUILD=<derivedData>/Build/Products TODDLERCAM_DRIVER=<driver derivedData>
node branding/promo-videos/scripts/toddlercam-launch-record.mjs feeds
node branding/promo-videos/scripts/toddlercam-launch-record.mjs dual   # then snap, lock, keepsake
node branding/promo-videos/scripts/toddlercam-launch-record.mjs restore
```

The camera feed redraws constantly, so XCUITest never sees the app idle: element queries stall, which is why the phone tests tap by position and the gate's answer comes from OCR (`TODDLERCAM_OCR`: `swiftc scripts/toddlercam-launch-driver/ocr.swift`). `simctl io screenshot` hangs while `recordVideo` runs on the same simulator. Each XCUITest run takes ~30 s to start, so the recordings are long; `T` in `Composition.tsx` says where
the action is in each file. Re-read it from the frames after re-recording.

## Renders

`npx remotion render <id> out/<id>.mp4 --concurrency=2` for `toddlercam-launch-30`, `-15`,
`-15-vertical`, **one at a time** (parallel renders ran a 16 GB Mac out of memory), then the two-pass
loudnorm into `out/final/` and `node scripts/toddlercam-launch-srt.mjs out/final` for the subtitles.

## Published

See "On YouTube" below.

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/kvPABm2YNLU (id `kvPABm2YNLU`)
- 15 s 9:16 Short: https://youtube.com/shorts/y3sMewPdtH4 (id `y3sMewPdtH4`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
