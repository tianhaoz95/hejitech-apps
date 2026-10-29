# Part 3: Groups 5 & 6 (Candidates 41 to 60)
def get_part3(make_cand):
    c = []

    # ──────── GROUP 5: Athletic Strength & Raw Power (41–50) ────────
    c.append(make_cand(
        "barbell-vector", 41, "strength", "Barbell Vector",
        "Minimalist Olympic bar with weighted endplates curving into a momentum arc",
        "Reinterprets the traditional barbell without clipart clumsiness: a precision steel bar whose weight plates transition fluidly into a dynamic circular kinetic loop.",
        ["Steel shaft baseline with knurl ticks", "Sculptural round bumper plates", "Kinetic velocity follow-through arc"],
        [["Gunmetal", "#18181B"], ["Competition Gold", "#EAB308"], ["Olympic Red", "#DC2626"], ["Steel Gray", "#4B5563"]],
        {"Family": "Athletic Strength", "Metaphor": "Olympic barbell & Kinetic lift", "Vibe": "Grounded & Heavy", "ScaleAt16px": "Distinct weighted bar"},
        """<defs><linearGradient id="bg_bb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_bb)"/>
        <!-- Curved momentum loop behind -->
        <path d="M 280 720 A 320 320 0 1 1 744 720" fill="none" stroke="#DC2626" stroke-width="48" opacity="0.4"/>
        <!-- Central Bar -->
        <rect x="220" y="488" width="584" height="48" rx="24" fill="#EAB308"/>
        <!-- Bumper Plates (Left & Right) -->
        <rect x="180" y="340" width="64" height="344" rx="28" fill="#EAB308"/>
        <rect x="120" y="380" width="48" height="264" rx="20" fill="#DC2626"/>
        <rect x="780" y="340" width="64" height="344" rx="28" fill="#EAB308"/>
        <rect x="856" y="380" width="48" height="264" rx="20" fill="#DC2626"/>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="220" y="488" width="584" height="48" rx="24" fill="#00FF66"/><rect x="180" y="340" width="64" height="344" rx="28" fill="#00FF66"/><rect x="120" y="380" width="48" height="264" rx="20" fill="#00FF66"/><rect x="780" y="340" width="64" height="344" rx="28" fill="#00FF66"/><rect x="856" y="380" width="48" height="264" rx="20" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "olympic-plate", 42, "strength", "Olympic Hex Plate",
        "Heavy cast-iron 45lb plate with triple handgrip cutouts and knurled ring",
        "An iconic 45-pound Olympic bumper plate with 3 ergonomic radial grip holes. Celebrates the tactile iron of strength training and powerlifting.",
        ["Heavy circular outer plate rim", "Three 120-degree handgrip cutouts", "Central 2-inch Olympic hub sleeve"],
        [["Matte Iron", "#121417"], ["Safety Orange", "#EA580C"], ["Machined Steel", "#94A3B8"], ["Black Oxide", "#1E293B"]],
        {"Family": "Athletic Strength", "Metaphor": "Cast iron 45lb plate", "Vibe": "Heavyweight & Industrial", "ScaleAt16px": "Clear 3-hole disc"},
        """<defs><linearGradient id="bg_pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171C"/><stop offset="1" stop-color="#060709"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_pl)"/>
        <circle cx="512" cy="512" r="380" fill="#1E293B" stroke="#EA580C" stroke-width="48"/>
        <!-- 3 Handgrip Cutouts -->
        <g fill="#060709" stroke="#94A3B8" stroke-width="16">
          <rect x="440" y="220" width="144" height="64" rx="32"/>
          <rect x="440" y="220" width="144" height="64" rx="32" transform="rotate(120 512 512)"/>
          <rect x="440" y="220" width="144" height="64" rx="32" transform="rotate(240 512 512)"/>
        </g>
        <!-- Center Hub -->
        <circle cx="512" cy="512" r="88" fill="#060709" stroke="#EA580C" stroke-width="24"/>
        <circle cx="512" cy="512" r="44" fill="#94A3B8"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="380" fill="none" stroke="#00FF66" stroke-width="64"/><g fill="#000" stroke="#00FF66" stroke-width="20"><rect x="440" y="220" width="144" height="64" rx="32"/><rect x="440" y="220" width="144" height="64" rx="32" transform="rotate(120 512 512)"/><rect x="440" y="220" width="144" height="64" rx="32" transform="rotate(240 512 512)"/></g><circle cx="512" cy="512" r="80" fill="none" stroke="#00FF66" stroke-width="32"/><circle cx="512" cy="512" r="36" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "kettlebell-arc", 43, "strength", "Kettlebell Arc",
        "Dynamic kettlebell swing trajectory tracing a high-velocity parabolic loop",
        "Captures the fluid ballistic power of a Russian kettlebell swing: an explosive parabolic loop launched from the hips to eye level.",
        ["Curved ballistic trajectory trail", "Geometric cast-iron bell silhouette", "High-velocity amber burn"],
        [["Pitch Black", "#0A0A0A"], ["Cast Ember", "#F97316"], ["Iron Slate", "#374151"], ["Chalk White", "#FFFFFF"]],
        {"Family": "Athletic Strength", "Metaphor": "Ballistic kettlebell swing", "Vibe": "Explosive & Kinetic", "ScaleAt16px": "Distinct bell on loop"},
        """<defs><linearGradient id="bg_kb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141113"/><stop offset="1" stop-color="#050405"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_kb)"/>
        <!-- Swing Parabolic Arc -->
        <path d="M 240 760 C 240 380 480 240 740 380" fill="none" stroke="#F97316" stroke-width="72" stroke-linecap="round" stroke-dasharray="600 80"/>
        <!-- Kettlebell at Apex -->
        <g transform="translate(680, 420)">
          <!-- Handle -->
          <rect x="-80" y="-120" width="160" height="110" rx="40" fill="none" stroke="#FFFFFF" stroke-width="36"/>
          <!-- Body -->
          <circle cx="0" cy="40" r="120" fill="#F97316"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 240 760 C 240 380 480 240 740 380" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><g transform="translate(680, 420)"><rect x="-80" y="-120" width="160" height="110" rx="40" fill="none" stroke="#00FF66" stroke-width="32"/><circle cx="0" cy="40" r="110" fill="#00FF66"/></g>"""
    ))

    c.append(make_cand(
        "knurl-diamond", 44, "strength", "Knurled Diamond",
        "Laser-etched diamond knurling pattern from a competition powerlifting bar",
        "The unmistakable diamond crosshatch pattern etched into steel bars for grip security. Turned into an iconic geometric diamond badge.",
        ["Precision 60-degree crosshatch lattice", "Diamond boundary frame", "Competition chrome & gold"],
        [["Steel Black", "#0B0F14"], ["Knurl Gold", "#EAB308"], ["Industrial Steel", "#64748B"], ["Grip White", "#FFFFFF"]],
        {"Family": "Athletic Strength", "Metaphor": "Barbell knurling texture", "Vibe": "Tactile & Precision-machined", "ScaleAt16px": "Crisp diamond grid"},
        """<defs><linearGradient id="bg_knr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_knr)"/>
        <!-- Diamond Frame -->
        <polygon points="512,180 844,512 512,844 180,512" fill="none" stroke="#EAB308" stroke-width="64"/>
        <!-- Internal Knurl Crossbars -->
        <g stroke="#64748B" stroke-width="36">
          <line x1="340" y1="348" x2="684" y2="676"/>
          <line x1="420" y1="268" x2="764" y2="596"/>
          <line x1="268" y1="420" x2="596" y2="764"/>
          <line x1="684" y1="348" x2="340" y2="676"/>
          <line x1="764" y1="420" x2="420" y2="764"/>
          <line x1="596" y1="268" x2="268" y2="596"/>
        </g>
        <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 844,512 512,844 180,512" fill="none" stroke="#00FF66" stroke-width="54"/><g stroke="#00FF66" stroke-width="32"><line x1="340" y1="348" x2="684" y2="676"/><line x1="684" y1="348" x2="340" y2="676"/></g><circle cx="512" cy="512" r="44" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "torque-twist", 45, "strength", "Power Torque",
        "Dual helical torsion bars twisting under maximum athletic muscular torque",
        "Visualizes mechanical torque and rotational power generation from the hips during sprinting, throwing, and heavy squatting.",
        ["Dual interlocking spiral helices", "Tapered dynamic compression strokes", "Fiery crimson-to-orange gradient"],
        [["Dark Void", "#0A0A0A"], ["Torque Red", "#EF4444"], ["Blaze Orange", "#F97316"], ["Pure White", "#FFFFFF"]],
        {"Family": "Athletic Strength", "Metaphor": "Rotational torque", "Vibe": "Aggressive & Dynamic", "ScaleAt16px": "Tight powerful coil"},
        """<defs>
          <linearGradient id="bg_trq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140B0B"/><stop offset="1" stop-color="#030202"/></linearGradient>
          <linearGradient id="g_trq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_trq)"/>
        <g stroke="url(#g_trq)" stroke-width="88" fill="none" stroke-linecap="round">
          <path d="M 280 340 C 440 180 680 240 740 440 C 780 580 640 760 480 780 C 340 800 240 680 320 540 C 380 440 540 420 620 500"/>
        </g>
        <circle cx="620" cy="500" r="44" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 340 C 440 180 680 240 740 440 C 780 580 640 760 480 780 C 340 800 240 680 320 540 C 380 440 540 420 620 500" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/><circle cx="620" cy="500" r="38" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "iron-crest", 46, "strength", "Iron Forge Crest",
        "Brutalist geometric barbell shield forged in matte graphite and safety yellow",
        "A heraldic athletic crest formed by geometric iron plates and an upward apex, honoring the lifelong pursuit of strength.",
        ["Shield crest boundary geometry", "Stacked angular iron plates", "High-contrast safety yellow accents"],
        [["Graphite Iron", "#18181B"], ["Safety Yellow", "#EAB308"], ["Chalk Gray", "#A1A1AA"], ["Black Coal", "#09090B"]],
        {"Family": "Athletic Strength", "Metaphor": "Forged iron crest", "Vibe": "Heavy & Unshakable", "ScaleAt16px": "Solid shield"},
        """<defs><linearGradient id="bg_crst" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_crst)"/>
        <!-- Shield Path -->
        <path d="M 260 220 L 764 220 L 764 540 C 764 720 512 844 512 844 C 512 844 260 720 260 540 Z" fill="#27272A" stroke="#EAB308" stroke-width="48" stroke-linejoin="round"/>
        <!-- Internal Barbell Geometry -->
        <rect x="360" y="472" width="304" height="48" rx="24" fill="#FFFFFF"/>
        <rect x="320" y="380" width="64" height="232" rx="20" fill="#EAB308"/>
        <rect x="640" y="380" width="64" height="232" rx="20" fill="#EAB308"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 260 220 L 764 220 L 764 540 C 764 720 512 844 512 844 C 512 720 260 540 Z" fill="none" stroke="#00FF66" stroke-width="54" stroke-linejoin="round"/><rect x="360" y="472" width="304" height="48" rx="24" fill="#00FF66"/><rect x="320" y="380" width="64" height="232" rx="20" fill="#00FF66"/><rect x="640" y="380" width="64" height="232" rx="20" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "deadlift-grip", 47, "strength", "Hook Grip Lock",
        "Clean anatomical hook grip locking thumb around the bar in clean geometry",
        "The hook grip is the ultimate connection between the human hand and heavy iron. Two overlapping geometric loops lock tight around a circular bar.",
        ["Interlocking thumb & finger loops", "Central circular bar section", "Tactical chalk and crimson"],
        [["Dark Gym", "#0D0E12"], ["Grip Coral", "#FF5E3A"], ["Chalk White", "#FFFFFF"], ["Steel", "#334155"]],
        {"Family": "Athletic Strength", "Metaphor": "Hook grip lock", "Vibe": "Anatomical & Unbreakable", "ScaleAt16px": "Distinct interlocking clasp"},
        """<defs><linearGradient id="bg_grp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11131A"/><stop offset="1" stop-color="#050608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_grp)"/>
        <!-- The Barbell Center -->
        <circle cx="512" cy="512" r="160" fill="#334155" stroke="#FFFFFF" stroke-width="24"/>
        <!-- Thumb Hook (Left Loop) -->
        <path d="M 240 680 C 240 440 380 340 512 340 C 640 340 680 440 680 540" fill="none" stroke="#FF5E3A" stroke-width="84" stroke-linecap="round"/>
        <!-- Fingers Lock (Overhead Loop) -->
        <path d="M 740 360 C 740 600 600 700 480 700 C 380 700 340 620 340 540" fill="none" stroke="#FFFFFF" stroke-width="84" stroke-linecap="round"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="150" fill="none" stroke="#00FF66" stroke-width="32"/><path d="M 240 680 C 240 440 380 340 512 340 C 640 340 680 440 680 540" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round"/><path d="M 740 360 C 740 600 600 700 480 700 C 380 700 340 620 340 540" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "kinetic-anvil", 48, "strength", "Kinetic Anvil",
        "Heavy triangular power anvil representing foundational core strength and stability",
        "A monumental triangular base with a stepped anvil horn, symbolizing immovable athletic base stability, posture, and core power.",
        ["Solid triangular foundational geometry", "Machined horizontal surface plate", "High-contrast Volt and charcoal"],
        [["Dark Basalt", "#121316"], ["Volt Power", "#A3E635"], ["Machined Steel", "#CBD5E1"], ["Deep Graphite", "#1F2937"]],
        {"Family": "Athletic Strength", "Metaphor": "Forging anvil & Core stability", "Vibe": "Monumental & Solid", "ScaleAt16px": "Crisp wide pyramid"},
        """<defs><linearGradient id="bg_anv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171E"/><stop offset="1" stop-color="#07080A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_anv)"/>
        <polygon points="512,200 820,780 204,780" fill="none" stroke="#A3E635" stroke-width="72" stroke-linejoin="round"/>
        <line x1="280" y1="620" x2="744" y2="620" stroke="#CBD5E1" stroke-width="48" stroke-linecap="round"/>
        <circle cx="512" cy="460" r="64" fill="#A3E635"/>""",
        """<rect width="1024" height="1024" fill="#000"/><polygon points="512,200 820,780 204,780" fill="none" stroke="#00FF66" stroke-width="64" stroke-linejoin="round"/><line x1="280" y1="620" x2="744" y2="620" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/><circle cx="512" cy="460" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "plate-stack", 49, "strength", "Weight Stack",
        "Graduated selectorized weight stack with magnetic pin indicator",
        "Inspired by cable gym machines: five horizontal weight plates stacked in graduated rhythm, with a single bright pin selecting today's target load.",
        ["Five horizontal precision plates", "Selector pin bright contrast dot", "High-tech gym machinery feel"],
        [["Gym Dark", "#0F1115"], ["Selector Pin", "#EF4444"], ["Iron Plate", "#374151"], ["Chalk White", "#F8FAFC"]],
        {"Family": "Athletic Strength", "Metaphor": "Selectorized weight stack", "Vibe": "Analytical & Progressive", "ScaleAt16px": "Distinct plate ladder"},
        """<defs><linearGradient id="bg_stk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11141B"/><stop offset="1" stop-color="#040507"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_stk)"/>
        <!-- Guide Rods -->
        <line x1="380" y1="160" x2="380" y2="864" stroke="#374151" stroke-width="24"/>
        <line x1="644" y1="160" x2="644" y2="864" stroke="#374151" stroke-width="24"/>
        <!-- 5 Plates -->
        <rect x="260" y="260" width="504" height="72" rx="16" fill="#374151"/>
        <rect x="260" y="370" width="504" height="72" rx="16" fill="#374151"/>
        <rect x="260" y="480" width="504" height="72" rx="16" fill="#F8FAFC"/>
        <rect x="260" y="590" width="504" height="72" rx="16" fill="#374151"/>
        <rect x="260" y="700" width="504" height="72" rx="16" fill="#374151"/>
        <!-- Red Selector Pin -->
        <circle cx="512" cy="516" r="44" fill="#EF4444"/>""",
        """<rect width="1024" height="1024" fill="#000"/><line x1="380" y1="160" x2="380" y2="864" stroke="#00FF66" stroke-width="20"/><line x1="644" y1="160" x2="644" y2="864" stroke="#00FF66" stroke-width="20"/><rect x="260" y="260" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/><rect x="260" y="370" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/><rect x="260" y="480" width="504" height="72" rx="16" fill="#00FF66"/><rect x="260" y="590" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/><rect x="260" y="700" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/>"""
    ))

    c.append(make_cand(
        "chalk-burst", 50, "strength", "Chalk Cloud",
        "Athletic palm chalk burst radiating inside a clean circular power ring",
        "The ritual of chalking hands before a PR lift: dynamic powder rays exploding outward inside a clean circular containment boundary.",
        ["Radial powder burst rays", "Circular containment ring", "Chalk white on volcanic obsidian"],
        [["Volcanic Charcoal", "#121214"], ["Pure Chalk", "#FFFFFF"], ["Safety Ember", "#F97316"], ["Ash Gray", "#52525B"]],
        {"Family": "Athletic Strength", "Metaphor": "Lifting chalk burst", "Vibe": "Visceral & Gritty", "ScaleAt16px": "Bright star in ring"},
        """<defs><linearGradient id="bg_chk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#08080A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_chk)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#F97316" stroke-width="48"/>
        <!-- Radiating Burst Spokes -->
        <g stroke="#FFFFFF" stroke-width="44" stroke-linecap="round">
          <line x1="512" y1="240" x2="512" y2="340"/>
          <line x1="512" y1="684" x2="512" y2="784"/>
          <line x1="240" y1="512" x2="340" y2="512"/>
          <line x1="684" y1="512" x2="784" y2="512"/>
          <line x1="320" y1="320" x2="390" y2="390"/>
          <line x1="634" y1="634" x2="704" y2="704"/>
          <line x1="320" y1="704" x2="390" y2="634"/>
          <line x1="634" y1="390" x2="704" y2="320"/>
        </g>
        <circle cx="512" cy="512" r="72" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="44"/><g stroke="#00FF66" stroke-width="40" stroke-linecap="round"><line x1="512" y1="240" x2="512" y2="340"/><line x1="512" y1="684" x2="512" y2="784"/><line x1="240" y1="512" x2="340" y2="512"/><line x1="684" y1="512" x2="784" y2="512"/><line x1="320" y1="320" x2="390" y2="390"/><line x1="634" y1="634" x2="704" y2="704"/><line x1="320" y1="704" x2="390" y2="634"/><line x1="634" y1="390" x2="704" y2="320"/></g><circle cx="512" cy="512" r="64" fill="#00FF66"/>"""
    ))

    # ──────── GROUP 6: Runners, Speed & Aerodynamics (51–60) ────────
    c.append(make_cand(
        "pace-ribbon", 51, "speed", "Pace Ribbon",
        "Sweeping aerodynamic ribbon flowing in high-speed wind-tunnel slipstream",
        "Flows like technical silk in a 40mph aerodynamic wind tunnel: a continuous sinuous ribbon that folds forward, symbolizing pacing and distance endurance.",
        ["Aerodynamic wind-tunnel ribbon", "Dual-tone gradient fold", "Endurance racing teal"],
        [["Midnight Void", "#06131A"], ["Slipstream Teal", "#00F2FE"], ["Aero Cyan", "#4FACFE"], ["Dark Water", "#022C3A"]],
        {"Family": "Runners & Speed", "Metaphor": "Wind tunnel airflow", "Vibe": "Fluid & Weightless", "ScaleAt16px": "Distinct fluid curve"},
        """<defs>
          <linearGradient id="bg_pce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041822"/><stop offset="1" stop-color="#01070A"/></linearGradient>
          <linearGradient id="g_pce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00F2FE"/><stop offset="1" stop-color="#4FACFE"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_pce)"/>
        <path d="M 180 620 C 320 620 380 340 540 340 C 700 340 760 520 844 520 L 780 680 C 660 680 600 480 480 480 C 340 480 300 780 180 780 Z" fill="url(#g_pce)"/>
        <circle cx="844" cy="520" r="36" fill="#00F2FE"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 180 620 C 320 620 380 340 540 340 C 700 340 760 520 844 520 L 780 680 C 660 680 600 480 480 480 C 340 480 300 780 180 780 Z" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "velocity-chevron", 52, "speed", "Velocity Chevron",
        "Triple forward-pointing aerodynamic chevrons breaking wind resistance",
        "Military and cycling velocity marks: three nested 60-degree aerodynamic speed chevrons cutting forward with increasing stroke weight.",
        ["Triple forward-raked chevrons", "Graduated speed spacing", "Safety fluorescent orange"],
        [["Night Carbon", "#0D0F14"], ["Safety Orange", "#FF512F"], ["Solar Ember", "#F09819"], ["Pure White", "#FFFFFF"]],
        {"Family": "Runners & Speed", "Metaphor": "Forward speed chevrons", "Vibe": "Fast & Directional", "ScaleAt16px": "Sharp nested arrows"},
        """<defs><linearGradient id="bg_vel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141118"/><stop offset="1" stop-color="#050406"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_vel)"/>
        <g stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M 280 260 L 580 512 L 280 764" stroke="#F09819" stroke-width="84"/>
          <path d="M 460 260 L 760 512 L 460 764" stroke="#FF512F" stroke-width="84"/>
        </g>
        <circle cx="760" cy="512" r="44" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="#00FF66"><path d="M 280 260 L 580 512 L 280 764" stroke-width="72"/><path d="M 460 260 L 760 512 L 460 764" stroke-width="72"/></g><circle cx="760" cy="512" r="36" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "wind-tunnel", 53, "speed", "Airfoil Loop",
        "Streamlined NACA teardrop cross-section minimizing athletic air resistance",
        "Based on the classic NACA 0012 airfoil teardrop profile: curves around in a circular aerodynamic loop with zero drag.",
        ["NACA aerodynamic airfoil teardrop", "Closed streamline loop", "Time-trial chrome and neon"],
        [["Aero Black", "#0B0D12"], ["Aero Neon", "#22C55E"], ["Chrome Slate", "#64748B"], ["Ice White", "#F8FAFC"]],
        {"Family": "Runners & Speed", "Metaphor": "NACA teardrop airfoil", "Vibe": "Wind-tunnel engineered", "ScaleAt16px": "Distinct aerodynamic teardrop"},
        """<defs><linearGradient id="bg_aero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_aero)"/>
        <path d="M 760 512 C 760 680 620 800 460 800 C 300 800 220 680 220 512 C 220 344 300 224 460 224 C 620 224 760 344 760 512 Z" fill="none" stroke="#22C55E" stroke-width="96"/>
        <path d="M 460 360 C 560 360 620 440 620 512 C 620 584 560 664 460 664 C 360 664 340 584 340 512 C 340 440 360 360 460 360 Z" fill="#64748B"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 760 512 C 760 680 620 800 460 800 C 300 800 220 680 220 512 C 220 344 300 224 460 224 C 620 224 760 344 760 512 Z" fill="none" stroke="#00FF66" stroke-width="84"/>"""
    ))

    c.append(make_cand(
        "stride-wave", 54, "speed", "Stride Sine Wave",
        "Vertical oscillation sine wave of a runner maintaining 180 SPM cadence",
        "Every elite runner knows the rhythm of vertical oscillation. This sine wave loop captures the harmonic bounce and rebound of elastic tendon energy.",
        ["Harmonic sinusoidal wave", "Circular containment boundary", "Electric energy gradient"],
        [["Night Navy", "#080C16"], ["Stride Volt", "#84CC16"], ["Cyan Rebound", "#06B6D4"], ["Pure White", "#FFFFFF"]],
        {"Family": "Runners & Speed", "Metaphor": "Cadence sine wave", "Vibe": "Rhythmic & Elastic", "ScaleAt16px": "Distinct wave in ring"},
        """<defs><linearGradient id="bg_str" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1324"/><stop offset="1" stop-color="#02050B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_str)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#1E293B" stroke-width="44"/>
        <path d="M 180 512 Q 346 180 512 512 T 844 512" fill="none" stroke="#84CC16" stroke-width="88" stroke-linecap="round"/>
        <circle cx="346" cy="346" r="44" fill="#06B6D4"/>
        <circle cx="678" cy="678" r="44" fill="#06B6D4"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="40"/><path d="M 180 512 Q 346 180 512 512 T 844 512" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "drafting-tail", 55, "speed", "Slipstream Vortex",
        "Twin counter-rotating aerodynamic vortex tails behind a cyclist in the drops",
        "The spiraling aerodynamic vortices trailing an athlete in motion: two intertwined vortex tails curling inward in optimal drafting efficiency.",
        ["Twin counter-rotating spiral tails", "Hydrodynamic teardrop convergence", "Cobalt and cyan slipstream"],
        [["Aero Void", "#070E18"], ["Vortex Cyan", "#38BDF8"], ["Cobalt Speed", "#2563EB"], ["Deep Sea", "#031E33"]],
        {"Family": "Runners & Speed", "Metaphor": "Aerodynamic slipstream vortex", "Vibe": "Hydrodynamic & Fast", "ScaleAt16px": "Interlocking tail swirl"},
        """<defs><linearGradient id="bg_vrt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1829"/><stop offset="1" stop-color="#02060C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_vrt)"/>
        <path d="M 280 280 C 440 200 680 320 680 512 C 680 680 480 760 380 660 C 280 560 380 420 512 420" fill="none" stroke="#38BDF8" stroke-width="72" stroke-linecap="round"/>
        <path d="M 744 744 C 584 824 344 704 344 512 C 344 344 544 264 644 364 C 744 464 644 604 512 604" fill="none" stroke="#2563EB" stroke-width="72" stroke-linecap="round"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 280 C 440 200 680 320 680 512 C 680 680 480 760 380 660 C 280 560 380 420 512 420" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M 744 744 C 584 824 344 704 344 512 C 344 344 544 264 644 364 C 744 464 644 604 512 604" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "sprint-vector", 56, "speed", "Sprint Vector",
        "45-degree forward sprint launch angle off the starting blocks",
        "Captures the explosive physics of sprint acceleration: low center of mass, 45-degree forward drive angle, and maximum horizontal ground reaction force.",
        ["45-degree explosive forward vector", "Staggered block starting marks", "High-contrast blaze orange"],
        [["Track Black", "#111111"], ["Sprint Blaze", "#EA580C"], ["Volt Gold", "#FACC15"], ["Pure White", "#FFFFFF"]],
        {"Family": "Runners & Speed", "Metaphor": "Starting blocks launch angle", "Vibe": "Explosive & Urgent", "ScaleAt16px": "Punchy forward slash"},
        """<defs><linearGradient id="bg_spr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A1412"/><stop offset="1" stop-color="#080504"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_spr)"/>
        <!-- 45-degree Launch Spear -->
        <polygon points="780,244 540,244 340,640 480,640" fill="#EA580C"/>
        <!-- Block Starting Cleats -->
        <rect x="220" y="720" width="160" height="48" rx="24" fill="#FACC15"/>
        <rect x="360" y="600" width="160" height="48" rx="24" fill="#FFFFFF"/>
        <circle cx="780" cy="244" r="36" fill="#FACC15"/>""",
        """<rect width="1024" height="1024" fill="#000"/><polygon points="780,244 540,244 340,640 480,640" fill="#00FF66"/><rect x="220" y="720" width="160" height="48" rx="24" fill="#00FF66"/><rect x="360" y="600" width="160" height="48" rx="24" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "split-timer", 57, "speed", "Split Second",
        "Digital chronograph stopwatch dial freezing a sub-4-minute milestone",
        "The drama of pacing and race splits: a precision circular chronograph track with high-frequency 1/100th-second tick marks and a sweeping second-hand needle.",
        ["Chronograph stopwatch bezel", "High-density split tick marks", "Crimson second hand needle"],
        [["Chrono Dark", "#0F1117"], ["Split Crimson", "#EF4444"], ["Dial White", "#F8FAFC"], ["Steel Slate", "#334155"]],
        {"Family": "Runners & Speed", "Metaphor": "Stopwatch chronograph dial", "Vibe": "Instrument-accurate", "ScaleAt16px": "Precision watch dial"},
        """<defs><linearGradient id="bg_splt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#131722"/><stop offset="1" stop-color="#05060A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_splt)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#334155" stroke-width="48" stroke-dasharray="16 24"/>
        <circle cx="512" cy="512" r="280" fill="none" stroke="#F8FAFC" stroke-width="20"/>
        <!-- Needle Pointer -->
        <line x1="512" y1="512" x2="680" y2="280" stroke="#EF4444" stroke-width="36" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="54" fill="#EF4444"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="40" stroke-dasharray="20 20"/><line x1="512" y1="512" x2="680" y2="280" stroke="#00FF66" stroke-width="32" stroke-linecap="round"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "cadence-ring", 58, "speed", "Cadence Tachometer",
        "Revolutions-per-minute tachometer dial optimized for cycling and running",
        "A heavy automotive/athletic tachometer arc with redline zone at 90-100 RPM (ideal cycling cadence) and glowing LED segment indicators.",
        ["240-degree tachometer gauge arc", "Redline peak exertion zone", "Bright LED segment styling"],
        [["Cockpit Dark", "#0A0D14"], ["Redline Coral", "#FF2D55"], ["RPM Amber", "#F59E0B"], ["Dial Muted", "#1E293B"]],
        {"Family": "Runners & Speed", "Metaphor": "Cadence RPM tachometer", "Vibe": "Motorsport Athletic", "ScaleAt16px": "Curved gauge"},
        """<defs><linearGradient id="bg_cad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E131F"/><stop offset="1" stop-color="#030408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_cad)"/>
        <!-- Safe RPM Arc -->
        <path d="M 280 740 A 340 340 0 0 1 512 172" fill="none" stroke="#F59E0B" stroke-width="88" stroke-linecap="round"/>
        <!-- Redline Arc -->
        <path d="M 512 172 A 340 340 0 0 1 744 740" fill="none" stroke="#FF2D55" stroke-width="88" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="64" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 740 A 340 340 0 0 1 512 172" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/><path d="M 512 172 A 340 340 0 0 1 744 740" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-dasharray="60 30"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "finish-tape", 59, "speed", "Finish Line Break",
        "Taut finish tape snapping forward in triumphant chest break",
        "The glorious climax of any endurance race: two halves of the snapped finish ribbon parting as the runner breaks through to victory.",
        ["Snapping ribbon diagonal break", "Angular forward speed edges", "Triumphant crimson and gold"],
        [["Night Stadium", "#0E0E12"], ["Finish Red", "#DC2626"], ["Victory Gold", "#FACC15"], ["Pure White", "#FFFFFF"]],
        {"Family": "Runners & Speed", "Metaphor": "Finish line ribbon break", "Vibe": "Triumphant & Iconic", "ScaleAt16px": "Distinct parting ribbon"},
        """<defs><linearGradient id="bg_fin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16151B"/><stop offset="1" stop-color="#070609"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_fin)"/>
        <!-- Left Snapped Ribbon -->
        <path d="M 160 380 L 480 440 L 420 580 L 160 520 Z" fill="#DC2626"/>
        <!-- Right Snapped Ribbon Flyaway -->
        <path d="M 540 440 L 864 340 L 864 480 L 600 580 Z" fill="#FACC15"/>
        <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 160 380 L 480 440 L 420 580 L 160 520 Z" fill="#00FF66"/><path d="M 540 440 L 864 340 L 864 480 L 600 580 Z" fill="#00FF66"/><circle cx="512" cy="512" r="44" fill="#000"/>"""
    ))

    c.append(make_cand(
        "tread-track", 60, "speed", "Outsole Traction",
        "Trail-running lugged outsole tread pattern in circular traction grip",
        "Grounded in trail running and muddy climbs: multi-directional lugged Chevron treads arranged in a circular traction loop.",
        ["Directional trail running lugs", "Radial mud-clearing channels", "High-visibility trail Volt"],
        [["Trail Basalt", "#141517"], ["Trail Volt", "#84CC16"], ["Mud Slate", "#334155"], ["Earth Charcoal", "#1E293B"]],
        {"Family": "Runners & Speed", "Metaphor": "Vibram running shoe tread", "Vibe": "Rugged & High-traction", "ScaleAt16px": "Aggressive gear/tread ring"},
        """<defs><linearGradient id="bg_trd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#181B1F"/><stop offset="1" stop-color="#08090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_trd)"/>
        <circle cx="512" cy="512" r="320" fill="none" stroke="#334155" stroke-width="44"/>
        <g fill="#84CC16">
          <polygon points="512,180 540,240 484,240"/>
          <polygon points="512,844 540,784 484,784"/>
          <polygon points="180,512 240,540 240,484"/>
          <polygon points="844,512 784,540 784,484"/>
          <polygon points="278,278 340,310 310,340"/>
          <polygon points="746,746 714,684 684,714"/>
          <polygon points="278,746 310,684 340,714"/>
          <polygon points="746,278 684,310 714,340"/>
        </g>
        <circle cx="512" cy="512" r="72" fill="#84CC16"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="320" fill="none" stroke="#00FF66" stroke-width="40"/><g fill="#00FF66"><polygon points="512,180 540,240 484,240"/><polygon points="512,844 540,784 484,784"/><polygon points="180,512 240,540 240,484"/><polygon points="844,512 784,540 784,484"/><polygon points="278,278 340,310 310,340"/><polygon points="746,746 714,684 684,714"/><polygon points="278,746 310,684 340,714"/><polygon points="746,278 684,310 714,340"/></g><circle cx="512" cy="512" r="64" fill="#00FF66"/>"""
    ))

    return c
