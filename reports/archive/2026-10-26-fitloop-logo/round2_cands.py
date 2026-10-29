#!/usr/bin/env python3
# Round 2 Variations of Vital Sprout (Candidates 101 to 130)
# 6 Focused Refinement Families:
# 1. Sprout + Loop & Infinity (101-105)
# 2. Sprout + Biometrics & Pulse (106-110)
# 3. Sprout + Even G2 HUD Reticle (111-115)
# 4. Sprout + Monogram FL (116-120)
# 5. Sprout + Swiss Geometry & Golden Ratio (121-125)
# 6. Sprout + Finish, Glow & Palette (126-130)

r2_candidates = []
r2_grids = {}

def add_r2(id, n, group, name, tagline, concept, moves, palette, facts, svg, mono, grid):
    r2_candidates.append({
        "id": id, "n": n, "group": group, "name": name,
        "tagline": tagline, "concept": concept, "moves": moves,
        "palette": palette, "facts": facts, "svg": svg, "mono": mono, "grid": grid.strip()
    })
    r2_grids[id] = grid.strip()

# ─────────────────────────────────────────────────────────────
# Family 1: Sprout + Loop & Infinity (101–105)
# ─────────────────────────────────────────────────────────────

# 101 · Sprout Infinity
add_r2(
    "sprout-infinity", 101, "r2-loop",
    "Sprout Infinity",
    "Twin cotyledon leaves looping into an eternal infinity base",
    "Fusing the sprout's upward biological growth with the eternal loop of daily athletic consistency: the lower stems cross in a smooth figure-eight loop below the seed core.",
    ["Twin upward cotyledon leaves", "Crossing infinity figure-eight base loop", "Spring lime & electric emerald gradient"],
    [["Humus Dark", "#0B1309"], ["Sprout Lime", "#84CC16"], ["Emerald Flow", "#10B981"], ["Core Light", "#FFFFFF"]],
    {"Focus": "Loop Integration", "Metaphor": "Infinite athletic vitality", "ScaleAt16px": "Crisp infinity-V hybrid", "Vibe": "Continuous & Unstoppable"},
    """
    <defs>
      <linearGradient id="bg_101" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1A0C"/><stop offset="1" stop-color="#040803"/></linearGradient>
      <linearGradient id="lg_101a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A3E635"/><stop offset="1" stop-color="#65A30D"/></linearGradient>
      <linearGradient id="lg_101b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_101)"/>
    <!-- Infinity loop base -->
    <path d="M 512 620 C 440 560 320 540 240 620 C 160 700 200 840 340 840 C 460 840 512 680 512 620 C 512 680 564 840 684 840 C 824 840 864 700 784 620 C 704 540 584 560 512 620 Z" fill="none" stroke="url(#lg_101a)" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Left Leaf -->
    <path d="M 512 600 C 512 380 340 260 220 180 C 380 160 490 320 512 600 Z" fill="url(#lg_101a)"/>
    <!-- Right Leaf -->
    <path d="M 512 600 C 512 380 684 260 804 180 C 644 160 534 320 512 600 Z" fill="url(#lg_101b)"/>
    <!-- Luminous Seed Core -->
    <circle cx="512" cy="610" r="42" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 620 C 440 560 320 540 240 620 C 160 700 200 840 340 840 C 460 840 512 680 512 620 C 512 680 564 840 684 840 C 824 840 864 700 784 620 C 704 540 584 560 512 620 Z" fill="none" stroke="#00FF66" stroke-width="48"/>
    <path d="M 512 600 C 512 380 340 260 220 180 C 380 160 490 320 512 600 Z" fill="#00FF66"/>
    <path d="M 512 600 C 512 380 684 260 804 180 C 644 160 534 320 512 600 Z" fill="#00FF66" opacity="0.65"/>
    <circle cx="512" cy="610" r="38" fill="#00FF66"/>
    """,
    """
............
...##..##...
..####.####.
...######...
....####....
...##..##...
..#..##..#..
...##..##...
....####....
.....##.....
............
............
"""
)

# 102 · Ouroboros Track Sprout
add_r2(
    "sprout-ouroboros", 102, "r2-loop",
    "Ouroboros Track Sprout",
    "Continuous stadium running loop bursting into twin apex cotyledons",
    "A full 360-degree stadium running track curves upward from the base, unfurling at the top into vibrant twin sprout leaves that reach for the sun.",
    ["Full 360° stadium track loop", "Top apex cotyledon unfurling", "High-contrast lime-to-green energy circuit"],
    [["Deep Pitch", "#080F06"], ["Spring Lime", "#84CC16"], ["Deep Mint", "#10B981"], ["Pure White", "#FFFFFF"]],
    {"Focus": "Loop Integration", "Metaphor": "Endless training track sprouting life", "ScaleAt16px": "Distinct circular ring with V top", "Vibe": "Cyclic & Energetic"},
    """
    <defs>
      <linearGradient id="bg_102" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D180B"/><stop offset="1" stop-color="#020501"/></linearGradient>
      <linearGradient id="lg_102" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A3E635"/><stop offset="1" stop-color="#059669"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_102)"/>
    <!-- Outer Track Loop -->
    <circle cx="512" cy="540" r="320" fill="none" stroke="url(#lg_102)" stroke-width="56" stroke-dasharray="1400 300" stroke-dashoffset="150" stroke-linecap="round"/>
    <!-- Left Sprout Leaf -->
    <path d="M 480 460 C 480 300 320 220 210 150 C 370 140 460 280 480 460 Z" fill="#84CC16"/>
    <!-- Right Sprout Leaf -->
    <path d="M 544 460 C 544 300 704 220 814 150 C 654 140 564 280 544 460 Z" fill="#10B981"/>
    <!-- Seed Center -->
    <circle cx="512" cy="500" r="44" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <circle cx="512" cy="540" r="320" fill="none" stroke="#00FF66" stroke-width="50" stroke-dasharray="1400 300" stroke-dashoffset="150"/>
    <path d="M 480 460 C 480 300 320 220 210 150 C 370 140 460 280 480 460 Z" fill="#00FF66"/>
    <path d="M 544 460 C 544 300 704 220 814 150 C 654 140 564 280 544 460 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="500" r="40" fill="#00FF66"/>
    """,
    """
............
...##..##...
..####.####.
..##....##..
...######...
..##....##..
..##....##..
..##....##..
...######...
....####....
............
............
"""
)

# 103 · Möbius Cotyledon
add_r2(
    "sprout-mobius", 103, "r2-loop",
    "Möbius Cotyledon",
    "Single continuous 3D twisting ribbon forming sprout and loop simultaneously",
    "The ultimate expression of mathematical continuity: a single Möbius strip twists through space, creating a foundation loop at the bottom and opening into twin leaf surfaces at the top.",
    ["3D Möbius strip twist", "Seamless continuity from root to leaf", "Shaded dimensional ribbons in electric lime"],
    [["Obsidian Green", "#091207"], ["Bright Lime", "#84CC16"], ["Leaf Green", "#22C55E"], ["Forest Green", "#15803D"]],
    {"Focus": "Loop Integration", "Metaphor": "Non-orientable perpetual loop", "ScaleAt16px": "Crisp dimensional twist", "Vibe": "Sophisticated & Mathematical"},
    """
    <defs>
      <linearGradient id="bg_103" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1A0C"/><stop offset="1" stop-color="#030702"/></linearGradient>
      <linearGradient id="lg_103a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BEF264"/><stop offset="1" stop-color="#65A30D"/></linearGradient>
      <linearGradient id="lg_103b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ADE80"/><stop offset="1" stop-color="#166534"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_103)"/>
    <!-- Back Loop Twist -->
    <path d="M 360 640 C 260 760 380 860 512 860 C 644 860 764 760 664 640 C 600 560 424 560 360 640 Z" fill="none" stroke="url(#lg_103b)" stroke-width="56" stroke-linecap="round"/>
    <!-- Front Sprout Leaves forming twist -->
    <path d="M 512 600 C 512 400 320 280 220 180 C 400 180 500 360 512 600 Z" fill="url(#lg_103a)"/>
    <path d="M 512 600 C 512 400 704 280 804 180 C 624 180 524 360 512 600 Z" fill="url(#lg_103b)"/>
    <circle cx="512" cy="620" r="44" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 360 640 C 260 760 380 860 512 860 C 644 860 764 760 664 640 C 600 560 424 560 360 640 Z" fill="none" stroke="#00FF66" stroke-width="50"/>
    <path d="M 512 600 C 512 400 320 280 220 180 C 400 180 500 360 512 600 Z" fill="#00FF66"/>
    <path d="M 512 600 C 512 400 704 280 804 180 C 624 180 524 360 512 600 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="620" r="40" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
..###..###..
...######...
..####..##..
..##..####..
...######...
....####....
.....##.....
............
............
"""
)

