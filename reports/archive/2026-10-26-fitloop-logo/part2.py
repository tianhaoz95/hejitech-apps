# Part 2: Groups 3 & 4 (Candidates 21 to 40)
def get_part2(make_cand):
    c = []

    # ──────── GROUP 3: Monogram FL & Typographic Marks (21–30) ────────
    c.append(make_cand(
        "monogram-fl", 21, "monogram", "Architectural FL",
        "Heavyweight geometric 'F' whose lower bar loops seamlessly into an 'L'",
        "A bespoke geometric athletic monogram. The vertical stem of the 'F' curves into the horizontal base of the 'L' in one fluid sweep, while the upper arm of the 'F' shoots forward like a runner off the blocks.",
        ["Bold architectural stem", "Continuous bottom F-to-L loop curve", "45-degree speed chamfers"],
        [["Jet Black", "#111111"], ["Hyper Orange", "#FF4500"], ["Warm Off-White", "#F5F5F7"], ["Smoked Gray", "#2C2C2E"]],
        {"Family": "Monogram FL", "Metaphor": "Letterforms F + L in one stroke", "Vibe": "Punchy & Bold", "ScaleAt16px": "Unmistakable silhouette"},
        """<defs>
          <linearGradient id="bg_mfl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181A"/><stop offset="1" stop-color="#0B0B0C"/></linearGradient>
          <linearGradient id="g_mfl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5722"/><stop offset="1" stop-color="#FF9800"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mfl)"/>
        <path d="M 320 220 L 760 220 L 700 340 L 320 340 Z" fill="#FFFFFF"/>
        <path d="M 320 440 L 640 440 L 580 560 L 320 560 Z" fill="url(#g_mfl)"/>
        <path d="M 320 220 L 320 640 C 320 740 400 820 500 820 L 760 820 L 800 700 L 500 700 C 440 700 420 680 420 620 L 420 220 Z" fill="url(#g_mfl)"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 320 220 L 760 220 L 700 340 L 320 340 Z" fill="#00FF66"/><path d="M 320 440 L 640 440 L 580 560 L 320 560 Z" fill="#00FF66"/><path d="M 320 220 L 320 640 C 320 740 400 820 500 820 L 760 820 L 800 700 L 500 700 C 440 700 420 680 420 620 L 420 220 Z" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "wire-fl", 22, "monogram", "Continuous Neon Wire",
        "A single unbroken luminous neon tube tracing both 'F' and 'L'",
        "Inspired by neon light art and laser wire: one single unbroken line drawn without lifting the pen that forms an 'F' and 'L'. Utterly minimal, light, agile, and glows beautifully on OLED screens.",
        ["Single continuous stroke path", "Rounded endcaps", "Vivid neon tube glow on OLED black"],
        [["OLED Black", "#050505"], ["Neon Lime", "#22C55E"], ["Cyber Yellow", "#EAB308"], ["Glow Halo", "#15803D"]],
        {"Family": "Monogram FL", "Metaphor": "Single continuous wire", "Vibe": "Ultra-clean & Agile", "ScaleAt16px": "Very legible stroke"},
        """<defs>
          <filter id="glow_wire" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#050505"/>
        <g filter="url(#glow_wire)" fill="none" stroke="#22C55E" stroke-width="72" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 740 240 L 320 240 L 320 460 L 620 460 L 320 460 L 320 700 C 320 780 380 820 460 820 L 760 820"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 740 240 L 320 240 L 320 460 L 620 460 L 320 460 L 320 700 C 320 780 380 820 460 820 L 760 820" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>"""
    ))

    c.append(make_cand(
        "hex-loop", 23, "monogram", "Isometric Hex Loop",
        "An isometric 3D hexagon prism whose facets form an interlocking 'F' and 'L'",
        "Precision isometric engineering. A faceted hexagonal ring with impossible-geometry shading where the top and left facets construct the 'F' and the lower base constructs the 'L'.",
        ["Isometric 30-degree grid", "Three-tone facet lighting", "Impossible hex geometry illusion"],
        [["Gunmetal", "#1E293B"], ["Cobalt Blue", "#2563EB"], ["Sky Cyan", "#38BDF8"], ["Ice White", "#F0F9FF"]],
        {"Family": "Monogram FL", "Metaphor": "Hexagonal prism loop", "Vibe": "Engineered & Tech", "ScaleAt16px": "Solid faceted icon"},
        """<defs><linearGradient id="bg_hex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hex)"/>
        <g stroke="#0F172A" stroke-width="6" stroke-linejoin="round">
          <polygon points="512,180 780,334 680,390 512,294 344,390 244,334" fill="#38BDF8"/>
          <polygon points="244,334 344,390 344,690 244,634" fill="#2563EB"/>
          <polygon points="344,480 620,480 560,540 344,540" fill="#38BDF8"/>
          <polygon points="780,334 780,634 680,690 680,390" fill="#1D4ED8"/>
          <polygon points="344,690 512,786 780,786 680,690 512,690 244,634" fill="#1E3A8A"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"><polygon points="512,180 780,334 780,634 512,786 244,634 244,334"/><line x1="344" y1="490" x2="620" y2="490"/></g>"""
    ))

    c.append(make_cand(
        "glyph", 24, "monogram", "Loop Glyph (Alpha F)",
        "An elegant ribbon loop glyph with a swift athletic crossbar slash",
        "Modern athletic minimalism in the vein of Nike or On Running. A fluid teardrop ribbon loop that self-intersects at the bottom, crossed by a dynamic forward-slanted speed bar that forms a stylized 'F'.",
        ["Self-crossing fluid ribbon loop", "Forward 60-degree athletic slash", "Balanced negative space geometry"],
        [["Dark Heather", "#191D24"], ["Coral Pop", "#FF6347"], ["Soft Peach", "#FFDAB9"], ["Deep Shadow", "#0D0E11"]],
        {"Family": "Monogram FL", "Metaphor": "Athletic speed glyph", "Vibe": "Sleek & Fashion-forward", "ScaleAt16px": "Iconic symbol"},
        """<defs>
          <linearGradient id="bg_gly" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F242D"/><stop offset="1" stop-color="#0B0D11"/></linearGradient>
          <linearGradient id="g_gly" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6347"/><stop offset="1" stop-color="#FF8A65"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_gly)"/>
        <path d="M 380 780 L 640 280 C 740 180 840 300 760 440 L 260 760" fill="none" stroke="url(#g_gly)" stroke-width="96" stroke-linecap="round"/>
        <path d="M 320 460 L 700 460" fill="none" stroke="#FFFFFF" stroke-width="84" stroke-linecap="round"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 380 780 L 640 280 C 740 180 840 300 760 440 L 260 760" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><path d="M 320 460 L 700 460" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "fold-fl", 25, "monogram", "Origami Ribbon FL",
        "Interlocking folded athletic ribbons with dimensional shadow overlap",
        "Two folded technical fabric ribbons (like high-performance running singlets) layered to create 'F' and 'L'. The subtle drop shadows between folds give tactile physical depth without skeuomorphism.",
        ["Crisp angled fold planes", "Soft self-shadowing between layers", "Dual contrast (Papaya and Coral)"],
        [["Pure Obsidian", "#0E1015"], ["Papaya Whip", "#FF7F50"], ["Safety Orange", "#FF3B00"], ["Soft Cream", "#FFF5EE"]],
        {"Family": "Monogram FL", "Metaphor": "Folded athletic ribbons", "Vibe": "Tactile & Premium", "ScaleAt16px": "Strong geometric facets"},
        """<defs>
          <linearGradient id="bg_fld" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171F"/><stop offset="1" stop-color="#08090C"/></linearGradient>
          <filter id="fld_sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="-6" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.5"/></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_fld)"/>
        <path d="M 300 240 L 440 240 L 440 680 L 760 680 L 760 820 L 300 820 Z" fill="#FF3B00"/>
        <g filter="url(#fld_sh)">
          <path d="M 300 240 L 780 240 L 700 380 L 440 380 Z" fill="#FF7F50"/>
          <path d="M 440 460 L 680 460 L 600 580 L 440 580 Z" fill="#FFA07A"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 300 240 L 440 240 L 440 680 L 760 680 L 760 820 L 300 820 Z" fill="#00FF66"/><path d="M 300 240 L 780 240 L 700 380 L 440 380 Z" fill="#00FF66" stroke="#000" stroke-width="16"/><path d="M 440 460 L 680 460 L 600 580 L 440 580 Z" fill="#00FF66" stroke="#000" stroke-width="16"/>"""
    ))

    c.append(make_cand(
        "stencil-fl", 26, "monogram", "Stencil Speed FL",
        "Bold military athletic stencil cutouts with 45-degree forward speed slashes",
        "Brutalist athletic training: heavy stencil letterforms cut with aerodynamic 45-degree slashes. Evokes tactical gym equipment, CrossFit rigs, and unstoppable forward momentum.",
        ["Heavy geometric stencil stems", "45-degree speed channels", "Safety yellow high-visibility pop"],
        [["Gunmetal", "#18181B"], ["Safety Yellow", "#FACC15"], ["Pure White", "#FFFFFF"], ["Iron Core", "#27272A"]],
        {"Family": "Monogram FL", "Metaphor": "Tactical stencil F+L", "Vibe": "Brutalist & Powerful", "ScaleAt16px": "Heavy high contrast"},
        """<defs><linearGradient id="bg_stn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_stn)"/>
        <!-- F Top Bar -->
        <rect x="280" y="220" width="460" height="100" fill="#FACC15"/>
        <!-- F Mid Bar -->
        <rect x="420" y="440" width="300" height="90" fill="#FACC15"/>
        <!-- Vertical Stem Broken Stencil -->
        <rect x="280" y="360" width="100" height="200" fill="#FFFFFF"/>
        <!-- L Base -->
        <path d="M 280 600 L 380 600 L 380 720 L 740 720 L 740 820 L 280 820 Z" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="280" y="220" width="460" height="100" fill="#00FF66"/><rect x="420" y="440" width="300" height="90" fill="#00FF66"/><rect x="280" y="360" width="100" height="200" fill="#00FF66"/><path d="M 280 600 L 380 600 L 380 720 L 740 720 L 740 820 L 280 820 Z" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "interlock-fl", 27, "monogram", "Interlocking Links FL",
        "Two heavy chain links that interlace to form the 'F' and 'L'",
        "Symbolizes unbreakable athletic discipline: two polished metal chain links interlocking in physical strength, forming the F upper loop and L base foot.",
        ["Dual interlocking oval chain links", "Polished metallic edge highlights", "Industrial chrome & ember"],
        [["Dark Graphite", "#111827"], ["Forged Ember", "#F97316"], ["Chrome Silver", "#E2E8F0"], ["Matte Iron", "#374151"]],
        {"Family": "Monogram FL", "Metaphor": "Interlocked chain links", "Vibe": "Heavy Duty & Reliable", "ScaleAt16px": "Crisp interlocking loops"},
        """<defs><linearGradient id="bg_lnk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_lnk)"/>
        <!-- Link 1 (F loop) -->
        <rect x="280" y="220" width="460" height="340" rx="170" fill="none" stroke="#F97316" stroke-width="72"/>
        <!-- Link 2 (L loop) -->
        <rect x="420" y="440" width="340" height="420" rx="170" fill="none" stroke="#E2E8F0" stroke-width="72"/>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="280" y="220" width="460" height="340" rx="170" fill="none" stroke="#00FF66" stroke-width="64"/><rect x="420" y="440" width="340" height="420" rx="170" fill="none" stroke="#00FF66" stroke-width="64"/>"""
    ))

    c.append(make_cand(
        "chamfer-fl", 28, "monogram", "Chamfer Kinetic FL",
        "Monogram crafted with aerodynamic racecar chamfers and forward rake",
        "Inspired by Formula 1 sidepods and aerodynamic splitters: F and L letterforms styled with 15-degree forward rake and 45-degree corner bevels.",
        ["15-degree forward kinetic slant", "Precision aerodynamic bevel chamfers", "Electric cyan & white racing livery"],
        [["Carbon Fiber", "#090B0E"], ["Aero Cyan", "#00F0FF"], ["Racing White", "#FFFFFF"], ["Graphite", "#1E2229"]],
        {"Family": "Monogram FL", "Metaphor": "Motorsport aero chamfers", "Vibe": "Aggressive & Aerodynamic", "ScaleAt16px": "Distinct raked lines"},
        """<defs><linearGradient id="bg_chm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1217"/><stop offset="1" stop-color="#040608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_chm)"/>
        <g transform="skewX(-15) translate(180, 0)">
          <path d="M 320 220 L 680 220 L 620 340 L 440 340 L 440 440 L 580 440 L 520 540 L 440 540 L 440 700 L 720 700 L 680 820 L 320 820 Z" fill="#00F0FF"/>
          <circle cx="680" cy="220" r="28" fill="#FFFFFF"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g transform="skewX(-15) translate(180, 0)"><path d="M 320 220 L 680 220 L 620 340 L 440 340 L 440 440 L 580 440 L 520 540 L 440 540 L 440 700 L 720 700 L 680 820 L 320 820 Z" fill="#00FF66"/></g>"""
    ))

    c.append(make_cand(
        "negative-fl", 29, "monogram", "Negative Space FL",
        "Solid circular disc with negative-space cutout revealing dynamic F and L",
        "A heavy circular solid emblem in blazing solar coral with precision negative-space cutouts carving out 'F' and 'L' from the void.",
        ["Solid circular foundation emblem", "Precision subtractive negative space", "High-contrast silhouette"],
        [["Void Night", "#050505"], ["Blazing Coral", "#FF5E3A"], ["Pure White", "#FFFFFF"], ["Shadow Black", "#000000"]],
        {"Family": "Monogram FL", "Metaphor": "Negative space carving", "Vibe": "Graphic & Timeless", "ScaleAt16px": "Crisp white-on-coral badge"},
        """<defs><linearGradient id="bg_neg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141118"/><stop offset="1" stop-color="#050406"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_neg)"/>
        <circle cx="512" cy="512" r="360" fill="#FF5E3A"/>
        <path d="M 340 300 L 680 300 L 680 400 L 460 400 L 460 480 L 620 480 L 620 580 L 460 580 L 460 680 L 700 680 L 700 780 L 340 780 Z" fill="#050406"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="#00FF66"/><path d="M 340 300 L 680 300 L 680 400 L 460 400 L 460 480 L 620 480 L 620 580 L 460 580 L 460 680 L 700 680 L 700 780 L 340 780 Z" fill="#000"/>"""
    ))

    c.append(make_cand(
        "tubular-fl", 30, "monogram", "Tubular Track FL",
        "Rounded stadium tube geometry bending through 90-degree athletic elbows",
        "Inspired by architectural stadium handrails and Olympic track lane dividers: a 96px heavy rounded tube that traces 'F' and 'L' with pill-smooth radiuses.",
        ["Consistent 96px tubular line weight", "Smooth circular bends", "High-voltage fluorescent green"],
        [["Pitch Black", "#000000"], ["Fluorescent Green", "#10B981"], ["Bright Lime", "#84CC16"], ["Deep Forest", "#064E3B"]],
        {"Family": "Monogram FL", "Metaphor": "Architectural track tube", "Vibe": "Clean & Tangible", "ScaleAt16px": "Thick continuous pipe"},
        """<defs><linearGradient id="bg_tub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06120E"/><stop offset="1" stop-color="#010503"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tub)"/>
        <g stroke="#10B981" stroke-width="96" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 720 260 L 340 260 L 340 760 L 720 760"/>
          <path d="M 340 480 L 620 480"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="96" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M 720 260 L 340 260 L 340 760 L 720 760"/><path d="M 340 480 L 620 480"/></g>"""
    ))

    # ──────── GROUP 4: High-Tech HUD & Smart Glasses (31–40) ────────
    c.append(make_cand(
        "hud", 31, "hud", "Even G2 Optical Reticle",
        "Precision optical collimator HUD with targeting ticks and energy nucleus",
        "Designed directly from FitLoop's Even G2 and R1 smart glasses integration: an optical heads-up collimator reticle with four cardinal ticks, an open telemetry circular frame, and a glowing central target pip.",
        ["Optical collimator circle", "4 cardinal target ticks", "Central micro-pip with HUD telemetry frame"],
        [["OLED Black", "#000000"], ["G2 Emerald", "#00FF66"], ["Phosphor Green", "#10B981"], ["Bright White", "#FFFFFF"]],
        {"Family": "HUD & Optics", "Metaphor": "Smart glasses HUD reticle", "Vibe": "Tactical & Glanceable", "ScaleAt16px": "Razor sharp"},
        """<defs><filter id="glow_hud" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <rect width="1024" height="1024" fill="#020804"/>
        <g filter="url(#glow_hud)" stroke="#00FF66" fill="none">
          <circle cx="512" cy="512" r="360" stroke-width="28" stroke-dasharray="240 80 160 80"/>
          <circle cx="512" cy="512" r="240" stroke-width="44"/>
          <line x1="512" y1="110" x2="512" y2="230" stroke-width="48" stroke-linecap="round"/>
          <line x1="512" y1="794" x2="512" y2="914" stroke-width="48" stroke-linecap="round"/>
          <line x1="110" y1="512" x2="230" y2="512" stroke-width="48" stroke-linecap="round"/>
          <line x1="794" y1="512" x2="914" y2="512" stroke-width="48" stroke-linecap="round"/>
          <circle cx="512" cy="512" r="64" fill="#00FF66"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="28" stroke-dasharray="240 80 160 80"/><circle cx="512" cy="512" r="240" fill="none" stroke="#00FF66" stroke-width="44"/><line x1="512" y1="110" x2="512" y2="230" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><line x1="512" y1="794" x2="512" y2="914" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><line x1="110" y1="512" x2="230" y2="512" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><line x1="794" y1="512" x2="914" y2="512" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><circle cx="512" cy="512" r="64" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "node-loop", 32, "hud", "Agentic Tri-Node",
        "Three orbiting device nodes (Phone, Watch, Glasses) linked to an AI core",
        "The hardware and intelligence architecture of FitLoop visualized: three glowing peripheral sensor nodes linked by curved orbital arcs around a central AI agent nucleus.",
        ["Three 120-degree orbital satellite nodes", "Curved linking tracks", "Central pulsing AI core"],
        [["Deep Indigo", "#0F172A"], ["Electric Violet", "#7C3AED"], ["Cyan Link", "#06B6D4"], ["Core Glow", "#E0E7FF"]],
        {"Family": "HUD & Optics", "Metaphor": "MCP multi-device network", "Vibe": "Connected & High-tech", "ScaleAt16px": "Distinct node cluster"},
        """<defs><linearGradient id="bg_nod" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_nod)"/>
        <path d="M 512 240 Q 760 380 760 680 Q 512 780 264 680 Q 264 380 512 240 Z" fill="none" stroke="#7C3AED" stroke-width="48" stroke-dasharray="140 30"/>
        <circle cx="512" cy="512" r="96" fill="#06B6D4"/><circle cx="512" cy="512" r="140" fill="none" stroke="#06B6D4" stroke-width="12" opacity="0.4"/>
        <circle cx="512" cy="240" r="64" fill="#FFFFFF" stroke="#06B6D4" stroke-width="16"/>
        <circle cx="760" cy="680" r="64" fill="#FFFFFF" stroke="#7C3AED" stroke-width="16"/>
        <circle cx="264" cy="680" r="64" fill="#FFFFFF" stroke="#7C3AED" stroke-width="16"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 240 Q 760 380 760 680 Q 512 780 264 680 Q 264 380 512 240 Z" fill="none" stroke="#00FF66" stroke-width="48"/><circle cx="512" cy="512" r="88" fill="#00FF66"/><circle cx="512" cy="240" r="60" fill="#000" stroke="#00FF66" stroke-width="24"/><circle cx="760" cy="680" r="60" fill="#000" stroke="#00FF66" stroke-width="24"/><circle cx="264" cy="680" r="60" fill="#000" stroke="#00FF66" stroke-width="24"/>"""
    ))

    c.append(make_cand(
        "aperture", 33, "hud", "Kinetic Aperture",
        "Six sweeping curved camera aperture blades opening on your daily plan",
        "A mechanical iris aperture composed of 6 curved blades that spiral outward from a central hexagonal opening. Symbolizes focusing on the plan, optical precision, and opening a window into your biometric day.",
        ["Six rotational curved blades", "Dynamic gradient spiral", "Sharp hexagonal core aperture"],
        [["Midnight Gray", "#111827"], ["Tangerine", "#F97316"], ["Amber Gold", "#FBBF24"], ["Warm White", "#FEF3C7"]],
        {"Family": "HUD & Optics", "Metaphor": "Camera lens iris", "Vibe": "Focus & Optical", "ScaleAt16px": "Recognizable swirl"},
        """<defs>
          <linearGradient id="bg_apt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient>
          <linearGradient id="g_apt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F97316"/><stop offset="1" stop-color="#FBBF24"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_apt)"/>
        <g transform="translate(512,512)">
          <g transform="rotate(0)"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" fill="url(#g_apt)" stroke="#030712" stroke-width="16" opacity="0.95"/></g>
          <g transform="rotate(60)"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" fill="url(#g_apt)" stroke="#030712" stroke-width="16" opacity="0.95"/></g>
          <g transform="rotate(120)"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" fill="url(#g_apt)" stroke="#030712" stroke-width="16" opacity="0.95"/></g>
          <g transform="rotate(180)"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" fill="url(#g_apt)" stroke="#030712" stroke-width="16" opacity="0.95"/></g>
          <g transform="rotate(240)"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" fill="url(#g_apt)" stroke="#030712" stroke-width="16" opacity="0.95"/></g>
          <g transform="rotate(300)"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" fill="url(#g_apt)" stroke="#030712" stroke-width="16" opacity="0.95"/></g>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g transform="translate(512,512)" stroke="#000" stroke-width="20" fill="#00FF66"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(60)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(120)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(180)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(240)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(300)"/></g>"""
    ))

    c.append(make_cand(
        "twin", 34, "hud", "Digital Twin Orbit",
        "Two mirrored teardrop droplet arcs in perpetual gravitational sync",
        "Represents the twin relationship at the heart of FitLoop: the digital AI agent coach and the physical human athlete orbiting each other in perpetual harmony.",
        ["Two mirrored droplet arcs", "Yin-Yang inspired kinetic tension", "Vibrant opposing gradients (Cyan & Mint)"],
        [["Cosmic Black", "#0B0C10"], ["Agent Cyan", "#00C9FF"], ["Athlete Mint", "#92FE9D"], ["Sync White", "#FFFFFF"]],
        {"Family": "HUD & Optics", "Metaphor": "Digital twin & Human athlete", "Vibe": "Harmonious & Modern", "ScaleAt16px": "Fluid dual swoosh"},
        """<defs>
          <linearGradient id="bg_twn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D1117"/><stop offset="1" stop-color="#030508"/></linearGradient>
          <linearGradient id="g_twn1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00C9FF"/><stop offset="1" stop-color="#92FE9D"/></linearGradient>
          <linearGradient id="g_twn2" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF5E3A"/><stop offset="1" stop-color="#FF2A54"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_twn)"/>
        <path d="M 512 180 C 720 180 840 320 840 512 C 840 680 720 780 620 780 C 520 780 480 700 480 620 C 480 540 540 480 540 400 C 540 280 440 200 512 180 Z" fill="url(#g_twn1)"/>
        <path d="M 512 844 C 304 844 184 704 184 512 C 184 344 304 244 404 244 C 504 244 544 324 544 404 C 544 484 484 544 484 624 C 484 744 584 824 512 844 Z" fill="url(#g_twn2)"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 C 720 180 840 320 840 512 C 840 680 720 780 620 780 C 520 780 480 700 480 620 C 480 540 540 480 540 400 C 540 280 440 200 512 180 Z" fill="#00FF66"/><path d="M 512 844 C 304 844 184 704 184 512 C 184 344 304 244 404 244 C 504 244 544 324 544 404 C 544 484 484 544 484 624 C 484 744 584 824 512 844 Z" fill="#00FF66" opacity="0.6"/>"""
    ))

    c.append(make_cand(
        "prism", 35, "hud", "Refractive Prism Core",
        "Precision faceted diamond gem loop refracting infrared into electric mint",
        "Luxury high-performance athletic aesthetic (inspired by District Vision or Satisfy Running). A geometric faceted diamond loop that refracts deep infrared workout burn into crisp electric mint recovery.",
        ["Faceted gemstone wireframe", "Chromatic infrared-to-mint gradient", "Ultra-fine precision polygon facets"],
        [["Pure Obsidian", "#050508"], ["Infrared", "#FF0844"], ["Solar Orange", "#FFB199"], ["Electric Mint", "#00F2FE"]],
        {"Family": "HUD & Optics", "Metaphor": "Refractive jewel loop", "Vibe": "Luxury Athletic & Edgy", "ScaleAt16px": "Sharp faceted diamond"},
        """<defs>
          <linearGradient id="bg_prs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E0E14"/><stop offset="1" stop-color="#040407"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_prs)"/>
        <g stroke="#0E0E14" stroke-width="8" stroke-linejoin="round">
          <polygon points="512,180 720,340 512,420 304,340" fill="#FFB199"/>
          <polygon points="304,340 512,420 440,640 180,512" fill="#FF0844"/>
          <polygon points="720,340 844,512 584,640 512,420" fill="#00F2FE"/>
          <polygon points="180,512 440,640 512,844" fill="#C70039"/>
          <polygon points="844,512 584,640 512,844" fill="#00B4D8"/>
          <polygon points="512,360 620,460 512,560 404,460" fill="#040407"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g fill="none" stroke="#00FF66" stroke-width="36" stroke-linejoin="round"><polygon points="512,180 844,512 512,844 180,512"/><polygon points="512,360 620,460 512,560 404,460"/><line x1="512" y1="180" x2="512" y2="360"/><line x1="844" y1="512" x2="620" y2="460"/><line x1="512" y1="844" x2="512" y2="560"/><line x1="180" y1="512" x2="404" y2="460"/></g>"""
    ))

    c.append(make_cand(
        "collimator-cross", 36, "hud", "Collimator Crosshair",
        "Precision HUD sighting circle with digital degree ticks and center laser dot",
        "A heads-up targeting collimator with four radial tick brackets and micro-hash degree markers. Instantly evokes fighter jet HUDs and AR smart glasses telemetry.",
        ["Collimator sighting geometry", "Micro degree hash ticks", "G2 phosphor green calibration"],
        [["OLED Dark", "#020703"], ["HUD Green", "#00FF66"], ["Telematic White", "#FFFFFF"], ["Glass Tint", "#051A0B"]],
        {"Family": "HUD & Optics", "Metaphor": "Collimator gun sight", "Vibe": "Military AR & Precision", "ScaleAt16px": "Crisp crosshair"},
        """<defs><linearGradient id="bg_col" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041208"/><stop offset="1" stop-color="#010402"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_col)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32" stroke-dasharray="140 40"/>
        <line x1="512" y1="130" x2="512" y2="320" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <line x1="512" y1="704" x2="512" y2="894" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <line x1="130" y1="512" x2="320" y2="512" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <line x1="704" y1="512" x2="894" y2="512" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="44" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><line x1="512" y1="130" x2="512" y2="320" stroke="#00FF66" stroke-width="44"/><line x1="512" y1="704" x2="512" y2="894" stroke="#00FF66" stroke-width="44"/><line x1="130" y1="512" x2="320" y2="512" stroke="#00FF66" stroke-width="44"/><line x1="704" y1="512" x2="894" y2="512" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="44" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "telemetry-vector", 37, "hud", "Telemetry Compass",
        "Angular heads-up vector showing current bearing, pace, and heart rate",
        "An angular navigational chevron framed inside a telemetry ring with directional tick markers. Represents moving purposefully along your workout route.",
        ["Triangular directional chevron", "Concentric compass ticks", "Laser cyan navigation"],
        [["Night Sky", "#0A0E1A"], ["Vector Cyan", "#38BDF8"], ["Core White", "#FFFFFF"], ["Deep Navy", "#1E293B"]],
        {"Family": "HUD & Optics", "Metaphor": "HUD telemetry compass", "Vibe": "Navigational & Direct", "ScaleAt16px": "Distinct upward arrow"},
        """<defs><linearGradient id="bg_tel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tel)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#1E293B" stroke-width="48"/>
        <polygon points="512,220 740,680 512,580 284,680" fill="#38BDF8"/>
        <circle cx="512" cy="512" r="36" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="44"/><polygon points="512,220 740,680 512,580 284,680" fill="#00FF66"/><circle cx="512" cy="512" r="32" fill="#000"/>"""
    ))

    c.append(make_cand(
        "rangefinder-arc", 38, "hud", "Rangefinder Bracket",
        "Optical HUD corner brackets framing a live performance reticle",
        "Four precision optical corner brackets that frame a central performance gauge. Emulates looking through smart glasses as biometric data locks onto your field of view.",
        ["Four corner framing brackets", "Central segmented speed ring", "G2 phosphor green aesthetic"],
        [["Obsidian Void", "#030604"], ["Phosphor Green", "#22C55E"], ["Telemetry Pale", "#86EFAC"], ["Frame Dark", "#14532D"]],
        {"Family": "HUD & Optics", "Metaphor": "Optical viewfinder brackets", "Vibe": "Targeted & Immersive", "ScaleAt16px": "Boxed crosshair"},
        """<defs><linearGradient id="bg_rng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041208"/><stop offset="1" stop-color="#010402"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rng)"/>
        <!-- 4 Corner Brackets -->
        <g stroke="#22C55E" stroke-width="54" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 220 340 L 220 220 L 340 220"/>
          <path d="M 804 340 L 804 220 L 684 220"/>
          <path d="M 220 684 L 220 804 L 340 804"/>
          <path d="M 804 684 L 804 804 L 684 804"/>
        </g>
        <circle cx="512" cy="512" r="180" fill="none" stroke="#86EFAC" stroke-width="44"/>
        <circle cx="512" cy="512" r="54" fill="#22C55E"/>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="54" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M 220 340 L 220 220 L 340 220"/><path d="M 804 340 L 804 220 L 684 220"/><path d="M 220 684 L 220 804 L 340 804"/><path d="M 804 684 L 804 804 L 684 804"/></g><circle cx="512" cy="512" r="180" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "polarizer-ring", 39, "hud", "Polarized Lens Ring",
        "Dual concentric optical rings showing polarized sports glass glare filter",
        "Inspired by high-performance eyewear optics (Oakley Prizm / Smith ChromaPop): twin concentric polarizer rings with 45-degree micro-refraction louvers.",
        ["Dual optical polarizer circles", "Internal refraction slats", "Infrared-to-amber optical shift"],
        [["Midnight Glass", "#0B0C10"], ["Solar Amber", "#F59E0B"], ["Infrared Ruby", "#E11D48"], ["Lens Rim", "#374151"]],
        {"Family": "HUD & Optics", "Metaphor": "Polarized sports eyewear", "Vibe": "Optometric & Crisp", "ScaleAt16px": "Dual concentric lens"},
        """<defs>
          <linearGradient id="bg_pol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient>
          <linearGradient id="g_pol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E11D48"/><stop offset="1" stop-color="#F59E0B"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_pol)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#374151" stroke-width="44"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="url(#g_pol)" stroke-width="72"/>
        <line x1="320" y1="512" x2="704" y2="512" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="64" fill="#F59E0B"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="40"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="64"/><line x1="320" y1="512" x2="704" y2="512" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "hud-horizon", 40, "hud", "HUD Pitch Horizon",
        "Flight-HUD pitch & roll horizon line combined with cadence level indicator",
        "An aviation-inspired heads-up attitude indicator: a circular reticle with a stepped pitch ladder and roll horizon line, visualizing perfect athletic posture and balance.",
        ["Circular HUD outer dial", "Stepped pitch ladder bars", "Central flight pip in electric cyan"],
        [["Deep Cockpit", "#070A12"], ["Cyan Avionics", "#06B6D4"], ["Phosphor Sky", "#38BDF8"], ["Ground Navy", "#1E293B"]],
        {"Family": "HUD & Optics", "Metaphor": "Flight attitude indicator", "Vibe": "Aviation HUD & Stability", "ScaleAt16px": "Ladder in circle"},
        """<defs><linearGradient id="bg_hor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1120"/><stop offset="1" stop-color="#020408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hor)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#1E293B" stroke-width="36"/>
        <!-- Horizon Wings -->
        <line x1="200" y1="512" x2="380" y2="512" stroke="#06B6D4" stroke-width="54" stroke-linecap="round"/>
        <line x1="644" y1="512" x2="824" y2="512" stroke="#06B6D4" stroke-width="54" stroke-linecap="round"/>
        <!-- Pitch Ladder -->
        <line x1="420" y1="360" x2="604" y2="360" stroke="#38BDF8" stroke-width="36" stroke-linecap="round"/>
        <line x1="420" y1="664" x2="604" y2="664" stroke="#38BDF8" stroke-width="36" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="44" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><line x1="200" y1="512" x2="380" y2="512" stroke="#00FF66" stroke-width="48"/><line x1="644" y1="512" x2="824" y2="512" stroke="#00FF66" stroke-width="48"/><line x1="420" y1="360" x2="604" y2="360" stroke="#00FF66" stroke-width="32"/><line x1="420" y1="664" x2="604" y2="664" stroke="#00FF66" stroke-width="32"/><circle cx="512" cy="512" r="40" fill="#00FF66"/>"""
    ))

    return c
