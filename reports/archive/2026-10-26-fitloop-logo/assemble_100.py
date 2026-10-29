#!/usr/bin/env python3
import json
import os
import sys

# Change directory to report folder
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from part1 import get_part1
from part2 import get_part2
from part3 import get_part3
from part4 import get_part4
from part5 import get_part5
from even_grids import get_grid

def make_cand(id, n, group, name, tagline, concept, moves, palette, facts, svg_content, mono_content, baseline=False):
    moves_js = json.dumps(moves)
    palette_js = json.dumps(palette)
    facts_js = json.dumps(facts)
    grid_js = json.dumps(get_grid(id))
    base_js = 'baseline: true, ' if baseline else ''
    return f"""    {{
      id: "{id}", n: {n}, group: "{group}", name: "{name}", {base_js}prefers: "dark", round: 1,
      tagline: "{tagline}",
      concept: "{concept}",
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

# Collect all candidates
all_cands = []
all_cands.extend(get_part1(make_cand))
all_cands.extend(get_part2(make_cand))
all_cands.extend(get_part3(make_cand))
all_cands.extend(get_part4(make_cand))
all_cands.extend(get_part5(make_cand))

print(f"Total candidates collected: {len(all_cands)} (Expected 101: 1 baseline + 100 redesigned)")

groups = [
  {"id": "base", "name": "Baseline", "note": "Today's shipping mark for comparison"},
  {"id": "kinetic", "name": "01 · Kinetic Loops & Perpetual Motion", "note": "Continuous 3D ribbons, infinity loops, and orbital momentum"},
  {"id": "biometrics", "name": "02 · Biometrics & Vital Signs", "note": "Cardio pulses, EKG waveforms, activity arcs, and metabolic rhythms"},
  {"id": "monogram", "name": "03 · Monogram FL & Typographic Marks", "note": "Architectural, continuous wire, and chamfered geometric letterforms"},
  {"id": "hud", "name": "04 · High-Tech HUD & Smart Glasses", "note": "Even G2 reticles, telemetry collars, collimators, and glanceable optics"},
  {"id": "strength", "name": "05 · Athletic Strength & Raw Power", "note": "Olympic plates, knurled iron, torque arcs, and barbell geometries"},
  {"id": "speed", "name": "06 · Runners, Speed & Aerodynamics", "note": "Pace ribbons, velocity chevrons, wind tunnels, and cadence arcs"},
  {"id": "minimal", "name": "07 · Scandinavian & Swiss Minimalism", "note": "Pure geometry, monoline rings, Dieter Rams precision, and Bauhaus balance"},
  {"id": "cyber", "name": "08 · Cyberpunk, Neon & Synthwave", "note": "High-voltage laser grids, phosphor greens, and Tokyo midnight glow"},
  {"id": "nature", "name": "09 · Organic Flow & Vital Breath", "note": "Oxygen swells, circadian cycles, tidal rhythms, and breath loops"},
  {"id": "ai", "name": "10 · AI Agents, MCP & Neural Synapse", "note": "Autonomous feedback nodes, neural ribbons, and prompt singularities"},
]

cands_body = "\n".join(all_cands)
groups_js = json.dumps(groups, indent=4)

js_content = f"""// FitLoop Logo Redesign: 100 Candidates + Baseline across 10 Thematic Families
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
    dir: "reports/archive/2026-10-26-fitloop-logo",
    repo: "hejitech/hejitech-apps",
    port: 8810,
    project: "projects/fitloop",
    context: [
      "projects/fitloop/CLAUDE.md",
      "projects/fitloop/branding/icon.svg",
      "projects/fitloop/apps/ios/FitLoopKit",
      "projects/fitloop/apps/glasses",
    ],
    brief: "Redesign the FitLoop logo/icon with 100 diverse, high-quality candidates across 10 distinct aesthetic families (100 candidates + today's baseline). Explore kinetic momentum, biometric telemetry, athletic strength, aerodynamic speed, minimalism, cyberpunk neon, organic flow, and futuristic agentic AI.",
    title: "FitLoop Logo Redesign",
    subtitle: "100 redesign candidates + v1.0 baseline across 10 families & 6 surfaces (incl. Even Hub store)",
    heading: "FitLoop Logo Redesign — 100 Candidates",
    intro: "FitLoop closes the loop between the athlete's workouts, Apple Watch vitals, Even G2 smart glasses, and their personal AI agent over MCP. Browse all 100 candidate directions organized into 10 cohesive thematic families. Every candidate features its dedicated Even Hub 24×24 store icon (12×12 grid, 2×2 blocks). Heart candidates, rate them 1–5★, write notes, inspect on Watch, Glasses HUD & Even Hub store, crown a winner, and click <b>Copy summary</b>.",
    legend: [
      "<b>100</b> redesign candidates",
      "<b>10</b> thematic families",
      "<b>6</b> surfaces (iOS, Watch, G2 Glasses HUD, Even Hub Store, Mac, Favicon)",
    ],
    round: 1,
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

print(f"Successfully generated {out_path} ({len(js_content)} bytes)")
