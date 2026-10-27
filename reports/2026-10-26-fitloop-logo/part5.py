# Part 5: Groups 9 & 10 (Candidates 81 to 100)
def get_part5(make_cand):
    c = []

    # ──────── GROUP 9: Organic Nature, Flow & Vital Breath (81–90) ────────
    c.append(make_cand(
        "oxygen-leaf", 81, "nature", "Oxygen Leaf",
        "Stylized botanical leaf curving into an athletic circulation loop",
        "Cellular respiration and clean biological fuel: an aerodynamic leaf whose central vein forms a continuous looping circulatory path.",
        ["Organic botanical leaf profile", "Curved circulatory central stem", "Vibrant forest and mint greens"],
        [["Dark Soil", "#061208"], ["Chlorophyll Green", "#10B981"], ["Fresh Mint", "#34D399"], ["Pure Sunlight", "#FFFFFF"]],
        {"Family": "Organic & Flow", "Metaphor": "Photosynthesis & Cellular breath", "Vibe": "Fresh & Vital", "ScaleAt16px": "Crisp curved leaf"},
        """<defs>
          <linearGradient id="bg_lfe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08180E"/><stop offset="1" stop-color="#020804"/></linearGradient>
          <linearGradient id="g_lfe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_lfe)"/>
        <!-- Leaf Contour -->
        <path d="M 280 744 C 280 440 440 220 744 220 C 744 524 584 744 280 744 Z" fill="url(#g_lfe)"/>
        <!-- Central Circulatory Vein -->
        <path d="M 280 744 Q 512 512 744 220" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round"/>
        <circle cx="744" cy="220" r="36" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 744 C 280 440 440 220 744 220 C 744 524 584 744 280 744 Z" fill="#00FF66"/><path d="M 280 744 Q 512 512 744 220" fill="none" stroke="#000" stroke-width="44" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "tidal-swell", 82, "nature", "Tidal Swell",
        "Oceanic wave cresting in continuous gravitational ebb and flow",
        "Physical endurance mirrors ocean waves: rhythmic sets, rising momentum, cresting exertion, and effortless recovery.",
        ["Sweeping hydrodynamic wave crest", "Circular oceanic curl", "Deep pacific blue and seafoam"],
        [["Ocean Deep", "#04141E"], ["Tidal Blue", "#0284C7"], ["Seafoam Green", "#38BDF8"], ["White Surf", "#FFFFFF"]],
        {"Family": "Organic & Flow", "Metaphor": "Ocean wave sets & swell", "Vibe": "Hydraulic & Relentless", "ScaleAt16px": "Distinct curling wave"},
        """<defs>
          <linearGradient id="bg_tid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041B29"/><stop offset="1" stop-color="#01070C"/></linearGradient>
          <linearGradient id="g_tid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#0369A1"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_tid)"/>
        <path d="M 220 740 C 380 740 480 620 540 500 C 600 380 660 300 780 340 C 860 380 840 500 740 560 C 660 600 580 540 560 480" fill="none" stroke="url(#g_tid)" stroke-width="96" stroke-linecap="round"/>
        <circle cx="560" cy="480" r="44" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 220 740 C 380 740 480 620 540 500 C 600 380 660 300 780 340 C 860 380 840 500 740 560 C 660 600 580 540 560 480" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "breath-cycle", 83, "nature", "Box Breath Square",
        "Inhale-hold-exhale-pause box breathing square with soft rounded corners",
        "Navy SEAL box breathing (4s in, 4s hold, 4s out, 4s hold): a smooth rounded square whose four rounded edges cycle through the breath rhythm.",
        ["Rounded square geometry (Squircle)", "Four rhythmic breath corners", "Soothing lavender and calm indigo"],
        [["Midnight Slate", "#0F172A"], ["Zen Lavender", "#A855F7"], ["Calm Indigo", "#6366F1"], ["Pure Air", "#FFFFFF"]],
        {"Family": "Organic & Flow", "Metaphor": "Box breathing cycle", "Vibe": "Mindful & Restorative", "ScaleAt16px": "Clean rounded square"},
        """<defs><linearGradient id="bg_bth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12172A"/><stop offset="1" stop-color="#04060C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_bth)"/>
        <rect x="240" y="240" width="544" height="544" rx="160" fill="none" stroke="#A855F7" stroke-width="84"/>
        <!-- 4 Breathing Corner Nodes -->
        <circle cx="360" cy="360" r="44" fill="#6366F1"/>
        <circle cx="664" cy="360" r="44" fill="#FFFFFF"/>
        <circle cx="664" cy="664" r="44" fill="#6366F1"/>
        <circle cx="360" cy="664" r="44" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="240" y="240" width="544" height="544" rx="160" fill="none" stroke="#00FF66" stroke-width="72"/><circle cx="360" cy="360" r="40" fill="#00FF66"/><circle cx="664" cy="360" r="40" fill="#00FF66"/><circle cx="664" cy="664" r="40" fill="#00FF66"/><circle cx="360" cy="664" r="40" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "cellular-mitosis", 84, "nature", "Cellular Mitosis",
        "Two dividing biological cells joined by an energetic mitotic spindle",
        "Cellular growth and muscle hypertrophy: two biological cells budding and multiplying, visualizing adaptation at the microscopic tissue level.",
        ["Twin dividing cellular spheres", "Membrane constriction bridge", "Biological magenta and coral"],
        [["Cellular Dark", "#140A10"], ["Cytoplasm Pink", "#EC4899"], ["Membrane Coral", "#FB7185"], ["Nucleus Glow", "#FFFFFF"]],
        {"Family": "Organic & Flow", "Metaphor": "Cellular division & Growth", "Vibe": "Microscopic & Generative", "ScaleAt16px": "Distinct hourglass cells"},
        """<defs>
          <linearGradient id="bg_mit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#180A15"/><stop offset="1" stop-color="#050104"/></linearGradient>
          <linearGradient id="g_mit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EC4899"/><stop offset="1" stop-color="#FB7185"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mit)"/>
        <ellipse cx="380" cy="512" rx="200" ry="240" fill="url(#g_mit)"/>
        <ellipse cx="644" cy="512" rx="200" ry="240" fill="url(#g_mit)"/>
        <circle cx="380" cy="512" r="54" fill="#FFFFFF"/>
        <circle cx="644" cy="512" r="54" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><ellipse cx="380" cy="512" rx="180" ry="220" fill="none" stroke="#00FF66" stroke-width="48"/><ellipse cx="644" cy="512" rx="180" ry="220" fill="none" stroke="#00FF66" stroke-width="48"/><circle cx="380" cy="512" r="48" fill="#00FF66"/><circle cx="644" cy="512" r="48" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "solar-flare", 85, "nature", "Solar Corona Loop",
        "Radiant sun corona with dynamic plasma prominence looping back to surface",
        "Solar fusion energy: a coronal magnetic plasma prominence erupting from a sun disk and arcing gracefully back to the surface.",
        ["High-energy magnetic plasma arc", "Solar core radiant disc", "Golden sunburst thermal scale"],
        [["Space Dark", "#0C0600"], ["Solar Gold", "#F59E0B"], ["Corona Orange", "#EA580C"], ["Core Fire", "#FEF08A"]],
        {"Family": "Organic & Flow", "Metaphor": "Solar magnetic prominence", "Vibe": "Radiant & Cosmic", "ScaleAt16px": "Arc over glowing sun"},
        """<defs>
          <linearGradient id="bg_sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A0D02"/><stop offset="1" stop-color="#050200"/></linearGradient>
          <linearGradient id="g_sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FEF08A"/><stop offset="1" stop-color="#EA580C"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_sol)"/>
        <circle cx="512" cy="620" r="280" fill="#EA580C"/>
        <!-- Plasma Loop Arcing Out -->
        <path d="M 340 512 C 340 220 684 220 684 512" fill="none" stroke="url(#g_sol)" stroke-width="84" stroke-linecap="round"/>
        <circle cx="512" cy="300" r="48" fill="#FEF08A"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="620" r="260" fill="none" stroke="#00FF66" stroke-width="48"/><path d="M 340 512 C 340 220 684 220 684 512" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round"/><circle cx="512" cy="300" r="44" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "ripple-nexus", 86, "nature", "Water Drop Ripple",
        "Concentric circular water droplets expanding outward after athletic impact",
        "The impact of a single training session sending concentric ripples through metabolism, sleep quality, and mental clarity for days.",
        ["Triple expanding wave rings", "Central droplet impact bead", "Aquatic turquoise and deep navy"],
        [["Deep Pool", "#06151E"], ["Aquatic Blue", "#0EA5E9"], ["Turquoise Ripple", "#06B6D4"], ["Pure Drop", "#FFFFFF"]],
        {"Family": "Organic & Flow", "Metaphor": "Expanding water ripple", "Vibe": "Harmonic & Hydrating", "ScaleAt16px": "Concentric wave circles"},
        """<defs><linearGradient id="bg_rpl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#091A26"/><stop offset="1" stop-color="#02070A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rpl)"/>
        <circle cx="512" cy="512" r="380" fill="none" stroke="#0EA5E9" stroke-width="32" opacity="0.4"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="#06B6D4" stroke-width="48" opacity="0.75"/>
        <circle cx="512" cy="512" r="140" fill="none" stroke="#FFFFFF" stroke-width="64"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="380" fill="none" stroke="#00FF66" stroke-width="28"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="40"/><circle cx="512" cy="512" r="140" fill="none" stroke="#00FF66" stroke-width="54"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "nautilus-shell", 87, "nature", "Nautilus Spiral",
        "Sacred geometry chambered nautilus shell growing in continuous spiral",
        "Sacred biological architecture: a logarithmic spiral divided into structural growth chambers, evoking athletic progression through progressive overload.",
        ["Logarithmic nautilus chambers", "Golden ratio internal partitioning", "Warm ocean terracotta and cream"],
        [["Ocean Sand", "#181412"], ["Nautilus Terracotta", "#C2410C"], ["Cream Shell", "#FED7AA"], ["Deep Coral", "#EA580C"]],
        {"Family": "Organic & Flow", "Metaphor": "Chambered nautilus growth", "Vibe": "Architectural & Organic", "ScaleAt16px": "Coiled shell silhouette"},
        """<defs><linearGradient id="bg_nau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C1410"/><stop offset="1" stop-color="#080504"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_nau)"/>
        <path d="M 512 844 C 280 844 180 660 180 480 C 180 300 320 180 512 180 C 700 180 844 320 844 512 C 844 640 760 740 644 740 C 524 740 440 660 440 540 C 440 440 500 380 580 380 C 640 380 680 420 680 480" fill="none" stroke="#EA580C" stroke-width="72" stroke-linecap="round"/>
        <circle cx="680" cy="480" r="36" fill="#FED7AA"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 844 C 280 844 180 660 180 480 C 180 300 320 180 512 180 C 700 180 844 320 844 512 C 844 640 760 740 644 740 C 524 740 440 660 440 540 C 440 440 500 380 580 380 C 640 380 680 420 680 480" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "vital-sprout", 88, "nature", "Vital Sprout",
        "Twin cotyledon seed sprouts bursting open in upward athletic growth",
        "The beginning of every athletic journey: a seed casing bursting open as twin vibrant sprouts reach upward toward the light.",
        ["Twin curved cotyledon leaves", "Central seed origin node", "Spring lime and botanical green"],
        [["Rich Humus", "#0A1208"], ["Sprout Lime", "#84CC16"], ["Botanical Leaf", "#22C55E"], ["Dew White", "#FFFFFF"]],
        {"Family": "Organic & Flow", "Metaphor": "Sprouting seed growth", "Vibe": "Youthful & Regenerative", "ScaleAt16px": "Crisp V-sprout"},
        """<defs><linearGradient id="bg_sprt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#030602"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_sprt)"/>
        <!-- Left Leaf -->
        <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#84CC16"/>
        <!-- Right Leaf -->
        <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#22C55E"/>
        <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/><path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/><circle cx="512" cy="800" r="44" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "biolum-ring", 89, "nature", "Bioluminescent Jelly",
        "Deep-sea glowing creature tentacles curling in effortless hydrodynamics",
        "Deep ocean bioluminescence: ethereal cyan tentacles flowing in effortless hydrodynamic curves, capturing graceful athletic endurance.",
        ["Flowing hydrodynamic tentacle curves", "Bioluminescent cyan glow", "Abyssal trench black"],
        [["Abyssal Trench", "#02070D"], ["Biolum Cyan", "#00F2FE"], ["Deep Aquamarine", "#0284C7"], ["Ghost White", "#E0F2FE"]],
        {"Family": "Organic & Flow", "Metaphor": "Bioluminescent jellyfish", "Vibe": "Ethereal & Hydrodynamic", "ScaleAt16px": "Flowing bell shape"},
        """<defs>
          <linearGradient id="bg_bio" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#04121F"/><stop offset="1" stop-color="#010408"/></linearGradient>
          <filter id="glow_bio" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_bio)"/>
        <!-- Bell Dome -->
        <path d="M 280 440 C 280 260 744 260 744 440 Z" fill="#00F2FE" filter="url(#glow_bio)"/>
        <!-- Tentacles -->
        <g stroke="#0284C7" stroke-width="44" fill="none" stroke-linecap="round">
          <path d="M 360 440 C 360 620 440 680 420 820"/>
          <path d="M 512 440 C 512 660 560 720 512 860"/>
          <path d="M 664 440 C 664 620 584 680 604 820"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 440 C 280 260 744 260 744 440 Z" fill="#00FF66"/><g stroke="#00FF66" stroke-width="40" fill="none" stroke-linecap="round"><path d="M 360 440 C 360 620 440 680 420 820"/><path d="M 512 440 C 512 660 560 720 512 860"/><path d="M 664 440 C 664 620 584 680 604 820"/></g>"""
    ))

    c.append(make_cand(
        "mountain-loop", 90, "nature", "Alpine Summit Loop",
        "Twin alpine peaks enclosed in a continuous circular ridge track",
        "Outdoor trail endurance: two angular snow-capped alpine summits surrounded by a continuous circular mountain pass trail.",
        ["Angular geometric mountain summits", "Continuous circular ridge track", "Alpine slate and summit white"],
        [["Alpine Granite", "#12151C"], ["Summit White", "#FFFFFF"], ["Granite Slate", "#475569"], ["Sunlit Peak", "#F59E0B"]],
        {"Family": "Organic & Flow", "Metaphor": "Alpine mountain summits", "Vibe": "Majestic & Outdoors", "ScaleAt16px": "Distinct mountain peaks"},
        """<defs><linearGradient id="bg_mtn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#161B24"/><stop offset="1" stop-color="#07090C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_mtn)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#F59E0B" stroke-width="48"/>
        <!-- Rear Peak -->
        <polygon points="620,340 760,680 480,680" fill="#475569"/>
        <!-- Front Main Peak -->
        <polygon points="400,260 580,680 220,680" fill="#FFFFFF"/>
        <circle cx="400" cy="260" r="28" fill="#F59E0B"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="44"/><polygon points="620,340 760,680 480,680" fill="none" stroke="#00FF66" stroke-width="32"/><polygon points="400,260 580,680 220,680" fill="#00FF66"/>"""
    ))

    # ──────── GROUP 10: Futuristic AI, MCP & Neural Synapse (91–100) ────────
    c.append(make_cand(
        "neural-node", 91, "ai", "Neural Synapse Loop",
        "Branching axon and dendrite nodes firing electrical action potentials in a ring",
        "The cognitive side of training: a ring of synaptic neural nodes firing electrical action potentials, representing neuroplastic motor learning.",
        ["Ring of interconnected synaptic nodes", "Electrical action potential arcs", "Hyper-violet neural glow"],
        [["Synapse Void", "#080414"], ["Neural Violet", "#8B5CF6"], ["Electric Cyan", "#06B6D4"], ["Spark White", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Neural synaptic network", "Vibe": "Cognitive & High-tech", "ScaleAt16px": "Constellation of nodes"},
        """<defs>
          <linearGradient id="bg_neu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E0722"/><stop offset="1" stop-color="#030108"/></linearGradient>
          <filter id="glow_neu" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_neu)"/>
        <g stroke="#8B5CF6" stroke-width="36" fill="none" stroke-dasharray="140 40">
          <circle cx="512" cy="512" r="320"/>
        </g>
        <!-- 6 Synaptic Nodes -->
        <g fill="#06B6D4" stroke="#FFFFFF" stroke-width="16" filter="url(#glow_neu)">
          <circle cx="512" cy="192" r="48"/>
          <circle cx="789" cy="352" r="48"/>
          <circle cx="789" cy="672" r="48"/>
          <circle cx="512" cy="832" r="48"/>
          <circle cx="235" cy="672" r="48"/>
          <circle cx="235" cy="352" r="48"/>
        </g>
        <circle cx="512" cy="512" r="72" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="320" fill="none" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="192" r="44" fill="#00FF66"/><circle cx="789" cy="352" r="44" fill="#00FF66"/><circle cx="789" cy="672" r="44" fill="#00FF66"/><circle cx="512" cy="832" r="44" fill="#00FF66"/><circle cx="235" cy="672" r="44" fill="#00FF66"/><circle cx="235" cy="352" r="44" fill="#00FF66"/><circle cx="512" cy="512" r="64" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "agent-eye", 92, "ai", "Autonomous Agent Eye",
        "Cybernetic optical sensor observing athlete's biometric vitals and adaptation",
        "The attentive presence of the personal AI coach: an almond-shaped cybernetic eye aperture with a glowing iris tracking athlete progress.",
        ["Almond-shaped cybernetic lens", "Concentric biometric iris rings", "Electric emerald glow"],
        [["OLED Dark", "#020703"], ["Agent Emerald", "#00FF66"], ["Iris Cyan", "#00F2FE"], ["Pupil Black", "#000000"]],
        {"Family": "AI & Neural", "Metaphor": "AI coaching eye", "Vibe": "Observant & Intelligent", "ScaleAt16px": "Distinct glowing eye"},
        """<defs>
          <filter id="glow_eye" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#020704"/>
        <!-- Eye Contour -->
        <path d="M 180 512 C 340 300 684 300 844 512 C 684 724 340 724 180 512 Z" fill="none" stroke="#00FF66" stroke-width="64" stroke-linejoin="round" filter="url(#glow_eye)"/>
        <!-- Iris -->
        <circle cx="512" cy="512" r="160" fill="#00F2FE"/>
        <circle cx="512" cy="512" r="88" fill="#020704"/>
        <circle cx="512" cy="512" r="36" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 180 512 C 340 300 684 300 844 512 C 684 724 340 724 180 512 Z" fill="none" stroke="#00FF66" stroke-width="54"/><circle cx="512" cy="512" r="140" fill="none" stroke="#00FF66" stroke-width="40"/><circle cx="512" cy="512" r="44" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "synaptic-arc", 93, "ai", "Synaptic Spark",
        "Electric spark jumping the synaptic cleft between athlete intention and AI plan",
        "The instant feedback moment: a high-voltage electrical spark leaping across a micro-gap between the athlete's physical check-in and the agent's MCP response.",
        ["High-voltage electrical spark path", "Dual magnetic opposing poles", "Ultraviolet and neon blue"],
        [["Electric Void", "#050212"], ["Spark Blue", "#38BDF8"], ["High Voltage", "#818CF8"], ["Plasma White", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Synaptic spark / MCP request", "Vibe": "Electrifying & Instant", "ScaleAt16px": "Sharp zigzag spark"},
        """<defs>
          <linearGradient id="bg_spk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A0422"/><stop offset="1" stop-color="#02000A"/></linearGradient>
          <filter id="glow_spk" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_spk)"/>
        <!-- Left Electrode -->
        <path d="M 200 512 C 200 340 320 220 480 220" fill="none" stroke="#818CF8" stroke-width="64" stroke-linecap="round"/>
        <!-- Right Electrode -->
        <path d="M 824 512 C 824 684 704 804 544 804" fill="none" stroke="#818CF8" stroke-width="64" stroke-linecap="round"/>
        <!-- Central Spark -->
        <polygon points="460,340 580,480 500,480 560,684 440,540 520,540" fill="#38BDF8" filter="url(#glow_spk)"/>
        <circle cx="512" cy="512" r="32" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 200 512 C 200 340 320 220 480 220" fill="none" stroke="#00FF66" stroke-width="54" stroke-linecap="round"/><path d="M 824 512 C 824 684 704 804 544 804" fill="none" stroke="#00FF66" stroke-width="54" stroke-linecap="round"/><polygon points="460,340 580,480 500,480 560,684 440,540 520,540" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "quantum-qubit", 94, "ai", "Quantum Bloch Sphere",
        "Bloch sphere representation with intersecting quantum probability rings",
        "Advanced AI decision-making: intersecting quantum probability rings that rotate around a central qubit core, representing optimal plan generation.",
        ["Three orthogonal probability rings", "Central qubit nucleus", "Quantum cyan and ultraviolet"],
        [["Quantum Void", "#050713"], ["Qubit Cyan", "#00F2FE"], ["Quantum Violet", "#7C3AED"], ["Superposition", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Bloch sphere / Quantum qubit", "Vibe": "Theoretical & Frontier", "ScaleAt16px": "Intersecting wire sphere"},
        """<defs><linearGradient id="bg_qbt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080C1E"/><stop offset="1" stop-color="#020308"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_qbt)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#7C3AED" stroke-width="36"/>
        <ellipse cx="512" cy="512" rx="340" ry="120" fill="none" stroke="#00F2FE" stroke-width="48"/>
        <ellipse cx="512" cy="512" rx="120" ry="340" fill="none" stroke="#00F2FE" stroke-width="48"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><ellipse cx="512" cy="512" rx="340" ry="120" fill="none" stroke="#00FF66" stroke-width="44"/><ellipse cx="512" cy="512" rx="120" ry="340" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "turing-ribbon", 95, "ai", "Turing Tape Ribbon",
        "Continuous punch-tape loop with algorithmic binary perforations",
        "The mathematical foundation of computing: Alan Turing's infinite state-machine tape looping continuously with binary code punches.",
        ["Continuous paper-tape Möbius loop", "Binary hole punch perforations", "Cyber amber on charcoal"],
        [["Turing Slate", "#0F1217"], ["Tape Amber", "#F59E0B"], ["Punch Black", "#050608"], ["Binary White", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Turing machine punch tape", "Vibe": "Historical Computing & Pure", "ScaleAt16px": "Perforated ribbon loop"},
        """<defs><linearGradient id="bg_tur" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171E"/><stop offset="1" stop-color="#050608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tur)"/>
        <path d="M 280 340 C 440 220 744 320 744 512 C 744 704 440 804 280 684 Z" fill="none" stroke="#F59E0B" stroke-width="120" stroke-linejoin="round"/>
        <!-- Perforations -->
        <g fill="#050608">
          <circle cx="340" cy="400" r="24"/>
          <circle cx="480" cy="340" r="24"/>
          <circle cx="620" cy="380" r="24"/>
          <circle cx="700" cy="512" r="24"/>
          <circle cx="620" cy="644" r="24"/>
          <circle cx="480" cy="684" r="24"/>
          <circle cx="340" cy="624" r="24"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 340 C 440 220 744 320 744 512 C 744 704 440 804 280 684 Z" fill="none" stroke="#00FF66" stroke-width="100" stroke-linejoin="round"/>"""
    ))

    c.append(make_cand(
        "tensor-matrix", 96, "ai", "Tensor Lattice",
        "Multi-dimensional mathematical weight matrix visualizing deep learning",
        "Visualizing neural network weight matrices: 3x3 interconnected mathematical nodes with weighted connection vectors.",
        ["3x3 isometric tensor matrix", "Vector connection lines", "High-contrast indigo and mint"],
        [["Matrix Dark", "#0B0E17"], ["Weight Mint", "#10B981"], ["Vector Violet", "#6366F1"], ["Node Core", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Deep learning tensor matrix", "Vibe": "Analytical & Mathematical", "ScaleAt16px": "3x3 lattice"},
        """<defs><linearGradient id="bg_tns" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1322"/><stop offset="1" stop-color="#030408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tns)"/>
        <!-- Interconnecting Lines -->
        <g stroke="#6366F1" stroke-width="24">
          <line x1="280" y1="280" x2="744" y2="280"/>
          <line x1="280" y1="512" x2="744" y2="512"/>
          <line x1="280" y1="744" x2="744" y2="744"/>
          <line x1="280" y1="280" x2="280" y2="744"/>
          <line x1="512" y1="280" x2="512" y2="744"/>
          <line x1="744" y1="280" x2="744" y2="744"/>
          <line x1="280" y1="280" x2="744" y2="744"/>
          <line x1="280" y1="744" x2="744" y2="280"/>
        </g>
        <!-- Nodes -->
        <g fill="#10B981">
          <circle cx="280" cy="280" r="48"/><circle cx="512" cy="280" r="48"/><circle cx="744" cy="280" r="48"/>
          <circle cx="280" cy="512" r="48"/><circle cx="512" cy="512" r="72" fill="#FFFFFF"/><circle cx="744" cy="512" r="48"/>
          <circle cx="280" cy="744" r="48"/><circle cx="512" cy="744" r="48"/><circle cx="744" cy="744" r="48"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="20"><line x1="280" y1="280" x2="744" y2="280"/><line x1="280" y1="512" x2="744" y2="512"/><line x1="280" y1="744" x2="744" y2="744"/><line x1="280" y1="280" x2="280" y2="744"/><line x1="512" y1="280" x2="512" y2="744"/><line x1="744" y1="280" x2="744" y2="744"/><line x1="280" y1="280" x2="744" y2="744"/><line x1="280" y1="744" x2="744" y2="280"/></g><g fill="#00FF66"><circle cx="280" cy="280" r="40"/><circle cx="512" cy="280" r="40"/><circle cx="744" cy="280" r="40"/><circle cx="280" cy="512" r="40"/><circle cx="512" cy="512" r="64"/><circle cx="744" cy="512" r="40"/><circle cx="280" cy="744" r="40"/><circle cx="512" cy="744" r="40"/><circle cx="744" cy="744" r="40"/></g>"""
    ))

    c.append(make_cand(
        "prompt-reticle", 97, "ai", "Prompt Reticle",
        "High-tech terminal cursor prompt enclosed in an athletic targeting bracket",
        "The interface between human language and machine reasoning: a command-line prompt cursor (>) that forms an athletic forward speed arrowhead.",
        ["Terminal command prompt chevron", "Rectangular blinking cursor block", "Monochrome terminal green"],
        [["Terminal Black", "#050805"], ["Prompt Green", "#00FF66"], ["Cursor Amber", "#F59E0B"], ["Dark Terminal", "#0D2814"]],
        {"Family": "AI & Neural", "Metaphor": "CLI command cursor prompt", "Vibe": "Developer & Agentic", "ScaleAt16px": "Distinct terminal cursor"},
        """<rect width="1024" height="1024" fill="#050805"/>
        <!-- Terminal Target Bracket -->
        <rect x="200" y="200" width="624" height="624" rx="64" fill="none" stroke="#0D2814" stroke-width="32"/>
        <!-- Prompt Chevron > -->
        <path d="M 320 340 L 520 512 L 320 684" fill="none" stroke="#00FF66" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Blinking Cursor Block -->
        <rect x="580" y="600" width="140" height="96" rx="16" fill="#F59E0B"/>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="200" y="200" width="624" height="624" rx="64" fill="none" stroke="#00FF66" stroke-width="24"/><path d="M 320 340 L 520 512 L 320 684" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><rect x="580" y="600" width="140" height="96" rx="16" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "agentic-core", 98, "ai", "MCP Agent Core",
        "Central glowing intelligence orb with peripheral tool-calling orbital bus",
        "Direct visual representation of Model Context Protocol (MCP): a central LLM intelligence orb with 8 peripheral tool-calling buses radiating outward.",
        ["Central intelligence core", "Radial MCP tool calling bus lanes", "Electric cyan and deep purple"],
        [["Deep Hub", "#0A0817"], ["MCP Cyan", "#06B6D4"], ["Tool Purple", "#8B5CF6"], ["Core Radiance", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Model Context Protocol hub", "Vibe": "Systemic & Architectural", "ScaleAt16px": "Hub with radiating spokes"},
        """<defs>
          <linearGradient id="bg_mcp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E0B22"/><stop offset="1" stop-color="#030208"/></linearGradient>
          <filter id="glow_mcp" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mcp)"/>
        <!-- Orbital Tool Track -->
        <circle cx="512" cy="512" r="340" fill="none" stroke="#8B5CF6" stroke-width="40"/>
        <!-- 4 Cardinal Tool Ports -->
        <circle cx="512" cy="172" r="48" fill="#06B6D4"/>
        <circle cx="852" cy="512" r="48" fill="#06B6D4"/>
        <circle cx="512" cy="852" r="48" fill="#06B6D4"/>
        <circle cx="172" cy="512" r="48" fill="#06B6D4"/>
        <!-- Central LLM Core -->
        <circle cx="512" cy="512" r="140" fill="#06B6D4" filter="url(#glow_mcp)"/>
        <circle cx="512" cy="512" r="64" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="172" r="44" fill="#00FF66"/><circle cx="852" cy="512" r="44" fill="#00FF66"/><circle cx="512" cy="852" r="44" fill="#00FF66"/><circle cx="172" cy="512" r="44" fill="#00FF66"/><circle cx="512" cy="512" r="120" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "logic-loop", 99, "ai", "Recursive Logic Loop",
        "Infinite recursive self-optimizing loop symbolizing agent reinforcement learning",
        "Reinforcement learning from athlete feedback: an inner loop that feeds into an outer loop, which twists back into the origin in an endless recursive spiral.",
        ["Recursive self-optimizing dual loops", "Seamless gradient energy transition", "High-voltage electric coral"],
        [["Dark Void", "#07080D"], ["Recursive Coral", "#FF5E3A"], ["Amber Learning", "#FFAE34"], ["Deep Navy", "#1E1E2E"]],
        {"Family": "AI & Neural", "Metaphor": "Recursive reinforcement learning", "Vibe": "Intelligent & Unstoppable", "ScaleAt16px": "Concentric recursive loop"},
        """<defs>
          <linearGradient id="bg_rec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E101B"/><stop offset="1" stop-color="#030407"/></linearGradient>
          <linearGradient id="g_rec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5E3A"/><stop offset="1" stop-color="#FFAE34"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_rec)"/>
        <!-- Outer Loop -->
        <path d="M 512 180 A 332 332 0 1 1 200 620 L 320 540 A 200 200 0 1 0 512 312 L 512 180 Z" fill="url(#g_rec)"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 A 332 332 0 1 1 200 620 L 320 540 A 200 200 0 1 0 512 312 L 512 180 Z" fill="#00FF66"/><circle cx="512" cy="512" r="48" fill="#000"/>"""
    ))

    c.append(make_cand(
        "singularity-core", 100, "ai", "Feedback Singularity",
        "Gravitational event horizon where real-world workouts and AI intelligence unite",
        "Candidate 100: The ultimate destination of FitLoop. The physical realm of sweat, barbell iron, and running trails seamlessly unified with artificial general intelligence.",
        ["Gravitational event horizon ring", "Intense glowing core singularity", "High-energy chromatic corona"],
        [["Cosmic Void", "#020305"], ["Event Horizon", "#00F2FE"], ["Plasma Fire", "#FF512F"], ["Singularity", "#FFFFFF"]],
        {"Family": "AI & Neural", "Metaphor": "Technological singularity in fitness", "Vibe": "Monumental & Ultimate", "ScaleAt16px": "Blazing cosmic core"},
        """<defs>
          <linearGradient id="bg_sng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080C14"/><stop offset="1" stop-color="#010203"/></linearGradient>
          <linearGradient id="g_sng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF512F"/><stop offset="50%" stop-color="#00F2FE"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient>
          <filter id="glow_sng" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_sng)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="url(#g_sng)" stroke-width="72" filter="url(#glow_sng)"/>
        <circle cx="512" cy="512" r="160" fill="#010203"/>
        <circle cx="512" cy="512" r="88" fill="#FFFFFF" filter="url(#glow_sng)"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="64"/><circle cx="512" cy="512" r="150" fill="#000"/><circle cx="512" cy="512" r="80" fill="#00FF66"/>"""
    ))

    return c
