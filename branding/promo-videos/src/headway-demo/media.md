# headway-demo media

The Headway walkthrough (skill `heji-demo-video`). Files live in the main checkout only:
`/Volumes/proj/github/hejitech-apps/branding/promo-videos/public/headway-demo/` (git-ignored, flat).
Keep this list in step with the folder. The plan and review: `reports/2026-11-02-headway-demo-video`.

## Used by the edit

| File | What it is | Source |
| ---- | ---------- | ------ |
| `icon.png` | App icon (opener, end card, thumbnails) | `projects/headway/branding/icon-1024.png` |
| `music-68s-take1-commute-groove.mp3` | The music (99.4 BPM, 68 s), fitted on bar lines by `MusicBed` | owner, Flow Music (= `public/headway-launch/15-sec-music.mp3`) |
| `vo-af_heart-<id>.wav` | Narration, one file per line (c0-1 … c5-2, s-1 … s-5) | Kokoro-82M, `scripts/headway-demo-vo.py` |
| `Commuter_waiting_for_train_ad7ded41_1080p.mp4` | A1 opener | owner, Google Flow video |
| `Dawn_breaking_over_train_platform_ef936758_2K.jpg` | A3 end card, intro and recap backdrop | owner, Google Flow image |
| `Coffee_cup_on_wooden_desk_ea1ce458_2K.jpg`, `Steam_rising_from_coffee_cup_9744a41a_1080p.mp4` | B1, chapter 1 | owner, Google Flow |
| `Illuminated_dark_stone_textures_c60e1bcc_2K.jpg`, `Creating_futuristic_ambient_vide…_6a5496ec_1080p.mp4` | B2, chapter 2 | owner, Google Flow |
| `Trains_passing_on_railway_tracks_c740b68d_2K.jpg`, `Night_timelapse_of_railway_tracks_3fdf43be_1080p.mp4` | B3, chapter 3, the Short, thumbnails | owner, Google Flow |
| `Passenger_looking_out_train_window_70f7f078_2K.jpg`, `Train_carriage_passing_city_lights_a31219e1_1080p.mp4` | B4, chapter 4 | owner, Google Flow |
| `Train_gliding_through_suburban_l…_31da0976_1080p.mp4` | A2 bridge into the recap, recap backdrop | owner, Google Flow video |
| `rec-1-commute.mp4`, `rec-1-board.mp4` | Commute tab; Trains with the Catch card (demo clock Mon 7:30) | `headway-demo-record.mjs phone1` (ios-uidriver) |
| `rec-2-pair.mp4`, `rec-2-glasses.mp4` | Pairing code; the G2 board, swipe, flip, menu | `… pair`, `… glasses` (Even Hub simulator) |
| `rec-3-board.mp4`, `rec-3-hud.mp4`, `rec-3-push.mp4` | 113 late → Wait for 511 Express; the HUD footer tip; the alert (Mon 8:02) | `… late` |
| `rec-4-track.mp4`, `rec-4-arrival.mp4`, `rec-4-eta.mp4` | Track, Share live ETA, Dynamic Island, Live Activity; arrival alert; the shared page | `… track`, `… eta` |
| `still-1-board.png`, `still-2-board.png`, `still-3-board.png`, `still-3-hud.png`, `still-4-lock.png`, `still-4-eta.png` | Stills for the intro, recap and thumbnails | the same runs |

Every `rec-*.mp4` has `rec-*.events.json` next to it (copied into `src/headway-demo/events/`).

## Not used any more

`music.mp3` (the 40 s promo take), `rec-glasses-*.mp4`, `rec-phone-*.mp4` (promo clips), and the art-* names in the old plan.

## Rebuild

Re-record (local stack; each scene sets the Worker's demo clock itself): see the report's §Recordings. Then:

```sh
V=/Volumes/proj/scratch/heji-video/kokoro-venv/bin/python
$V -I branding/promo-videos/scripts/headway-demo-vo.py /Volumes/proj/github/hejitech-apps/branding/promo-videos/public/headway-demo af_heart
$V -I branding/promo-videos/scripts/headway-demo-words.py /Volumes/proj/github/hejitech-apps/branding/promo-videos/public/headway-demo af_heart branding/promo-videos/src/headway-demo/voiceover.ts
cd branding/promo-videos
B=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
npx remotion render headway-demo out/headway-demo.mp4 --concurrency=2 --browser-executable=$B
npx remotion render headway-demo-short out/headway-demo-short.mp4 --concurrency=2 --browser-executable=$B
# two-pass loudnorm to -14 LUFS with a -1.5 dBTP limiter into out/final/, then:
node scripts/headway-demo-srt.mjs out/final
```
