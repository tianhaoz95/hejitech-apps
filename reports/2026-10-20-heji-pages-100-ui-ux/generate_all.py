#!/usr/bin/env python3
"""
Full Generator for HEJI Pages · 100 UI/UX Improvements
Generates:
  - site/css/candidates.css
  - site/js/candidates.js
"""

import json
import os
import sys

DEST = os.path.dirname(os.path.abspath(__file__))

from data.css_styles import CSS_CONTENT
from data.candidates_part1 import CANDIDATES_PART1
from data.candidates_part2 import CANDIDATES_PART2
from data.candidates_part3 import CANDIDATES_PART3

# 1. Write CSS
css_path = os.path.join(DEST, "site/css/candidates.css")
with open(css_path, "w", encoding="utf-8") as f:
    f.write(CSS_CONTENT)
print(f"Wrote {css_path}")

# 1b. Write kit.js
from data.kit_content import KIT_JS
kit_path = os.path.join(DEST, "site/js/kit.js")
with open(kit_path, "w", encoding="utf-8") as f:
    f.write(KIT_JS)
print(f"Wrote {kit_path}")

# 2. Combine Candidates
ALL_CANDIDATES = CANDIDATES_PART1 + CANDIDATES_PART2 + CANDIDATES_PART3
print(f"Total candidates assembled: {len(ALL_CANDIDATES)}")

GROUPS = [
    {
        "id": "hero",
        "name": "1 · Hero, Above-the-Fold & First Impression",
        "note": "C01–C10: Interactive app docks, live terminal sandboxes, audience toggles & ambient solar glow"
    },
    {
        "id": "cards",
        "name": "2 · App Discovery, Cards & Interactive Demos",
        "note": "C11–C20: Bento layouts, hover micro-videos, version pills, QR popovers & comparison drawers"
    },
    {
        "id": "taxonomy",
        "name": "3 · Search, Filter & Ecosystem Taxonomy",
        "note": "C21–C30: Faceted pills, platform switcher, AI filters, Cmd+K palette & URL search state sync"
    },
    {
        "id": "status",
        "name": "4 · Monorepo CI/CD & Observability",
        "note": "C31–C40: Real-time pipeline pulse, TestFlight radar, DMG download center & migration timeline"
    },
    {
        "id": "docs",
        "name": "5 · Documentation Ergonomics & Deep Reading",
        "note": "C41–C50: Floating scroll spy, multi-pkg tabs, pan/zoom Mermaid, GitHub edit buttons & reader themes"
    },
    {
        "id": "mcp",
        "name": "6 · MCP Server Catalog & AI Agent Playground",
        "note": "C51–C60: Claude Desktop 1-click config, in-browser MCP tool runner, privacy matrices & agent trace viewer"
    },
    {
        "id": "feedbackkit",
        "name": "7 · Feedback Loop & Autonomous Agent Triage",
        "note": "C61–C70: Public feedback-to-PR Kanban, 'Is It Fixed?' verification, annotation demo & SLA tickers"
    },
    {
        "id": "mobile",
        "name": "8 · Mobile Navigation, Responsive UX & PWA",
        "note": "C71–C80: Bottom sheets, offline PWA, swipe carousels, haptic triggers & Dynamic Island padding"
    },
    {
        "id": "monorepo",
        "name": "9 · Monorepo Architecture & Open Source Story",
        "note": "C81–C90: Supabase schema isolation map, graduation calculator, file tree explorer & license guide"
    },
    {
        "id": "polish",
        "name": "10 · Micro-Interactions, Polish & Delight",
        "note": "C91–C100: Keyboard shortcut '?' overlay, app soundboard, View Transitions, custom 404 & confetti burst"
    }
]

# 3. Format candidates into JavaScript
cand_js_blocks = []
for c in ALL_CANDIDATES:
    obj = {
        "id": c["id"],
        "n": c["n"],
        "name": c["name"],
        "group": c.get("group", "hero"),
        "tagline": c.get("tagline", ""),
        "concept": c.get("concept", ""),
        "moves": c.get("moves", []),
        "palette": c.get("palette", []),
        "facts": c.get("facts", {}),
        "spec": c.get("spec", {}),
    }
    if c.get("baseline"):
        obj["baseline"] = True
    else:
        obj["round"] = 1

    # Format JSON
    json_str = json.dumps(obj, indent=6)
    # Inject render function
    render_func = c["render_code"]
    # Replace the closing brace with render function attached
    cand_block = json_str[:-1].rstrip() + f',\n      "render": {render_func}\n    }}'
    cand_js_blocks.append(cand_block)

candidates_array_js = ",\n".join(cand_js_blocks)
groups_json = json.dumps(GROUPS, indent=4)

context_files = [
    "pages/index.md",
    "pages/status.md",
    "pages/monorepo.md",
    "pages/.vitepress/config.mts",
    "pages/.vitepress/theme/custom.css",
    "pages/.vitepress/theme/StatusBoard.vue",
    "scripts/pages_sync.mjs",
    ".github/workflows/pages.yml"
]

candidates_file_content = f"""// HEJI Pages · 100 UI/UX Improvements Candidate Review
// Grounded in pages/ (index.md, status.md, monorepo.md, .vitepress/config.mts, theme/custom.css, theme/StatusBoard.vue)

(() => {{
  const K = window.KIT;

  window.REVIEW = {{
    key: "2026-10-20-heji-pages-100-ui-ux-v1",
    dir: "reports/2026-10-20-heji-pages-100-ui-ux",
    repo: "tianhaoz95/hejitech-apps",
    port: 8799,
    project: "pages",
    context: {json.dumps(context_files, indent=6)},
    brief: "Brainstorm 100 UI/UX improvements for the project site on GitHub Pages (https://tianhaoz95.github.io/hejitech-apps/). Spanning hero engagement, app cards, discovery taxonomy, CI/CD observability, documentation reading ergonomics, MCP agent catalogs, autonomous feedback loops, mobile responsive UX, monorepo architecture, and tactile micro-delight.",
    title: "HEJI Pages · 100 UI/UX Improvements",
    subtitle: "100 directions across 10 clusters + today's baseline",
    heading: "100 UI/UX Improvements for HEJI Pages",
    intro: "Explore 100 grounded UI/UX directions across 10 clusters for the GitHub Pages site (https://tianhaoz95.github.io/hejitech-apps/). Browse, rate with stars, heart your favorites, leave notes under candidates, pick winners per cluster, then click <b>Copy summary</b> to hand off.",
    legend: ["<b>100</b> UI/UX improvements", "<b>10</b> thematic clusters", "<b>1</b> live baseline"],
    round: 1,
    frame: "browser",
    url: "tianhaoz95.github.io/hejitech-apps/",
    groups: {groups_json},
    candidates: [
{candidates_array_js}
    ]
  }};
}})();
"""

out_js_path = os.path.join(DEST, "site/js/candidates.js")
with open(out_js_path, "w", encoding="utf-8") as f:
    f.write(candidates_file_content)

print(f"Wrote {out_js_path} successfully ({os.path.getsize(out_js_path)} bytes).")
