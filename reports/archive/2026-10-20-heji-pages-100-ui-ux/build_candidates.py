#!/usr/bin/env python3
"""
Builder script for HEJI Pages 100 UI/UX Improvements Candidate Review.
Generates:
  - site/js/kit.js
  - site/css/candidates.css
  - site/js/candidates.js
"""

import json
import os
import sys

DEST = "reports/archive/2026-10-20-heji-pages-100-ui-ux"

# Ensure dirs exist
os.makedirs(os.path.join(DEST, "site/js"), exist_ok=True)
os.makedirs(os.path.join(DEST, "site/css"), exist_ok=True)

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

print(f"Loaded {len(GROUPS)} groups.")
