# Part 1: Baseline (00) + Groups 1 to 5 (Candidates 01 to 50)
import json

def get_part1(make_cand):
    c = []
    
    # 00 Baseline
    c.append(make_cand(
        "current", 0, "base", "Current v1.0 Baseline",
        "Navy background with circular arrow & peach dumbbell",
        "The shipping v1.0 icon: an open circular arrow in coral #ff7a45 surrounding a centered peach dumbbell on a dark navy-to-black gradient. Functional, but heavily gym-biased and the plates blur at small sizes.",
        ["Keep current shipping assets", "Circular loop with reload-style arrowhead", "Heavy dumbbell center graphic"],
        [["Deep Navy", "#14112B"], ["Void Black", "#05040F"], ["Coral Loop", "#FF7A45"], ["Peach Dumbbell", "#FFD2BF"]],
        {"Family": "Baseline", "Metaphor": "Gym dumbbell + cycle", "PrimarySurface": "iOS / Watch", "Scalability": "Low (dumbbell blurs at 32px)"},
        """<defs>
          <linearGradient id="bg_curr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14112b"/><stop offset="1" stop-color="#05040f"/></linearGradient>
          <filter id="glow_curr" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_curr)"/>
        <g fill="none" stroke-linecap="round" filter="url(#glow_curr)"><path d="M512 196 A316 316 0 1 1 238 354" stroke="#ff7a45" stroke-width="58"/></g>
        <path d="M290 262 L292 420 L154 344 Z" fill="#ff7a45" stroke="#ff7a45" stroke-width="16" stroke-linejoin="round" filter="url(#glow_curr)"/>
        <g fill="#ffd2bf" filter="url(#glow_curr)">
          <rect x="352" y="488" width="320" height="48" rx="24"/><rect x="322" y="420" width="56" height="184" rx="22"/><rect x="646" y="420" width="56" height="184" rx="22"/>
          <rect x="282" y="452" width="40" height="120" rx="16"/><rect x="702" y="452" width="40" height="120" rx="16"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M512 196 A316 316 0 1 1 238 354" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M290 262 L292 420 L154 344 Z" fill="#00FF66"/><rect x="352" y="488" width="320" height="48" rx="24" fill="#00FF66"/><rect x="322" y="420" width="56" height="184" rx="22" fill="#00FF66"/><rect x="646" y="420" width="56" height="184" rx="22" fill="#00FF66"/>""",
        baseline=True
    ))

    # ──────── GROUP 1: Kinetic Loops & Perpetual Motion (01–10) ────────
    c.append(make_cand(
        "mobius", 1, "kinetic", "Mobius Flow",
        "Endless 3D twisting ribbon in energetic electric coral and solar amber",
        "A seamless geometric Mobius strip rendered with dual-tone gradient ribbons. Symbolizes the unbroken feedback loop between the athlete's real-time physical exertion and the AI agent's evolving plan.",
        ["3D Mobius geometric twist", "Dual overlapping gradient layers", "Drop literal gym equipment"],
        [["Obsidian", "#0B0C10"], ["Electric Coral", "#FF5E3A"], ["Solar Amber", "#FFAE34"], ["Hot Ember", "#D63412"]],
        {"Family": "Dynamic Loop", "Metaphor": "Infinite loop progression", "Vibe": "Sculptural & Premium", "ScaleAt16px": "Excellent"},
        """<defs>
          <linearGradient id="bg_mob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12131C"/><stop offset="1" stop-color="#07080B"/></linearGradient>
          <linearGradient id="g_mob1" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#FF5E3A"/><stop offset="1" stop-color="#FFAE34"/></linearGradient>
          <linearGradient id="g_mob2" x1="0" y1="0.8" x2="1" y2="0.2"><stop offset="0" stop-color="#D63412"/><stop offset="1" stop-color="#FF5E3A"/></linearGradient>
          <filter id="mob_sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mob)"/>
        <path d="M 320 320 C 180 460 180 660 320 740 C 460 820 540 680 680 540 C 820 400 860 300 740 260 C 620 220 500 360 420 440" fill="none" stroke="url(#g_mob2)" stroke-width="112" stroke-linecap="round"/>
        <g filter="url(#mob_sh)"><path d="M 280 440 C 380 320 540 240 680 340 C 820 440 820 660 680 740 C 540 820 420 680 300 540" fill="none" stroke="url(#g_mob1)" stroke-width="112" stroke-linecap="round"/></g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 300 340 C 160 480 160 680 300 760 C 460 840 540 700 680 540 C 820 380 860 280 740 240 C 620 200 500 340 400 440" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><path d="M 280 440 C 380 320 540 240 680 340 C 820 440 820 660 680 740 C 540 820 420 680 300 540" fill="none" stroke="#00FF66" stroke-width="104" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "infinity-pulse", 2, "kinetic", "Infinity Pulse",
        "Infinity figure-eight morphing into a sharp biometric heartbeat spike",
        "Merges the universal infinity loop (endless consistency) with an authentic biometric ECG pulse. The left loop is continuous fluid athletic motion; the right loop leaps up into a crisp systolic QRS spike.",
        ["Smooth infinity base", "Integrated systolic heart rate spike", "Luminous neon gradient on midnight"],
        [["Midnight Space", "#0A0D17"], ["Pulse Coral", "#FF4757"], ["Neon Pink", "#FF6B81"], ["Bright White", "#FFFFFF"]],
        {"Family": "Dynamic Loop", "Metaphor": "Infinity & Live Cardio", "Vibe": "High-energy Cardio", "ScaleAt16px": "Crisp spike"},
        """<defs>
          <linearGradient id="bg_inf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1322"/><stop offset="1" stop-color="#05070D"/></linearGradient>
          <linearGradient id="g_inf" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0%" stop-color="#FF3838"/><stop offset="50%" stop-color="#FF6B81"/><stop offset="100%" stop-color="#FFA502"/></linearGradient>
          <filter id="glow_inf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_inf)"/>
        <g filter="url(#glow_inf)" fill="none" stroke="url(#g_inf)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 512 512 C 400 360 220 360 220 512 C 220 660 400 660 512 512 L 600 512 L 650 240 L 720 760 L 770 512 C 860 512 880 430 840 370 C 800 310 680 340 512 512 Z"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 512 C 400 360 220 360 220 512 C 220 660 400 660 512 512 L 600 512 L 650 240 L 720 760 L 770 512 C 860 512 880 430 840 370 C 800 310 680 340 512 512 Z" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>"""
    ))

    c.append(make_cand(
        "concentric-orbits", 3, "kinetic", "Concentric Orbits",
        "Two interlocking kinetic elliptical rings meeting at an energy focal point",
        "Two tilted elliptical orbits—one representing the physical athlete, the other the digital AI agent—intersecting in an intense glowing nexus point.",
        ["Dual opposing 35° elliptical paths", "Tapered velocity stroke weights", "Luminous intersection focal node"],
        [["Deep Void", "#080B14"], ["Laser Cyan", "#00F2FE"], ["Hyper Violet", "#4FACFE"], ["Core White", "#FFFFFF"]],
        {"Family": "Dynamic Loop", "Metaphor": "Dual orbits & Singularity", "Vibe": "Futuristic & Intelligent", "ScaleAt16px": "Clear geometry"},
        """<defs>
          <linearGradient id="bg_orb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D1120"/><stop offset="1" stop-color="#04060A"/></linearGradient>
          <linearGradient id="g_orb1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00F2FE"/><stop offset="1" stop-color="#4FACFE"/></linearGradient>
          <linearGradient id="g_orb2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF512F"/><stop offset="1" stop-color="#DD2476"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_orb)"/>
        <ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(-32 512 512)" fill="none" stroke="url(#g_orb1)" stroke-width="72"/>
        <ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(32 512 512)" fill="none" stroke="url(#g_orb2)" stroke-width="72"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/><circle cx="512" cy="512" r="80" fill="none" stroke="#00F2FE" stroke-width="12" opacity="0.6"/>""",
        """<rect width="1024" height="1024" fill="#000"/><ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(-32 512 512)" fill="none" stroke="#00FF66" stroke-width="64"/><ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(32 512 512)" fill="none" stroke="#00FF66" stroke-width="64"/><circle cx="512" cy="512" r="60" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "endless-track", 4, "kinetic", "Endless Track",
        "Stadium running track geometry in triple neon velocity curves",
        "Inspired by athletic stadium tracks and velodrome curves: three parallel rounded velocity lanes that curve around a central energy pocket. Celebrates laps, endurance, pacing, and athletic discipline.",
        ["Triple concentric stadium bands", "Staggered starting lines", "Volt green & cyber yellow"],
        [["Carbon", "#121417"], ["Volt Green", "#10E867"], ["Track Gold", "#FFD200"], ["Graphite", "#22272E"]],
        {"Family": "Dynamic Loop", "Metaphor": "Running track & Laps", "Vibe": "Athletic & High-performance", "ScaleAt16px": "High contrast lanes"},
        """<defs>
          <linearGradient id="bg_trk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16191F"/><stop offset="1" stop-color="#0B0C0E"/></linearGradient>
          <linearGradient id="g_trk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10E867"/><stop offset="1" stop-color="#FFD200"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_trk)"/>
        <rect x="180" y="240" width="664" height="544" rx="272" fill="none" stroke="url(#g_trk)" stroke-width="48"/>
        <rect x="250" y="310" width="524" height="404" rx="202" fill="none" stroke="url(#g_trk)" stroke-width="48" stroke-dasharray="1400 120"/>
        <rect x="320" y="380" width="384" height="264" rx="132" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-dasharray="800 160"/>""",
        """<rect width="1024" height="1024" fill="#000"/><rect x="180" y="240" width="664" height="544" rx="272" fill="none" stroke="#00FF66" stroke-width="48"/><rect x="250" y="310" width="524" height="404" rx="202" fill="none" stroke="#00FF66" stroke-width="48"/><rect x="320" y="380" width="384" height="264" rx="132" fill="none" stroke="#00FF66" stroke-width="40"/>"""
    ))

    c.append(make_cand(
        "toroid-flow", 5, "kinetic", "Toroid Flow",
        "Four segmented curved turbine blades forming a rotational kinetic torus",
        "A segmented circular torus made of 4 overlapping arc blades that sweep clockwise in continuous acceleration. Each blade represents a phase: Plan, Workout, Check-in, Adapt.",
        ["Four tapered curved turbine blades", "Dark gap channels", "Progressive fiery gradient shading"],
        [["Void", "#08090C"], ["Inferno Orange", "#FF512F"], ["Sunburst", "#F09819"], ["Flame Tip", "#FF7844"]],
        {"Family": "Dynamic Loop", "Metaphor": "Turbine / 4-phase cycle", "Vibe": "Kinetic & Fast", "ScaleAt16px": "Distinct pinwheel"},
        """<defs>
          <linearGradient id="bg_tor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15131A"/><stop offset="1" stop-color="#07060A"/></linearGradient>
          <linearGradient id="g_tor1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF512F"/><stop offset="1" stop-color="#F09819"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_tor)"/>
        <g transform="translate(512,512)">
          <g transform="rotate(0)"><path d="M 0 -340 A 340 340 0 0 1 294 -170 L 196 -113 A 226 226 0 0 0 0 -226 Z" fill="url(#g_tor1)" opacity="0.95"/></g>
          <g transform="rotate(90)"><path d="M 0 -340 A 340 340 0 0 1 294 -170 L 196 -113 A 226 226 0 0 0 0 -226 Z" fill="url(#g_tor1)" opacity="0.95"/></g>
          <g transform="rotate(180)"><path d="M 0 -340 A 340 340 0 0 1 294 -170 L 196 -113 A 226 226 0 0 0 0 -226 Z" fill="url(#g_tor1)" opacity="0.95"/></g>
          <g transform="rotate(270)"><path d="M 0 -340 A 340 340 0 0 1 294 -170 L 196 -113 A 226 226 0 0 0 0 -226 Z" fill="url(#g_tor1)" opacity="0.95"/></g>
          <circle cx="0" cy="0" r="140" fill="#07060A"/><circle cx="0" cy="0" r="48" fill="#FF7844"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g transform="translate(512,512)" fill="#00FF66"><path d="M 0 -340 A 340 340 0 0 1 294 -170 L 196 -113 A 226 226 0 0 0 0 -226 Z"/><path d="M 340 0 A 340 340 0 0 1 170 294 L 113 196 A 226 226 0 0 0 226 0 Z"/><path d="M 0 340 A 340 340 0 0 1 -294 170 L -196 113 A 226 226 0 0 0 0 226 Z"/><path d="M -340 0 A 340 340 0 0 1 -170 -294 L -113 -196 A 226 226 0 0 0 -226 0 Z"/></g><circle cx="512" cy="512" r="48" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "spiral-vortex", 6, "kinetic", "Golden Vortex",
        "Logarithmic golden-ratio spiral pulling athletic energy toward a luminous core",
        "A precision Fibonacci spiral loop rendered in glowing solar amber lines. Represents the compounding returns of daily athletic training and progressive overload.",
        ["Logarithmic golden ratio curve", "Graduated stroke line weights", "Luminous nucleus pull"],
        [["Cosmic Navy", "#0B0E1B"], ["Amber Glow", "#F59E0B"], ["Solar Core", "#FDE047"], ["Deep Indigo", "#1E1B4B"]],
        {"Family": "Dynamic Loop", "Metaphor": "Fibonacci spiral", "Vibe": "Mathematical & Hypnotic", "ScaleAt16px": "Distinct coil"},
        """<defs>
          <linearGradient id="bg_vor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B0E1B"/><stop offset="1" stop-color="#03040A"/></linearGradient>
          <linearGradient id="g_vor" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#EA580C"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_vor)"/>
        <path d="M 512 512 A 40 40 0 0 1 552 472 A 80 80 0 0 1 632 552 A 160 160 0 0 1 472 712 A 280 280 0 0 1 192 432 A 400 400 0 0 1 592 32" fill="none" stroke="url(#g_vor)" stroke-width="72" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="54" fill="#FDE047"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 512 A 40 40 0 0 1 552 472 A 80 80 0 0 1 632 552 A 160 160 0 0 1 472 712 A 280 280 0 0 1 192 432 A 400 400 0 0 1 592 32" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "double-helix", 7, "kinetic", "Athletic Helix",
        "Twin intertwined genetic strands representing biological training adaptation",
        "Draws on the double helix of DNA to symbolize how training and nutrition rewrite the athlete's biological code. The twin strands cross in perpetual rhythmic cadence.",
        ["Twin sinuous ribbon strands", "Cross-connecting energy rungs", "Cyan to magenta performance contrast"],
        [["Dark Slate", "#0A0E17"], ["Laser Cyan", "#06B6D4"], ["Hyper Pink", "#EC4899"], ["Crisp White", "#FFFFFF"]],
        {"Family": "Dynamic Loop", "Metaphor": "DNA double helix", "Vibe": "Biotech & Athletic", "ScaleAt16px": "Distinct lattice"},
        """<defs><linearGradient id="bg_hel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hel)"/>
        <g stroke-linecap="round" stroke-width="64" fill="none">
          <path d="M 280 200 C 280 360 744 360 744 512 C 744 660 280 660 280 824" stroke="#06B6D4"/>
          <path d="M 744 200 C 744 360 280 360 280 512 C 280 660 744 660 744 824" stroke="#EC4899"/>
        </g>
        <line x1="380" y1="310" x2="644" y2="310" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round"/>
        <line x1="380" y1="714" x2="644" y2="714" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke-linecap="round" stroke-width="64" fill="none" stroke="#00FF66"><path d="M 280 200 C 280 360 744 360 744 512 C 744 660 280 660 280 824"/><path d="M 744 200 C 744 360 280 360 280 512 C 280 660 744 660 744 824"/></g><circle cx="512" cy="512" r="44" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "ouroboros-loop", 8, "kinetic", "Cyber Ouroboros",
        "High-tech circular loop biting its own tail in perpetual self-renewal",
        "An ancient symbol of eternal renewal reimagined for AI agents: the system observes output, learns from athlete check-ins, and feeds back into tomorrow's plan.",
        ["Circular aerodynamic body", "Geometric polygonal head & tail lock", "Emerald circuit glow"],
        [["Void", "#050A07"], ["Cyber Emerald", "#10B981"], ["Mint Flare", "#34D399"], ["Dark Forest", "#064E3B"]],
        {"Family": "Dynamic Loop", "Metaphor": "Ouroboros renewal", "Vibe": "Mythic & Cybernetic", "ScaleAt16px": "Solid circular mark"},
        """<defs>
          <linearGradient id="bg_our" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06120B"/><stop offset="1" stop-color="#020503"/></linearGradient>
          <linearGradient id="g_our" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_our)"/>
        <circle cx="512" cy="512" r="320" fill="none" stroke="url(#g_our)" stroke-width="88"/>
        <polygon points="512,140 600,192 512,244 540,192" fill="#34D399"/><circle cx="540" cy="180" r="16" fill="#020503"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="320" fill="none" stroke="#00FF66" stroke-width="84"/><polygon points="512,140 600,192 512,244 540,192" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "gyro-momentum", 9, "kinetic", "Gyro Horizon",
        "Three gimbal gyroscope rings spinning in continuous athletic equilibrium",
        "Three concentric gyroscope rings tilted along 3 axes. Expresses balance across training, nutrition, and rest. Glances beautifully on Apple Watch and glasses HUD.",
        ["Triple nested gimbal rings", "45-degree isometric tilt", "Precision mechanical calibration"],
        [["Space Cadet", "#111827"], ["Safety Gold", "#F59E0B"], ["Platinum", "#E5E7EB"], ["Steel Gray", "#4B5563"]],
        {"Family": "Dynamic Loop", "Metaphor": "Gimbal gyroscope", "Vibe": "Instrument-grade", "ScaleAt16px": "Clear nested ellipses"},
        """<defs><linearGradient id="bg_gyr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_gyr)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#4B5563" stroke-width="40"/>
        <ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(-30 512 512)" fill="none" stroke="#F59E0B" stroke-width="54"/>
        <ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(30 512 512)" fill="none" stroke="#E5E7EB" stroke-width="44"/>
        <circle cx="512" cy="512" r="54" fill="#F59E0B"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="40"/><ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(-30 512 512)" fill="none" stroke="#00FF66" stroke-width="54"/><ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(30 512 512)" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="50" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "hyperloop-warp", 10, "kinetic", "Hyperloop Tunnel",
        "Five concentric perspective velocity rings racing toward the viewer",
        "High-speed perspective tunnel rings creating optical forward motion. Evokes sprinting through a velodrome or accelerating past performance plateaus.",
        ["Concentric perspective scaling", "Dynamic forward depth acceleration", "Electric vermilion velocity streaks"],
        [["Abyssal", "#08070B"], ["Hyper Red", "#EF4444"], ["Solar Flare", "#F97316"], ["Pure White", "#FFFFFF"]],
        {"Family": "Dynamic Loop", "Metaphor": "Warp tunnel / Forward velocity", "Vibe": "Blazing fast", "ScaleAt16px": "High contrast bullseye"},
        """<defs>
          <linearGradient id="bg_hyp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140B10"/><stop offset="1" stop-color="#040203"/></linearGradient>
          <linearGradient id="g_hyp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_hyp)"/>
        <circle cx="512" cy="512" r="380" fill="none" stroke="url(#g_hyp)" stroke-width="32" opacity="0.4"/>
        <circle cx="512" cy="512" r="290" fill="none" stroke="url(#g_hyp)" stroke-width="44" opacity="0.65"/>
        <circle cx="512" cy="512" r="200" fill="none" stroke="url(#g_hyp)" stroke-width="58" opacity="0.85"/>
        <circle cx="512" cy="512" r="110" fill="none" stroke="#FFFFFF" stroke-width="72"/><circle cx="512" cy="512" r="36" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="380" fill="none" stroke="#00FF66" stroke-width="32" opacity="0.4"/><circle cx="512" cy="512" r="290" fill="none" stroke="#00FF66" stroke-width="44" opacity="0.65"/><circle cx="512" cy="512" r="200" fill="none" stroke="#00FF66" stroke-width="58" opacity="0.85"/><circle cx="512" cy="512" r="110" fill="none" stroke="#00FF66" stroke-width="72"/><circle cx="512" cy="512" r="36" fill="#00FF66"/>"""
    ))

    # ──────── GROUP 2: Biometrics & Vital Signs (11–20) ────────
    c.append(make_cand(
        "cardio-loop", 11, "biometrics", "Cardio Loop",
        "A minimalist circular ring that surges into a sharp cardiac peak",
        "Starts as an ultra-pure circular ring, but breaks into a clean sharp heartbeat spike at the top quadrant. Radical simplicity that works instantly at tiny favicon sizes and looks magnificent on an Apple Watch dial.",
        ["Pure circular geometry", "Single systolic break", "Health-native crimson aesthetic"],
        [["Pitch Black", "#000000"], ["Crimson Pulse", "#FF2D55"], ["Electric Rose", "#FF375F"], ["Pure White", "#FFFFFF"]],
        {"Family": "Biometrics", "Metaphor": "Heartbeat in circular ring", "Vibe": "Minimal & Health-native", "ScaleAt16px": "Flawless"},
        """<defs>
          <linearGradient id="bg_car" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14080B"/><stop offset="1" stop-color="#040203"/></linearGradient>
          <linearGradient id="g_car" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FF2D55"/><stop offset="1" stop-color="#FF6B81"/></linearGradient>
          <filter id="glow_car" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_car)"/>
        <g filter="url(#glow_car)" fill="none" stroke="url(#g_car)" stroke-width="88" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 512 840 A 328 328 0 1 1 744 280 L 760 140 L 820 460 L 840 280 A 328 328 0 0 1 512 840 Z"/>
        </g>
        <circle cx="760" cy="140" r="28" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 840 A 328 328 0 1 1 744 280 L 760 140 L 820 460 L 840 280 A 328 328 0 0 1 512 840 Z" fill="none" stroke="#00FF66" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/><circle cx="760" cy="140" r="24" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "activity-triad", 12, "biometrics", "Activity Triad",
        "Three nested athletic arcs (Workout, Vitals, Recovery) twisting forward",
        "Draws on the iconic language of athletic activity rings, but breaks the static circle by having the three colored arcs sweep outward into an implied forward aerodynamic arrow.",
        ["Three nested weighted arcs", "Staggered endpoints with kinetic sweep", "Activity triad colors"],
        [["Abyss", "#0E1118"], ["Move Red", "#FA114F"], ["Exercise Green", "#A0FE00"], ["Stand Cyan", "#00E0FF"]],
        {"Family": "Biometrics", "Metaphor": "Concentric activity arcs", "Vibe": "Familiar yet fresh", "ScaleAt16px": "Three bold bands"},
        """<defs><linearGradient id="bg_tri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10141E"/><stop offset="1" stop-color="#06070B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tri)"/>
        <path d="M 512 160 A 352 352 0 1 1 200 680 L 320 680" fill="none" stroke="#FA114F" stroke-width="72" stroke-linecap="round"/>
        <path d="M 512 260 A 252 252 0 1 1 300 640 L 400 640" fill="none" stroke="#A0FE00" stroke-width="72" stroke-linecap="round"/>
        <path d="M 512 360 A 152 152 0 1 1 400 600 L 480 600" fill="none" stroke="#00E0FF" stroke-width="72" stroke-linecap="round"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 160 A 352 352 0 1 1 200 680 L 320 680" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M 512 260 A 252 252 0 1 1 300 640 L 400 640" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round" stroke-dasharray="80 30"/><path d="M 512 360 A 152 152 0 1 1 400 600 L 480 600" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>"""
    ))

    c.append(make_cand(
        "pulse-wave", 13, "biometrics", "Pulse Wave",
        "Sonic voice & biometric audio waveform looping into an athletic crest",
        "A series of vertical waveform bars of varying height that sweep around a circular perimeter. Symbolizes the AI agent speaking the plan, live biometric feedback, and voice check-ins in the moment.",
        ["Radial soundwave equalizer bars", "Circular envelope geometry", "Glowing tip accents in electric mint"],
        [["Dark Slate", "#0F172A"], ["Electric Mint", "#10B981"], ["Bright Lime", "#84CC16"], ["Pale Neon", "#D9F99D"]],
        {"Family": "Biometrics", "Metaphor": "Voice wave + Cardio rhythm", "Vibe": "Modern AI & Audio", "ScaleAt16px": "Solid silhouette"},
        """<defs>
          <linearGradient id="bg_pw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient>
          <linearGradient id="g_pw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9F99D"/><stop offset="50%" stop-color="#10B981"/><stop offset="100%" stop-color="#047857"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_pw)"/>
        <circle cx="512" cy="512" r="380" fill="none" stroke="#1E293B" stroke-width="36"/>
        <g fill="url(#g_pw)">
          <rect x="232" y="440" width="48" height="144" rx="24"/><rect x="304" y="360" width="48" height="304" rx="24"/>
          <rect x="376" y="260" width="48" height="504" rx="24"/><rect x="448" y="180" width="48" height="664" rx="24"/>
          <rect x="528" y="220" width="48" height="584" rx="24"/><rect x="600" y="320" width="48" height="384" rx="24"/>
          <rect x="672" y="400" width="48" height="224" rx="24"/><rect x="744" y="450" width="48" height="124" rx="24"/>
        </g>""",
        """<rect width="1024" height="1024" fill="#000"/><g fill="#00FF66"><rect x="232" y="440" width="48" height="144" rx="24"/><rect x="304" y="360" width="48" height="304" rx="24"/><rect x="376" y="260" width="48" height="504" rx="24"/><rect x="448" y="180" width="48" height="664" rx="24"/><rect x="528" y="220" width="48" height="584" rx="24"/><rect x="600" y="320" width="48" height="384" rx="24"/><rect x="672" y="400" width="48" height="224" rx="24"/><rect x="744" y="450" width="48" height="124" rx="24"/></g>"""
    ))

    c.append(make_cand(
        "flame-knot", 14, "biometrics", "Flame Knot",
        "Two intertwining athletic ribbon loops forming an eternal Olympic torch flame",
        "Two ribbon loops that interlace vertically like a Celtic knot to form the silhouette of an energetic flame. Evokes metabolic burn, athletic passion, and Olympic spirit while maintaining loop structural integrity.",
        ["Interlocking vertical ribbon paths", "Fiery internal color gradient", "Olympic flame silhouette"],
        [["Charcoal", "#18181B"], ["Blaze Orange", "#EA580C"], ["Solar Gold", "#FBBF24"], ["White Flare", "#FFFBEB"]],
        {"Family": "Biometrics", "Metaphor": "Metabolic flame knot", "Vibe": "Passionate & Intense", "ScaleAt16px": "Strong vertical mark"},
        """<defs>
          <linearGradient id="bg_flm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient>
          <linearGradient id="g_flm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#C2410C"/><stop offset="50%" stop-color="#F97316"/><stop offset="100%" stop-color="#FDE047"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_flm)"/>
        <path d="M 512 800 C 320 800 240 640 240 480 C 240 320 440 240 512 160 C 584 240 784 320 784 480 C 784 640 704 800 512 800 Z" fill="none" stroke="url(#g_flm)" stroke-width="84" stroke-linejoin="round"/>
        <path d="M 512 700 C 420 700 380 600 380 500 C 380 400 470 340 512 260 C 554 340 644 400 644 500 C 644 600 604 700 512 700 Z" fill="url(#g_flm)"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 800 C 320 800 240 640 240 480 C 240 320 440 240 512 160 C 584 240 784 320 784 480 C 784 640 704 800 512 800 Z" fill="none" stroke="#00FF66" stroke-width="72"/><path d="M 512 700 C 420 700 380 600 380 500 C 380 400 470 340 512 260 C 554 340 644 400 644 500 C 644 600 604 700 512 700 Z" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "metabolic-ring", 15, "biometrics", "Metabolic Dial",
        "A 12-segment circadian clock dial visualizing workout and nutrition timing",
        "A precision 24-hour circular dial with segmented ticks and glowing active phases. Clearly expresses FitLoop's unique combination of workout scheduling, nutrition windows, and sleep/recovery tracking.",
        ["Circular tick ring with active quadrants", "Central core sensor dot", "Precision telemetry aesthetic"],
        [["Midnight Navy", "#0B1120"], ["Cyan Energy", "#06B6D4"], ["Sunset Amber", "#F59E0B"], ["Vivid Violet", "#8B5CF6"]],
        {"Family": "Biometrics", "Metaphor": "Circadian dial & Timing", "Vibe": "Technical & Holistic", "ScaleAt16px": "Clear dial face"},
        """<defs><linearGradient id="bg_met" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1120"/><stop offset="1" stop-color="#020408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_met)"/>
        <g stroke-linecap="round" stroke-width="48" fill="none">
          <path d="M 512 180 A 332 332 0 0 1 844 512" stroke="#06B6D4"/>
          <path d="M 844 512 A 332 332 0 0 1 512 844" stroke="#F59E0B"/>
          <path d="M 512 844 A 332 332 0 0 1 180 512" stroke="#8B5CF6"/>
          <path d="M 180 512 A 332 332 0 0 1 512 180" stroke="#334155" stroke-dasharray="30 25"/>
        </g>
        <circle cx="512" cy="512" r="140" fill="#0B1120" stroke="#475569" stroke-width="20"/><circle cx="512" cy="512" r="64" fill="#06B6D4"/>""",
        """<rect width="1024" height="1024" fill="#000"/><g stroke-linecap="round" stroke-width="48" fill="none" stroke="#00FF66"><path d="M 512 180 A 332 332 0 0 1 844 512"/><path d="M 844 512 A 332 332 0 0 1 512 844" stroke-dasharray="40 20"/><path d="M 512 844 A 332 332 0 0 1 180 512"/></g><circle cx="512" cy="512" r="130" fill="#000" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="50" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "systolic-surge", 16, "biometrics", "Systolic Surge",
        "High-amplitude EKG heartbeat peak leaping above a dark baseline horizon",
        "Raw cardiovascular power: a horizontal baseline across the display that suddenly leaps into a towering 600px tall systolic spike before settling into an energetic recovery wave.",
        ["Linear baseline to peak transition", "Sharp 20-degree acute angle apex", "Crimson into neon pink gradient"],
        [["Night", "#0C0709"], ["Crimson Surge", "#E11D48"], ["Laser Rose", "#FB7185"], ["White Apex", "#FFFFFF"]],
        {"Family": "Biometrics", "Metaphor": "Systolic cardiac spike", "Vibe": "Intense & Pure", "ScaleAt16px": "Unmistakable peak"},
        """<defs>
          <linearGradient id="bg_sys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#190B10"/><stop offset="1" stop-color="#050204"/></linearGradient>
          <linearGradient id="g_sys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E11D48"/><stop offset="1" stop-color="#FB7185"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_sys)"/>
        <path d="M 120 540 L 360 540 L 440 680 L 520 180 L 600 760 L 660 480 L 720 540 L 904 540" fill="none" stroke="url(#g_sys)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="520" cy="180" r="32" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 120 540 L 360 540 L 440 680 L 520 180 L 600 760 L 660 480 L 720 540 L 904 540" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><circle cx="520" cy="180" r="28" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "hrv-rhombus", 17, "biometrics", "HRV Diamond",
        "Heart Rate Variability geometry formed by intersecting diamond pulse vectors",
        "Heart Rate Variability (HRV) is the gold standard of athletic recovery. This mark constructs an athletic diamond rhombus from 4 overlapping pulse vector lines.",
        ["Four intersecting 45-degree vectors", "Central diamond negative space", "Cobalt and cyan recovery tones"],
        [["Slate Abyss", "#0F172A"], ["Cobalt Recovery", "#2563EB"], ["Cyan Spark", "#38BDF8"], ["Ice Blue", "#E0F2FE"]],
        {"Family": "Biometrics", "Metaphor": "Heart rate variability diamond", "Vibe": "Scientific & Calming", "ScaleAt16px": "Clean diamond"},
        """<defs><linearGradient id="bg_hrv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hrv)"/>
        <g stroke-linecap="round" stroke-width="72" fill="none">
          <path d="M 512 180 L 800 512 L 512 844 L 224 512 Z" stroke="#2563EB"/>
          <path d="M 512 280 L 700 512 L 512 744 L 324 512 Z" stroke="#38BDF8"/>
        </g>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 L 800 512 L 512 844 L 224 512 Z" fill="none" stroke="#00FF66" stroke-width="64"/><path d="M 512 280 L 700 512 L 512 744 L 324 512 Z" fill="none" stroke="#00FF66" stroke-width="48"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "vo2-max-curve", 18, "biometrics", "VO2 Max Curve",
        "Upward exponential performance curve cresting into an athletic breakthrough",
        "Visualizes VO2 max conditioning: an exponential upward power curve that sweeps from aerobic base pace into an explosive anaerobic breakthrough.",
        ["Smooth exponential curve", "Forward speed arrow terminal", "High-visibility Volt green"],
        [["Charcoal", "#111418"], ["Volt Performance", "#84CC16"], ["Cyan Speed", "#06B6D4"], ["Pure White", "#FFFFFF"]],
        {"Family": "Biometrics", "Metaphor": "VO2 Max power curve", "Vibe": "Aggressive & Upward", "ScaleAt16px": "Strong diagonal sweep"},
        """<defs>
          <linearGradient id="bg_vo2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient>
          <linearGradient id="g_vo2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#06B6D4"/><stop offset="1" stop-color="#84CC16"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_vo2)"/>
        <path d="M 180 780 C 440 780 580 680 720 340 L 820 220" fill="none" stroke="url(#g_vo2)" stroke-width="96" stroke-linecap="round"/>
        <polygon points="820,180 880,320 740,260" fill="#84CC16"/>
        <circle cx="280" cy="780" r="40" fill="#06B6D4"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 180 780 C 440 780 580 680 720 340 L 820 220" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><polygon points="820,180 880,320 740,260" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "respiratory-flow", 19, "biometrics", "Breath Pacer",
        "Concentric expanding and contracting lung-volume circles for recovery breathing",
        "Athletic performance is powered by breath. This mark shows four concentric harmonic breath rings with rhythmic dash spacing.",
        ["Four concentric harmonic rings", "Rhythmic variable dash patterns", "Deep oxygen teal palette"],
        [["Deep Ocean", "#061A1E"], ["Oxygen Teal", "#0D9488"], ["Seafoam", "#2DD4BF"], ["Breeze", "#CCFBF1"]],
        {"Family": "Biometrics", "Metaphor": "Breath volume & Pacing", "Vibe": "Calm & Centered", "ScaleAt16px": "Distinct circular ripples"},
        """<defs><linearGradient id="bg_rsp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041E24"/><stop offset="1" stop-color="#020B0D"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rsp)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#0D9488" stroke-width="44" stroke-dasharray="160 40"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="#2DD4BF" stroke-width="54" stroke-dasharray="120 30"/>
        <circle cx="512" cy="512" r="160" fill="none" stroke="#CCFBF1" stroke-width="64"/>
        <circle cx="512" cy="512" r="60" fill="#2DD4BF"/>""",
        """<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="44" stroke-dasharray="160 40"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="54"/><circle cx="512" cy="512" r="160" fill="none" stroke="#00FF66" stroke-width="64"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>"""
    ))

    c.append(make_cand(
        "caloric-arc", 20, "biometrics", "Caloric Arc",
        "Kinetic 360-degree burn dial with thermal gradient and glowing milestone pips",
        "A heavy 300-degree circular burn dial showing energy expenditure. Starts at cool purple rest, transitions through fiery orange exertion, and culminates in a glowing gold achievement spark.",
        ["300-degree open metric gauge", "Thermal color progression", "Milestone radial ticks"],
        [["Void", "#090A0F"], ["Rest Violet", "#7C3AED"], ["Burn Orange", "#EA580C"], ["Gold Flame", "#FBBF24"]],
        {"Family": "Biometrics", "Metaphor": "Calorie expenditure gauge", "Vibe": "Quantified & Rewarding", "ScaleAt16px": "Bold thick open ring"},
        """<defs>
          <linearGradient id="bg_cal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#100C1B"/><stop offset="1" stop-color="#030205"/></linearGradient>
          <linearGradient id="g_cal" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset="50%" stop-color="#EA580C"/><stop offset="100%" stop-color="#FBBF24"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_cal)"/>
        <path d="M 280 780 A 340 340 0 1 1 744 780" fill="none" stroke="url(#g_cal)" stroke-width="96" stroke-linecap="round"/>
        <circle cx="744" cy="780" r="54" fill="#FBBF24"/>
        <circle cx="512" cy="512" r="48" fill="#7C3AED"/>""",
        """<rect width="1024" height="1024" fill="#000"/><path d="M 280 780 A 340 340 0 1 1 744 780" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><circle cx="744" cy="780" r="48" fill="#00FF66"/>"""
    ))

    return c
