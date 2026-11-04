# g2digest-demo media

The G2 Digest walkthrough video (skill `heji-demo-video`). Files live in the main checkout only:

`/Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/g2digest-demo/` (git-ignored, flat)

Keep this list in step with the folder so the edit can be rebuilt from a backup (Flow takes can't be
regenerated exactly). The plan (chapters, step tables, Flow and music prompts) is the report
`reports/2026-11-02-g2digest-demo-video`.

| File | What it is | Source |
| ---- | ---------- | ------ |
| `A1_Glasses_and_ring_on_windowsill_0bbc10b6_1080p.mp4` | A1 opener: dawn, glasses and ring on the sill | owner, Google Flow |
| `A2_City_sunrise_timelapse_with_train_9c01ac76_1080p.mp4` | A2 bridge: night to sunrise over the viaduct (before chapter 4) | owner, Google Flow |
| `art-A3_Train_waiting_at_metro_platform_53d19a0d_2K.jpg` | A3 end card: sunlit platform | owner, Google Flow image |
| `art-B1_…`, `B1_Lamp_light_flickers_and_steams_feea8276_1080p.mp4` | B1 backdrop (chapter 1), still + loop | owner, Google Flow |
| `art-B2_…`, `B2_Green_lights_traveling_along_threads_007d5b5d_1080p.mp4` | B2 backdrop (chapter 2, path map), still + loop | owner, Google Flow |
| `art-B3_…`, `B3_Green_light_trails_flow_viaduct_e19a76be_1080p.mp4` | B3 backdrop (chapter 3), still + loop | owner, Google Flow |
| `art-B4_…`, `B4_Sunlight_moves_across_table_2d7766a9_1080p.mp4` | B4 backdrop (chapter 4, recap), still + loop | owner, Google Flow |
| `art-B5_…`, `B5_Train_moving_through_tunnel_lights_1c1dc915_1080p.mp4` | B5 backdrop (chapter 5, first card), still + loop | owner, Google Flow |
| `Shot_6_draft_54e21e40_1080p.mp4`, `Shot_7_draft_b0a34f35_1080p.mp4`, `icon.png` | Bridges and icon, copied from `public/g2digest-launch/` | the promo |
| `music-172s-take1-first-light-walkthrough.mp3` | **The music** (107.7 BPM; intro, then spliced on a bar into its ending) | owner, Flow Music ("First Light Walkthrough") |
| `rec-1-brief`, `rec-2-agents`, `rec-2-consent`, `rec-4-pair` (`.mp4` + `.events.json`, `still-*.png`) | Web app, dark, 1280×720 at 2× → 1920×1080 | `scripts/g2digest-demo-record.mjs brief / agents / agent / pair` |
| `agent-run.json` | The real Claude Code run's terminal byte stream with times (Sonnet, OAuth to the local MCP) | `… agent` |
| `rec-2-terminal`, `rec-2-connected`, `rec-3-agent` | That stream replayed into xterm.js (rec-3-agent time-lapsed; tool events from Claude Code's transcript) | `… term` |
| `rec-3-edition`, `rec-3-full` | The published edition: G2 preview, full edition with sources | `… edition` |
| `rec-4-glasses` (+ `-phone`), `rec-5-ride` | Even Hub simulator: pairing (phone webview + glasses), reading with the ring | `… glasses` |
| `vo-am_echo-<line>.wav` | Narration, one clip per line | `scripts/g2digest-demo-vo.py` (Kokoro am_echo) |

## Expected

| Piece | File name | From |
| ----- | --------- | ---- |
| A1 opener, A2 night → morning (video) | Flow's name with `A1_` / `A2_` in front | owner, Google Flow |
| A3 end card art, B1–B5 backdrops (stills) | `art-A3_…png`, `art-B1_…png` … | owner, Google Flow images |
| B1–B5 loops | Flow's name with `B1_` … in front | owner, Google Flow (Frames) |
| Bridges | `Shot_6_draft_54e21e40_1080p.mp4`, `Shot_7_draft_b0a34f35_1080p.mp4` | copied from `public/g2digest-launch/` |
| Music | `music-130s-take<n>-<title>.mp3`, the trimmed one `music-130-edit.wav` | owner, Flow Music |
| Recordings | `rec-1-brief`, `rec-2-agents`, `rec-2-consent`, `rec-3-agent`, `rec-3-edition`, `rec-4-pair`, `rec-4-phone`, `rec-4-glasses`, `rec-5-ride` (`.mp4` + `.events.json`) | `scripts/g2digest-demo-record.mjs`, local stack |
| Optional | `rec-4-even-app.mp4` (typing the code in the real Even app) | owner, iPhone screen recording |
| Stills | `still-<screen>-<light/dark>.png` | same runs |
| Voiceover | `vo-<voice>-<chapter>.wav` | `scripts/g2digest-demo-vo.py` (Kokoro) |

## Rebuild

```sh
# recordings (local stack; see the header of scripts/g2digest-demo-record.mjs), then always `restore`
/Volumes/DATA/Scratch/heji-video/kokoro-venv/bin/python -I scripts/g2digest-demo-vo.py $PWD/public/g2digest-demo am_echo
/Volumes/DATA/Scratch/heji-video/kokoro-venv/bin/python -I scripts/g2digest-demo-words.py $PWD/public/g2digest-demo am_echo src/g2digest-demo/voiceover.ts
cp public/g2digest-demo/*.events.json src/g2digest-demo/events/
npx remotion render g2digest-demo out/g2digest-demo.mp4 --concurrency=2         # then g2digest-demo-short, one at a time
# two-pass loudnorm (-14 LUFS, TP -1.5, linear) into out/final/<id>.mp4
npx remotion still g2digest-demo-thumb out/final/g2digest-demo-thumbnail.jpg   # and g2digest-demo-short-thumb
node scripts/g2digest-demo-srt.mjs out/final                                   # SRTs + YouTube chapter list
```

Also used (not in `public/`): `still-*.png`, `still-recap-*.jpg` and `edition-reef-*.mp3` (the agent's own
audio, copied from its build folder) are in `public/g2digest-demo/`; the agent's folder, pty rig and Kokoro
venv are in `/Volumes/DATA/Scratch/heji-video/`.

Backup: _(not set up yet)_