# 104 · Interlocking Sprout Links
add_r2(
    "sprout-interlock", 104, "r2-loop",
    "Interlocking Sprout Links",
    "Dual interlocking ribbon loops uniting athlete effort with AI guidance",
    "Two vibrant continuous loops interlock like chain links at the seed core, each unfurling into an upward cotyledon leaf. Represents the human athlete and their AI training agent bound in mutual growth.",
    ["Two interlocking ribbon loops", "Dual color interplay (Lime + Mint)", "Symbolizes athlete + AI coach synergy"],
    [["Deep Forest", "#0A1408"], ["Neon Lime", "#A3E635"], ["Teal Mint", "#14B8A6"], ["Pure White", "#FFFFFF"]],
    {"Focus": "Loop Integration", "Metaphor": "Athlete + AI agent partnership", "ScaleAt16px": "Distinct interlocking knot", "Vibe": "Connected & Balanced"},
    """
    <defs>
      <linearGradient id="bg_104" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#030602"/></linearGradient>
      <linearGradient id="lg_104l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BEF264"/><stop offset="1" stop-color="#4D7C0F"/></linearGradient>
      <linearGradient id="lg_104r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0F766E"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_104)"/>
    <!-- Left Loop Link -->
    <path d="M 420 740 C 320 740 260 640 260 520 C 260 360 380 260 480 180 C 450 340 400 480 440 600 C 460 660 480 740 420 740 Z" fill="url(#lg_104l)"/>
    <!-- Right Loop Link -->
    <path d="M 604 740 C 704 740 764 640 764 520 C 764 360 644 260 544 180 C 574 340 624 480 584 600 C 564 660 544 740 604 740 Z" fill="url(#lg_104r)"/>
    <circle cx="512" cy="740" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 420 740 C 320 740 260 640 260 520 C 260 360 380 260 480 180 C 450 340 400 480 440 600 C 460 660 480 740 420 740 Z" fill="#00FF66"/>
    <path d="M 604 740 C 704 740 764 640 764 520 C 764 360 644 260 544 180 C 574 340 624 480 584 600 C 564 660 544 740 604 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="740" r="42" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..##.##.##..
..##.##.##..
...######...
....####....
.....##.....
....####....
............
............
"""
)

# 105 · Orbital Sprout Nexus
add_r2(
    "sprout-orbit", 105, "r2-loop",
    "Orbital Sprout Nexus",
    "Concentric athletic velocity rings cradling an upward botanical burst",
    "Dual kinetic orbital rings sweep around an illuminated central seed core like planetary momentum, with twin cotyledon leaves shooting skyward from the nucleus.",
    ["Twin tilted orbital momentum rings", "Central radiant seed nucleus", "Dynamic fusion of astronomy and botany"],
    [["Space Pitch", "#070E05"], ["Electric Lime", "#84CC16"], ["Solar Mint", "#34D399"], ["Pure Core", "#FFFFFF"]],
    {"Focus": "Loop Integration", "Metaphor": "Gravitational training momentum", "ScaleAt16px": "Distinct ringed sprout", "Vibe": "Futuristic & Expanding"},
    """
    <defs>
      <linearGradient id="bg_105" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0C170A"/><stop offset="1" stop-color="#020501"/></linearGradient>
      <linearGradient id="lg_105a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A3E635"/><stop offset="1" stop-color="#4D7C0F"/></linearGradient>
      <linearGradient id="lg_105b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#065F46"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_105)"/>
    <!-- Orbital Rings -->
    <ellipse cx="512" cy="720" rx="360" ry="140" fill="none" stroke="url(#lg_105b)" stroke-width="44" transform="rotate(-15 512 720)"/>
    <!-- Left Leaf -->
    <path d="M 512 700 C 512 460 320 340 230 200 C 390 190 490 360 512 700 Z" fill="url(#lg_105a)"/>
    <!-- Right Leaf -->
    <path d="M 512 700 C 512 460 704 340 794 200 C 634 190 534 360 512 700 Z" fill="url(#lg_105b)"/>
    <!-- Core -->
    <circle cx="512" cy="710" r="54" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <ellipse cx="512" cy="720" rx="360" ry="140" fill="none" stroke="#00FF66" stroke-width="40" opacity="0.6" transform="rotate(-15 512 720)"/>
    <path d="M 512 700 C 512 460 320 340 230 200 C 390 190 490 360 512 700 Z" fill="#00FF66"/>
    <path d="M 512 700 C 512 460 704 340 794 200 C 634 190 534 360 512 700 Z" fill="#00FF66" opacity="0.7"/>
    <circle cx="512" cy="710" r="48" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
..###..###..
...######...
.##########.
##...##...##
.##########.
....####....
.....##.....
............
............
"""
)

# ─────────────────────────────────────────────────────────────
# Family 2: Sprout + Biometrics & Pulse (106–110)
# ─────────────────────────────────────────────────────────────

# 106 · Cardio Sprout
add_r2(
    "sprout-cardio", 106, "r2-bio",
    "Cardio Sprout",
    "Inner leaf margins tracing a live QRS electrocardiogram waveform",
    "Connecting plant vitality directly to the athlete's cardiovascular engine: the inner seam between the two cotyledons forms a high-amplitude EKG heartbeat peak.",
    ["Inner seam traces QRS heartbeat spike", "Organic leaf outer contours", "Biometric pulse indicator in seed core"],
    [["Pulse Black", "#0A1308"], ["Heart Lime", "#84CC16"], ["Cardio Mint", "#22C55E"], ["Electric White", "#FFFFFF"]],
    {"Focus": "Biometrics & Pulse", "Metaphor": "Living heart beating in the plant", "ScaleAt16px": "Crisp heartbeat V-silhouette", "Vibe": "Cardiovascular & Vital"},
    """
    <defs>
      <linearGradient id="bg_106" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1A0C"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_106)"/>
    <!-- Left Leaf with EKG Notch -->
    <path d="M 512 800 L 460 800 L 480 680 L 440 840 L 400 780 C 300 680 240 500 220 240 C 400 240 480 440 512 560 Z" fill="#84CC16"/>
    <!-- Right Leaf with EKG Ascent -->
    <path d="M 512 800 L 564 800 L 544 680 L 584 840 L 624 780 C 724 680 784 500 804 240 C 624 240 544 440 512 560 Z" fill="#22C55E"/>
    <!-- Central EKG Spike -->
    <polyline points="360,780 420,780 450,860 480,560 512,880 544,560 574,860 604,780 664,780" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="512" cy="560" r="32" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 800 L 460 800 L 480 680 L 440 840 L 400 780 C 300 680 240 500 220 240 C 400 240 480 440 512 560 Z" fill="#00FF66"/>
    <path d="M 512 800 L 564 800 L 544 680 L 584 840 L 624 780 C 724 680 784 500 804 240 C 624 240 544 440 512 560 Z" fill="#00FF66" opacity="0.6"/>
    <polyline points="360,780 420,780 450,860 480,560 512,880 544,560 574,860 604,780 664,780" fill="none" stroke="#FFFFFF" stroke-width="24"/>
    """,
    """
............
..##....##..
.####..####.
..##....##..
...######...
....#..#....
..##.##.##..
....#..#....
....####....
...######...
....####....
............
"""
)

