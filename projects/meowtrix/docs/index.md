---
layout: home
hero:
  name: "Meowtrix"
  text: "A remote workspace for vibe engineering"
  tagline: "Split panes in the browser, each tab a real terminal, a browser or a code editor, served by one small server on your own machine and reachable from any device. Desktop apps for macOS."
  image:
    src: /meowtrix/icon.png
    alt: Meowtrix
  actions:
    - theme: brand
      text: Visit Meowtrix
      link: https://tianhaoz95.github.io/hejitech-apps/meowtrix/site/
    - theme: alt
      text: Live demo
      link: https://tianhaoz95.github.io/hejitech-apps/meowtrix/site/demo/?demo
    - theme: alt
      text: Source
      link: https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/meowtrix

features:
  - title: Shells that survive
    details: PTYs live on the server and outlive connections, so a refresh, a dropped network or moving to another device picks up the same running shells.
  - title: Built for agents
    details: Schedule an Enter for when your quota resets, let agents open pages and files beside their pane (mtx CLI and MCP), and review their specs in CoDesign.
  - title: Your machine, no account
    details: Self-hosted, localhost by default, no backend. Install with one command or the macOS app; it updates itself from the newest release.
---

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/tianhaoz95/hejitech-apps/main/projects/meowtrix/install.sh | bash
```

Add `-s -- --service` to run it as a login service, or download the macOS app:
[Standalone](https://github.com/tianhaoz95/hejitech-apps/releases/download/meowtrix-latest/Meowtrix-Standalone-arm64.dmg) ·
[Lite](https://github.com/tianhaoz95/hejitech-apps/releases/download/meowtrix-latest/Meowtrix-Lite-arm64.dmg).

## How releases reach users

```mermaid
flowchart LR
    C["scripts/cut_release.sh meowtrix"] --> R["GitHub Release\nmeowtrix-v&lt;version&gt;"]
    R --> T["meowtrix-release.yml\nserver tarballs"]
    R --> M["meowtrix-mac-release.yml\nDMGs + Tauri updater"]
    T --> L["rolling release meowtrix-latest\ntarballs · VERSION · latest.json · DMGs"]
    M --> L
    L --> S["installed servers\n(VERSION → tarball)"]
    L --> D["desktop apps\n(latest.json)"]
    L --> I["install.sh"]
```

The monorepo's `releases/latest` belongs to another app, so everything that used it reads the
rolling `meowtrix-latest` release instead. Working on Meowtrix: `projects/meowtrix/CLAUDE.md`.
