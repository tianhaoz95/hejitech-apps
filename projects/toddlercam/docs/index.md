---
layout: home
hero:
  name: "ToddlerCam"
  text: "A dual camera made for little hands"
  tagline: "Front and rear cameras at once, a big bouncy shutter, face-tracking emoji masks and a toddler lock, with the parent's Apple Watch as the remote. No account, no ads or tracking; photos stay on the device."
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