# 107 · Pulsing Seed Core
add_r2(
    "sprout-pulse-core", 107, "r2-bio",
    "Pulsing Seed Core",
    "Concentric acoustic and optical biometric pulse rings radiating upward",
    "The seed is the heart of the athlete: concentric circular pulse waves radiate upward between the leaves, visualizing heart rate variability (HRV) and continuous metabolic tracking.",
    ["Triple concentric biometric pulse rings", "Twin enclosing protective cotyledons", "Vibrant sensor aura in spring lime"],
    [["Deep Earth", "#0A1308"], ["Sprout Lime", "#84CC16"], ["Bio Green", "#22C55E"], ["Pulse Glow", "#A7F3D0"]],
    {"Focus": "Biometrics & Pulse", "Metaphor": "Heart rate sensor radiating life", "ScaleAt16px": "Distinct radiating core", "Vibe": "Warm & Biometric"},
    """
    <defs>
      <linearGradient id="bg_107" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_107)"/>
    <!-- Outer Pulse Arcs -->
    <circle cx="512" cy="740" r="180" fill="none" stroke="#84CC16" stroke-width="18" opacity="0.4" stroke-dasharray="160 400" stroke-dashoffset="60"/>
    <circle cx="512" cy="740" r="120" fill="none" stroke="#84CC16" stroke-width="26" opacity="0.7" stroke-dasharray="120 300" stroke-dashoffset="40"/>
    <!-- Left Leaf -->
    <path d="M 512 740 C 512 480 340 360 220 220 C 380 200 480 380 512 740 Z" fill="#84CC16"/>
    <!-- Right Leaf -->
    <path d="M 512 740 C 512 480 684 360 804 220 C 644 200 544 380 512 740 Z" fill="#22C55E"/>
    <!-- Center Pulse Core -->
    <circle cx="512" cy="740" r="60" fill="#FFFFFF"/>
    <circle cx="512" cy="740" r="32" fill="#84CC16"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <circle cx="512" cy="740" r="140" fill="none" stroke="#00FF66" stroke-width="20" opacity="0.5"/>
    <path d="M 512 740 C 512 480 340 360 220 220 C 380 200 480 380 512 740 Z" fill="#00FF66"/>
    <path d="M 512 740 C 512 480 684 360 804 220 C 644 200 544 380 512 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="740" r="50" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
..###..###..
...######...
..########..
.##.####.##.
..########..
....####....
.....##.....
............
............
"""
)

# 108 · VO2 Max Swell
add_r2(
    "sprout-vo2", 108, "r2-bio",
    "VO2 Max Swell",
    "Asymmetric exponential leaf curve symbolizing athletic aerobic capacity",
    "An intentional asymmetric evolution: while the left leaf provides foundational stability, the right cotyledon ascends in a bold, sweeping exponential curve, embodying athletic threshold progression.",
    ["Dynamic asymmetric leaf geometry", "Ascending exponential VO2 curve", "Forward athletic momentum vector"],
    [["Humus Dark", "#0B1408"], ["Electric Lime", "#84CC16"], ["Aero Cyan", "#06B6D4"], ["White Apex", "#FFFFFF"]],
    {"Focus": "Biometrics & Pulse", "Metaphor": "Exponential aerobic capacity surge", "ScaleAt16px": "Distinct dynamic lean", "Vibe": "Aggressive & Progressive"},
    """
    <defs>
      <linearGradient id="bg_108" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1B0D"/><stop offset="1" stop-color="#030602"/></linearGradient>
      <linearGradient id="lg_108r" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#10B981"/><stop offset="1" stop-color="#06B6D4"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_108)"/>
    <!-- Left Leaf (Foundation) -->
    <path d="M 512 780 C 512 540 360 440 280 320 C 420 300 500 460 512 780 Z" fill="#84CC16"/>
    <!-- Right Leaf (Exponential VO2 surge) -->
    <path d="M 512 780 C 512 460 680 300 840 160 C 700 160 540 380 512 780 Z" fill="url(#lg_108r)"/>
    <circle cx="512" cy="790" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 540 360 440 280 320 C 420 300 500 460 512 780 Z" fill="#00FF66" opacity="0.7"/>
    <path d="M 512 780 C 512 460 680 300 840 160 C 700 160 540 380 512 780 Z" fill="#00FF66"/>
    <circle cx="512" cy="790" r="44" fill="#00FF66"/>
    """,
    """
.........##.
........####
..##....####
.####..#####
..###.######
...#########
....######..
.....####...
.....##.....
....####....
....####....
............
"""
)

# 109 · Circadian Breath Sprout
add_r2(
    "sprout-breath", 109, "r2-bio",
    "Circadian Breath Sprout",
    "Soft harmonic tidal respiration curves guiding inhale and recovery",
    "Paced breathing during intense sets: the sprout leaves expand with the gentle geometry of lung capacity, creating an organic rhythm of inhale, power, and oxygen recovery.",
    ["Harmonic tidal respiration curves", "Soft rounded botanical tips", "Calming spring lime and sage gradient"],
    [["Deep Sage", "#091408"], ["Bright Lime", "#84CC16"], ["Sage Mint", "#34D399"], ["Pure Dew", "#FFFFFF"]],
    {"Focus": "Biometrics & Pulse", "Metaphor": "Paced respiratory recovery", "ScaleAt16px": "Full, friendly botanical silhouette", "Vibe": "Restorative & Balanced"},
    """
    <defs>
      <linearGradient id="bg_109" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1B0C"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_109)"/>
    <!-- Left Leaf (Inhale) -->
    <path d="M 512 760 C 512 460 280 400 200 240 C 380 200 500 400 512 760 Z" fill="#84CC16"/>
    <!-- Right Leaf (Exhale) -->
    <path d="M 512 760 C 512 460 744 400 824 240 C 644 200 524 400 512 760 Z" fill="#34D399"/>
    <!-- Soft Breath Droplet Core -->
    <ellipse cx="512" cy="780" rx="54" ry="46" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 760 C 512 460 280 400 200 240 C 380 200 500 400 512 760 Z" fill="#00FF66"/>
    <path d="M 512 760 C 512 460 744 400 824 240 C 644 200 524 400 512 760 Z" fill="#00FF66" opacity="0.6"/>
    <ellipse cx="512" cy="780" rx="50" ry="42" fill="#00FF66"/>
    """,
    """
............
...##..##...
..####.####.
.##..#.#..##
.##..#.#..##
..####.####.
...######...
....####....
.....##.....
....####....
....####....
............
"""
)

# 110 · Thermal Caloric Sprout
add_r2(
    "sprout-caloric", 110, "r2-bio",
    "Thermal Caloric Sprout",
    "High-energy metabolic burn gradient radiating from solar amber core to lime tips",
    "Visualizing metabolic calorie burn: the seed origin burns with radiant solar orange energy, transferring athletic fire upward into vibrant photosynthetic lime leaves.",
    ["Thermal calorie gradient (Orange to Lime)", "High-contrast metabolic core", "Visual heat-to-growth transfer"],
    [["Pitch Charcoal", "#0A0E08"], ["Solar Amber", "#F97316"], ["Sprout Lime", "#84CC16"], ["White Flame", "#FFFFFF"]],
    {"Focus": "Biometrics & Pulse", "Metaphor": "Metabolic fuel burning into athletic growth", "ScaleAt16px": "Distinct warm core glowing inside lime", "Vibe": "Fiery & Energetic"},
    """
    <defs>
      <linearGradient id="bg_110" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14140C"/><stop offset="1" stop-color="#040602"/></linearGradient>
      <linearGradient id="lg_110" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#EA580C"/><stop offset="0.4" stop-color="#F59E0B"/><stop offset="1" stop-color="#84CC16"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_110)"/>
    <!-- Left Leaf -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="url(#lg_110)"/>
    <!-- Right Leaf -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="url(#lg_110)"/>
    <!-- Solar Core -->
    <circle cx="512" cy="790" r="52" fill="#F97316"/>
    <circle cx="512" cy="790" r="30" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.7"/>
    <circle cx="512" cy="790" r="48" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..###..###..
...######...
....####....
...######...
....####....
.....##.....
....####....
............
"""
)

