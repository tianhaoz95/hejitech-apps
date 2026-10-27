#!/usr/bin/env python3
import json
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from round2_cands import get_r2_candidates, get_r2_grids
from even_grids import get_grid

def make_cand_js(id, n, group, name, tagline, concept, moves, palette, facts, svg_content, mono_content, grid_content, baseline=False, round_num=2):
    moves_js = json.dumps(moves)
    palette_js = json.dumps(palette)
    facts_js = json.dumps(facts)
    grid_js = json.dumps(grid_content.strip())
    tagline_js = json.dumps(tagline)
    concept_js = json.dumps(concept)
    base_js = 'baseline: true, ' if baseline else ''
    return f"""    {{
      id: "{id}", n: {n}, group: "{group}", name: "{name}", {base_js}prefers: "dark", round: {round_num},
      tagline: {tagline_js},
      concept: {concept_js},
      moves: {moves_js},
      palette: {palette_js},
      facts: {facts_js},
      evenGrid: {grid_js},
      svg: () => `
{svg_content.strip()}
      `,
      svgMono: () => `
{mono_content.strip()}
      `,
    }},"""

cands_js = []

# 1. Baseline (Candidate 0)
current_svg = """
<defs>
  <linearGradient id="bg_curr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14112b"/><stop offset="1" stop-color="#05040f"/></linearGradient>
  <filter id="glow_curr" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="1024" height="1024" fill="url(#bg_curr)"/>
<g fill="none" stroke-linecap="round" filter="url(#glow_curr)"><path d="M512 196 A316 316 0 1 1 238 354" stroke="#ff7a45" stroke-width="58"/></g>
<path d="M290 262 L292 420 L154 344 Z" fill="#ff7a45" stroke="#ff7a45" stroke-width="16" stroke-linejoin="round" filter="url(#glow_curr)"/>
<g fill="#ffd2bf" filter="url(#glow_curr)">
  <rect x="352" y="488" width="320" height="48" rx="24"/><rect x="322" y="420" width="56" height="184" rx="22"/><rect x="646" y="420" width="56" height="184" rx="22"/>
  <rect x="282" y="452" width="40" height="120" rx="16"/><rect x="702" y="452" width="40" height="120" rx="16"/>
</g>
"""
current_mono = """
<rect width="1024" height="1024" fill="#000"/><path d="M512 196 A316 316 0 1 1 238 354" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M290 262 L292 420 L154 344 Z" fill="#00FF66"/><rect x="352" y="488" width="320" height="48" rx="24" fill="#00FF66"/><rect x="322" y="420" width="56" height="184" rx="22" fill="#00FF66"/><rect x="646" y="420" width="56" height="184" rx="22" fill="#00FF66"/>
"""
cands_js.append(make_cand_js(
    id="current", n=0, group="base", name="Current Baseline",
    tagline="Today's shipping mark: segmented circle arrow + heavy dumbbell",
    concept="Today's production app icon. A circular orange progress loop wrapping around an exercise dumbbell.",
    moves=["Keep current shipping assets", "Circular loop with reload-style arrowhead", "Heavy dumbbell center graphic"],
    palette=[["Deep Navy", "#14112B"], ["Void Black", "#05040F"], ["Coral Loop", "#FF7A45"], ["Peach Dumbbell", "#FFD2BF"]],
    facts={"Family": "Baseline", "Metaphor": "Gym dumbbell + cycle", "PrimarySurface": "iOS / Watch", "Scalability": "Low (dumbbell blurs at 32px)"},
    svg_content=current_svg, mono_content=current_mono, grid_content=get_grid("current"),
    baseline=True, round_num=1
))

# 2. Round 1 Winner: Candidate 88 Vital Sprout
sprout_svg = """
<defs><linearGradient id="bg_sprt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#030602"/></linearGradient></defs>
<rect width="1024" height="1024" fill="url(#bg_sprt)"/>
<!-- Left Leaf -->
<path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#84CC16"/>
<!-- Right Leaf -->
<path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#22C55E"/>
<circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
"""
sprout_mono = """
<rect width="1024" height="1024" fill="#000"/><path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/><path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/><circle cx="512" cy="800" r="44" fill="#00FF66"/>
"""
cands_js.append(make_cand_js(
    id="vital-sprout", n=88, group="nature", name="Vital Sprout",
    tagline="Twin cotyledon seed sprouts bursting open in upward athletic growth",
    concept="The beginning of every athletic journey: a seed casing bursting open as twin vibrant sprouts reach upward toward the light. Crowned Round 1 Winner.",
    moves=["Twin curved cotyledon leaves", "Central seed origin node", "Spring lime and botanical green"],
    palette=[["Rich Humus", "#0A1208"], ["Sprout Lime", "#84CC16"], ["Botanical Leaf", "#22C55E"], ["Dew White", "#FFFFFF"]],
    facts={"Family": "Organic & Flow", "Metaphor": "Sprouting seed growth", "Vibe": "Youthful & Regenerative", "ScaleAt16px": "Crisp V-sprout", "Status": "🏆 Round 1 Winner"},
    svg_content=sprout_svg, mono_content=sprout_mono, grid_content=get_grid("vital-sprout"),
    baseline=False, round_num=1
))

