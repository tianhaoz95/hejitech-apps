# headway-demo media

The Headway walkthrough video (skill `heji-demo-video`). Files live in the main checkout only:

`/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/headway-demo/` (git-ignored, flat)

Keep this list in step with the folder so the edit can be rebuilt from a backup (Flow takes can't be
regenerated exactly). The plan (chapters, step tables, Flow and music prompts) is the report
`reports/2026-11-02-headway-demo-video`.

| File | What it is | Source |
| ---- | ---------- | ------ |
| `icon.png` | App icon on end card | `projects/headway/branding/icon-1024.png` (copied from `headway-launch`) |
| `vo-af_heart-<id>.wav` | Narration takes, one clip per line | Kokoro-82M (`scripts/headway-demo-vo.py`) |
| `Commuter_waiting_for_train_ad7ded41_1080p.mp4` | A1 opener: commuter on platform at dusk with approaching electric train | owner, Google Flow video |
| `Dawn_breaking_over_train_platform_ef936758_2K.jpg` | A3 end card & opener still: sunlit terminal platform | owner, Google Flow image |
| `Coffee_cup_on_wooden_desk_ea1ce458_2K.jpg` | B1 backdrop (chapter 1): morning oak desk, coffee with subtle steam | owner, Google Flow image |
| `Steam_rising_from_coffee_cup_9744a41a_1080p.mp4` | B1 backdrop loop (chapter 1): steam rising from morning coffee | owner, Google Flow video |
| `Illuminated_dark_stone_textures_c60e1bcc_2K.jpg` | B2 backdrop (chapter 2): slate surface, emerald neon HUD glow | owner, Google Flow image |
| `Creating_futuristic_ambient_vide…_6a5496ec_1080p.mp4` | B2 backdrop loop (chapter 2): dark stone and emerald circuit traces | owner, Google Flow video |
| `Trains_passing_on_railway_tracks_c740b68d_2K.jpg` | B3 backdrop (chapter 3): rail tracks night timelapse, red & white streaks | owner, Google Flow image |
| `Night_timelapse_of_railway_tracks_3fdf43be_1080p.mp4` | B3 backdrop loop (chapter 3): night tracks motion blur | owner, Google Flow video |
| `Passenger_looking_out_train_window_70f7f078_2K.jpg` | B4 backdrop (chapter 4): modern train carriage interior looking out | owner, Google Flow image |
| `Train_carriage_passing_city_lights_a31219e1_1080p.mp4` | B4 backdrop loop (chapter 4): train window passing city lights | owner, Google Flow video |
| `Train_gliding_through_suburban_l…_31da0976_1080p.mp4` | A2 bridge / recap: aerial view of Caltrain gliding at sunrise | owner, Google Flow video |
| `music.mp3` | **The music** (warm tech-acoustic groove) | `public/headway-launch/30-sec-music-take-2.mp3` |
| `rec-glasses-board.mp4`, `rec-glasses-swipe.mp4` | Even G2 glasses display & R1 ring swipe interactions | Even Hub simulator |
| `rec-phone-leave.mp4`, `rec-phone-stop.mp4` | iPhone Trains live departures and arrival notifications | iPhone 17 Pro simulator |

## Expected

| Piece | File name | From |
| ----- | --------- | ---- |
| A1 opener, A2 bridge / recap, A3 end card art | `art-A1_…png`, `art-A2_…png`, `art-A3_…png` | owner, Google Flow images |
| B1–B4 backdrops (stills / loops) | `art-B1_…png` … / `B1_…1080p.mp4` … | owner, Google Flow |
| Music | `music-115s-take<n>-<title>.mp3`, trimmed edit `music-115-edit.wav` | owner, Flow Music |
| Recordings | `rec-1-commute`, `rec-2-glasses`, `rec-3-overtake`, `rec-4-track` (`.mp4` + `.events.json`) | `scripts/headway-demo-record.mjs`, local stack |
| Stills | `still-<screen>-<light/dark>.png` | same runs |
| Voiceover | `vo-af_heart-<id>.wav` | `scripts/headway-demo-vo.py` (Kokoro) |

## Rebuild

```sh
# Generate voiceover audio
/Volumes/DATA/Scratch/heji-video/kokoro-venv/bin/python -I branding/promo-videos/scripts/headway-demo-vo.py \
  branding/promo-videos/public/headway-demo af_heart

# Extract caption timings with faster-whisper
/Volumes/DATA/Scratch/heji-video/kokoro-venv/bin/python -I branding/promo-videos/scripts/headway-demo-words.py \
  branding/promo-videos/public/headway-demo af_heart branding/promo-videos/src/headway-demo/voiceover.ts

# Copy event logs if needed
cp public/headway-demo/*.events.json src/headway-demo/events/

# Render video compositions
npx remotion render headway-demo out/headway-demo.mp4 --concurrency=2
npx remotion render headway-demo-short out/headway-demo-short.mp4 --concurrency=2

# Two-pass loudnorm (-14 LUFS, TP -1.5)
ffmpeg -y -i out/headway-demo.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/final/headway-demo.mp4
ffmpeg -y -i out/headway-demo-short.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k out/final/headway-demo-short.mp4

# Stills and thumbnails
npx remotion still headway-demo-thumb out/final/headway-demo-thumbnail.jpg

# Subtitles and YouTube chapters
node scripts/headway-demo-srt.mjs out/final
```