# ─────────────────────────────────────────────────────────────
# Family 3: Sprout + Even G2 HUD Reticle (111–115)
# ─────────────────────────────────────────────────────────────

# 111 · Reticle Sprout
add_r2(
    "sprout-reticle", 111, "r2-hud",
    "Reticle Sprout",
    "Optical HUD targeting brackets framing the upward botanical sprout",
    "Engineered directly for the Even G2 smart glasses display: four corner targeting reticle brackets lock onto the seed origin, turning the organic sprout into a high-tech optical telemetry mark.",
    ["Four corner HUD reticle brackets", "Precision 90-degree alignment", "Targeting lock on seed core"],
    [["HUD Pitch", "#050B04"], ["Phosphor Green", "#84CC16"], ["Emerald HUD", "#10B981"], ["Laser White", "#FFFFFF"]],
    {"Focus": "Even G2 HUD", "Metaphor": "Target acquired on your personal best", "ScaleAt16px": "Framed high-tech V", "Vibe": "Tactical & Glanceable"},
    """
    <defs>
      <linearGradient id="bg_111" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1408"/><stop offset="1" stop-color="#020501"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_111)"/>
    <!-- HUD Brackets -->
    <path d="M 180 280 L 180 180 L 280 180" fill="none" stroke="#84CC16" stroke-width="36" stroke-linecap="round"/>
    <path d="M 844 280 L 844 180 L 744 180" fill="none" stroke="#84CC16" stroke-width="36" stroke-linecap="round"/>
    <path d="M 180 744 L 180 844 L 280 844" fill="none" stroke="#84CC16" stroke-width="36" stroke-linecap="round"/>
    <path d="M 844 744 L 844 844 L 744 844" fill="none" stroke="#84CC16" stroke-width="36" stroke-linecap="round"/>
    <!-- Left Leaf -->
    <path d="M 512 760 C 512 500 340 380 260 260 C 400 240 500 420 512 760 Z" fill="#84CC16"/>
    <!-- Right Leaf -->
    <path d="M 512 760 C 512 500 684 380 764 260 C 624 240 524 420 512 760 Z" fill="#10B981"/>
    <!-- Targeting Crosshair Core -->
    <circle cx="512" cy="760" r="44" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 180 280 L 180 180 L 280 180 M 844 280 L 844 180 L 744 180 M 180 744 L 180 844 L 280 844 M 844 744 L 844 844 L 744 844" fill="none" stroke="#00FF66" stroke-width="32"/>
    <path d="M 512 760 C 512 500 340 380 260 260 C 400 240 500 420 512 760 Z" fill="#00FF66"/>
    <path d="M 512 760 C 512 500 684 380 764 260 C 624 240 524 420 512 760 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="760" r="40" fill="#00FF66"/>
    """,
    """
##........##
#..........#
...##..##...
..####.####.
...######...
....####....
....####....
.....##.....
#...####...#
##........##
............
............
"""
)

# 112 · Collimator Cotyledon
add_r2(
    "sprout-collimator", 112, "r2-hud",
    "Collimator Cotyledon",
    "Precision optical collimator crosshairs bisecting the seed origin",
    "Smart glasses optical alignment: hairline crosshair collimator axes center directly onto the seed nucleus, combining sniper-like biometric precision with botanical vitality.",
    ["Precision crosshair collimator lines", "Center laser optical sighting dot", "Streamlined cotyledon blades"],
    [["Optic Black", "#060D05"], ["Laser Lime", "#84CC16"], ["Optic Green", "#10B981"], ["Reticle White", "#FFFFFF"]],
    {"Focus": "Even G2 HUD", "Metaphor": "Collimated optical focus", "ScaleAt16px": "Distinct crosshair seed", "Vibe": "Ultra-precise & Focused"},
    """
    <defs>
      <linearGradient id="bg_112" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1609"/><stop offset="1" stop-color="#020501"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_112)"/>
    <!-- Collimator Axis Lines -->
    <line x1="512" y1="160" x2="512" y2="860" stroke="#84CC16" stroke-width="16" stroke-dasharray="24 16" opacity="0.4"/>
    <line x1="200" y1="740" x2="824" y2="740" stroke="#84CC16" stroke-width="16" stroke-dasharray="24 16" opacity="0.4"/>
    <!-- Left Leaf -->
    <path d="M 512 740 C 512 480 340 360 240 240 C 400 220 500 400 512 740 Z" fill="#84CC16"/>
    <!-- Right Leaf -->
    <path d="M 512 740 C 512 480 684 360 784 240 C 624 220 524 400 512 740 Z" fill="#10B981"/>
    <!-- Center Sighting Dot -->
    <circle cx="512" cy="740" r="50" fill="#FFFFFF"/>
    <circle cx="512" cy="740" r="22" fill="#84CC16"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <line x1="512" y1="160" x2="512" y2="860" stroke="#00FF66" stroke-width="14" stroke-dasharray="20 16" opacity="0.4"/>
    <line x1="200" y1="740" x2="824" y2="740" stroke="#00FF66" stroke-width="14" stroke-dasharray="20 16" opacity="0.4"/>
    <path d="M 512 740 C 512 480 340 360 240 240 C 400 220 500 400 512 740 Z" fill="#00FF66"/>
    <path d="M 512 740 C 512 480 684 360 784 240 C 624 220 524 400 512 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="740" r="44" fill="#00FF66"/>
    """,
    """
.....##.....
.##..##..##.
.####..####.
..########..
####.##.####
..########..
...######...
....####....
.....##.....
....####....
.....##.....
............
"""
)

# 113 · Digital Twin Sprout
add_r2(
    "sprout-digital-twin", 113, "r2-hud",
    "Digital Twin Sprout",
    "Left leaf organic nature, right leaf segmented digital HUD telemetry",
    "The core metaphor of FitLoop: the left cotyledon is smooth botanical nature (the athlete's biological body), while the right cotyledon is formed by digital HUD telemetry segments (the AI agent model).",
    ["Hybrid analog/digital split", "Right leaf digital HUD telemetry slats", "Seamless meeting at central seed node"],
    [["Deep Void", "#070D05"], ["Biological Lime", "#84CC16"], ["Digital Cyan", "#06B6D4"], ["Interface White", "#FFFFFF"]],
    {"Focus": "Even G2 HUD", "Metaphor": "Biological athlete + digital AI twin", "ScaleAt16px": "Distinct solid/slat split", "Vibe": "Hybrid & Cybernetic"},
    """
    <defs>
      <linearGradient id="bg_113" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B170A"/><stop offset="1" stop-color="#020501"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_113)"/>
    <!-- Left Leaf (Smooth Organic) -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#84CC16"/>
    <!-- Right Leaf (Digital Slats) -->
    <path d="M 524 720 C 540 680 580 640 640 640 C 600 680 560 720 524 720 Z" fill="#06B6D4"/>
    <path d="M 534 600 C 560 540 640 500 700 500 C 660 550 600 600 534 600 Z" fill="#06B6D4"/>
    <path d="M 540 480 C 580 400 700 360 760 360 C 700 420 620 480 540 480 Z" fill="#06B6D4"/>
    <path d="M 544 340 C 600 260 740 220 800 220 C 740 280 640 340 544 340 Z" fill="#06B6D4"/>
    <circle cx="512" cy="790" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 524 720 C 540 680 580 640 640 640 C 600 680 560 720 524 720 Z" fill="#00FF66" opacity="0.6"/>
    <path d="M 534 600 C 560 540 640 500 700 500 C 660 550 600 600 534 600 Z" fill="#00FF66" opacity="0.7"/>
    <path d="M 540 480 C 580 400 700 360 760 360 C 700 420 620 480 540 480 Z" fill="#00FF66" opacity="0.8"/>
    <path d="M 544 340 C 600 260 740 220 800 220 C 740 280 640 340 544 340 Z" fill="#00FF66"/>
    <circle cx="512" cy="790" r="44" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####...##..
.####...##..
..###...##..
...##...##..
....######..
....####....
.....##.....
....####....
....####....
............
"""
)

