// FitLoop Logo Redesign — Round 2: Vital Sprout Refinements
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
      id: "current", n: 0, group: "base", name: "Current Baseline", baseline: true, prefers: "dark", round: 1,
      tagline: "Today's shipping mark: segmented circle arrow + heavy dumbbell",
      concept: "Today's production app icon. A circular orange progress loop wrapping around an exercise dumbbell.",
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
      id: "vital-sprout", n: 88, group: "nature", name: "Vital Sprout", prefers: "dark", round: 1,
      tagline: "Twin cotyledon seed sprouts bursting open in upward athletic growth",
      concept: "The beginning of every athletic journey: a seed casing bursting open as twin vibrant sprouts reach upward toward the light. Crowned Round 1 Winner.",
      moves: ["Twin curved cotyledon leaves", "Central seed origin node", "Spring lime and botanical green"],
      palette: [["Rich Humus", "#0A1208"], ["Sprout Lime", "#84CC16"], ["Botanical Leaf", "#22C55E"], ["Dew White", "#FFFFFF"]],
      facts: {"Family": "Organic & Flow", "Metaphor": "Sprouting seed growth", "Vibe": "Youthful & Regenerative", "ScaleAt16px": "Crisp V-sprout", "Status": "\ud83c\udfc6 Round 1 Winner"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
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
      id: "sprout-infinity", n: 101, group: "r2-loop", name: "Sprout Infinity", prefers: "dark", round: 2,
      tagline: "Twin cotyledon leaves looping into an eternal infinity base",
      concept: "Fusing the sprout's upward biological growth with the eternal loop of daily athletic consistency: the lower stems cross in a smooth figure-eight loop below the seed core.",
      moves: ["Twin upward cotyledon leaves", "Crossing infinity figure-eight base loop", "Spring lime & electric emerald gradient"],
      palette: [["Humus Dark", "#0B1309"], ["Sprout Lime", "#84CC16"], ["Emerald Flow", "#10B981"], ["Core Light", "#FFFFFF"]],
      facts: {"Focus": "Loop Integration", "Metaphor": "Infinite athletic vitality", "ScaleAt16px": "Crisp infinity-V hybrid", "Vibe": "Continuous & Unstoppable"},
      evenGrid: "............\n...##..##...\n..####.####.\n...######...\n....####....\n...##..##...\n..#..##..#..\n...##..##...\n....####....\n.....##.....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 620 C 440 560 320 540 240 620 C 160 700 200 840 340 840 C 460 840 512 680 512 620 C 512 680 564 840 684 840 C 824 840 864 700 784 620 C 704 540 584 560 512 620 Z" fill="none" stroke="#00FF66" stroke-width="48"/>
    <path d="M 512 600 C 512 380 340 260 220 180 C 380 160 490 320 512 600 Z" fill="#00FF66"/>
    <path d="M 512 600 C 512 380 684 260 804 180 C 644 160 534 320 512 600 Z" fill="#00FF66" opacity="0.65"/>
    <circle cx="512" cy="610" r="38" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-ouroboros", n: 102, group: "r2-loop", name: "Ouroboros Track Sprout", prefers: "dark", round: 2,
      tagline: "Continuous stadium running loop bursting into twin apex cotyledons",
      concept: "A full 360-degree stadium running track curves upward from the base, unfurling at the top into vibrant twin sprout leaves that reach for the sun.",
      moves: ["Full 360\u00b0 stadium track loop", "Top apex cotyledon unfurling", "High-contrast lime-to-green energy circuit"],
      palette: [["Deep Pitch", "#080F06"], ["Spring Lime", "#84CC16"], ["Deep Mint", "#10B981"], ["Pure White", "#FFFFFF"]],
      facts: {"Focus": "Loop Integration", "Metaphor": "Endless training track sprouting life", "ScaleAt16px": "Distinct circular ring with V top", "Vibe": "Cyclic & Energetic"},
      evenGrid: "............\n...##..##...\n..####.####.\n..##....##..\n...######...\n..##....##..\n..##....##..\n..##....##..\n...######...\n....####....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <circle cx="512" cy="540" r="320" fill="none" stroke="#00FF66" stroke-width="50" stroke-dasharray="1400 300" stroke-dashoffset="150"/>
    <path d="M 480 460 C 480 300 320 220 210 150 C 370 140 460 280 480 460 Z" fill="#00FF66"/>
    <path d="M 544 460 C 544 300 704 220 814 150 C 654 140 564 280 544 460 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="500" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-mobius", n: 103, group: "r2-loop", name: "Möbius Cotyledon", prefers: "dark", round: 2,
      tagline: "Single continuous 3D twisting ribbon forming sprout and loop simultaneously",
      concept: "The ultimate expression of mathematical continuity: a single M\u00f6bius strip twists through space, creating a foundation loop at the bottom and opening into twin leaf surfaces at the top.",
      moves: ["3D M\u00f6bius strip twist", "Seamless continuity from root to leaf", "Shaded dimensional ribbons in electric lime"],
      palette: [["Obsidian Green", "#091207"], ["Bright Lime", "#84CC16"], ["Leaf Green", "#22C55E"], ["Forest Green", "#15803D"]],
      facts: {"Focus": "Loop Integration", "Metaphor": "Non-orientable perpetual loop", "ScaleAt16px": "Crisp dimensional twist", "Vibe": "Sophisticated & Mathematical"},
      evenGrid: "............\n..##....##..\n.####..####.\n..###..###..\n...######...\n..####..##..\n..##..####..\n...######...\n....####....\n.....##.....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 360 640 C 260 760 380 860 512 860 C 644 860 764 760 664 640 C 600 560 424 560 360 640 Z" fill="none" stroke="#00FF66" stroke-width="50"/>
    <path d="M 512 600 C 512 400 320 280 220 180 C 400 180 500 360 512 600 Z" fill="#00FF66"/>
    <path d="M 512 600 C 512 400 704 280 804 180 C 624 180 524 360 512 600 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="620" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-interlock", n: 104, group: "r2-loop", name: "Interlocking Sprout Links", prefers: "dark", round: 2,
      tagline: "Dual interlocking ribbon loops uniting athlete effort with AI guidance",
      concept: "Two vibrant continuous loops interlock like chain links at the seed core, each unfurling into an upward cotyledon leaf. Represents the human athlete and their AI training agent bound in mutual growth.",
      moves: ["Two interlocking ribbon loops", "Dual color interplay (Lime + Mint)", "Symbolizes athlete + AI coach synergy"],
      palette: [["Deep Forest", "#0A1408"], ["Neon Lime", "#A3E635"], ["Teal Mint", "#14B8A6"], ["Pure White", "#FFFFFF"]],
      facts: {"Focus": "Loop Integration", "Metaphor": "Athlete + AI agent partnership", "ScaleAt16px": "Distinct interlocking knot", "Vibe": "Connected & Balanced"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..##.##.##..\n..##.##.##..\n...######...\n....####....\n.....##.....\n....####....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 420 740 C 320 740 260 640 260 520 C 260 360 380 260 480 180 C 450 340 400 480 440 600 C 460 660 480 740 420 740 Z" fill="#00FF66"/>
    <path d="M 604 740 C 704 740 764 640 764 520 C 764 360 644 260 544 180 C 574 340 624 480 584 600 C 564 660 544 740 604 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="740" r="42" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-orbit", n: 105, group: "r2-loop", name: "Orbital Sprout Nexus", prefers: "dark", round: 2,
      tagline: "Concentric athletic velocity rings cradling an upward botanical burst",
      concept: "Dual kinetic orbital rings sweep around an illuminated central seed core like planetary momentum, with twin cotyledon leaves shooting skyward from the nucleus.",
      moves: ["Twin tilted orbital momentum rings", "Central radiant seed nucleus", "Dynamic fusion of astronomy and botany"],
      palette: [["Space Pitch", "#070E05"], ["Electric Lime", "#84CC16"], ["Solar Mint", "#34D399"], ["Pure Core", "#FFFFFF"]],
      facts: {"Focus": "Loop Integration", "Metaphor": "Gravitational training momentum", "ScaleAt16px": "Distinct ringed sprout", "Vibe": "Futuristic & Expanding"},
      evenGrid: "............\n..##....##..\n.####..####.\n..###..###..\n...######...\n.##########.\n##...##...##\n.##########.\n....####....\n.....##.....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <ellipse cx="512" cy="720" rx="360" ry="140" fill="none" stroke="#00FF66" stroke-width="40" opacity="0.6" transform="rotate(-15 512 720)"/>
    <path d="M 512 700 C 512 460 320 340 230 200 C 390 190 490 360 512 700 Z" fill="#00FF66"/>
    <path d="M 512 700 C 512 460 704 340 794 200 C 634 190 534 360 512 700 Z" fill="#00FF66" opacity="0.7"/>
    <circle cx="512" cy="710" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-cardio", n: 106, group: "r2-bio", name: "Cardio Sprout", prefers: "dark", round: 2,
      tagline: "Inner leaf margins tracing a live QRS electrocardiogram waveform",
      concept: "Connecting plant vitality directly to the athlete's cardiovascular engine: the inner seam between the two cotyledons forms a high-amplitude EKG heartbeat peak.",
      moves: ["Inner seam traces QRS heartbeat spike", "Organic leaf outer contours", "Biometric pulse indicator in seed core"],
      palette: [["Pulse Black", "#0A1308"], ["Heart Lime", "#84CC16"], ["Cardio Mint", "#22C55E"], ["Electric White", "#FFFFFF"]],
      facts: {"Focus": "Biometrics & Pulse", "Metaphor": "Living heart beating in the plant", "ScaleAt16px": "Crisp heartbeat V-silhouette", "Vibe": "Cardiovascular & Vital"},
      evenGrid: "............\n..##....##..\n.####..####.\n..##....##..\n...######...\n....#..#....\n..##.##.##..\n....#..#....\n....####....\n...######...\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 800 L 460 800 L 480 680 L 440 840 L 400 780 C 300 680 240 500 220 240 C 400 240 480 440 512 560 Z" fill="#00FF66"/>
    <path d="M 512 800 L 564 800 L 544 680 L 584 840 L 624 780 C 724 680 784 500 804 240 C 624 240 544 440 512 560 Z" fill="#00FF66" opacity="0.6"/>
    <polyline points="360,780 420,780 450,860 480,560 512,880 544,560 574,860 604,780 664,780" fill="none" stroke="#FFFFFF" stroke-width="24"/>
      `,
    },
    {
      id: "sprout-pulse-core", n: 107, group: "r2-bio", name: "Pulsing Seed Core", prefers: "dark", round: 2,
      tagline: "Concentric acoustic and optical biometric pulse rings radiating upward",
      concept: "The seed is the heart of the athlete: concentric circular pulse waves radiate upward between the leaves, visualizing heart rate variability (HRV) and continuous metabolic tracking.",
      moves: ["Triple concentric biometric pulse rings", "Twin enclosing protective cotyledons", "Vibrant sensor aura in spring lime"],
      palette: [["Deep Earth", "#0A1308"], ["Sprout Lime", "#84CC16"], ["Bio Green", "#22C55E"], ["Pulse Glow", "#A7F3D0"]],
      facts: {"Focus": "Biometrics & Pulse", "Metaphor": "Heart rate sensor radiating life", "ScaleAt16px": "Distinct radiating core", "Vibe": "Warm & Biometric"},
      evenGrid: "............\n..##....##..\n.####..####.\n..###..###..\n...######...\n..########..\n.##.####.##.\n..########..\n....####....\n.....##.....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <circle cx="512" cy="740" r="140" fill="none" stroke="#00FF66" stroke-width="20" opacity="0.5"/>
    <path d="M 512 740 C 512 480 340 360 220 220 C 380 200 480 380 512 740 Z" fill="#00FF66"/>
    <path d="M 512 740 C 512 480 684 360 804 220 C 644 200 544 380 512 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="740" r="50" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-vo2", n: 108, group: "r2-bio", name: "VO2 Max Swell", prefers: "dark", round: 2,
      tagline: "Asymmetric exponential leaf curve symbolizing athletic aerobic capacity",
      concept: "An intentional asymmetric evolution: while the left leaf provides foundational stability, the right cotyledon ascends in a bold, sweeping exponential curve, embodying athletic threshold progression.",
      moves: ["Dynamic asymmetric leaf geometry", "Ascending exponential VO2 curve", "Forward athletic momentum vector"],
      palette: [["Humus Dark", "#0B1408"], ["Electric Lime", "#84CC16"], ["Aero Cyan", "#06B6D4"], ["White Apex", "#FFFFFF"]],
      facts: {"Focus": "Biometrics & Pulse", "Metaphor": "Exponential aerobic capacity surge", "ScaleAt16px": "Distinct dynamic lean", "Vibe": "Aggressive & Progressive"},
      evenGrid: ".........##.\n........####\n..##....####\n.####..#####\n..###.######\n...#########\n....######..\n.....####...\n.....##.....\n....####....\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 540 360 440 280 320 C 420 300 500 460 512 780 Z" fill="#00FF66" opacity="0.7"/>
    <path d="M 512 780 C 512 460 680 300 840 160 C 700 160 540 380 512 780 Z" fill="#00FF66"/>
    <circle cx="512" cy="790" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-breath", n: 109, group: "r2-bio", name: "Circadian Breath Sprout", prefers: "dark", round: 2,
      tagline: "Soft harmonic tidal respiration curves guiding inhale and recovery",
      concept: "Paced breathing during intense sets: the sprout leaves expand with the gentle geometry of lung capacity, creating an organic rhythm of inhale, power, and oxygen recovery.",
      moves: ["Harmonic tidal respiration curves", "Soft rounded botanical tips", "Calming spring lime and sage gradient"],
      palette: [["Deep Sage", "#091408"], ["Bright Lime", "#84CC16"], ["Sage Mint", "#34D399"], ["Pure Dew", "#FFFFFF"]],
      facts: {"Focus": "Biometrics & Pulse", "Metaphor": "Paced respiratory recovery", "ScaleAt16px": "Full, friendly botanical silhouette", "Vibe": "Restorative & Balanced"},
      evenGrid: "............\n...##..##...\n..####.####.\n.##..#.#..##\n.##..#.#..##\n..####.####.\n...######...\n....####....\n.....##.....\n....####....\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 760 C 512 460 280 400 200 240 C 380 200 500 400 512 760 Z" fill="#00FF66"/>
    <path d="M 512 760 C 512 460 744 400 824 240 C 644 200 524 400 512 760 Z" fill="#00FF66" opacity="0.6"/>
    <ellipse cx="512" cy="780" rx="50" ry="42" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-caloric", n: 110, group: "r2-bio", name: "Thermal Caloric Sprout", prefers: "dark", round: 2,
      tagline: "High-energy metabolic burn gradient radiating from solar amber core to lime tips",
      concept: "Visualizing metabolic calorie burn: the seed origin burns with radiant solar orange energy, transferring athletic fire upward into vibrant photosynthetic lime leaves.",
      moves: ["Thermal calorie gradient (Orange to Lime)", "High-contrast metabolic core", "Visual heat-to-growth transfer"],
      palette: [["Pitch Charcoal", "#0A0E08"], ["Solar Amber", "#F97316"], ["Sprout Lime", "#84CC16"], ["White Flame", "#FFFFFF"]],
      facts: {"Focus": "Biometrics & Pulse", "Metaphor": "Metabolic fuel burning into athletic growth", "ScaleAt16px": "Distinct warm core glowing inside lime", "Vibe": "Fiery & Energetic"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n...######...\n....####....\n...######...\n....####....\n.....##.....\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.7"/>
    <circle cx="512" cy="790" r="48" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-reticle", n: 111, group: "r2-hud", name: "Reticle Sprout", prefers: "dark", round: 2,
      tagline: "Optical HUD targeting brackets framing the upward botanical sprout",
      concept: "Engineered directly for the Even G2 smart glasses display: four corner targeting reticle brackets lock onto the seed origin, turning the organic sprout into a high-tech optical telemetry mark.",
      moves: ["Four corner HUD reticle brackets", "Precision 90-degree alignment", "Targeting lock on seed core"],
      palette: [["HUD Pitch", "#050B04"], ["Phosphor Green", "#84CC16"], ["Emerald HUD", "#10B981"], ["Laser White", "#FFFFFF"]],
      facts: {"Focus": "Even G2 HUD", "Metaphor": "Target acquired on your personal best", "ScaleAt16px": "Framed high-tech V", "Vibe": "Tactical & Glanceable"},
      evenGrid: "##........##\n#..........#\n...##..##...\n..####.####.\n...######...\n....####....\n....####....\n.....##.....\n#...####...#\n##........##\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 180 280 L 180 180 L 280 180 M 844 280 L 844 180 L 744 180 M 180 744 L 180 844 L 280 844 M 844 744 L 844 844 L 744 844" fill="none" stroke="#00FF66" stroke-width="32"/>
    <path d="M 512 760 C 512 500 340 380 260 260 C 400 240 500 420 512 760 Z" fill="#00FF66"/>
    <path d="M 512 760 C 512 500 684 380 764 260 C 624 240 524 420 512 760 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="760" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-collimator", n: 112, group: "r2-hud", name: "Collimator Cotyledon", prefers: "dark", round: 2,
      tagline: "Precision optical collimator crosshairs bisecting the seed origin",
      concept: "Smart glasses optical alignment: hairline crosshair collimator axes center directly onto the seed nucleus, combining sniper-like biometric precision with botanical vitality.",
      moves: ["Precision crosshair collimator lines", "Center laser optical sighting dot", "Streamlined cotyledon blades"],
      palette: [["Optic Black", "#060D05"], ["Laser Lime", "#84CC16"], ["Optic Green", "#10B981"], ["Reticle White", "#FFFFFF"]],
      facts: {"Focus": "Even G2 HUD", "Metaphor": "Collimated optical focus", "ScaleAt16px": "Distinct crosshair seed", "Vibe": "Ultra-precise & Focused"},
      evenGrid: ".....##.....\n.##..##..##.\n.####..####.\n..########..\n####.##.####\n..########..\n...######...\n....####....\n.....##.....\n....####....\n.....##.....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <line x1="512" y1="160" x2="512" y2="860" stroke="#00FF66" stroke-width="14" stroke-dasharray="20 16" opacity="0.4"/>
    <line x1="200" y1="740" x2="824" y2="740" stroke="#00FF66" stroke-width="14" stroke-dasharray="20 16" opacity="0.4"/>
    <path d="M 512 740 C 512 480 340 360 240 240 C 400 220 500 400 512 740 Z" fill="#00FF66"/>
    <path d="M 512 740 C 512 480 684 360 784 240 C 624 220 524 400 512 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="740" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-digital-twin", n: 113, group: "r2-hud", name: "Digital Twin Sprout", prefers: "dark", round: 2,
      tagline: "Left leaf organic nature, right leaf segmented digital HUD telemetry",
      concept: "The core metaphor of FitLoop: the left cotyledon is smooth botanical nature (the athlete's biological body), while the right cotyledon is formed by digital HUD telemetry segments (the AI agent model).",
      moves: ["Hybrid analog/digital split", "Right leaf digital HUD telemetry slats", "Seamless meeting at central seed node"],
      palette: [["Deep Void", "#070D05"], ["Biological Lime", "#84CC16"], ["Digital Cyan", "#06B6D4"], ["Interface White", "#FFFFFF"]],
      facts: {"Focus": "Even G2 HUD", "Metaphor": "Biological athlete + digital AI twin", "ScaleAt16px": "Distinct solid/slat split", "Vibe": "Hybrid & Cybernetic"},
      evenGrid: "............\n..##....##..\n.####...##..\n.####...##..\n..###...##..\n...##...##..\n....######..\n....####....\n.....##.....\n....####....\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 524 720 C 540 680 580 640 640 640 C 600 680 560 720 524 720 Z" fill="#00FF66" opacity="0.6"/>
    <path d="M 534 600 C 560 540 640 500 700 500 C 660 550 600 600 534 600 Z" fill="#00FF66" opacity="0.7"/>
    <path d="M 540 480 C 580 400 700 360 760 360 C 700 420 620 480 540 480 Z" fill="#00FF66" opacity="0.8"/>
    <path d="M 544 340 C 600 260 740 220 800 220 C 740 280 640 340 544 340 Z" fill="#00FF66"/>
    <circle cx="512" cy="790" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-telemetry", n: 114, group: "r2-hud", name: "Telemetry Sprout Collar", prefers: "dark", round: 2,
      tagline: "Glanceable arc gauge displaying sets, reps, and heart rate surrounding the sprout",
      concept: "A full athletic cockpit on your smart glasses: a 270-degree HUD telemetry collar wraps around the lower sprout, displaying workout completion and vital zones without clutter.",
      moves: ["270\u00b0 HUD telemetry arc gauge", "Segmented athletic metric ticks", "Clean central sprout focal point"],
      palette: [["Graphite HUD", "#081006"], ["Telemetry Lime", "#84CC16"], ["Active Emerald", "#10B981"], ["Clean White", "#FFFFFF"]],
      facts: {"Focus": "Even G2 HUD", "Metaphor": "Cockpit heads-up instrumentation", "ScaleAt16px": "Crisp arc collar + V", "Vibe": "Informative & Tactical"},
      evenGrid: "............\n..##....##..\n.####..####.\n..###..###..\n##.######.##\n#...####...#\n#...####...#\n##.######.##\n...######...\n....####....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 240 460 A 340 340 0 1 0 784 460" fill="none" stroke="#00FF66" stroke-width="36" stroke-linecap="round" stroke-dasharray="80 30 180 30 280 30"/>
    <path d="M 512 740 C 512 480 340 380 260 260 C 400 240 500 420 512 740 Z" fill="#00FF66"/>
    <path d="M 512 740 C 512 480 684 380 764 260 C 624 240 524 420 512 740 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="750" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-vector-wire", n: 115, group: "r2-hud", name: "Vector Wire Sprout", prefers: "dark", round: 2,
      tagline: "Stark green phosphor vector line art crafted for the 0.15\" Micro-LED engine",
      concept: "Pure vector efficiency: stripped of heavy solid fills, this mark is built from pure 28px phosphor green stroke paths. Uses zero unnecessary micro-LED pixels on the Even G2 glasses for maximum battery life.",
      moves: ["100% stroke-based phosphor vector line art", "Zero battery waste on Even G2 green OLED", "High-contrast geometric minimalism"],
      palette: [["True Black", "#000000"], ["Phosphor 530nm", "#00FF66"], ["Muted Phosphor", "#00CC52"], ["Highlight", "#E6FFEE"]],
      facts: {"Focus": "Even G2 HUD", "Metaphor": "Pure green phosphor vector laser", "ScaleAt16px": "Ultra-sharp wireframe", "Vibe": "Stark & Hardware-native"},
      evenGrid: "............\n.###....###.\n#...#..#...#\n.#...##...#.\n..#..##..#..\n...#....#...\n....#..#....\n.....##.....\n....#..#....\n.....##.....\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#020402"/>
    <!-- Wire Left Leaf -->
    <path d="M 512 760 C 512 480 320 360 240 240 C 400 220 500 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"/>
    <!-- Wire Right Leaf -->
    <path d="M 512 760 C 512 480 704 360 784 240 C 624 220 524 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="48" stroke-linejoin="round"/>
    <circle cx="512" cy="760" r="48" fill="none" stroke="#00FF66" stroke-width="48"/>
    <circle cx="512" cy="760" r="16" fill="#00FF66"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 760 C 512 480 320 360 240 240 C 400 220 500 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="44"/>
    <path d="M 512 760 C 512 480 704 360 784 240 C 624 220 524 400 512 760 Z" fill="none" stroke="#00FF66" stroke-width="44"/>
    <circle cx="512" cy="760" r="44" fill="none" stroke="#00FF66" stroke-width="44"/>
      `,
    },
    {
      id: "sprout-monogram-fl", n: 116, group: "r2-monogram", name: "Monogram Sprout FL", prefers: "dark", round: 2,
      tagline: "Left leaf and stem forming the 'F', base trajectory sweeping into the 'L'",
      concept: "A subtle typographic Easter egg hidden in plain sight: the left cotyledon and central stem form the horizontal bars of an 'F', while the lower stem sweeps smoothly to the right to complete an 'L'.",
      moves: ["Left leaf forms top and mid bars of 'F'", "Stem base curves right into 'L'", "Organic botanical silhouette preserved"],
      palette: [["Deep Forest", "#091207"], ["Sprout Lime", "#84CC16"], ["Leaf Emerald", "#10B981"], ["Bright White", "#FFFFFF"]],
      facts: {"Focus": "Monogram FL", "Metaphor": "Typographic FL secretly hidden in nature", "ScaleAt16px": "Balanced monogram-sprout hybrid", "Vibe": "Clever & Branded"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n..########..\n...######...\n...##.......\n...##.......\n...######...\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 460 760 C 460 520 280 400 200 260 C 380 240 440 380 460 520 L 320 520 L 320 440 L 460 440 Z" fill="#00FF66"/>
    <path d="M 512 760 C 512 500 704 380 784 260 C 624 240 524 420 512 760 Z" fill="#00FF66" opacity="0.6"/>
    <path d="M 460 720 L 460 820 C 460 860 500 860 660 860" fill="none" stroke="#00FF66" stroke-width="48"/>
      `,
    },
    {
      id: "sprout-stencil-fl", n: 117, group: "r2-monogram", name: "Stencil Sprout FL", prefers: "dark", round: 2,
      tagline: "High-speed 45-degree athletic stencil cuts structuring the cotyledon leaves",
      concept: "Military athletics meet botanical energy: 45-degree forward angled speed cutouts segment the cotyledon leaves, giving the sprout the athletic aggression of competition track spikes.",
      moves: ["45\u00b0 forward-raked stencil cuts", "High-velocity athletic breaks", "Aggressive modern performance posture"],
      palette: [["Carbon Matte", "#0A1008"], ["Volt Lime", "#A3E635"], ["Dark Mint", "#059669"], ["Pure Core", "#FFFFFF"]],
      facts: {"Focus": "Monogram FL", "Metaphor": "Athletic track stencil cutouts", "ScaleAt16px": "Segmented dynamic V", "Vibe": "Aggressive & Kinetic"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n............\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
      svg: () => `
<defs>
      <linearGradient id="bg_117" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E190B"/><stop offset="1" stop-color="#020401"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_117)"/>
    <!-- Left Stencil Leaf -->
    <path d="M 500 760 C 500 580 380 460 300 360 L 240 260 C 380 240 440 320 460 400 L 400 460 L 480 460 C 490 560 500 660 500 760 Z" fill="#A3E635"/>
    <!-- Right Stencil Leaf -->
    <path d="M 524 760 C 524 580 644 460 724 360 L 784 260 C 644 240 584 320 564 400 L 624 460 L 544 460 C 534 560 524 660 524 760 Z" fill="#059669"/>
    <circle cx="512" cy="780" r="44" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 500 760 C 500 580 380 460 300 360 L 240 260 C 380 240 440 320 460 400 L 400 460 L 480 460 C 490 560 500 660 500 760 Z" fill="#00FF66"/>
    <path d="M 524 760 C 524 580 644 460 724 360 L 784 260 C 644 240 584 320 564 400 L 624 460 L 544 460 C 534 560 524 660 524 760 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="780" r="40" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-chamfer-fl", n: 118, group: "r2-monogram", name: "Chamfer Sprout FL", prefers: "dark", round: 2,
      tagline: "Aerodynamic 45-degree chamfers faceted into the botanical leaf edges",
      concept: "Precision racecar aerodynamics applied to natural botany: each leaf edge is chamfered with crisp 45-degree bevels, creating sharp light reflections like machined billet aluminum.",
      moves: ["Machined 45\u00b0 chamfered facets", "Aerodynamic forward rake", "High-spec engineered finish"],
      palette: [["Graphite Void", "#070D05"], ["Neon Lime", "#84CC16"], ["Anodized Green", "#16A34A"], ["Silver Highlight", "#F1F5F9"]],
      facts: {"Focus": "Monogram FL", "Metaphor": "Billet aluminum botanical sculpture", "ScaleAt16px": "Crisp geometric V-facets", "Vibe": "Engineered & Premium"},
      evenGrid: "............\n....#..#....\n..###..###..\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <polygon points="512,760 480,540 280,340 240,240 340,240 480,420 512,760" fill="#00FF66"/>
    <polygon points="512,760 544,540 744,340 784,240 684,240 544,420 512,760" fill="#00FF66" opacity="0.6"/>
    <polygon points="512,730 540,760 512,790 484,760" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-architectural", n: 119, group: "r2-monogram", name: "Architectural Sprout", prefers: "dark", round: 2,
      tagline: "Structural grid alignment with heavyweight Bauhaus typographic bones",
      concept: "Stripping out decorative fluff in favor of structural clarity: the sprout is architected on a modular typographic grid, balancing heavyweight vertical stems with elegant cantilevered leaves.",
      moves: ["Architectural structural grid", "Cantilevered cotyledon leaves", "Bauhaus modernist balance"],
      palette: [["Pitch Humus", "#091207"], ["Bright Lime", "#84CC16"], ["Architect Green", "#15803D"], ["Stark White", "#FFFFFF"]],
      facts: {"Focus": "Monogram FL", "Metaphor": "Architectural botanical monument", "ScaleAt16px": "Heavy, confident mark", "Vibe": "Sturdy & Authoritative"},
      evenGrid: "............\n..##....##..\n.####..####.\n..###..###..\n...######...\n....####....\n....####....\n....####....\n....####....\n...######...\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 480 760 L 480 480 C 480 340 340 260 220 220 C 380 200 480 300 480 480 Z" fill="#00FF66"/>
    <path d="M 544 760 L 544 480 C 544 340 684 260 804 220 C 644 200 544 300 544 480 Z" fill="#00FF66" opacity="0.6"/>
    <rect x="484" y="480" width="56" height="300" fill="#00FF66"/>
    <circle cx="512" cy="780" r="42" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-wire-fl", n: 120, group: "r2-monogram", name: "Continuous Wire FL Sprout", prefers: "dark", round: 2,
      tagline: "Single unbroken neon tube tracing F, sprouting leaves, and completing L",
      concept: "The pure synthesis of typography and botany: an unbroken 48px luminous neon tube starts at the F crossbar, loops up through the twin sprout leaves, and sweeps through the foundational L baseline.",
      moves: ["Single unbroken 48px continuous line", "Unites 'F', sprout leaves, and 'L'", "Luminous neon glow effect"],
      palette: [["Neon Void", "#050B04"], ["Electric Lime", "#84CC16"], ["Glow Mint", "#22C55E"], ["White Center", "#FFFFFF"]],
      facts: {"Focus": "Monogram FL", "Metaphor": "Continuous wire neon tube", "ScaleAt16px": "Single stroke clarity", "Vibe": "Seamless & Electrifying"},
      evenGrid: "............\n.#####..##..\n.##..#.####.\n.#####.####.\n.##..#####..\n...#..##....\n...#..##....\n...#..##....\n...######...\n....####....\n............\n............",
      svg: () => `
<defs>
      <linearGradient id="bg_120" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B170A"/><stop offset="1" stop-color="#020401"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_120)"/>
    <path d="M 320 440 L 480 440 C 480 320 360 260 240 200 C 400 180 500 320 512 600 C 524 320 624 180 784 200 C 664 260 544 320 544 440 L 512 760 C 512 840 560 840 680 840" fill="none" stroke="#84CC16" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="512" cy="620" r="38" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 320 440 L 480 440 C 480 320 360 260 240 200 C 400 180 500 320 512 600 C 524 320 624 180 784 200 C 664 260 544 320 544 440 L 512 760 C 512 840 560 840 680 840" fill="none" stroke="#00FF66" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="512" cy="620" r="32" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-golden", n: 121, group: "r2-minimal", name: "Golden Ratio Cotyledon", prefers: "dark", round: 2,
      tagline: "Leaf curvature calibrated to the exact Fibonacci golden spiral (phi = 1.618)",
      concept: "Rooted in the timeless mathematics of natural growth: the outer and inner margins of both leaves strictly trace golden spiral radii, delivering natural harmonic proportion and effortless visual balance.",
      moves: ["Golden ratio (\u03c6 = 1.618) spiral curves", "Harmonic natural geometry", "Dieter Rams functionalist balance"],
      palette: [["Swiss Humus", "#0A1208"], ["Sprout Lime", "#84CC16"], ["Leaf Emerald", "#10B981"], ["Harmonic White", "#FFFFFF"]],
      facts: {"Focus": "Swiss Geometry", "Metaphor": "Sacred Fibonacci botanical growth", "ScaleAt16px": "Effortless harmonic beauty", "Vibe": "Harmonic & Timeless"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
      svg: () => `
<defs>
      <linearGradient id="bg_121" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1B0C"/><stop offset="1" stop-color="#030602"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg_121)"/>
    <!-- Left Golden Leaf -->
    <path d="M 512 780 C 512 480 340 340 236 216 C 398 216 486 380 512 780 Z" fill="#84CC16"/>
    <!-- Right Golden Leaf -->
    <path d="M 512 780 C 512 480 684 340 788 216 C 626 216 538 380 512 780 Z" fill="#10B981"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 480 340 340 236 216 C 398 216 486 380 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 480 684 340 788 216 C 626 216 538 380 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-monoline", n: 122, group: "r2-minimal", name: "Monoline Sprout Ring", prefers: "dark", round: 2,
      tagline: "Hairline circular monoline ring blossoming open into twin minimalist leaf arcs",
      concept: "Ultra-restrained minimalism: a pristine 32px circular monoline contour rests at the base, effortlessly blooming into twin geometric leaf arcs at the top.",
      moves: ["Pristine 32px hairline circular geometry", "Blossoming open apex leaf arcs", "Zero extraneous decoration"],
      palette: [["Matte Charcoal", "#080F07"], ["Pure Lime", "#84CC16"], ["Muted Sage", "#4ADE80"], ["Crisp White", "#FFFFFF"]],
      facts: {"Focus": "Swiss Geometry", "Metaphor": "Zen monoline circle blooming", "ScaleAt16px": "Ultra-pure ring with V ears", "Vibe": "Minimal & Zen"},
      evenGrid: "............\n...##..##...\n..####.####.\n..##....##..\n...######...\n..##....##..\n..##....##..\n..##....##..\n...######...\n....####....\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#050A04"/>
    <!-- Outer Base Ring -->
    <path d="M 280 480 A 280 280 0 1 0 744 480" fill="none" stroke="#84CC16" stroke-width="48" stroke-linecap="round"/>
    <!-- Left Leaf Arc -->
    <path d="M 512 680 C 512 480 360 360 260 220 C 400 220 480 380 512 680" fill="none" stroke="#84CC16" stroke-width="48" stroke-linecap="round"/>
    <!-- Right Leaf Arc -->
    <path d="M 512 680 C 512 480 664 360 764 220 C 624 220 544 380 512 680" fill="none" stroke="#4ADE80" stroke-width="48" stroke-linecap="round"/>
    <circle cx="512" cy="690" r="32" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 280 480 A 280 280 0 1 0 744 480" fill="none" stroke="#00FF66" stroke-width="42" stroke-linecap="round"/>
    <path d="M 512 680 C 512 480 360 360 260 220 C 400 220 480 380 512 680" fill="none" stroke="#00FF66" stroke-width="42"/>
    <path d="M 512 680 C 512 480 664 360 764 220 C 624 220 544 380 512 680" fill="none" stroke="#00FF66" opacity="0.6" stroke-width="42"/>
    <circle cx="512" cy="690" r="28" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-translucent", n: 123, group: "r2-minimal", name: "Overlapping Translucent Sprout", prefers: "dark", round: 2,
      tagline: "Two pure geometric leaf lenses creating a luminous third overlap tone",
      concept: "Swiss color interaction: two translucent pure circular-arc leaves cross each other, creating an illuminated chartreuse overlap zone in the center where energy concentrates.",
      moves: ["Translucent overlapping color geometry", "Vibrant chartreuse intersection core", "Modernist chromatic purity"],
      palette: [["Graphite Dark", "#091207"], ["Lime Translucent", "#84CC16"], ["Cyan Translucent", "#06B6D4"], ["Intersection Glow", "#BEF264"]],
      facts: {"Focus": "Swiss Geometry", "Metaphor": "Optical color interaction of training + recovery", "ScaleAt16px": "Distinct luminous lens overlap", "Vibe": "Luminous & Sophisticated"},
      evenGrid: "............\n...##..##...\n..########..\n..########..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="790" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-silhouette", n: 124, group: "r2-minimal", name: "Minimal Silhouette Sprout", prefers: "dark", round: 2,
      tagline: "Stark high-contrast solid silhouette with zero non-essential detail",
      concept: "Engineered for ultimate micro-scale legibility: zero gradients, zero shadows, zero complex cutouts. Just a solid, bold, athletic sprout silhouette that remains unmistakable at 16\u00d716px.",
      moves: ["100% solid flat silhouette", "Zero gradients or skeuomorphism", "Maximum legibility at micro scales"],
      palette: [["Void Pitch", "#040803"], ["Solid Volt", "#A3E635"], ["Solid White", "#FFFFFF"]],
      facts: {"Focus": "Swiss Geometry", "Metaphor": "Pure iconic silhouette", "ScaleAt16px": "100% indestructible contrast", "Vibe": "Direct & Bold"},
      evenGrid: "............\n.###....###.\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...##..##...\n....####....\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#070E05"/>
    <!-- Solid Left Leaf -->
    <path d="M 512 780 C 512 460 300 340 220 220 C 400 220 500 420 512 780 Z" fill="#A3E635"/>
    <!-- Solid Right Leaf -->
    <path d="M 512 780 C 512 460 724 340 804 220 C 624 220 524 420 512 780 Z" fill="#A3E635"/>
    <circle cx="512" cy="800" r="56" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 460 300 340 220 220 C 400 220 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 460 724 340 804 220 C 624 220 524 420 512 780 Z" fill="#00FF66"/>
    <circle cx="512" cy="800" r="50" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-bauhaus", n: 125, group: "r2-minimal", name: "Geometric Bauhaus Sprout", prefers: "dark", round: 2,
      tagline: "Pure circular sectors and triangular wedge foundation in dynamic tension",
      concept: "Constructivist botanical design: the sprout leaves are pure 90-degree circular sector quadrants, and the seed origin is an inverted geometric triangle, achieving clean Bauhaus functionalism.",
      moves: ["Pure 90\u00b0 circular quadrant leaves", "Inverted equilateral triangle seed base", "Constructivist graphic clarity"],
      palette: [["Bauhaus Dark", "#081006"], ["Volt Lime", "#84CC16"], ["Cobalt Green", "#0D9488"], ["Primary White", "#FFFFFF"]],
      facts: {"Focus": "Swiss Geometry", "Metaphor": "Bauhaus modernist geometry", "ScaleAt16px": "Distinct geometric quadrants", "Vibe": "Rational & Historic"},
      evenGrid: "............\n..####.####.\n.#####.#####\n..####.####.\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#091307"/>
    <!-- Left Quadrant Leaf -->
    <path d="M 512 700 L 260 448 A 252 252 0 0 1 512 196 Z" fill="#84CC16"/>
    <!-- Right Quadrant Leaf -->
    <path d="M 512 700 L 764 448 A 252 252 0 0 0 512 196 Z" fill="#0D9488"/>
    <!-- Triangle Seed Wedge -->
    <polygon points="512,860 440,720 584,720" fill="#FFFFFF"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 700 L 260 448 A 252 252 0 0 1 512 196 Z" fill="#00FF66"/>
    <path d="M 512 700 L 764 448 A 252 252 0 0 0 512 196 Z" fill="#00FF66" opacity="0.6"/>
    <polygon points="512,860 440,720 584,720" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-cyber-lime", n: 126, group: "r2-palette", name: "Electric Lime & Carbon", prefers: "dark", round: 2,
      tagline: "High-voltage #CCFF00 neon lime leaves over a deep starlight carbon texture",
      concept: "Maximal contrast for modern OLED displays: super-saturated #CCFF00 neon volt lime leaves emerge from an ultra-deep midnight carbon gradient, projecting raw electric training intensity.",
      moves: ["Ultra-saturated #CCFF00 volt lime", "Subtle carbon starlight backdrop", "Maximum pop on dark mode Apple Watch"],
      palette: [["Carbon Weave", "#060A05"], ["High-Volt Lime", "#CCFF00"], ["Emerald Core", "#10B981"], ["Supernova White", "#FFFFFF"]],
      facts: {"Focus": "Finish & Palette", "Metaphor": "High-voltage athletic charge", "ScaleAt16px": "Unstoppable vibrant neon", "Vibe": "Hyper-electric & Modern"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.65"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-solar-citrus", n: 127, group: "r2-palette", name: "Solar Citrus Sprout", prefers: "dark", round: 2,
      tagline: "Warm athletic solar orange bleeding into fresh spring lime gradients",
      concept: "Capturing the golden hour sunrise of early morning training: warm athletic solar amber blends into crisp photosynthetic lime, radiating warmth, optimism, and early-morning grit.",
      moves: ["Solar amber to spring lime gradient", "Morning sunrise workout aura", "Invigorating warm athletic vibe"],
      palette: [["Deep Roast", "#0F0F07"], ["Solar Amber", "#F59E0B"], ["Spring Lime", "#84CC16"], ["Pure Sun", "#FFFFFF"]],
      facts: {"Focus": "Finish & Palette", "Metaphor": "Sunrise morning workout energy", "ScaleAt16px": "Warm dual-tone glow", "Vibe": "Warm & Inspiring"},
      evenGrid: "............\n...##..##...\n..####.####.\n..##....##..\n...######...\n....####....\n...######...\n..########..\n...######...\n....####....\n.....##.....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-emerald", n: 128, group: "r2-palette", name: "Deep Emerald Vitality", prefers: "dark", round: 2,
      tagline: "Deep forest jade and botanical emerald with jewel-like dimensionality",
      concept: "Luxury sports aesthetic: rich forest emerald, alpine pine, and translucent jade gradients create a mature, grounded athletic identity that feels prestigious on titanium Apple Watch cases.",
      moves: ["Prestige alpine emerald and jade", "Multi-layered depth without skeuomorphism", "Sophisticated high-end sports feel"],
      palette: [["Alpine Forest", "#05130A"], ["Vibrant Jade", "#10B981"], ["Deep Emerald", "#047857"], ["Frosted White", "#F0FDF4"]],
      facts: {"Focus": "Finish & Palette", "Metaphor": "Alpine mountain pine resilience", "ScaleAt16px": "Rich deep-contrast green", "Vibe": "Mature & Prestigious"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-biolum", n: 129, group: "r2-palette", name: "Bioluminescent Phosphor", prefers: "dark", round: 2,
      tagline: "Abyssal starlight background with glowing neon cyan-lime leaf halos",
      concept: "Deep-sea and night-run energy: the cotyledon leaf edges cast a soft cyan bioluminescent glow into the surrounding abyss, turning late-night workouts into luminous experiences.",
      moves: ["Soft cyan bioluminescent halo", "Dual-tone lime & cyan glow", "Designed for late-night running & lifting"],
      palette: [["Abyssal Void", "#02070A"], ["Biolum Cyan", "#06B6D4"], ["Neon Lime", "#84CC16"], ["Radiant White", "#FFFFFF"]],
      facts: {"Focus": "Finish & Palette", "Metaphor": "Living night-glow in the dark", "ScaleAt16px": "Distinct cyan-lime aura", "Vibe": "Mysterious & Luminous"},
      evenGrid: "............\n...##..##...\n..####.####.\n.##..#.#..##\n.##..#.#..##\n..####.####.\n...######...\n....####....\n.....##.....\n....####....\n....####....\n............",
      svg: () => `
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
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#00FF66"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#00FF66" opacity="0.65"/>
    <circle cx="512" cy="800" r="44" fill="#00FF66"/>
      `,
    },
    {
      id: "sprout-mono-pure", n: 130, group: "r2-palette", name: "Pure Monochrome Sprout", prefers: "dark", round: 2,
      tagline: "Stark Swiss high-contrast black and white edition with perfect tactile contrast",
      concept: "The acid test of any iconic brand identity: rendered purely in optical black and chalk white, the twin cotyledons and seed node achieve timeless athletic authority.",
      moves: ["100% monochrome black and white", "Uncompromising optical contrast", "Works on any background material"],
      palette: [["Pitch Black", "#000000"], ["Chalk White", "#FFFFFF"], ["Graphite Half-Tone", "#666666"]],
      facts: {"Focus": "Finish & Palette", "Metaphor": "Timeless monochrome authority", "ScaleAt16px": "Unstoppable stark contrast", "Vibe": "Timeless & Iconic"},
      evenGrid: "............\n..##....##..\n.####..####.\n.####..####.\n..###..###..\n...######...\n....####....\n.....##.....\n....####....\n...######...\n....####....\n............",
      svg: () => `
<rect width="1024" height="1024" fill="#0A0A0A"/>
    <!-- Left Leaf White -->
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#FFFFFF"/>
    <!-- Right Leaf Half-Tone -->
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#888888"/>
    <circle cx="512" cy="800" r="48" fill="#FFFFFF"/>
    <circle cx="512" cy="800" r="24" fill="#0A0A0A"/>
      `,
      svgMono: () => `
<rect width="1024" height="1024" fill="#000"/>
    <path d="M 512 780 C 512 500 320 380 240 260 C 400 240 500 420 512 780 Z" fill="#FFFFFF"/>
    <path d="M 512 780 C 512 500 704 380 784 260 C 624 240 524 420 512 780 Z" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="512" cy="800" r="44" fill="#FFFFFF"/>
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
    groups: [
    {
        "id": "base",
        "name": "Baseline",
        "note": "Today's shipping mark for comparison"
    },
    {
        "id": "nature",
        "name": "09 \u00b7 Round 1 Winner: Vital Sprout",
        "note": "Candidate 88 selected by user in Round 1"
    },
    {
        "id": "r2-loop",
        "name": "R2 \u00b7 Sprout + Loop & Infinity",
        "note": "Integrating twin cotyledons with perpetual athletic track loops"
    },
    {
        "id": "r2-bio",
        "name": "R2 \u00b7 Sprout + Biometrics & Pulse",
        "note": "Cardio waveforms, pulsing seed cores, and vital breath rhythms"
    },
    {
        "id": "r2-hud",
        "name": "R2 \u00b7 Sprout + Even G2 HUD Reticle",
        "note": "Collimator optical brackets, targeting nodes, and glasses-first geometry"
    },
    {
        "id": "r2-monogram",
        "name": "R2 \u00b7 Sprout + Monogram FL",
        "note": "Twin leaves architected into subtle F and L letterforms"
    },
    {
        "id": "r2-minimal",
        "name": "R2 \u00b7 Sprout + Swiss Geometry",
        "note": "Geometric circular arcs, golden ratio curves, and monoline balance"
    },
    {
        "id": "r2-palette",
        "name": "R2 \u00b7 Sprout + Finish & Materiality",
        "note": "Electric neon, solar citrus, emerald gradient, and dark-mode glow"
    }
],
    candidates,
  };
})();
