# g2digest-launch media

Files in `public/g2digest-launch/` (git-ignored). Keep this list in step with the folder so the
edit can be rebuilt from a backup (Flow takes can't be regenerated exactly). The plan (story,
characters, Flow prompts, music prompts) and the review are in the report `reports/2026-11-01-g2digest-promo-video`.

| File | What it is | Source |
| ---- | ---------- | ------ |
| `icon.png` | App icon for the end card | `projects/g2digest/docs/public/icon.png` |
| `Shot_1_draft_fa9eca7e_1080p.mp4` | Shot 1, into the tunnel (Flow audio muted: ad-libs) | owner, Google Flow |
| `Shot_2_draft_5077911d_1080p.mp4` | Shot 2, Bea "Is anyone's news loading?" (1.7–2.9 s), Sam "Mine was ready last night." (4.6–5.8 s), both used | owner, Google Flow |
| `Shot_3_draft_259dd7ac_1080p.mp4` | Shot 3, the glance (muted: hums) | owner, Google Flow |
| `Shot_4_draft_0657d1fc_1080p.mp4` | Shot 4, the ring (muted: ad-libs) | owner, Google Flow |
| `Shot_5_draft_78555101_1080p.mp4` | Shot 5, earbud, Bea at the window (muted: ad-libs) | owner, Google Flow |
| `Shot_6_draft_54e21e40_1080p.mp4` | Shot 6, the night before (muted) | owner, Google Flow |
| `Shot_7_draft_b0a34f35_1080p.mp4` | Shot 7, Bea "It loaded!" (2.2–2.8 s), "Oh, this is my stop." (4.4–5.7 s), both used | owner, Google Flow |
| `music-15s-take1-buffered-calm.mp3` | **The music in all three cuts** (103.4 BPM, re-cut on its bars) | owner, Flow Music |
| `music-15s-take2-…`, `music-30s-take1-…`, `music-30s-take2-…` | Other takes, ~1 min each, all 103.4 BPM; no stutter/stop opening | owner, Flow Music |
| `rec-glasses-open.mp4`, `rec-glasses-swipe.mp4`, `rec-glasses-deepdive.mp4` | Even Hub simulator, HUD green, 1728×864 | `scripts/g2digest-launch-record.mjs glasses` |
| `rec-web-brief.mp4`, `rec-web-edition.mp4`, `rec-web-full.mp4` (spare), `still-web-*.png` | Web app, dark, 1920×1080 | `scripts/g2digest-launch-record.mjs web` |
| `edition-reef-deep-dive.mp3`, `edition-tldr-glance.mp3` | The demo edition's own audio (Kokoro bf_emma), unused spares | `scripts/g2digest-launch-demo/make-audio.py` |
| `vo-<voice>-<line>.wav` | Narration, am_echo in the edit; am_michael, am_fenrir, am_puck, bm_george takes | `scripts/g2digest-launch-vo.py` |

## Rebuild

```sh
npx remotion render g2digest-launch-30 out/g2digest-launch-30.mp4 --concurrency=2   # then -15, -15-vertical, one at a time
# two-pass loudnorm (-14 LUFS, TP -1.5, linear) into out/final/<id>.mp4
node scripts/g2digest-launch-srt.mjs out/final                                     # subtitles for YouTube
```


Backup: _(not set up yet)_

## On YouTube (HEJI TECH channel, Public, verified 2026-11-02)

- 30 s 16:9: https://youtu.be/gcS32dRwPMo (id `gcS32dRwPMo`)
- 15 s 16:9: https://youtu.be/uTgo-X-M2p4 (id `uTgo-X-M2p4`)
- 15 s 9:16 Short: https://youtube.com/shorts/2PqpT3wgFcw (id `2PqpT3wgFcw`)

The 30 s cut is the embed: the project's landing page (click-to-play poster from its opening frame),
its docs page ("See it in 30 seconds"), its README, the HEJI home card and `pages/videos.md`.