# 114 · Telemetry Sprout Collar
add_r2(
    "sprout-telemetry", 114, "r2-hud",
    "Telemetry Sprout Collar",
    "Glanceable arc gauge displaying sets, reps, and heart rate surrounding the sprout",
    "A full athletic cockpit on your smart glasses: a 270-degree HUD telemetry collar wraps around the lower sprout, displaying workout completion and vital zones without clutter.",
    ["270° HUD telemetry arc gauge", "Segmented athletic metric ticks", "Clean central sprout focal point"],
    [["Graphite HUD", "#081006"], ["Telemetry Lime", "#84CC16"], ["Active Emerald", "#10B981"], ["Clean White", "#FFFFFF"]],
    {"Focus": "Even G2 HUD", "Metaphor": "Cockpit heads-up instrumentation", "ScaleAt16px": "Crisp arc collar + V", "Vibe": "Informative & Tactical"},
    """
    <defs>
      <linearGradient id="bg_114" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1A0C"/><stop offset="1" stop-color="#020501"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_114)"/>
    <!-- Outer Telemetry Arc -->
    <path d="M 240 460 A 340 340 0 1 0 784 460" fill="none" stroke="#84CC16" stroke-width="40" stroke-linecap="round" stroke-dasharray="80 30 180 30 280 30"/>
    <!-- Left Leaf -->
    <path d="M 512 740 C 512 480 340 380 260 260 C 400 240 500 420 512 740 Z" fill="#84CC16"/>
    <!-- Right Leaf -->
    <path d="M 512 740 C 512 480 684 380 764 260 C 624 240 524 420 512 740 Z" fill="#10B981"/>
    <circle cx="512" cy="750" r="44" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 240 460 A 340 340 0 1 0 784 460" fill="none" stroke="#00FF66" stroke-width="36" stroke-linecap="round" stroke-dasharray="80 30 180 30 280 30"/>
    <path d="M 512 740 C 512 480 340 380 260 260 C 400 240 500 420 512 740 Z" fill="#00FF66"/>
    <path d="M 512 740 C 512 480 684 380 764 260 C 624 240 524 420 512 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="750" r="40" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
..###..###..
##.######.##
#...####...#
#...####...#
##.######.##
...######...
....####....
............
............
"""
)

# 115 · Vector Wire Sprout
add_r2(
    "sprout-vector-wire", 115, "r2-hud",
    "Vector Wire Sprout",
    "Stark green phosphor vector line art crafted for the 0.15\" Micro-LED engine",
    "Pure vector efficiency: stripped of heavy solid fills, this mark is built from pure 28px phosphor green stroke paths. Uses zero unnecessary micro-LED pixels on the Even G2 glasses for maximum battery life.",
    ["100% stroke-based phosphor vector line art", "Zero battery waste on Even G2 green OLED", "High-contrast geometric minimalism"],
    [["True Black", "#000000"], ["Phosphor 530nm", "#00FF66"], ["Muted Phosphor", "#00CC52"], ["Highlight", "#E6FFEE"]],
    {"Focus": "Even G2 HUD", "Metaphor": "Pure green phosphor vector laser", "ScaleAt16px": "Ultra-sharp wireframe", "Vibe": "Stark & Hardware-native"},
    """
    <rect width="1024" height="1024" fill="#020402"/>
    <!-- Wire Left Leaf -->
    <path d="M 512 760 C 512 480 320 360 240 240 C 400 220 500 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"/>
    <!-- Wire Right Leaf -->
    <path d="M 512 760 C 512 480 704 360 784 240 C 624 220 524 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"/>
    <circle cx="512" cy="760" r="48" fill="none" stroke="#00FF66" stroke-width="48"/>
    <circle cx="512" cy="760" r="16" fill="#00FF66"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 760 C 512 480 320 360 240 240 C 400 220 500 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="44"/>
    <path d="M 512 760 C 512 480 704 360 784 240 C 624 220 524 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="44"/>
    <circle cx="512" cy="760" r="44" fill="none" stroke="#00FF66" stroke-width="44"/>
    """,
    """
............
.###....###.
#...#..#...#
.#...##...#.
..#..##..#..
...#....#...
....#..#....
.....##.....
....#..#....
.....##.....
............
............
"""
)

# ─────────────────────────────────────────────────────────────
# Family 4: Sprout + Monogram FL (116–120)
# ─────────────────────────────────────────────────────────────

# 116 · Monogram Sprout FL
add_r2(
    "sprout-monogram-fl", 116, "r2-monogram",
    "Monogram Sprout FL",
    "Left leaf and stem forming the 'F', base trajectory sweeping into the 'L'",
    "A subtle typographic Easter egg hidden in plain sight: the left cotyledon and central stem form the horizontal bars of an 'F', while the lower stem sweeps smoothly to the right to complete an 'L'.",
    ["Left leaf forms top and mid bars of 'F'", "Stem base curves right into 'L'", "Organic botanical silhouette preserved"],
    [["Deep Forest", "#091207"], ["Sprout Lime", "#84CC16"], ["Leaf Emerald", "#10B981"], ["Bright White", "#FFFFFF"]],
    {"Focus": "Monogram FL", "Metaphor": "Typographic FL secretly hidden in nature", "ScaleAt16px": "Balanced monogram-sprout hybrid", "Vibe": "Clever & Branded"},
    """
    <defs>
      <linearGradient id="bg_116" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1A0C"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_116)"/>
    <!-- Left Leaf forming F -->
    <path d="M 460 760 C 460 520 280 400 200 260 C 380 240 440 380 460 520 L 320 520 L 320 440 L 460 440 Z" fill="#84CC16"/>
    <!-- Right Leaf -->
    <path d="M 512 760 C 512 500 704 380 784 260 C 624 240 524 420 512 760 Z" fill="#10B981"/>
    <!-- L Base sweep -->
    <path d="M 460 720 L 460 820 C 460 860 500 860 660 860" fill="none" stroke="#84CC16" stroke-width="56" stroke-linecap="round"/>
    <circle cx="460" cy="760" r="40" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 460 760 C 460 520 280 400 200 260 C 380 240 440 380 460 520 L 320 520 L 320 440 L 460 440 Z" fill="#00FF66"/>
    <path d="M 512 760 C 512 500 704 380 784 260 C 624 240 524 420 512 760 Z" fill="#00FF66" opacity="0.6"/>
    <path d="M 460 720 L 460 820 C 460 860 500 860 660 860" fill="none" stroke="#00FF66" stroke-width="48"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..###..###..
..########..
...######...
...##.......
...##.......
...######...
....####....
............
"""
)

# 117 · Stencil Sprout FL
add_r2(
    "sprout-stencil-fl", 117, "r2-monogram",
    "Stencil Sprout FL",
    "High-speed 45-degree athletic stencil cuts structuring the cotyledon leaves",
    "Military athletics meet botanical energy: 45-degree forward angled speed cutouts segment the cotyledon leaves, giving the sprout the athletic aggression of competition track spikes.",
    ["45° forward-raked stencil cuts", "High-velocity athletic breaks", "Aggressive modern performance posture"],
    [["Carbon Matte", "#0A1008"], ["Volt Lime", "#A3E635"], ["Dark Mint", "#059669"], ["Pure Core", "#FFFFFF"]],
    {"Focus": "Monogram FL", "Metaphor": "Athletic track stencil cutouts", "ScaleAt16px": "Segmented dynamic V", "Vibe": "Aggressive & Kinetic"},
    """
    <defs>
      <linearGradient id="bg_117" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#020401"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_117)"/>
    <!-- Left Stencil Leaf -->
    <path d="M 500 760 C 500 580 380 460 300 360 L 240 260 C 380 240 440 320 460 400 L 400 460 L 480 460 C 490 560 500 660 500 760 Z" fill="#A3E635"/>
    <!-- Right Stencil Leaf -->
    <path d="M 524 760 C 524 580 644 460 724 360 L 784 260 C 644 240 584 320 564 400 L 624 460 L 544 460 C 534 560 524 660 524 760 Z" fill="#059669"/>
    <circle cx="512" cy="780" r="44" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 500 760 C 500 580 380 460 300 360 L 240 260 C 380 240 440 320 460 400 L 400 460 L 480 460 C 490 560 500 660 500 760 Z" fill="#00FF66"/>
    <path d="M 524 760 C 524 580 644 460 724 360 L 784 260 C 644 240 584 320 564 400 L 624 460 L 544 460 C 534 560 524 660 524 760 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="780" r="40" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
............
...######...
....####....
.....##.....
....####....
...######...
....####....
............
"""
)

