---
layout: home
hero:
  name: "TinyTouch"
  text: "Toddler lock and gentle play on Apple Watch"
  tagline: "Hand your watch to a toddler without 911 calls or swiped-away apps: every touch and the Digital Crown become calm, pentatonic play, exits sit behind a 3-second parent hold, and the iPhone is the remote. No account, no data collection."
  image:
    src: /tinytouch/icon.png
    alt: TinyTouch
  actions:
    - theme: brand
      text: Visit TinyTouch
      link: https://tianhaoz95.github.io/hejitech-apps/tinytouch/site/
    - theme: alt
      text: Source
      link: https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/tinytouch
features:
  - title: Accidental-touch shield
    details: Full-screen gesture capture, the Digital Crown turned into a toy, and a 3-second Parent Shield in front of every exit.
  - title: Five low-stimulation games
    details: Bubbles, animal friends, a pentatonic sound garden, sparkles and a sleepy-moon lullaby when the session timer ends.
  - title: iPhone remote, no backend
    details: The companion switches games, starts the lullaby and shows live touch counts over WatchConnectivity. Kids Category, nothing leaves the devices.
---

## Working on it

Everything is in [`projects/tinytouch`](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/tinytouch):
the iPhone companion (`TinyTouchiOS`, `com.tianhaoz.tinytouch`), the watch app (`ToddlerPlay`) and
its complication (`TinyTouchWidget`). `tools/generate_project.py` writes `ToddlerPlay.xcodeproj`.

```sh
cd projects/tinytouch
swift tools/run_tests.swift          # standalone test suite
python3 tools/generate_project.py    # after adding/removing files or changing build settings
```

Releases: `scripts/cut_release.sh tinytouch --dry-run`, then `scripts/cut_release.sh tinytouch`
from the repo root. The `tinytouch-v<version>` release runs `tinytouch-testflight.yml`, which uploads
to TestFlight with the team's signing identities; it also runs weekly so builds never expire.
