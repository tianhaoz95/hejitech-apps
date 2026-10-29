// FitLoop Logo Redesign: 100 Candidates + Baseline across 10 Thematic Families
(() => {
  const K = window.KIT;

  // Helper to make views for any candidate
  const makeViews = (c) => [
    { name: "iOS App Icon", render: ({ dark }) => K.renderView(c, "ios", dark) },
    { name: "Apple Watch 44mm", render: ({ dark }) => K.renderView(c, "watch", dark) },
    { name: "Even G2 Glasses HUD", render: () => K.renderView(c, "glasses") },
    { name: "Even Hub Store Icon & Listing", render: () => K.renderView(c, "evenhub") },
    { name: "macOS Dock Tile", render: ({ dark }) => K.renderView(c, "mac", dark) },
    { name: "Favicon Ladder (72-16px)", render: ({ dark }) => K.renderView(c, "ladder", dark) },
  ];

  const candidates = [
    {
      id: "current", n: 0, group: "base", name: "Current v1.0 Baseline", baseline: true, prefers: "dark", round: 1,
      tagline: "Navy background with circular arrow & peach dumbbell",
      concept: "The shipping v1.0 icon: an open circular arrow in coral #ff7a45 surrounding a centered peach dumbbell on a dark navy-to-black gradient. Functional, but heavily gym-biased and the plates blur at small sizes.",
      moves: ["Keep current shipping assets", "Circular loop with reload-style arrowhead", "Heavy dumbbell center graphic"],
      palette: [["Deep Navy", "#14112B"], ["Void Black", "#05040F"], ["Coral Loop", "#FF7A45"], ["Peach Dumbbell", "#FFD2BF"]],
      facts: {"Family": "Baseline", "Metaphor": "Gym dumbbell + cycle", "PrimarySurface": "iOS / Watch", "Scalability": "Low (dumbbell blurs at 32px)"},
      evenGrid: "............\n...######...\n..#......#..\n.#........#.\n#..#....#..#\n#.########.#\n#..#....#..#\n.#........#.\n..#......#..\n...####.##..\n.......##...\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M512 196 A316 316 0 1 1 238 354" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M290 262 L292 420 L154 344 Z" fill="#00FF66"/><rect x="352" y="488" width="320" height="48" rx="24" fill="#00FF66"/><rect x="322" y="420" width="56" height="184" rx="22" fill="#00FF66"/><rect x="646" y="420" width="56" height="184" rx="22" fill="#00FF66"/>
      `,
    },
    {
      id: "mobius", n: 1, group: "kinetic", name: "Mobius Flow", prefers: "dark", round: 1,
      tagline: "Endless 3D twisting ribbon in energetic electric coral and solar amber",
      concept: "A seamless geometric Mobius strip rendered with dual-tone gradient ribbons. Symbolizes the unbroken feedback loop between the athlete's real-time physical exertion and the AI agent's evolving plan.",
      moves: ["3D Mobius geometric twist", "Dual overlapping gradient layers", "Drop literal gym equipment"],
      palette: [["Obsidian", "#0B0C10"], ["Electric Coral", "#FF5E3A"], ["Solar Amber", "#FFAE34"], ["Hot Ember", "#D63412"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Infinite loop progression", "Vibe": "Sculptural & Premium", "ScaleAt16px": "Excellent"},
      evenGrid: "...####.....\n..#....#....\n..#...#.....\n...#.#......\n....#.......\n...#.#......\n..#...#.....\n.#.....#....\n.#......#...\n..#....#....\n...####.....\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_mob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12131C"/><stop offset="1" stop-color="#07080B"/></linearGradient>
          <linearGradient id="g_mob1" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#FF5E3A"/><stop offset="1" stop-color="#FFAE34"/></linearGradient>
          <linearGradient id="g_mob2" x1="0" y1="0.8" x2="1" y2="0.2"><stop offset="0" stop-color="#D63412"/><stop offset="1" stop-color="#FF5E3A"/></linearGradient>
          <filter id="mob_sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mob)"/>
        <path d="M 320 320 C 180 460 180 660 320 740 C 460 820 540 680 680 540 C 820 400 860 300 740 260 C 620 220 500 360 420 440" fill="none" stroke="url(#g_mob2)" stroke-width="112" stroke-linecap="round"/>
        <g filter="url(#mob_sh)"><path d="M 280 440 C 380 320 540 240 680 340 C 820 440 820 660 680 740 C 540 820 420 680 300 540" fill="none" stroke="url(#g_mob1)" stroke-width="112" stroke-linecap="round"/></g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 300 340 C 160 480 160 680 300 760 C 460 840 540 700 680 540 C 820 380 860 280 740 240 C 620 200 500 340 400 440" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><path d="M 280 440 C 380 320 540 240 680 340 C 820 440 820 660 680 740 C 540 820 420 680 300 540" fill="none" stroke="#00FF66" stroke-width="104" stroke-linecap="round"/>
      `,
    },
    {
      id: "infinity-pulse", n: 2, group: "kinetic", name: "Infinity Pulse", prefers: "dark", round: 1,
      tagline: "Infinity figure-eight morphing into a sharp biometric heartbeat spike",
      concept: "Merges the universal infinity loop (endless consistency) with an authentic biometric ECG pulse. The left loop is continuous fluid athletic motion; the right loop leaps up into a crisp systolic QRS spike.",
      moves: ["Smooth infinity base", "Integrated systolic heart rate spike", "Luminous neon gradient on midnight"],
      palette: [["Midnight Space", "#0A0D17"], ["Pulse Coral", "#FF4757"], ["Neon Pink", "#FF6B81"], ["Bright White", "#FFFFFF"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Infinity & Live Cardio", "Vibe": "High-energy Cardio", "ScaleAt16px": "Crisp spike"},
      evenGrid: "............\n......##....\n.....#..#...\n....#....#..\n.###..##..#.\n#...##..##.#\n.###..##..#.\n....#....#..\n.....#..#...\n......##....\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_inf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1322"/><stop offset="1" stop-color="#05070D"/></linearGradient>
          <linearGradient id="g_inf" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0%" stop-color="#FF3838"/><stop offset="50%" stop-color="#FF6B81"/><stop offset="100%" stop-color="#FFA502"/></linearGradient>
          <filter id="glow_inf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_inf)"/>
        <g filter="url(#glow_inf)" fill="none" stroke="url(#g_inf)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 512 512 C 400 360 220 360 220 512 C 220 660 400 660 512 512 L 600 512 L 650 240 L 720 760 L 770 512 C 860 512 880 430 840 370 C 800 310 680 340 512 512 Z"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 512 C 400 360 220 360 220 512 C 220 660 400 660 512 512 L 600 512 L 650 240 L 720 760 L 770 512 C 860 512 880 430 840 370 C 800 310 680 340 512 512 Z" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>
      `,
    },
    {
      id: "concentric-orbits", n: 3, group: "kinetic", name: "Concentric Orbits", prefers: "dark", round: 1,
      tagline: "Two interlocking kinetic elliptical rings meeting at an energy focal point",
      concept: "Two tilted elliptical orbits—one representing the physical athlete, the other the digital AI agent—intersecting in an intense glowing nexus point.",
      moves: ["Dual opposing 35\u00b0 elliptical paths", "Tapered velocity stroke weights", "Luminous intersection focal node"],
      palette: [["Deep Void", "#080B14"], ["Laser Cyan", "#00F2FE"], ["Hyper Violet", "#4FACFE"], ["Core White", "#FFFFFF"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Dual orbits & Singularity", "Vibe": "Futuristic & Intelligent", "ScaleAt16px": "Clear geometry"},
      evenGrid: "............\n....####....\n..##....##..\n.#...##...#.\n#...#..#...#\n#...#..#...#\n#...#..#...#\n.#...##...#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_orb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D1120"/><stop offset="1" stop-color="#04060A"/></linearGradient>
          <linearGradient id="g_orb1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00F2FE"/><stop offset="1" stop-color="#4FACFE"/></linearGradient>
          <linearGradient id="g_orb2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF512F"/><stop offset="1" stop-color="#DD2476"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_orb)"/>
        <ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(-32 512 512)" fill="none" stroke="url(#g_orb1)" stroke-width="72"/>
        <ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(32 512 512)" fill="none" stroke="url(#g_orb2)" stroke-width="72"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/><circle cx="512" cy="512" r="80" fill="none" stroke="#00F2FE" stroke-width="12" opacity="0.6"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(-32 512 512)" fill="none" stroke="#00FF66" stroke-width="64"/><ellipse cx="512" cy="512" rx="380" ry="170" transform="rotate(32 512 512)" fill="none" stroke="#00FF66" stroke-width="64"/><circle cx="512" cy="512" r="60" fill="#00FF66"/>
      `,
    },
    {
      id: "endless-track", n: 4, group: "kinetic", name: "Endless Track", prefers: "dark", round: 1,
      tagline: "Stadium running track geometry in triple neon velocity curves",
      concept: "Inspired by athletic stadium tracks and velodrome curves: three parallel rounded velocity lanes that curve around a central energy pocket. Celebrates laps, endurance, pacing, and athletic discipline.",
      moves: ["Triple concentric stadium bands", "Staggered starting lines", "Volt green & cyber yellow"],
      palette: [["Carbon", "#121417"], ["Volt Green", "#10E867"], ["Track Gold", "#FFD200"], ["Graphite", "#22272E"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Running track & Laps", "Vibe": "Athletic & High-performance", "ScaleAt16px": "High contrast lanes"},
      evenGrid: "............\n..########..\n.##########.\n.#........#.\n.#..####..#.\n.#..#..#..#.\n.#..#..#..#.\n.#..####..#.\n.#........#.\n.##########.\n..########..\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_trk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16191F"/><stop offset="1" stop-color="#0B0C0E"/></linearGradient>
          <linearGradient id="g_trk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10E867"/><stop offset="1" stop-color="#FFD200"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_trk)"/>
        <rect x="180" y="240" width="664" height="544" rx="272" fill="none" stroke="url(#g_trk)" stroke-width="48"/>
        <rect x="250" y="310" width="524" height="404" rx="202" fill="none" stroke="url(#g_trk)" stroke-width="48" stroke-dasharray="1400 120"/>
        <rect x="320" y="380" width="384" height="264" rx="132" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-dasharray="800 160"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="180" y="240" width="664" height="544" rx="272" fill="none" stroke="#00FF66" stroke-width="48"/><rect x="250" y="310" width="524" height="404" rx="202" fill="none" stroke="#00FF66" stroke-width="48"/><rect x="320" y="380" width="384" height="264" rx="132" fill="none" stroke="#00FF66" stroke-width="40"/>
      `,
    },
    {
      id: "toroid-flow", n: 5, group: "kinetic", name: "Toroid Flow", prefers: "dark", round: 1,
      tagline: "Four segmented curved turbine blades forming a rotational kinetic torus",
      concept: "A segmented circular torus made of 4 overlapping arc blades that sweep clockwise in continuous acceleration. Each blade represents a phase: Plan, Workout, Check-in, Adapt.",
      moves: ["Four tapered curved turbine blades", "Dark gap channels", "Progressive fiery gradient shading"],
      palette: [["Void", "#08090C"], ["Inferno Orange", "#FF512F"], ["Sunburst", "#F09819"], ["Flame Tip", "#FF7844"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Turbine / 4-phase cycle", "Vibe": "Kinetic & Fast", "ScaleAt16px": "Distinct pinwheel"},
      evenGrid: "............\n....####....\n..##....#...\n.#...##..#..\n#...#..#..#.\n#..#....#.#.\n.#.#....#..#\n.#..#..#...#\n..#..##...#.\n...#....##..\n....####....\n............",
      svg: () => `
<defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g transform="translate(512,512)" fill="#00FF66"><path d="M 0 -340 A 340 340 0 0 1 294 -170 L 196 -113 A 226 226 0 0 0 0 -226 Z"/><path d="M 340 0 A 340 340 0 0 1 170 294 L 113 196 A 226 226 0 0 0 226 0 Z"/><path d="M 0 340 A 340 340 0 0 1 -294 170 L -196 113 A 226 226 0 0 0 0 226 Z"/><path d="M -340 0 A 340 340 0 0 1 -170 -294 L -113 -196 A 226 226 0 0 0 -226 0 Z"/></g><circle cx="512" cy="512" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "spiral-vortex", n: 6, group: "kinetic", name: "Golden Vortex", prefers: "dark", round: 1,
      tagline: "Logarithmic golden-ratio spiral pulling athletic energy toward a luminous core",
      concept: "A precision Fibonacci spiral loop rendered in glowing solar amber lines. Represents the compounding returns of daily athletic training and progressive overload.",
      moves: ["Logarithmic golden ratio curve", "Graduated stroke line weights", "Luminous nucleus pull"],
      palette: [["Cosmic Navy", "#0B0E1B"], ["Amber Glow", "#F59E0B"], ["Solar Core", "#FDE047"], ["Deep Indigo", "#1E1B4B"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Fibonacci spiral", "Vibe": "Mathematical & Hypnotic", "ScaleAt16px": "Distinct coil"},
      evenGrid: "............\n..#########.\n.#.........#\n.#.#######.#\n.#.#.....#.#\n.#.#.###.#.#\n.#.#.#.#.#.#\n.#.#.###...#\n.#.#.......#\n.#.#########\n.###########\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_vor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B0E1B"/><stop offset="1" stop-color="#03040A"/></linearGradient>
          <linearGradient id="g_vor" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#EA580C"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_vor)"/>
        <path d="M 512 512 A 40 40 0 0 1 552 472 A 80 80 0 0 1 632 552 A 160 160 0 0 1 472 712 A 280 280 0 0 1 192 432 A 400 400 0 0 1 592 32" fill="none" stroke="url(#g_vor)" stroke-width="72" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="54" fill="#FDE047"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 512 A 40 40 0 0 1 552 472 A 80 80 0 0 1 632 552 A 160 160 0 0 1 472 712 A 280 280 0 0 1 192 432 A 400 400 0 0 1 592 32" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "double-helix", n: 7, group: "kinetic", name: "Athletic Helix", prefers: "dark", round: 1,
      tagline: "Twin intertwined genetic strands representing biological training adaptation",
      concept: "Draws on the double helix of DNA to symbolize how training and nutrition rewrite the athlete's biological code. The twin strands cross in perpetual rhythmic cadence.",
      moves: ["Twin sinuous ribbon strands", "Cross-connecting energy rungs", "Cyan to magenta performance contrast"],
      palette: [["Dark Slate", "#0A0E17"], ["Laser Cyan", "#06B6D4"], ["Hyper Pink", "#EC4899"], ["Crisp White", "#FFFFFF"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "DNA double helix", "Vibe": "Biotech & Athletic", "ScaleAt16px": "Distinct lattice"},
      evenGrid: "............\n.##......##.\n..##....##..\n...##..##...\n....####....\n...##..##...\n..##....##..\n.##......##.\n..##....##..\n...##..##...\n....####....\n............",
      svg: () => `
<defs><linearGradient id="bg_hel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hel)"/>
        <g stroke-linecap="round" stroke-width="64" fill="none">
          <path d="M 280 200 C 280 360 744 360 744 512 C 744 660 280 660 280 824" stroke="#06B6D4"/>
          <path d="M 744 200 C 744 360 280 360 280 512 C 280 660 744 660 744 824" stroke="#EC4899"/>
        </g>
        <line x1="380" y1="310" x2="644" y2="310" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round"/>
        <line x1="380" y1="714" x2="644" y2="714" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke-linecap="round" stroke-width="64" fill="none" stroke="#00FF66"><path d="M 280 200 C 280 360 744 360 744 512 C 744 660 280 660 280 824"/><path d="M 744 200 C 744 360 280 360 280 512 C 280 660 744 660 744 824"/></g><circle cx="512" cy="512" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "ouroboros-loop", n: 8, group: "kinetic", name: "Cyber Ouroboros", prefers: "dark", round: 1,
      tagline: "High-tech circular loop biting its own tail in perpetual self-renewal",
      concept: "An ancient symbol of eternal renewal reimagined for AI agents: the system observes output, learns from athlete check-ins, and feeds back into tomorrow's plan.",
      moves: ["Circular aerodynamic body", "Geometric polygonal head & tail lock", "Emerald circuit glow"],
      palette: [["Void", "#050A07"], ["Cyber Emerald", "#10B981"], ["Mint Flare", "#34D399"], ["Dark Forest", "#064E3B"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Ouroboros renewal", "Vibe": "Mythic & Cybernetic", "ScaleAt16px": "Solid circular mark"},
      evenGrid: "............\n...######...\n..#......#..\n.#........#.\n#....##...##\n#...#..#..##\n#...#..#..#.\n.#...##...#.\n..#......#..\n...######...\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_our" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06120B"/><stop offset="1" stop-color="#020503"/></linearGradient>
          <linearGradient id="g_our" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_our)"/>
        <circle cx="512" cy="512" r="320" fill="none" stroke="url(#g_our)" stroke-width="88"/>
        <polygon points="512,140 600,192 512,244 540,192" fill="#34D399"/><circle cx="540" cy="180" r="16" fill="#020503"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="320" fill="none" stroke="#00FF66" stroke-width="84"/><polygon points="512,140 600,192 512,244 540,192" fill="#00FF66"/>
      `,
    },
    {
      id: "gyro-momentum", n: 9, group: "kinetic", name: "Gyro Horizon", prefers: "dark", round: 1,
      tagline: "Three gimbal gyroscope rings spinning in continuous athletic equilibrium",
      concept: "Three concentric gyroscope rings tilted along 3 axes. Expresses balance across training, nutrition, and rest. Glances beautifully on Apple Watch and glasses HUD.",
      moves: ["Triple nested gimbal rings", "45-degree isometric tilt", "Precision mechanical calibration"],
      palette: [["Space Cadet", "#111827"], ["Safety Gold", "#F59E0B"], ["Platinum", "#E5E7EB"], ["Steel Gray", "#4B5563"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Gimbal gyroscope", "Vibe": "Instrument-grade", "ScaleAt16px": "Clear nested ellipses"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#..##..##..#\n#.#......#.#\n#.#..##..#.#\n#.#......#.#\n#..##..##..#\n.#...##...#.\n..##....##..\n....####....\n............",
      svg: () => `
<defs><linearGradient id="bg_gyr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_gyr)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#4B5563" stroke-width="40"/>
        <ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(-30 512 512)" fill="none" stroke="#F59E0B" stroke-width="54"/>
        <ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(30 512 512)" fill="none" stroke="#E5E7EB" stroke-width="44"/>
        <circle cx="512" cy="512" r="54" fill="#F59E0B"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="40"/><ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(-30 512 512)" fill="none" stroke="#00FF66" stroke-width="54"/><ellipse cx="512" cy="512" rx="360" ry="180" transform="rotate(30 512 512)" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="50" fill="#00FF66"/>
      `,
    },
    {
      id: "hyperloop-warp", n: 10, group: "kinetic", name: "Hyperloop Tunnel", prefers: "dark", round: 1,
      tagline: "Five concentric perspective velocity rings racing toward the viewer",
      concept: "High-speed perspective tunnel rings creating optical forward motion. Evokes sprinting through a velodrome or accelerating past performance plateaus.",
      moves: ["Concentric perspective scaling", "Dynamic forward depth acceleration", "Electric vermilion velocity streaks"],
      palette: [["Abyssal", "#08070B"], ["Hyper Red", "#EF4444"], ["Solar Flare", "#F97316"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Dynamic Loop", "Metaphor": "Warp tunnel / Forward velocity", "Vibe": "Blazing fast", "ScaleAt16px": "High contrast bullseye"},
      evenGrid: ".##########.\n#..........#\n#.########.#\n#.#......#.#\n#.#.####.#.#\n#.#.#..#.#.#\n#.#.#..#.#.#\n#.#.####.#.#\n#.#......#.#\n#.########.#\n#..........#\n.##########.",
      svg: () => `
<defs>
          <linearGradient id="bg_hyp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140B10"/><stop offset="1" stop-color="#040203"/></linearGradient>
          <linearGradient id="g_hyp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_hyp)"/>
        <circle cx="512" cy="512" r="380" fill="none" stroke="url(#g_hyp)" stroke-width="32" opacity="0.4"/>
        <circle cx="512" cy="512" r="290" fill="none" stroke="url(#g_hyp)" stroke-width="44" opacity="0.65"/>
        <circle cx="512" cy="512" r="200" fill="none" stroke="url(#g_hyp)" stroke-width="58" opacity="0.85"/>
        <circle cx="512" cy="512" r="110" fill="none" stroke="#FFFFFF" stroke-width="72"/><circle cx="512" cy="512" r="36" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="380" fill="none" stroke="#00FF66" stroke-width="32" opacity="0.4"/><circle cx="512" cy="512" r="290" fill="none" stroke="#00FF66" stroke-width="44" opacity="0.65"/><circle cx="512" cy="512" r="200" fill="none" stroke="#00FF66" stroke-width="58" opacity="0.85"/><circle cx="512" cy="512" r="110" fill="none" stroke="#00FF66" stroke-width="72"/><circle cx="512" cy="512" r="36" fill="#00FF66"/>
      `,
    },
    {
      id: "cardio-loop", n: 11, group: "biometrics", name: "Cardio Loop", prefers: "dark", round: 1,
      tagline: "A minimalist circular ring that surges into a sharp cardiac peak",
      concept: "Starts as an ultra-pure circular ring, but breaks into a clean sharp heartbeat spike at the top quadrant. Radical simplicity that works instantly at tiny favicon sizes and looks magnificent on an Apple Watch dial.",
      moves: ["Pure circular geometry", "Single systolic break", "Health-native crimson aesthetic"],
      palette: [["Pitch Black", "#000000"], ["Crimson Pulse", "#FF2D55"], ["Electric Rose", "#FF375F"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Biometrics", "Metaphor": "Heartbeat in circular ring", "Vibe": "Minimal & Health-native", "ScaleAt16px": "Flawless"},
      evenGrid: ".......##...\n......#..#..\n...###....#.\n..#........#\n.#..........\n#...........\n#..........#\n.#........#.\n..#......#..\n...######...\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_car" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14080B"/><stop offset="1" stop-color="#040203"/></linearGradient>
          <linearGradient id="g_car" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FF2D55"/><stop offset="1" stop-color="#FF6B81"/></linearGradient>
          <filter id="glow_car" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_car)"/>
        <g filter="url(#glow_car)" fill="none" stroke="url(#g_car)" stroke-width="88" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 512 840 A 328 328 0 1 1 744 280 L 760 140 L 820 460 L 840 280 A 328 328 0 0 1 512 840 Z"/>
        </g>
        <circle cx="760" cy="140" r="28" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 840 A 328 328 0 1 1 744 280 L 760 140 L 820 460 L 840 280 A 328 328 0 0 1 512 840 Z" fill="none" stroke="#00FF66" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/><circle cx="760" cy="140" r="24" fill="#00FF66"/>
      `,
    },
    {
      id: "activity-triad", n: 12, group: "biometrics", name: "Activity Triad", prefers: "dark", round: 1,
      tagline: "Three nested athletic arcs (Workout, Vitals, Recovery) twisting forward",
      concept: "Draws on the iconic language of athletic activity rings, but breaks the static circle by having the three colored arcs sweep outward into an implied forward aerodynamic arrow.",
      moves: ["Three nested weighted arcs", "Staggered endpoints with kinetic sweep", "Activity triad colors"],
      palette: [["Abyss", "#0E1118"], ["Move Red", "#FA114F"], ["Exercise Green", "#A0FE00"], ["Stand Cyan", "#00E0FF"]],
      facts: {"Family": "Biometrics", "Metaphor": "Concentric activity arcs", "Vibe": "Familiar yet fresh", "ScaleAt16px": "Three bold bands"},
      evenGrid: "...#######..\n..#.......#.\n.#..#####..#\n#..#.....#..\n#..#..#..#..\n#..#..#.....\n#..#..#.....\n#..#..#.....\n.#..#####...\n..#.........\n...#######..\n............",
      svg: () => `
<defs><linearGradient id="bg_tri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10141E"/><stop offset="1" stop-color="#06070B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tri)"/>
        <path d="M 512 160 A 352 352 0 1 1 200 680 L 320 680" fill="none" stroke="#FA114F" stroke-width="72" stroke-linecap="round"/>
        <path d="M 512 260 A 252 252 0 1 1 300 640 L 400 640" fill="none" stroke="#A0FE00" stroke-width="72" stroke-linecap="round"/>
        <path d="M 512 360 A 152 152 0 1 1 400 600 L 480 600" fill="none" stroke="#00E0FF" stroke-width="72" stroke-linecap="round"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 160 A 352 352 0 1 1 200 680 L 320 680" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M 512 260 A 252 252 0 1 1 300 640 L 400 640" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round" stroke-dasharray="80 30"/><path d="M 512 360 A 152 152 0 1 1 400 600 L 480 600" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>
      `,
    },
    {
      id: "pulse-wave", n: 13, group: "biometrics", name: "Pulse Wave", prefers: "dark", round: 1,
      tagline: "Sonic voice & biometric audio waveform looping into an athletic crest",
      concept: "A series of vertical waveform bars of varying height that sweep around a circular perimeter. Symbolizes the AI agent speaking the plan, live biometric feedback, and voice check-ins in the moment.",
      moves: ["Radial soundwave equalizer bars", "Circular envelope geometry", "Glowing tip accents in electric mint"],
      palette: [["Dark Slate", "#0F172A"], ["Electric Mint", "#10B981"], ["Bright Lime", "#84CC16"], ["Pale Neon", "#D9F99D"]],
      facts: {"Family": "Biometrics", "Metaphor": "Voice wave + Cardio rhythm", "Vibe": "Modern AI & Audio", "ScaleAt16px": "Solid silhouette"},
      evenGrid: "............\n.....##.....\n....####....\n...######...\n..########..\n.##########.\n.##########.\n..########..\n...######...\n....####....\n.....##.....\n............",
      svg: () => `
<defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g fill="#00FF66"><rect x="232" y="440" width="48" height="144" rx="24"/><rect x="304" y="360" width="48" height="304" rx="24"/><rect x="376" y="260" width="48" height="504" rx="24"/><rect x="448" y="180" width="48" height="664" rx="24"/><rect x="528" y="220" width="48" height="584" rx="24"/><rect x="600" y="320" width="48" height="384" rx="24"/><rect x="672" y="400" width="48" height="224" rx="24"/><rect x="744" y="450" width="48" height="124" rx="24"/></g>
      `,
    },
    {
      id: "flame-knot", n: 14, group: "biometrics", name: "Flame Knot", prefers: "dark", round: 1,
      tagline: "Two intertwining athletic ribbon loops forming an eternal Olympic torch flame",
      concept: "Two ribbon loops that interlace vertically like a Celtic knot to form the silhouette of an energetic flame. Evokes metabolic burn, athletic passion, and Olympic spirit while maintaining loop structural integrity.",
      moves: ["Interlocking vertical ribbon paths", "Fiery internal color gradient", "Olympic flame silhouette"],
      palette: [["Charcoal", "#18181B"], ["Blaze Orange", "#EA580C"], ["Solar Gold", "#FBBF24"], ["White Flare", "#FFFBEB"]],
      facts: {"Family": "Biometrics", "Metaphor": "Metabolic flame knot", "Vibe": "Passionate & Intense", "ScaleAt16px": "Strong vertical mark"},
      evenGrid: ".....##.....\n....####....\n...######...\n..########..\n.##########.\n.##########.\n.##########.\n..########..\n...######...\n....####....\n.....##.....\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_flm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient>
          <linearGradient id="g_flm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#C2410C"/><stop offset="50%" stop-color="#F97316"/><stop offset="100%" stop-color="#FDE047"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_flm)"/>
        <path d="M 512 800 C 320 800 240 640 240 480 C 240 320 440 240 512 160 C 584 240 784 320 784 480 C 784 640 704 800 512 800 Z" fill="none" stroke="url(#g_flm)" stroke-width="84" stroke-linejoin="round"/>
        <path d="M 512 700 C 420 700 380 600 380 500 C 380 400 470 340 512 260 C 554 340 644 400 644 500 C 644 600 604 700 512 700 Z" fill="url(#g_flm)"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 800 C 320 800 240 640 240 480 C 240 320 440 240 512 160 C 584 240 784 320 784 480 C 784 640 704 800 512 800 Z" fill="none" stroke="#00FF66" stroke-width="72"/><path d="M 512 700 C 420 700 380 600 380 500 C 380 400 470 340 512 260 C 554 340 644 400 644 500 C 644 600 604 700 512 700 Z" fill="#00FF66"/>
      `,
    },
    {
      id: "metabolic-ring", n: 15, group: "biometrics", name: "Metabolic Dial", prefers: "dark", round: 1,
      tagline: "A 12-segment circadian clock dial visualizing workout and nutrition timing",
      concept: "A precision 24-hour circular dial with segmented ticks and glowing active phases. Clearly expresses FitLoop's unique combination of workout scheduling, nutrition windows, and sleep/recovery tracking.",
      moves: ["Circular tick ring with active quadrants", "Central core sensor dot", "Precision telemetry aesthetic"],
      palette: [["Midnight Navy", "#0B1120"], ["Cyan Energy", "#06B6D4"], ["Sunset Amber", "#F59E0B"], ["Vivid Violet", "#8B5CF6"]],
      facts: {"Family": "Biometrics", "Metaphor": "Circadian dial & Timing", "Vibe": "Technical & Holistic", "ScaleAt16px": "Clear dial face"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#....##....#\n#..######..#\n#..######..#\n#....##....#\n.#...##...#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_met" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1120"/><stop offset="1" stop-color="#020408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_met)"/>
        <g stroke-linecap="round" stroke-width="48" fill="none">
          <path d="M 512 180 A 332 332 0 0 1 844 512" stroke="#06B6D4"/>
          <path d="M 844 512 A 332 332 0 0 1 512 844" stroke="#F59E0B"/>
          <path d="M 512 844 A 332 332 0 0 1 180 512" stroke="#8B5CF6"/>
          <path d="M 180 512 A 332 332 0 0 1 512 180" stroke="#334155" stroke-dasharray="30 25"/>
        </g>
        <circle cx="512" cy="512" r="140" fill="#0B1120" stroke="#475569" stroke-width="20"/><circle cx="512" cy="512" r="64" fill="#06B6D4"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke-linecap="round" stroke-width="48" fill="none" stroke="#00FF66"><path d="M 512 180 A 332 332 0 0 1 844 512"/><path d="M 844 512 A 332 332 0 0 1 512 844" stroke-dasharray="40 20"/><path d="M 512 844 A 332 332 0 0 1 180 512"/></g><circle cx="512" cy="512" r="130" fill="#000" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="50" fill="#00FF66"/>
      `,
    },
    {
      id: "systolic-surge", n: 16, group: "biometrics", name: "Systolic Surge", prefers: "dark", round: 1,
      tagline: "High-amplitude EKG heartbeat peak leaping above a dark baseline horizon",
      concept: "Raw cardiovascular power: a horizontal baseline across the display that suddenly leaps into a towering 600px tall systolic spike before settling into an energetic recovery wave.",
      moves: ["Linear baseline to peak transition", "Sharp 20-degree acute angle apex", "Crimson into neon pink gradient"],
      palette: [["Night", "#0C0709"], ["Crimson Surge", "#E11D48"], ["Laser Rose", "#FB7185"], ["White Apex", "#FFFFFF"]],
      facts: {"Family": "Biometrics", "Metaphor": "Systolic cardiac spike", "Vibe": "Intense & Pure", "ScaleAt16px": "Unmistakable peak"},
      evenGrid: "............\n......#.....\n......#.....\n.....###....\n.....#.#....\n....#...#...\n....#...#...\n####.....###\n............\n............\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_sys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#190B10"/><stop offset="1" stop-color="#050204"/></linearGradient>
          <linearGradient id="g_sys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E11D48"/><stop offset="1" stop-color="#FB7185"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_sys)"/>
        <path d="M 120 540 L 360 540 L 440 680 L 520 180 L 600 760 L 660 480 L 720 540 L 904 540" fill="none" stroke="url(#g_sys)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="520" cy="180" r="32" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 120 540 L 360 540 L 440 680 L 520 180 L 600 760 L 660 480 L 720 540 L 904 540" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><circle cx="520" cy="180" r="28" fill="#00FF66"/>
      `,
    },
    {
      id: "hrv-rhombus", n: 17, group: "biometrics", name: "HRV Diamond", prefers: "dark", round: 1,
      tagline: "Heart Rate Variability geometry formed by intersecting diamond pulse vectors",
      concept: "Heart Rate Variability (HRV) is the gold standard of athletic recovery. This mark constructs an athletic diamond rhombus from 4 overlapping pulse vector lines.",
      moves: ["Four intersecting 45-degree vectors", "Central diamond negative space", "Cobalt and cyan recovery tones"],
      palette: [["Slate Abyss", "#0F172A"], ["Cobalt Recovery", "#2563EB"], ["Cyan Spark", "#38BDF8"], ["Ice Blue", "#E0F2FE"]],
      facts: {"Family": "Biometrics", "Metaphor": "Heart rate variability diamond", "Vibe": "Scientific & Calming", "ScaleAt16px": "Clean diamond"},
      evenGrid: ".....##.....\n....####....\n...##..##...\n..##....##..\n.##......##.\n##...##...##\n##...##...##\n.##......##.\n..##....##..\n...##..##...\n....####....\n.....##.....",
      svg: () => `
<defs><linearGradient id="bg_hrv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hrv)"/>
        <g stroke-linecap="round" stroke-width="72" fill="none">
          <path d="M 512 180 L 800 512 L 512 844 L 224 512 Z" stroke="#2563EB"/>
          <path d="M 512 280 L 700 512 L 512 744 L 324 512 Z" stroke="#38BDF8"/>
        </g>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 L 800 512 L 512 844 L 224 512 Z" fill="none" stroke="#00FF66" stroke-width="64"/><path d="M 512 280 L 700 512 L 512 744 L 324 512 Z" fill="none" stroke="#00FF66" stroke-width="48"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "vo2-max-curve", n: 18, group: "biometrics", name: "VO2 Max Curve", prefers: "dark", round: 1,
      tagline: "Upward exponential performance curve cresting into an athletic breakthrough",
      concept: "Visualizes VO2 max conditioning: an exponential upward power curve that sweeps from aerobic base pace into an explosive anaerobic breakthrough.",
      moves: ["Smooth exponential curve", "Forward speed arrow terminal", "High-visibility Volt green"],
      palette: [["Charcoal", "#111418"], ["Volt Performance", "#84CC16"], ["Cyan Speed", "#06B6D4"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Biometrics", "Metaphor": "VO2 Max power curve", "Vibe": "Aggressive & Upward", "ScaleAt16px": "Strong diagonal sweep"},
      evenGrid: "........####\n.......#####\n......#..###\n.....#....##\n....#.......\n...#........\n..#.........\n.###########\n.###########\n............\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_vo2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient>
          <linearGradient id="g_vo2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#06B6D4"/><stop offset="1" stop-color="#84CC16"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_vo2)"/>
        <path d="M 180 780 C 440 780 580 680 720 340 L 820 220" fill="none" stroke="url(#g_vo2)" stroke-width="96" stroke-linecap="round"/>
        <polygon points="820,180 880,320 740,260" fill="#84CC16"/>
        <circle cx="280" cy="780" r="40" fill="#06B6D4"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 180 780 C 440 780 580 680 720 340 L 820 220" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><polygon points="820,180 880,320 740,260" fill="#00FF66"/>
      `,
    },
    {
      id: "respiratory-flow", n: 19, group: "biometrics", name: "Breath Pacer", prefers: "dark", round: 1,
      tagline: "Concentric expanding and contracting lung-volume circles for recovery breathing",
      concept: "Athletic performance is powered by breath. This mark shows four concentric harmonic breath rings with rhythmic dash spacing.",
      moves: ["Four concentric harmonic rings", "Rhythmic variable dash patterns", "Deep oxygen teal palette"],
      palette: [["Deep Ocean", "#061A1E"], ["Oxygen Teal", "#0D9488"], ["Seafoam", "#2DD4BF"], ["Breeze", "#CCFBF1"]],
      facts: {"Family": "Biometrics", "Metaphor": "Breath volume & Pacing", "Vibe": "Calm & Centered", "ScaleAt16px": "Distinct circular ripples"},
      evenGrid: "....#..#....\n..#......#..\n.#...##...#.\n....#..#....\n#..#....#..#\n#..#....#..#\n....#..#....\n.#...##...#.\n..#......#..\n....#..#....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_rsp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041E24"/><stop offset="1" stop-color="#020B0D"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rsp)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#0D9488" stroke-width="44" stroke-dasharray="160 40"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="#2DD4BF" stroke-width="54" stroke-dasharray="120 30"/>
        <circle cx="512" cy="512" r="160" fill="none" stroke="#CCFBF1" stroke-width="64"/>
        <circle cx="512" cy="512" r="60" fill="#2DD4BF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="44" stroke-dasharray="160 40"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="54"/><circle cx="512" cy="512" r="160" fill="none" stroke="#00FF66" stroke-width="64"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "caloric-arc", n: 20, group: "biometrics", name: "Caloric Arc", prefers: "dark", round: 1,
      tagline: "Kinetic 360-degree burn dial with thermal gradient and glowing milestone pips",
      concept: "A heavy 300-degree circular burn dial showing energy expenditure. Starts at cool purple rest, transitions through fiery orange exertion, and culminates in a glowing gold achievement spark.",
      moves: ["300-degree open metric gauge", "Thermal color progression", "Milestone radial ticks"],
      palette: [["Void", "#090A0F"], ["Rest Violet", "#7C3AED"], ["Burn Orange", "#EA580C"], ["Gold Flame", "#FBBF24"]],
      facts: {"Family": "Biometrics", "Metaphor": "Calorie expenditure gauge", "Vibe": "Quantified & Rewarding", "ScaleAt16px": "Bold thick open ring"},
      evenGrid: "...######...\n..#......#..\n.#........#.\n#..........#\n#..........#\n#..........#\n.#........#.\n..#......#..\n...#....#...\n....#..#....\n.....##.....\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_cal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#100C1B"/><stop offset="1" stop-color="#030205"/></linearGradient>
          <linearGradient id="g_cal" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset="50%" stop-color="#EA580C"/><stop offset="100%" stop-color="#FBBF24"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_cal)"/>
        <path d="M 280 780 A 340 340 0 1 1 744 780" fill="none" stroke="url(#g_cal)" stroke-width="96" stroke-linecap="round"/>
        <circle cx="744" cy="780" r="54" fill="#FBBF24"/>
        <circle cx="512" cy="512" r="48" fill="#7C3AED"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 780 A 340 340 0 1 1 744 780" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><circle cx="744" cy="780" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "monogram-fl", n: 21, group: "monogram", name: "Architectural FL", prefers: "dark", round: 1,
      tagline: "Heavyweight geometric 'F' whose lower bar loops seamlessly into an 'L'",
      concept: "A bespoke geometric athletic monogram. The vertical stem of the 'F' curves into the horizontal base of the 'L' in one fluid sweep, while the upper arm of the 'F' shoots forward like a runner off the blocks.",
      moves: ["Bold architectural stem", "Continuous bottom F-to-L loop curve", "45-degree speed chamfers"],
      palette: [["Jet Black", "#111111"], ["Hyper Orange", "#FF4500"], ["Warm Off-White", "#F5F5F7"], ["Smoked Gray", "#2C2C2E"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Letterforms F + L in one stroke", "Vibe": "Punchy & Bold", "ScaleAt16px": "Unmistakable silhouette"},
      evenGrid: ".#########..\n.#########..\n.#..........\n.#.######...\n.#.######...\n.#..........\n.#..........\n.#.....#####\n.#.....#####\n.###########\n.###########\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_mfl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181A"/><stop offset="1" stop-color="#0B0B0C"/></linearGradient>
          <linearGradient id="g_mfl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5722"/><stop offset="1" stop-color="#FF9800"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mfl)"/>
        <path d="M 320 220 L 760 220 L 700 340 L 320 340 Z" fill="#FFFFFF"/>
        <path d="M 320 440 L 640 440 L 580 560 L 320 560 Z" fill="url(#g_mfl)"/>
        <path d="M 320 220 L 320 640 C 320 740 400 820 500 820 L 760 820 L 800 700 L 500 700 C 440 700 420 680 420 620 L 420 220 Z" fill="url(#g_mfl)"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 320 220 L 760 220 L 700 340 L 320 340 Z" fill="#00FF66"/><path d="M 320 440 L 640 440 L 580 560 L 320 560 Z" fill="#00FF66"/><path d="M 320 220 L 320 640 C 320 740 400 820 500 820 L 760 820 L 800 700 L 500 700 C 440 700 420 680 420 620 L 420 220 Z" fill="#00FF66"/>
      `,
    },
    {
      id: "wire-fl", n: 22, group: "monogram", name: "Continuous Neon Wire", prefers: "dark", round: 1,
      tagline: "A single unbroken luminous neon tube tracing both 'F' and 'L'",
      concept: "Inspired by neon light art and laser wire: one single unbroken line drawn without lifting the pen that forms an 'F' and 'L'. Utterly minimal, light, agile, and glows beautifully on OLED screens.",
      moves: ["Single continuous stroke path", "Rounded endcaps", "Vivid neon tube glow on OLED black"],
      palette: [["OLED Black", "#050505"], ["Neon Lime", "#22C55E"], ["Cyber Yellow", "#EAB308"], ["Glow Halo", "#15803D"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Single continuous wire", "Vibe": "Ultra-clean & Agile", "ScaleAt16px": "Very legible stroke"},
      evenGrid: ".#######....\n.#..........\n.#####......\n.#..........\n.#..........\n.#..........\n.#..........\n.#.....#####\n.###########\n............\n............\n............",
      svg: () => `
<defs>
          <filter id="glow_wire" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#050505"/>
        <g filter="url(#glow_wire)" fill="none" stroke="#22C55E" stroke-width="72" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 740 240 L 320 240 L 320 460 L 620 460 L 320 460 L 320 700 C 320 780 380 820 460 820 L 760 820"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 740 240 L 320 240 L 320 460 L 620 460 L 320 460 L 320 700 C 320 780 380 820 460 820 L 760 820" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>
      `,
    },
    {
      id: "hex-loop", n: 23, group: "monogram", name: "Isometric Hex Loop", prefers: "dark", round: 1,
      tagline: "An isometric 3D hexagon prism whose facets form an interlocking 'F' and 'L'",
      concept: "Precision isometric engineering. A faceted hexagonal ring with impossible-geometry shading where the top and left facets construct the 'F' and the lower base constructs the 'L'.",
      moves: ["Isometric 30-degree grid", "Three-tone facet lighting", "Impossible hex geometry illusion"],
      palette: [["Gunmetal", "#1E293B"], ["Cobalt Blue", "#2563EB"], ["Sky Cyan", "#38BDF8"], ["Ice White", "#F0F9FF"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Hexagonal prism loop", "Vibe": "Engineered & Tech", "ScaleAt16px": "Solid faceted icon"},
      evenGrid: "....####....\n..##....##..\n.##......##.\n.##.####.##.\n.##......##.\n.##.####.##.\n.##......##.\n.##......##.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_hex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hex)"/>
        <g stroke="#0F172A" stroke-width="6" stroke-linejoin="round">
          <polygon points="512,180 780,334 680,390 512,294 344,390 244,334" fill="#38BDF8"/>
          <polygon points="244,334 344,390 344,690 244,634" fill="#2563EB"/>
          <polygon points="344,480 620,480 560,540 344,540" fill="#38BDF8"/>
          <polygon points="780,334 780,634 680,690 680,390" fill="#1D4ED8"/>
          <polygon points="344,690 512,786 780,786 680,690 512,690 244,634" fill="#1E3A8A"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"><polygon points="512,180 780,334 780,634 512,786 244,634 244,334"/><line x1="344" y1="490" x2="620" y2="490"/></g>
      `,
    },
    {
      id: "glyph", n: 24, group: "monogram", name: "Loop Glyph (Alpha F)", prefers: "dark", round: 1,
      tagline: "An elegant ribbon loop glyph with a swift athletic crossbar slash",
      concept: "Modern athletic minimalism in the vein of Nike or On Running. A fluid teardrop ribbon loop that self-intersects at the bottom, crossed by a dynamic forward-slanted speed bar that forms a stylized 'F'.",
      moves: ["Self-crossing fluid ribbon loop", "Forward 60-degree athletic slash", "Balanced negative space geometry"],
      palette: [["Dark Heather", "#191D24"], ["Coral Pop", "#FF6347"], ["Soft Peach", "#FFDAB9"], ["Deep Shadow", "#0D0E11"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Athletic speed glyph", "Vibe": "Sleek & Fashion-forward", "ScaleAt16px": "Iconic symbol"},
      evenGrid: "....####....\n...######...\n..##....##..\n.##......##.\n.##.####.##.\n..##.##.##..\n...######...\n..##....##..\n.##......##.\n##........##\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_gly" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1F242D"/><stop offset="1" stop-color="#0B0D11"/></linearGradient>
          <linearGradient id="g_gly" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6347"/><stop offset="1" stop-color="#FF8A65"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_gly)"/>
        <path d="M 380 780 L 640 280 C 740 180 840 300 760 440 L 260 760" fill="none" stroke="url(#g_gly)" stroke-width="96" stroke-linecap="round"/>
        <path d="M 320 460 L 700 460" fill="none" stroke="#FFFFFF" stroke-width="84" stroke-linecap="round"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 380 780 L 640 280 C 740 180 840 300 760 440 L 260 760" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/><path d="M 320 460 L 700 460" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/>
      `,
    },
    {
      id: "fold-fl", n: 25, group: "monogram", name: "Origami Ribbon FL", prefers: "dark", round: 1,
      tagline: "Interlocking folded athletic ribbons with dimensional shadow overlap",
      concept: "Two folded technical fabric ribbons (like high-performance running singlets) layered to create 'F' and 'L'. The subtle drop shadows between folds give tactile physical depth without skeuomorphism.",
      moves: ["Crisp angled fold planes", "Soft self-shadowing between layers", "Dual contrast (Papaya and Coral)"],
      palette: [["Pure Obsidian", "#0E1015"], ["Papaya Whip", "#FF7F50"], ["Safety Orange", "#FF3B00"], ["Soft Cream", "#FFF5EE"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Folded athletic ribbons", "Vibe": "Tactile & Premium", "ScaleAt16px": "Strong geometric facets"},
      evenGrid: ".#######....\n.#######....\n.##...##....\n.##.####....\n.##.####....\n.##.........\n.##.........\n.##...######\n.###########\n.###########\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_fld" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171F"/><stop offset="1" stop-color="#08090C"/></linearGradient>
          <filter id="fld_sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="-6" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.5"/></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_fld)"/>
        <path d="M 300 240 L 440 240 L 440 680 L 760 680 L 760 820 L 300 820 Z" fill="#FF3B00"/>
        <g filter="url(#fld_sh)">
          <path d="M 300 240 L 780 240 L 700 380 L 440 380 Z" fill="#FF7F50"/>
          <path d="M 440 460 L 680 460 L 600 580 L 440 580 Z" fill="#FFA07A"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 300 240 L 440 240 L 440 680 L 760 680 L 760 820 L 300 820 Z" fill="#00FF66"/><path d="M 300 240 L 780 240 L 700 380 L 440 380 Z" fill="#00FF66" stroke="#000" stroke-width="16"/><path d="M 440 460 L 680 460 L 600 580 L 440 580 Z" fill="#00FF66" stroke="#000" stroke-width="16"/>
      `,
    },
    {
      id: "stencil-fl", n: 26, group: "monogram", name: "Stencil Speed FL", prefers: "dark", round: 1,
      tagline: "Bold military athletic stencil cutouts with 45-degree forward speed slashes",
      concept: "Brutalist athletic training: heavy stencil letterforms cut with aerodynamic 45-degree slashes. Evokes tactical gym equipment, CrossFit rigs, and unstoppable forward momentum.",
      moves: ["Heavy geometric stencil stems", "45-degree speed channels", "Safety yellow high-visibility pop"],
      palette: [["Gunmetal", "#18181B"], ["Safety Yellow", "#FACC15"], ["Pure White", "#FFFFFF"], ["Iron Core", "#27272A"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Tactical stencil F+L", "Vibe": "Brutalist & Powerful", "ScaleAt16px": "Heavy high contrast"},
      evenGrid: ".####.####..\n.#..........\n.####.##....\n.#..........\n.#..........\n.#..........\n.#....####..\n.####.####..\n............\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_stn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_stn)"/>
        <!-- F Top Bar -->
        <rect x="280" y="220" width="460" height="100" fill="#FACC15"/>
        <!-- F Mid Bar -->
        <rect x="420" y="440" width="300" height="90" fill="#FACC15"/>
        <!-- Vertical Stem Broken Stencil -->
        <rect x="280" y="360" width="100" height="200" fill="#FFFFFF"/>
        <!-- L Base -->
        <path d="M 280 600 L 380 600 L 380 720 L 740 720 L 740 820 L 280 820 Z" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="280" y="220" width="460" height="100" fill="#00FF66"/><rect x="420" y="440" width="300" height="90" fill="#00FF66"/><rect x="280" y="360" width="100" height="200" fill="#00FF66"/><path d="M 280 600 L 380 600 L 380 720 L 740 720 L 740 820 L 280 820 Z" fill="#00FF66"/>
      `,
    },
    {
      id: "interlock-fl", n: 27, group: "monogram", name: "Interlocking Links FL", prefers: "dark", round: 1,
      tagline: "Two heavy chain links that interlace to form the 'F' and 'L'",
      concept: "Symbolizes unbreakable athletic discipline: two polished metal chain links interlocking in physical strength, forming the F upper loop and L base foot.",
      moves: ["Dual interlocking oval chain links", "Polished metallic edge highlights", "Industrial chrome & ember"],
      palette: [["Dark Graphite", "#111827"], ["Forged Ember", "#F97316"], ["Chrome Silver", "#E2E8F0"], ["Matte Iron", "#374151"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Interlocked chain links", "Vibe": "Heavy Duty & Reliable", "ScaleAt16px": "Crisp interlocking loops"},
      evenGrid: "...####.....\n..######....\n.##....##...\n.##.##.##...\n.##.##.##...\n..######....\n...####.##..\n....##.####.\n....##.##.##\n....##.##.##\n.....######.\n......####..",
      svg: () => `
<defs><linearGradient id="bg_lnk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_lnk)"/>
        <!-- Link 1 (F loop) -->
        <rect x="280" y="220" width="460" height="340" rx="170" fill="none" stroke="#F97316" stroke-width="72"/>
        <!-- Link 2 (L loop) -->
        <rect x="420" y="440" width="340" height="420" rx="170" fill="none" stroke="#E2E8F0" stroke-width="72"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="280" y="220" width="460" height="340" rx="170" fill="none" stroke="#00FF66" stroke-width="64"/><rect x="420" y="440" width="340" height="420" rx="170" fill="none" stroke="#00FF66" stroke-width="64"/>
      `,
    },
    {
      id: "chamfer-fl", n: 28, group: "monogram", name: "Chamfer Kinetic FL", prefers: "dark", round: 1,
      tagline: "Monogram crafted with aerodynamic racecar chamfers and forward rake",
      concept: "Inspired by Formula 1 sidepods and aerodynamic splitters: F and L letterforms styled with 15-degree forward rake and 45-degree corner bevels.",
      moves: ["15-degree forward kinetic slant", "Precision aerodynamic bevel chamfers", "Electric cyan & white racing livery"],
      palette: [["Carbon Fiber", "#090B0E"], ["Aero Cyan", "#00F0FF"], ["Racing White", "#FFFFFF"], ["Graphite", "#1E2229"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Motorsport aero chamfers", "Vibe": "Aggressive & Aerodynamic", "ScaleAt16px": "Distinct raked lines"},
      evenGrid: "...#######..\n..#######...\n..##........\n.#######....\n.#######....\n.##.........\n.##.........\n##....######\n##...#######\n.##########.\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_chm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1217"/><stop offset="1" stop-color="#040608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_chm)"/>
        <g transform="skewX(-15) translate(180, 0)">
          <path d="M 320 220 L 680 220 L 620 340 L 440 340 L 440 440 L 580 440 L 520 540 L 440 540 L 440 700 L 720 700 L 680 820 L 320 820 Z" fill="#00F0FF"/>
          <circle cx="680" cy="220" r="28" fill="#FFFFFF"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g transform="skewX(-15) translate(180, 0)"><path d="M 320 220 L 680 220 L 620 340 L 440 340 L 440 440 L 580 440 L 520 540 L 440 540 L 440 700 L 720 700 L 680 820 L 320 820 Z" fill="#00FF66"/></g>
      `,
    },
    {
      id: "negative-fl", n: 29, group: "monogram", name: "Negative Space FL", prefers: "dark", round: 1,
      tagline: "Solid circular disc with negative-space cutout revealing dynamic F and L",
      concept: "A heavy circular solid emblem in blazing solar coral with precision negative-space cutouts carving out 'F' and 'L' from the void.",
      moves: ["Solid circular foundation emblem", "Precision subtractive negative space", "High-contrast silhouette"],
      palette: [["Void Night", "#050505"], ["Blazing Coral", "#FF5E3A"], ["Pure White", "#FFFFFF"], ["Shadow Black", "#000000"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Negative space carving", "Vibe": "Graphic & Timeless", "ScaleAt16px": "Crisp white-on-coral badge"},
      evenGrid: "...######...\n..########..\n.###..######\n.###..######\n.###........\n.###..######\n.###..######\n.###........\n.###########\n..########..\n...######...\n............",
      svg: () => `
<defs><linearGradient id="bg_neg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141118"/><stop offset="1" stop-color="#050406"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_neg)"/>
        <circle cx="512" cy="512" r="360" fill="#FF5E3A"/>
        <path d="M 340 300 L 680 300 L 680 400 L 460 400 L 460 480 L 620 480 L 620 580 L 460 580 L 460 680 L 700 680 L 700 780 L 340 780 Z" fill="#050406"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="#00FF66"/><path d="M 340 300 L 680 300 L 680 400 L 460 400 L 460 480 L 620 480 L 620 580 L 460 580 L 460 680 L 700 680 L 700 780 L 340 780 Z" fill="#000"/>
      `,
    },
    {
      id: "tubular-fl", n: 30, group: "monogram", name: "Tubular Track FL", prefers: "dark", round: 1,
      tagline: "Rounded stadium tube geometry bending through 90-degree athletic elbows",
      concept: "Inspired by architectural stadium handrails and Olympic track lane dividers: a 96px heavy rounded tube that traces 'F' and 'L' with pill-smooth radiuses.",
      moves: ["Consistent 96px tubular line weight", "Smooth circular bends", "High-voltage fluorescent green"],
      palette: [["Pitch Black", "#000000"], ["Fluorescent Green", "#10B981"], ["Bright Lime", "#84CC16"], ["Deep Forest", "#064E3B"]],
      facts: {"Family": "Monogram FL", "Metaphor": "Architectural track tube", "Vibe": "Clean & Tangible", "ScaleAt16px": "Thick continuous pipe"},
      evenGrid: "..######....\n.########...\n.##....##...\n.##.######..\n.##.######..\n.##.........\n.##.........\n.##....#####\n.###########\n..#########.\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_tub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06120E"/><stop offset="1" stop-color="#010503"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tub)"/>
        <g stroke="#10B981" stroke-width="96" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 720 260 L 340 260 L 340 760 L 720 760"/>
          <path d="M 340 480 L 620 480"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="96" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M 720 260 L 340 260 L 340 760 L 720 760"/><path d="M 340 480 L 620 480"/></g>
      `,
    },
    {
      id: "hud", n: 31, group: "hud", name: "Even G2 Optical Reticle", prefers: "dark", round: 1,
      tagline: "Precision optical collimator HUD with targeting ticks and energy nucleus",
      concept: "Designed directly from FitLoop's Even G2 and R1 smart glasses integration: an optical heads-up collimator reticle with four cardinal ticks, an open telemetry circular frame, and a glowing central target pip.",
      moves: ["Optical collimator circle", "4 cardinal target ticks", "Central micro-pip with HUD telemetry frame"],
      palette: [["OLED Black", "#000000"], ["G2 Emerald", "#00FF66"], ["Phosphor Green", "#10B981"], ["Bright White", "#FFFFFF"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Smart glasses HUD reticle", "Vibe": "Tactical & Glanceable", "ScaleAt16px": "Razor sharp"},
      evenGrid: ".....##.....\n....#..#....\n...#....#...\n..#......#..\n.#........#.\n##...##...##\n##...##...##\n.#........#.\n..#......#..\n...#....#...\n....#..#....\n.....##.....",
      svg: () => `
<defs><filter id="glow_hud" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <rect width="1024" height="1024" fill="#020804"/>
        <g filter="url(#glow_hud)" stroke="#00FF66" fill="none">
          <circle cx="512" cy="512" r="360" stroke-width="28" stroke-dasharray="240 80 160 80"/>
          <circle cx="512" cy="512" r="240" stroke-width="44"/>
          <line x1="512" y1="110" x2="512" y2="230" stroke-width="48" stroke-linecap="round"/>
          <line x1="512" y1="794" x2="512" y2="914" stroke-width="48" stroke-linecap="round"/>
          <line x1="110" y1="512" x2="230" y2="512" stroke-width="48" stroke-linecap="round"/>
          <line x1="794" y1="512" x2="914" y2="512" stroke-width="48" stroke-linecap="round"/>
          <circle cx="512" cy="512" r="64" fill="#00FF66"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="28" stroke-dasharray="240 80 160 80"/><circle cx="512" cy="512" r="240" fill="none" stroke="#00FF66" stroke-width="44"/><line x1="512" y1="110" x2="512" y2="230" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><line x1="512" y1="794" x2="512" y2="914" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><line x1="110" y1="512" x2="230" y2="512" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><line x1="794" y1="512" x2="914" y2="512" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><circle cx="512" cy="512" r="64" fill="#00FF66"/>
      `,
    },
    {
      id: "node-loop", n: 32, group: "hud", name: "Agentic Tri-Node", prefers: "dark", round: 1,
      tagline: "Three orbiting device nodes (Phone, Watch, Glasses) linked to an AI core",
      concept: "The hardware and intelligence architecture of FitLoop visualized: three glowing peripheral sensor nodes linked by curved orbital arcs around a central AI agent nucleus.",
      moves: ["Three 120-degree orbital satellite nodes", "Curved linking tracks", "Central pulsing AI core"],
      palette: [["Deep Indigo", "#0F172A"], ["Electric Violet", "#7C3AED"], ["Cyan Link", "#06B6D4"], ["Core Glow", "#E0E7FF"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "MCP multi-device network", "Vibe": "Connected & High-tech", "ScaleAt16px": "Distinct node cluster"},
      evenGrid: ".....##.....\n....####....\n.....##.....\n...#....#...\n..#..##..#..\n.#..####..#.\n....####....\n.##..##..##.\n####....####\n.##......##.\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_nod" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_nod)"/>
        <path d="M 512 240 Q 760 380 760 680 Q 512 780 264 680 Q 264 380 512 240 Z" fill="none" stroke="#7C3AED" stroke-width="48" stroke-dasharray="140 30"/>
        <circle cx="512" cy="512" r="96" fill="#06B6D4"/><circle cx="512" cy="512" r="140" fill="none" stroke="#06B6D4" stroke-width="12" opacity="0.4"/>
        <circle cx="512" cy="240" r="64" fill="#FFFFFF" stroke="#06B6D4" stroke-width="16"/>
        <circle cx="760" cy="680" r="64" fill="#FFFFFF" stroke="#7C3AED" stroke-width="16"/>
        <circle cx="264" cy="680" r="64" fill="#FFFFFF" stroke="#7C3AED" stroke-width="16"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 240 Q 760 380 760 680 Q 512 780 264 680 Q 264 380 512 240 Z" fill="none" stroke="#00FF66" stroke-width="48"/><circle cx="512" cy="512" r="88" fill="#00FF66"/><circle cx="512" cy="240" r="60" fill="#000" stroke="#00FF66" stroke-width="24"/><circle cx="760" cy="680" r="60" fill="#000" stroke="#00FF66" stroke-width="24"/><circle cx="264" cy="680" r="60" fill="#000" stroke="#00FF66" stroke-width="24"/>
      `,
    },
    {
      id: "aperture", n: 33, group: "hud", name: "Kinetic Aperture", prefers: "dark", round: 1,
      tagline: "Six sweeping curved camera aperture blades opening on your daily plan",
      concept: "A mechanical iris aperture composed of 6 curved blades that spiral outward from a central hexagonal opening. Symbolizes focusing on the plan, optical precision, and opening a window into your biometric day.",
      moves: ["Six rotational curved blades", "Dynamic gradient spiral", "Sharp hexagonal core aperture"],
      palette: [["Midnight Gray", "#111827"], ["Tangerine", "#F97316"], ["Amber Gold", "#FBBF24"], ["Warm White", "#FEF3C7"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Camera lens iris", "Vibe": "Focus & Optical", "ScaleAt16px": "Recognizable swirl"},
      evenGrid: "....####....\n..##...###..\n.##..##..##.\n.#..#..#..#.\n#..#....#..#\n#..#....#..#\n.#..#..#..#.\n.##..##..##.\n..###...##..\n....####....\n............\n............",
      svg: () => `
<defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g transform="translate(512,512)" stroke="#000" stroke-width="20" fill="#00FF66"><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(60)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(120)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(180)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(240)"/><path d="M 0 -120 L 180 -340 C 260 -280 320 -180 340 -60 L 100 -20 Z" transform="rotate(300)"/></g>
      `,
    },
    {
      id: "twin", n: 34, group: "hud", name: "Digital Twin Orbit", prefers: "dark", round: 1,
      tagline: "Two mirrored teardrop droplet arcs in perpetual gravitational sync",
      concept: "Represents the twin relationship at the heart of FitLoop: the digital AI agent coach and the physical human athlete orbiting each other in perpetual harmony.",
      moves: ["Two mirrored droplet arcs", "Yin-Yang inspired kinetic tension", "Vibrant opposing gradients (Cyan & Mint)"],
      palette: [["Cosmic Black", "#0B0C10"], ["Agent Cyan", "#00C9FF"], ["Athlete Mint", "#92FE9D"], ["Sync White", "#FFFFFF"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Digital twin & Human athlete", "Vibe": "Harmonious & Modern", "ScaleAt16px": "Fluid dual swoosh"},
      evenGrid: "....####....\n...######...\n..##....##..\n.##..##..##.\n.##.####.##.\n.##.####.##.\n.##..##..##.\n..##....##..\n...######...\n....####....\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_twn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0D1117"/><stop offset="1" stop-color="#030508"/></linearGradient>
          <linearGradient id="g_twn1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00C9FF"/><stop offset="1" stop-color="#92FE9D"/></linearGradient>
          <linearGradient id="g_twn2" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF5E3A"/><stop offset="1" stop-color="#FF2A54"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_twn)"/>
        <path d="M 512 180 C 720 180 840 320 840 512 C 840 680 720 780 620 780 C 520 780 480 700 480 620 C 480 540 540 480 540 400 C 540 280 440 200 512 180 Z" fill="url(#g_twn1)"/>
        <path d="M 512 844 C 304 844 184 704 184 512 C 184 344 304 244 404 244 C 504 244 544 324 544 404 C 544 484 484 544 484 624 C 484 744 584 824 512 844 Z" fill="url(#g_twn2)"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 C 720 180 840 320 840 512 C 840 680 720 780 620 780 C 520 780 480 700 480 620 C 480 540 540 480 540 400 C 540 280 440 200 512 180 Z" fill="#00FF66"/><path d="M 512 844 C 304 844 184 704 184 512 C 184 344 304 244 404 244 C 504 244 544 324 544 404 C 544 484 484 544 484 624 C 484 744 584 824 512 844 Z" fill="#00FF66" opacity="0.6"/>
      `,
    },
    {
      id: "prism", n: 35, group: "hud", name: "Refractive Prism Core", prefers: "dark", round: 1,
      tagline: "Precision faceted diamond gem loop refracting infrared into electric mint",
      concept: "Luxury high-performance athletic aesthetic (inspired by District Vision or Satisfy Running). A geometric faceted diamond loop that refracts deep infrared workout burn into crisp electric mint recovery.",
      moves: ["Faceted gemstone wireframe", "Chromatic infrared-to-mint gradient", "Ultra-fine precision polygon facets"],
      palette: [["Pure Obsidian", "#050508"], ["Infrared", "#FF0844"], ["Solar Orange", "#FFB199"], ["Electric Mint", "#00F2FE"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Refractive jewel loop", "Vibe": "Luxury Athletic & Edgy", "ScaleAt16px": "Sharp faceted diamond"},
      evenGrid: ".....##.....\n...######...\n.##########.\n.##########.\n.##..##..##.\n..##.##.##..\n...######...\n....####....\n.....##.....\n............\n............\n............",
      svg: () => `
<defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g fill="none" stroke="#00FF66" stroke-width="36" stroke-linejoin="round"><polygon points="512,180 844,512 512,844 180,512"/><polygon points="512,360 620,460 512,560 404,460"/><line x1="512" y1="180" x2="512" y2="360"/><line x1="844" y1="512" x2="620" y2="460"/><line x1="512" y1="844" x2="512" y2="560"/><line x1="180" y1="512" x2="404" y2="460"/></g>
      `,
    },
    {
      id: "collimator-cross", n: 36, group: "hud", name: "Collimator Crosshair", prefers: "dark", round: 1,
      tagline: "Precision HUD sighting circle with digital degree ticks and center laser dot",
      concept: "A heads-up targeting collimator with four radial tick brackets and micro-hash degree markers. Instantly evokes fighter jet HUDs and AR smart glasses telemetry.",
      moves: ["Collimator sighting geometry", "Micro degree hash ticks", "G2 phosphor green calibration"],
      palette: [["OLED Dark", "#020703"], ["HUD Green", "#00FF66"], ["Telematic White", "#FFFFFF"], ["Glass Tint", "#051A0B"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Collimator gun sight", "Vibe": "Military AR & Precision", "ScaleAt16px": "Crisp crosshair"},
      evenGrid: ".....##.....\n.....##.....\n..#..##..#..\n...#....#...\n....#..#....\n#####..#####\n#####..#####\n....#..#....\n...#....#...\n..#..##..#..\n.....##.....\n.....##.....",
      svg: () => `
<defs><linearGradient id="bg_col" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041208"/><stop offset="1" stop-color="#010402"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_col)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32" stroke-dasharray="140 40"/>
        <line x1="512" y1="130" x2="512" y2="320" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <line x1="512" y1="704" x2="512" y2="894" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <line x1="130" y1="512" x2="320" y2="512" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <line x1="704" y1="512" x2="894" y2="512" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><line x1="512" y1="130" x2="512" y2="320" stroke="#00FF66" stroke-width="44"/><line x1="512" y1="704" x2="512" y2="894" stroke="#00FF66" stroke-width="44"/><line x1="130" y1="512" x2="320" y2="512" stroke="#00FF66" stroke-width="44"/><line x1="704" y1="512" x2="894" y2="512" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "telemetry-vector", n: 37, group: "hud", name: "Telemetry Compass", prefers: "dark", round: 1,
      tagline: "Angular heads-up vector showing current bearing, pace, and heart rate",
      concept: "An angular navigational chevron framed inside a telemetry ring with directional tick markers. Represents moving purposefully along your workout route.",
      moves: ["Triangular directional chevron", "Concentric compass ticks", "Laser cyan navigation"],
      palette: [["Night Sky", "#0A0E1A"], ["Vector Cyan", "#38BDF8"], ["Core White", "#FFFFFF"], ["Deep Navy", "#1E293B"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "HUD telemetry compass", "Vibe": "Navigational & Direct", "ScaleAt16px": "Distinct upward arrow"},
      evenGrid: ".....##.....\n....####....\n...######...\n..##.##.##..\n.##..##..##.\n##...##...##\n.....##.....\n.....##.....\n.....##.....\n....####....\n.....##.....\n............",
      svg: () => `
<defs><linearGradient id="bg_tel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_tel)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#1E293B" stroke-width="48"/>
        <polygon points="512,220 740,680 512,580 284,680" fill="#38BDF8"/>
        <circle cx="512" cy="512" r="36" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="44"/><polygon points="512,220 740,680 512,580 284,680" fill="#00FF66"/><circle cx="512" cy="512" r="32" fill="#000"/>
      `,
    },
    {
      id: "rangefinder-arc", n: 38, group: "hud", name: "Rangefinder Bracket", prefers: "dark", round: 1,
      tagline: "Optical HUD corner brackets framing a live performance reticle",
      concept: "Four precision optical corner brackets that frame a central performance gauge. Emulates looking through smart glasses as biometric data locks onto your field of view.",
      moves: ["Four corner framing brackets", "Central segmented speed ring", "G2 phosphor green aesthetic"],
      palette: [["Obsidian Void", "#030604"], ["Phosphor Green", "#22C55E"], ["Telemetry Pale", "#86EFAC"], ["Frame Dark", "#14532D"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Optical viewfinder brackets", "Vibe": "Targeted & Immersive", "ScaleAt16px": "Boxed crosshair"},
      evenGrid: ".###....###.\n.#........#.\n.#........#.\n............\n............\n....####....\n....####....\n............\n............\n.#........#.\n.#........#.\n.###....###.",
      svg: () => `
<defs><linearGradient id="bg_rng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041208"/><stop offset="1" stop-color="#010402"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rng)"/>
        <!-- 4 Corner Brackets -->
        <g stroke="#22C55E" stroke-width="54" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 220 340 L 220 220 L 340 220"/>
          <path d="M 804 340 L 804 220 L 684 220"/>
          <path d="M 220 684 L 220 804 L 340 804"/>
          <path d="M 804 684 L 804 804 L 684 804"/>
        </g>
        <circle cx="512" cy="512" r="180" fill="none" stroke="#86EFAC" stroke-width="44"/>
        <circle cx="512" cy="512" r="54" fill="#22C55E"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="54" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M 220 340 L 220 220 L 340 220"/><path d="M 804 340 L 804 220 L 684 220"/><path d="M 220 684 L 220 804 L 340 804"/><path d="M 804 684 L 804 804 L 684 804"/></g><circle cx="512" cy="512" r="180" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "polarizer-ring", n: 39, group: "hud", name: "Polarized Lens Ring", prefers: "dark", round: 1,
      tagline: "Dual concentric optical rings showing polarized sports glass glare filter",
      concept: "Inspired by high-performance eyewear optics (Oakley Prizm / Smith ChromaPop): twin concentric polarizer rings with 45-degree micro-refraction louvers.",
      moves: ["Dual optical polarizer circles", "Internal refraction slats", "Infrared-to-amber optical shift"],
      palette: [["Midnight Glass", "#0B0C10"], ["Solar Amber", "#F59E0B"], ["Infrared Ruby", "#E11D48"], ["Lens Rim", "#374151"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Polarized sports eyewear", "Vibe": "Optometric & Crisp", "ScaleAt16px": "Dual concentric lens"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#...#..#...#\n#..######..#\n#..######..#\n#...#..#...#\n.#...##...#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_pol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></linearGradient>
          <linearGradient id="g_pol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E11D48"/><stop offset="1" stop-color="#F59E0B"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_pol)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#374151" stroke-width="44"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="url(#g_pol)" stroke-width="72"/>
        <line x1="320" y1="512" x2="704" y2="512" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="64" fill="#F59E0B"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="40"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="64"/><line x1="320" y1="512" x2="704" y2="512" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "hud-horizon", n: 40, group: "hud", name: "HUD Pitch Horizon", prefers: "dark", round: 1,
      tagline: "Flight-HUD pitch & roll horizon line combined with cadence level indicator",
      concept: "An aviation-inspired heads-up attitude indicator: a circular reticle with a stepped pitch ladder and roll horizon line, visualizing perfect athletic posture and balance.",
      moves: ["Circular HUD outer dial", "Stepped pitch ladder bars", "Central flight pip in electric cyan"],
      palette: [["Deep Cockpit", "#070A12"], ["Cyan Avionics", "#06B6D4"], ["Phosphor Sky", "#38BDF8"], ["Ground Navy", "#1E293B"]],
      facts: {"Family": "HUD & Optics", "Metaphor": "Flight attitude indicator", "Vibe": "Aviation HUD & Stability", "ScaleAt16px": "Ladder in circle"},
      evenGrid: "............\n....####....\n............\n...######...\n............\n###......###\n###..##..###\n............\n...######...\n............\n....####....\n............",
      svg: () => `
<defs><linearGradient id="bg_hor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1120"/><stop offset="1" stop-color="#020408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_hor)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#1E293B" stroke-width="36"/>
        <!-- Horizon Wings -->
        <line x1="200" y1="512" x2="380" y2="512" stroke="#06B6D4" stroke-width="54" stroke-linecap="round"/>
        <line x1="644" y1="512" x2="824" y2="512" stroke="#06B6D4" stroke-width="54" stroke-linecap="round"/>
        <!-- Pitch Ladder -->
        <line x1="420" y1="360" x2="604" y2="360" stroke="#38BDF8" stroke-width="36" stroke-linecap="round"/>
        <line x1="420" y1="664" x2="604" y2="664" stroke="#38BDF8" stroke-width="36" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><line x1="200" y1="512" x2="380" y2="512" stroke="#00FF66" stroke-width="48"/><line x1="644" y1="512" x2="824" y2="512" stroke="#00FF66" stroke-width="48"/><line x1="420" y1="360" x2="604" y2="360" stroke="#00FF66" stroke-width="32"/><line x1="420" y1="664" x2="604" y2="664" stroke="#00FF66" stroke-width="32"/><circle cx="512" cy="512" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "barbell-vector", n: 41, group: "strength", name: "Barbell Vector", prefers: "dark", round: 1,
      tagline: "Minimalist Olympic bar with weighted endplates curving into a momentum arc",
      concept: "Reinterprets the traditional barbell without clipart clumsiness: a precision steel bar whose weight plates transition fluidly into a dynamic circular kinetic loop.",
      moves: ["Steel shaft baseline with knurl ticks", "Sculptural round bumper plates", "Kinetic velocity follow-through arc"],
      palette: [["Gunmetal", "#18181B"], ["Competition Gold", "#EAB308"], ["Olympic Red", "#DC2626"], ["Steel Gray", "#4B5563"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Olympic barbell & Kinetic lift", "Vibe": "Grounded & Heavy", "ScaleAt16px": "Distinct weighted bar"},
      evenGrid: "............\n............\n.##......##.\n.##......##.\n.##.####.##.\n.##########.\n.##########.\n.##.####.##.\n.##......##.\n.##......##.\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_bb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_bb)"/>
        <!-- Curved momentum loop behind -->
        <path d="M 280 720 A 320 320 0 1 1 744 720" fill="none" stroke="#DC2626" stroke-width="48" opacity="0.4"/>
        <!-- Central Bar -->
        <rect x="220" y="488" width="584" height="48" rx="24" fill="#EAB308"/>
        <!-- Bumper Plates (Left & Right) -->
        <rect x="180" y="340" width="64" height="344" rx="28" fill="#EAB308"/>
        <rect x="120" y="380" width="48" height="264" rx="20" fill="#DC2626"/>
        <rect x="780" y="340" width="64" height="344" rx="28" fill="#EAB308"/>
        <rect x="856" y="380" width="48" height="264" rx="20" fill="#DC2626"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="220" y="488" width="584" height="48" rx="24" fill="#00FF66"/><rect x="180" y="340" width="64" height="344" rx="28" fill="#00FF66"/><rect x="120" y="380" width="48" height="264" rx="20" fill="#00FF66"/><rect x="780" y="340" width="64" height="344" rx="28" fill="#00FF66"/><rect x="856" y="380" width="48" height="264" rx="20" fill="#00FF66"/>
      `,
    },
    {
      id: "olympic-plate", n: 42, group: "strength", name: "Olympic Hex Plate", prefers: "dark", round: 1,
      tagline: "Heavy cast-iron 45lb plate with triple handgrip cutouts and knurled ring",
      concept: "An iconic 45-pound Olympic bumper plate with 3 ergonomic radial grip holes. Celebrates the tactile iron of strength training and powerlifting.",
      moves: ["Heavy circular outer plate rim", "Three 120-degree handgrip cutouts", "Central 2-inch Olympic hub sleeve"],
      palette: [["Matte Iron", "#121417"], ["Safety Orange", "#EA580C"], ["Machined Steel", "#94A3B8"], ["Black Oxide", "#1E293B"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Cast iron 45lb plate", "Vibe": "Heavyweight & Industrial", "ScaleAt16px": "Clear 3-hole disc"},
      evenGrid: "...######...\n..########..\n.##..##..##.\n.##......##.\n.##..##..##.\n.####..####.\n.####..####.\n.##..##..##.\n.##......##.\n..########..\n...######...\n............",
      svg: () => `
<defs><linearGradient id="bg_pl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171C"/><stop offset="1" stop-color="#060709"/></linearGradient></defs>
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
        <circle cx="512" cy="512" r="44" fill="#94A3B8"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="380" fill="none" stroke="#00FF66" stroke-width="64"/><g fill="#000" stroke="#00FF66" stroke-width="20"><rect x="440" y="220" width="144" height="64" rx="32"/><rect x="440" y="220" width="144" height="64" rx="32" transform="rotate(120 512 512)"/><rect x="440" y="220" width="144" height="64" rx="32" transform="rotate(240 512 512)"/></g><circle cx="512" cy="512" r="80" fill="none" stroke="#00FF66" stroke-width="32"/><circle cx="512" cy="512" r="36" fill="#00FF66"/>
      `,
    },
    {
      id: "kettlebell-arc", n: 43, group: "strength", name: "Kettlebell Arc", prefers: "dark", round: 1,
      tagline: "Dynamic kettlebell swing trajectory tracing a high-velocity parabolic loop",
      concept: "Captures the fluid ballistic power of a Russian kettlebell swing: an explosive parabolic loop launched from the hips to eye level.",
      moves: ["Curved ballistic trajectory trail", "Geometric cast-iron bell silhouette", "High-velocity amber burn"],
      palette: [["Pitch Black", "#0A0A0A"], ["Cast Ember", "#F97316"], ["Iron Slate", "#374151"], ["Chalk White", "#FFFFFF"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Ballistic kettlebell swing", "Vibe": "Explosive & Kinetic", "ScaleAt16px": "Distinct bell on loop"},
      evenGrid: "......##....\n.....####...\n.....#..#...\n....######..\n...########.\n...########.\n....######..\n...#........\n..#.........\n.#..........\n#...........\n............",
      svg: () => `
<defs><linearGradient id="bg_kb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141113"/><stop offset="1" stop-color="#050405"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_kb)"/>
        <!-- Swing Parabolic Arc -->
        <path d="M 240 760 C 240 380 480 240 740 380" fill="none" stroke="#F97316" stroke-width="72" stroke-linecap="round" stroke-dasharray="600 80"/>
        <!-- Kettlebell at Apex -->
        <g transform="translate(680, 420)">
          <!-- Handle -->
          <rect x="-80" y="-120" width="160" height="110" rx="40" fill="none" stroke="#FFFFFF" stroke-width="36"/>
          <!-- Body -->
          <circle cx="0" cy="40" r="120" fill="#F97316"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 240 760 C 240 380 480 240 740 380" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><g transform="translate(680, 420)"><rect x="-80" y="-120" width="160" height="110" rx="40" fill="none" stroke="#00FF66" stroke-width="32"/><circle cx="0" cy="40" r="110" fill="#00FF66"/></g>
      `,
    },
    {
      id: "knurl-diamond", n: 44, group: "strength", name: "Knurled Diamond", prefers: "dark", round: 1,
      tagline: "Laser-etched diamond knurling pattern from a competition powerlifting bar",
      concept: "The unmistakable diamond crosshatch pattern etched into steel bars for grip security. Turned into an iconic geometric diamond badge.",
      moves: ["Precision 60-degree crosshatch lattice", "Diamond boundary frame", "Competition chrome & gold"],
      palette: [["Steel Black", "#0B0F14"], ["Knurl Gold", "#EAB308"], ["Industrial Steel", "#64748B"], ["Grip White", "#FFFFFF"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Barbell knurling texture", "Vibe": "Tactile & Precision-machined", "ScaleAt16px": "Crisp diamond grid"},
      evenGrid: ".....##.....\n....####....\n...##..##...\n..##.##.##..\n.##..##..##.\n##.######.##\n##.######.##\n.##..##..##.\n..##.##.##..\n...##..##...\n....####....\n.....##.....",
      svg: () => `
<defs><linearGradient id="bg_knr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
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
        <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 844,512 512,844 180,512" fill="none" stroke="#00FF66" stroke-width="54"/><g stroke="#00FF66" stroke-width="32"><line x1="340" y1="348" x2="684" y2="676"/><line x1="684" y1="348" x2="340" y2="676"/></g><circle cx="512" cy="512" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "torque-twist", n: 45, group: "strength", name: "Power Torque", prefers: "dark", round: 1,
      tagline: "Dual helical torsion bars twisting under maximum athletic muscular torque",
      concept: "Visualizes mechanical torque and rotational power generation from the hips during sprinting, throwing, and heavy squatting.",
      moves: ["Dual interlocking spiral helices", "Tapered dynamic compression strokes", "Fiery crimson-to-orange gradient"],
      palette: [["Dark Void", "#0A0A0A"], ["Torque Red", "#EF4444"], ["Blaze Orange", "#F97316"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Rotational torque", "Vibe": "Aggressive & Dynamic", "ScaleAt16px": "Tight powerful coil"},
      evenGrid: "....####....\n..##....##..\n.#........#.\n#..######..#\n#.#......#.#\n#.#..##..#.#\n#.#..##..#.#\n#.#......#.#\n#..######..#\n.#........#.\n..##....##..\n....####....",
      svg: () => `
<defs>
          <linearGradient id="bg_trq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140B0B"/><stop offset="1" stop-color="#030202"/></linearGradient>
          <linearGradient id="g_trq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EF4444"/><stop offset="1" stop-color="#F97316"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_trq)"/>
        <g stroke="url(#g_trq)" stroke-width="88" fill="none" stroke-linecap="round">
          <path d="M 280 340 C 440 180 680 240 740 440 C 780 580 640 760 480 780 C 340 800 240 680 320 540 C 380 440 540 420 620 500"/>
        </g>
        <circle cx="620" cy="500" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 340 C 440 180 680 240 740 440 C 780 580 640 760 480 780 C 340 800 240 680 320 540 C 380 440 540 420 620 500" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/><circle cx="620" cy="500" r="38" fill="#00FF66"/>
      `,
    },
    {
      id: "iron-crest", n: 46, group: "strength", name: "Iron Forge Crest", prefers: "dark", round: 1,
      tagline: "Brutalist geometric barbell shield forged in matte graphite and safety yellow",
      concept: "A heraldic athletic crest formed by geometric iron plates and an upward apex, honoring the lifelong pursuit of strength.",
      moves: ["Shield crest boundary geometry", "Stacked angular iron plates", "High-contrast safety yellow accents"],
      palette: [["Graphite Iron", "#18181B"], ["Safety Yellow", "#EAB308"], ["Chalk Gray", "#A1A1AA"], ["Black Coal", "#09090B"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Forged iron crest", "Vibe": "Heavy & Unshakable", "ScaleAt16px": "Solid shield"},
      evenGrid: ".##########.\n.##########.\n.#..####..#.\n.#.######.#.\n.#.######.#.\n.##.####.##.\n..##....##..\n...##..##...\n....####....\n.....##.....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_crst" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#09090B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_crst)"/>
        <!-- Shield Path -->
        <path d="M 260 220 L 764 220 L 764 540 C 764 720 512 844 512 844 C 512 844 260 720 260 540 Z" fill="#27272A" stroke="#EAB308" stroke-width="48" stroke-linejoin="round"/>
        <!-- Internal Barbell Geometry -->
        <rect x="360" y="472" width="304" height="48" rx="24" fill="#FFFFFF"/>
        <rect x="320" y="380" width="64" height="232" rx="20" fill="#EAB308"/>
        <rect x="640" y="380" width="64" height="232" rx="20" fill="#EAB308"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 260 220 L 764 220 L 764 540 C 764 720 512 844 512 844 C 512 720 260 540 Z" fill="none" stroke="#00FF66" stroke-width="54" stroke-linejoin="round"/><rect x="360" y="472" width="304" height="48" rx="24" fill="#00FF66"/><rect x="320" y="380" width="64" height="232" rx="20" fill="#00FF66"/><rect x="640" y="380" width="64" height="232" rx="20" fill="#00FF66"/>
      `,
    },
    {
      id: "deadlift-grip", n: 47, group: "strength", name: "Hook Grip Lock", prefers: "dark", round: 1,
      tagline: "Clean anatomical hook grip locking thumb around the bar in clean geometry",
      concept: "The hook grip is the ultimate connection between the human hand and heavy iron. Two overlapping geometric loops lock tight around a circular bar.",
      moves: ["Interlocking thumb & finger loops", "Central circular bar section", "Tactical chalk and crimson"],
      palette: [["Dark Gym", "#0D0E12"], ["Grip Coral", "#FF5E3A"], ["Chalk White", "#FFFFFF"], ["Steel", "#334155"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Hook grip lock", "Vibe": "Anatomical & Unbreakable", "ScaleAt16px": "Distinct interlocking clasp"},
      evenGrid: "...####.....\n..######....\n.##....##...\n.##.##.##...\n.##.##.##...\n..######....\n...####.##..\n..######.##.\n.##....####.\n.##....####.\n..######....\n...####.....",
      svg: () => `
<defs><linearGradient id="bg_grp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11131A"/><stop offset="1" stop-color="#050608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_grp)"/>
        <!-- The Barbell Center -->
        <circle cx="512" cy="512" r="160" fill="#334155" stroke="#FFFFFF" stroke-width="24"/>
        <!-- Thumb Hook (Left Loop) -->
        <path d="M 240 680 C 240 440 380 340 512 340 C 640 340 680 440 680 540" fill="none" stroke="#FF5E3A" stroke-width="84" stroke-linecap="round"/>
        <!-- Fingers Lock (Overhead Loop) -->
        <path d="M 740 360 C 740 600 600 700 480 700 C 380 700 340 620 340 540" fill="none" stroke="#FFFFFF" stroke-width="84" stroke-linecap="round"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="150" fill="none" stroke="#00FF66" stroke-width="32"/><path d="M 240 680 C 240 440 380 340 512 340 C 640 340 680 440 680 540" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round"/><path d="M 740 360 C 740 600 600 700 480 700 C 380 700 340 620 340 540" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round"/>
      `,
    },
    {
      id: "kinetic-anvil", n: 48, group: "strength", name: "Kinetic Anvil", prefers: "dark", round: 1,
      tagline: "Heavy triangular power anvil representing foundational core strength and stability",
      concept: "A monumental triangular base with a stepped anvil horn, symbolizing immovable athletic base stability, posture, and core power.",
      moves: ["Solid triangular foundational geometry", "Machined horizontal surface plate", "High-contrast Volt and charcoal"],
      palette: [["Dark Basalt", "#121316"], ["Volt Power", "#A3E635"], ["Machined Steel", "#CBD5E1"], ["Deep Graphite", "#1F2937"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Forging anvil & Core stability", "Vibe": "Monumental & Solid", "ScaleAt16px": "Crisp wide pyramid"},
      evenGrid: ".##########.\n.##########.\n...######...\n....####....\n....####....\n...######...\n..########..\n.##########.\n.##########.\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_anv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171E"/><stop offset="1" stop-color="#07080A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_anv)"/>
        <polygon points="512,200 820,780 204,780" fill="none" stroke="#A3E635" stroke-width="72" stroke-linejoin="round"/>
        <line x1="280" y1="620" x2="744" y2="620" stroke="#CBD5E1" stroke-width="48" stroke-linecap="round"/>
        <circle cx="512" cy="460" r="64" fill="#A3E635"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><polygon points="512,200 820,780 204,780" fill="none" stroke="#00FF66" stroke-width="64" stroke-linejoin="round"/><line x1="280" y1="620" x2="744" y2="620" stroke="#00FF66" stroke-width="44" stroke-linecap="round"/><circle cx="512" cy="460" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "plate-stack", n: 49, group: "strength", name: "Weight Stack", prefers: "dark", round: 1,
      tagline: "Graduated selectorized weight stack with magnetic pin indicator",
      concept: "Inspired by cable gym machines: five horizontal weight plates stacked in graduated rhythm, with a single bright pin selecting today's target load.",
      moves: ["Five horizontal precision plates", "Selector pin bright contrast dot", "High-tech gym machinery feel"],
      palette: [["Gym Dark", "#0F1115"], ["Selector Pin", "#EF4444"], ["Iron Plate", "#374151"], ["Chalk White", "#F8FAFC"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Selectorized weight stack", "Vibe": "Analytical & Progressive", "ScaleAt16px": "Distinct plate ladder"},
      evenGrid: ".##########.\n.##########.\n............\n.##########.\n.####..####.\n.##########.\n............\n.##########.\n.##########.\n............\n.##########.\n.##########.",
      svg: () => `
<defs><linearGradient id="bg_stk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11141B"/><stop offset="1" stop-color="#040507"/></linearGradient></defs>
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
        <circle cx="512" cy="516" r="44" fill="#EF4444"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><line x1="380" y1="160" x2="380" y2="864" stroke="#00FF66" stroke-width="20"/><line x1="644" y1="160" x2="644" y2="864" stroke="#00FF66" stroke-width="20"/><rect x="260" y="260" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/><rect x="260" y="370" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/><rect x="260" y="480" width="504" height="72" rx="16" fill="#00FF66"/><rect x="260" y="590" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/><rect x="260" y="700" width="504" height="72" rx="16" fill="none" stroke="#00FF66" stroke-width="16"/>
      `,
    },
    {
      id: "chalk-burst", n: 50, group: "strength", name: "Chalk Cloud", prefers: "dark", round: 1,
      tagline: "Athletic palm chalk burst radiating inside a clean circular power ring",
      concept: "The ritual of chalking hands before a PR lift: dynamic powder rays exploding outward inside a clean circular containment boundary.",
      moves: ["Radial powder burst rays", "Circular containment ring", "Chalk white on volcanic obsidian"],
      palette: [["Volcanic Charcoal", "#121214"], ["Pure Chalk", "#FFFFFF"], ["Safety Ember", "#F97316"], ["Ash Gray", "#52525B"]],
      facts: {"Family": "Athletic Strength", "Metaphor": "Lifting chalk burst", "Vibe": "Visceral & Gritty", "ScaleAt16px": "Bright star in ring"},
      evenGrid: "...######...\n..#..##..#..\n.#...##...#.\n#....##....#\n#..######..#\n##.######.##\n##.######.##\n#..######..#\n#....##....#\n.#...##...#.\n..#..##..#..\n...######...",
      svg: () => `
<defs><linearGradient id="bg_chk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#18181B"/><stop offset="1" stop-color="#08080A"/></linearGradient></defs>
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
        <circle cx="512" cy="512" r="72" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="44"/><g stroke="#00FF66" stroke-width="40" stroke-linecap="round"><line x1="512" y1="240" x2="512" y2="340"/><line x1="512" y1="684" x2="512" y2="784"/><line x1="240" y1="512" x2="340" y2="512"/><line x1="684" y1="512" x2="784" y2="512"/><line x1="320" y1="320" x2="390" y2="390"/><line x1="634" y1="634" x2="704" y2="704"/><line x1="320" y1="704" x2="390" y2="634"/><line x1="634" y1="390" x2="704" y2="320"/></g><circle cx="512" cy="512" r="64" fill="#00FF66"/>
      `,
    },
    {
      id: "pace-ribbon", n: 51, group: "speed", name: "Pace Ribbon", prefers: "dark", round: 1,
      tagline: "Sweeping aerodynamic ribbon flowing in high-speed wind-tunnel slipstream",
      concept: "Flows like technical silk in a 40mph aerodynamic wind tunnel: a continuous sinuous ribbon that folds forward, symbolizing pacing and distance endurance.",
      moves: ["Aerodynamic wind-tunnel ribbon", "Dual-tone gradient fold", "Endurance racing teal"],
      palette: [["Midnight Void", "#06131A"], ["Slipstream Teal", "#00F2FE"], ["Aero Cyan", "#4FACFE"], ["Dark Water", "#022C3A"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Wind tunnel airflow", "Vibe": "Fluid & Weightless", "ScaleAt16px": "Distinct fluid curve"},
      evenGrid: "............\n....####....\n..########..\n.##......##.\n.##..##..##.\n..####.####.\n...##..##...\n.####.####..\n.##..##..##.\n.##......##.\n..########..\n....####....",
      svg: () => `
<defs>
          <linearGradient id="bg_pce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041822"/><stop offset="1" stop-color="#01070A"/></linearGradient>
          <linearGradient id="g_pce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00F2FE"/><stop offset="1" stop-color="#4FACFE"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_pce)"/>
        <path d="M 180 620 C 320 620 380 340 540 340 C 700 340 760 520 844 520 L 780 680 C 660 680 600 480 480 480 C 340 480 300 780 180 780 Z" fill="url(#g_pce)"/>
        <circle cx="844" cy="520" r="36" fill="#00F2FE"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 180 620 C 320 620 380 340 540 340 C 700 340 760 520 844 520 L 780 680 C 660 680 600 480 480 480 C 340 480 300 780 180 780 Z" fill="#00FF66"/>
      `,
    },
    {
      id: "velocity-chevron", n: 52, group: "speed", name: "Velocity Chevron", prefers: "dark", round: 1,
      tagline: "Triple forward-pointing aerodynamic chevrons breaking wind resistance",
      concept: "Military and cycling velocity marks: three nested 60-degree aerodynamic speed chevrons cutting forward with increasing stroke weight.",
      moves: ["Triple forward-raked chevrons", "Graduated speed spacing", "Safety fluorescent orange"],
      palette: [["Night Carbon", "#0D0F14"], ["Safety Orange", "#FF512F"], ["Solar Ember", "#F09819"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Forward speed chevrons", "Vibe": "Fast & Directional", "ScaleAt16px": "Sharp nested arrows"},
      evenGrid: "..##....##..\n...##....##.\n....##....##\n.....##....#\n......##...#\n.......##..#\n......##...#\n.....##....#\n....##....##\n...##....##.\n..##....##..\n............",
      svg: () => `
<defs><linearGradient id="bg_vel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141118"/><stop offset="1" stop-color="#050406"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_vel)"/>
        <g stroke-linecap="round" stroke-linejoin="round" fill="none">
          <path d="M 280 260 L 580 512 L 280 764" stroke="#F09819" stroke-width="84"/>
          <path d="M 460 260 L 760 512 L 460 764" stroke="#FF512F" stroke-width="84"/>
        </g>
        <circle cx="760" cy="512" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="#00FF66"><path d="M 280 260 L 580 512 L 280 764" stroke-width="72"/><path d="M 460 260 L 760 512 L 460 764" stroke-width="72"/></g><circle cx="760" cy="512" r="36" fill="#00FF66"/>
      `,
    },
    {
      id: "wind-tunnel", n: 53, group: "speed", name: "Airfoil Loop", prefers: "dark", round: 1,
      tagline: "Streamlined NACA teardrop cross-section minimizing athletic air resistance",
      concept: "Based on the classic NACA 0012 airfoil teardrop profile: curves around in a circular aerodynamic loop with zero drag.",
      moves: ["NACA aerodynamic airfoil teardrop", "Closed streamline loop", "Time-trial chrome and neon"],
      palette: [["Aero Black", "#0B0D12"], ["Aero Neon", "#22C55E"], ["Chrome Slate", "#64748B"], ["Ice White", "#F8FAFC"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "NACA teardrop airfoil", "Vibe": "Wind-tunnel engineered", "ScaleAt16px": "Distinct aerodynamic teardrop"},
      evenGrid: "............\n...######...\n..########..\n.##########.\n.##########.\n.##..##..##.\n..#..##..#..\n...######...\n....####....\n.....##.....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_aero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_aero)"/>
        <path d="M 760 512 C 760 680 620 800 460 800 C 300 800 220 680 220 512 C 220 344 300 224 460 224 C 620 224 760 344 760 512 Z" fill="none" stroke="#22C55E" stroke-width="96"/>
        <path d="M 460 360 C 560 360 620 440 620 512 C 620 584 560 664 460 664 C 360 664 340 584 340 512 C 340 440 360 360 460 360 Z" fill="#64748B"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 760 512 C 760 680 620 800 460 800 C 300 800 220 680 220 512 C 220 344 300 224 460 224 C 620 224 760 344 760 512 Z" fill="none" stroke="#00FF66" stroke-width="84"/>
      `,
    },
    {
      id: "stride-wave", n: 54, group: "speed", name: "Stride Sine Wave", prefers: "dark", round: 1,
      tagline: "Vertical oscillation sine wave of a runner maintaining 180 SPM cadence",
      concept: "Every elite runner knows the rhythm of vertical oscillation. This sine wave loop captures the harmonic bounce and rebound of elastic tendon energy.",
      moves: ["Harmonic sinusoidal wave", "Circular containment boundary", "Electric energy gradient"],
      palette: [["Night Navy", "#080C16"], ["Stride Volt", "#84CC16"], ["Cyan Rebound", "#06B6D4"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Cadence sine wave", "Vibe": "Rhythmic & Elastic", "ScaleAt16px": "Distinct wave in ring"},
      evenGrid: "............\n...##.......\n..#..#......\n.#....#.....\n#......#...#\n........#.#.\n.........#..\n............\n............\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_str" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1324"/><stop offset="1" stop-color="#02050B"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_str)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#1E293B" stroke-width="44"/>
        <path d="M 180 512 Q 346 180 512 512 T 844 512" fill="none" stroke="#84CC16" stroke-width="88" stroke-linecap="round"/>
        <circle cx="346" cy="346" r="44" fill="#06B6D4"/>
        <circle cx="678" cy="678" r="44" fill="#06B6D4"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="40"/><path d="M 180 512 Q 346 180 512 512 T 844 512" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/>
      `,
    },
    {
      id: "drafting-tail", n: 55, group: "speed", name: "Slipstream Vortex", prefers: "dark", round: 1,
      tagline: "Twin counter-rotating aerodynamic vortex tails behind a cyclist in the drops",
      concept: "The spiraling aerodynamic vortices trailing an athlete in motion: two intertwined vortex tails curling inward in optimal drafting efficiency.",
      moves: ["Twin counter-rotating spiral tails", "Hydrodynamic teardrop convergence", "Cobalt and cyan slipstream"],
      palette: [["Aero Void", "#070E18"], ["Vortex Cyan", "#38BDF8"], ["Cobalt Speed", "#2563EB"], ["Deep Sea", "#031E33"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Aerodynamic slipstream vortex", "Vibe": "Hydrodynamic & Fast", "ScaleAt16px": "Interlocking tail swirl"},
      evenGrid: "...####.....\n..######....\n.##....##...\n.##.##.##...\n..######....\n...####.....\n.....####...\n....######..\n...##.##.##.\n...##....##.\n....######..\n.....####...",
      svg: () => `
<defs><linearGradient id="bg_vrt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1829"/><stop offset="1" stop-color="#02060C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_vrt)"/>
        <path d="M 280 280 C 440 200 680 320 680 512 C 680 680 480 760 380 660 C 280 560 380 420 512 420" fill="none" stroke="#38BDF8" stroke-width="72" stroke-linecap="round"/>
        <path d="M 744 744 C 584 824 344 704 344 512 C 344 344 544 264 644 364 C 744 464 644 604 512 604" fill="none" stroke="#2563EB" stroke-width="72" stroke-linecap="round"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 280 C 440 200 680 320 680 512 C 680 680 480 760 380 660 C 280 560 380 420 512 420" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M 744 744 C 584 824 344 704 344 512 C 344 344 544 264 644 364 C 744 464 644 604 512 604" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>
      `,
    },
    {
      id: "sprint-vector", n: 56, group: "speed", name: "Sprint Vector", prefers: "dark", round: 1,
      tagline: "45-degree forward sprint launch angle off the starting blocks",
      concept: "Captures the explosive physics of sprint acceleration: low center of mass, 45-degree forward drive angle, and maximum horizontal ground reaction force.",
      moves: ["45-degree explosive forward vector", "Staggered block starting marks", "High-contrast blaze orange"],
      palette: [["Track Black", "#111111"], ["Sprint Blaze", "#EA580C"], ["Volt Gold", "#FACC15"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Starting blocks launch angle", "Vibe": "Explosive & Urgent", "ScaleAt16px": "Punchy forward slash"},
      evenGrid: "........####\n.......#####\n......######\n.....######.\n....######..\n...######...\n..######....\n.######.....\n######......\n#####.......\n####........\n............",
      svg: () => `
<defs><linearGradient id="bg_spr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A1412"/><stop offset="1" stop-color="#080504"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_spr)"/>
        <!-- 45-degree Launch Spear -->
        <polygon points="780,244 540,244 340,640 480,640" fill="#EA580C"/>
        <!-- Block Starting Cleats -->
        <rect x="220" y="720" width="160" height="48" rx="24" fill="#FACC15"/>
        <rect x="360" y="600" width="160" height="48" rx="24" fill="#FFFFFF"/>
        <circle cx="780" cy="244" r="36" fill="#FACC15"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><polygon points="780,244 540,244 340,640 480,640" fill="#00FF66"/><rect x="220" y="720" width="160" height="48" rx="24" fill="#00FF66"/><rect x="360" y="600" width="160" height="48" rx="24" fill="#00FF66"/>
      `,
    },
    {
      id: "split-timer", n: 57, group: "speed", name: "Split Second", prefers: "dark", round: 1,
      tagline: "Digital chronograph stopwatch dial freezing a sub-4-minute milestone",
      concept: "The drama of pacing and race splits: a precision circular chronograph track with high-frequency 1/100th-second tick marks and a sweeping second-hand needle.",
      moves: ["Chronograph stopwatch bezel", "High-density split tick marks", "Crimson second hand needle"],
      palette: [["Chrono Dark", "#0F1117"], ["Split Crimson", "#EF4444"], ["Dial White", "#F8FAFC"], ["Steel Slate", "#334155"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Stopwatch chronograph dial", "Vibe": "Instrument-accurate", "ScaleAt16px": "Precision watch dial"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#....##....#\n#....##....#\n#....##.##.#\n#....##....#\n.#...##...#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_splt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#131722"/><stop offset="1" stop-color="#05060A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_splt)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#334155" stroke-width="48" stroke-dasharray="16 24"/>
        <circle cx="512" cy="512" r="280" fill="none" stroke="#F8FAFC" stroke-width="20"/>
        <!-- Needle Pointer -->
        <line x1="512" y1="512" x2="680" y2="280" stroke="#EF4444" stroke-width="36" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="54" fill="#EF4444"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="40" stroke-dasharray="20 20"/><line x1="512" y1="512" x2="680" y2="280" stroke="#00FF66" stroke-width="32" stroke-linecap="round"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "cadence-ring", n: 58, group: "speed", name: "Cadence Tachometer", prefers: "dark", round: 1,
      tagline: "Revolutions-per-minute tachometer dial optimized for cycling and running",
      concept: "A heavy automotive/athletic tachometer arc with redline zone at 90-100 RPM (ideal cycling cadence) and glowing LED segment indicators.",
      moves: ["240-degree tachometer gauge arc", "Redline peak exertion zone", "Bright LED segment styling"],
      palette: [["Cockpit Dark", "#0A0D14"], ["Redline Coral", "#FF2D55"], ["RPM Amber", "#F59E0B"], ["Dial Muted", "#1E293B"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Cadence RPM tachometer", "Vibe": "Motorsport Athletic", "ScaleAt16px": "Curved gauge"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#...#..#...#\n#..######..#\n#..######..#\n#...#..#...#\n.#........#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_cad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E131F"/><stop offset="1" stop-color="#030408"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_cad)"/>
        <!-- Safe RPM Arc -->
        <path d="M 280 740 A 340 340 0 0 1 512 172" fill="none" stroke="#F59E0B" stroke-width="88" stroke-linecap="round"/>
        <!-- Redline Arc -->
        <path d="M 512 172 A 340 340 0 0 1 744 740" fill="none" stroke="#FF2D55" stroke-width="88" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="64" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 740 A 340 340 0 0 1 512 172" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round"/><path d="M 512 172 A 340 340 0 0 1 744 740" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-dasharray="60 30"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "finish-tape", n: 59, group: "speed", name: "Finish Line Break", prefers: "dark", round: 1,
      tagline: "Taut finish tape snapping forward in triumphant chest break",
      concept: "The glorious climax of any endurance race: two halves of the snapped finish ribbon parting as the runner breaks through to victory.",
      moves: ["Snapping ribbon diagonal break", "Angular forward speed edges", "Triumphant crimson and gold"],
      palette: [["Night Stadium", "#0E0E12"], ["Finish Red", "#DC2626"], ["Victory Gold", "#FACC15"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Finish line ribbon break", "Vibe": "Triumphant & Iconic", "ScaleAt16px": "Distinct parting ribbon"},
      evenGrid: ".###........\n..###.......\n...###......\n....###.###.\n.....#####..\n....#####...\n...###.###..\n..###.......\n.###........\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_fin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16151B"/><stop offset="1" stop-color="#070609"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_fin)"/>
        <!-- Left Snapped Ribbon -->
        <path d="M 160 380 L 480 440 L 420 580 L 160 520 Z" fill="#DC2626"/>
        <!-- Right Snapped Ribbon Flyaway -->
        <path d="M 540 440 L 864 340 L 864 480 L 600 580 Z" fill="#FACC15"/>
        <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 160 380 L 480 440 L 420 580 L 160 520 Z" fill="#00FF66"/><path d="M 540 440 L 864 340 L 864 480 L 600 580 Z" fill="#00FF66"/><circle cx="512" cy="512" r="44" fill="#000"/>
      `,
    },
    {
      id: "tread-track", n: 60, group: "speed", name: "Outsole Traction", prefers: "dark", round: 1,
      tagline: "Trail-running lugged outsole tread pattern in circular traction grip",
      concept: "Grounded in trail running and muddy climbs: multi-directional lugged Chevron treads arranged in a circular traction loop.",
      moves: ["Directional trail running lugs", "Radial mud-clearing channels", "High-visibility trail Volt"],
      palette: [["Trail Basalt", "#141517"], ["Trail Volt", "#84CC16"], ["Mud Slate", "#334155"], ["Earth Charcoal", "#1E293B"]],
      facts: {"Family": "Runners & Speed", "Metaphor": "Vibram running shoe tread", "Vibe": "Rugged & High-traction", "ScaleAt16px": "Aggressive gear/tread ring"},
      evenGrid: "....####....\n.##..##..##.\n.#...##...#.\n#....##....#\n#..######..#\n#..######..#\n#....##....#\n.#...##...#.\n.##..##..##.\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_trd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#181B1F"/><stop offset="1" stop-color="#08090B"/></linearGradient></defs>
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
        <circle cx="512" cy="512" r="72" fill="#84CC16"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="320" fill="none" stroke="#00FF66" stroke-width="40"/><g fill="#00FF66"><polygon points="512,180 540,240 484,240"/><polygon points="512,844 540,784 484,784"/><polygon points="180,512 240,540 240,484"/><polygon points="844,512 784,540 784,484"/><polygon points="278,278 340,310 310,340"/><polygon points="746,746 714,684 684,714"/><polygon points="278,746 310,684 340,714"/><polygon points="746,278 684,310 714,340"/></g><circle cx="512" cy="512" r="64" fill="#00FF66"/>
      `,
    },
    {
      id: "pure-circle-dot", n: 61, group: "minimal", name: "Circle & Singularity", prefers: "dark", round: 1,
      tagline: "Ultra-pure hairline ring with an off-center solid planetary focal dot",
      concept: "The absolute extreme of reduction: a pure 24px hairline circular perimeter with a single solid focal dot stationed at the 2 o'clock position.",
      moves: ["Hairline 24px circular stroke", "Single off-center satellite dot", "High-contrast stark monochrome"],
      palette: [["Pitch Black", "#000000"], ["Off-White", "#F8FAFC"], ["Slate Line", "#334155"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Minimalism", "Metaphor": "Celestial orbit & Singularity", "Vibe": "Stark & Contemplative", "ScaleAt16px": "Distinct ring with dot"},
      evenGrid: "....####....\n..##....##..\n.#........#.\n#.....##...#\n#....####..#\n#.....##...#\n#..........#\n.#........#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#050505"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#F8FAFC" stroke-width="28"/>
        <circle cx="680" cy="344" r="72" fill="#F8FAFC"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="28"/><circle cx="680" cy="344" r="64" fill="#00FF66"/>
      `,
    },
    {
      id: "monoline-ring", n: 62, group: "minimal", name: "Monoline Balance", prefers: "dark", round: 1,
      tagline: "Continuous 24px hairline circle with a single harmonic gap at 12 o'clock",
      concept: "Swiss modernist balance: an unbroken hairline circle whose perimeter opens subtly at the apex, allowing breath and negative space to enter.",
      moves: ["Pure open circle", "Single harmonic 30-degree apex gap", "Calm Nordic slate palette"],
      palette: [["Nordic Mist", "#0E1116"], ["Nordic Slate", "#94A3B8"], ["Pure White", "#FFFFFF"], ["Deep Fjord", "#1E293B"]],
      facts: {"Family": "Minimalism", "Metaphor": "Open loop of possibility", "Vibe": "Zen & Architectural", "ScaleAt16px": "Crisp open ring"},
      evenGrid: "....#..#....\n..##....##..\n.#........#.\n#..........#\n#..........#\n#..........#\n#..........#\n.#........#.\n..##....##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_mono" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#11151C"/><stop offset="1" stop-color="#060709"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_mono)"/>
        <path d="M 570 176 A 340 340 0 1 1 454 176" fill="none" stroke="#FFFFFF" stroke-width="48" stroke-linecap="round"/>
        <circle cx="512" cy="512" r="44" fill="#94A3B8"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 570 176 A 340 340 0 1 1 454 176" fill="none" stroke="#00FF66" stroke-width="48" stroke-linecap="round"/><circle cx="512" cy="512" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "bauhaus-quadrant", n: 63, group: "minimal", name: "Bauhaus Quadrant", prefers: "dark", round: 1,
      tagline: "Four geometric primitives (circle, triangle, arc, square) in primary harmony",
      concept: "Inspired by the Weimar Bauhaus and Kandinsky: a quadrant division uniting the circle (loop), square (foundation), and triangle (forward velocity).",
      moves: ["Four foundational Bauhaus shapes", "Primary color palette (Red, Yellow, Blue)", "Strict geometric proportions"],
      palette: [["Pure Black", "#000000"], ["Bauhaus Red", "#DC2626"], ["Bauhaus Yellow", "#FACC15"], ["Bauhaus Blue", "#2563EB"]],
      facts: {"Family": "Minimalism", "Metaphor": "Bauhaus geometric primitives", "Vibe": "Art-school Classic", "ScaleAt16px": "Four bold color blocks"},
      evenGrid: ".####..####.\n.####...##..\n.####..####.\n............\n..##...####.\n.####..####.\n.####..####.\n............\n............\n............\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#0A0A0A"/>
        <!-- Top Left Circle -->
        <circle cx="360" cy="360" r="140" fill="#DC2626"/>
        <!-- Top Right Triangle -->
        <polygon points="664,220 780,480 548,480" fill="#FACC15"/>
        <!-- Bottom Left Arc Loop -->
        <path d="M 220 664 A 140 140 0 0 0 500 664 Z" fill="#2563EB"/>
        <!-- Bottom Right Square -->
        <rect x="548" y="548" width="232" height="232" rx="16" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="360" cy="360" r="140" fill="#00FF66"/><polygon points="664,220 780,480 548,480" fill="none" stroke="#00FF66" stroke-width="24"/><path d="M 220 664 A 140 140 0 0 0 500 664 Z" fill="#00FF66"/><rect x="548" y="548" width="232" height="232" fill="none" stroke="#00FF66" stroke-width="24"/>
      `,
    },
    {
      id: "rams-ten", n: 64, group: "minimal", name: "Dieter Rams Dial", prefers: "dark", round: 1,
      tagline: "Functionalist matte gray circular casing with a single tactile orange indicator",
      concept: "Channeling Dieter Rams' 'Ten Principles of Good Design' (Braun TP 1 / T 1000): an understated circular dial with a single tactile orange index dot.",
      moves: ["Matte aluminum circular bezel", "Tactile single orange index dot", "Absolute absence of decoration"],
      palette: [["Braun Gray", "#1F2124"], ["Rams Orange", "#FF5500"], ["Aluminum", "#9CA3AF"], ["Soft Black", "#111214"]],
      facts: {"Family": "Minimalism", "Metaphor": "Braun functionalist dial", "Vibe": "Timeless & Functional", "ScaleAt16px": "Crisp gray disc with orange dot"},
      evenGrid: "...######...\n..########..\n.##..##..##.\n.##..##..##.\n.##########.\n.##########.\n.##..##..##.\n.##..##..##.\n..########..\n...######...\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_rams" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#24272C"/><stop offset="1" stop-color="#0F1012"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rams)"/>
        <circle cx="512" cy="512" r="360" fill="#181A1D" stroke="#9CA3AF" stroke-width="24"/>
        <circle cx="512" cy="512" r="280" fill="none" stroke="#374151" stroke-width="16"/>
        <circle cx="512" cy="240" r="48" fill="#FF5500"/>
        <circle cx="512" cy="512" r="64" fill="#9CA3AF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="32"/><circle cx="512" cy="240" r="48" fill="#00FF66"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "swiss-crosshair", n: 65, group: "minimal", name: "Swiss Crosshair", prefers: "dark", round: 1,
      tagline: "Rationalist typography grid with 4-way registration crosshairs and circle",
      concept: "Swiss Style (International Typographic Style): precision registration marks and an immaculate monoline circle, radiating Helvetica-era typographic clarity.",
      moves: ["Four registration crosshairs", "Precision 50/50 balance", "Stark black and white"],
      palette: [["Pure Void", "#000000"], ["Swiss Red", "#EF4444"], ["Paper White", "#FFFFFF"], ["Grid Slate", "#475569"]],
      facts: {"Family": "Minimalism", "Metaphor": "Swiss registration marks", "Vibe": "Rationalist & Modernist", "ScaleAt16px": "Target cross in circle"},
      evenGrid: ".....##.....\n.....##.....\n..#..##..#..\n.#...##...#.\n.....##.....\n#####..#####\n#####..#####\n.....##.....\n.#...##...#.\n..#..##..#..\n.....##.....\n.....##.....",
      svg: () => `
<rect width="1024" height="1024" fill="#050505"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#FFFFFF" stroke-width="32"/>
        <line x1="512" y1="120" x2="512" y2="904" stroke="#FFFFFF" stroke-width="24"/>
        <line x1="120" y1="512" x2="904" y2="512" stroke="#FFFFFF" stroke-width="24"/>
        <circle cx="512" cy="512" r="120" fill="#EF4444"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><line x1="512" y1="120" x2="512" y2="904" stroke="#00FF66" stroke-width="24"/><line x1="120" y1="512" x2="904" y2="512" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="110" fill="#00FF66"/>
      `,
    },
    {
      id: "balanced-asymmetry", n: 66, group: "minimal", name: "Asymmetric Horizon", prefers: "dark", round: 1,
      tagline: "Offset circle intersecting a horizontal baseline in tension",
      concept: "Explores Scandinavian asymmetric tension: a single solid off-center circle anchored by a grounded horizontal baseline.",
      moves: ["Asymmetrical 1/3 offset placement", "Grounded baseline bar", "Warm terracotta & sand tones"],
      palette: [["Sand", "#1C1917"], ["Terracotta", "#EA580C"], ["Soft Sand", "#F5F5F4"], ["Slate", "#44403C"]],
      facts: {"Family": "Minimalism", "Metaphor": "Rising sun over horizon", "Vibe": "Warm Minimalist", "ScaleAt16px": "Circle on bar"},
      evenGrid: "......####..\n.....######.\n....########\n....########\n.....######.\n......####..\n............\n.##########.\n.##########.\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_asym" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C1917"/><stop offset="1" stop-color="#0A0908"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_asym)"/>
        <circle cx="620" cy="440" r="220" fill="#EA580C"/>
        <rect x="180" y="660" width="664" height="64" rx="32" fill="#F5F5F4"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="620" cy="440" r="220" fill="#00FF66"/><rect x="180" y="660" width="664" height="64" rx="32" fill="#00FF66"/>
      `,
    },
    {
      id: "grid-fl", n: 67, group: "minimal", name: "Dot Matrix FL", prefers: "dark", round: 1,
      tagline: "4x4 modular dot-matrix grid with illuminated nodes constructing the brand mark",
      concept: "A 4x4 matrix of 16 circular nodes where specific dots glow in bright cyan to outline an 'F' and 'L' in pure algorithmic grid logic.",
      moves: ["4x4 architectural dot matrix", "Selective active node illumination", "Futuristic monochrome cyan"],
      palette: [["Deep Charcoal", "#0F172A"], ["Active Cyan", "#06B6D4"], ["Inactive Slate", "#334155"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Minimalism", "Metaphor": "Dot matrix display", "Vibe": "Algorithmic & Clean", "ScaleAt16px": "Distinct dot pattern"},
      evenGrid: ".##..##..##.\n............\n.##..##..##.\n............\n.##.........\n............\n.##..##..##.\n............\n.##..##..##.\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_grd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g fill="#00FF66"><circle cx="280" cy="280" r="44"/><circle cx="434" cy="280" r="44"/><circle cx="588" cy="280" r="44"/><circle cx="744" cy="280" r="44"/><circle cx="280" cy="434" r="44"/><circle cx="434" cy="434" r="44"/><circle cx="588" cy="434" r="44"/><circle cx="280" cy="588" r="44"/><circle cx="280" cy="744" r="44"/><circle cx="434" cy="744" r="44"/><circle cx="588" cy="744" r="44"/><circle cx="744" cy="744" r="44"/></g>
      `,
    },
    {
      id: "mono-torus", n: 68, group: "minimal", name: "Pure Solid Torus", prefers: "dark", round: 1,
      tagline: "High-contrast monochrome donut ring with perfect 1:3 ratio proportions",
      concept: "Extreme geometric purity: a heavy circular torus where the outer diameter is exactly 3 times the hole diameter. Confident, bold, and iconic.",
      moves: ["Perfect 1:3 golden geometry ratio", "High-contrast stark silhouette", "Zero ornamental clutter"],
      palette: [["Black Void", "#000000"], ["Off-White", "#F8FAFC"], ["Slate Line", "#334155"], ["Pure White", "#FFFFFF"]],
      facts: {"Family": "Minimalism", "Metaphor": "Pure geometric torus", "Vibe": "Stark & Iconic", "ScaleAt16px": "Flawless thick ring"},
      evenGrid: "..########..\n.##########.\n.##########.\n.###....###.\n.###....###.\n.###....###.\n.###....###.\n.##########.\n.##########.\n..########..\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#09090B"/>
        <circle cx="512" cy="512" r="360" fill="#F8FAFC"/>
        <circle cx="512" cy="512" r="140" fill="#09090B"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="#00FF66"/><circle cx="512" cy="512" r="140" fill="#000"/>
      `,
    },
    {
      id: "zen-enso", n: 69, group: "minimal", name: "Athletic Enso", prefers: "dark", round: 1,
      tagline: "Calligraphic single-breath brush circle executed with athletic precision",
      concept: "The Zen Enso circle painted in a single unbroken exhalation. Represents mind-muscle connection, presence in the moment, and physical enlightenment.",
      moves: ["Single-breath tapered brush stroke", "Open harmonic tail gap", "Deep charcoal with crimson seal"],
      palette: [["Sumi Ink", "#111113"], ["Brush White", "#F4F4F5"], ["Hanko Red", "#DC2626"], ["Charcoal", "#27272A"]],
      facts: {"Family": "Minimalism", "Metaphor": "Zen enso / Mindful breath", "Vibe": "Spiritual & Focused", "ScaleAt16px": "Distinct tapered ring"},
      evenGrid: "....####....\n..########..\n.##......##.\n.##.......#.\n.##.........\n.##.........\n.##.......#.\n..##.....##.\n...#######..\n.....###....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_zen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141417"/><stop offset="1" stop-color="#070708"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_zen)"/>
        <path d="M 512 180 C 720 180 844 320 844 512 C 844 700 700 844 512 844 C 324 844 180 700 180 512 C 180 360 260 240 440 190" fill="none" stroke="#F4F4F5" stroke-width="112" stroke-linecap="round"/>
        <!-- Red Hanko Stamp -->
        <rect x="680" y="680" width="88" height="88" rx="16" fill="#DC2626"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 C 720 180 844 320 844 512 C 844 700 700 844 512 844 C 324 844 180 700 180 512 C 180 360 260 240 440 190" fill="none" stroke="#00FF66" stroke-width="96" stroke-linecap="round"/><rect x="680" y="680" width="88" height="88" rx="16" fill="#00FF66"/>
      `,
    },
    {
      id: "subtle-bevel", n: 70, group: "minimal", name: "Precision Bevel", prefers: "dark", round: 1,
      tagline: "Flat circular icon with micro-etched chamfer catching ambient light",
      concept: "Understated luxury: a matte titanium circular badge with a subtle 45-degree micro-etched chamfer edge that catches highlights like luxury sports watches.",
      moves: ["Matte titanium circular plane", "Precision edge highlight chamfer", "Single laser-etched focal ring"],
      palette: [["Titanium Black", "#131417"], ["Edge Highlight", "#E2E8F0"], ["Titanium Matte", "#334155"], ["Chamber Slate", "#1E293B"]],
      facts: {"Family": "Minimalism", "Metaphor": "Machined titanium watch bezel", "Vibe": "Luxury & Refined", "ScaleAt16px": "Crisp beveled coin"},
      evenGrid: "...######...\n..########..\n.###....###.\n.##..##..##.\n.##.####.##.\n.##.####.##.\n.##..##..##.\n.###....###.\n..########..\n...######...\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_bvl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#181B22"/><stop offset="1" stop-color="#08090C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_bvl)"/>
        <circle cx="512" cy="512" r="360" fill="#1E293B" stroke="#E2E8F0" stroke-width="24"/>
        <circle cx="512" cy="512" r="280" fill="#08090C" stroke="#334155" stroke-width="44"/>
        <circle cx="512" cy="512" r="88" fill="#E2E8F0"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="280" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="80" fill="#00FF66"/>
      `,
    },
    {
      id: "laser-grid", n: 71, group: "cyber", name: "Laser Grid Loop", prefers: "dark", round: 1,
      tagline: "3D perspective wireframe synthwave grid looping into the infinite horizon",
      concept: "1980s retro-futurism: a neon purple and hot magenta wireframe perspective grid rushing toward an infinite glowing digital horizon.",
      moves: ["3D perspective wireframe grid", "Hot magenta into electric violet", "Retro-futuristic cyberspace"],
      palette: [["Cyber Black", "#050014"], ["Hot Magenta", "#EC4899"], ["Neon Violet", "#8B5CF6"], ["Grid Cyan", "#06B6D4"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Synthwave perspective grid", "Vibe": "Outrun & Nostalgic", "ScaleAt16px": "Vivid magenta grid"},
      evenGrid: "............\n...######...\n..#......#..\n.##########.\n.##########.\n.#.#.##.#.#.\n.#.#.##.#.#.\n.##########.\n.#..#..#..#.\n.##########.\n............\n............",
      svg: () => `
<defs>
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
        <circle cx="512" cy="512" r="220" fill="none" stroke="#EC4899" stroke-width="48" filter="url(#glow_lsr)"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><line x1="120" y1="512" x2="904" y2="512" stroke="#00FF66" stroke-width="24"/><line x1="120" y1="660" x2="904" y2="660" stroke="#00FF66" stroke-width="24"/><line x1="512" y1="512" x2="120" y2="904" stroke="#00FF66" stroke-width="24"/><line x1="512" y1="512" x2="904" y2="904" stroke="#00FF66" stroke-width="24"/><circle cx="512" cy="512" r="220" fill="none" stroke="#00FF66" stroke-width="48"/>
      `,
    },
    {
      id: "tokyo-midnight", n: 72, group: "cyber", name: "Tokyo Midnight", prefers: "dark", round: 1,
      tagline: "Neon magenta and cyan kanji-inspired athletic loop against pitch black",
      concept: "Shinjuku neon in the rain: blistering hot pink and electric cyan neon lines intersecting against absolute pitch black.",
      moves: ["Dual neon tube crossover", "Electric cyan & hot pink contrast", "Tokyo cyber aesthetic"],
      palette: [["OLED Black", "#000000"], ["Tokyo Magenta", "#F43F5E"], ["Akira Cyan", "#00F0FF"], ["Neon Glow", "#FFE4E6"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Tokyo neon sign", "Vibe": "Electric & Rebellious", "ScaleAt16px": "Blazing dual-color cross"},
      evenGrid: ".#######....\n.#######....\n.#....##....\n.#######....\n.#....##....\n.#....##....\n.#######.##.\n.....######.\n.....##..##.\n.....######.\n.....##..##.\n............",
      svg: () => `
<defs>
          <filter id="glow_tky" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#000000"/>
        <g filter="url(#glow_tky)" stroke-linecap="round" fill="none">
          <path d="M 280 240 L 744 240 L 744 540 C 744 740 512 820 380 720" stroke="#F43F5E" stroke-width="72"/>
          <path d="M 280 440 L 680 440 L 680 820 L 280 820" stroke="#00F0FF" stroke-width="72"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 240 L 744 240 L 744 540 C 744 740 512 820 380 720" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/><path d="M 280 440 L 680 440 L 680 820 L 280 820" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>
      `,
    },
    {
      id: "cyber-samurai", n: 73, group: "cyber", name: "Exoskeleton Crest", prefers: "dark", round: 1,
      tagline: "Angular futuristic athletic crest inspired by exoskeleton biomechanics",
      concept: "Bionic human enhancement: sharp hexagonal armor plating interlocking around a glowing biometric power core.",
      moves: ["Bionic exoskeleton plating", "Sharp aggressive chamfers", "Electric laser green"],
      palette: [["Abyss", "#0A0D10"], ["Laser Green", "#10E867"], ["Plating Slate", "#334155"], ["Armor White", "#FFFFFF"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Exoskeleton armor plating", "Vibe": "Tactical & Cybernetic", "ScaleAt16px": "Angular tech shield"},
      evenGrid: "....####....\n..########..\n.###.##.###.\n.##..##..##.\n.##.####.##.\n.##.####.##.\n.##..##..##.\n.###.##.###.\n..########..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_exo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1318"/><stop offset="1" stop-color="#040608"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_exo)"/>
        <polygon points="512,180 820,360 820,680 512,860 204,680 204,360" fill="none" stroke="#334155" stroke-width="54" stroke-linejoin="round"/>
        <polygon points="512,280 720,400 720,620 512,740 304,620 304,400" fill="#10E867" stroke="#FFFFFF" stroke-width="16" stroke-linejoin="round"/>
        <circle cx="512" cy="512" r="64" fill="#040608"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 820,360 820,680 512,860 204,680 204,360" fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"/><polygon points="512,280 720,400 720,620 512,740 304,620 304,400" fill="none" stroke="#00FF66" stroke-width="32" stroke-linejoin="round"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "phosphor-horizon", n: 74, group: "cyber", name: "CRT Phosphor Wave", prefers: "dark", round: 1,
      tagline: "1980s monochrome CRT oscilloscope waveform in electric lime phosphor",
      concept: "Nostalgic laboratory instrumentation: bright green P1 phosphor traces dancing across a dark curved cathode-ray tube screen.",
      moves: ["Monochrome P1 green phosphor", "Oscilloscope cardiac waveform", "Subtle scanline glow"],
      palette: [["CRT Black", "#020803"], ["Phosphor Green", "#00FF66"], ["Trace Pale", "#A7F3D0"], ["Cathode Dark", "#064E3B"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Oscilloscope CRT waveform", "Vibe": "Retro Lab & Diagnostic", "ScaleAt16px": "Green wave on black"},
      evenGrid: ".##########.\n.#........#.\n.#...##...#.\n.#..#..#..#.\n.##.#..#.##.\n.###....###.\n.##########.\n............\n............\n............\n............\n............",
      svg: () => `
<defs>
          <filter id="glow_crt" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#020804"/>
        <rect x="180" y="180" width="664" height="664" rx="80" fill="none" stroke="#064E3B" stroke-width="24"/>
        <g filter="url(#glow_crt)" stroke="#00FF66" stroke-width="72" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 220 512 L 380 512 L 440 280 L 520 740 L 600 420 L 660 512 L 804 512"/>
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="180" y="180" width="664" height="664" rx="80" fill="none" stroke="#00FF66" stroke-width="24"/><path d="M 220 512 L 380 512 L 440 280 L 520 740 L 600 420 L 660 512 L 804 512" stroke="#00FF66" stroke-width="64" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      `,
    },
    {
      id: "hyperdrive-warp", n: 75, group: "cyber", name: "Hyperdrive Starburst", prefers: "dark", round: 1,
      tagline: "Radial starburst speed streaks accelerating through deep cyberspace",
      concept: "Punching into hyperspace: radial geometric acceleration beams exploding outward from a central vanishing point.",
      moves: ["Radial perspective speed streaks", "Dynamic length variation", "Cyan and solar white"],
      palette: [["Cyberspace", "#040812"], ["Warp Cyan", "#00F2FE"], ["Solar White", "#FFFFFF"], ["Abyss Navy", "#0F172A"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Hyperspace jump streaks", "Vibe": "Warp-speed & Dynamic", "ScaleAt16px": "Starburst velocity"},
      evenGrid: "#....##....#\n.#...##...#.\n..#..##..#..\n...#.##.#...\n....####....\n#####..#####\n#####..#####\n....####....\n...#.##.#...\n..#..##..#..\n.#...##...#.\n#....##....#",
      svg: () => `
<defs><linearGradient id="bg_wrp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08101E"/><stop offset="1" stop-color="#020408"/></linearGradient></defs>
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
        <circle cx="512" cy="512" r="88" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="40" stroke-linecap="round"><line x1="512" y1="360" x2="512" y2="140"/><line x1="512" y1="664" x2="512" y2="884"/><line x1="360" y1="512" x2="140" y2="512"/><line x1="664" y1="512" x2="884" y2="512"/><line x1="400" y1="400" x2="240" y2="240"/><line x1="624" y1="624" x2="784" y2="784"/><line x1="400" y1="624" x2="240" y2="784"/><line x1="624" y1="400" x2="784" y2="240"/></g><circle cx="512" cy="512" r="80" fill="#00FF66"/>
      `,
    },
    {
      id: "glitch-ring", n: 76, group: "cyber", name: "Chromatic Glitch Loop", prefers: "dark", round: 1,
      tagline: "Circular athletic loop with RGB channel displacement and digital scanlines",
      concept: "Digital compression glitch: an athletic circular loop whose RGB color channels split apart into displaced red, green, and blue outlines.",
      moves: ["RGB chromatic aberration offset", "Horizontal digital glitch displacement", "High-voltage cyber styling"],
      palette: [["Glitch Black", "#060608"], ["RGB Red", "#FF0055"], ["RGB Cyan", "#00FFFF"], ["RGB White", "#FFFFFF"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "RGB chromatic glitch", "Vibe": "Edgy & Digital", "ScaleAt16px": "Displaced multi-ring"},
      evenGrid: "...######...\n..########..\n.###..######\n.###..######\n.###........\n.######..###\n.######..###\n.###........\n.###########\n..########..\n...######...\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#060608"/>
        <!-- Red Channel -->
        <circle cx="496" cy="504" r="300" fill="none" stroke="#FF0055" stroke-width="72" opacity="0.8"/>
        <!-- Cyan Channel -->
        <circle cx="528" cy="520" r="300" fill="none" stroke="#00FFFF" stroke-width="72" opacity="0.8"/>
        <!-- Center Core Core White -->
        <circle cx="512" cy="512" r="280" fill="none" stroke="#FFFFFF" stroke-width="24"/>
        <!-- Glitch Slices -->
        <rect x="220" y="440" width="584" height="40" fill="#060608"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="300" fill="none" stroke="#00FF66" stroke-width="64"/><rect x="220" y="440" width="584" height="40" fill="#000"/>
      `,
    },
    {
      id: "synth-hex", n: 77, group: "cyber", name: "Dark Synth Hex", prefers: "dark", round: 1,
      tagline: "Glowing neon purple hexagonal energy shield with internal circuitry",
      concept: "A heavy hexagonal forcefield prism pulsing with ultraviolet and electric magenta energy, housing an internal athletic triangle core.",
      moves: ["Hexagonal forcefield boundary", "Neon purple circuit glow", "Internal delta energy core"],
      palette: [["Dark Synth", "#080314"], ["Electric Violet", "#A855F7"], ["Neon Magenta", "#EC4899"], ["Cyber White", "#FFFFFF"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Hex energy forcefield", "Vibe": "Futuristic Shield", "ScaleAt16px": "Crisp purple hexagon"},
      evenGrid: "....####....\n..########..\n.##########.\n.###.##.###.\n.##..##..##.\n.##..##..##.\n.###.##.###.\n.##########.\n..########..\n....####....\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_shx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#120422"/><stop offset="1" stop-color="#040108"/></linearGradient>
          <filter id="glow_shx" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_shx)"/>
        <polygon points="512,180 820,360 820,664 512,844 204,664 204,360" fill="none" stroke="#A855F7" stroke-width="64" stroke-linejoin="round" filter="url(#glow_shx)"/>
        <polygon points="512,320 700,640 324,640" fill="#EC4899"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 820,360 820,664 512,844 204,664 204,360" fill="none" stroke="#00FF66" stroke-width="54" stroke-linejoin="round"/><polygon points="512,320 700,640 324,640" fill="#00FF66"/>
      `,
    },
    {
      id: "outrun-sun", n: 78, group: "cyber", name: "Outrun Sun Arc", prefers: "dark", round: 1,
      tagline: "Segmented retro-futuristic setting sun with horizontal gradient slats",
      concept: "The quintessential 80s Outrun visual: a blazing solar circular orb divided by horizontal negative-space slats, descending into neon orange.",
      moves: ["Circular orb with horizontal slats", "Sunburst vertical gradient", "Retro synth aesthetic"],
      palette: [["Void Purple", "#0A0314"], ["Sun Magenta", "#F43F5E"], ["Outrun Gold", "#FBBF24"], ["Neon Orange", "#FB923C"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Outrun segmented sun", "Vibe": "Warm Retro Synth", "ScaleAt16px": "Distinct slatted sun"},
      evenGrid: "...######...\n..########..\n.##########.\n.##########.\n............\n.##########.\n............\n.########...\n............\n...####.....\n............\n............",
      svg: () => `
<defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g fill="#00FF66"><path d="M 180 512 A 332 332 0 0 1 844 512 Z"/><rect x="200" y="540" width="624" height="44" rx="8"/><rect x="230" y="614" width="564" height="44" rx="8"/><rect x="280" y="688" width="464" height="44" rx="8"/><rect x="360" y="762" width="304" height="44" rx="8"/></g>
      `,
    },
    {
      id: "terminal-vector", n: 79, group: "cyber", name: "Terminal Vector", prefers: "dark", round: 1,
      tagline: "Raw green phosphor vector graphics line-art on an ultra-dark background",
      concept: "1979 arcade vector graphics (Battlezone / Asteroids): razor-thin, luminous green phosphor vector polygons drawn directly by laser electron beams.",
      moves: ["Pure vector line-art wireframe", "Phosphor green on pitch black", "Zero fill textures, pure laser glow"],
      palette: [["OLED Abyss", "#000000"], ["Laser Phosphor", "#00FF66"], ["Beam Core", "#FFFFFF"], ["Glow Dark", "#022B0F"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Vector display wireframe", "Vibe": "Arcade Retro & Raw", "ScaleAt16px": "Crisp green lines"},
      evenGrid: ".....##.....\n...######...\n..##....##..\n.##..##..##.\n.##..##..##.\n##...##...##\n##...##...##\n.##..##..##.\n.##..##..##.\n..##....##..\n...######...\n.....##.....",
      svg: () => `
<defs>
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
        <circle cx="512" cy="512" r="36" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><polygon points="512,180 844,512 512,844 180,512" fill="none" stroke="#00FF66" stroke-width="48"/><polygon points="512,320 704,512 512,704 320,512" fill="none" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="512" r="32" fill="#00FF66"/>
      `,
    },
    {
      id: "matrix-rain", n: 80, group: "cyber", name: "Matrix Data Loop", prefers: "dark", round: 1,
      tagline: "Cascading digital rain streams curling into a continuous cyber loop",
      concept: "Digital green code rain curling along a circular perimeter: dashes and binary pips flowing clockwise in high-speed algorithmic computation.",
      moves: ["Circular stream of code dashes", "Phosphor green fading tail", "Cybernetic matrix vibe"],
      palette: [["Matrix Black", "#010803"], ["Matrix Green", "#00FF66"], ["Dark Phosphor", "#047857"], ["High Pulse", "#A7F3D0"]],
      facts: {"Family": "Cyberpunk & Neon", "Metaphor": "Cascading digital code rain", "Vibe": "Cybernetic & Hacker", "ScaleAt16px": "Segmented code ring"},
      evenGrid: ".##..##..##.\n.#...#....#.\n.#...##...#.\n.##..#....#.\n.#...##...#.\n.#...#....#.\n.##..##..##.\n............\n............\n............\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#010803"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#047857" stroke-width="64" stroke-dasharray="80 40 120 40 40 40 160 40"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="48" stroke-dasharray="140 60 80 40 40 60"/>
        <circle cx="512" cy="512" r="64" fill="#00FF66"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="54" stroke-dasharray="80 40 120 40"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="40" stroke-dasharray="140 60 80 40"/><circle cx="512" cy="512" r="54" fill="#00FF66"/>
      `,
    },
    {
      id: "oxygen-leaf", n: 81, group: "nature", name: "Oxygen Leaf", prefers: "dark", round: 1,
      tagline: "Stylized botanical leaf curving into an athletic circulation loop",
      concept: "Cellular respiration and clean biological fuel: an aerodynamic leaf whose central vein forms a continuous looping circulatory path.",
      moves: ["Organic botanical leaf profile", "Curved circulatory central stem", "Vibrant forest and mint greens"],
      palette: [["Dark Soil", "#061208"], ["Chlorophyll Green", "#10B981"], ["Fresh Mint", "#34D399"], ["Pure Sunlight", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Photosynthesis & Cellular breath", "Vibe": "Fresh & Vital", "ScaleAt16px": "Crisp curved leaf"},
      evenGrid: ".......#####\n......######\n.....#######\n....########\n...#########\n..###..#####\n.###...#####\n.##....#####\n.#.....#####\n.......#####\n........####\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_lfe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#08180E"/><stop offset="1" stop-color="#020804"/></linearGradient>
          <linearGradient id="g_lfe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_lfe)"/>
        <!-- Leaf Contour -->
        <path d="M 280 744 C 280 440 440 220 744 220 C 744 524 584 744 280 744 Z" fill="url(#g_lfe)"/>
        <!-- Central Circulatory Vein -->
        <path d="M 280 744 Q 512 512 744 220" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round"/>
        <circle cx="744" cy="220" r="36" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 744 C 280 440 440 220 744 220 C 744 524 584 744 280 744 Z" fill="#00FF66"/><path d="M 280 744 Q 512 512 744 220" fill="none" stroke="#000" stroke-width="44" stroke-linecap="round"/>
      `,
    },
    {
      id: "tidal-swell", n: 82, group: "nature", name: "Tidal Swell", prefers: "dark", round: 1,
      tagline: "Oceanic wave cresting in continuous gravitational ebb and flow",
      concept: "Physical endurance mirrors ocean waves: rhythmic sets, rising momentum, cresting exertion, and effortless recovery.",
      moves: ["Sweeping hydrodynamic wave crest", "Circular oceanic curl", "Deep pacific blue and seafoam"],
      palette: [["Ocean Deep", "#04141E"], ["Tidal Blue", "#0284C7"], ["Seafoam Green", "#38BDF8"], ["White Surf", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Ocean wave sets & swell", "Vibe": "Hydraulic & Relentless", "ScaleAt16px": "Distinct curling wave"},
      evenGrid: "............\n...######...\n..########..\n.##....####.\n.##...######\n.##...######\n.##....####.\n..##........\n...####.....\n.....######.\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_tid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#041B29"/><stop offset="1" stop-color="#01070C"/></linearGradient>
          <linearGradient id="g_tid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38BDF8"/><stop offset="1" stop-color="#0369A1"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_tid)"/>
        <path d="M 220 740 C 380 740 480 620 540 500 C 600 380 660 300 780 340 C 860 380 840 500 740 560 C 660 600 580 540 560 480" fill="none" stroke="url(#g_tid)" stroke-width="96" stroke-linecap="round"/>
        <circle cx="560" cy="480" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 220 740 C 380 740 480 620 540 500 C 600 380 660 300 780 340 C 860 380 840 500 740 560 C 660 600 580 540 560 480" fill="none" stroke="#00FF66" stroke-width="88" stroke-linecap="round"/>
      `,
    },
    {
      id: "breath-cycle", n: 83, group: "nature", name: "Box Breath Square", prefers: "dark", round: 1,
      tagline: "Inhale-hold-exhale-pause box breathing square with soft rounded corners",
      concept: "Navy SEAL box breathing (4s in, 4s hold, 4s out, 4s hold): a smooth rounded square whose four rounded edges cycle through the breath rhythm.",
      moves: ["Rounded square geometry (Squircle)", "Four rhythmic breath corners", "Soothing lavender and calm indigo"],
      palette: [["Midnight Slate", "#0F172A"], ["Zen Lavender", "#A855F7"], ["Calm Indigo", "#6366F1"], ["Pure Air", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Box breathing cycle", "Vibe": "Mindful & Restorative", "ScaleAt16px": "Clean rounded square"},
      evenGrid: ".####..####.\n.####..####.\n.#........#.\n.#........#.\n.#........#.\n.#........#.\n.####..####.\n.####..####.\n............\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_bth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12172A"/><stop offset="1" stop-color="#04060C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_bth)"/>
        <rect x="240" y="240" width="544" height="544" rx="160" fill="none" stroke="#A855F7" stroke-width="84"/>
        <!-- 4 Breathing Corner Nodes -->
        <circle cx="360" cy="360" r="44" fill="#6366F1"/>
        <circle cx="664" cy="360" r="44" fill="#FFFFFF"/>
        <circle cx="664" cy="664" r="44" fill="#6366F1"/>
        <circle cx="360" cy="664" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="240" y="240" width="544" height="544" rx="160" fill="none" stroke="#00FF66" stroke-width="72"/><circle cx="360" cy="360" r="40" fill="#00FF66"/><circle cx="664" cy="360" r="40" fill="#00FF66"/><circle cx="664" cy="664" r="40" fill="#00FF66"/><circle cx="360" cy="664" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "cellular-mitosis", n: 84, group: "nature", name: "Cellular Mitosis", prefers: "dark", round: 1,
      tagline: "Two dividing biological cells joined by an energetic mitotic spindle",
      concept: "Cellular growth and muscle hypertrophy: two biological cells budding and multiplying, visualizing adaptation at the microscopic tissue level.",
      moves: ["Twin dividing cellular spheres", "Membrane constriction bridge", "Biological magenta and coral"],
      palette: [["Cellular Dark", "#140A10"], ["Cytoplasm Pink", "#EC4899"], ["Membrane Coral", "#FB7185"], ["Nucleus Glow", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Cellular division & Growth", "Vibe": "Microscopic & Generative", "ScaleAt16px": "Distinct hourglass cells"},
      evenGrid: "...####.....\n..######....\n.########...\n.########...\n..######....\n...####.....\n.....####...\n....######..\n...########.\n...########.\n....######..\n.....####...",
      svg: () => `
<defs>
          <linearGradient id="bg_mit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#180A15"/><stop offset="1" stop-color="#050104"/></linearGradient>
          <linearGradient id="g_mit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EC4899"/><stop offset="1" stop-color="#FB7185"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_mit)"/>
        <ellipse cx="380" cy="512" rx="200" ry="240" fill="url(#g_mit)"/>
        <ellipse cx="644" cy="512" rx="200" ry="240" fill="url(#g_mit)"/>
        <circle cx="380" cy="512" r="54" fill="#FFFFFF"/>
        <circle cx="644" cy="512" r="54" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><ellipse cx="380" cy="512" rx="180" ry="220" fill="none" stroke="#00FF66" stroke-width="48"/><ellipse cx="644" cy="512" rx="180" ry="220" fill="none" stroke="#00FF66" stroke-width="48"/><circle cx="380" cy="512" r="48" fill="#00FF66"/><circle cx="644" cy="512" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "solar-flare", n: 85, group: "nature", name: "Solar Corona Loop", prefers: "dark", round: 1,
      tagline: "Radiant sun corona with dynamic plasma prominence looping back to surface",
      concept: "Solar fusion energy: a coronal magnetic plasma prominence erupting from a sun disk and arcing gracefully back to the surface.",
      moves: ["High-energy magnetic plasma arc", "Solar core radiant disc", "Golden sunburst thermal scale"],
      palette: [["Space Dark", "#0C0600"], ["Solar Gold", "#F59E0B"], ["Corona Orange", "#EA580C"], ["Core Fire", "#FEF08A"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Solar magnetic prominence", "Vibe": "Radiant & Cosmic", "ScaleAt16px": "Arc over glowing sun"},
      evenGrid: ".....##.....\n....####....\n...######...\n..########..\n...######...\n...######...\n...######...\n..########..\n.##########.\n.##########.\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A0D02"/><stop offset="1" stop-color="#050200"/></linearGradient>
          <linearGradient id="g_sol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FEF08A"/><stop offset="1" stop-color="#EA580C"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_sol)"/>
        <circle cx="512" cy="620" r="280" fill="#EA580C"/>
        <!-- Plasma Loop Arcing Out -->
        <path d="M 340 512 C 340 220 684 220 684 512" fill="none" stroke="url(#g_sol)" stroke-width="84" stroke-linecap="round"/>
        <circle cx="512" cy="300" r="48" fill="#FEF08A"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="620" r="260" fill="none" stroke="#00FF66" stroke-width="48"/><path d="M 340 512 C 340 220 684 220 684 512" fill="none" stroke="#00FF66" stroke-width="72" stroke-linecap="round"/><circle cx="512" cy="300" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "ripple-nexus", n: 86, group: "nature", name: "Water Drop Ripple", prefers: "dark", round: 1,
      tagline: "Concentric circular water droplets expanding outward after athletic impact",
      concept: "The impact of a single training session sending concentric ripples through metabolism, sleep quality, and mental clarity for days.",
      moves: ["Triple expanding wave rings", "Central droplet impact bead", "Aquatic turquoise and deep navy"],
      palette: [["Deep Pool", "#06151E"], ["Aquatic Blue", "#0EA5E9"], ["Turquoise Ripple", "#06B6D4"], ["Pure Drop", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Expanding water ripple", "Vibe": "Harmonic & Hydrating", "ScaleAt16px": "Concentric wave circles"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#...####...#\n#...####...#\n#...####...#\n.#...##...#.\n..##....##..\n....####....\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_rpl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#091A26"/><stop offset="1" stop-color="#02070A"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_rpl)"/>
        <circle cx="512" cy="512" r="380" fill="none" stroke="#0EA5E9" stroke-width="32" opacity="0.4"/>
        <circle cx="512" cy="512" r="260" fill="none" stroke="#06B6D4" stroke-width="48" opacity="0.75"/>
        <circle cx="512" cy="512" r="140" fill="none" stroke="#FFFFFF" stroke-width="64"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="380" fill="none" stroke="#00FF66" stroke-width="28"/><circle cx="512" cy="512" r="260" fill="none" stroke="#00FF66" stroke-width="40"/><circle cx="512" cy="512" r="140" fill="none" stroke="#00FF66" stroke-width="54"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "nautilus-shell", n: 87, group: "nature", name: "Nautilus Spiral", prefers: "dark", round: 1,
      tagline: "Sacred geometry chambered nautilus shell growing in continuous spiral",
      concept: "Sacred biological architecture: a logarithmic spiral divided into structural growth chambers, evoking athletic progression through progressive overload.",
      moves: ["Logarithmic nautilus chambers", "Golden ratio internal partitioning", "Warm ocean terracotta and cream"],
      palette: [["Ocean Sand", "#181412"], ["Nautilus Terracotta", "#C2410C"], ["Cream Shell", "#FED7AA"], ["Deep Coral", "#EA580C"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Chambered nautilus growth", "Vibe": "Architectural & Organic", "ScaleAt16px": "Coiled shell silhouette"},
      evenGrid: "...######...\n..########..\n.##########.\n.##..######.\n.#...######.\n.#...######.\n.##..######.\n.##########.\n..########..\n...######...\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_nau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C1410"/><stop offset="1" stop-color="#080504"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_nau)"/>
        <path d="M 512 844 C 280 844 180 660 180 480 C 180 300 320 180 512 180 C 700 180 844 320 844 512 C 844 640 760 740 644 740 C 524 740 440 660 440 540 C 440 440 500 380 580 380 C 640 380 680 420 680 480" fill="none" stroke="#EA580C" stroke-width="72" stroke-linecap="round"/>
        <circle cx="680" cy="480" r="36" fill="#FED7AA"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 844 C 280 844 180 660 180 480 C 180 300 320 180 512 180 C 700 180 844 320 844 512 C 844 640 760 740 644 740 C 524 740 440 660 440 540 C 440 440 500 380 580 380 C 640 380 680 420 680 480" fill="none" stroke="#00FF66" stroke-width="64" stroke-linecap="round"/>
      `,
    },
    {
      id: "vital-sprout", n: 88, group: "nature", name: "Vital Sprout", prefers: "dark", round: 1,
      tagline: "Twin cotyledon seed sprouts bursting open in upward athletic growth",
      concept: "The beginning of every athletic journey: a seed casing bursting open as twin vibrant sprouts reach upward toward the light.",
      moves: ["Twin curved cotyledon leaves", "Central seed origin node", "Spring lime and botanical green"],
      palette: [["Rich Humus", "#0A1208"], ["Sprout Lime", "#84CC16"], ["Botanical Leaf", "#22C55E"], ["Dew White", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Sprouting seed growth", "Vibe": "Youthful & Regenerative", "ScaleAt16px": "Crisp V-sprout"},
      evenGrid: "#..........#\n##........##\n.##......##.\n..##....##..\n...##..##...\n....####....\n.....##.....\n.....##.....\n.....##.....\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_sprt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#030602"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_sprt)"/>
        <!-- Left Leaf -->
        <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#84CC16"/>
        <!-- Right Leaf -->
        <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#22C55E"/>
        <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/><path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/><circle cx="512" cy="800" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "biolum-ring", n: 89, group: "nature", name: "Bioluminescent Jelly", prefers: "dark", round: 1,
      tagline: "Deep-sea glowing creature tentacles curling in effortless hydrodynamics",
      concept: "Deep ocean bioluminescence: ethereal cyan tentacles flowing in effortless hydrodynamic curves, capturing graceful athletic endurance.",
      moves: ["Flowing hydrodynamic tentacle curves", "Bioluminescent cyan glow", "Abyssal trench black"],
      palette: [["Abyssal Trench", "#02070D"], ["Biolum Cyan", "#00F2FE"], ["Deep Aquamarine", "#0284C7"], ["Ghost White", "#E0F2FE"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Bioluminescent jellyfish", "Vibe": "Ethereal & Hydrodynamic", "ScaleAt16px": "Flowing bell shape"},
      evenGrid: "...######...\n..########..\n.##########.\n.#..#..#..#.\n.#..#..#..#.\n.#..#..#..#.\n.#..#..#..#.\n.#..#..#..#.\n.#..#..#..#.\n............\n............\n............",
      svg: () => `
<defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 440 C 280 260 744 260 744 440 Z" fill="#00FF66"/><g stroke="#00FF66" stroke-width="40" fill="none" stroke-linecap="round"><path d="M 360 440 C 360 620 440 680 420 820"/><path d="M 512 440 C 512 660 560 720 512 860"/><path d="M 664 440 C 664 620 584 680 604 820"/></g>
      `,
    },
    {
      id: "mountain-loop", n: 90, group: "nature", name: "Alpine Summit Loop", prefers: "dark", round: 1,
      tagline: "Twin alpine peaks enclosed in a continuous circular ridge track",
      concept: "Outdoor trail endurance: two angular snow-capped alpine summits surrounded by a continuous circular mountain pass trail.",
      moves: ["Angular geometric mountain summits", "Continuous circular ridge track", "Alpine slate and summit white"],
      palette: [["Alpine Granite", "#12151C"], ["Summit White", "#FFFFFF"], ["Granite Slate", "#475569"], ["Sunlit Peak", "#F59E0B"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Alpine mountain summits", "Vibe": "Majestic & Outdoors", "ScaleAt16px": "Distinct mountain peaks"},
      evenGrid: "....####....\n..##....##..\n.#...##...#.\n#...####...#\n#..######..#\n#.########.#\n#.########.#\n.#.######.#.\n..##.##.##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_mtn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#161B24"/><stop offset="1" stop-color="#07090C"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_mtn)"/>
        <circle cx="512" cy="512" r="360" fill="none" stroke="#F59E0B" stroke-width="48"/>
        <!-- Rear Peak -->
        <polygon points="620,340 760,680 480,680" fill="#475569"/>
        <!-- Front Main Peak -->
        <polygon points="400,260 580,680 220,680" fill="#FFFFFF"/>
        <circle cx="400" cy="260" r="28" fill="#F59E0B"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="360" fill="none" stroke="#00FF66" stroke-width="44"/><polygon points="620,340 760,680 480,680" fill="none" stroke="#00FF66" stroke-width="32"/><polygon points="400,260 580,680 220,680" fill="#00FF66"/>
      `,
    },
    {
      id: "neural-node", n: 91, group: "ai", name: "Neural Synapse Loop", prefers: "dark", round: 1,
      tagline: "Branching axon and dendrite nodes firing electrical action potentials in a ring",
      concept: "The cognitive side of training: a ring of synaptic neural nodes firing electrical action potentials, representing neuroplastic motor learning.",
      moves: ["Ring of interconnected synaptic nodes", "Electrical action potential arcs", "Hyper-violet neural glow"],
      palette: [["Synapse Void", "#080414"], ["Neural Violet", "#8B5CF6"], ["Electric Cyan", "#06B6D4"], ["Spark White", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Neural synaptic network", "Vibe": "Cognitive & High-tech", "ScaleAt16px": "Constellation of nodes"},
      evenGrid: ".....##.....\n....####....\n.....##.....\n.##..##..##.\n####.##.####\n.##..##..##.\n.....##.....\n.##..##..##.\n####.##.####\n.##..##..##.\n.....##.....\n....####....",
      svg: () => `
<defs>
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
        <circle cx="512" cy="512" r="72" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="320" fill="none" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="192" r="44" fill="#00FF66"/><circle cx="789" cy="352" r="44" fill="#00FF66"/><circle cx="789" cy="672" r="44" fill="#00FF66"/><circle cx="512" cy="832" r="44" fill="#00FF66"/><circle cx="235" cy="672" r="44" fill="#00FF66"/><circle cx="235" cy="352" r="44" fill="#00FF66"/><circle cx="512" cy="512" r="64" fill="#00FF66"/>
      `,
    },
    {
      id: "agent-eye", n: 92, group: "ai", name: "Autonomous Agent Eye", prefers: "dark", round: 1,
      tagline: "Cybernetic optical sensor observing athlete's biometric vitals and adaptation",
      concept: "The attentive presence of the personal AI coach: an almond-shaped cybernetic eye aperture with a glowing iris tracking athlete progress.",
      moves: ["Almond-shaped cybernetic lens", "Concentric biometric iris rings", "Electric emerald glow"],
      palette: [["OLED Dark", "#020703"], ["Agent Emerald", "#00FF66"], ["Iris Cyan", "#00F2FE"], ["Pupil Black", "#000000"]],
      facts: {"Family": "AI & Neural", "Metaphor": "AI coaching eye", "Vibe": "Observant & Intelligent", "ScaleAt16px": "Distinct glowing eye"},
      evenGrid: "............\n...######...\n..########..\n.###....###.\n.##..##..##.\n.##..##..##.\n.###....###.\n..########..\n...######...\n............\n............\n............",
      svg: () => `
<defs>
          <filter id="glow_eye" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="#020704"/>
        <!-- Eye Contour -->
        <path d="M 180 512 C 340 300 684 300 844 512 C 684 724 340 724 180 512 Z" fill="none" stroke="#00FF66" stroke-width="64" stroke-linejoin="round" filter="url(#glow_eye)"/>
        <!-- Iris -->
        <circle cx="512" cy="512" r="160" fill="#00F2FE"/>
        <circle cx="512" cy="512" r="88" fill="#020704"/>
        <circle cx="512" cy="512" r="36" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 180 512 C 340 300 684 300 844 512 C 684 724 340 724 180 512 Z" fill="none" stroke="#00FF66" stroke-width="54"/><circle cx="512" cy="512" r="140" fill="none" stroke="#00FF66" stroke-width="40"/><circle cx="512" cy="512" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "synaptic-arc", n: 93, group: "ai", name: "Synaptic Spark", prefers: "dark", round: 1,
      tagline: "Electric spark jumping the synaptic cleft between athlete intention and AI plan",
      concept: "The instant feedback moment: a high-voltage electrical spark leaping across a micro-gap between the athlete's physical check-in and the agent's MCP response.",
      moves: ["High-voltage electrical spark path", "Dual magnetic opposing poles", "Ultraviolet and neon blue"],
      palette: [["Electric Void", "#050212"], ["Spark Blue", "#38BDF8"], ["High Voltage", "#818CF8"], ["Plasma White", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Synaptic spark / MCP request", "Vibe": "Electrifying & Instant", "ScaleAt16px": "Sharp zigzag spark"},
      evenGrid: ".###....###.\n.###....###.\n..#......#..\n...#....#...\n....#..#....\n.....##.....\n....####....\n...######...\n....####....\n.....##.....\n............\n............",
      svg: () => `
<defs>
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
        <circle cx="512" cy="512" r="32" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 200 512 C 200 340 320 220 480 220" fill="none" stroke="#00FF66" stroke-width="54" stroke-linecap="round"/><path d="M 824 512 C 824 684 704 804 544 804" fill="none" stroke="#00FF66" stroke-width="54" stroke-linecap="round"/><polygon points="460,340 580,480 500,480 560,684 440,540 520,540" fill="#00FF66"/>
      `,
    },
    {
      id: "quantum-qubit", n: 94, group: "ai", name: "Quantum Bloch Sphere", prefers: "dark", round: 1,
      tagline: "Bloch sphere representation with intersecting quantum probability rings",
      concept: "Advanced AI decision-making: intersecting quantum probability rings that rotate around a central qubit core, representing optimal plan generation.",
      moves: ["Three orthogonal probability rings", "Central qubit nucleus", "Quantum cyan and ultraviolet"],
      palette: [["Quantum Void", "#050713"], ["Qubit Cyan", "#00F2FE"], ["Quantum Violet", "#7C3AED"], ["Superposition", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Bloch sphere / Quantum qubit", "Vibe": "Theoretical & Frontier", "ScaleAt16px": "Intersecting wire sphere"},
      evenGrid: "....####....\n..##.##.##..\n.#...##...#.\n#....##....#\n######.#####\n######.#####\n#....##....#\n.#...##...#.\n..##.##.##..\n....####....\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_qbt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080C1E"/><stop offset="1" stop-color="#020308"/></linearGradient></defs>
        <rect width="1024" height="1024" fill="url(#bg_qbt)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="#7C3AED" stroke-width="36"/>
        <ellipse cx="512" cy="512" rx="340" ry="120" fill="none" stroke="#00F2FE" stroke-width="48"/>
        <ellipse cx="512" cy="512" rx="120" ry="340" fill="none" stroke="#00F2FE" stroke-width="48"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="32"/><ellipse cx="512" cy="512" rx="340" ry="120" fill="none" stroke="#00FF66" stroke-width="44"/><ellipse cx="512" cy="512" rx="120" ry="340" fill="none" stroke="#00FF66" stroke-width="44"/><circle cx="512" cy="512" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "turing-ribbon", n: 95, group: "ai", name: "Turing Tape Ribbon", prefers: "dark", round: 1,
      tagline: "Continuous punch-tape loop with algorithmic binary perforations",
      concept: "The mathematical foundation of computing: Alan Turing's infinite state-machine tape looping continuously with binary code punches.",
      moves: ["Continuous paper-tape M\u00f6bius loop", "Binary hole punch perforations", "Cyber amber on charcoal"],
      palette: [["Turing Slate", "#0F1217"], ["Tape Amber", "#F59E0B"], ["Punch Black", "#050608"], ["Binary White", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Turing machine punch tape", "Vibe": "Historical Computing & Pure", "ScaleAt16px": "Perforated ribbon loop"},
      evenGrid: ".##########.\n.##########.\n.#..#..#..#.\n.##########.\n.##########.\n............\n.##########.\n.##########.\n.#..#..#..#.\n.##########.\n.##########.\n............",
      svg: () => `
<defs><linearGradient id="bg_tur" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14171E"/><stop offset="1" stop-color="#050608"/></linearGradient></defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 280 340 C 440 220 744 320 744 512 C 744 704 440 804 280 684 Z" fill="none" stroke="#00FF66" stroke-width="100" stroke-linejoin="round"/>
      `,
    },
    {
      id: "tensor-matrix", n: 96, group: "ai", name: "Tensor Lattice", prefers: "dark", round: 1,
      tagline: "Multi-dimensional mathematical weight matrix visualizing deep learning",
      concept: "Visualizing neural network weight matrices: 3x3 interconnected mathematical nodes with weighted connection vectors.",
      moves: ["3x3 isometric tensor matrix", "Vector connection lines", "High-contrast indigo and mint"],
      palette: [["Matrix Dark", "#0B0E17"], ["Weight Mint", "#10B981"], ["Vector Violet", "#6366F1"], ["Node Core", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Deep learning tensor matrix", "Vibe": "Analytical & Mathematical", "ScaleAt16px": "3x3 lattice"},
      evenGrid: ".##..##..##.\n.##..##..##.\n............\n.##..##..##.\n.##..##..##.\n............\n.##..##..##.\n.##..##..##.\n............\n............\n............\n............",
      svg: () => `
<defs><linearGradient id="bg_tns" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1322"/><stop offset="1" stop-color="#030408"/></linearGradient></defs>
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
        </g>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><g stroke="#00FF66" stroke-width="20"><line x1="280" y1="280" x2="744" y2="280"/><line x1="280" y1="512" x2="744" y2="512"/><line x1="280" y1="744" x2="744" y2="744"/><line x1="280" y1="280" x2="280" y2="744"/><line x1="512" y1="280" x2="512" y2="744"/><line x1="744" y1="280" x2="744" y2="744"/><line x1="280" y1="280" x2="744" y2="744"/><line x1="280" y1="744" x2="744" y2="280"/></g><g fill="#00FF66"><circle cx="280" cy="280" r="40"/><circle cx="512" cy="280" r="40"/><circle cx="744" cy="280" r="40"/><circle cx="280" cy="512" r="40"/><circle cx="512" cy="512" r="64"/><circle cx="744" cy="512" r="40"/><circle cx="280" cy="744" r="40"/><circle cx="512" cy="744" r="40"/><circle cx="744" cy="744" r="40"/></g>
      `,
    },
    {
      id: "prompt-reticle", n: 97, group: "ai", name: "Prompt Reticle", prefers: "dark", round: 1,
      tagline: "High-tech terminal cursor prompt enclosed in an athletic targeting bracket",
      concept: "The interface between human language and machine reasoning: a command-line prompt cursor (>) that forms an athletic forward speed arrowhead.",
      moves: ["Terminal command prompt chevron", "Rectangular blinking cursor block", "Monochrome terminal green"],
      palette: [["Terminal Black", "#050805"], ["Prompt Green", "#00FF66"], ["Cursor Amber", "#F59E0B"], ["Dark Terminal", "#0D2814"]],
      facts: {"Family": "AI & Neural", "Metaphor": "CLI command cursor prompt", "Vibe": "Developer & Agentic", "ScaleAt16px": "Distinct terminal cursor"},
      evenGrid: ".##########.\n.#........#.\n.#..##....#.\n.#...##...#.\n.#....##..#.\n.#...##...#.\n.#..##....#.\n.#........#.\n.##########.\n............\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#050805"/>
        <!-- Terminal Target Bracket -->
        <rect x="200" y="200" width="624" height="624" rx="64" fill="none" stroke="#0D2814" stroke-width="32"/>
        <!-- Prompt Chevron > -->
        <path d="M 320 340 L 520 512 L 320 684" fill="none" stroke="#00FF66" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Blinking Cursor Block -->
        <rect x="580" y="600" width="140" height="96" rx="16" fill="#F59E0B"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><rect x="200" y="200" width="624" height="624" rx="64" fill="none" stroke="#00FF66" stroke-width="24"/><path d="M 320 340 L 520 512 L 320 684" fill="none" stroke="#00FF66" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><rect x="580" y="600" width="140" height="96" rx="16" fill="#00FF66"/>
      `,
    },
    {
      id: "agentic-core", n: 98, group: "ai", name: "MCP Agent Core", prefers: "dark", round: 1,
      tagline: "Central glowing intelligence orb with peripheral tool-calling orbital bus",
      concept: "Direct visual representation of Model Context Protocol (MCP): a central LLM intelligence orb with 8 peripheral tool-calling buses radiating outward.",
      moves: ["Central intelligence core", "Radial MCP tool calling bus lanes", "Electric cyan and deep purple"],
      palette: [["Deep Hub", "#0A0817"], ["MCP Cyan", "#06B6D4"], ["Tool Purple", "#8B5CF6"], ["Core Radiance", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Model Context Protocol hub", "Vibe": "Systemic & Architectural", "ScaleAt16px": "Hub with radiating spokes"},
      evenGrid: ".....##.....\n....####....\n.....##.....\n.##..##..##.\n####.##.####\n.##..##..##.\n.##..##..##.\n####.##.####\n.##..##..##.\n.....##.....\n....####....\n.....##.....",
      svg: () => `
<defs>
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
        <circle cx="512" cy="512" r="64" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="36"/><circle cx="512" cy="172" r="44" fill="#00FF66"/><circle cx="852" cy="512" r="44" fill="#00FF66"/><circle cx="512" cy="852" r="44" fill="#00FF66"/><circle cx="172" cy="512" r="44" fill="#00FF66"/><circle cx="512" cy="512" r="120" fill="#00FF66"/>
      `,
    },
    {
      id: "logic-loop", n: 99, group: "ai", name: "Recursive Logic Loop", prefers: "dark", round: 1,
      tagline: "Infinite recursive self-optimizing loop symbolizing agent reinforcement learning",
      concept: "Reinforcement learning from athlete feedback: an inner loop that feeds into an outer loop, which twists back into the origin in an endless recursive spiral.",
      moves: ["Recursive self-optimizing dual loops", "Seamless gradient energy transition", "High-voltage electric coral"],
      palette: [["Dark Void", "#07080D"], ["Recursive Coral", "#FF5E3A"], ["Amber Learning", "#FFAE34"], ["Deep Navy", "#1E1E2E"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Recursive reinforcement learning", "Vibe": "Intelligent & Unstoppable", "ScaleAt16px": "Concentric recursive loop"},
      evenGrid: "...#######..\n..#########.\n.###.....###\n.##...##..##\n.##..####.##\n.##..####.##\n.##...##..##\n.###.....###\n..#########.\n...#######..\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_rec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E101B"/><stop offset="1" stop-color="#030407"/></linearGradient>
          <linearGradient id="g_rec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5E3A"/><stop offset="1" stop-color="#FFAE34"/></linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_rec)"/>
        <!-- Outer Loop -->
        <path d="M 512 180 A 332 332 0 1 1 200 620 L 320 540 A 200 200 0 1 0 512 312 L 512 180 Z" fill="url(#g_rec)"/>
        <circle cx="512" cy="512" r="54" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><path d="M 512 180 A 332 332 0 1 1 200 620 L 320 540 A 200 200 0 1 0 512 312 L 512 180 Z" fill="#00FF66"/><circle cx="512" cy="512" r="48" fill="#000"/>
      `,
    },
    {
      id: "singularity-core", n: 100, group: "ai", name: "Feedback Singularity", prefers: "dark", round: 1,
      tagline: "Gravitational event horizon where real-world workouts and AI intelligence unite",
      concept: "Candidate 100: The ultimate destination of FitLoop. The physical realm of sweat, barbell iron, and running trails seamlessly unified with artificial general intelligence.",
      moves: ["Gravitational event horizon ring", "Intense glowing core singularity", "High-energy chromatic corona"],
      palette: [["Cosmic Void", "#020305"], ["Event Horizon", "#00F2FE"], ["Plasma Fire", "#FF512F"], ["Singularity", "#FFFFFF"]],
      facts: {"Family": "AI & Neural", "Metaphor": "Technological singularity in fitness", "Vibe": "Monumental & Ultimate", "ScaleAt16px": "Blazing cosmic core"},
      evenGrid: "....####....\n..########..\n.##########.\n.##########.\n.####..####.\n.####..####.\n.##########.\n.##########.\n..########..\n....####....\n............\n............",
      svg: () => `
<defs>
          <linearGradient id="bg_sng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080C14"/><stop offset="1" stop-color="#010203"/></linearGradient>
          <linearGradient id="g_sng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF512F"/><stop offset="50%" stop-color="#00F2FE"/><stop offset="100%" stop-color="#FFFFFF"/></linearGradient>
          <filter id="glow_sng" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg_sng)"/>
        <circle cx="512" cy="512" r="340" fill="none" stroke="url(#g_sng)" stroke-width="72" filter="url(#glow_sng)"/>
        <circle cx="512" cy="512" r="160" fill="#010203"/>
        <circle cx="512" cy="512" r="88" fill="#FFFFFF" filter="url(#glow_sng)"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/><circle cx="512" cy="512" r="340" fill="none" stroke="#00FF66" stroke-width="64"/><circle cx="512" cy="512" r="150" fill="#000"/><circle cx="512" cy="512" r="80" fill="#00FF66"/>
      `,
    },
  ];

  // Wire up each candidate's render and detail views
  for (const c of candidates) {
    c.render = ({ dark }) => K.renderCard(c, dark);
    c.views = makeViews(c);
  }

  window.REVIEW = {
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
    groups: [
    {
        "id": "base",
        "name": "Baseline",
        "note": "Today's shipping mark for comparison"
    },
    {
        "id": "kinetic",
        "name": "01 \u00b7 Kinetic Loops & Perpetual Motion",
        "note": "Continuous 3D ribbons, infinity loops, and orbital momentum"
    },
    {
        "id": "biometrics",
        "name": "02 \u00b7 Biometrics & Vital Signs",
        "note": "Cardio pulses, EKG waveforms, activity arcs, and metabolic rhythms"
    },
    {
        "id": "monogram",
        "name": "03 \u00b7 Monogram FL & Typographic Marks",
        "note": "Architectural, continuous wire, and chamfered geometric letterforms"
    },
    {
        "id": "hud",
        "name": "04 \u00b7 High-Tech HUD & Smart Glasses",
        "note": "Even G2 reticles, telemetry collars, collimators, and glanceable optics"
    },
    {
        "id": "strength",
        "name": "05 \u00b7 Athletic Strength & Raw Power",
        "note": "Olympic plates, knurled iron, torque arcs, and barbell geometries"
    },
    {
        "id": "speed",
        "name": "06 \u00b7 Runners, Speed & Aerodynamics",
        "note": "Pace ribbons, velocity chevrons, wind tunnels, and cadence arcs"
    },
    {
        "id": "minimal",
        "name": "07 \u00b7 Scandinavian & Swiss Minimalism",
        "note": "Pure geometry, monoline rings, Dieter Rams precision, and Bauhaus balance"
    },
    {
        "id": "cyber",
        "name": "08 \u00b7 Cyberpunk, Neon & Synthwave",
        "note": "High-voltage laser grids, phosphor greens, and Tokyo midnight glow"
    },
    {
        "id": "nature",
        "name": "09 \u00b7 Organic Flow & Vital Breath",
        "note": "Oxygen swells, circadian cycles, tidal rhythms, and breath loops"
    },
    {
        "id": "ai",
        "name": "10 \u00b7 AI Agents, MCP & Neural Synapse",
        "note": "Autonomous feedback nodes, neural ribbons, and prompt singularities"
    }
],
    candidates,
  };
})();