# 118 · Chamfer Sprout FL
add_r2(
    "sprout-chamfer-fl", 118, "r2-monogram",
    "Chamfer Sprout FL",
    "Aerodynamic 45-degree chamfers faceted into the botanical leaf edges",
    "Precision racecar aerodynamics applied to natural botany: each leaf edge is chamfered with crisp 45-degree bevels, creating sharp light reflections like machined billet aluminum.",
    ["Machined 45° chamfered facets", "Aerodynamic forward rake", "High-spec engineered finish"],
    [["Graphite Void", "#070D05"], ["Neon Lime", "#84CC16"], ["Anodized Green", "#16A34A"], ["Silver Highlight", "#F1F5F9"]],
    {"Focus": "Monogram FL", "Metaphor": "Billet aluminum botanical sculpture", "ScaleAt16px": "Crisp geometric V-facets", "Vibe": "Engineered & Premium"},
    """
    <defs>
      <linearGradient id="bg_118" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1B0C"/><stop offset="1" stop-color="#020501"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_118)"/>
    <!-- Left Chamfer Leaf -->
    <polygon points="512,760 480,540 280,340 240,240 340,240 480,420 512,760" fill="#84CC16"/>
    <polygon points="512,760 440,540 280,340 340,300 480,480" fill="#65A30D" opacity="0.7"/>
    <!-- Right Chamfer Leaf -->
    <polygon points="512,760 544,540 744,340 784,240 684,240 544,420 512,760" fill="#16A34A"/>
    <polygon points="512,760 584,540 744,340 684,300 544,480" fill="#15803D" opacity="0.7"/>
    <polygon points="512,730 540,760 512,790 484,760" fill="#F1F5F9"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <polygon points="512,760 480,540 280,340 240,240 340,240 480,420 512,760" fill="#00FF66"/>
    <polygon points="512,760 544,540 744,340 784,240 684,240 544,420 512,760" fill="#00FF66" opacity="0.6"/>
    <polygon points="512,730 540,760 512,790 484,760" fill="#00FF66"/>
    """,
    """
............
....#..#....
..###..###..
.####..####.
..###..###..
...######...
....####....
.....##.....
....####....
...######...
....####....
............
"""
)

# 119 · Architectural Sprout
add_r2(
    "sprout-architectural", 119, "r2-monogram",
    "Architectural Sprout",
    "Structural grid alignment with heavyweight Bauhaus typographic bones",
    "Stripping out decorative fluff in favor of structural clarity: the sprout is architected on a modular typographic grid, balancing heavyweight vertical stems with elegant cantilevered leaves.",
    ["Architectural structural grid", "Cantilevered cotyledon leaves", "Bauhaus modernist balance"],
    [["Pitch Humus", "#091207"], ["Bright Lime", "#84CC16"], ["Architect Green", "#15803D"], ["Stark White", "#FFFFFF"]],
    {"Focus": "Monogram FL", "Metaphor": "Architectural botanical monument", "ScaleAt16px": "Heavy, confident mark", "Vibe": "Sturdy & Authoritative"},
    """
    <defs>
      <linearGradient id="bg_119" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1A0B"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_119)"/>
    <!-- Left Leaf Cantilever -->
    <path d="M 480 760 L 480 480 C 480 340 340 260 220 220 C 380 200 480 300 480 480 Z" fill="#84CC16"/>
    <!-- Right Leaf Cantilever -->
    <path d="M 544 760 L 544 480 C 544 340 684 260 804 220 C 644 200 544 300 544 480 Z" fill="#15803D"/>
    <!-- Central Pylon Column -->
    <rect x="484" y="480" width="56" height="300" fill="#84CC16"/>
    <circle cx="512" cy="780" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 480 760 L 480 480 C 480 340 340 260 220 220 C 380 200 480 300 480 480 Z" fill="#00FF66"/>
    <path d="M 544 760 L 544 480 C 544 340 684 260 804 220 C 644 200 544 300 544 480 Z" fill="#00FF66" opacity="0.6"/>
    <rect x="484" y="480" width="56" height="300" fill="#00FF66"/>
    <circle cx="512" cy="780" r="42" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
..###..###..
...######...
....####....
....####....
....####....
....####....
...######...
....####....
............
"""
)

# 120 · Continuous Wire FL Sprout
add_r2(
    "sprout-wire-fl", 120, "r2-monogram",
    "Continuous Wire FL Sprout",
    "Single unbroken neon tube tracing F, sprouting leaves, and completing L",
    "The pure synthesis of typography and botany: an unbroken 48px luminous neon tube starts at the F crossbar, loops up through the twin sprout leaves, and sweeps through the foundational L baseline.",
    ["Single unbroken 48px continuous line", "Unites 'F', sprout leaves, and 'L'", "Luminous neon glow effect"],
    [["Neon Void", "#050B04"], ["Electric Lime", "#84CC16"], ["Glow Mint", "#22C55E"], ["White Center", "#FFFFFF"]],
    {"Focus": "Monogram FL", "Metaphor": "Continuous wire neon tube", "ScaleAt16px": "Single stroke clarity", "Vibe": "Seamless & Electrifying"},
    """
    <defs>
      <linearGradient id="bg_120" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B170A"/><stop offset="1" stop-color="#020401"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_120)"/>
    <path d="M 320 440 L 480 440 C 480 320 360 260 240 200 C 400 180 500 320 512 600 C 524 320 624 180 784 200 C 664 260 544 320 544 440 L 512 760 C 512 840 560 840 680 840" fill="none" stroke="#84CC16" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="512" cy="620" r="38" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 320 440 L 480 440 C 480 320 360 260 240 200 C 400 180 500 320 512 600 C 524 320 624 180 784 200 C 664 260 544 320 544 440 L 512 760 C 512 840 560 840 680 840" fill="none" stroke="#00FF66" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="512" cy="620" r="32" fill="#00FF66"/>
    """,
    """
............
.#####..##..
.##..#.####.
.#####.####.
.##..#####..
...#..##....
...#..##....
...#..##....
...######...
....####....
............
............
"""
)

# ─────────────────────────────────────────────────────────────
# Family 5: Sprout + Swiss Geometry & Golden Ratio (121–125)
# ─────────────────────────────────────────────────────────────

# 121 · Golden Ratio Cotyledon
add_r2(
    "sprout-golden", 121, "r2-minimal",
    "Golden Ratio Cotyledon",
    "Leaf curvature calibrated to the exact Fibonacci golden spiral (phi = 1.618)",
    "Rooted in the timeless mathematics of natural growth: the outer and inner margins of both leaves strictly trace golden spiral radii, delivering natural harmonic proportion and effortless visual balance.",
    ["Golden ratio (φ = 1.618) spiral curves", "Harmonic natural geometry", "Dieter Rams functionalist balance"],
    [["Swiss Humus", "#0A1208"], ["Sprout Lime", "#84CC16"], ["Leaf Emerald", "#10B981"], ["Harmonic White", "#FFFFFF"]],
    {"Focus": "Swiss Geometry", "Metaphor": "Sacred Fibonacci botanical growth", "ScaleAt16px": "Effortless harmonic beauty", "Vibe": "Harmonic & Timeless"},
    """
    <defs>
      <linearGradient id="bg_121" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1B0C"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_121)"/>
    <!-- Left Golden Leaf -->
    <path d="M 512 780 C 512 480 340 340 236 216 C 398 216 486 380 512 780 Z" fill="#84CC16"/>
    <!-- Right Golden Leaf -->
    <path d="M 512 780 C 512 480 684 340 788 216 C 626 216 538 380 512 780 Z" fill="#10B981"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 480 340 340 236 216 C 398 216 486 380 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 480 684 340 788 216 C 626 216 538 380 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..###..###..
...######...
....####....
.....##.....
....####....
...######...
....####....
............
"""
)

