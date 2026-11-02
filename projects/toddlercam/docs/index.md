---
layout: home
hero:
  name: "ToddlerCam"
  text: "A dual camera made for little hands"
  tagline: "Front and rear cameras at once, a big bouncy shutter, face-tracking emoji masks and a toddler lock, with the parent's Apple Watch as the remote. No account, no tracking, everything stays on the device."
  image:
    src: /toddlercam/icon.png
    alt: ToddlerCam
  actions:
    - theme: brand
      text: Visit ToddlerCam
      link: https://tianhaoz95.github.io/hejitech-apps/toddlercam/site/
    - theme: alt
      text: Source
      link: https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/toddlercam
features:
  - title: Both cameras at once
    details: AVCaptureMultiCamSession renders the front and rear feeds together (picture in picture) and saves a composite keepsake plus both single shots.
  - title: Watch remote
    details: The parent's Apple Watch fires the shutter, swaps cameras, picks face masks, locks the screen and plays attention-grabbing sounds over WatchConnectivity.
  - title: Kids Category, no backend
    details: No third-party SDKs, analytics or accounts. A parental gate guards settings; Guided Access setup is taught in the app.
---

## See it in 30 seconds

<div class="promo-video">
  <iframe src="https://www.youtube-nocookie.com/embed/kvPABm2YNLU?rel=0" title="ToddlerCam: a camera for little hands, and a remote on your watch (30 s)" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>

Four hundred photos of the back of his head, so Milo got his own camera: both cameras at once, and
the watch is the remote. His taps only make bubbles, and every photo stays on the phone. People and
scenes are AI-generated; in-app footage is demo footage. [Watch on YouTube](https://youtu.be/kvPABm2YNLU).

## Working on it

Everything is in [`projects/toddlercam`](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/toddlercam),
an XcodeGen project (`project.yml`) with three targets: `KidsCam` (iPhone/iPad, product
ToddlerCam, `com.hejitech.kidscam`), `KidsCamWatch` and `KidsCamWatchWidgets` (complications).

```sh
cd projects/toddlercam
xcodegen generate          # after changing project.yml or adding files
./Scripts/build.sh         # every target for the simulator
./Scripts/run_tests.sh     # unit tests
```

Releases: `scripts/cut_release.sh toddlercam --dry-run`, then `scripts/cut_release.sh toddlercam`
from the repo root. The `toddlercam-v<version>` release runs `toddlercam-testflight.yml`, which
uploads to TestFlight with the team's signing identities; it also runs weekly so builds never expire.
