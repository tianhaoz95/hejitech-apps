---
layout: home
hero:
  name: "Tether"
  text: "Plug your phone into a monitor. Get a tiling desktop workspace."
  tagline: "A self-contained split-pane desktop shell for iOS 17+ and Android 13+ with three built-in tools: a desktop-class Web browser, an SSH-only terminal with mandatory SHA-256 host key verification, and a Local + SFTP file browser."
  image:
    src: /tether/icon.png
    alt: Tether
  actions:
    - theme: brand
      text: Open Tether Web
      link: https://tether.hejitech.workers.dev
    - theme: alt
      text: Decisions
      link: /decisions
    - theme: alt
      text: Deployment
      link: /DEPLOY

features:
  - title: Tiling Split-Pane Shell
    details: Split horizontally or vertically up to 4 panes, drag dividers (clamped 0.2–0.8), toggle temporary pane maximise, or switch between 4 built-in layout presets without losing any open tabs.
  - title: Browser + SSH + Files Only
    details: Independent native WebViews per tab with desktop user-agent, an SSH-only 256-color terminal with Keychain/Keystore key generation and mandatory SHA-256 host key verification, and a Local + SFTP file browser.
  - title: Zero-Secret Cloud Sync & MCP
    details: Works 100% offline. Optional sign-in syncs only non-secret workspace metadata (pane tree, settings, bookmarks, host addresses) and exposes an OAuth 2.1 MCP server for your AI agents.
---

## Architecture Overview

```
Phone (iOS 17+ / Android 13+) ──USB-C Alt Mode Mirror──▶ External Monitor (16:9 / 16:10 Landscape)
  ├── DisplayHost (isolated scene/display boundary)
  ├── Tiling Workspace (recursive binary split tree, max 4 panes, 4 presets)
  │     ├── Web Tab    (WKWebView / android.webkit.WebView, desktop UA)
  │     ├── SSH Tab    (xterm-256color, SHA-256 host key check, Keychain/Keystore keys)
  │     └── Files Tab  (Local Documents/SAF + SFTP, insert path into focused terminal)
  └── Optional Sync ──HTTPS──▶ Tether Worker (https://tether.hejitech.workers.dev)
                                 ├── /api/* (non-secret workspace, hosts, bookmarks)
                                 ├── /mcp   (OAuth 2.1 + ttr_ personal agent tokens)
                                 └── Supabase `tether` schema
```
