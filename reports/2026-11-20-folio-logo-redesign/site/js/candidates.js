// Folio Logo Redesign Candidates
// Baseline (00) + 20 distinct candidates across 4 conceptual territories:
// 01–05: Paper & Craft (tactile paper-and-ink evolutions)
// 06–10: Multi-Agent Collaboration (shared artifacts, cursors, versions, diffs)
// 11–15: Typographic & Monogram "F" (folded, serif, geometric, negative-space, stencil)
// 16–20: Architectural & Abstract Marks (open spread, prism, bento, wax seal, horizon deck)
(() => {
  const K = KIT;
  const C = [];
  const add = (c) => C.push(K.attachViews(c));

  // ══════════════════════════════════════════════════════════════════
  // BASELINE · Candidate 00
  // ══════════════════════════════════════════════════════════════════
  add({
    id: "current",
    n: 0,
    baseline: true,
    name: "Current logo",
    tagline: "Flat cobalt square with two stacked dog-eared document sheets",
    concept: "Faithful 1:1 recreation of Folio's production icon.svg and iOS AppIcon.png: solid cobalt (#2f5bea) background, a translucent back page, and a white front page with a folded corner and two text lines. Clean and functional, but generic—reads like a standard copy/document utility rather than a shared AI artifact studio.",
    palette: [["Cobalt", "#2F5BEA"], ["Paper White", "#FFFFFF"], ["Ghost Sheet", "#7793F1"]],
    moves: [
      "Exact 16× scale of projects/folio/services/web/public/icon.svg",
      "Solid #2f5bea background with 35% opacity rear sheet",
      "White foreground page with cobalt corner fold and two rules",
    ],
    facts: { Family: "Baseline", Silhouette: "Stacked sheets", Effort: "—" },
    draw: () => `
      <rect width="1024" height="1024" fill="#2F5BEA"/>
      <g transform="scale(16)">
        <path d="M24 12h19l8 8v26a2 2 0 0 1-2 2H24a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z" fill="#FFFFFF" opacity="0.35"/>
        <path d="M17 18h19l8 8v23a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z" fill="#FFFFFF"/>
        <path d="M36 18v6a2 2 0 0 0 2 2h6" fill="none" stroke="#2F5BEA" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M22 34h15M22 40h11" stroke="#2F5BEA" stroke-width="3" stroke-linecap="round"/>
      </g>
    `,
  });

  // ══════════════════════════════════════════════════════════════════
  // 01–05 · PAPER & CRAFT
  // ══════════════════════════════════════════════════════════════════

  // 01 · Letterpress Stack
  add({
    id: "letterpress-stack",
    n: 1,
    name: "Letterpress Stack",
    tagline: "Warm cream paper base, deep ink sheets, and one cobalt dog-ear fold",
    concept: "Brings Folio's exact web aesthetic ('quiet paper-and-ink workspace') onto the icon itself. Instead of a loud blue square, the canvas is warm archival cream (#F7F6F2) with a deep charcoal ink sheet and a single cobalt folded corner that signals the active artifact. Adapts effortlessly to dark mode by inverting to matte obsidian ink.",
    palette: [["Warm Paper", "#F7F6F2"], ["Deep Ink", "#1C1C1A"], ["Cobalt Fold", "#2F5BEA"], ["Stone Edge", "#D9D5CA"]],
    moves: [
      "Directly echoes Folio's --bg (#F7F6F2) and --fg (#1C1C1A) tokens",
      "Layered editorial folio sheets with subtle letterpress drop shadow",
      "Single cobalt dog-ear accent anchors brand recognition at 16px",
    ],
    facts: { Family: "Paper & Craft", Silhouette: "Folded folio", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      const bg1 = dark ? "#1F1F1D" : "#FBF9F4";
      const bg2 = dark ? "#141413" : "#ECE8DE";
      const backFill = dark ? "#2C2C29" : "#E2DDD0";
      const frontFill = dark ? "#242422" : "#FFFFFF";
      const frontStroke = dark ? "#3A3A36" : "#DCD7CA";
      const ink = dark ? "#ECEBE5" : "#1C1C1A";
      const cobalt = dark ? "#6E8FFF" : "#2F5BEA";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${bg1}"/>
            <stop offset="100%" stop-color="${bg2}"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity="${dark ? "0.45" : "0.14"}"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Back archival sheet slightly rotated -->
        <rect x="278" y="168" width="492" height="632" rx="56" transform="rotate(5 524 484)" fill="${backFill}"/>
        <!-- Front crisp folio sheet -->
        <g filter="url(#${uid}_sh)">
          <path d="M236 204 H598 L772 378 V788 A52 52 0 0 1 720 840 H288 A52 52 0 0 1 236 788 V256 A52 52 0 0 1 288 204 Z" fill="${frontFill}" stroke="${frontStroke}" stroke-width="10"/>
          <!-- Cobalt dog-ear fold -->
          <path d="M598 204 V334 A44 44 0 0 0 642 378 H772 Z" fill="${cobalt}"/>
        </g>
        <!-- Editorial rules -->
        <rect x="328" y="456" width="328" height="36" rx="18" fill="${ink}"/>
        <rect x="328" y="544" width="248" height="32" rx="16" fill="${ink}" opacity="0.52"/>
        <rect x="328" y="628" width="184" height="32" rx="16" fill="${cobalt}" opacity="0.85"/>
      `;
    },
  });

  // 02 · Cobalt Vellum
  add({
    id: "cobalt-vellum",
    n: 2,
    name: "Cobalt Vellum",
    tagline: "Luminous royal cobalt with frosted translucent vellum sheets and crisp specular rim",
    concept: "The most direct high-craft evolution of the current icon. Replaces the flat blue fill with a rich sapphire-to-cobalt radial gradient and layers two frosted glass/vellum sheets with delicate specular borders and clean geometric proportions—feeling immediately native on iOS 18.",
    palette: [["Deep Sapphire", "#18328E"], ["Folio Cobalt", "#2F5BEA"], ["Ice Vellum", "#DCE7FF"], ["Pure White", "#FFFFFF"]],
    moves: [
      "Rich directional sapphire-to-cobalt studio lighting",
      "Frosted translucent rear sheet with top-left specular highlight",
      "Optical rebalancing and bolder corner fold for crisp 16px legibility",
    ],
    facts: { Family: "Paper & Craft", Silhouette: "Glass sheets", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${dark ? "#1E3A8A" : "#3E6BF5"}"/>
            <stop offset="55%" stop-color="${dark ? "#152661" : "#2850D9"}"/>
            <stop offset="100%" stop-color="${dark ? "#0D1538" : "#1A35A3"}"/>
          </linearGradient>
          <linearGradient id="${uid}_back" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.46"/>
            <stop offset="100%" stop-color="#B9CEFF" stop-opacity="0.16"/>
          </linearGradient>
          <linearGradient id="${uid}_front" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="100%" stop-color="#EBF1FF"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="28" stdDeviation="26" flood-color="#091547" flood-opacity="0.38"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Subtle ambient glow -->
        <circle cx="340" cy="240" r="420" fill="#7CA0FF" opacity="0.18"/>
        <!-- Rear vellum sheet -->
        <path d="M358 164 H664 L810 310 V688 A56 56 0 0 1 754 744 H358 A56 56 0 0 1 302 688 V220 A56 56 0 0 1 358 164 Z"
              fill="url(#${uid}_back)" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="8"/>
        <!-- Front luminous sheet -->
        <g filter="url(#${uid}_sh)">
          <path d="M266 268 H576 L724 416 V796 A56 56 0 0 1 668 852 H266 A56 56 0 0 1 210 796 V324 A56 56 0 0 1 266 268 Z"
                fill="url(#${uid}_front)"/>
          <!-- Corner fold crease -->
          <path d="M576 268 V372 A44 44 0 0 0 620 416 H724 Z" fill="#C7D8FF"/>
          <path d="M576 268 L724 416" stroke="#FFFFFF" stroke-width="6" opacity="0.8"/>
        </g>
        <!-- Crisp content bars -->
        <rect x="304" y="512" width="316" height="44" rx="22" fill="#2F5BEA"/>
        <rect x="304" y="606" width="224" height="44" rx="22" fill="#2F5BEA" opacity="0.45"/>
        <circle cx="326" cy="400" r="24" fill="#2F5BEA" opacity="0.22"/>
      `;
    },
  });

  // 03 · Archival Folder
  add({
    id: "archival-folder",
    n: 3,
    name: "Archival Folder",
    tagline: "Warm linen portfolio sleeve with a crisp cobalt web artifact peeking out",
    concept: "Leans into the physical meaning of a 'folio'—a protective case holding finished plates. A warm sand/linen tabbed folder holds a vivid cobalt-and-white interactive artifact sheet rising out of the pocket. Friendly, human, and unmistakable next to colder developer icons.",
    palette: [["Warm Linen", "#EFE8DA"], ["Craft Sand", "#D9CCB4"], ["Cobalt Card", "#2F5BEA"], ["Ink Slate", "#242320"]],
    moves: [
      "Tactile tabbed portfolio folder in warm bookcloth tones",
      "Crisp cobalt artifact card sliding up from inside the pocket",
      "Subtle stitching/emboss crease along the folder lip",
    ],
    facts: { Family: "Paper & Craft", Silhouette: "Portfolio sleeve", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${dark ? "#22201D" : "#F6F2E9"}"/>
            <stop offset="100%" stop-color="${dark ? "#151412" : "#E7DFCF"}"/>
          </linearGradient>
          <linearGradient id="${uid}_front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${dark ? "#3B3730" : "#E6D9C2"}"/>
            <stop offset="100%" stop-color="${dark ? "#292621" : "#D4C2A3"}"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.2"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Back folder tab -->
        <path d="M164 252 A56 56 0 0 1 220 196 H416 L478 268 H804 A56 56 0 0 1 860 324 V748 A56 56 0 0 1 804 804 H220 A56 56 0 0 1 164 748 Z"
              fill="${dark ? "#2E2B25" : "#C9B799"}"/>
        <!-- Peeking cobalt artifact card -->
        <g filter="url(#${uid}_sh)">
          <rect x="256" y="238" width="512" height="420" rx="44" fill="#2F5BEA"/>
          <rect x="316" y="302" width="160" height="32" rx="16" fill="#FFFFFF" opacity="0.92"/>
          <rect x="316" y="362" width="388" height="24" rx="12" fill="#FFFFFF" opacity="0.45"/>
          <circle cx="672" cy="318" r="24" fill="#93B4FF"/>
        </g>
        <!-- Front folder pocket -->
        <g filter="url(#${uid}_sh)">
          <path d="M148 444 H876 V764 A64 64 0 0 1 812 828 H212 A64 64 0 0 1 148 764 Z"
                fill="url(#${uid}_front)"/>
          <!-- Subtle lip highlight -->
          <path d="M148 444 H876" stroke="#FFFFFF" stroke-opacity="${dark ? "0.14" : "0.65"}" stroke-width="8"/>
          <!-- Recessed brass clasp pill -->
          <rect x="432" y="592" width="160" height="36" rx="18" fill="${dark ? "#1E1C18" : "#B8A482"}"/>
        </g>
      `;
    },
  });

  // 04 · Ink & Gold Foil
  add({
    id: "ink-gold-foil",
    n: 4,
    name: "Ink & Gold Foil",
    tagline: "Midnight charcoal cloth cover with an embossed folio leaf and burnished brass ribbon",
    concept: "Treats Folio like a collector's monograph or fine hardcover edition. Deep matte charcoal cover (#161618), a sharply creased white/slate folio plate, and a vertical burnished gold bookmark ribbon notched at the bottom. High prestige, calm, and unmistakably distinct from every blue SaaS icon.",
    palette: [["Charcoal Cloth", "#161618"], ["Burnished Gold", "#D9A85B"], ["Ivory Leaf", "#F6F3EC"], ["Warm Graphite", "#2B2B30"]],
    moves: [
      "Collector-edition charcoal and burnished gold palette",
      "Notched bookmark ribbon anchored to the top edge",
      "Clean folded ivory plate centered with architectural restraint",
    ],
    facts: { Family: "Paper & Craft", Silhouette: "Bookplate & ribbon", Effort: "S" },
    prefers: "dark",
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#232327"/>
          <stop offset="100%" stop-color="#111113"/>
        </linearGradient>
        <linearGradient id="${uid}_gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F2CE88"/>
          <stop offset="50%" stop-color="#D49E48"/>
          <stop offset="100%" stop-color="#A8762A"/>
        </linearGradient>
        <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
      <!-- Subtle debossed inner frame -->
      <rect x="92" y="92" width="840" height="840" rx="140" fill="none" stroke="#D49E48" stroke-opacity="0.22" stroke-width="6"/>
      <!-- Folio plate -->
      <g filter="url(#${uid}_sh)">
        <path d="M252 196 H624 L772 344 V788 A48 48 0 0 1 724 836 H300 A48 48 0 0 1 252 788 Z" fill="#F6F3EC"/>
        <path d="M624 196 V300 A44 44 0 0 0 668 344 H772 Z" fill="#DED8CA"/>
      </g>
      <!-- Gold bookmark ribbon draped over top -->
      <g filter="url(#${uid}_sh)">
        <path d="M352 152 H468 V548 L410 492 L352 548 Z" fill="url(#${uid}_gold)"/>
      </g>
      <!-- Minimal engraved lines -->
      <rect x="348" y="636" width="328" height="24" rx="12" fill="#1E1E22"/>
      <rect x="348" y="692" width="220" height="24" rx="12" fill="#1E1E22" opacity="0.45"/>
    `,
  });

  // 05 · Risograph Fan
  add({
    id: "risograph-fan",
    n: 5,
    name: "Risograph Fan",
    tagline: "Three fanned printmaker sheets in vermilion, cobalt, and warm cream",
    concept: "Celebrates creative making and multi-author energy. Three offset rounded sheets fan out like risograph proof prints—vermilion red, cobalt blue, and crisp cream—creating a joyful, tactile overlap. Stands out effortlessly on a crowded iPhone Home Screen.",
    palette: [["Cream Stock", "#FBF8F1"], ["Cobalt Ink", "#2F5BEA"], ["Vermilion", "#E04F3E"], ["Overlap Indigo", "#2B2168"]],
    moves: [
      "Three fanned sheets angled at -14°, 0°, and +14°",
      "Vibrant printmaker vermilion + cobalt color pairing",
      "Bold geometric silhouette readable even at 16px favicon size",
    ],
    facts: { Family: "Paper & Craft", Silhouette: "Fanned sheets", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity="${dark ? "0.45" : "0.14"}"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="${dark ? "#17171A" : "#FBF8F1"}"/>
        <!-- Left sheet: Vermilion -->
        <rect x="272" y="212" width="420" height="580" rx="58" transform="rotate(-15 482 540)" fill="#E04F3E" opacity="0.92"/>
        <!-- Right sheet: Cobalt -->
        <rect x="332" y="212" width="420" height="580" rx="58" transform="rotate(14 542 540)" fill="#2F5BEA" opacity="0.94"/>
        <!-- Center hero sheet: Warm Paper -->
        <g filter="url(#${uid}_sh)">
          <rect x="302" y="206" width="420" height="600" rx="58" fill="${dark ? "#F4F1EA" : "#FFFFFF"}"/>
          <circle cx="412" cy="340" r="38" fill="#E04F3E"/>
          <rect x="374" y="438" width="276" height="36" rx="18" fill="#1C1C1A"/>
          <rect x="374" y="514" width="212" height="36" rx="18" fill="#2F5BEA"/>
          <rect x="374" y="590" width="152" height="36" rx="18" fill="#1C1C1A" opacity="0.32"/>
        </g>
      `;
    },
  });

  // ══════════════════════════════════════════════════════════════════
  // 06–10 · MULTI-AGENT COLLABORATION
  // ══════════════════════════════════════════════════════════════════

  // 06 · Converging Cursors
  add({
    id: "converging-cursors",
    n: 6,
    name: "Converging Cursors",
    tagline: "Three distinct agent cursors pointing onto one shared artifact canvas",
    concept: "Tells Folio's whole story in one glance: multiple AI agents (cobalt, emerald, amber) collaborating on the exact same artifact sheet. Clean dark-slate or warm-light canvas with a crisp central document tile and three bold, balanced pointer arrows converging on it.",
    palette: [["Deep Canvas", "#14161D"], ["Cobalt Agent", "#4C7BF4"], ["Emerald Agent", "#22B573"], ["Amber Agent", "#F59E0B"]],
    moves: [
      "Three color-coded cursor arrowheads representing multiple AI agents",
      "Crisp white central artifact card with clean framing",
      "Dynamic radial energy without visual clutter",
    ],
    facts: { Family: "Multi-Agent", Silhouette: "Sheet + cursors", Effort: "S" },
    prefers: "dark",
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${dark ? "#1B1E28" : "#F5F4EF"}"/>
            <stop offset="100%" stop-color="${dark ? "#0F1117" : "#E5E3DA"}"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="${dark ? "0.45" : "0.16"}"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Central artifact sheet -->
        <g filter="url(#${uid}_sh)">
          <rect x="292" y="252" width="440" height="520" rx="64" fill="#FFFFFF" stroke="${dark ? "none" : "#DCD9CE"}" stroke-width="8"/>
          <rect x="368" y="346" width="220" height="36" rx="18" fill="#1C1C1A"/>
          <rect x="368" y="424" width="288" height="28" rx="14" fill="#9CA3AF" opacity="0.5"/>
          <rect x="368" y="484" width="240" height="28" rx="14" fill="#9CA3AF" opacity="0.5"/>
          <rect x="368" y="564" width="288" height="116" rx="28" fill="#EEF3FF"/>
        </g>
        <!-- Agent Cursor 1: Cobalt (top-left) -->
        <g filter="url(#${uid}_sh)">
          <path d="M164 166 L362 240 L276 284 L234 368 Z" fill="#2F5BEA" stroke="#FFFFFF" stroke-width="14" stroke-linejoin="round"/>
        </g>
        <!-- Agent Cursor 2: Emerald (top-right) -->
        <g filter="url(#${uid}_sh)">
          <path d="M860 220 L664 294 L748 338 L790 422 Z" fill="#1E9E63" stroke="#FFFFFF" stroke-width="14" stroke-linejoin="round"/>
        </g>
        <!-- Agent Cursor 3: Amber (bottom-right) -->
        <g filter="url(#${uid}_sh)">
          <path d="M836 824 L650 726 L736 690 L772 604 Z" fill="#F0941F" stroke="#FFFFFF" stroke-width="14" stroke-linejoin="round"/>
        </g>
      `;
    },
  });

  // 07 · Tri-Agent Weave
  add({
    id: "tri-agent-weave",
    n: 7,
    name: "Tri-Agent Weave",
    tagline: "Three interlocking rounded leaves forming a luminous central artifact nexus",
    concept: "Abstracts multi-agent sharing into a tight, iconic geometric mark. Three overlapping rounded cards in cobalt, teal, and coral interlock around a bright white central core—representing different models contributing to one unified artifact. Scales down to 16px like a flagship brand mark.",
    palette: [["Deep Ink", "#141824"], ["Cobalt", "#3B6BF6"], ["Teal", "#14B8A6"], ["Coral", "#F97066"]],
    moves: [
      "Three 120°-rotated rounded artifact cards interlocked in harmony",
      "Bright central hub formed by the shared intersection",
      "Zero text or thin lines—bulletproof at 16px favicon",
    ],
    facts: { Family: "Multi-Agent", Silhouette: "Interlocking triad", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${dark ? "#191E2D" : "#FFFFFF"}"/>
            <stop offset="100%" stop-color="${dark ? "#0D1018" : "#F0EFEA"}"/>
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Three rotated leaves -->
        <g transform="translate(512 512)">
          <rect x="-150" y="-338" width="300" height="420" rx="92" fill="#2F5BEA" opacity="0.95"/>
          <rect x="-150" y="-338" width="300" height="420" rx="92" transform="rotate(120)" fill="#14B8A6" opacity="0.92"/>
          <rect x="-150" y="-338" width="300" height="420" rx="92" transform="rotate(240)" fill="#F97066" opacity="0.92"/>
          <!-- Shared luminous artifact core -->
          <circle cx="0" cy="0" r="126" fill="${dark ? "#131722" : "#FFFFFF"}"/>
          <rect x="-54" y="-66" width="108" height="132" rx="26" fill="${dark ? "#FFFFFF" : "#1C1C1A"}"/>
          <path d="M12 -66 V-24 H54 Z" fill="#2F5BEA"/>
        </g>
      `;
    },
  });

  // 08 · Version Strata
  add({
    id: "version-strata",
    n: 8,
    name: "Version Strata",
    tagline: "Three floating isometric artifact layers pinned along a glowing version spine",
    concept: "Highlights Folio's immutable version history: every edit creates a clean, inspectable snapshot without ever overwriting the past. Three crisp isometric planes rise from deep navy to pure white, threaded by a glowing cobalt version line.",
    palette: [["Midnight", "#0F172A"], ["Cobalt Spine", "#3B6CF5"], ["Sky Layer", "#93B4FF"], ["Pure Top", "#FFFFFF"]],
    moves: [
      "Three stacked isometric planes representing v1, v2, v3",
      "Graduated luminance from base to active HEAD layer",
      "Clean geometric diamond rhythm readable at small sizes",
    ],
    facts: { Family: "Multi-Agent", Silhouette: "Isometric stack", Effort: "S" },
    prefers: "dark",
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${dark ? "#172038" : "#2549C8"}"/>
            <stop offset="100%" stop-color="${dark ? "#0B1020" : "#13297A"}"/>
          </linearGradient>
          <linearGradient id="${uid}_l1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#608BFF"/>
            <stop offset="100%" stop-color="#355FE0"/>
          </linearGradient>
          <linearGradient id="${uid}_l2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#A8C2FF"/>
            <stop offset="100%" stop-color="#6D95FF"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="22" stdDeviation="20" flood-color="#050B24" flood-opacity="0.45"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Layer 1 (v1 bottom) -->
        <path d="M512 528 L824 684 L512 840 L200 684 Z" fill="url(#${uid}_l1)" opacity="0.72"/>
        <!-- Layer 2 (v2 middle) -->
        <g filter="url(#${uid}_sh)">
          <path d="M512 372 L824 528 L512 684 L200 528 Z" fill="url(#${uid}_l2)"/>
        </g>
        <!-- Layer 3 (v3 HEAD top) -->
        <g filter="url(#${uid}_sh)">
          <path d="M512 206 L824 362 L512 518 L200 362 Z" fill="#FFFFFF"/>
          <!-- Folded corner highlight on top plane -->
          <path d="M512 206 L632 266 L512 326 L392 266 Z" fill="#DCE7FF"/>
        </g>
        <!-- Spine indicator dot -->
        <circle cx="512" cy="362" r="34" fill="#2F5BEA"/>
      `;
    },
  });

  // 09 · Relay Orbit
  add({
    id: "relay-orbit",
    n: 9,
    name: "Relay Orbit",
    tagline: "A crisp central document orbited by twin MCP agent rings and live nodes",
    concept: "Captures the MCP (Model Context Protocol) bridge at the heart of Folio: any connected client orbits and updates the same canonical artifact. Twin angled elliptical arcs with glowing agent nodes frame a clean folded sheet on deep midnight navy.",
    palette: [["Deep Navy", "#0E162B"], ["Electric Cobalt", "#4F7DF9"], ["Mint Node", "#34D399"], ["White Sheet", "#FFFFFF"]],
    moves: [
      "Dual tilted orbital rings suggesting MCP clients in sync",
      "Two contrasting agent nodes (cobalt & mint) passing edits",
      "Crisp white sheet centered inside the orbital intersection",
    ],
    facts: { Family: "Multi-Agent", Silhouette: "Orbital document", Effort: "S" },
    prefers: "dark",
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <radialGradient id="${uid}_bg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stop-color="${dark ? "#1B284D" : "#1E3A8A"}"/>
            <stop offset="100%" stop-color="${dark ? "#0A0F1F" : "#0F1D47"}"/>
          </radialGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Orbital rings -->
        <ellipse cx="512" cy="512" rx="392" ry="178" transform="rotate(-32 512 512)" fill="none" stroke="#6E96FF" stroke-width="22" opacity="0.55"/>
        <ellipse cx="512" cy="512" rx="392" ry="178" transform="rotate(32 512 512)" fill="none" stroke="#34D399" stroke-width="22" opacity="0.5"/>
        <!-- Central Artifact Card -->
        <path d="M362 288 H582 L674 380 V692 A44 44 0 0 1 630 736 H362 A44 44 0 0 1 318 692 V332 A44 44 0 0 1 362 288 Z" fill="#FFFFFF"/>
        <path d="M582 288 V350 A30 30 0 0 0 612 380 H674 Z" fill="#C7D8FF"/>
        <rect x="386" y="468" width="212" height="32" rx="16" fill="#2F5BEA"/>
        <rect x="386" y="534" width="148" height="32" rx="16" fill="#2F5BEA" opacity="0.45"/>
        <!-- Agent Satellite Nodes -->
        <circle cx="808" cy="326" r="46" fill="#34D399" stroke="#0F1D47" stroke-width="14"/>
        <circle cx="216" cy="698" r="46" fill="#60A5FA" stroke="#0F1D47" stroke-width="14"/>
      `;
    },
  });

  // 10 · Diff Ribbon
  add({
    id: "diff-ribbon",
    n: 10,
    name: "Diff Ribbon",
    tagline: "A warm paper sheet peeling back to reveal an emerald-and-cobalt accepted diff",
    concept: "A clever visual pun on Folio's core workflow: suggestions and diffs. The front warm-paper page curls dramatically across the diagonal, exposing a crisp emerald-green 'addition' layer underneath—signaling living, reviewable documents rather than static files.",
    palette: [["Charcoal Frame", "#1C1D21"], ["Warm Paper", "#FAF8F3"], ["Diff Emerald", "#1E9E63"], ["Cobalt Bar", "#2F5BEA"]],
    moves: [
      "Large bold page-peel revealing a green accepted-diff surface",
      "High-contrast diagonal geometry that reads cleanly at 16px",
      "Connects physical paper craft with version control",
    ],
    facts: { Family: "Multi-Agent", Silhouette: "Peeling sheet", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_diff" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22C57A"/>
            <stop offset="100%" stop-color="#15804D"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="-8" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.28"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="${dark ? "#16171A" : "#22242A"}"/>
        <!-- Underlying emerald diff sheet -->
        <rect x="208" y="160" width="608" height="704" rx="72" fill="url(#${uid}_diff)"/>
        <!-- Plus glyph on revealed diff corner -->
        <path d="M676 254 V358 M624 306 H728" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round"/>
        <!-- Front warm paper sheet with deep diagonal peel -->
        <g filter="url(#${uid}_sh)">
          <path d="M208 232 A72 72 0 0 1 280 160 H530 L816 446 V792 A72 72 0 0 1 744 864 H280 A72 72 0 0 1 208 792 Z" fill="#FAF8F3"/>
          <!-- Curled peel flap -->
          <path d="M530 160 V374 A72 72 0 0 0 602 446 H816 Z" fill="#E3DFD3"/>
        </g>
        <!-- Crisp content bars -->
        <rect x="298" y="540" width="380" height="40" rx="20" fill="#1C1C1A"/>
        <rect x="298" y="624" width="276" height="40" rx="20" fill="#2F5BEA"/>
      `;
    },
  });

  // ══════════════════════════════════════════════════════════════════
  // 11–15 · TYPOGRAPHIC & MONOGRAM "F"
  // ══════════════════════════════════════════════════════════════════

  // 11 · Folded F
  add({
    id: "folded-f",
    n: 11,
    name: "Folded F",
    tagline: "Origami paper ribbon folded into a bold geometric F on deep royal cobalt",
    concept: "Turns the word 'folio' (a folded sheet) directly into a monogram. One continuous white paper ribbon folds crisply at 45° miters to build a sculptural capital 'F' with subtle cobalt shadow creases. Iconic, geometric, and instantly memorable from 1024px down to 16px.",
    palette: [["Royal Cobalt", "#244CD8"], ["Bright Paper", "#FFFFFF"], ["Crease Tint", "#C5D6FF"], ["Deep Blue", "#162E8A"]],
    moves: [
      "Single folded-ribbon monogram combining 'F' and folded paper",
      "Crisp 45° crease shadows give effortless 3D depth",
      "Ultra-strong silhouette for favicon, App Store, and iOS 18 Tinted",
    ],
    facts: { Family: "Monogram F", Silhouette: "Origami F", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${dark ? "#203FA8" : "#3562F0"}"/>
            <stop offset="100%" stop-color="${dark ? "#101E56" : "#1D3EB5"}"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#0A174D" flood-opacity="0.38"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <g filter="url(#${uid}_sh)">
          <!-- Vertical stem -->
          <path d="M286 216 H446 V808 H334 A48 48 0 0 1 286 760 Z" fill="#FFFFFF"/>
          <!-- Top folded arm -->
          <path d="M286 216 H754 A44 44 0 0 1 754 368 H446 Z" fill="#FFFFFF"/>
          <!-- Top fold crease triangle -->
          <polygon points="286,216 446,368 446,216" fill="#DCE7FF"/>
          <!-- Middle folded arm -->
          <path d="M446 468 H676 A44 44 0 0 1 676 612 H446 Z" fill="#E8EFFF"/>
          <!-- Crease shadow under top & middle arms -->
          <polygon points="446,368 498,368 446,420" fill="#1A3599" opacity="0.32"/>
          <polygon points="446,612 498,612 446,664" fill="#1A3599" opacity="0.28"/>
        </g>
      `;
    },
  });

  // 12 · Editorial Serif F
  add({
    id: "editorial-serif-f",
    n: 12,
    name: "Editorial Serif F",
    tagline: "Warm ivory bookplate with a refined high-contrast serif F and cobalt colophon dot",
    concept: "Leans fully into Folio's literary, bookbinding roots. Set inside a fine hairline border on warm ivory stock (#FAF8F2), a stately Newsreader serif 'F' stands with quiet authority, punctuated by a single cobalt colophon period. Feels like a timeless publishing house or Notion/Substack-caliber craft.",
    palette: [["Ivory Stock", "#FAF8F2"], ["Book Ink", "#1A1A18"], ["Cobalt Dot", "#2F5BEA"], ["Hairline", "#D8D3C6"]],
    moves: [
      "Authentic editorial bookplate framing with hairline rule",
      "High-contrast Newsreader serif 'F' with generous breathing room",
      "Signature cobalt colophon dot adds modern digital contrast",
    ],
    facts: { Family: "Monogram F", Silhouette: "Bookplate serif", Effort: "S" },
    draw: ({ mode }) => {
      const dark = mode === "dark";
      const bg = dark ? "#181816" : "#FAF8F2";
      const fg = dark ? "#F2F0E8" : "#1A1A18";
      const line = dark ? "#33322D" : "#DDD7C9";
      const dot = dark ? "#7698FF" : "#2F5BEA";
      return `
        <rect width="1024" height="1024" fill="${bg}"/>
        <!-- Fine bookplate hairline frame -->
        <rect x="108" y="108" width="808" height="808" rx="136" fill="none" stroke="${line}" stroke-width="10"/>
        <!-- Corner registration ticks -->
        <path d="M180 180 H236 M180 180 V236" stroke="${line}" stroke-width="8" stroke-linecap="round"/>
        <path d="M844 844 H788 M844 844 V788" stroke="${line}" stroke-width="8" stroke-linecap="round"/>
        <!-- Editorial Serif F -->
        <text x="480" y="730" text-anchor="middle" font-family="'Newsreader', Georgia, serif" font-size="660" font-weight="600" fill="${fg}">F</text>
        <!-- Cobalt Colophon Dot -->
        <circle cx="716" cy="692" r="56" fill="${dot}"/>
      `;
    },
  });

  // 13 · Geometric Slab F
  add({
    id: "geometric-slab-f",
    n: 13,
    name: "Geometric Slab F",
    tagline: "Swiss Bauhaus modular F in ink black, cobalt blue, and warm terracotta",
    concept: "Pure Swiss modernist clarity. Builds an unmistakable 'F' out of three bold, decoupled geometric blocks—a deep ink vertical pillar, a cobalt top beam, and a warm terracotta middle bar—floating on crisp off-white. Unbeatably punchy at 16px and looks incredible in web headers.",
    palette: [["Gallery White", "#F9F8F4"], ["Ink Black", "#1A1A18"], ["Cobalt Beam", "#2F5BEA"], ["Terracotta", "#E05A3F"]],
    moves: [
      "Three modular Bauhaus primitives forming a bold 'F'",
      "High-contrast tri-color palette anchored on warm gallery white",
      "Zero thin details—reads cleanly at every size down to 16px",
    ],
    facts: { Family: "Monogram F", Silhouette: "Bauhaus F", Effort: "S" },
    draw: ({ mode }) => {
      const dark = mode === "dark";
      return `
        <rect width="1024" height="1024" fill="${dark ? "#161618" : "#F9F8F4"}"/>
        <!-- Vertical ink pillar -->
        <rect x="236" y="196" width="164" height="632" rx="44" fill="${dark ? "#F2F1EC" : "#1A1A18"}"/>
        <!-- Cobalt top beam -->
        <rect x="444" y="196" width="356" height="164" rx="44" fill="#2F5BEA"/>
        <!-- Terracotta middle beam -->
        <rect x="444" y="424" width="248" height="156" rx="44" fill="#E05A3F"/>
        <!-- Subtle circular accent anchor -->
        <circle cx="722" cy="744" r="64" fill="${dark ? "#2E2E32" : "#E5E2D8"}"/>
      `;
    },
  });

  // 14 · Page-Turn F
  add({
    id: "page-turn-f",
    n: 14,
    name: "Page-Turn F",
    tagline: "Negative-space F carved from turning book pages on deep botanical forest green",
    concept: "A smart, quiet mark with real visual wit. On a rich forest-slate ground (#132E27), stacked curving paper leaves form a negative-space 'F' along their inner edge. Distinctively editorial and calm—stands miles apart from generic blue tech icons.",
    palette: [["Forest Slate", "#132E27"], ["Warm Ivory", "#F7F4EB"], ["Sage Mid", "#4F8A78"], ["Mint Edge", "#A3D9C5"]],
    moves: [
      "Botanical dark-green palette for calm, distinguished presence",
      "Curving page silhouettes carve an implicit capital 'F'",
      "Organic warmth balanced with crisp geometric precision",
    ],
    facts: { Family: "Monogram F", Silhouette: "Curved page F", Effort: "S" },
    prefers: "dark",
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1A3F35"/>
          <stop offset="100%" stop-color="#0D221C"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
      <!-- Vertical spine page -->
      <path d="M258 212 C258 186 280 168 308 168 H418 V856 H308 C280 856 258 838 258 812 Z" fill="#F7F4EB"/>
      <!-- Top turning page leaf -->
      <path d="M418 168 C584 168 696 196 774 268 V392 C690 332 580 314 418 314 Z" fill="#F7F4EB"/>
      <!-- Middle turning page leaf -->
      <path d="M418 450 C548 450 634 472 698 524 V640 C630 594 544 580 418 580 Z" fill="#A3D9C5"/>
      <!-- Subtle lower ghost page -->
      <path d="M418 712 C504 712 562 728 604 762 V844 C558 814 500 804 418 804 Z" fill="#4F8A78" opacity="0.65"/>
    `,
  });

  // 15 · Stencil Mono F
  add({
    id: "stencil-mono-f",
    n: 15,
    name: "Stencil Mono F",
    tagline: "Matte obsidian developer tile with a crisp monospace stencil F and cobalt cursor",
    concept: "Speaks directly to Folio's MCP / coding-agent audience (Claude Code, Codex, Cursor, Gemini CLI). A sharp monospace stencil 'F' sits on matte obsidian with a vibrant cobalt terminal block cursor beside it—minimal, technical, and razor-sharp in dark mode.",
    palette: [["Matte Obsidian", "#111215"], ["Crisp Chalk", "#F4F4F0"], ["Cursor Cobalt", "#3B6CF5"], ["Grid Line", "#24262D"]],
    moves: [
      "Developer-native obsidian tile with subtle 3×3 hairline grid",
      "Crisp JetBrains Mono stencil 'F' paired with a cobalt block cursor",
      "Maximum contrast and legibility on dark and light backgrounds",
    ],
    facts: { Family: "Monogram F", Silhouette: "Mono F + cursor", Effort: "S" },
    prefers: "dark",
    draw: ({ mode }) => {
      const dark = mode === "dark";
      const bg = dark ? "#111215" : "#181A20";
      return `
        <rect width="1024" height="1024" fill="${bg}"/>
        <!-- Subtle architectural grid -->
        <path d="M341 0 V1024 M683 0 V1024 M0 341 H1024 M0 683 H1024" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="4"/>
        <!-- Stencil F constructed geometrically for crispness -->
        <rect x="248" y="216" width="128" height="592" rx="18" fill="#F4F4F0"/>
        <rect x="412" y="216" width="340" height="124" rx="18" fill="#F4F4F0"/>
        <rect x="412" y="446" width="248" height="116" rx="18" fill="#F4F4F0"/>
        <!-- Blinking cobalt cursor block -->
        <rect x="596" y="684" width="184" height="124" rx="22" fill="#3B6CF5"/>
      `;
    },
  });

  // ══════════════════════════════════════════════════════════════════
  // 16–20 · ARCHITECTURAL & ABSTRACT MARKS
  // ══════════════════════════════════════════════════════════════════

  // 16 · Open Folio Spread
  add({
    id: "open-folio-spread",
    n: 16,
    name: "Open Folio Spread",
    tagline: "Symmetrical open two-page folio spread with a live cobalt artifact preview on the right leaf",
    concept: "Literally depicts an open folio (a single sheet folded once into two facing leaves). The left leaf carries quiet editorial rules while the right leaf displays a live cobalt interactive panel—bridging classic publishing with live web artifacts.",
    palette: [["Cobalt Spine", "#2A54E2"], ["Spread White", "#FFFFFF"], ["Gutter Shadow", "#D9E2FA"], ["Warm Accent", "#F59E0B"]],
    moves: [
      "Symmetrical open two-leaf spread with curved page bottoms",
      "Soft center gutter gradient creates tactile bookbinding depth",
      "Left text rules + right live preview block show 'living artifact'",
    ],
    facts: { Family: "Architectural", Silhouette: "Open spread", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${dark ? "#1E3682" : "#3460EE"}"/>
            <stop offset="100%" stop-color="${dark ? "#111E4D" : "#2144BD"}"/>
          </linearGradient>
          <linearGradient id="${uid}_gutter" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#D4DFF7"/>
            <stop offset="50%" stop-color="#FFFFFF"/>
            <stop offset="100%" stop-color="#E7EEFD"/>
          </linearGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#0A174D" flood-opacity="0.38"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Open Folio Spread -->
        <g filter="url(#${uid}_sh)">
          <!-- Left Leaf -->
          <path d="M148 272 C240 242 404 242 512 308 V776 C404 716 240 716 148 746 Z" fill="#FFFFFF"/>
          <!-- Right Leaf -->
          <path d="M876 272 C784 242 620 242 512 308 V776 C620 716 784 716 876 746 Z" fill="url(#${uid}_gutter)"/>
          <!-- Center Spine Crease -->
          <path d="M512 308 V776" stroke="#B7C8F5" stroke-width="10"/>
        </g>
        <!-- Left page subtle lines -->
        <rect x="214" y="388" width="212" height="28" rx="14" fill="#2F5BEA" opacity="0.85"/>
        <rect x="214" y="452" width="176" height="24" rx="12" fill="#94A3B8" opacity="0.55"/>
        <rect x="214" y="504" width="194" height="24" rx="12" fill="#94A3B8" opacity="0.55"/>
        <rect x="214" y="556" width="142" height="24" rx="12" fill="#94A3B8" opacity="0.55"/>
        <!-- Right page live artifact preview block -->
        <rect x="576" y="378" width="234" height="168" rx="28" fill="#2F5BEA"/>
        <circle cx="634" cy="436" r="24" fill="#FDE047"/>
        <path d="M610 510 L682 448 L740 492 L776 462 V516 H610 Z" fill="#FFFFFF" opacity="0.88"/>
        <rect x="576" y="578" width="180" height="24" rx="12" fill="#2F5BEA" opacity="0.35"/>
      `;
    },
  });

  // 17 · Artifact Prism
  add({
    id: "artifact-prism",
    n: 17,
    name: "Artifact Prism",
    tagline: "Faceted cobalt-to-indigo crystal refracting raw agent input into a luminous white sheet",
    concept: "Takes a more poetic, iconic approach: an AI artifact as a distilled crystal. A clean multi-faceted cobalt and violet prism frames a pure white inner diamond/sheet—giving Folio a futuristic, museum-grade symbol that feels right at home beside top AI tools.",
    palette: [["Deep Void", "#0E101A"], ["Cobalt Facet", "#2F5BEA"], ["Iris Violet", "#6D5DF6"], ["Pure Core", "#FFFFFF"]],
    moves: [
      "Sharp geometric hexagonal/faceted crystal silhouette",
      "Luminous cobalt-to-iris facets with zero blur muddiness",
      "Pure white inner artifact core anchors the center",
    ],
    facts: { Family: "Architectural", Silhouette: "Faceted prism", Effort: "S" },
    prefers: "dark",
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${dark ? "#16192B" : "#EEF2FF"}"/>
            <stop offset="100%" stop-color="${dark ? "#0A0C15" : "#DCE4FA"}"/>
          </linearGradient>
          <linearGradient id="${uid}_f1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#60A5FA"/>
            <stop offset="100%" stop-color="#2F5BEA"/>
          </linearGradient>
          <linearGradient id="${uid}_f2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#818CF8"/>
            <stop offset="100%" stop-color="#4F46E5"/>
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#${uid}_bg)"/>
        <!-- Top-left facet -->
        <polygon points="512,136 184,326 512,512" fill="url(#${uid}_f1)"/>
        <!-- Top-right facet -->
        <polygon points="512,136 840,326 512,512" fill="url(#${uid}_f2)"/>
        <!-- Bottom-left facet -->
        <polygon points="184,326 184,698 512,888 512,512" fill="#1E3FA8"/>
        <!-- Bottom-right facet -->
        <polygon points="840,326 840,698 512,888 512,512" fill="#3730A3"/>
        <!-- Luminous white central artifact diamond -->
        <polygon points="512,304 692,408 692,616 512,720 332,616 332,408" fill="#FFFFFF"/>
        <!-- Subtle inner fold facet -->
        <polygon points="512,304 692,408 512,512" fill="#E0E9FF"/>
      `;
    },
  });

  // 18 · Bento Canvas
  add({
    id: "bento-canvas",
    n: 18,
    name: "Bento Canvas",
    tagline: "Three clean bento tiles on warm stone representing a live interactive mini-website",
    concept: "Because every Folio artifact is a living mini-website (not a static PDF), this icon frames a crisp 3-tile bento layout inside warm architectural stone: one hero cobalt preview card, one emerald status tile, and one ink notes tile. Modern, friendly, and immediately clear.",
    palette: [["Warm Stone", "#F3F1EA"], ["Cobalt Hero", "#2F5BEA"], ["Forest Ok", "#1D7A46"], ["Ink Tile", "#1C1C1A"]],
    moves: [
      "Uses Folio's exact semantic tokens (--accent, --ok, --fg, --bg)",
      "Asymmetric 3-tile bento composition signals live web artifacts",
      "Chunky radii hold up cleanly even at 16px favicon size",
    ],
    facts: { Family: "Architectural", Silhouette: "Bento grid", Effort: "S" },
    draw: ({ mode }) => {
      const dark = mode === "dark";
      return `
        <rect width="1024" height="1024" fill="${dark ? "#161614" : "#F3F1EA"}"/>
        <!-- Top-left large cobalt hero tile -->
        <rect x="148" y="148" width="440" height="440" rx="76" fill="#2F5BEA"/>
        <circle cx="272" cy="272" r="52" fill="#FFFFFF" opacity="0.92"/>
        <rect x="220" y="380" width="296" height="36" rx="18" fill="#FFFFFF" opacity="0.9"/>
        <rect x="220" y="446" width="200" height="36" rx="18" fill="#FFFFFF" opacity="0.5"/>
        <!-- Top-right forest green tile -->
        <rect x="632" y="148" width="244" height="440" rx="76" fill="#1D7A46"/>
        <path d="M708 368 L744 404 L806 326" fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Bottom wide ink tile -->
        <rect x="148" y="632" width="728" height="244" rx="76" fill="${dark ? "#282825" : "#1C1C1A"}"/>
        <rect x="224" y="728" width="340" height="52" rx="26" fill="#F7F6F2"/>
        <circle cx="764" cy="754" r="46" fill="#E6B45C"/>
      `;
    },
  });

  // 19 · Wax Seal & Sheet
  add({
    id: "wax-seal",
    n: 19,
    name: "Wax Seal & Sheet",
    tagline: "Crisp folded cream folio stamped with a vermilion-oxblood provenance seal",
    concept: "Focuses on attribution and trust: every edit in Folio is signed by the agent or person who made it. A pristine warm-paper folio sheet sits on deep charcoal, anchored at the lower-right by a tactile modern oxblood wax seal with an embossed 'F' crest.",
    palette: [["Slate Ink", "#1D1D20"], ["Archival Cream", "#FAF7F0"], ["Oxblood Seal", "#C23B2B"], ["Seal Highlight", "#E46252"]],
    moves: [
      "Tactile stamped wax seal evokes attribution and immutable versions",
      "Warm cream + oxblood + charcoal editorial palette",
      "Distinctive circular-on-rectangular asymmetry pops on iOS",
    ],
    facts: { Family: "Architectural", Silhouette: "Sheet + seal", Effort: "S" },
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <radialGradient id="${uid}_seal" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stop-color="#E65C4B"/>
            <stop offset="65%" stop-color="#C23B2B"/>
            <stop offset="100%" stop-color="#8F2317"/>
          </radialGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.32"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="${dark ? "#161618" : "#242428"}"/>
        <!-- Cream folio sheet -->
        <g filter="url(#${uid}_sh)">
          <path d="M220 172 H616 L760 316 V776 A52 52 0 0 1 708 828 H272 A52 52 0 0 1 220 776 V224 A52 52 0 0 1 272 172 Z" fill="#FAF7F0"/>
          <path d="M616 172 V272 A44 44 0 0 0 660 316 H760 Z" fill="#E0D9C8"/>
        </g>
        <!-- Quiet ink lines -->
        <rect x="308" y="356" width="268" height="30" rx="15" fill="#1C1C1A"/>
        <rect x="308" y="424" width="328" height="24" rx="12" fill="#1C1C1A" opacity="0.35"/>
        <rect x="308" y="476" width="224" height="24" rx="12" fill="#1C1C1A" opacity="0.35"/>
        <!-- Stamped Wax Seal -->
        <g filter="url(#${uid}_sh)">
          <circle cx="678" cy="696" r="176" fill="url(#${uid}_seal)"/>
          <circle cx="678" cy="696" r="134" fill="none" stroke="#F8B4AA" stroke-opacity="0.55" stroke-width="10"/>
          <text x="678" y="758" text-anchor="middle" font-family="'Newsreader', Georgia, serif" font-size="188" font-weight="700" fill="#FFF6F4">F</text>
        </g>
      `;
    },
  });

  // 20 · Horizon Deck
  add({
    id: "horizon-deck",
    n: 20,
    name: "Horizon Deck",
    tagline: "Three spatial artifact cards stacked in receding perspective over a cobalt glow",
    concept: "Sleek, spatial, Apple-native polish. Three crisp cards step forward from a soft cobalt horizon glow—suggesting an effortless deck of shared artifacts you can flip through on web or iPhone. Ultra-clean geometry that looks right at home on iOS 18 and macOS.",
    palette: [["Graphite", "#14161D"], ["Horizon Glow", "#3B6CF5"], ["Mid Card", "#A9C1FF"], ["Front Card", "#FFFFFF"]],
    moves: [
      "Three receding cards stacked cleanly along the vertical axis",
      "Soft cobalt horizon aura gives depth without busy details",
      "Clean Apple-native card-deck silhouette readable at every size",
    ],
    facts: { Family: "Architectural", Silhouette: "Card deck", Effort: "S" },
    prefers: "dark",
    draw: ({ mode, uid }) => {
      const dark = mode === "dark";
      return `
        <defs>
          <radialGradient id="${uid}_glow" cx="50%" cy="22%" r="65%">
            <stop offset="0%" stop-color="#3B6CF5" stop-opacity="${dark ? "0.62" : "0.78"}"/>
            <stop offset="55%" stop-color="#1D358A" stop-opacity="${dark ? "0.24" : "0.35"}"/>
            <stop offset="100%" stop-color="${dark ? "#0D0F16" : "#121B3A"}" stop-opacity="1"/>
          </radialGradient>
          <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="-10" stdDeviation="18" flood-color="#060A18" flood-opacity="0.35"/>
          </filter>
        </defs>
        <rect width="1024" height="1024" fill="${dark ? "#0D0F16" : "#121B3A"}"/>
        <rect width="1024" height="1024" fill="url(#${uid}_glow)"/>
        <!-- Card 3 (back) -->
        <rect x="272" y="196" width="480" height="360" rx="64" fill="#6E96FF" opacity="0.58"/>
        <!-- Card 2 (middle) -->
        <g filter="url(#${uid}_sh)">
          <rect x="212" y="304" width="600" height="400" rx="72" fill="#C4D6FF"/>
        </g>
        <!-- Card 1 (front active artifact) -->
        <g filter="url(#${uid}_sh)">
          <rect x="148" y="424" width="728" height="444" rx="80" fill="#FFFFFF"/>
          <!-- Active artifact indicator -->
          <rect x="232" y="516" width="124" height="124" rx="34" fill="#2F5BEA"/>
          <path d="M276 550 H314 V572 H294 V606 H276 Z" fill="#FFFFFF"/>
          <rect x="404" y="534" width="380" height="38" rx="19" fill="#181A20"/>
          <rect x="404" y="596" width="268" height="32" rx="16" fill="#94A3B8" opacity="0.65"/>
          <rect x="232" y="704" width="552" height="72" rx="36" fill="#F1F4FA"/>
          <rect x="256" y="724" width="212" height="32" rx="16" fill="#2F5BEA" opacity="0.22"/>
        </g>
      `;
    },
  });

  // ══════════════════════════════════════════════════════════════════
  // REVIEW CONFIGURATION
  // ══════════════════════════════════════════════════════════════════
  window.REVIEW = {
    key: "2026-11-20-folio-logo-redesign-v1",
    dir: "reports/2026-11-20-folio-logo-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8842,
    project: "projects/folio",
    context: [
      "projects/folio/CLAUDE.md",
      "projects/folio/services/web/public/icon.svg",
      "projects/folio/services/web/src/partials/header.html",
      "projects/folio/services/web/src/style.css",
      "projects/folio/apps/ios/App/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png",
    ],
    brief: "Redesign the Folio logo with 20 distinct variants across four conceptual directions—Paper & Craft (01–05), Multi-Agent Collaboration (06–10), Typographic & Monogram F (11–15), and Architectural & Abstract Marks (16–20)—plus the current production icon as baseline (00). Evaluated across iOS squircle, Folio's real light/dark web header & favicon, iOS Light/Dark/Tinted/macOS platforms, a 112→16px size ladder, and iOS Home Screen context.",
    title: "Folio · Logo Redesign",
    subtitle: "20 candidates + current baseline · Paper & Craft, Multi-Agent, Monogram F, Architectural",
    heading: "Pick a direction for Folio's logo & app icon",
    intro: "Folio is a quiet paper-and-ink workspace where every AI agent shares the same artifacts. Compare <b>20 fresh logo directions</b> alongside today's cobalt sheets (<b>00</b>). Open any candidate to inspect it in Folio's actual <b>web header &amp; favicon</b>, across <b>iOS Light / Dark / Tinted / macOS</b>, down to <b>16px</b>, and on an <b>iPhone Home Screen</b>.",
    legend: [
      "<b>20</b> candidates + baseline",
      "<b>01–05</b> Paper &amp; Craft",
      "<b>06–10</b> Multi-Agent",
      "<b>11–15</b> Monogram F",
      "<b>16–20</b> Architectural",
    ],
    round: 1,
    frame: "icon",
    size: [390, 390],
    candidates: C,
  };
})();