# 122 · Monoline Sprout Ring
add_r2(
    "sprout-monoline", 122, "r2-minimal",
    "Monoline Sprout Ring",
    "Hairline circular monoline ring blossoming open into twin minimalist leaf arcs",
    "Ultra-restrained minimalism: a pristine 32px circular monoline contour rests at the base, effortlessly blooming into twin geometric leaf arcs at the top.",
    ["Pristine 32px hairline circular geometry", "Blossoming open apex leaf arcs", "Zero extraneous decoration"],
    [["Matte Charcoal", "#080F07"], ["Pure Lime", "#84CC16"], ["Muted Sage", "#4ADE80"], ["Crisp White", "#FFFFFF"]],
    {"Focus": "Swiss Geometry", "Metaphor": "Zen monoline circle blooming", "ScaleAt16px": "Ultra-pure ring with V ears", "Vibe": "Minimal & Zen"},
    """
    <rect width="1024" height="1024" fill="#050A04"/>
    <!-- Outer Base Ring -->
    <path d="M 280 480 A 280 280 0 1 0 744 480" fill="none" stroke="#84CC16" stroke-width="48" stroke-linecap="round"/>
    <!-- Left Leaf Arc -->
    <path d="M 512 680 C 512 480 360 360 260 220 C 400 220 480 380 512 680" fill="none" stroke="#84CC16" stroke-width="48" stroke-linecap="round"/>
    <!-- Right Leaf Arc -->
    <path d="M 512 680 C 512 480 664 360 764 220 C 624 220 544 380 512 680" fill="none" stroke="#4ADE80" stroke-width="48" stroke-linecap="round"/>
    <circle cx="512" cy="690" r="32" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 280 480 A 280 280 0 1 0 744 480" fill="none" stroke="#00FF66" stroke-width="42" stroke-linecap="round"/>
    <path d="M 512 680 C 512 480 360 360 260 220 C 400 220 480 380 512 680" fill="none" stroke="#00FF66" stroke-width="42"/>
    <path d="M 512 680 C 512 480 664 360 764 220 C 624 220 544 380 512 680" fill="none" stroke="#00FF66" opacity="0.6" stroke-width="42"/>
    <circle cx="512" cy="690" r="28" fill="#00FF66"/>
    """,
    """
............
...##..##...
..####.####.
..##....##..
...######...
..##....##..
..##....##..
..##....##..
...######...
....####....
............
............
"""
)

# 123 · Overlapping Translucent Sprout
add_r2(
    "sprout-translucent", 123, "r2-minimal",
    "Overlapping Translucent Sprout",
    "Two pure geometric leaf lenses creating a luminous third overlap tone",
    "Swiss color interaction: two translucent pure circular-arc leaves cross each other, creating an illuminated chartreuse overlap zone in the center where energy concentrates.",
    ["Translucent overlapping color geometry", "Vibrant chartreuse intersection core", "Modernist chromatic purity"],
    [["Graphite Dark", "#091207"], ["Lime Translucent", "#84CC16"], ["Cyan Translucent", "#06B6D4"], ["Intersection Glow", "#BEF264"]],
    {"Focus": "Swiss Geometry", "Metaphor": "Optical color interaction of training + recovery", "ScaleAt16px": "Distinct luminous lens overlap", "Vibe": "Luminous & Sophisticated"},
    """
    <defs>
      <linearGradient id="bg_123" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1B0D"/><stop offset="1" stop-color="#020501"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_123)"/>
    <!-- Left Leaf Translucent -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#84CC16" opacity="0.85"/>
    <!-- Right Leaf Translucent -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#06B6D4" opacity="0.85"/>
    <!-- Overlap intersection highlight -->
    <ellipse cx="512" cy="520" rx="40" ry="120" fill="#BEF264" opacity="0.9"/>
    <circle cx="512" cy="790" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="790" r="44" fill="#00FF66"/>
    """,
    """
............
...##..##...
..########..
..########..
...######...
....####....
.....##.....
....####....
...######...
....####....
............
............
"""
)

# 124 · Minimal Silhouette Sprout
add_r2(
    "sprout-silhouette", 124, "r2-minimal",
    "Minimal Silhouette Sprout",
    "Stark high-contrast solid silhouette with zero non-essential detail",
    "Engineered for ultimate micro-scale legibility: zero gradients, zero shadows, zero complex cutouts. Just a solid, bold, athletic sprout silhouette that remains unmistakable at 16×16px.",
    ["100% solid flat silhouette", "Zero gradients or skeuomorphism", "Maximum legibility at micro scales"],
    [["Void Pitch", "#040803"], ["Solid Volt", "#A3E635"], ["Solid White", "#FFFFFF"]],
    {"Focus": "Swiss Geometry", "Metaphor": "Pure iconic silhouette", "ScaleAt16px": "100% indestructible contrast", "Vibe": "Direct & Bold"},
    """
    <rect width="1024" height="1024" fill="#070E05"/>
    <!-- Solid Left Leaf -->
    <path d="M 512 780 C 512 460 300 340 220 220 C 400 220 500 420 512 780 Z" fill="#A3E635"/>
    <!-- Solid Right Leaf -->
    <path d="M 512 780 C 512 460 724 340 804 220 C 624 220 524 420 512 780 Z" fill="#A3E635"/>
    <circle cx="512" cy="800" r="56" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 460 300 340 220 220 C 400 220 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 460 724 340 804 220 C 624 220 524 420 512 780 Z" fill="#00FF66"/>
    <circle cx="512" cy="800" r="50" fill="#00FF66"/>
    """,
    """
............
.###....###.
.####..####.
..###..###..
...######...
....####....
.....##.....
....####....
...##..##...
....####....
............
............
"""
)

# 125 · Geometric Bauhaus Sprout
add_r2(
    "sprout-bauhaus", 125, "r2-minimal",
    "Geometric Bauhaus Sprout",
    "Pure circular sectors and triangular wedge foundation in dynamic tension",
    "Constructivist botanical design: the sprout leaves are pure 90-degree circular sector quadrants, and the seed origin is an inverted geometric triangle, achieving clean Bauhaus functionalism.",
    ["Pure 90° circular quadrant leaves", "Inverted equilateral triangle seed base", "Constructivist graphic clarity"],
    [["Bauhaus Dark", "#081006"], ["Volt Lime", "#84CC16"], ["Cobalt Green", "#0D9488"], ["Primary White", "#FFFFFF"]],
    {"Focus": "Swiss Geometry", "Metaphor": "Bauhaus modernist geometry", "ScaleAt16px": "Distinct geometric quadrants", "Vibe": "Rational & Historic"},
    """
    <rect width="1024" height="1024" fill="#091307"/>
    <!-- Left Quadrant Leaf -->
    <path d="M 512 700 L 260 448 A 252 252 0 0 1 512 196 Z" fill="#84CC16"/>
    <!-- Right Quadrant Leaf -->
    <path d="M 512 700 L 764 448 A 252 252 0 0 0 512 196 Z" fill="#0D9488"/>
    <!-- Triangle Seed Wedge -->
    <polygon points="512,860 440,720 584,720" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 700 L 260 448 A 252 252 0 0 1 512 196 Z" fill="#00FF66"/>
    <path d="M 512 700 L 764 448 A 252 252 0 0 0 512 196 Z" fill="#00FF66" opacity="0.6"/>
    <polygon points="512,860 440,720 584,720" fill="#00FF66"/>
    """,
    """
............
..####.####.
.#####.#####
..####.####.
...######...
....####....
.....##.....
....####....
...######...
....####....
............
............
"""
)

