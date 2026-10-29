// Tether Logo Redesign Candidates
// 20 candidates + baseline:
// Part 1 (01-10): Stylistic evolutions of the current 3-pane terminal/web/files logo
// Part 2 (11-20): Fresh conceptual directions (USB-C tethering, docking, T-matrix, trident, helix, etc.)
(() => {
  const K = KIT;

  const C = [];
  const add = (c) => C.push(K.attachViews(c));

  // ══════════════════════════════════════════════════════════════════
  // BASELINE · Candidate 0
  // ══════════════════════════════════════════════════════════════════
  add({
    id: "current",
    n: 0,
    group: "style",
    baseline: true,
    name: "Current logo",
    tagline: "Dark slate 3-pane window with tall terminal prompt, web and file bars",
    concept: "The existing Tether mark from production: an SVG desktop window with a 3-way split pane on dark GitHub slate (#0D1117 / #161B22). Shows a tall terminal prompt (>_) on the left, a green web bar on top-right, and an amber files bar on bottom-right. Functional, but flat and low contrast at small sizes.",
    palette: [["Slate Base", "#0D1117"], ["Window Fill", "#161B22"], ["Terminal Blue", "#58A6FF"], ["Web Green", "#3FB950"], ["Files Amber", "#D29922"]],
    moves: [
      "Faithful 1:1 vector recreation of production icon.svg",
      "Tall left terminal pane with >_ prompt",
      "Right half split horizontally into web and file bars"
    ],
    facts: { Type: "Vector Window", Contrast: "Medium", Readability: "Good at >64px" },
    draw: () => `
      <rect width="1024" height="1024" rx="224" fill="#0D1117"/>
      <rect x="112" y="144" width="800" height="736" rx="96" stroke="#30363D" stroke-width="32" fill="#161B22"/>
      <path d="M112 272H912" stroke="#30363D" stroke-width="24"/>
      <path d="M512 272V880" stroke="#30363D" stroke-width="24"/>
      <path d="M512 576H912" stroke="#30363D" stroke-width="24"/>
      <rect x="128" y="160" width="368" height="96" rx="24" fill="#2F81F7" fill-opacity="0.22"/>
      <circle cx="192" cy="208" r="24" fill="#2F81F7"/>
      <path d="M208 416L272 480L208 544" stroke="#58A6FF" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M304 544H400" stroke="#58A6FF" stroke-width="32" stroke-linecap="round"/>
      <rect x="592" y="352" width="240" height="48" rx="24" fill="#3FB950"/>
      <rect x="592" y="440" width="176" height="40" rx="20" fill="#8B949E"/>
      <rect x="592" y="656" width="224" height="48" rx="24" fill="#D29922"/>
      <rect x="592" y="744" width="160" height="40" rx="20" fill="#8B949E"/>
    `
  });

  // ══════════════════════════════════════════════════════════════════
  // PART 1 · 10 STYLE VARIATIONS OF CURRENT LOGO (01–10)
  // ══════════════════════════════════════════════════════════════════

  // 01 · Neon Synthwave / Cyberpunk
  add({
    id: "neon",
    n: 1,
    group: "style",
    name: "Neon Synthwave",
    tagline: "Obsidian glass with glowing neon cyan/magenta borders and radiant bloom",
    concept: "Takes the 3-pane architecture into an electric cyberpunk aesthetic. Deep obsidian glass background with radiant gradient stroke borders, glowing terminal prompt with bloom filter, and vibrant neon status indicators that pop intensely on OLED screens.",
    palette: [["Obsidian", "#07060E"], ["Neon Cyan", "#00F0FF"], ["Hot Magenta", "#FF007F"], ["Electric Amber", "#FFB800"]],
    moves: [
      "Gradient border strokes with feGaussianBlur bloom",
      "Vibrant high-luma cyan prompt >_ with cursor aura",
      "Luminous status jewels in titlebar"
    ],
    facts: { Style: "Cyberpunk / OLED", Contrast: "Maximum", Accent: "Cyan & Magenta" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00F0FF"/>
          <stop offset="50%" stop-color="#A855F7"/>
          <stop offset="100%" stop-color="#FF007F"/>
        </linearGradient>
        <filter id="${uid}_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="${uid}_rad" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#1E1435"/>
          <stop offset="100%" stop-color="#07060E"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#${uid}_rad)"/>
      <rect x="110" y="140" width="804" height="744" rx="88" stroke="url(#${uid}_g1)" stroke-width="28" fill="#0C0A18" fill-opacity="0.88" filter="url(#${uid}_glow)"/>
      <path d="M110 264H914" stroke="#251F3D" stroke-width="20"/>
      <path d="M512 264V884" stroke="url(#${uid}_g1)" stroke-width="20"/>
      <path d="M512 574H914" stroke="url(#${uid}_g1)" stroke-width="20"/>
      <circle cx="180" cy="202" r="18" fill="#FF007F"/>
      <circle cx="230" cy="202" r="18" fill="#FFB800"/>
      <circle cx="280" cy="202" r="18" fill="#00F0FF"/>
      <!-- Glowing Terminal Prompt -->
      <g filter="url(#${uid}_glow)">
        <path d="M210 420L280 490L210 560" stroke="#00F0FF" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M310 560H410" stroke="#00F0FF" stroke-width="36" stroke-linecap="round"/>
      </g>
      <!-- Neon Web Pane -->
      <rect x="580" y="348" width="250" height="52" rx="26" fill="#00FF66" filter="url(#${uid}_glow)"/>
      <rect x="580" y="436" width="160" height="34" rx="17" fill="#6B7280" opacity="0.6"/>
      <!-- Neon Files Pane -->
      <rect x="580" y="654" width="230" height="52" rx="26" fill="#FFB800" filter="url(#${uid}_glow)"/>
      <rect x="580" y="742" width="140" height="34" rx="17" fill="#6B7280" opacity="0.6"/>
    `
  });

  // 02 · Nord Frost Minimal
  add({
    id: "nord",
    n: 2,
    group: "style",
    name: "Nord Frost",
    tagline: "Cool Scandinavian slate with polar ice blue, frost aurora accents and matte finish",
    concept: "A calm, highly refined Scandinavian developer aesthetic. Matte slate base (#2E3440) with gentle rounded pane cards, icy polar blue terminal prompt, aurora green web indicator, and golden frost file tags. Zero glare, pure typographic calm.",
    palette: [["Nord Night", "#2E3440"], ["Polar Ice", "#88C0D0"], ["Frost Blue", "#81A1C1"], ["Aurora Green", "#A3BE8C"], ["Aurora Yellow", "#EBCB8B"]],
    moves: [
      "Individual floating matte pane cards with 32px radii",
      "Authentic Arctic Nord palette tuned for zero eye fatigue",
      "Pill-shaped tab header with soft status dot"
    ],
    facts: { Style: "Nordic Minimal", Feel: "Calm / Matte", Tone: "Pro Developer" },
    draw: () => `
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- Window Frame -->
      <rect x="100" y="130" width="824" height="764" rx="90" fill="#3B4252" stroke="#4C566A" stroke-width="18"/>
      <!-- Title Bar -->
      <rect x="140" y="170" width="280" height="68" rx="24" fill="#434C5E"/>
      <circle cx="180" cy="204" r="16" fill="#88C0D0"/>
      <rect x="220" y="196" width="140" height="16" rx="8" fill="#D8DEE9"/>
      <!-- Left Pane: Terminal Card -->
      <rect x="140" y="270" width="340" height="580" rx="44" fill="#2E3440" stroke="#434C5E" stroke-width="12"/>
      <path d="M220 440L290 510L220 580" stroke="#88C0D0" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M320 580H400" stroke="#81A1C1" stroke-width="32" stroke-linecap="round"/>
      <!-- Top Right Pane: Web Card -->
      <rect x="520" y="270" width="364" height="270" rx="44" fill="#2E3440" stroke="#434C5E" stroke-width="12"/>
      <rect x="570" y="340" width="230" height="44" rx="22" fill="#A3BE8C"/>
      <rect x="570" y="416" width="160" height="30" rx="15" fill="#D8DEE9" opacity="0.6"/>
      <!-- Bottom Right Pane: Files Card -->
      <rect x="520" y="580" width="364" height="270" rx="44" fill="#2E3440" stroke="#434C5E" stroke-width="12"/>
      <rect x="570" y="650" width="210" height="44" rx="22" fill="#EBCB8B"/>
      <rect x="570" y="726" width="140" height="30" rx="15" fill="#D8DEE9" opacity="0.6"/>
    `
  });

  // 03 · Retro CRT Amber Phosphor
  add({
    id: "crt",
    n: 3,
    group: "style",
    name: "Retro CRT Phosphor",
    tagline: "DEC VT220 amber phosphor monochrome with curved cathode glass and scanlines",
    concept: "Pays homage to the golden era of serial terminals (DEC VT220 / VT100). Curved dark amber cathode screen with horizontal scanlines, glowing phosphor amber split borders, and a chunky monospace terminal prompt with a solid block cursor █.",
    palette: [["Cathode Dark", "#160C03"], ["Amber Phosphor", "#FF9E0B"], ["Bright Glow", "#FFD066"], ["Bezel", "#281A0E"]],
    moves: [
      "Curved cathode CRT glass bezel with specular corner shine",
      "Horizontal raster scanline overlay",
      "Solid block cursor █ and authentic vintage terminal aura"
    ],
    facts: { Style: "DEC VT220 Retro", Tone: "Monochrome Warm", Prompt: "Block Cursor" },
    draw: ({ uid }) => `
      <defs>
        <pattern id="${uid}_scan" width="100" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="100" y2="0" stroke="#000000" stroke-width="3" opacity="0.45"/>
        </pattern>
        <radialGradient id="${uid}_glass" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#3D2005"/>
          <stop offset="70%" stop-color="#180C03"/>
          <stop offset="100%" stop-color="#0A0401"/>
        </radialGradient>
      </defs>
      <!-- Bezel -->
      <rect width="1024" height="1024" fill="#24170D"/>
      <!-- CRT Screen Tube -->
      <rect x="90" y="110" width="844" height="804" rx="140" fill="url(#${uid}_glass)" stroke="#FF9E0B" stroke-width="18"/>
      <!-- Scanlines -->
      <rect x="90" y="110" width="844" height="804" rx="140" fill="url(#${uid}_scan)"/>
      <!-- Terminal Splits in Amber -->
      <path d="M120 250H904" stroke="#FF9E0B" stroke-width="16" opacity="0.7"/>
      <path d="M512 250V874" stroke="#FF9E0B" stroke-width="16" opacity="0.7"/>
      <path d="M512 562H904" stroke="#FF9E0B" stroke-width="16" opacity="0.7"/>
      <!-- Title text -->
      <rect x="150" y="170" width="220" height="40" rx="12" fill="#FF9E0B" opacity="0.3"/>
      <!-- Terminal Prompt with Block Cursor -->
      <path d="M210 430L270 490L210 550" stroke="#FFD066" stroke-width="36" stroke-linecap="square"/>
      <rect x="300" y="470" width="60" height="80" fill="#FFD066"/>
      <!-- Status bars -->
      <rect x="580" y="360" width="230" height="46" fill="#FF9E0B"/>
      <rect x="580" y="440" width="160" height="28" fill="#FF9E0B" opacity="0.4"/>
      <rect x="580" y="670" width="200" height="46" fill="#FF9E0B"/>
      <rect x="580" y="746" width="130" height="28" fill="#FF9E0B" opacity="0.4"/>
    `
  });

  // 04 · Machined Titanium & Glass
  add({
    id: "titanium",
    n: 4,
    group: "style",
    name: "Machined Titanium",
    tagline: "Dark anodized titanium chassis with precision laser-milled split grooves",
    concept: "Engineered to complement Apple Pro hardware and external Apple Studio Displays. Anodized space black chassis with micro-chamfered specular highlights, precision laser-milled dividing grooves, smoked glass panes, and sapphire blue terminal accents.",
    palette: [["Space Black", "#141416"], ["Titanium Bevel", "#3A3A3E"], ["Specular Steel", "#8E8E93"], ["Sapphire Blue", "#0A84FF"]],
    moves: [
      "Chamfered multi-stop metallic linear gradients",
      "Precision laser-groove dividing lines with specular bottom rim",
      "High-end hardware tactile finish"
    ],
    facts: { Style: "Apple Pro Hardware", Finish: "Titanium / Glass", Feel: "Engineered" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_ti" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2C2C30"/>
          <stop offset="50%" stop-color="#18181B"/>
          <stop offset="100%" stop-color="#0E0E10"/>
        </linearGradient>
        <linearGradient id="${uid}_rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#636366"/>
          <stop offset="50%" stop-color="#2C2C2E"/>
          <stop offset="100%" stop-color="#8E8E93"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#${uid}_ti)"/>
      <!-- Milled Chassis Bevel -->
      <rect x="100" y="130" width="824" height="764" rx="96" fill="#1C1C1E" stroke="url(#${uid}_rim)" stroke-width="16"/>
      <!-- Pane Dividers (Dual laser grooves) -->
      <path d="M100 260H924" stroke="#000000" stroke-width="20"/>
      <path d="M100 270H924" stroke="#48484A" stroke-width="4"/>
      <path d="M512 260V894" stroke="#000000" stroke-width="20"/>
      <path d="M522 260V894" stroke="#48484A" stroke-width="4"/>
      <path d="M512 570H924" stroke="#000000" stroke-width="20"/>
      <path d="M512 580H924" stroke="#48484A" stroke-width="4"/>
      <!-- Window Hardware Screws -->
      <circle cx="160" cy="195" r="14" fill="#3A3A3C" stroke="#636366" stroke-width="4"/>
      <circle cx="210" cy="195" r="14" fill="#3A3A3C" stroke="#636366" stroke-width="4"/>
      <!-- Sapphire Blue Terminal Prompt -->
      <path d="M220 440L290 510L220 580" stroke="#0A84FF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M320 580H410" stroke="#0A84FF" stroke-width="34" stroke-linecap="round"/>
      <!-- Precision Hardware Indicators -->
      <rect x="580" y="360" width="230" height="44" rx="10" fill="#30D158"/>
      <rect x="580" y="434" width="160" height="24" rx="6" fill="#636366"/>
      <rect x="580" y="670" width="210" height="44" rx="10" fill="#FF9F0A"/>
      <rect x="580" y="744" width="140" height="24" rx="6" fill="#636366"/>
    `
  });

  // 05 · High-Contrast Brutalist Ink
  add({
    id: "brutalist",
    n: 5,
    group: "style",
    name: "Brutalist Ink",
    tagline: "Architectural Swiss monochrome with thick 36px structural bars and safety orange accent",
    concept: "Stark, high-impact architectural Swiss brutalism. Massive pitch-black canvas with bold 36px pure white framing lines, geometric monospace prompt, and a single international safety orange accent dot. Razor-sharp legibility all the way down to 16px.",
    palette: [["Pure Black", "#000000"], ["Paper White", "#FFFFFF"], ["Safety Orange", "#FF4400"], ["Ash Gray", "#444444"]],
    moves: [
      "Ultra-thick 36px orthogonal dividing bars",
      "Zero gradients or blurs: 100% vector punch",
      "International Safety Orange (#FF4400) focal accent"
    ],
    facts: { Style: "Swiss Brutalism", Contrast: "Maximum (21:1)", Visibility: "Supreme at 16px" },
    draw: () => `
      <rect width="1024" height="1024" fill="#000000"/>
      <!-- Heavy Outer Frame -->
      <rect x="96" y="120" width="832" height="784" rx="54" stroke="#FFFFFF" stroke-width="36" fill="#000000"/>
      <!-- Heavy Orthogonal Grid Lines -->
      <path d="M96 270H928" stroke="#FFFFFF" stroke-width="36"/>
      <path d="M512 270V904" stroke="#FFFFFF" stroke-width="36"/>
      <path d="M512 580H928" stroke="#FFFFFF" stroke-width="36"/>
      <!-- Safety Orange Title Dot -->
      <circle cx="180" cy="195" r="30" fill="#FF4400"/>
      <!-- Crisp White Geometric Terminal Prompt -->
      <path d="M200 440L280 520L200 600" stroke="#FFFFFF" stroke-width="44" stroke-linecap="square"/>
      <rect x="310" y="560" width="90" height="40" fill="#FF4400"/>
      <!-- Solid Block Pane Bars -->
      <rect x="580" y="370" width="250" height="56" fill="#FFFFFF"/>
      <rect x="580" y="460" width="160" height="32" fill="#555555"/>
      <rect x="580" y="680" width="220" height="56" fill="#FFFFFF"/>
      <rect x="580" y="770" width="140" height="32" fill="#555555"/>
    `
  });

  // 06 · Solarized Dark Velvet
  add({
    id: "solarized",
    n: 6,
    group: "style",
    name: "Solarized Velvet",
    tagline: "Ethan Schoonover's classic hacker palette: velvet teal base with cyan and ochre accents",
    concept: "Built from the mathematically balanced CIE Lab color spaces of Ethan Schoonover's Solarized Dark. Deep velvet teal base (#002B36), slate teal container, brilliant cyan prompt (#2AA198), grass green web bar (#859900), and yellow-ochre files bar (#B58900).",
    palette: [["Base Teal", "#002B36"], ["Highlight Teal", "#073642"], ["Cyan Prompt", "#2AA198"], ["Web Green", "#859900"], ["Ochre Files", "#B58900"]],
    moves: [
      "Authentic Solarized Lab-calibrated color values",
      "Soft velvet contrast optimized for late-night terminal work",
      "Signature teal and warm ochre visual anchor"
    ],
    facts: { Style: "Solarized Dark", Atmosphere: "Scholarly", Focus: "Terminal Lovers" },
    draw: () => `
      <rect width="1024" height="1024" fill="#002B36"/>
      <rect x="100" y="130" width="824" height="764" rx="88" fill="#073642" stroke="#586E75" stroke-width="20"/>
      <path d="M100 264H924" stroke="#586E75" stroke-width="20"/>
      <path d="M512 264V894" stroke="#586E75" stroke-width="20"/>
      <path d="M512 574H924" stroke="#586E75" stroke-width="20"/>
      <!-- Solarized Status Dots -->
      <circle cx="180" cy="197" r="20" fill="#268BD2"/>
      <rect x="230" y="185" width="160" height="24" rx="12" fill="#586E75"/>
      <!-- Cyan Terminal Prompt -->
      <path d="M210 430L280 500L210 570" stroke="#2AA198" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M310 570H410" stroke="#268BD2" stroke-width="36" stroke-linecap="round"/>
      <!-- Web Green Bar -->
      <rect x="580" y="356" width="240" height="48" rx="24" fill="#859900"/>
      <rect x="580" y="438" width="160" height="32" rx="16" fill="#657B83"/>
      <!-- Ochre Files Bar -->
      <rect x="580" y="666" width="210" height="48" rx="24" fill="#B58900"/>
      <rect x="580" y="748" width="140" height="32" rx="16" fill="#657B83"/>
    `
  });

  // 07 · De Stijl / Bauhaus Constructivist
  add({
    id: "bauhaus",
    n: 7,
    group: "style",
    name: "De Stijl Constructivist",
    tagline: "Constructivist primary blocks: cobalt terminal, vermilion web, and primrose files in thick grids",
    concept: "Reinterprets the 3-pane layout as modern art inspired by Piet Mondrian and Gerrit Rietveld. Off-white canvas with heavy black structural grid lines; the tall terminal becomes a field of deep Cobalt Blue (#1B48E0), the web pane becomes Vermilion (#E63946), and the files pane becomes Primrose Yellow (#FFD166).",
    palette: [["Cobalt Blue", "#1B48E0"], ["Vermilion", "#E63946"], ["Primrose Yellow", "#FFD166"], ["Grid Black", "#141414"], ["Cream", "#F7F5EE"]],
    moves: [
      "Transforms split-pane ratios into artistic color fields",
      "Bold 32px black structural dividing matrix",
      "Stands out instantly across any device home screen"
    ],
    facts: { Style: "De Stijl / Modernist", Color: "Bold Primary", Feel: "Museum / Design" },
    draw: () => `
      <rect width="1024" height="1024" fill="#F7F5EE"/>
      <!-- Outer Black Container -->
      <rect x="90" y="110" width="844" height="804" rx="72" stroke="#141414" stroke-width="32" fill="#F7F5EE"/>
      <!-- Pane Color Fills -->
      <!-- Left Tall Pane: Cobalt Blue -->
      <rect x="106" y="260" width="390" height="638" fill="#1B48E0"/>
      <!-- Top Right Pane: Vermilion Red -->
      <rect x="512" y="260" width="406" height="304" fill="#E63946"/>
      <!-- Bottom Right Pane: Primrose Yellow -->
      <rect x="512" y="580" width="406" height="318" fill="#FFD166"/>
      <!-- Heavy Black Grid Lines -->
      <path d="M90 260H934" stroke="#141414" stroke-width="32"/>
      <path d="M512 260V914" stroke="#141414" stroke-width="32"/>
      <path d="M512 580H934" stroke="#141414" stroke-width="32"/>
      <!-- White Prompt on Cobalt Blue -->
      <path d="M210 440L280 510L210 580" stroke="#FFFFFF" stroke-width="38" stroke-linecap="square"/>
      <rect x="310" y="560" width="80" height="24" fill="#FFFFFF"/>
      <!-- White Web Bar on Vermilion -->
      <rect x="570" y="370" width="240" height="44" rx="10" fill="#FFFFFF"/>
      <!-- Black Files Bar on Primrose -->
      <rect x="570" y="690" width="220" height="44" rx="10" fill="#141414"/>
    `
  });

  // 08 · visionOS Frosted Glassmorphism
  add({
    id: "glassmorphism",
    n: 8,
    group: "style",
    name: "visionOS Glass",
    tagline: "Layered spatial glass with prismatic rim refraction and floating translucent panes",
    concept: "Designed for modern spatial computing and visionOS. Features a frosted acrylic outer chassis, multi-layered floating pane glass with depth drop-shadows, an iridescent prismatic edge reflection, and glowing cyan/emerald translucent elements.",
    palette: [["Deep Spatial", "#0A0D18"], ["Rim Prismatic", "linear-cyan-pink"], ["Glass Surface", "rgba(255,255,255,0.08)"], ["Glowing Cyan", "#38BDF8"]],
    moves: [
      "Prismatic multi-stop rim highlight gradient",
      "Floating translucent pane cards with individual drop shadows",
      "Modern spatial depth and high-end glass aesthetics"
    ],
    facts: { Style: "Spatial Glass", Atmosphere: "Translucent", Depth: "Layered 3D" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.9"/>
          <stop offset="40%" stop-color="#818CF8" stop-opacity="0.8"/>
          <stop offset="70%" stop-color="#F472B6" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="#34D399" stop-opacity="0.9"/>
        </linearGradient>
        <filter id="${uid}_sh" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#0A0D18"/>
      <!-- Outer Glass Shell -->
      <rect x="100" y="130" width="824" height="764" rx="90" fill="#151A2E" stroke="url(#${uid}_rim)" stroke-width="12"/>
      <!-- Title Bar Glass Pill -->
      <rect x="140" y="170" width="260" height="64" rx="24" fill="#FFFFFF" fill-opacity="0.08"/>
      <circle cx="180" cy="202" r="16" fill="#38BDF8"/>
      <!-- Floating Glass Pane 1 (Left Terminal) -->
      <rect x="140" y="270" width="340" height="580" rx="40" fill="#FFFFFF" fill-opacity="0.07" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="4" filter="url(#${uid}_sh)"/>
      <path d="M220 440L290 510L220 580" stroke="#38BDF8" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M320 580H400" stroke="#818CF8" stroke-width="32" stroke-linecap="round"/>
      <!-- Floating Glass Pane 2 (Top Web) -->
      <rect x="520" y="270" width="364" height="270" rx="40" fill="#FFFFFF" fill-opacity="0.07" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="4" filter="url(#${uid}_sh)"/>
      <rect x="570" y="340" width="220" height="42" rx="21" fill="#34D399"/>
      <!-- Floating Glass Pane 3 (Bottom Files) -->
      <rect x="520" y="580" width="364" height="270" rx="40" fill="#FFFFFF" fill-opacity="0.07" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="4" filter="url(#${uid}_sh)"/>
      <rect x="570" y="650" width="200" height="42" rx="21" fill="#F59E0B"/>
    `
  });

  // 09 · Eurorack Modular Synth Hardware
  add({
    id: "eurorack",
    n: 9,
    group: "style",
    name: "Eurorack Modular",
    tagline: "Industrial powdercoat rack unit with knurled hex screws, patch-bay splits and LED jewels",
    concept: "Transforms Tether into a rugged piece of studio analog gear. Textured dark charcoal powdercoat finish with knurled hex mounting bolts in the corners, milled rack rails dividing the panes, and illuminated status LED jewels with realistic radial glow.",
    palette: [["Powdercoat Slate", "#1C1F26"], ["Rack Steel", "#4B5563"], ["Signal Green", "#10B981"], ["Patch Amber", "#F59E0B"]],
    moves: [
      "Corner knurled hex screws with realistic metallic bevels",
      "Industrial patch-bay status LEDs with radial lens glow",
      "Tactile hardware vibe suited for hardcore engineers"
    ],
    facts: { Style: "Analog Hardware", Vibe: "Studio Gear", Detail: "Hex Bolts & LEDs" },
    draw: ({ uid }) => `
      <defs>
        <radialGradient id="${uid}_led_g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#34D399"/>
          <stop offset="70%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#064E3B"/>
        </radialGradient>
        <radialGradient id="${uid}_led_a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="70%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#78350F"/>
        </radialGradient>
      </defs>
      <!-- Powdercoat Panel -->
      <rect width="1024" height="1024" fill="#181B22"/>
      <!-- Rack Chassis Frame -->
      <rect x="90" y="110" width="844" height="804" rx="60" fill="#222630" stroke="#374151" stroke-width="16"/>
      <!-- Knurled Hex Bolts in Corners -->
      <circle cx="150" cy="170" r="22" fill="#4B5563" stroke="#6B7280" stroke-width="6"/>
      <circle cx="874" cy="170" r="22" fill="#4B5563" stroke="#6B7280" stroke-width="6"/>
      <circle cx="150" cy="854" r="22" fill="#4B5563" stroke="#6B7280" stroke-width="6"/>
      <circle cx="874" cy="854" r="22" fill="#4B5563" stroke="#6B7280" stroke-width="6"/>
      <!-- Milled Rack Rails -->
      <path d="M90 260H934" stroke="#111827" stroke-width="22"/>
      <path d="M512 260V914" stroke="#111827" stroke-width="22"/>
      <path d="M512 580H934" stroke="#111827" stroke-width="22"/>
      <!-- LED Jewels -->
      <circle cx="230" cy="190" r="16" fill="url(#${uid}_led_g)"/>
      <circle cx="280" cy="190" r="16" fill="url(#${uid}_led_a)"/>
      <!-- Industrial Terminal Prompt -->
      <path d="M210 440L280 510L210 580" stroke="#38BDF8" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M310 580H400" stroke="#38BDF8" stroke-width="34" stroke-linecap="round"/>
      <!-- Eurorack Patch Status Bars -->
      <rect x="580" y="360" width="230" height="46" rx="8" fill="#10B981"/>
      <rect x="580" y="680" width="210" height="46" rx="8" fill="#F59E0B"/>
    `
  });

  // 10 · Layered Papercraft Cutout
  add({
    id: "origami",
    n: 10,
    group: "style",
    name: "Papercraft Layered",
    tagline: "Dimensional layered paper cutouts with soft drop-shadow folds and tuck-in panes",
    concept: "Brings tactile physical craft into digital workspace tiling. Deep blueprint navy base with layered textured paper sheets that physically overlap with realistic soft drop shadows, chamfered 45-degree fold corners, and warm tactile precision.",
    palette: [["Blueprint Navy", "#0F172A"], ["Paper White", "#F8FAFC"], ["Cobalt Fold", "#2563EB"], ["Golden Fold", "#D97706"]],
    moves: [
      "Physical paper drop-shadow simulation under pane edges",
      "Tactile 45-degree angled sheet folds on active tabs",
      "Combines warm physical craft with technical tiling structure"
    ],
    facts: { Style: "Papercraft / Tactile", Shadow: "Dimensional", Accent: "Cobalt & Amber" },
    draw: ({ uid }) => `
      <defs>
        <filter id="${uid}_sh" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="6" dy="14" stdDeviation="16" flood-color="#020617" flood-opacity="0.55"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#0F172A"/>
      <!-- Base Paper Window -->
      <rect x="96" y="120" width="832" height="784" rx="64" fill="#1E293B" stroke="#334155" stroke-width="12"/>
      <!-- Top Title Bar Fold -->
      <rect x="140" y="160" width="280" height="64" rx="16" fill="#F8FAFC" filter="url(#${uid}_sh)"/>
      <circle cx="180" cy="192" r="14" fill="#2563EB"/>
      <!-- Left Tall Paper Sheet (Terminal) -->
      <rect x="140" y="260" width="340" height="590" rx="32" fill="#F8FAFC" filter="url(#${uid}_sh)"/>
      <path d="M220 440L290 510L220 580" stroke="#0F172A" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M320 580H400" stroke="#2563EB" stroke-width="34" stroke-linecap="round"/>
      <!-- Top Right Paper Sheet (Web) -->
      <rect x="520" y="260" width="364" height="270" rx="32" fill="#F8FAFC" filter="url(#${uid}_sh)"/>
      <rect x="570" y="340" width="220" height="44" rx="12" fill="#2563EB"/>
      <!-- Bottom Right Paper Sheet (Files) -->
      <rect x="520" y="570" width="364" height="280" rx="32" fill="#F8FAFC" filter="url(#${uid}_sh)"/>
      <rect x="570" y="650" width="200" height="44" rx="12" fill="#D97706"/>
    `
  });

  // ══════════════════════════════════════════════════════════════════
  // PART 2 · 10 FRESH CONCEPTUAL DIRECTIONS (11–20)
  // ══════════════════════════════════════════════════════════════════

  // 11 · The Tether Cord (Braided Loop)
  add({
    id: "cableloop",
    n: 11,
    group: "concept",
    name: "The Tether Cord",
    tagline: "A glowing braided USB-C cable looping into an unbroken 'T' monogram",
    concept: "Literalizes the 'tether' concept through hardware: a premium braided USB-C cable looping into a bold, unbroken letter 'T'. The horizontal arms terminate in anodized aluminum connector collars, while the central loop carries a glowing electric cyan data core.",
    palette: [["Obsidian", "#070B12"], ["Cyan Pulse", "#00F0FF"], ["Braided Slate", "#475569"], ["Aluminum", "#E2E8F0"]],
    moves: [
      "Cable loop forms the unmistakable monogram 'T'",
      "Anodized metal USB-C connector collars on the arms",
      "Internal illuminated fiber-optic data core"
    ],
    facts: { Metaphor: "Hardware Tether", Monogram: "Letter T", Scalability: "Superb" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_cbl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00F0FF"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
        <filter id="${uid}_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="20" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#070B12"/>
      <!-- Ambient Cable Core Glow -->
      <circle cx="512" cy="480" r="320" fill="#00F0FF" opacity="0.08" filter="url(#${uid}_glow)"/>
      <!-- Heavy Outer Braided Cable Path forming 'T' -->
      <path d="M220 320 H804 M512 320 V760" stroke="#1E293B" stroke-width="120" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M220 320 H804 M512 320 V760" stroke="#334155" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Glowing Inner Fiber Core -->
      <path d="M220 320 H804 M512 320 V760" stroke="url(#${uid}_cbl)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" filter="url(#${uid}_glow)"/>
      <!-- Connector Plugs on Ends -->
      <rect x="140" y="280" width="90" height="80" rx="16" fill="#94A3B8" stroke="#F1F5F9" stroke-width="8"/>
      <rect x="794" y="280" width="90" height="80" rx="16" fill="#94A3B8" stroke="#F1F5F9" stroke-width="8"/>
      <rect x="472" y="740" width="80" height="90" rx="16" fill="#94A3B8" stroke="#F1F5F9" stroke-width="8"/>
      <!-- Center Interlock Knot Ring -->
      <circle cx="512" cy="320" r="44" fill="#00F0FF" filter="url(#${uid}_glow)"/>
    `
  });

  // 12 · The Dual Horizon (Phone Docking to Monitor)
  add({
    id: "docking",
    n: 12,
    group: "concept",
    name: "The Dual Horizon",
    tagline: "Mobile silhouette docking into an ultrawide display, projecting a split-pane workspace",
    concept: "Directly illustrates what Tether does in the real world: an iPhone docks into an expansive external desktop display. A glowing tether beam connects the phone to the monitor, where the phone's power projects the full 3-pane split-screen desktop environment.",
    palette: [["Midnight Dark", "#0B0E17"], ["Monitor Slate", "#1E293B"], ["Tether Beam", "#38BDF8"], ["Phone Amber", "#F59E0B"]],
    moves: [
      "Ultrawide display top silhouette with glowing 3-pane tiling grid",
      "Compact smartphone silhouette docked at the bottom center",
      "Direct glowing tether beam linking phone port to monitor input"
    ],
    facts: { Metaphor: "Device Docking", Narrative: "Mobile → Desktop", Clarity: "High" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_beam" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="#0B0E17"/>
      <!-- External Desktop Display Frame -->
      <rect x="120" y="140" width="784" height="490" rx="48" fill="#151C2C" stroke="#334155" stroke-width="16"/>
      <!-- 3-Pane Split on Desktop Monitor -->
      <rect x="156" y="176" width="340" height="418" rx="24" fill="#0A0F1D" stroke="#38BDF8" stroke-width="12"/>
      <path d="M220 340L270 385L220 430" stroke="#38BDF8" stroke-width="26" stroke-linecap="round"/>
      <rect x="524" y="176" width="344" height="196" rx="24" fill="#0A0F1D" stroke="#10B981" stroke-width="12"/>
      <rect x="524" y="398" width="344" height="196" rx="24" fill="#0A0F1D" stroke="#F59E0B" stroke-width="12"/>
      <!-- Glowing Tether Beam between Monitor and Phone -->
      <path d="M512 630 V720" stroke="url(#${uid}_beam)" stroke-width="24" stroke-linecap="round"/>
      <!-- Docked Smartphone Silhouette -->
      <rect x="424" y="700" width="176" height="230" rx="36" fill="#1E293B" stroke="#F59E0B" stroke-width="14"/>
      <rect x="472" y="724" width="80" height="12" rx="6" fill="#F59E0B"/>
      <!-- Phone Display Active Node -->
      <circle cx="512" cy="820" r="28" fill="#38BDF8"/>
    `
  });

  // 13 · T-Matrix (Monogram Split Pane)
  add({
    id: "tmatrix",
    n: 13,
    group: "concept",
    name: "T-Matrix",
    tagline: "The letter 'T' forged directly out of the 3 split-pane workspace blocks",
    concept: "Unifies brand monogram with product functionality. The letter 'T' is geometrically assembled from 3 interlocking workspace panes: the top horizontal bar splits 50/50 into Web (Emerald) and Files (Amber), while the vertical stem is the tall Terminal pane with white prompt >_.",
    palette: [["Deep Navy", "#080C16"], ["Terminal Blue", "#2563EB"], ["Web Emerald", "#10B981"], ["Files Amber", "#F59E0B"]],
    moves: [
      "The letter T is the actual split-pane layout",
      "Top horizontal bar split into Web & Files panes",
      "Vertical stem forms the tall SSH terminal with >_ prompt"
    ],
    facts: { Metaphor: "Monogram + Layout", Monogram: "Letter T", Recognizability: "Instant" },
    draw: () => `
      <rect width="1024" height="1024" fill="#080C16"/>
      <!-- Top Left Bar: Web Pane (Emerald) -->
      <rect x="140" y="180" width="350" height="180" rx="36" fill="#10B981"/>
      <rect x="200" y="240" width="180" height="32" rx="16" fill="#FFFFFF"/>
      <rect x="200" y="290" width="120" height="20" rx="10" fill="#A7F3D0"/>
      <!-- Top Right Bar: Files Pane (Amber) -->
      <rect x="534" y="180" width="350" height="180" rx="36" fill="#F59E0B"/>
      <rect x="594" y="240" width="160" height="32" rx="16" fill="#FFFFFF"/>
      <rect x="594" y="290" width="110" height="20" rx="10" fill="#FDE68A"/>
      <!-- Center Vertical Stem: Tall Terminal Pane (Azure Blue) -->
      <rect x="362" y="390" width="300" height="490" rx="44" fill="#2563EB"/>
      <path d="M430 550L490 610L430 670" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M515 670H595" stroke="#FFFFFF" stroke-width="36" stroke-linecap="round"/>
      <!-- Divider Gaps between T elements -->
      <circle cx="512" cy="180" r="14" fill="#080C16"/>
    `
  });

  // 14 · Tri-Beam Trident
  add({
    id: "trident",
    n: 14,
    group: "concept",
    name: "Tri-Beam Trident",
    tagline: "Three radiant geometric beams branching from a central anchor hub: Web, SSH, and Files",
    concept: "Embodies Tether's strict non-negotiable rule: 'Three tools only: Web, SSH, and Files'. Three radiant geometric prongs branch outward at 120-degree angles from a central glowing tether ring, representing the 3 tools locked into one unified engine.",
    palette: [["Void Black", "#06080F"], ["SSH Cyan", "#00D2FF"], ["Web Violet", "#A855F7"], ["Files Coral", "#F43F5E"]],
    moves: [
      "120-degree radial tri-beam symmetry",
      "Each beam carries the signature color of one tool",
      "Central circular tether anchor locking the prongs together"
    ],
    facts: { Metaphor: "The 3 Core Tools", Symmetry: "Radial 120°", Energy: "Radiant" },
    draw: ({ uid }) => `
      <defs>
        <filter id="${uid}_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="24" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#06080F"/>
      <!-- Background Anchor Ring -->
      <circle cx="512" cy="512" r="340" fill="none" stroke="#1E293B" stroke-width="24"/>
      <!-- Center Anchor Hub -->
      <circle cx="512" cy="512" r="140" fill="#0F172A" stroke="#38BDF8" stroke-width="20"/>
      <circle cx="512" cy="512" r="60" fill="#38BDF8" filter="url(#${uid}_glow)"/>
      <!-- Beam 1: SSH (Upward Vertical, Cyan) -->
      <path d="M512 372 V140" stroke="#00D2FF" stroke-width="56" stroke-linecap="round" filter="url(#${uid}_glow)"/>
      <path d="M480 190L512 140L544 190" stroke="#00D2FF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Beam 2: Web (Bottom-Left, Violet) -->
      <path d="M391 582 L190 698" stroke="#A855F7" stroke-width="56" stroke-linecap="round" filter="url(#${uid}_glow)"/>
      <circle cx="190" cy="698" r="32" fill="#A855F7"/>
      <!-- Beam 3: Files (Bottom-Right, Coral) -->
      <path d="M633 582 L834 698" stroke="#F43F5E" stroke-width="56" stroke-linecap="round" filter="url(#${uid}_glow)"/>
      <circle cx="834" cy="698" r="32" fill="#F43F5E"/>
    `
  });

  // 15 · USB-C Aperture / Portal
  add({
    id: "usbcportal",
    n: 15,
    group: "concept",
    name: "USB-C Aperture",
    tagline: "The USB-C connector pill geometry framing a glowing desktop workspace portal",
    concept: "Celebrates the hardware medium that makes Tether possible: USB-C external displays. The iconic symmetrical pill contour of a USB-C connector forms the outer frame, functioning as a portal through which you gaze into an illuminated 3-pane desktop workspace.",
    palette: [["Gunmetal", "#0E1117"], ["Port Steel", "#475569"], ["Portal Blue", "#2563EB"], ["Core Glow", "#38BDF8"]],
    moves: [
      "Iconic USB-C plug contour with chamfered contact pins",
      "Inner portal reveals the 3-pane desktop workspace horizon",
      "Direct homage to USB-C display tethering"
    ],
    facts: { Metaphor: "USB-C Hardware", Shape: "Connector Pill", Meaning: "External Display" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#475569"/>
          <stop offset="50%" stop-color="#1E293B"/>
          <stop offset="100%" stop-color="#0F172A"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="#0A0D14"/>
      <!-- USB-C Pill Frame -->
      <rect x="110" y="270" width="804" height="484" rx="242" fill="url(#${uid}_metal)" stroke="#64748B" stroke-width="24"/>
      <!-- Inner Portal Cavity -->
      <rect x="170" y="320" width="684" height="384" rx="192" fill="#030712" stroke="#38BDF8" stroke-width="12"/>
      <!-- 3-Pane Workspace Inside Port -->
      <g transform="translate(230, 360)">
        <!-- Left Pane (Terminal) -->
        <rect x="0" y="0" width="240" height="304" rx="24" fill="#0F172A" stroke="#38BDF8" stroke-width="10"/>
        <path d="M50 110L90 150L50 190" stroke="#38BDF8" stroke-width="22" stroke-linecap="round"/>
        <!-- Right Top Pane (Web) -->
        <rect x="270" y="0" width="300" height="140" rx="20" fill="#0F172A" stroke="#10B981" stroke-width="10"/>
        <rect x="300" y="45" width="160" height="24" rx="12" fill="#10B981"/>
        <!-- Right Bottom Pane (Files) -->
        <rect x="270" y="164" width="300" height="140" rx="20" fill="#0F172A" stroke="#F59E0B" stroke-width="10"/>
        <rect x="300" y="210" width="140" height="24" rx="12" fill="#F59E0B"/>
      </g>
    `
  });

  // 16 · The Geometric Anchor
  add({
    id: "anchor",
    n: 16,
    group: "concept",
    name: "Geometric Anchor",
    tagline: "Minimalist nautical anchor geometry where the stock and shank form a split-pane frame",
    concept: "Takes the name 'Tether' to its naval origin: an anchor that stabilizes mobile power to fixed station. The top horizontal stock forms the window titlebar, the central vertical shank forms the split divider, and the upward-curving flukes cradle the terminal prompt.",
    palette: [["Ocean Dark", "#030A16"], ["Seafoam Teal", "#2DD4BF"], ["Anchor Steel", "#334155"], ["Electric Ice", "#E0F2FE"]],
    moves: [
      "Pure vector abstraction of naval anchor and split-pane window",
      "Central shank forms the normative split ratio divider",
      "Curved flukes embrace the terminal cursor in a stable cradle"
    ],
    facts: { Metaphor: "Anchor / Stability", Style: "Precision Vector", Vibe: "Steady & Solid" },
    draw: () => `
      <rect width="1024" height="1024" fill="#030A16"/>
      <!-- Top Anchor Ring -->
      <circle cx="512" cy="180" r="70" fill="none" stroke="#2DD4BF" stroke-width="24"/>
      <!-- Stock (Horizontal Bar / Titlebar) -->
      <rect x="200" y="280" width="624" height="44" rx="22" fill="#334155"/>
      <!-- Shank (Vertical Split Divider) -->
      <path d="M512 280 V740" stroke="#2DD4BF" stroke-width="32" stroke-linecap="round"/>
      <!-- Anchor Flukes (Curved Bottom Cradle) -->
      <path d="M220 540 C 220 780, 804 780, 804 540" fill="none" stroke="#2DD4BF" stroke-width="36" stroke-linecap="round"/>
      <!-- Fluke Tips (Triangles) -->
      <polygon points="190,550 250,550 220,490" fill="#2DD4BF"/>
      <polygon points="774,550 834,550 804,490" fill="#2DD4BF"/>
      <!-- Terminal Prompt Nestled in Left Fluke -->
      <path d="M300 460L360 510L300 560" stroke="#E0F2FE" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- File/Web Bar Nestled in Right Fluke -->
      <rect x="620" y="470" width="130" height="28" rx="14" fill="#E0F2FE"/>
      <rect x="620" y="520" width="90" height="24" rx="12" fill="#334155"/>
    `
  });

  // 17 · Isometric Tiling Prism
  add({
    id: "prism",
    n: 17,
    group: "concept",
    name: "Isometric Prism",
    tagline: "An isometric 3D cube unfolding into 3 workspace panes in axonometric perspective",
    concept: "Visualizes the dynamic spatial organization of Tether's split-pane tree. An isometric 3D prism displays the three workspace tools across its 3 visible faces: top face is Web, left face is the tall SSH terminal, and right face is Files, emphasizing 3D workspace tiling.",
    palette: [["Shadow Navy", "#070C18"], ["Facet Blue", "#2563EB"], ["Facet Cyan", "#06B6D4"], ["Facet Amber", "#F59E0B"]],
    moves: [
      "Exact 30-degree axonometric isometric cube geometry",
      "Each face dedicated to one of the 3 workspace tools",
      "Terminal prompt projected in perspective along the left facet"
    ],
    facts: { Metaphor: "Spatial 3D Tiling", Geometry: "Isometric 30°", Dimension: "Axonometric" },
    draw: () => `
      <rect width="1024" height="1024" fill="#070C18"/>
      <!-- Center Isometric Cube (Center at 512, 530, radius 340) -->
      <!-- Top Face: Web Pane (Emerald/Cyan) -->
      <polygon points="512,190 806,360 512,530 218,360" fill="#06B6D4"/>
      <polygon points="512,240 736,370 512,500 288,370" fill="#0891B2"/>
      <rect x="420" y="340" width="180" height="24" rx="12" fill="#FFFFFF" transform="rotate(-30 420 340)"/>
      <!-- Left Face: Terminal Pane (Deep Azure Blue) -->
      <polygon points="218,360 512,530 512,870 218,700" fill="#1D4ED8"/>
      <!-- Terminal Prompt in Perspective -->
      <g transform="translate(300, 520) skewY(30)">
        <path d="M0 0 L40 40 L0 80" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M60 80 H120" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>
      </g>
      <!-- Right Face: Files Pane (Warm Amber) -->
      <polygon points="512,530 806,360 806,700 512,870" fill="#D97706"/>
      <g transform="translate(580, 520) skewY(-30)">
        <rect x="0" y="0" width="140" height="32" rx="10" fill="#FFFFFF"/>
        <rect x="0" y="50" width="100" height="24" rx="8" fill="#FDE68A"/>
      </g>
      <!-- Specular Spine Edges -->
      <line x1="512" y1="190" x2="512" y2="870" stroke="#FFFFFF" stroke-width="6" opacity="0.4"/>
    `
  });

  // 18 · Command Helix (Synchronous Strands)
  add({
    id: "helix",
    n: 18,
    group: "concept",
    name: "Command Helix",
    tagline: "Two fiber-optic strands intertwining into a double-helix link between phone and screen",
    concept: "Represents real-time continuous synchronization between phone and external display. Two illuminated fiber-optic ribbons (local touch input and remote SSH output) intertwine in a sleek double-helix loop, linked by pulsing sync nodes at every intersection.",
    palette: [["Deep Cosmic", "#05070D"], ["Fiber Cyan", "#00F0FF"], ["Fiber Amber", "#F59E0B"], ["Sync White", "#FFFFFF"]],
    moves: [
      "Continuous double-helix twisting ribbons",
      "Pulsing data transfer nodes where strands cross",
      "Conveys high-speed zero-latency tether connection"
    ],
    facts: { Metaphor: "Data Sync / Helix", Flow: "Continuous Ribbon", Energy: "Dynamic" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_c1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#00F0FF"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
        <linearGradient id="${uid}_c2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#EF4444"/>
        </linearGradient>
        <filter id="${uid}_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#05070D"/>
      <!-- Helix Strand 1 (Cyan) -->
      <path d="M300 200 C 600 200, 600 400, 300 500 C 600 600, 600 800, 300 820" fill="none" stroke="url(#${uid}_c1)" stroke-width="48" stroke-linecap="round" filter="url(#${uid}_glow)"/>
      <!-- Helix Strand 2 (Amber) -->
      <path d="M724 200 C 424 200, 424 400, 724 500 C 424 600, 424 800, 724 820" fill="none" stroke="url(#${uid}_c2)" stroke-width="48" stroke-linecap="round" filter="url(#${uid}_glow)"/>
      <!-- Cross Nodes (Sync Points) -->
      <circle cx="512" cy="350" r="32" fill="#FFFFFF" filter="url(#${uid}_glow)"/>
      <circle cx="512" cy="650" r="32" fill="#FFFFFF" filter="url(#${uid}_glow)"/>
      <!-- Embedded Terminal Prompt in Center Loop -->
      <path d="M470 480L512 512L470 544" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
      <path d="M530 544H560" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
    `
  });

  // 19 · Ultrawide 21:9 Golden Split
  add({
    id: "ultrawide",
    n: 19,
    group: "concept",
    name: "Ultrawide 21:9",
    tagline: "An ultrawide 21:9 display silhouette with a golden-ratio workspace division",
    concept: "Stripped down to the quintessential dream desk setup: an ultrawide 21:9 monitor floating in the dark. The screen glows with a golden-ratio vertical split (0.618 terminal on left, 0.382 web/files on right), casting an ambient workspace aura onto the desk below.",
    palette: [["Matte Carbon", "#0D0F14"], ["Display Cyan", "#0284C7"], ["Terminal Cyan", "#38BDF8"], ["Desk Light", "rgba(56,189,248,0.18)"]],
    moves: [
      "True 21:9 panoramic monitor silhouette",
      "Golden ratio workspace division for maximal code readability",
      "Ambient desk light glow beneath the monitor chin"
    ],
    facts: { Metaphor: "Pro Ultrawide", Proportion: "21:9 Aspect Ratio", Split: "Golden Ratio" },
    draw: ({ uid }) => `
      <defs>
        <radialGradient id="${uid}_desk" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#0D0F14" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="#0D0F14"/>
      <!-- Ambient Desk Light Reflection -->
      <ellipse cx="512" cy="740" rx="420" ry="120" fill="url(#${uid}_desk)"/>
      <!-- Ultrawide Monitor Chassis -->
      <rect x="80" y="270" width="864" height="420" rx="36" fill="#181B22" stroke="#333A48" stroke-width="16"/>
      <!-- Ultrawide Display Glass Surface -->
      <rect x="104" y="294" width="816" height="372" rx="24" fill="#07090E"/>
      <!-- Golden Ratio Split Line (approx 62% at x=610) -->
      <line x1="610" y1="294" x2="610" y2="666" stroke="#0284C7" stroke-width="12"/>
      <!-- Horizontal Sub-split on right side -->
      <line x1="610" y1="480" x2="920" y2="480" stroke="#0284C7" stroke-width="12"/>
      <!-- Large Terminal Prompt in Left Golden Pane -->
      <path d="M220 440L280 480L220 520" stroke="#38BDF8" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M310 520H400" stroke="#38BDF8" stroke-width="32" stroke-linecap="round"/>
      <!-- Web and Files Pills in Right Panes -->
      <rect x="660" y="360" width="180" height="36" rx="18" fill="#10B981"/>
      <rect x="660" y="550" width="160" height="36" rx="18" fill="#F59E0B"/>
      <!-- Minimalist Monitor Stand -->
      <rect x="472" y="690" width="80" height="80" fill="#262C38"/>
      <rect x="392" y="760" width="240" height="20" rx="10" fill="#333A48"/>
    `
  });

  // 20 · Silicon Microchip Core
  add({
    id: "chip",
    n: 20,
    group: "concept",
    name: "Silicon Core",
    tagline: "A precision silicon chip die whose bus traces branch into 3 dedicated system channels",
    concept: "Highlights Tether's high-performance native core (Swift/UIKit on iOS, Kotlin on Android, Rust binary split engine). An integrated circuit die whose gold pin leads and copper PCB bus traces feed into 3 dedicated system channels: Web, SSH, and Files.",
    palette: [["Silicon Dark", "#080A0E"], ["Gold Lead", "#EAB308"], ["Bus Copper", "#F97316"], ["Die Cyan", "#38BDF8"]],
    moves: [
      "Surface-mount microchip package with 12 gold pin leads",
      "PCB trace lines routing directly into the 3 core tools",
      "Celebrates native performance and zero electron/web bloat"
    ],
    facts: { Metaphor: "Integrated Circuit", Vibe: "Deep Tech", Craft: "Silicon & Copper" },
    draw: () => `
      <rect width="1024" height="1024" fill="#080A0E"/>
      <!-- Copper PCB Traces in Background -->
      <path d="M200 160V300H320 M824 160V300H704 M200 864V724H320 M824 864V724H704" stroke="#F97316" stroke-width="12" fill="none" opacity="0.4"/>
      <!-- Gold Chip Pins (Top & Bottom) -->
      ${[280, 400, 520, 640, 740].map((x) => `
        <rect x="${x - 20}" y="170" width="40" height="70" rx="8" fill="#EAB308"/>
        <rect x="${x - 20}" y="784" width="40" height="70" rx="8" fill="#EAB308"/>
      `).join("")}
      <!-- Chip Package Body -->
      <rect x="220" y="220" width="584" height="584" rx="72" fill="#141923" stroke="#334155" stroke-width="16"/>
      <!-- Center Silicon Die (Illuminated 3-Pane Split) -->
      <rect x="300" y="300" width="424" height="424" rx="44" fill="#030712" stroke="#38BDF8" stroke-width="14"/>
      <!-- Dividers on Silicon Die -->
      <line x1="512" y1="300" x2="512" y2="724" stroke="#38BDF8" stroke-width="12"/>
      <line x1="512" y1="512" x2="724" y2="512" stroke="#38BDF8" stroke-width="12"/>
      <!-- Die Terminal Prompt -->
      <path d="M360 480L400 512L360 544" stroke="#38BDF8" stroke-width="24" stroke-linecap="round"/>
      <path d="M420 544H460" stroke="#38BDF8" stroke-width="24" stroke-linecap="round"/>
      <!-- Die Indicators -->
      <circle cx="618" cy="406" r="28" fill="#10B981"/>
      <circle cx="618" cy="618" r="28" fill="#F59E0B"/>
    `
  });

  // ══════════════════════════════════════════════════════════════════
  // ROUND 2 · NORD FUSION CONCEPTS & EVOLUTIONS (21–28)
  // ══════════════════════════════════════════════════════════════════

  // 21 · Nord Cable Loop
  add({
    id: "nord-cable",
    n: 21,
    group: "concept",
    round: 2,
    name: "Nord Cable Loop",
    tagline: "Continuous braided USB-C tether looping into an unbroken 'T' in matte Nord frost slate",
    concept: "Applies the winning 02 Nord Frost aesthetic to the continuous hardware tether metaphor. Arctic Polar Night background (#2E3440) hosting an unbroken, heavy braided cable loop forming the letter 'T'. The inner fiber core glows with icy Polar Ice cyan (#88C0D0), flanked by frosted aluminum connector collars.",
    palette: [["Nord Night", "#2E3440"], ["Polar Ice", "#88C0D0"], ["Frost Blue", "#81A1C1"], ["Snow Storm", "#ECEFF4"], ["Aurora Teal", "#8FBCBB"]],
    moves: [
      "Unbroken continuous loop forming an iconic monogram 'T'",
      "Authentic Arctic Nord palette with glowing Polar Ice inner fiber core",
      "Frosted aluminum USB-C connector collars on the horizontal crossbar",
      "Zero eye fatigue, exceptionally readable from 1024px down to 16px"
    ],
    facts: { Aesthetic: "Nord Frost", Metaphor: "USB-C Tether", Readability: "Superb 16-1024px" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_nc_glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#88C0D0"/>
          <stop offset="50%" stop-color="#81A1C1"/>
          <stop offset="100%" stop-color="#8FBCBB"/>
        </linearGradient>
        <filter id="${uid}_nc_sh" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- Soft Arctic Ambient Radial Bloom -->
      <circle cx="512" cy="480" r="340" fill="#88C0D0" opacity="0.08" filter="url(#${uid}_nc_sh)"/>
      <!-- Outer Braided Slate Cable forming 'T' -->
      <path d="M220 320 H804 M512 320 V760" stroke="#3B4252" stroke-width="120" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M220 320 H804 M512 320 V760" stroke="#4C566A" stroke-width="84" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Glowing Inner Polar Ice Core -->
      <path d="M220 320 H804 M512 320 V760" stroke="url(#${uid}_nc_glow)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" filter="url(#${uid}_nc_sh)"/>
      <!-- Frosted Aluminum Connector Collars -->
      <rect x="140" y="276" width="92" height="88" rx="20" fill="#D8DEE9" stroke="#ECEFF4" stroke-width="8"/>
      <rect x="792" y="276" width="92" height="88" rx="20" fill="#D8DEE9" stroke="#ECEFF4" stroke-width="8"/>
      <rect x="468" y="736" width="88" height="92" rx="20" fill="#D8DEE9" stroke="#ECEFF4" stroke-width="8"/>
      <!-- Center Interlock Knot Jewel -->
      <circle cx="512" cy="320" r="46" fill="#88C0D0" stroke="#ECEFF4" stroke-width="8" filter="url(#${uid}_nc_sh)"/>
    `
  });

  // 22 · Nord Docking Horizon
  add({
    id: "nord-docking",
    n: 22,
    group: "concept",
    round: 2,
    name: "Nord Docking Horizon",
    tagline: "Nord ultrawide display silhouette linked by a glowing tether beam to a docked phone",
    concept: "Translates the dual-horizon device docking story into Nord minimalism. A floating 21:9 ultrawide desktop monitor silhouette in deep Polar Night slate (#2E3440 / #3B4252) with illuminated terminal (>_) and web split cards, connected via a luminous Polar Ice data beam to a docked smartphone below.",
    palette: [["Nord Dark", "#242933"], ["Nord Night", "#2E3440"], ["Polar Ice", "#88C0D0"], ["Aurora Green", "#A3BE8C"], ["Frost Slate", "#4C566A"]],
    moves: [
      "Ultrawide monitor upper silhouette with clean 3-pane split",
      "Compact docked phone silhouette at bottom center",
      "Vertical glowing data beam connecting phone port to monitor input",
      "Tells the exact story of Tether: your phone powering an external desktop"
    ],
    facts: { Aesthetic: "Nord Frost", Narrative: "Phone → Monitor", Metaphor: "Dual Horizon" },
    draw: ({ uid }) => `
      <defs>
        <linearGradient id="${uid}_nd_beam" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#EBCB8B"/>
          <stop offset="50%" stop-color="#88C0D0"/>
          <stop offset="100%" stop-color="#81A1C1"/>
        </linearGradient>
        <filter id="${uid}_nd_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#242933"/>
      <!-- Upper Ultrawide Monitor (21:9 ratio) -->
      <rect x="90" y="160" width="844" height="450" rx="48" fill="#2E3440" stroke="#4C566A" stroke-width="14"/>
      <!-- Monitor Screen Area -->
      <rect x="120" y="190" width="784" height="390" rx="30" fill="#3B4252"/>
      <!-- 3-Pane Split on Monitor -->
      <line x1="472" y1="190" x2="472" y2="580" stroke="#4C566A" stroke-width="8"/>
      <line x1="472" y1="385" x2="904" y2="385" stroke="#4C566A" stroke-width="8"/>
      <!-- Left Terminal Pane -->
      <path d="M190 320L250 385L190 450" stroke="#88C0D0" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M280 450H370" stroke="#81A1C1" stroke-width="32" stroke-linecap="round"/>
      <!-- Top Right Web Pane -->
      <rect x="520" y="240" width="280" height="44" rx="22" fill="#A3BE8C"/>
      <rect x="520" y="310" width="180" height="28" rx="14" fill="#D8DEE9" opacity="0.6"/>
      <!-- Bottom Right Files Pane -->
      <rect x="520" y="430" width="260" height="44" rx="22" fill="#EBCB8B"/>
      <rect x="520" y="500" width="160" height="28" rx="14" fill="#D8DEE9" opacity="0.6"/>
      <!-- Monitor Stand & Base -->
      <rect x="488" y="610" width="48" height="80" rx="8" fill="#4C566A"/>
      <rect x="420" y="680" width="184" height="18" rx="9" fill="#4C566A"/>
      <!-- Docked Smartphone (Bottom Center) -->
      <rect x="444" y="740" width="136" height="220" rx="28" fill="#2E3440" stroke="#88C0D0" stroke-width="8"/>
      <rect x="464" y="760" width="96" height="170" rx="16" fill="#3B4252"/>
      <circle cx="512" cy="775" r="5" fill="#88C0D0"/>
      <!-- Glowing Tether Data Beam -->
      <line x1="512" y1="740" x2="512" y2="690" stroke="url(#${uid}_nd_beam)" stroke-width="18" stroke-linecap="round" filter="url(#${uid}_nd_glow)"/>
    `
  });

  // 23 · Nord T-Matrix
  add({
    id: "nord-tmatrix",
    n: 23,
    group: "concept",
    round: 2,
    name: "Nord T-Matrix",
    tagline: "The letter 'T' forged directly out of 3 floating Nord Frost matte split-pane cards",
    concept: "Unifies the 3-pane workspace architecture with typographic brand identity in pure Nord Frost materials. Three floating matte rounded rectangular cards (#3B4252) form the horizontal crossbar and vertical stem of the letter 'T'. Contains an icy cyan terminal prompt on the left and aurora green/gold pill indicators on the right.",
    palette: [["Polar Night", "#2E3440"], ["Card Slate", "#3B4252"], ["Polar Ice", "#88C0D0"], ["Aurora Green", "#A3BE8C"], ["Snow White", "#ECEFF4"]],
    moves: [
      "Workspace panes arranged in negative space to form an unmistakable 'T'",
      "36px rounded matte floating cards with soft edge contrast",
      "High-luma Polar Ice terminal prompt (>_) with Aurora Green tab pill",
      "Instantly recognizable as both an app icon and an architectural layout"
    ],
    facts: { Aesthetic: "Nord Frost", Typographic: "Letter T", Metaphor: "Pane Matrix" },
    draw: () => `
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- T Crossbar: Left Upper Card -->
      <rect x="130" y="170" width="360" height="220" rx="44" fill="#3B4252" stroke="#4C566A" stroke-width="12"/>
      <!-- Terminal Prompt in Left Arm -->
      <path d="M220 250L266 285L220 320" stroke="#88C0D0" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M290 320H360" stroke="#81A1C1" stroke-width="30" stroke-linecap="round"/>
      <!-- T Crossbar: Right Upper Card -->
      <rect x="534" y="170" width="360" height="220" rx="44" fill="#3B4252" stroke="#4C566A" stroke-width="12"/>
      <!-- Web Aurora Pill in Right Arm -->
      <rect x="590" y="240" width="220" height="42" rx="21" fill="#A3BE8C"/>
      <rect x="590" y="306" width="140" height="26" rx="13" fill="#D8DEE9" opacity="0.6"/>
      <!-- T Vertical Stem: Center Tall Card -->
      <rect x="340" y="430" width="344" height="440" rx="48" fill="#3B4252" stroke="#4C566A" stroke-width="12"/>
      <!-- Files Gold & Polar Ice indicators inside stem -->
      <rect x="400" y="500" width="224" height="44" rx="22" fill="#EBCB8B"/>
      <rect x="400" y="570" width="150" height="28" rx="14" fill="#D8DEE9" opacity="0.6"/>
      <rect x="400" y="660" width="224" height="44" rx="22" fill="#88C0D0"/>
      <rect x="400" y="730" width="130" height="28" rx="14" fill="#D8DEE9" opacity="0.6"/>
      <!-- Central Linking Anchor Dot -->
      <circle cx="512" cy="400" r="18" fill="#88C0D0"/>
    `
  });

  // 24 · Nord USB-C Portal
  add({
    id: "nord-usbc",
    n: 24,
    group: "concept",
    round: 2,
    name: "Nord USB-C Portal",
    tagline: "Precision USB-C connector pill framing a tranquil 3-pane Nord desktop portal",
    concept: "Takes the universal USB-C hardware aperture and finishes it in bead-blasted Scandinavian aluminum. Inside the precision pill-shaped connector cutout sits a tranquil, glowing Nord Frost desktop window with terminal prompt and tiling splits.",
    palette: [["Nord Night", "#2E3440"], ["Bezel Slate", "#434C5E"], ["Polar Ice", "#88C0D0"], ["Arctic Silver", "#D8DEE9"], ["Aurora Teal", "#8FBCBB"]],
    moves: [
      "Symmetrical USB-C connector pill outer bezel with chamfered inner lip",
      "Framed portal revealing a floating 3-pane tiling split",
      "Celebrates USB-C single-cable plug-and-play desktop docking",
      "High contrast icon silhouette on any wallpaper"
    ],
    facts: { Aesthetic: "Nord Frost", Hardware: "USB-C Port", Metaphor: "Portal" },
    draw: ({ uid }) => `
      <defs>
        <filter id="${uid}_nu_sh" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- Outer Anodized Aluminum USB-C Connector Bezel -->
      <rect x="110" y="240" width="804" height="544" rx="240" fill="#3B4252" stroke="#4C566A" stroke-width="24"/>
      <rect x="134" y="264" width="756" height="496" rx="216" fill="#2E3440" stroke="#88C0D0" stroke-width="8" opacity="0.8"/>
      <!-- Inner USB-C Center Tongue / Desktop Window -->
      <rect x="220" y="330" width="584" height="364" rx="60" fill="#242933" stroke="#4C566A" stroke-width="12"/>
      <!-- Split Panes Inside Tongue -->
      <line x1="490" y1="330" x2="490" y2="694" stroke="#4C566A" stroke-width="8"/>
      <line x1="490" y1="512" x2="804" y2="512" stroke="#4C566A" stroke-width="8"/>
      <!-- Left Terminal Prompt -->
      <path d="M290 470L340 512L290 554" stroke="#88C0D0" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M366 554H430" stroke="#81A1C1" stroke-width="28" stroke-linecap="round"/>
      <!-- Web & File Indicators in Right Splits -->
      <rect x="540" y="400" width="200" height="34" rx="17" fill="#A3BE8C"/>
      <rect x="540" y="580" width="180" height="34" rx="17" fill="#EBCB8B"/>
      <!-- Gold USB-C Pins on Top & Bottom Inner Edges -->
      ${[320, 420, 520, 620, 700].map((x) => `
        <rect x="${x - 14}" y="300" width="28" height="18" rx="4" fill="#EBCB8B"/>
        <rect x="${x - 14}" y="706" width="28" height="18" rx="4" fill="#EBCB8B"/>
      `).join("")}
    `
  });

  // 25 · Nord Geometric Anchor
  add({
    id: "nord-anchor",
    n: 25,
    group: "concept",
    round: 2,
    name: "Nord Geometric Anchor",
    tagline: "Nautical anchor geometry merged with a 3-pane split grid in matte Arctic Frost",
    concept: "Reinterprets the 'tether / mooring' metaphor through minimalist Scandinavian geometry. An anchor stock and shank constructed from clean architectural bars that seamlessly interlock with a 3-way workspace split, rendered in serene Polar Night and Frost Blue.",
    palette: [["Nord Night", "#2E3440"], ["Anchor Slate", "#4C566A"], ["Polar Ice", "#88C0D0"], ["Aurora Gold", "#EBCB8B"], ["Snow Storm", "#ECEFF4"]],
    moves: [
      "Modern geometric anchor icon representing stable external connection",
      "Cross-brace forms the split-pane dividing line",
      "Flukes curve upward to cradle the terminal and web tools",
      "Distinctive, memorable silhouette with nautical stability"
    ],
    facts: { Aesthetic: "Nord Frost", Metaphor: "Nautical Anchor", Craft: "Geometric Minimal" },
    draw: () => `
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- Top Eyelet Ring -->
      <circle cx="512" cy="230" r="90" fill="none" stroke="#88C0D0" stroke-width="36"/>
      <circle cx="512" cy="230" r="45" fill="#3B4252"/>
      <!-- Horizontal Anchor Stock / Crossbar (forms top pane line) -->
      <rect x="180" y="360" width="664" height="52" rx="26" fill="#4C566A"/>
      <circle cx="210" cy="386" r="30" fill="#EBCB8B"/>
      <circle cx="814" cy="386" r="30" fill="#EBCB8B"/>
      <!-- Vertical Anchor Shank -->
      <rect x="484" y="320" width="56" height="460" rx="24" fill="#4C566A"/>
      <!-- Bottom Fluke Crescent Sweep -->
      <path d="M220 620 Q512 880 804 620" fill="none" stroke="#4C566A" stroke-width="56" stroke-linecap="round"/>
      <polygon points="220,590 170,660 260,660" fill="#88C0D0"/>
      <polygon points="804,590 764,660 854,660" fill="#88C0D0"/>
      <!-- Terminal Prompt in Left Quadrant -->
      <path d="M290 480L340 520L290 560" stroke="#88C0D0" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M366 560H430" stroke="#81A1C1" stroke-width="32" stroke-linecap="round"/>
      <!-- Web Aurora Pill in Right Quadrant -->
      <rect x="580" y="480" width="180" height="38" rx="19" fill="#A3BE8C"/>
      <rect x="580" y="540" width="120" height="24" rx="12" fill="#D8DEE9" opacity="0.6"/>
    `
  });

  // 26 · Nord Frost Evolution
  add({
    id: "nord-evo",
    n: 26,
    group: "style",
    round: 2,
    name: "Nord Frost Evolution",
    tagline: "Direct optical refinement of Candidate 02 with borderless floating cards and enhanced contrast",
    concept: "A direct perfection pass on the winning Candidate 02 Nord Frost based on user feedback. Removes extraneous outer borders in favor of soft ambient occlusion shadows, boosts the Polar Ice prompt's visual weight for crisp readability down to 16px, and fine-tunes the corner curvature to Apple's continuous squircle math.",
    palette: [["Nord Night", "#2E3440"], ["Matte Card", "#3B4252"], ["Polar Ice", "#88C0D0"], ["Aurora Green", "#A3BE8C"], ["Aurora Yellow", "#EBCB8B"], ["Snow", "#ECEFF4"]],
    moves: [
      "Borderless floating matte cards with elevated ambient depth",
      "Optical weight of terminal prompt (>_) increased by 20% for tiny sizes",
      "Refined title bar pill with illuminated Polar Ice live status dot",
      "The purest, most polished distillation of the winning 02 Nord Frost design"
    ],
    facts: { Aesthetic: "Nord Frost", Type: "Refined Winner", Readability: "Crisp down to 16px" },
    draw: ({ uid }) => `
      <defs>
        <filter id="${uid}_ne_drop" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.38"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- Window Base Frame -->
      <rect x="90" y="120" width="844" height="784" rx="100" fill="#3B4252" filter="url(#${uid}_ne_drop)"/>
      <!-- Title Bar Header Pill -->
      <rect x="136" y="166" width="310" height="74" rx="26" fill="#434C5E"/>
      <circle cx="180" cy="203" r="18" fill="#88C0D0"/>
      <rect x="222" y="193" width="160" height="20" rx="10" fill="#ECEFF4"/>
      <!-- Left Pane: Floating Terminal Card -->
      <rect x="136" y="272" width="354" height="588" rx="46" fill="#2E3440" filter="url(#${uid}_ne_drop)"/>
      <path d="M224 446L302 524L224 602" stroke="#88C0D0" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M334 602H424" stroke="#81A1C1" stroke-width="38" stroke-linecap="round"/>
      <!-- Top Right Pane: Floating Web Card -->
      <rect x="526" y="272" width="362" height="278" rx="46" fill="#2E3440" filter="url(#${uid}_ne_drop)"/>
      <rect x="580" y="348" width="240" height="48" rx="24" fill="#A3BE8C"/>
      <rect x="580" y="426" width="170" height="32" rx="16" fill="#D8DEE9" opacity="0.75"/>
      <!-- Bottom Right Pane: Floating Files Card -->
      <rect x="526" y="582" width="362" height="278" rx="46" fill="#2E3440" filter="url(#${uid}_ne_drop)"/>
      <rect x="580" y="658" width="220" height="48" rx="24" fill="#EBCB8B"/>
      <rect x="580" y="736" width="150" height="32" rx="16" fill="#D8DEE9" opacity="0.75"/>
    `
  });

  // 27 · Nord Command Helix
  add({
    id: "nord-helix",
    n: 27,
    group: "concept",
    round: 2,
    name: "Nord Command Helix",
    tagline: "Twin fiber-optic strands in Polar Ice and Aurora Green intertwining into a double-helix link",
    concept: "The command helix metaphor executed in authentic Arctic tones. Two continuous ribbons—one in icy Polar Blue representing the monitor display and one in Aurora Green representing the phone controller—intertwine into a rhythmic double helix on dark Nord slate.",
    palette: [["Nord Dark", "#242933"], ["Polar Ice", "#88C0D0"], ["Aurora Green", "#A3BE8C"], ["Frost Blue", "#81A1C1"], ["Snow", "#E5E9F0"]],
    moves: [
      "Dynamic double-helix weave symbolizing phone and monitor paired in unison",
      "Nodes along the strands represent terminal keystrokes and touch events",
      "Continuous organic flow contrasting with rigid tiling rectangles",
      "Striking abstract brand mark"
    ],
    facts: { Aesthetic: "Nord Frost", Metaphor: "DNA / Fiber Helix", Motion: "Continuous Link" },
    draw: ({ uid }) => `
      <defs>
        <filter id="${uid}_nh_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#242933"/>
      <!-- Soft Center Ambient Core Glow -->
      <ellipse cx="512" cy="512" rx="240" ry="380" fill="#88C0D0" opacity="0.07" filter="url(#${uid}_nh_glow)"/>
      <!-- Helix Rungs (Horizontal Data Bridges) -->
      ${[280, 420, 560, 700].map((y, i) => `
        <line x1="320" y1="${y}" x2="704" y2="${y}" stroke="${i % 2 === 0 ? "#81A1C1" : "#EBCB8B"}" stroke-width="18" stroke-dasharray="16 16" opacity="0.8"/>
      `).join("")}
      <!-- Strand 1 (Polar Ice Cyan) -->
      <path d="M340 180 Q680 340 512 512 T680 844" fill="none" stroke="#88C0D0" stroke-width="48" stroke-linecap="round" filter="url(#${uid}_nh_glow)"/>
      <!-- Strand 2 (Aurora Green) -->
      <path d="M680 180 Q340 340 512 512 T340 844" fill="none" stroke="#A3BE8C" stroke-width="48" stroke-linecap="round" filter="url(#${uid}_nh_glow)"/>
      <!-- Terminal & Touch Node Jewels -->
      <circle cx="512" cy="512" r="32" fill="#ECEFF4" stroke="#88C0D0" stroke-width="8"/>
      <circle cx="340" cy="180" r="28" fill="#88C0D0"/>
      <circle cx="680" cy="180" r="28" fill="#A3BE8C"/>
      <circle cx="680" cy="844" r="28" fill="#88C0D0"/>
      <circle cx="340" cy="844" r="28" fill="#A3BE8C"/>
    `
  });

  // 28 · Nord Tri-Beam Trident
  add({
    id: "nord-trident",
    n: 28,
    group: "concept",
    round: 2,
    name: "Nord Tri-Beam Trident",
    tagline: "Three radiant geometric beams branching from a central anchor hub: Web, SSH, and Files",
    concept: "The tri-beam trident metaphor refined into clean Scandinavian graphic design. Three faceted beams emerge from a single USB-C anchor hub, each carrying the signature color of Tether's core trinity: Polar Ice for Terminal, Aurora Green for Web, and Frost Gold for Files.",
    palette: [["Nord Night", "#2E3440"], ["Terminal Ice", "#88C0D0"], ["Web Aurora", "#A3BE8C"], ["Files Gold", "#EBCB8B"], ["Hub Slate", "#434C5E"]],
    moves: [
      "Monolithic central tether hub branching into 3 dedicated tool beams",
      "Angular geometric facets with soft Nord edge lighting",
      "Clean tri-color coding matching the 3-pane desktop environment",
      "Bold, authoritative icon presence"
    ],
    facts: { Aesthetic: "Nord Frost", Trinity: "Web · SSH · Files", Metaphor: "Tri-Beam" },
    draw: () => `
      <rect width="1024" height="1024" fill="#2E3440"/>
      <!-- Central Base Anchor Block (USB-C Collar) -->
      <rect x="372" y="720" width="280" height="150" rx="36" fill="#3B4252" stroke="#4C566A" stroke-width="14"/>
      <rect x="424" y="800" width="176" height="34" rx="17" fill="#88C0D0"/>
      <!-- Left Beam: Terminal (Polar Ice) -->
      <path d="M430 720 L300 320" stroke="#88C0D0" stroke-width="48" stroke-linecap="round"/>
      <rect x="230" y="220" width="140" height="140" rx="36" fill="#3B4252" stroke="#88C0D0" stroke-width="12"/>
      <path d="M276 270L308 290L276 310" stroke="#88C0D0" stroke-width="22" stroke-linecap="round"/>
      <!-- Center Beam: Web (Aurora Green) -->
      <path d="M512 720 L512 280" stroke="#A3BE8C" stroke-width="56" stroke-linecap="round"/>
      <circle cx="512" cy="220" r="80" fill="#3B4252" stroke="#A3BE8C" stroke-width="14"/>
      <circle cx="512" cy="220" r="42" fill="#A3BE8C"/>
      <!-- Right Beam: Files (Aurora Gold) -->
      <path d="M594 720 L724 320" stroke="#EBCB8B" stroke-width="48" stroke-linecap="round"/>
      <rect x="654" y="220" width="140" height="140" rx="36" fill="#3B4252" stroke="#EBCB8B" stroke-width="12"/>
      <rect x="688" y="260" width="72" height="60" rx="12" fill="#EBCB8B"/>
    `
  });

  // ══════════════════════════════════════════════════════════════════
  // REVIEW CONFIGURATION
  // ══════════════════════════════════════════════════════════════════
  window.REVIEW = {
    key: "2026-10-27-tether-logo-redesign-v1",
    dir: "reports/archive/2026-10-27-tether-logo-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8817,
    project: "projects/tether",
    context: [
      "projects/tether/CLAUDE.md",
      "projects/tether/docs/public/icon.svg",
      "projects/tether/apps/ios/App/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json"
    ],
    brief: "Redesign the Tether logo: 20 candidates in total, with 10 style variations of the current 3-pane terminal/web/files logo, and 10 fresh conceptual directions exploring external display tethering, USB-C docking, tiling geometry, cable knots, and command links.",
    title: "Tether · Logo Redesign",
    subtitle: "Round 2: 28 candidates across 2 groups · Winner picked for Part 1 (02 Nord Frost), 8 new Nord conceptual fusions in Round 2",
    heading: "Pick a direction for Tether's logo & app icon (Round 2)",
    intro: "Round 2 update: <b>02 Nord Frost</b> was chosen as the winner for Part 1! For Part 2, 8 new candidates (21–28) fuse the winning Nord Frost aesthetic with the top conceptual metaphors: USB-C cable loops, mobile docking, T-matrix, anchor, and command helix. Pick a winner for Part 2 to complete the review.",
    legend: ["<b>28</b> candidates", "<b>Part 1: 02 Nord Frost 🏆</b>", "<b>8</b> new in Round 2", "<b>Part 2</b> deciding"],
    round: 2,
    frame: "icon",
    size: [400, 400],
    groups: [
      {
        id: "style",
        name: "Part 1 · Style Variations of Current 3-Pane Logo (01–10)",
        note: "Winner chosen: 02 Nord Frost 🏆 · Refined in Candidate 26 (Nord Frost Evolution)"
      },
      {
        id: "concept",
        name: "Part 2 · Fresh Conceptual Directions (11–28)",
        note: "Exploring conceptual metaphors: USB-C, docking, T-matrix, anchor, and new Round 2 Nord fusions"
      }
    ],
    candidates: C
  };
})();