# 3. Round 2 Refinements (Candidates 101 to 130)
r2_list = get_r2_candidates()
for c in r2_list:
    cands_js.append(make_cand_js(
        id=c["id"], n=c["n"], group=c["group"], name=c["name"],
        tagline=c["tagline"], concept=c["concept"], moves=c["moves"],
        palette=c["palette"], facts=c["facts"],
        svg_content=c["svg"], mono_content=c["mono"], grid_content=c["grid"],
        baseline=False, round_num=2
    ))

print(f"Total candidates assembled for Round 2: {len(cands_js)} (1 baseline + 1 R1 winner + 30 R2 variations)")

groups = [
  {"id": "base", "name": "Baseline", "note": "Today's shipping mark for comparison"},
  {"id": "nature", "name": "09 · Round 1 Winner: Vital Sprout", "note": "Candidate 88 selected by user in Round 1"},
  {"id": "r2-loop", "name": "R2 · Sprout + Loop & Infinity", "note": "Integrating twin cotyledons with perpetual athletic track loops"},
  {"id": "r2-bio", "name": "R2 · Sprout + Biometrics & Pulse", "note": "Cardio waveforms, pulsing seed cores, and vital breath rhythms"},
  {"id": "r2-hud", "name": "R2 · Sprout + Even G2 HUD Reticle", "note": "Collimator optical brackets, targeting nodes, and glasses-first geometry"},
  {"id": "r2-monogram", "name": "R2 · Sprout + Monogram FL", "note": "Twin leaves architected into subtle F and L letterforms"},
  {"id": "r2-minimal", "name": "R2 · Sprout + Swiss Geometry", "note": "Geometric circular arcs, golden ratio curves, and monoline balance"},
  {"id": "r2-palette", "name": "R2 · Sprout + Finish & Materiality", "note": "Electric neon, solar citrus, emerald gradient, and dark-mode glow"},
]

cands_body = "\n".join(cands_js)
groups_js = json.dumps(groups, indent=4)

js_content = f"""// FitLoop Logo Redesign — Round 2: Vital Sprout Refinements
(() => {{
  const K = window.KIT;

  // Helper to make views for any candidate
  const makeViews = (c) => [
    {{ name: "iOS App Icon", render: ({{ dark }}) => K.renderView(c, "ios", dark) }},
    {{ name: "Apple Watch 44mm", render: ({{ dark }}) => K.renderView(c, "watch", dark) }},
    {{ name: "Even G2 Glasses HUD", render: () => K.renderView(c, "glasses") }},
    {{ name: "Even Hub Store Icon & Listing", render: () => K.renderView(c, "evenhub") }},
    {{ name: "macOS Dock Tile", render: ({{ dark }}) => K.renderView(c, "mac", dark) }},
    {{ name: "Favicon Ladder (72-16px)", render: ({{ dark }}) => K.renderView(c, "ladder", dark) }},
  ];

  const candidates = [
{cands_body}
  ];

  // Wire up each candidate's render and detail views
  for (const c of candidates) {{
    c.render = ({{ dark }}) => K.renderCard(c, dark);
    c.views = makeViews(c);
  }}

  window.REVIEW = {{
    key: "2026-10-26-fitloop-logo-v1",
    dir: "reports/2026-10-26-fitloop-logo",
    repo: "hejitech/hejitech-apps",
    port: 8810,
    project: "projects/fitloop",
    context: [
      "projects/fitloop/CLAUDE.md",
      "projects/fitloop/branding/icon.svg",
      "projects/fitloop/apps/ios/FitLoopKit",
      "projects/fitloop/apps/glasses",
    ],
    brief: "Redesign the FitLoop logo/icon with 100 diverse, high-quality candidates across 10 distinct aesthetic families. In Round 1, candidate 88 Vital Sprout won. In Round 2, refine and evolve Vital Sprout across 6 focused families (Loop integration, Biometric cardio, Even G2 HUD, Monogram FL, Swiss geometry, and Finishes).",
    title: "FitLoop Logo Redesign — Round 2",
    subtitle: "Refining 88 Vital Sprout across 6 focused families & 6 surfaces (incl. Even Hub store)",
    heading: "FitLoop Logo Redesign — Round 2: Vital Sprout Refinements",
    intro: "In Round 1, <b>88 Vital Sprout</b> emerged as the winning direction. Round 2 deep-dives into 30 focused evolutions across Loop integration, Biometric cardio pulses, Even G2 HUD reticles, Monogram FL letterforms, Swiss geometric purity, and dynamic color finishes. Every candidate features its dedicated Even Hub 24×24 store icon (12×12 grid, 2×2 blocks). Heart candidates, rate them 1–5★, write notes, inspect on Watch, Glasses HUD & Even Hub store, crown a winner, and click <b>Copy summary</b>.",
    legend: [
      "<b>30</b> Round 2 sprout refinements",
      "<b>1</b> Round 1 winner (88 Vital Sprout)",
      "<b>6</b> focused refinement families",
      "<b>6</b> surfaces (iOS, Watch, G2 Glasses HUD, Even Hub Store, Mac, Favicon)",
    ],
    round: 2,
    frame: "icon",
    size: [320, 320],
    modes: true,
    groups: {groups_js},
    candidates,
  }};
}})();
"""

out_path = os.path.join(script_dir, "site", "js", "candidates.js")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Successfully generated Round 2 {out_path} ({len(js_content)} bytes)")