# ─────────────────────────────────────────────────────────────
# Family 6: Sprout + Finish, Glow & Palette (126–130)
# ─────────────────────────────────────────────────────────────

# 126 · Electric Lime & Carbon
add_r2(
    "sprout-cyber-lime", 126, "r2-palette",
    "Electric Lime & Carbon",
    "High-voltage #CCFF00 neon lime leaves over a deep starlight carbon texture",
    "Maximal contrast for modern OLED displays: super-saturated #CCFF00 neon volt lime leaves emerge from an ultra-deep midnight carbon gradient, projecting raw electric training intensity.",
    ["Ultra-saturated #CCFF00 volt lime", "Subtle carbon starlight backdrop", "Maximum pop on dark mode Apple Watch"],
    [["Carbon Weave", "#060A05"], ["High-Volt Lime", "#CCFF00"], ["Emerald Core", "#10B981"], ["Supernova White", "#FFFFFF"]],
    {"Focus": "Finish & Palette", "Metaphor": "High-voltage athletic charge", "ScaleAt16px": "Unstoppable vibrant neon", "Vibe": "Hyper-electric & Modern"},
    """
    <defs>
      <linearGradient id="bg_126" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1107"/><stop offset="1" stop-color="#010301"/></linearGradient>
      <filter id="glow_126" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_126)"/>
    <!-- Left Neon Leaf -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#CCFF00" filter="url(#glow_126)"/>
    <!-- Right Neon Leaf -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#10B981"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.65"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..###..###..
...######...
....####....
.....##.....
....####....
...######...
....####....
............
"""
)

# 127 · Solar Citrus Sprout
add_r2(
    "sprout-solar-citrus", 127, "r2-palette",
    "Solar Citrus Sprout",
    "Warm athletic solar orange bleeding into fresh spring lime gradients",
    "Capturing the golden hour sunrise of early morning training: warm athletic solar amber blends into crisp photosynthetic lime, radiating warmth, optimism, and early-morning grit.",
    ["Solar amber to spring lime gradient", "Morning sunrise workout aura", "Invigorating warm athletic vibe"],
    [["Deep Roast", "#0F0F07"], ["Solar Amber", "#F59E0B"], ["Spring Lime", "#84CC16"], ["Pure Sun", "#FFFFFF"]],
    {"Focus": "Finish & Palette", "Metaphor": "Sunrise morning workout energy", "ScaleAt16px": "Warm dual-tone glow", "Vibe": "Warm & Inspiring"},
    """
    <defs>
      <linearGradient id="bg_127" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14180A"/><stop offset="1" stop-color="#040602"/></linearGradient>
      <linearGradient id="lg_127l" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#F59E0B"/><stop offset="1" stop-color="#A3E635"/></linearGradient>
      <linearGradient id="lg_127r" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#EA580C"/><stop offset="1" stop-color="#84CC16"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_127)"/>
    <!-- Left Leaf -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="url(#lg_127l)"/>
    <!-- Right Leaf -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="url(#lg_127r)"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
    """,
    """
............
...##..##...
..####.####.
..##....##..
...######...
....####....
...######...
..########..
...######...
....####....
.....##.....
............
"""
)

# 128 · Deep Emerald Vitality
add_r2(
    "sprout-emerald", 128, "r2-palette",
    "Deep Emerald Vitality",
    "Deep forest jade and botanical emerald with jewel-like dimensionality",
    "Luxury sports aesthetic: rich forest emerald, alpine pine, and translucent jade gradients create a mature, grounded athletic identity that feels prestigious on titanium Apple Watch cases.",
    ["Prestige alpine emerald and jade", "Multi-layered depth without skeuomorphism", "Sophisticated high-end sports feel"],
    [["Alpine Forest", "#05130A"], ["Vibrant Jade", "#10B981"], ["Deep Emerald", "#047857"], ["Frosted White", "#F0FDF4"]],
    {"Focus": "Finish & Palette", "Metaphor": "Alpine mountain pine resilience", "ScaleAt16px": "Rich deep-contrast green", "Vibe": "Mature & Prestigious"},
    """
    <defs>
      <linearGradient id="bg_128" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07190F"/><stop offset="1" stop-color="#020804"/></linearGradient>
      <linearGradient id="lg_128" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#065F46"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_128)"/>
    <!-- Left Leaf -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="url(#lg_128)"/>
    <!-- Right Leaf -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#047857"/>
    <circle cx="512" cy="800" r="48" fill="#F0FDF4"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..###..###..
...######...
....####....
.....##.....
....####....
...######...
....####....
............
"""
)

# 129 · Bioluminescent Phosphor
add_r2(
    "sprout-biolum", 129, "r2-palette",
    "Bioluminescent Phosphor",
    "Abyssal starlight background with glowing neon cyan-lime leaf halos",
    "Deep-sea and night-run energy: the cotyledon leaf edges cast a soft cyan bioluminescent glow into the surrounding abyss, turning late-night workouts into luminous experiences.",
    ["Soft cyan bioluminescent halo", "Dual-tone lime & cyan glow", "Designed for late-night running & lifting"],
    [["Abyssal Void", "#02070A"], ["Biolum Cyan", "#06B6D4"], ["Neon Lime", "#84CC16"], ["Radiant White", "#FFFFFF"]],
    {"Focus": "Finish & Palette", "Metaphor": "Living night-glow in the dark", "ScaleAt16px": "Distinct cyan-lime aura", "Vibe": "Mysterious & Luminous"},
    """
    <defs>
      <linearGradient id="bg_129" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#051219"/><stop offset="1" stop-color="#010305"/></linearGradient>
      <filter id="halo_129" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="24" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_129)"/>
    <!-- Left Leaf -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#84CC16" filter="url(#halo_129)"/>
    <!-- Right Leaf -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#06B6D4" filter="url(#halo_129)"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.65"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
    """,
    """
............
...##..##...
..####.####.
.##..#.#..##
.##..#.#..##
..####.####.
...######...
....####....
.....##.....
....####....
....####....
............
"""
)

# 130 · Pure Monochrome Sprout
add_r2(
    "sprout-mono-pure", 130, "r2-palette",
    "Pure Monochrome Sprout",
    "Stark Swiss high-contrast black and white edition with perfect tactile contrast",
    "The acid test of any iconic brand identity: rendered purely in optical black and chalk white, the twin cotyledons and seed node achieve timeless athletic authority.",
    ["100% monochrome black and white", "Uncompromising optical contrast", "Works on any background material"],
    [["Pitch Black", "#000000"], ["Chalk White", "#FFFFFF"], ["Graphite Half-Tone", "#666666"]],
    {"Focus": "Finish & Palette", "Metaphor": "Timeless monochrome authority", "ScaleAt16px": "Unstoppable stark contrast", "Vibe": "Timeless & Iconic"},
    """
    <rect width="1024" height="1024" fill="#0A0A0A"/>
    <!-- Left Leaf White -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#FFFFFF"/>
    <!-- Right Leaf Half-Tone -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#888888"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
    <circle cx="512" cy="800" r="24" fill="#0A0A0A"/>
    """,
    """
    <rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#FFFFFF"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#FFFFFF"/>
    """,
    """
............
..##....##..
.####..####.
.####..####.
..###..###..
...######...
....####....
.....##.....
....####....
...######...
....####....
............
"""
)

def get_r2_candidates():
    return r2_candidates

def get_r2_grids():
    return r2_grids

if __name__ == "__main__":
    print(f"Total Round 2 candidates defined: {len(r2_candidates)}")
    for c in r2_candidates:
        lines = c["grid"].split("\n")
        assert len(lines) == 12, f"Invalid grid height for {c['id']}: {len(lines)}"
        for row in lines:
            assert len(row) == 12, f"Invalid row length for {c['id']}: {len(row)} in {row}"
            assert all(ch in "#." for ch in row), f"Invalid character in {c['id']}: {row}"
    print("All 30 Round 2 candidates and grids verified perfectly!")
