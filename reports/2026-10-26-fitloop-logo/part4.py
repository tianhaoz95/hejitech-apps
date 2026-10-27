# Part 4: Groups 7 & 8 (Candidates 61 to 80)
def get_part4(make_cand):
    c = []

    # ──────── GROUP 7: Scandinavian & Swiss Minimalism (61–70) ────────
    c.append(make_cand(
        "pure-circle-dot", 61, "minimal", "Circle & Singularity",
        "Ultra-pure hairline ring with an off-center solid planetary focal dot",
        "The absolute extreme of reduction: a pure 24px hairline circular perimeter with a single solid focal dot stationed at the 2 o'clock position.",
        ["Hairline 24px circular stroke", "Single off-center satellite dot", "High-contrast stark monochrome"],
        [["Pitch Black", "#000000"], ["Off-White", "#F8FAFC"], ["Slate Line", "#334155"], ["Pure White", "#FFFFFF"]],
        {"Family": "Minimalism", "Metaphor": "Celestial orbit & Singularity", "Vibe": "Stark & Contemplative", "ScaleAt16px": "Distinct ring with dot"},
        """<rect width="1024" height="1024" fill="#050505"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#F8FAFC" stroke-width="28"/>
        <circle cx="680" cy="344" r="72" fill="#F8FAFC"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="28"/><circle cx="680" cy="344" r="64" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "monoline-ring", 62, "minimal", "Monoline Balance",
        "Continuous 24px hairline circle with a single harmonic gap at 12 o'clock",
        "Swiss modernist balance: an unbroken hairline circle whose perimeter opens subtly at the apex, allowing breath and negative space to enter.",
        ["Pure open circle", "Single harmonic 30-degree apex gap", "Calm Nordic slate palette"],
        [["Nordic Mist", "#0E1116"], ["Nordic Slate", "#94A3B8"], ["Pure White", "#FFFFFF"], ["Deep Fjord", "#1E293B"]],
        {"Family": "Minimalism", "Metaphor": "Open loop of possibility", "Vibe": "Zen & Architectural", "ScaleAt16px": "Crisp open ring"},
        """<defs><linearGradient id="bg_mono" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11151C"/><stop offset="1" stop-color="#060709"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_mono)"/>
        <path d="M 570 176 A 340 340 0 1 1 454 176" fill="none" stroke="#FFFFFF" stroke-width="48" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="44" fill="#94A3B8"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 570 176 A 340 340 0 1 1 454 176" fill="none" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><circle cx="512" cy="512" r="40" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "bauhaus-quadrant", 63, "minimal", "Bauhaus Quadrant",
        "Four geometric primitives (circle, triangle, arc, square) in primary harmony",
        "Inspired by the Weimar Bauhaus and Kandinsky: a quadrant division uniting the circle (loop), square (foundation), and triangle (forward velocity).",
        ["Four foundational Bauhaus shapes", "Primary color palette (Red, Yellow, Blue)", "Strict geometric proportions"],
        [["Pure Black", "#000000"], ["Bauhaus Red", "#DC2626"], ["Bauhaus Yellow", "#FACC15"], ["Bauhaus Blue", "#2563EB"]],
        {"Family": "Minimalism", "Metaphor": "Bauhaus geometric primitives", "Vibe": "Art-school Classic", "ScaleAt16px": "Four bold color blocks"},
        """<rect width="1024" height="1024" fill="#0A0A0A"/>
        <!-- Top Left Circle -->
        <circle cx="360" cy="360" r="140" fill="#DC2626"/>
        <!-- Top Right Triangle -->
        <polygon points="664,220 780,480 548,480" fill="#FACC15"/>
        <!-- Bottom Left Arc Loop -->
        <path d="M 220 664 A 140 140 0 0 0 500 664 Z" fill="#2563EB"/>
        <!-- Bottom Right Square -->
        <rect x="548" y="548" width="232" height="232" rx="16" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="360" cy="360" r="140" fill="#00FF66"/><polygon points="664,220 780,480 548,480" fill="none" stroke="#00FF66" stroke-width="24"/><path d="M 220 664 A 140 140 0 0 0 500 664 Z" fill="#00FF66"/><rect x="548" y="548" width="232" height="232" fill="none" stroke="#00FF66" stroke-width="24"/>"""
    ))

    c.append(make_cand(
        "rams-ten", 64, "minimal", "Dieter Rams Dial",
        "Functionalist matte gray circular casing with a single tactile orange indicator",
        "Channeling Dieter Rams' 'Ten Principles of Good Design' (Braun TP 1 / T 1000): an understated circular dial with a single tactile orange index dot.",
        ["Matte aluminum circular bezel", "Tactile single orange index dot", "Absolute absence of decoration"],
        [["Braun Gray", "#1F2124"], ["Rams Orange", "#FF5500"], ["Aluminum", "#9CA3AF"], ["Soft Black", "#111214"]],
        {"Family": "Minimalism", "Metaphor": "Braun functionalist dial", "Vibe": "Timeless & Functional", "ScaleAt16px": "Crisp gray disc with orange dot"},
        """<defs><linearGradient id="bg_rams" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#24272C"/><stop offset="1" stop-color="#0F1012"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rams)"/>
        <circle cx="512" cy="512" r="360" fill="#181A1D" stroke="#9CA3AF" stroke-width="24"/>
        <circle cx="512" cy="512" r="280" fill="none" stroke="#374151" stroke-width="16"/>
        <circle cx="512" cy="240" r="48" fill="#FF5500"/>
        <circle cx="512" cy="512" r="64" fill="#9CA3AF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="32"/><circle cx="512" cy="240" r="48" fill="#00FF66"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "swiss-crosshair", 65, "minimal", "Swiss Crosshair",
        "Rationalist typography grid with 4-way registration crosshairs and circle",
        "Swiss Style (International Typographic Style): precision registration marks and an immaculate monoline circle, radiating Helvetica-era typographic clarity.",
        ["Four registration crosshairs", "Precision 50/50 balance", "Stark black and white"],
        [["Pure Void", "#000000"], ["Swiss Red", "#EF4444"], ["Paper White", "#FFFFFF"], ["Grid Slate", "#475569"]],
        {"Family": "Minimalism", "Metaphor": "Swiss registration marks", "Vibe": "Rationalist & Modernist", "ScaleAt16px": "Target cross in circle"},
        """<rect width="1024" height="1024" fill="#050505"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#FFFFFF" stroke-width="32"/>
        <line x1="512" y1="120" x2="512" y2="904" stroke="#FFFFFF" stroke-width="24"/>
        <line x1="120" y1="512" x2="904" y2="512" stroke="#FFFFFF" stroke-width="24"/>
        <circle cx="512" cy="512" r="120" fill="#EF4444"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><line x1="512" y1="120" x2="512" y2="904" stroke="#00FF66" stroke-width="24"/><line x1="120" y1="512" x2="904" y2="512" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="110" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "balanced-asymmetry", 66, "minimal", "Asymmetric Horizon",
        "Offset circle intersecting a horizontal baseline in tension",
        "Explores Scandinavian asymmetric tension: a single solid off-center circle anchored by a grounded horizontal baseline.",
        ["Asymmetrical 1/3 offset placement", "Grounded baseline bar", "Warm terracotta & sand tones"],
        [["Sand", "#1C1917"], ["Terracotta", "#EA580C"], ["Soft Sand", "#F5F5F4"], ["Slate", "#44403C"]],
        {"Family": "Minimalism", "Metaphor": "Rising sun over horizon", "Vibe": "Warm Minimalist", "ScaleAt16px": "Circle on bar"},
        """<defs><linearGradient id="bg_asym" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C1917"/><stop offset="1" stop-color="#0A0908"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_asym)"/>
        <circle cx="620" cy="440" r="220" fill="#EA580C"/>
        <rect x="180" y="660" width="664" height="64" rx="32" fill="#F5F5F4"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="620" cy="440" r="220" fill="#00FF66"/><rect x="180" y="660" width="664" height="64" rx="32" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "grid-fl", 67, "minimal", "Dot Matrix FL",
        "4x4 modular dot-matrix grid with illuminated nodes constructing the brand mark",
        "A 4x4 matrix of 16 circular nodes where specific dots glow in bright cyan to outline an 'F' and 'L' in pure algorithmic grid logic.",
        ["4x4 architectural dot matrix", "Selective active node illumination", "Futuristic monochrome cyan"],
        [["Deep Charcoal", "#0F172A"], ["Active Cyan", "#06B6D4"], ["Inactive Slate", "#334155"], ["Pure White", "#FFFFFF"]],
        {"Family": "Minimalism", "Metaphor": "Dot matrix display", "Vibe": "Algorithmic & Clean", "ScaleAt16px": "Distinct dot pattern"},
        """<defs><linearGradient id="bg_grd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_grd)"/>
        <g>
          <!-- 16 dots, active in Cyan, inactive in Slate -->
          <circle cx="280" cy="280" r="48" fill="#06B6D4"/>
          <circle cx="434" cy="280" r="48" fill="#06B6D4"/>
          <circle cx="588" cy="280" r="48" fill="#06B6D4"/>
          <circle cx="744" cy="280" r="48" fill="#06B6D4"/>

          <circle cx="280" cy="434" r="48" fill="#06B6D4"/>
          <circle cx="434" cy="434" r="48" fill="#06B6D4"/>
          <circle cx="588" cy="434" r="48" fill="#06B6D4"/>
          <circle cx="744" cy="434" r="48" fill="#334155"/>

          <circle cx="280" cy="588" r="48" fill="#06B6D4"/>
          <circle cx="434" cy="588" r="48" fill="#334155"/>
          <circle cx="588" cy="588" r="48" fill="#334155"/>
          <circle cx="744" cy="588" r="48" fill="#334155"/>

          <circle cx="280" cy="744" r="48" fill="#06B6D4"/>
          <circle cx="434" cy="744" r="48" fill="#06B6D4"/>
          <circle cx="588" cy="744" r="48" fill="#06B6D4"/>
          <circle cx="744" cy="744" r="48" fill="#06B6D4"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g fill="#00FF66"><circle cx="280" cy="280" r="44"/><circle cx="434" cy="280" r="44"/><circle cx="588" cy="280" r="44"/><circle cx="744" cy="280" r="44"/><circle cx="280" cy="434" r="44"/><circle cx="434" cy="434" r="44"/><circle cx="588" cy="434" r="44"/><circle cx="280" cy="588" r="44"/><circle cx="280" cy="744" r="44"/><circle cx="434" cy="744" r="44"/><circle cx="588" cy="744" r="44"/><circle cx="744" cy="744" r="44"/></g>"""
    ))

    c.append(make_cand(
        "mono-torus", 68, "minimal", "Pure Solid Torus",
        "High-contrast monochrome donut ring with perfect 1:3 ratio proportions",
        "Extreme geometric purity: a heavy circular torus where the outer diameter is exactly 3 times the hole diameter. Confident, bold, and iconic.",
        ["Perfect 1:3 golden geometry ratio", "High-contrast stark silhouette", "Zero ornamental clutter"],
        [["Black Void", "#000000"], ["Off-White", "#F8FAFC"], ["Slate Line", "#334155"], ["Pure White", "#FFFFFF"]],
        {"Family": "Minimalism", "Metaphor": "Pure geometric torus", "Vibe": "Stark & Iconic", "ScaleAt16px": "Flawless thick ring"},
        """<rect width="1024" height="1024" fill="#09090B"/>
        <circle cx="512" cy="512" r="360" fill="#F8FAFC"/>
        <circle cx="512" cy="512" r="140" fill="#09090B"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="#00FF66"/><circle cx="512" cy="512" r="140" fill="#000"/>"""
    ))

    c.append(make_cand(
        "zen-enso", 69, "minimal", "Athletic Enso",
        "Calligraphic single-breath brush circle executed with athletic precision",
        "The Zen Enso circle painted in a single unbroken exhalation. Represents mind-muscle connection, presence in the moment, and physical enlightenment.",
        ["Single-breath tapered brush stroke", "Open harmonic tail gap", "Deep charcoal with crimson seal"],
        [["Sumi Ink", "#111113"], ["Brush White", "#F4F4F5"], ["Hanko Red", "#DC2626"], ["Charcoal", "#27272A"]],
        {"Family": "Minimalism", "Metaphor": "Zen enso / Mindful breath", "Vibe": "Spiritual & Focused", "ScaleAt16px": "Distinct tapered ring"},
        """<defs><linearGradient id="bg_zen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141417"/><stop offset="1" stop-color="#070708"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_zen)"/>
        <path d="M 512 180 C 720 180 844 320 844 512 C 844 700 700 844 512 844 C 324 844 180 700 180 512 C 180 360 260 240 440 190" fill="none" stroke="#F4F4F5" stroke-width="112" stroke-linecap="round"/>
        <!-- Red Hanko Stamp -->
        <rect x="680" y="680" width="88" height="88" rx="16" fill="#DC2626"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 C 720 180 844 320 844 512 C 844 700 700 844 512 844 C 324 844 180 700 180 512 C 180 360 260 240 440 190" fill="none" stroke="#00FF66" stroke-width="96" stroke-linecap="round"/><rect x="680" y="680" width="88" height="88" rx="16" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "subtle-bevel", 70, "minimal", "Precision Bevel",
        "Flat circular icon with micro-etched chamfer catching ambient light",
        "Understated luxury: a matte titanium circular badge with a subtle 45-degree micro-etched chamfer edge that catches highlights like luxury sports watches.",
        ["Matte titanium circular plane", "Precision edge highlight chamfer", "Single laser-etched focal ring"],
        [["Titanium Black", "#131417"], ["Edge Highlight", "#E2E8F0"], ["Titanium Matte", "#334155"], ["Chamber Slate", "#1E293B"]],
        {"Family": "Minimalism", "Metaphor": "Machined titanium watch bezel", "Vibe": "Luxury & Refined", "ScaleAt16px": "Crisp beveled coin"},
        """<defs><linearGradient id="bg_bvl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#181B22"/><stop offset="1" stop-color="#08090C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_bvl)"/>
        <circle cx="512" cy="512" r="360" fill="#1E293B" stroke="#E2E8F0" stroke-width="24"/>
        <circle cx="512" cy="512" r="280" fill="#08090C" stroke="#334155" stroke-width="44"/>
        <circle cx="512" cy="512" r="88" fill="#E2E8F0"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="280" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="80" fill="#00FF66"/>"""
    ))

    # ──────── GROUP 8: Cyberpunk, Neon & Synthwave Vibe (71–80) ────────
    c.append(make_cand(
        "laser-grid", 71, "cyber", "Laser Grid Loop",
        "3D perspective wireframe synthwave grid looping into the infinite horizon",
        "1980s retro-futurism: a neon purple and hot magenta wireframe perspective grid rushing toward an infinite glowing digital horizon.",
        ["3D perspective wireframe grid", "Hot magenta into electric violet", "Retro-futuristic cyberspace"],
        [["Cyber Black", "#050014"], ["Hot Magenta", "#EC4899"], ["Neon Violet", "#8B5CF6"], ["Grid Cyan", "#06B6D4"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Synthwave perspective grid", "Vibe": "Outrun & Nostalgic", "ScaleAt16px": "Vivid magenta grid"},
        """<defs>
          <linearGradient id="bg_lsr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D001A"/><stop offset="1" stop-color="#030008"/></linearGradient>
          <filter id="glow_lsr" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_lsr)"/>
        <!-- Perspective Horizon Lines -->
        <g stroke="#EC4899" stroke-width="24" opacity="0.8">
          <line x1="120" y1="512" x2="904" y2="512"/>
          <line x1="120" y1="620" x2="904" y2="620"/>
          <line x1="120" y1="740" x2="904" y2="740"/>
          <line x1="120" y1="880" x2="904" y2="880"/>
        </g>
        <!-- Vanishing Point Rays -->
        <g stroke="#8B5CF6" stroke-width="24" opacity="0.8">
          <line x1="512" y1="512" x2="120" y2="904"/>
          <line x1="512" y1="512" x2="380" y2="904"/>
          <line x1="512" y1="512" x2="644" y2="904"/>
          <line x1="512" y1="512" x2="904" y2="904"/>
        </g>
        <!-- Glowing Sun Arc -->
        <circle cx="512" cy="512" r="220" fill="none" stroke="#EC4899" stroke-width="48" filter="url(#glow_lsr)"/>""",
        """<rect width="1024" height="1024" fill="#000"/><line x1="120" y1="512" x2="904" y2="512" stroke="#00FF66" stroke-width="24"/><line x1="120" y1="660" x2="904" y2="660" stroke="#00FF66" stroke-width="24"/><line x1="512" y1="512" x2="120" y2="904" stroke="#00FF66" stroke-width="24"/><line x1="512" y1="512" x2="904" y2="904" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="220" fill="none" stroke="#00FF66" stroke-width="48"/>"""
    ))

    c.append(make_cand(
        "tokyo-midnight", 72, "cyber", "Tokyo Midnight",
        "Neon magenta and cyan kanji-inspired athletic loop against pitch black",
        "Shinjuku neon in the rain: blistering hot pink and electric cyan neon lines intersecting against absolute pitch black.",
        ["Dual neon tube crossover", "Electric cyan & hot pink contrast", "Tokyo cyber aesthetic"],
        [["OLED Black", "#000000"], ["Tokyo Magenta", "#F43F5E"], ["Akira Cyan", "#00F0FF"], ["Neon Glow", "#FFE4E6"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Tokyo neon sign", "Vibe": "Electric & Rebellious", "ScaleAt16px": "Blazing dual-color cross"},
        """<defs>
          <filter id="glow_tky" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#000000"/>
        <g filter="url(#glow_tky)" stroke-linecap="round" fill="none">
          <path d="M 280 240 L 744 240 L 744 540 C 744 740 512 820 380 720" stroke="#F43F5E" stroke-width="72"/>
          <path d="M 280 440 L 680 440 L 680 820 L 280 820" stroke="#00F0FF" stroke-width="72"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 240 L 744 240 L 744 540 C 744 740 512 820 380 720" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M 280 440 L 680 440 L 680 820 L 280 820" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "cyber-samurai", 73, "cyber", "Exoskeleton Crest",
        "Angular futuristic athletic crest inspired by exoskeleton biomechanics",
        "Bionic human enhancement: sharp hexagonal armor plating interlocking around a glowing biometric power core.",
        ["Bionic exoskeleton plating", "Sharp aggressive chamfers", "Electric laser green"],
        [["Abyss", "#0A0D10"], ["Laser Green", "#10E867"], ["Plating Slate", "#334155"], ["Armor White", "#FFFFFF"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Exoskeleton armor plating", "Vibe": "Tactical & Cybernetic", "ScaleAt16px": "Angular tech shield"},
        """<defs><linearGradient id="bg_exo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1318"/><stop offset="1" stop-color="#040608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_exo)"/>
        <polygon points="512,180 820,360 820,680 512,860 204,680 204,360" fill="none" stroke="#334155" stroke-width="54" stroke-linejoin="round"/>
        <polygon points="512,280 720,400 720,620 512,740 304,620 304,400" fill="#10E867" stroke="#FFFFFF" stroke-width="16" stroke-linejoin="round"/>
        <circle cx="512" cy="512" r="64" fill="#040608"/>""",
        """<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 820,360 820,680 512,860 204,680 204,360" fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"/><polygon points="512,280 720,400 720,620 512,740 304,620 304,400" fill="none" stroke="#00FF66" stroke-width="32" stroke-linejoin="round"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "phosphor-horizon", 74, "cyber", "CRT Phosphor Wave",
        "1980s monochrome CRT oscilloscope waveform in electric lime phosphor",
        "Nostalgic laboratory instrumentation: bright green P1 phosphor traces dancing across a dark curved cathode-ray tube screen.",
        ["Monochrome P1 green phosphor", "Oscilloscope cardiac waveform", "Subtle scanline glow"],
        [["CRT Black", "#020803"], ["Phosphor Green", "#00FF66"], ["Trace Pale", "#A7F3D0"], ["Cathode Dark", "#064E3B"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Oscilloscope CRT waveform", "Vibe": "Retro Lab & Diagnostic", "ScaleAt16px": "Green wave on black"},
        """<defs>
          <filter id="glow_crt" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#020804"/>
        <rect x="180" y="180" width="664" height="664" rx="80" fill="none" stroke="#064E3B" stroke-width="24"/>
        <g filter="url(#glow_crt)" stroke="#00FF66" stroke-width="72" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 220 512 L 380 512 L 440 280 L 520 740 L 600 420 L 660 512 L 804 512"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="180" y="180" width="664" height="664" rx="80" fill="none" stroke="#00FF66" stroke-width="24"/><path d="M 220 512 L 380 512 L 440 280 L 520 740 L 600 420 L 660 512 L 804 512" stroke="#00FF66" stroke-width="64" fill="none" stroke-linecap="round" stroke-linejoin="round"/>"""
    ))

    c.append(make_cand(
        "hyperdrive-warp", 75, "cyber", "Hyperdrive Starburst",
        "Radial starburst speed streaks accelerating through deep cyberspace",
        "Punching into hyperspace: radial geometric acceleration beams exploding outward from a central vanishing point.",
        ["Radial perspective speed streaks", "Dynamic length variation", "Cyan and solar white"],
        [["Cyberspace", "#040812"], ["Warp Cyan", "#00F2FE"], ["Solar White", "#FFFFFF"], ["Abyss Navy", "#0F172A"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Hyperspace jump streaks", "Vibe": "Warp-speed & Dynamic", "ScaleAt16px": "Starburst velocity"},
        """<defs><linearGradient id="bg_wrp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08101E"/><stop offset="1" stop-color="#020408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_wrp)"/>
        <g stroke="#00F2FE" stroke-width="44" stroke-linecap="round">
          <line x1="512" y1="360" x2="512" y2="140"/>
          <line x1="512" y1="664" x2="512" y2="884"/>
          <line x1="360" y1="512" x2="140" y2="512"/>
          <line x1="664" y1="512" x2="884" y2="512"/>
          <line x1="400" y1="400" x2="240" y2="240"/>
          <line x1="624" y1="624" x2="784" y2="784"/>
          <line x1="400" y1="624" x2="240" y2="784"/>
          <line x1="624" y1="400" x2="784" y2="240"/>
        </g>
        <circle cx="512" cy="512" r="88" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="40" stroke-linecap="round"><line x1="512" y1="360" x2="512" y2="140"/><line x1="512" y1="664" x2="512" y2="884"/><line x1="360" y1="512" x2="140" y2="512"/><line x1="664" y1="512" x2="884" y2="512"/><line x1="400" y1="400" x2="240" y2="240"/><line x1="624" y1="624" x2="784" y2="784"/><line x1="400" y1="624" x2="240" y2="784"/><line x1="624" y1="400" x2="784" y2="240"/></g><circle cx="512" cy="512" r="80" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "glitch-ring", 76, "cyber", "Chromatic Glitch Loop",
        "Circular athletic loop with RGB channel displacement and digital scanlines",
        "Digital compression glitch: an athletic circular loop whose RGB color channels split apart into displaced red, green, and blue outlines.",
        ["RGB chromatic aberration offset", "Horizontal digital glitch displacement", "High-voltage cyber styling"],
        [["Glitch Black", "#060608"], ["RGB Red", "#FF0055"], ["RGB Cyan", "#00FFFF"], ["RGB White", "#FFFFFF"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "RGB chromatic glitch", "Vibe": "Edgy & Digital", "ScaleAt16px": "Displaced multi-ring"},
        """<rect width="1024" height="1024" fill="#060608"/>
        <!-- Red Channel -->
        <circle cx="496" cy="504" r="300" fill="none" stroke="#FF0055" stroke-width="72" opacity="0.8"/>
        <!-- Cyan Channel -->
        <circle cx="528" cy="520" r="300" fill="none" stroke="#00FFFF" stroke-width="72" opacity="0.8"/>
        <!-- Center Core Core White -->
        <circle cx="512" cy="512" r="280" fill="none" stroke="#FFFFFF" stroke-width="24"/>
        <!-- Glitch Slices -->
        <rect x="220" y="440" width="584" height="40" fill="#060608"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="300" fill="none" stroke="#00FF66" stroke-width="64"/><rect x="220" y="440" width="584" height="40" fill="#000"/>"""
    ))

    c.append(make_cand(
        "synth-hex", 77, "cyber", "Dark Synth Hex",
        "Glowing neon purple hexagonal energy shield with internal circuitry",
        "A heavy hexagonal forcefield prism pulsing with ultraviolet and electric magenta energy, housing an internal athletic triangle core.",
        ["Hexagonal forcefield boundary", "Neon purple circuit glow", "Internal delta energy core"],
        [["Dark Synth", "#080314"], ["Electric Violet", "#A855F7"], ["Neon Magenta", "#EC4899"], ["Cyber White", "#FFFFFF"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Hex energy forcefield", "Vibe": "Futuristic Shield", "ScaleAt16px": "Crisp purple hexagon"},
        """<defs>
          <linearGradient id="bg_shx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#120422"/><stop offset="1" stop-color="#040108"/></linearGradient>
          <filter id="glow_shx" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_shx)"/>
        <polygon points="512,180 820,360 820,664 512,844 204,664 204,360" fill="none" stroke="#A855F7" stroke-width="64" stroke-linejoin="round" filter="url(#glow_shx)"/>
        <polygon points="512,320 700,640 324,640" fill="#EC4899"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 820,360 820,664 512,844 204,664 204,360" fill="none" stroke="#00FF66" stroke-width="54" stroke-linejoin="round"/><polygon points="512,320 700,640 324,640" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "outrun-sun", 78, "cyber", "Outrun Sun Arc",
        "Segmented retro-futuristic setting sun with horizontal gradient slats",
        "The quintessential 80s Outrun visual: a blazing solar circular orb divided by horizontal negative-space slats, descending into neon orange.",
        ["Circular orb with horizontal slats", "Sunburst vertical gradient", "Retro synth aesthetic"],
        [["Void Purple", "#0A0314"], ["Sun Magenta", "#F43F5E"], ["Outrun Gold", "#FBBF24"], ["Neon Orange", "#FB923C"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Outrun segmented sun", "Vibe": "Warm Retro Synth", "ScaleAt16px": "Distinct slatted sun"},
        """<defs>
          <linearGradient id="bg_out" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140622"/><stop offset="1" stop-color="#040108"/></linearGradient>
          <linearGradient id="g_sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBBF24"/><stop offset="50%" stop-color="#F43F5E"/><stop offset="100%" stop-color="#A855F7"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_out)"/>
        <g fill="url(#g_sun)">
          <!-- Top Solid Dome -->
          <path d="M 180 512 A 332 332 0 0 1 844 512 Z"/>
          <!-- Lower Segment Slats -->
          <rect x="200" y="540" width="624" height="44" rx="8"/>
          <rect x="230" y="614" width="564" height="44" rx="8"/>
          <rect x="280" y="688" width="464" height="44" rx="8"/>
          <rect x="360" y="762" width="304" height="44" rx="8"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g fill="#00FF66"><path d="M 180 512 A 332 332 0 0 1 844 512 Z"/><rect x="200" y="540" width="624" height="44" rx="8"/><rect x="230" y="614" width="564" height="44" rx="8"/><rect x="280" y="688" width="464" height="44" rx="8"/><rect x="360" y="762" width="304" height="44" rx="8"/></g>"""
    ))

    c.append(make_cand(
        "terminal-vector", 79, "cyber", "Terminal Vector",
        "Raw green phosphor vector graphics line-art on an ultra-dark background",
        "1979 arcade vector graphics (Battlezone / Asteroids): razor-thin, luminous green phosphor vector polygons drawn directly by laser electron beams.",
        ["Pure vector line-art wireframe", "Phosphor green on pitch black", "Zero fill textures, pure laser glow"],
        [["OLED Abyss", "#000000"], ["Laser Phosphor", "#00FF66"], ["Beam Core", "#FFFFFF"], ["Glow Dark", "#022B0F"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Vector display wireframe", "Vibe": "Arcade Retro & Raw", "ScaleAt16px": "Crisp green lines"},
        """<defs>
          <filter id="glow_trm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#000000"/>
        <g filter="url(#glow_trm)" stroke="#00FF66" stroke-width="48" fill="none" stroke-linejoin="round">
          <!-- Outer Wire Diamond -->
          <polygon points="512,180 844,512 512,844 180,512"/>
          <!-- Inner Geometric Target -->
          <polygon points="512,320 704,512 512,704 320,512"/>
          <line x1="512" y1="180" x2="512" y2="844" stroke-width="24"/>
          <line x1="180" y1="512" x2="844" y2="512" stroke-width="24"/>
        </g>
        <circle cx="512" cy="512" r="36" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 844,512 512,844 180,512" fill="none" stroke="#00FF66" stroke-width="48"/><polygon points="512,320 704,512 512,704 320,512" fill="none" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="512" r="32" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "matrix-rain", 80, "cyber", "Matrix Data Loop",
        "Cascading digital rain streams curling into a continuous cyber loop",
        "Digital green code rain curling along a circular perimeter: dashes and binary pips flowing clockwise in high-speed algorithmic computation.",
        ["Circular stream of code dashes", "Phosphor green fading tail", "Cybernetic matrix vibe"],
        [["Matrix Black", "#010803"], ["Matrix Green", "#00FF66"], ["Dark Phosphor", "#047857"], ["High Pulse", "#A7F3D0"]],
        {"Family": "Cyberpunk & Neon", "Metaphor": "Cascading digital code rain", "Vibe": "Cybernetic & Hacker", "ScaleAt16px": "Segmented code ring"},
        """<rect width="1024" height="1024" fill="#010803"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#047857" stroke-width="64" stroke-dasharray="80 40 120 40 40 40 160 40"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="48" stroke-dasharray="140 60 80 40 40 60"/>
        <circle cx="512" cy="512" r="64" fill="#00FF66"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="54" stroke-dasharray="80 40 120 40"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="40" stroke-dasharray="140 60 80 40"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    return c
