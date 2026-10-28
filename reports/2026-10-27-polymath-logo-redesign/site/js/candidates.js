// Polymath Logo & App Icon Redesign Candidates
// 50 Candidates across 5 Thematic Groups + Baseline (Candidate 00):
// Part 1 (01-10): Geometric Polyhedra & Prisms (Da Vinci crystals, prisms, tesseracts)
// Part 2 (11-20): Architectural & Bauhaus 'P' Monograms (Möbius loops, prompt chevrons, golden spirals)
// Part 3 (21-30): Agent & Renaissance Synergy (Astrolabes, neural codices, Vitruvian networks)
// Part 4 (31-40): Hardware, Memory & Runtime Visualizers (Roofline plots, silicon dies, cache matrices)
// Part 5 (41-50): Modern Minimalist & Radiant Systems (Orbital lenses, ruled saddles, aurora badges)

(() => {
  const K = KIT;
  const C = [];
  const add = (c) => C.push(K.attachViews(c));

  add({
    id: "baseline",
    n: 0,
    group: "polyhedra",
    baseline: true,
    name: "Current Placeholder",
    tagline: "Solid cyan rounded square with centered white plus icon",
    concept: "The existing temporary placeholder icon found in public/favicon.svg and docs: an electric cyan (#06B6D4) rounded tile with a centered white plus cross. Highly visible and clean, but generic and lacks any connection to agents, polymathy, or interactive learning.",
    palette: [["Cyan Base","#06B6D4"],["White Cross","#FFFFFF"],["Dark Slate","#0F172A"]],
    moves: [
      "Faithful 1:1 vector recreation of production docs/public/favicon.svg",
      "Single-tone flat cyan rounded squircle",
      "Simple centered 3px white plus cross",
      "Serves as the baseline control for comparison"
],
    facts: {"Type":"Flat Glyph","Contrast":"High","Readability":"Instant","Metaphor":"Generic Plus / Addition"},
    draw: ({ mode }) => `
    <rect width="1024" height="1024" rx="256" fill="#06B6D4"/>
    <path d="M320 512H704M512 320V704" stroke="#FFFFFF" stroke-width="96" stroke-linecap="round"/>
  `
  });

  add({
    id: "c01_da_vinci_solid",
    n: 1,
    group: "polyhedra",
    name: "Da Vinci Icosahedron",
    tagline: "Golden ratio 20-faced crystal with luminous multifaceted facets",
    concept: "Directly inspired by Leonardo da Vinci's illustrations for Luca Pacioli's 1509 treatise 'De Divina Proportione'. An icosahedron rendered in translucent cyan and amethyst facets on deep obsidian. Represents the renaissance polymath synthesizing diverse fields into geometric harmony.",
    palette: [["Obsidian Base","#0A0F1D"],["Electric Cyan","#06B6D4"],["Amethyst Violet","#8B5CF6"],["Sky Glow","#38BDF8"]],
    moves: [
      "Da Vinci 20-sided planar projection with golden ratio vertex coords",
      "Gradient-filled translucent faces with specular edges",
      "Luminous central triangle radiating core insight",
      "Crisp high-contrast geometry visible at 16px"
],
    facts: {"Type":"Platonic Solid","Contrast":"Very High","Readability":"Crisp","Metaphor":"Renaissance Geometry"},
    draw: ({ mode, uid }) => `
    <defs>
      <linearGradient id="${uid}_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0A0F1D"/>
        <stop offset="100%" stop-color="#030712"/>
      </linearGradient>
      <linearGradient id="${uid}_cyan" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#0891B2" stop-opacity="0.4"/>
      </linearGradient>
      <linearGradient id="${uid}_purp" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#C084FC" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#6B21A8" stop-opacity="0.4"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" rx="224" fill="url(#${uid}_bg)"/>
    <circle cx="512" cy="512" r="380" stroke="#1E293B" stroke-width="8" stroke-dasharray="16 12" fill="none"/>
    <!-- Outer vertices -->
    <polygon points="512,180 780,310 820,620 580,820 280,780 200,480" fill="none" stroke="#06B6D4" stroke-width="12" stroke-opacity="0.3"/>
    <!-- Facets -->
    <polygon points="512,180 680,420 512,512" fill="url(#${uid}_cyan)" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="512,180 512,512 344,420" fill="url(#${uid}_purp)" stroke="#C084FC" stroke-width="8"/>
    <polygon points="680,420 780,310 760,580" fill="url(#${uid}_cyan)" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="680,420 760,580 512,512" fill="url(#${uid}_purp)" stroke="#C084FC" stroke-width="8"/>
    <polygon points="512,512 760,580 620,780" fill="url(#${uid}_cyan)" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="512,512 620,780 404,780" fill="url(#${uid}_cyan)" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="512,512 404,780 264,580" fill="url(#${uid}_purp)" stroke="#C084FC" stroke-width="8"/>
    <polygon points="344,420 512,512 264,580" fill="url(#${uid}_cyan)" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="344,420 264,580 244,310" fill="url(#${uid}_purp)" stroke="#C084FC" stroke-width="8"/>
    <polygon points="512,180 344,420 244,310" fill="url(#${uid}_cyan)" stroke="#38BDF8" stroke-width="8"/>
    <!-- Central Jewel -->
    <polygon points="512,380 610,540 414,540" fill="#FFFFFF" fill-opacity="0.25" stroke="#FFFFFF" stroke-width="12"/>
    <circle cx="512" cy="180" r="14" fill="#38BDF8"/>
    <circle cx="680" cy="420" r="14" fill="#38BDF8"/>
    <circle cx="344" cy="420" r="14" fill="#C084FC"/>
    <circle cx="512" cy="512" r="18" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c02_dispersion_prism",
    n: 2,
    group: "polyhedra",
    name: "Dispersion Prism",
    tagline: "Equilateral optical prism splitting incident ray into knowledge spectrum",
    concept: "Newton's prism metaphor for Polymath: taking unified raw inquiry and refracting it into distinct disciplines (code, hardware, neural, math). A dark frosted glass prism intercepts an intense white laser beam, dispersing it into vibrant spectral cyan, violet, and gold rays.",
    palette: [["Obsidian Core","#090D16"],["Laser White","#FFFFFF"],["Cyan Ray","#06B6D4"],["Violet Ray","#8B5CF6"],["Solar Ray","#F59E0B"]],
    moves: [
      "Precision equilateral glass triangle with double stroke border",
      "Sharp incident beam entering at classic 42-degree refraction angle",
      "Three divergent colored light fans leaving the right facet",
      "Subtle internal spectral caustic gradients inside the glass"
],
    facts: {"Type":"Optical Prism","Contrast":"Maximum","Readability":"Iconic","Metaphor":"Knowledge Dispersion"},
    draw: ({ mode, uid }) => `
    <defs>
      <linearGradient id="${uid}_prism" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1E293B" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#0F172A" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" rx="224" fill="#090D16"/>
    <!-- Incident beam -->
    <path d="M120 720 L440 520" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
    <path d="M120 720 L440 520" stroke="#38BDF8" stroke-width="48" stroke-opacity="0.3" filter="blur(6px)"/>
    <!-- Dispersed rays -->
    <path d="M570 510 L920 320" stroke="#06B6D4" stroke-width="24" stroke-linecap="round"/>
    <path d="M570 510 L920 320" stroke="#06B6D4" stroke-width="48" stroke-opacity="0.35"/>
    <path d="M575 525 L920 460" stroke="#8B5CF6" stroke-width="24" stroke-linecap="round"/>
    <path d="M575 525 L920 460" stroke="#8B5CF6" stroke-width="48" stroke-opacity="0.35"/>
    <path d="M580 540 L920 600" stroke="#F59E0B" stroke-width="24" stroke-linecap="round"/>
    <path d="M580 540 L920 600" stroke="#F59E0B" stroke-width="48" stroke-opacity="0.35"/>
    <!-- Glass Triangle Prism -->
    <polygon points="512,220 760,680 264,680" fill="url(#${uid}_prism)" stroke="#38BDF8" stroke-width="22" stroke-linejoin="round"/>
    <!-- Specular rim -->
    <line x1="512" y1="220" x2="264" y2="680" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
  `
  });

  add({
    id: "c03_stellated_octahedron",
    n: 3,
    group: "polyhedra",
    name: "Stella Octangula",
    tagline: "Kepler's eight-pointed geometric star of synthesized faculties",
    concept: "The only regular stellation of the octahedron, discovered by Johannes Kepler in 1619. Formed by two interpenetrating tetrahedra. Represents the harmonic union of analytical logic and synthetic creativity, rendered with radiant cyan and deep ultraviolet facets.",
    palette: [["Deep Void","#070B16"],["Stellar Cyan","#00F0FF"],["Ultra Violet","#7C3AED"],["Apex Gold","#FBBF24"]],
    moves: [
      "Perfect 8-pointed star polyhedron isometric projection",
      "Interlocking dual-tetrahedron geometry with depth shading",
      "Gold-capped apex nodes at terminal vertices",
      "Striking silhouette instantly recognizable at favicon scale"
],
    facts: {"Type":"Stellated Polyhedron","Contrast":"Extreme","Readability":"High","Metaphor":"Synthesized Faculties"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#070B16"/>
    <!-- Tetra 1 (Cyan Upward) -->
    <polygon points="512,160 740,550 512,660" fill="#00F0FF" fill-opacity="0.85" stroke="#FFFFFF" stroke-width="6"/>
    <polygon points="512,160 284,550 512,660" fill="#0891B2" stroke="#FFFFFF" stroke-width="6"/>
    <polygon points="512,160 740,550 284,550" fill="#38BDF8" fill-opacity="0.5"/>
    <!-- Tetra 2 (Violet Downward) -->
    <polygon points="512,864 740,474 512,364" fill="#7C3AED" stroke="#FFFFFF" stroke-width="6"/>
    <polygon points="512,864 284,474 512,364" fill="#4C1D95" stroke="#FFFFFF" stroke-width="6"/>
    <!-- Lateral Star Points -->
    <polygon points="840,512 740,474 740,550" fill="#FBBF24" stroke="#FFFFFF" stroke-width="4"/>
    <polygon points="184,512 284,474 284,550" fill="#F59E0B" stroke="#FFFFFF" stroke-width="4"/>
    <!-- Golden Apex Jewels -->
    <circle cx="512" cy="160" r="22" fill="#FBBF24" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="512" cy="864" r="22" fill="#7C3AED" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="840" cy="512" r="18" fill="#00F0FF"/>
    <circle cx="184" cy="512" r="18" fill="#00F0FF"/>
  `
  });

  add({
    id: "c04_penrose_hypercube",
    n: 4,
    group: "polyhedra",
    name: "Penrose Hypercube",
    tagline: "4D tesseract cube suspended in isometric multidimensional space",
    concept: "A 4-dimensional tesseract cube projected into 2D isometric space. An inner cube floats suspended inside an outer wireframe cube, interconnected by eight isometric hyper-struts. Represents Polymath navigating higher-dimensional knowledge and agent architectures.",
    palette: [["Space Slate","#0D1117"],["Hyper Cyan","#38BDF8"],["Core Teal","#0D9488"],["Neon Green","#10B981"]],
    moves: [
      "Orthographic 4D hypercube wireframe with concentric cubes",
      "Glowing neon vertices with optical junction rings",
      "Isometric strut lines linking inner and outer frames",
      "Dark backdrop highlights the intricate matrix lines"
],
    facts: {"Type":"Hypercube / 4D","Contrast":"High","Readability":"Sharp","Metaphor":"Multidimensional Learning"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0D1117"/>
    <!-- Outer Cube -->
    <polygon points="512,180 820,358 820,714 512,892 204,714 204,358" fill="#0F172A" stroke="#38BDF8" stroke-width="18" stroke-linejoin="round"/>
    <line x1="512" y1="180" x2="512" y2="536" stroke="#38BDF8" stroke-width="16"/>
    <line x1="820" y1="358" x2="512" y2="536" stroke="#38BDF8" stroke-width="16"/>
    <line x1="204" y1="358" x2="512" y2="536" stroke="#38BDF8" stroke-width="16"/>
    <!-- Inner Cube -->
    <polygon points="512,358 666,447 666,625 512,714 358,625 358,447" fill="#1E293B" stroke="#10B981" stroke-width="14" stroke-linejoin="round"/>
    <line x1="512" y1="358" x2="512" y2="536" stroke="#10B981" stroke-width="12"/>
    <line x1="666" y1="447" x2="512" y2="536" stroke="#10B981" stroke-width="12"/>
    <line x1="358" y1="447" x2="512" y2="536" stroke="#10B981" stroke-width="12"/>
    <!-- Struts connecting inner and outer -->
    <line x1="512" y1="180" x2="512" y2="358" stroke="#F59E0B" stroke-width="10" stroke-dasharray="12 8"/>
    <line x1="820" y1="358" x2="666" y2="447" stroke="#F59E0B" stroke-width="10" stroke-dasharray="12 8"/>
    <line x1="820" y1="714" x2="666" y2="625" stroke="#F59E0B" stroke-width="10" stroke-dasharray="12 8"/>
    <line x1="512" y1="892" x2="512" y2="714" stroke="#F59E0B" stroke-width="10" stroke-dasharray="12 8"/>
    <line x1="204" y1="714" x2="358" y2="625" stroke="#F59E0B" stroke-width="10" stroke-dasharray="12 8"/>
    <line x1="204" y1="358" x2="358" y2="447" stroke="#F59E0B" stroke-width="10" stroke-dasharray="12 8"/>
  `
  });

  add({
    id: "c05_chiral_dodecahedron",
    n: 5,
    group: "polyhedra",
    name: "Chiral Dodecahedron",
    tagline: "Twelve pentagonal faces rotating with metallic gold & cyan bevels",
    concept: "The regular dodecahedron—Plato's symbol for the cosmos and quintessence. Features interlocking regular pentagons with rotational chirality, blending brushed gold facets with cybernetic teal seams. Represents universal synthesis across arts and sciences.",
    palette: [["Obsidian Dark","#0B0F19"],["Imperial Gold","#F59E0B"],["Champagne","#FDE68A"],["Electric Cyan","#06B6D4"]],
    moves: [
      "3D perspective view of interlocking regular pentagons",
      "Dual-tone gold and cyan facet shading",
      "Central pentagonal star nucleus",
      "Beveled edge chamfers creating a tactile physical presence"
],
    facts: {"Type":"Platonic Dodecahedron","Contrast":"High","Readability":"Bold","Metaphor":"Quintessence"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0F19"/>
    <!-- Outer perimeter decagon -->
    <polygon points="512,170 710,234 836,396 836,628 710,790 512,854 314,790 188,628 188,396 314,234" fill="#111827" stroke="#06B6D4" stroke-width="16"/>
    <!-- Center pentagon -->
    <polygon points="512,340 670,455 610,640 414,640 354,455" fill="#F59E0B" stroke="#FDE68A" stroke-width="18"/>
    <!-- Connecting trapezoidal faces -->
    <polygon points="512,170 710,234 670,455 512,340" fill="#0891B2" fill-opacity="0.8" stroke="#38BDF8" stroke-width="10"/>
    <polygon points="710,234 836,396 670,455" fill="#0E7490" stroke="#38BDF8" stroke-width="10"/>
    <polygon points="836,396 836,628 610,640 670,455" fill="#155E75" stroke="#38BDF8" stroke-width="10"/>
    <polygon points="836,628 710,790 610,640" fill="#D97706" fill-opacity="0.8" stroke="#FDE68A" stroke-width="10"/>
    <polygon points="710,790 512,854 414,640 610,640" fill="#B45309" stroke="#FDE68A" stroke-width="10"/>
    <polygon points="512,854 314,790 414,640" fill="#0891B2" stroke="#38BDF8" stroke-width="10"/>
    <polygon points="314,790 188,628 414,640" fill="#0E7490" stroke="#38BDF8" stroke-width="10"/>
    <polygon points="188,628 188,396 354,455 414,640" fill="#155E75" stroke="#38BDF8" stroke-width="10"/>
    <polygon points="188,396 314,234 354,455" fill="#D97706" stroke="#FDE68A" stroke-width="10"/>
    <polygon points="314,234 512,170 512,340 354,455" fill="#F59E0B" stroke="#FDE68A" stroke-width="10"/>
    <!-- Center star point -->
    <circle cx="512" cy="512" r="28" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c06_faceted_gemstone",
    n: 6,
    group: "polyhedra",
    name: "Brilliant Faceted Gem",
    tagline: "Octagonal brilliant-cut crystal with 16 refractive mirror facets",
    concept: "Precision-cut jewel representing refined polymathic knowledge polished to perfection. Features an octagonal table facet surrounded by star and kite facets with crystalline cyan and sapphire highlights.",
    palette: [["Deep Sapphire","#030712"],["Ice Diamond","#E0F2FE"],["Cyan Gem","#06B6D4"],["Cobalt Shading","#1D4ED8"]],
    moves: [
      "Octagonal crown with classic diamond brilliant geometry",
      "16 symmetrically arranged triangular and kite facets",
      "High-specular white reflection lines",
      "Subtle inner glow simulating diamond dispersion"
],
    facts: {"Type":"Cut Gemstone","Contrast":"Extreme","Readability":"Radiant","Metaphor":"Polished Wisdom"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#030712"/>
    <!-- Octagon outer contour -->
    <polygon points="512,180 740,274 834,512 740,750 512,844 284,750 190,512 284,274" fill="#0F172A" stroke="#38BDF8" stroke-width="16"/>
    <!-- Table facet (inner octagon) -->
    <polygon points="512,330 640,383 693,512 640,641 512,694 384,641 331,512 384,383" fill="#06B6D4" stroke="#FFFFFF" stroke-width="14"/>
    <!-- Star & Kite Facets -->
    <polygon points="512,180 512,330 384,383 284,274" fill="#0284C7" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="512,180 740,274 640,383 512,330" fill="#38BDF8" stroke="#FFFFFF" stroke-width="8"/>
    <polygon points="740,274 834,512 693,512 640,383" fill="#0369A1" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="834,512 740,750 640,641 693,512" fill="#0284C7" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="740,750 512,844 512,694 640,641" fill="#0369A1" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="512,844 284,750 384,641 512,694" fill="#075985" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="284,750 190,512 331,512 384,641" fill="#0369A1" stroke="#38BDF8" stroke-width="8"/>
    <polygon points="190,512 284,274 384,383 331,512" fill="#0284C7" stroke="#38BDF8" stroke-width="8"/>
    <!-- Specular Flash -->
    <polygon points="460,420 540,420 500,480" fill="#FFFFFF" fill-opacity="0.8"/>
  `
  });

  add({
    id: "c07_nested_polyhedra",
    n: 7,
    group: "polyhedra",
    name: "Nested Dual Solids",
    tagline: "Octahedron floating within a transparent isometric wireframe cube",
    concept: "Johannes Kepler's Mysterium Cosmographicum model of nested platonic solids. An emerald octahedron is inscribed inside a cyan wireframe cube, which contains a glowing golden core sphere. Symbolizes progressive, layered mastery of skills and runtimes.",
    palette: [["Deep Navy","#0B132B"],["Cyan Cube","#38BDF8"],["Emerald Octahedron","#10B981"],["Amber Core","#F59E0B"]],
    moves: [
      "Outer cube drawn in 30-degree isometric axonometric wireframe",
      "Inner octahedron rotated 45 degrees to bridge cube face centers",
      "Nested glowing nucleus at the geometric centroid",
      "Dual-line architectural drafting aesthetic"
],
    facts: {"Type":"Nested Solids","Contrast":"High","Readability":"Delicate","Metaphor":"Layered Knowledge"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B132B"/>
    <!-- Outer isometric cube -->
    <polygon points="512,200 800,366 800,698 512,864 224,698 224,366" fill="none" stroke="#38BDF8" stroke-width="14"/>
    <line x1="512" y1="200" x2="512" y2="532" stroke="#38BDF8" stroke-width="14"/>
    <line x1="800" y1="366" x2="512" y2="532" stroke="#38BDF8" stroke-width="14"/>
    <line x1="224" y1="366" x2="512" y2="532" stroke="#38BDF8" stroke-width="14"/>
    <!-- Inner Octahedron (emerald) -->
    <polygon points="512,320 680,532 512,680 344,532" fill="#10B981" fill-opacity="0.25" stroke="#10B981" stroke-width="16"/>
    <line x1="512" y1="320" x2="512" y2="680" stroke="#34D399" stroke-width="12"/>
    <line x1="344" y1="532" x2="680" y2="532" stroke="#34D399" stroke-width="12"/>
    <!-- Internal nucleus sphere -->
    <circle cx="512" cy="532" r="54" fill="#F59E0B" stroke="#FFFFFF" stroke-width="10"/>
    <circle cx="512" cy="532" r="24" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c08_voronoi_crystal",
    n: 8,
    group: "polyhedra",
    name: "Voronoi Crystalline Grid",
    tagline: "Organic crystalline partitioning with radiant nucleus cell",
    concept: "A Voronoi tessellation where cell seeds represent knowledge domains that dynamically expand and interlock. The central cell pulses with brilliant cyan energy, while adjacent cells transition into deep amethyst and indigo.",
    palette: [["Space Slate","#0F172A"],["Luminous Cyan","#06B6D4"],["Violet Fringe","#8B5CF6"],["Electric Blue","#2563EB"]],
    moves: [
      "Procedural Voronoi mathematical partition lines",
      "Glowing cell wall borders with gradient falloffs",
      "Radiant primary nucleus at off-center focal point",
      "Biological meets computational aesthetic"
],
    facts: {"Type":"Voronoi Diagram","Contrast":"High","Readability":"Geometric","Metaphor":"Adaptive Knowledge"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0F172A"/>
    <!-- Voronoi cell network -->
    <!-- Center cell -->
    <polygon points="512,360 660,440 640,610 480,660 380,520" fill="#06B6D4" stroke="#FFFFFF" stroke-width="18"/>
    <!-- Surrounding cells -->
    <polygon points="512,360 660,440 780,320 620,200" fill="#0284C7" fill-opacity="0.6" stroke="#38BDF8" stroke-width="14"/>
    <polygon points="660,440 640,610 820,640 860,460 780,320" fill="#1D4ED8" fill-opacity="0.5" stroke="#38BDF8" stroke-width="14"/>
    <polygon points="640,610 480,660 520,830 720,820 820,640" fill="#6D28D9" fill-opacity="0.6" stroke="#C084FC" stroke-width="14"/>
    <polygon points="480,660 380,520 230,620 320,800 520,830" fill="#7C3AED" fill-opacity="0.5" stroke="#C084FC" stroke-width="14"/>
    <polygon points="380,520 512,360 410,210 240,320 230,480" fill="#0369A1" fill-opacity="0.6" stroke="#38BDF8" stroke-width="14"/>
    <polygon points="410,210 512,360 620,200 512,160" fill="#0891B2" fill-opacity="0.7" stroke="#38BDF8" stroke-width="14"/>
    <!-- Nucleus spark in center cell -->
    <circle cx="534" cy="514" r="36" fill="#FFFFFF"/>
    <circle cx="534" cy="514" r="70" stroke="#FFFFFF" stroke-width="6" fill="none" opacity="0.5"/>
  `
  });

  add({
    id: "c09_archimedean_solid",
    n: 9,
    group: "polyhedra",
    name: "Archimedean Solid",
    tagline: "Great rhombicuboctahedron with balanced square & hexagonal facets",
    concept: "One of the 13 Archimedean solids, possessing the highest symmetry of all polyhedra with octagons, hexagons, and squares. Represents architectural rigor, systematic thinking, and robust modular course construction.",
    palette: [["Obsidian Core","#090D16"],["Architectural Teal","#0D9488"],["Cobalt Slate","#1E40AF"],["Steel White","#F8FAFC"]],
    moves: [
      "Precise Archimedean projection with 3 face types (octagons, hexagons, squares)",
      "Contrasting facet fills to highlight mathematical symmetry",
      "Dual-line architectural chamfers",
      "Structured, industrial presence ideal for desktop apps"
],
    facts: {"Type":"Archimedean Solid","Contrast":"High","Readability":"Architectural","Metaphor":"Structural Rigor"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#090D16"/>
    <!-- Central Octagon -->
    <polygon points="420,380 604,380 680,456 680,640 604,716 420,716 344,640 344,456" fill="#0D9488" stroke="#5EEAD4" stroke-width="16"/>
    <!-- Adjacent Squares -->
    <polygon points="420,380 604,380 580,240 444,240" fill="#1E40AF" stroke="#60A5FA" stroke-width="12"/>
    <polygon points="680,456 680,640 820,616 820,480" fill="#1E40AF" stroke="#60A5FA" stroke-width="12"/>
    <polygon points="604,716 420,716 444,856 580,856" fill="#1E40AF" stroke="#60A5FA" stroke-width="12"/>
    <polygon points="344,640 344,456 204,480 204,616" fill="#1E40AF" stroke="#60A5FA" stroke-width="12"/>
    <!-- Adjacent Hexagons on Corners -->
    <polygon points="604,380 680,456 820,480 840,360 740,280 580,240" fill="#047857" stroke="#34D399" stroke-width="10"/>
    <polygon points="680,640 604,716 580,856 700,840 820,740 820,616" fill="#0F766E" stroke="#2DD4BF" stroke-width="10"/>
    <polygon points="420,716 344,640 204,616 180,740 300,840 444,856" fill="#1E3A8A" stroke="#93C5FD" stroke-width="10"/>
    <polygon points="344,456 420,380 444,240 300,260 180,360 204,480" fill="#0369A1" stroke="#38BDF8" stroke-width="10"/>
    <!-- Core glyph inside center octagon -->
    <path d="M472 548L552 548M512 468L512 628" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/>
  `
  });

  add({
    id: "c10_kinetic_mobius_poly",
    n: 10,
    group: "polyhedra",
    name: "Möbius Polyhedral Ring",
    tagline: "Faceted 3D twisting ribbon forming an endless loop of learning",
    concept: "A single-sided topological Möbius strip rendered as connected polygonal facets that shift from electric cyan through amethyst purple to solar gold. Embodies the endless cycle of learning, testing, and synthesizing knowledge.",
    palette: [["Void Slate","#080C14"],["Cyan Ribbon","#06B6D4"],["Amethyst Ribbon","#8B5CF6"],["Amber Twist","#F59E0B"]],
    moves: [
      "True topological Möbius loop with 180-degree half-twist",
      "Continuous polygonal facet segments with directional lighting",
      "Dual color gradients mapping the infinite surface",
      "Fluid kinetic motion frozen into a desktop app emblem"
],
    facts: {"Type":"Topology / Ribbon","Contrast":"Very High","Readability":"Fluid","Metaphor":"Continuous Learning"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#080C14"/>
    <!-- Möbius loop rendered with 3D overlapping curved segments -->
    <!-- Back loop segment -->
    <path d="M280 420 C340 240, 684 240, 744 420 C780 540, 700 700, 512 760 C324 700, 244 540, 280 420 Z" fill="none" stroke="#1E293B" stroke-width="120" stroke-linecap="round"/>
    <!-- Outer vibrant ribbon path -->
    <path d="M280 440 C340 280, 684 280, 744 440 C790 560, 680 720, 512 760" fill="none" stroke="#06B6D4" stroke-width="64" stroke-linecap="round"/>
    <!-- Foreground twist segment -->
    <path d="M512 760 C380 720, 260 580, 310 440 C350 340, 470 330, 530 420 C600 530, 680 620, 760 600" fill="none" stroke="#8B5CF6" stroke-width="64" stroke-linecap="round"/>
    <path d="M530 420 C580 510, 660 580, 744 560" fill="none" stroke="#F59E0B" stroke-width="64" stroke-linecap="round"/>
    <!-- Specular highlight line -->
    <path d="M300 440 C350 300, 674 300, 724 440" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" opacity="0.7"/>
    <!-- Central intersection dot -->
    <circle cx="512" cy="512" r="24" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c11_mobius_ribbon_p",
    n: 11,
    group: "monogram",
    name: "Möbius Ribbon 'P'",
    tagline: "Endless 3D dimensional ribbon twisting into a continuous letterform",
    concept: "The letter 'P' formed by a single continuous 3D ribbon that loops back through itself in an isometric twist. The vertical stem transitions seamlessly into the upper bowl, shaded with an electric cyan to violet gradient.",
    palette: [["Deep Slate","#090E1A"],["Electric Cyan","#06B6D4"],["Amethyst Violet","#8B5CF6"],["Specular White","#FFFFFF"]],
    moves: [
      "Continuous isometric ribbon forming both stem and loop",
      "Torque shading along the twist to establish true 3D volume",
      "Clean negative space bowl for instant recognition at small sizes",
      "Signature gradient from base (cyan) to crest (violet)"
],
    facts: {"Type":"Ribbon Monogram","Contrast":"Very High","Readability":"Instant","Metaphor":"Continuous Learning"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#090E1A"/>
    <!-- Back loop segment of P -->
    <path d="M420 280 C620 280, 740 380, 740 500 C740 620, 620 700, 440 700" fill="none" stroke="#6D28D9" stroke-width="120" stroke-linecap="round"/>
    <!-- Main stem rising from bottom -->
    <path d="M360 840 L360 360 C360 250, 480 200, 600 200 C760 200, 840 320, 840 480 C840 640, 700 740, 520 740 L420 740" fill="none" stroke="#06B6D4" stroke-width="96" stroke-linecap="round"/>
    <!-- Specular spine -->
    <path d="M360 820 L360 380 C360 270, 490 230, 600 230 C740 230, 810 330, 810 480" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" opacity="0.8"/>
    <!-- Inner bowl highlight ring -->
    <circle cx="580" cy="480" r="48" fill="#8B5CF6" fill-opacity="0.3" stroke="#8B5CF6" stroke-width="8"/>
  `
  });

  add({
    id: "c12_terminal_chevron_p",
    n: 12,
    group: "monogram",
    name: "Terminal Prompt 'P'",
    tagline: "Coding agent chevron prompt '>_' integrated into a bold monogram",
    concept: "Directly celebrates the coding agent authoring experience. The vertical stem of the 'P' is formed by a stylized prompt chevron '>', whose upper arm extends into a bold curved loop containing a glowing green cursor block.",
    palette: [["Dark Console","#0D1117"],["Terminal Blue","#38BDF8"],["Agent Green","#10B981"],["Cursor White","#FFFFFF"]],
    moves: [
      "Vertical spine incorporates the iconic agent '>' prompt",
      "Upper bowl flows directly from the chevron apex",
      "Blinking green cursor block '_ ' nestled inside the counter",
      "Instantly signifies a code-native, agent-native tool"
],
    facts: {"Type":"Code Monogram","Contrast":"High","Readability":"Sharp","Metaphor":"Agent Prompt Loop"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0D1117"/>
    <!-- Left vertical spine -->
    <rect x="260" y="220" width="96" height="584" rx="48" fill="#38BDF8"/>
    <!-- Terminal Chevron '>' pointing into the P loop -->
    <path d="M190 340 L300 440 L190 540" stroke="#10B981" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Upper P Loop -->
    <path d="M340 268 H580 C740 268, 820 360, 820 480 C820 600, 720 680, 560 680 H340" fill="none" stroke="#38BDF8" stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Blinking Cursor Block inside bowl -->
    <rect x="490" y="440" width="120" height="72" rx="16" fill="#10B981"/>
    <!-- Prompt scanline effect -->
    <line x1="260" y1="480" x2="820" y2="480" stroke="#FFFFFF" stroke-width="4" stroke-opacity="0.3"/>
  `
  });

  add({
    id: "c13_bauhaus_geometric_p",
    n: 13,
    group: "monogram",
    name: "Bauhaus Geometric 'P'",
    tagline: "Constructivist intersection of pure column, circle, and solar arc",
    concept: "Heavily influenced by Herbert Bayer and Wassily Kandinsky's Bauhaus typography. Built entirely from primary geometric elements: a solid rectangular vertical column, a perfect tangential circle, and an intersecting golden arc.",
    palette: [["Deep Slate","#0F172A"],["Bauhaus Cyan","#06B6D4"],["Solar Gold","#F59E0B"],["Pure White","#FFFFFF"]],
    moves: [
      "Strict Euclidean geometry (circle tangent to rectangle)",
      "Contrasting primary colors on a dark modern slate field",
      "Intersecting golden radius line through the bowl center",
      "Timeless architectural presence suitable for desktop and web"
],
    facts: {"Type":"Constructivist","Contrast":"High","Readability":"Iconic","Metaphor":"Elementary Form"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0F172A"/>
    <!-- Tangent circle (bowl) -->
    <circle cx="560" cy="440" r="230" fill="#06B6D4"/>
    <circle cx="560" cy="440" r="110" fill="#0F172A"/>
    <!-- Intersecting Golden Arc -->
    <path d="M560 210 A230 230 0 0 1 790 440" stroke="#F59E0B" stroke-width="48" fill="none" stroke-linecap="round"/>
    <!-- Solid vertical column (stem) -->
    <rect x="250" y="210" width="120" height="604" rx="40" fill="#FFFFFF"/>
    <!-- Geometric anchor square -->
    <rect x="520" y="620" width="80" height="80" rx="16" fill="#F59E0B"/>
  `
  });

  add({
    id: "c14_architectural_arch_p",
    n: 14,
    group: "monogram",
    name: "Renaissance Arch 'P'",
    tagline: "Classical Roman arcade arch merged with precision neon fluting",
    concept: "Combines the architectural grandeur of classical Italian Renaissance arches (Brunelleschi, Alberti) with modern high-tech precision. The stem acts as a fluted architectural column, while the bowl forms a vaulting roman arch in cyan.",
    palette: [["Obsidian Vault","#0A0D14"],["Marble Cyan","#38BDF8"],["Classical Gold","#FBBF24"],["Deep Indigo","#1E1B4B"]],
    moves: [
      "Fluted column striations on the vertical pillar",
      "Semi-circular Roman barrel arch forming the bowl",
      "Gold keystone cap at the apex of the arch",
      "Balanced homage to classical architecture and modern software"
],
    facts: {"Type":"Architectural","Contrast":"High","Readability":"Noble","Metaphor":"Classical Arch"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0A0D14"/>
    <!-- Base plinth -->
    <rect x="210" y="780" width="220" height="44" rx="16" fill="#38BDF8"/>
    <!-- Fluted column stem (3 flutes) -->
    <rect x="240" y="230" width="40" height="550" rx="12" fill="#38BDF8"/>
    <rect x="300" y="230" width="40" height="550" rx="12" fill="#0284C7"/>
    <rect x="360" y="230" width="40" height="550" rx="12" fill="#38BDF8"/>
    <!-- Roman Arch Bowl -->
    <path d="M380 230 H560 C740 230, 820 320, 820 460 C820 600, 740 680, 560 680 H380" fill="none" stroke="#38BDF8" stroke-width="72" stroke-linecap="round"/>
    <!-- Golden Keystone at arch apex -->
    <polygon points="560,160 600,240 520,240" fill="#FBBF24" stroke="#FFFFFF" stroke-width="6"/>
    <!-- Inner arch fill -->
    <circle cx="560" cy="460" r="90" fill="#1E1B4B" stroke="#FBBF24" stroke-width="10"/>
  `
  });

  add({
    id: "c15_split_stencil_p",
    n: 15,
    group: "monogram",
    name: "Split Stencil 'P'",
    tagline: "Heavy brutalist monogram bisected by a 45-degree laser air gap",
    concept: "A heavy, masculine, industrial stencil 'P' sliced at a crisp 45-degree angle. Inside the air gap, an intense laser-cyan core illuminates the dark steel plates. Embodies runtime horsepower and compiler efficiency.",
    palette: [["Steel Charcoal","#111827"],["Laser Cyan","#00F0FF"],["Titanium Grey","#9CA3AF"],["Core Black","#030712"]],
    moves: [
      "Bold geometric stencil cut with 45-degree angle",
      "High-contrast negative space channel",
      "Glowing cyan laser diode inside the channel",
      "Heavyweight silhouette with maximum dock punch"
],
    facts: {"Type":"Industrial Stencil","Contrast":"Maximum","Readability":"Punchy","Metaphor":"High-Power Runtime"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#030712"/>
    <!-- Laser glow underneath gap -->
    <line x1="200" y1="620" x2="800" y2="340" stroke="#00F0FF" stroke-width="64" stroke-opacity="0.3" filter="blur(8px)"/>
    <line x1="200" y1="620" x2="800" y2="340" stroke="#00F0FF" stroke-width="18"/>
    <!-- Upper stencil chunk -->
    <path d="M260 220 H620 C760 220, 840 300, 840 420 C840 470, 810 510, 760 540 L260 480 Z" fill="#38BDF8"/>
    <!-- Lower stem chunk -->
    <path d="M260 540 L440 520 L440 680 H360 L360 820 H260 Z" fill="#9CA3AF"/>
    <!-- Stem bottom extension -->
    <rect x="260" y="560" width="120" height="260" rx="32" fill="#F8FAFC"/>
    <!-- Inner cut circle -->
    <circle cx="560" cy="380" r="80" fill="#030712"/>
  `
  });

  add({
    id: "c16_neon_flux_p",
    n: 16,
    group: "monogram",
    name: "Neon Flux Tube 'P'",
    tagline: "Continuous luminous neon glass tube with intense cyan phosphor",
    concept: "Crafted like a hand-bent neon signage tube glowing in a dark laboratory. The gas tube starts at an electrode collar, bends upward into the stem, sweeps into the rounded bowl, and loops back into the base with realistic phosphor bloom.",
    palette: [["Dark Void","#050508"],["Neon Cyan Core","#E0F2FE"],["Cyan Phosphor","#06B6D4"],["Ultraviolet Halo","#8B5CF6"]],
    moves: [
      "Continuous fluid path simulating real bent glass tubing",
      "Triple-layered stroke: wide halo, medium glow, pure white core",
      "Electrode mounting brackets at tube terminations",
      "High visual excitement and warmth"
],
    facts: {"Type":"Neon Tube","Contrast":"Maximum","Readability":"Luminous","Metaphor":"Electrified Mind"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#050508"/>
    <!-- Background diffuse glow -->
    <path d="M360 800 V320 C360 220, 480 200, 600 200 C740 200, 820 300, 820 440 C820 580, 720 660, 580 660 H360" fill="none" stroke="#8B5CF6" stroke-width="140" stroke-opacity="0.2" filter="blur(14px)"/>
    <!-- Mid glow stroke -->
    <path d="M360 800 V320 C360 220, 480 200, 600 200 C740 200, 820 300, 820 440 C820 580, 720 660, 580 660 H360" fill="none" stroke="#06B6D4" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Pure white plasma filament -->
    <path d="M360 800 V320 C360 220, 480 200, 600 200 C740 200, 820 300, 820 440 C820 580, 720 660, 580 660 H360" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Glass mounting collars -->
    <rect x="330" y="780" width="60" height="24" rx="8" fill="#475569"/>
    <rect x="330" y="648" width="60" height="24" rx="8" fill="#475569"/>
  `
  });

  add({
    id: "c17_dual_loop_p",
    n: 17,
    group: "monogram",
    name: "Interlocking Dual-Ring 'P'",
    tagline: "Two interlinked gradient tori symbolizing student and agent pairing",
    concept: "Formed by two interlinking circular rings in 3D perspective: an elongated vertical oval ring forming the spine, and an intersecting horizontal ring forming the upper bowl. Expresses the symbiotic partnership between human learner and coding agent.",
    palette: [["Deep Slate","#0B1120"],["Human Cyan","#38BDF8"],["Agent Violet","#A855F7"],["Overlap Spark","#FFFFFF"]],
    moves: [
      "Two 3D rings interwoven in front/back depth layering",
      "Cyan ring represents the human learner; violet ring represents the agent",
      "Gleaming optical specular node at the primary intersection",
      "Smooth mathematical curves with tactile volume"
],
    facts: {"Type":"Interlocking Rings","Contrast":"High","Readability":"Modern","Metaphor":"Human-Agent Symbiosis"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B1120"/>
    <!-- Vertical ring (human oval) -->
    <rect x="270" y="220" width="140" height="580" rx="70" fill="none" stroke="#38BDF8" stroke-width="60"/>
    <!-- Horizontal bowl ring (agent ring) passing through vertical ring -->
    <path d="M340 330 C560 330, 780 340, 780 470 C780 600, 560 610, 340 610" fill="none" stroke="#A855F7" stroke-width="60" stroke-linecap="round"/>
    <!-- Foreground segment of vertical ring to create weave -->
    <path d="M270 420 V520" stroke="#38BDF8" stroke-width="60" stroke-linecap="round"/>
    <!-- Specular crossing node -->
    <circle cx="340" cy="470" r="32" fill="#FFFFFF"/>
    <circle cx="340" cy="470" r="54" stroke="#FFFFFF" stroke-width="6" fill="none" opacity="0.6"/>
  `
  });

  add({
    id: "c18_golden_spiral_p",
    n: 18,
    group: "monogram",
    name: "Fibonacci Spiral 'P'",
    tagline: "Logarithmic golden curve unfurling from the vertical spine",
    concept: "Constructed strictly according to the golden ratio phi (1.618). The bowl of the 'P' is governed by a logarithmic Fibonacci spiral unwinding from an internal golden pole to meet the vertical baseline. Celebrates mathematical perfection in learning.",
    palette: [["Obsidian Dark","#08171E"],["Golden Ochre","#F59E0B"],["Aqua Foil","#06B6D4"],["Paper White","#F1F5F9"]],
    moves: [
      "Mathematical logarithmic spiral arc forming the bowl",
      "Subtle Fibonacci rectangle tiling guides visible in background",
      "Dual metallic gold and aqua gradient stroke",
      "Unmistakable intellectual pedigree"
],
    facts: {"Type":"Mathematical","Contrast":"High","Readability":"Elegant","Metaphor":"Golden Ratio of Knowledge"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#08171E"/>
    <!-- Fibonacci rectangle ghost guides -->
    <rect x="360" y="240" width="380" height="380" fill="none" stroke="#155E75" stroke-width="4" stroke-dasharray="8 8"/>
    <rect x="520" y="380" width="220" height="240" fill="none" stroke="#155E75" stroke-width="4" stroke-dasharray="8 8"/>
    <!-- Vertical stem -->
    <rect x="250" y="240" width="110" height="544" rx="40" fill="#F1F5F9"/>
    <!-- Fibonacci Spiral bowl path -->
    <path d="M360 240 C600 240, 780 320, 780 460 C780 580, 660 620, 560 620 C480 620, 440 560, 440 500 C440 460, 470 440, 500 440" fill="none" stroke="#F59E0B" stroke-width="68" stroke-linecap="round"/>
    <!-- Golden focal nucleus -->
    <circle cx="500" cy="440" r="24" fill="#06B6D4"/>
    <circle cx="500" cy="440" r="12" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c19_cyber_serif_p",
    n: 19,
    group: "monogram",
    name: "Cyber-Serif 'P'",
    tagline: "Chiseled classical bracket serif with micro-circuit vector traces",
    concept: "Reimagines the traditional academic serif letterform through a cybernetic lens. Sharp, wedge-like bracket serifs anchor the stem, while fine laser-etched PCB circuit tracks run through the stroke channels.",
    palette: [["Deep Carbon","#0F172A"],["Chiseled White","#F8FAFC"],["PCB Cyan","#38BDF8"],["Copper Amber","#D97706"]],
    moves: [
      "Wedge-bracket architectural serifs top and bottom",
      "Micro-circuit traces running inside the letterform",
      "Gold PCB via solder pads accenting terminal points",
      "Strikes the balance between classic scholarship and high-tech code"
],
    facts: {"Type":"Digital Serif","Contrast":"Maximum","Readability":"Authoritative","Metaphor":"High-Tech Scholarship"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0F172A"/>
    <!-- Base serif -->
    <polygon points="180,800 440,800 380,720 240,720" fill="#F8FAFC"/>
    <!-- Top stem serif -->
    <polygon points="180,240 400,240 360,320 240,320" fill="#F8FAFC"/>
    <!-- Main vertical stem -->
    <rect x="250" y="240" width="120" height="540" fill="#F8FAFC"/>
    <!-- Curved serif bowl -->
    <path d="M370 270 H580 C740 270, 840 360, 840 470 C840 580, 740 670, 580 670 H370" fill="none" stroke="#F8FAFC" stroke-width="96" stroke-linecap="round"/>
    <!-- Cyan PCB circuit traces inside stem -->
    <line x1="310" y1="360" x2="310" y2="700" stroke="#38BDF8" stroke-width="12"/>
    <!-- Copper PCB Via pads -->
    <circle cx="310" cy="420" r="14" fill="#D97706" stroke="#FFFFFF" stroke-width="4"/>
    <circle cx="310" cy="540" r="14" fill="#D97706" stroke="#FFFFFF" stroke-width="4"/>
    <circle cx="310" cy="660" r="14" fill="#D97706" stroke="#FFFFFF" stroke-width="4"/>
    <!-- Trace into bowl -->
    <path d="M310 420 H540 C640 420, 720 440, 720 470" fill="none" stroke="#38BDF8" stroke-width="12"/>
    <circle cx="720" cy="470" r="16" fill="#38BDF8"/>
  `
  });

  add({
    id: "c20_glass_stacked_p",
    n: 20,
    group: "monogram",
    name: "Frosted Glass Layered 'P'",
    tagline: "Overlapping translucent acrylic plates with specular edge reflections",
    concept: "Crafted from overlapping sheets of tinted frosted acrylic in modern macOS visionOS aesthetics. A vertical pill plate forms the stem, while a translucent cyan disc overlaps to form the bowl, generating a third deep teal tone in the intersection.",
    palette: [["Slate Navy","#131B2E"],["Translucent Cyan","#38BDF8"],["Deep Teal","#0D9488"],["Specular Highlight","#FFFFFF"]],
    moves: [
      "Frosted glass material simulation with rim highlights",
      "Color multiplication in the overlapping geometry",
      "Soft drop-shadow between glass planes",
      "Sophisticated desktop app presence"
],
    facts: {"Type":"Glassmorphism","Contrast":"High","Readability":"Clean","Metaphor":"Clarity of Vision"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#131B2E"/>
    <!-- Ambient back glow -->
    <circle cx="560" cy="460" r="260" fill="#0D9488" fill-opacity="0.25" filter="blur(20px)"/>
    <!-- Stem glass plate -->
    <rect x="250" y="220" width="140" height="584" rx="70" fill="#38BDF8" fill-opacity="0.2" stroke="#38BDF8" stroke-width="8"/>
    <rect x="260" y="230" width="120" height="564" rx="60" fill="#1E293B" fill-opacity="0.6"/>
    <!-- Bowl glass plate -->
    <circle cx="580" cy="460" r="210" fill="#06B6D4" fill-opacity="0.4" stroke="#FFFFFF" stroke-width="12"/>
    <circle cx="580" cy="460" r="100" fill="#131B2E"/>
    <!-- Overlap intersection lens highlight -->
    <path d="M370 280 C440 330, 440 590, 370 640 Z" fill="#FFFFFF" fill-opacity="0.35"/>
    <!-- Top edge rim reflection -->
    <line x1="280" y1="230" x2="360" y2="230" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
    <path d="M500 260 A210 210 0 0 1 700 320" stroke="#FFFFFF" stroke-width="14" fill="none" stroke-linecap="round"/>
  `
  });

  add({
    id: "c21_cyber_astrolabe",
    n: 21,
    group: "renaissance",
    name: "Cyber-Astrolabe",
    tagline: "Ancient navigation brass rings digitized into cyan coordinate circles",
    concept: "The astrolabe was the renaissance computer used to calculate stellar coordinates and time. Here it is reborn as a digital instrument: concentric calibrated cyan rings with azimuth tick marks, pointer pointers, and an agent core pivot.",
    palette: [["Space Void","#070A12"],["Astrolabe Brass","#F59E0B"],["Digital Cyan","#06B6D4"],["Stellar White","#FFFFFF"]],
    moves: [
      "Concentric azimuth rings with 12 degree tick marks",
      "Outer circular scale with coordinate numbering dots",
      "Rotational rete pointer arms pointing to key star nodes",
      "Central jewel pivot pulsing with agent focus"
],
    facts: {"Type":"Instrument","Contrast":"High","Readability":"Detailed","Metaphor":"Navigating Knowledge"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#070A12"/>
    <!-- Outer Mater Ring -->
    <circle cx="512" cy="512" r="380" fill="none" stroke="#F59E0B" stroke-width="18"/>
    <circle cx="512" cy="512" r="340" fill="none" stroke="#06B6D4" stroke-width="8" stroke-dasharray="12 16"/>
    <!-- Azimuth calibration ticks -->
    <circle cx="512" cy="512" r="260" fill="none" stroke="#38BDF8" stroke-width="6"/>
    <line x1="512" y1="132" x2="512" y2="892" stroke="#F59E0B" stroke-width="6" stroke-opacity="0.5"/>
    <line x1="132" y1="512" x2="892" y2="512" stroke="#F59E0B" stroke-width="6" stroke-opacity="0.5"/>
    <!-- Rete pointer arms (flame curves) -->
    <path d="M512 512 L680 340 M512 512 L344 680" stroke="#06B6D4" stroke-width="16" stroke-linecap="round"/>
    <path d="M512 512 L360 360 M512 512 L664 664" stroke="#8B5CF6" stroke-width="12" stroke-linecap="round"/>
    <!-- Star pointer nodes -->
    <polygon points="680,340 700,350 690,330 710,335" fill="#FFFFFF"/>
    <circle cx="344" cy="680" r="14" fill="#FFFFFF"/>
    <circle cx="360" cy="360" r="14" fill="#06B6D4"/>
    <circle cx="664" cy="664" r="14" fill="#F59E0B"/>
    <!-- Center Pivot Pin -->
    <circle cx="512" cy="512" r="48" fill="#F59E0B" stroke="#FFFFFF" stroke-width="10"/>
    <circle cx="512" cy="512" r="18" fill="#070A12"/>
  `
  });

  add({
    id: "c22_neural_codex",
    n: 22,
    group: "renaissance",
    name: "Illuminated Neural Codex",
    tagline: "Classical manuscript page transitioning into glowing neural graph weights",
    concept: "An open codex book representing centuries of recorded scholarship. The left page shows classical humanist parchment rulings, while the right page transforms into a modern glowing graph of neural network weights and synaptic pulses.",
    palette: [["Obsidian Desk","#0B0E17"],["Parchment Gold","#FEF08A"],["Synaptic Cyan","#38BDF8"],["Neural Violet","#A855F7"]],
    moves: [
      "Open book perspective spine with curved dimensional pages",
      "Left page displays classical humanist text block lines",
      "Right page erupts into radiant neural nodes and synapses",
      "Seamless bridge between classic book and agent runtime"
],
    facts: {"Type":"Manuscript / Network","Contrast":"High","Readability":"Symbolic","Metaphor":"Book to Agent"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Book Cover Silhouette -->
    <path d="M180 740 C340 760, 480 720, 512 680 C544 720, 684 760, 844 740 L844 320 C684 340, 544 300, 512 260 C480 300, 340 340, 180 320 Z" fill="#1E293B" stroke="#475569" stroke-width="16"/>
    <!-- Left Page (Classical Rulings) -->
    <path d="M190 330 C340 350, 470 310, 502 276 V670 C470 704, 340 744, 190 724 Z" fill="#0F172A"/>
    <line x1="240" y1="390" x2="450" y2="370" stroke="#FBBF24" stroke-width="8" stroke-linecap="round"/>
    <line x1="240" y1="450" x2="450" y2="430" stroke="#FBBF24" stroke-width="8" stroke-linecap="round"/>
    <line x1="240" y1="510" x2="450" y2="490" stroke="#FBBF24" stroke-width="8" stroke-linecap="round"/>
    <line x1="240" y1="570" x2="450" y2="550" stroke="#FBBF24" stroke-width="8" stroke-linecap="round"/>
    <line x1="240" y1="630" x2="380" y2="615" stroke="#FBBF24" stroke-width="8" stroke-linecap="round"/>
    <!-- Right Page (Neural Net Synapses) -->
    <path d="M522 276 C554 310, 684 350, 834 330 V724 C684 744, 554 704, 522 670 Z" fill="#0F172A"/>
    <!-- Neural Nodes & Edges -->
    <line x1="570" y1="380" x2="680" y2="440" stroke="#38BDF8" stroke-width="8"/>
    <line x1="570" y1="500" x2="680" y2="440" stroke="#38BDF8" stroke-width="8"/>
    <line x1="570" y1="620" x2="680" y2="560" stroke="#38BDF8" stroke-width="8"/>
    <line x1="680" y1="440" x2="780" y2="480" stroke="#A855F7" stroke-width="10"/>
    <line x1="680" y1="560" x2="780" y2="480" stroke="#A855F7" stroke-width="10"/>
    <circle cx="570" cy="380" r="16" fill="#38BDF8"/>
    <circle cx="570" cy="500" r="16" fill="#38BDF8"/>
    <circle cx="570" cy="620" r="16" fill="#38BDF8"/>
    <circle cx="680" cy="440" r="22" fill="#A855F7"/>
    <circle cx="680" cy="560" r="22" fill="#A855F7"/>
    <circle cx="780" cy="480" r="28" fill="#FFFFFF"/>
    <!-- Central Book Binding Spine Line -->
    <line x1="512" y1="260" x2="512" y2="680" stroke="#38BDF8" stroke-width="14" stroke-linecap="round"/>
  `
  });

  add({
    id: "c23_vitruvian_ring",
    n: 23,
    group: "renaissance",
    name: "Vitruvian Node Ring",
    tagline: "Da Vinci circle-and-square proportion diagram with computational nodes",
    concept: "Leonardo's iconic Vitruvian Man proportion study distilled into a geometric emblem. The perfect circle and square circumscribe an interconnected diamond node lattice, harmonizing human-centered ergonomics with automated agent logic.",
    palette: [["Obsidian Dark","#0B0F19"],["Proportion Gold","#F59E0B"],["Node Cyan","#06B6D4"],["Pure White","#FFFFFF"]],
    moves: [
      "Exact geometric Vitruvian alignment (circle touching square sides)",
      "Four diagonal arm-leg extension axes rendered as glowing vectors",
      "Nodes at harmonic proportion intersections",
      "Profound tribute to humanistic polymathy"
],
    facts: {"Type":"Proportion Diagram","Contrast":"High","Readability":"Iconic","Metaphor":"Human-Agent Harmony"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0F19"/>
    <!-- Vitruvian Circle -->
    <circle cx="512" cy="512" r="360" fill="none" stroke="#F59E0B" stroke-width="12"/>
    <!-- Vitruvian Square -->
    <rect x="232" y="232" width="560" height="560" fill="none" stroke="#06B6D4" stroke-width="14"/>
    <!-- Diagonal Axes -->
    <line x1="232" y1="232" x2="792" y2="792" stroke="#38BDF8" stroke-width="6" stroke-opacity="0.6"/>
    <line x1="792" y1="232" x2="232" y2="792" stroke="#38BDF8" stroke-width="6" stroke-opacity="0.6"/>
    <!-- Diamond Inscription -->
    <polygon points="512,232 792,512 512,792 232,512" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="16 12"/>
    <!-- Harmonic Nodes -->
    <circle cx="512" cy="232" r="20" fill="#FFFFFF"/>
    <circle cx="792" cy="512" r="20" fill="#FFFFFF"/>
    <circle cx="512" cy="792" r="20" fill="#FFFFFF"/>
    <circle cx="232" cy="512" r="20" fill="#FFFFFF"/>
    <circle cx="232" cy="232" r="16" fill="#F59E0B"/>
    <circle cx="792" cy="232" r="16" fill="#F59E0B"/>
    <circle cx="792" cy="792" r="16" fill="#F59E0B"/>
    <circle cx="232" cy="792" r="16" fill="#F59E0B"/>
    <!-- Center Human-Agent Pivot Core -->
    <circle cx="512" cy="512" r="44" fill="#06B6D4" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="512" cy="512" r="18" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c24_armillary_sphere",
    n: 24,
    group: "renaissance",
    name: "Armillary Sphere",
    tagline: "Nested gimbal rings rotating in 3D around an agent spark core",
    concept: "The armillary sphere was the prime scientific emblem of the Renaissance court. Three interlocking metallic gimbal rings represent the equator, ecliptic, and meridian, freely pivoting around an internal agent spark that illuminates the cosmos of knowledge.",
    palette: [["Midnight Void","#070913"],["Brass Gold","#FBBF24"],["Electric Azure","#0284C7"],["Core Spark","#FFFFFF"]],
    moves: [
      "Three nested elliptical rings rendered in 3D perspective",
      "Polar axis spear passing through the north and south poles",
      "Zodiac graduation marks along the equatorial band",
      "Levitating brilliant diamond core"
],
    facts: {"Type":"Cosmological","Contrast":"High","Readability":"Sculptural","Metaphor":"Universal Mechanics"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#070913"/>
    <!-- Outer meridian ring (circle) -->
    <circle cx="512" cy="512" r="360" fill="none" stroke="#FBBF24" stroke-width="20"/>
    <!-- Polar axis spear -->
    <line x1="512" y1="100" x2="512" y2="924" stroke="#FBBF24" stroke-width="14" stroke-linecap="round"/>
    <polygon points="512,80 530,130 494,130" fill="#FBBF24"/>
    <!-- Equator horizontal ellipse -->
    <ellipse cx="512" cy="512" rx="360" ry="120" fill="none" stroke="#0284C7" stroke-width="18"/>
    <!-- Tilted Ecliptic ellipse (23.5 degree axial tilt) -->
    <g transform="rotate(-28 512 512)">
      <ellipse cx="512" cy="512" rx="360" ry="140" fill="none" stroke="#38BDF8" stroke-width="16" stroke-dasharray="24 16"/>
    </g>
    <!-- Inner gimbal ring -->
    <ellipse cx="512" cy="512" rx="140" ry="240" fill="none" stroke="#FBBF24" stroke-width="12"/>
    <!-- Central Agent Core Spark -->
    <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>
    <polygon points="512,430 528,496 594,512 528,528 512,594 496,528 430,512 496,496" fill="#38BDF8"/>
  `
  });

  add({
    id: "c25_compass_of_inquiry",
    n: 25,
    group: "renaissance",
    name: "Compass of Inquiry",
    tagline: "Draftsman divider compass measuring a brilliant arc across coordinate plane",
    concept: "The draftsman's proportional compass—used by Galileo and Michelangelo to transfer measurements and solve mathematical proportions. The two steel arms pivot open, etching a brilliant cyan arc across an architectural grid.",
    palette: [["Obsidian Dark","#0B0E17"],["Compass Steel","#E2E8F0"],["Laser Arc","#00F0FF"],["Pivot Gold","#F59E0B"]],
    moves: [
      "Classic dual-leg draftsman divider hinged at the top apex",
      "Etched luminous circular arc drawn between the needle tips",
      "Gold thumb-screw adjustment wheel on the horizontal strut",
      "Symbol of precision measurement and scientific rigor"
],
    facts: {"Type":"Instrument","Contrast":"Very High","Readability":"Crisp","Metaphor":"Measured Inquiry"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Architectural grid lines in background -->
    <line x1="200" y1="760" x2="824" y2="760" stroke="#1E293B" stroke-width="6"/>
    <circle cx="512" cy="240" r="520" fill="none" stroke="#1E293B" stroke-width="6" stroke-dasharray="16 12"/>
    <!-- Luminous drawn cyan arc -->
    <path d="M280 760 A520 520 0 0 1 744 760" fill="none" stroke="#00F0FF" stroke-width="24" stroke-linecap="round"/>
    <path d="M280 760 A520 520 0 0 1 744 760" fill="none" stroke="#00F0FF" stroke-width="64" stroke-opacity="0.3" filter="blur(8px)"/>
    <!-- Horizontal adjustment crossbar -->
    <line x1="360" y1="560" x2="664" y2="560" stroke="#94A3B8" stroke-width="16"/>
    <circle cx="512" cy="560" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="6"/>
    <!-- Left compass leg -->
    <line x1="512" y1="240" x2="280" y2="760" stroke="#E2E8F0" stroke-width="36" stroke-linecap="round"/>
    <!-- Right compass leg -->
    <line x1="512" y1="240" x2="744" y2="760" stroke="#CBD5E1" stroke-width="36" stroke-linecap="round"/>
    <!-- Needle Points -->
    <circle cx="280" cy="760" r="16" fill="#00F0FF"/>
    <circle cx="744" cy="760" r="16" fill="#00F0FF"/>
    <!-- Top hinge assembly -->
    <circle cx="512" cy="240" r="54" fill="#F59E0B" stroke="#FFFFFF" stroke-width="12"/>
    <circle cx="512" cy="240" r="20" fill="#0B0E17"/>
  `
  });

  add({
    id: "c26_quill_and_electron",
    n: 26,
    group: "renaissance",
    name: "Cybernetic Quill",
    tagline: "Classical titanium fountain pen nib opening to release an orbiting electron",
    concept: "Fuses classical authorship with quantum computing. A sleek fountain pen nib made of titanium splits down its central capillary slit to reveal an orbiting electron particle circling the breather hole in glowing cyan.",
    palette: [["Obsidian Core","#0A0D14"],["Titanium Nib","#94A3B8"],["Electron Cyan","#38BDF8"],["Ink Gold","#F59E0B"]],
    moves: [
      "High-contrast silhouette of a fine fountain pen nib",
      "Center capillary slit reveals glowing quantum energy",
      "Elliptical electron orbital path looping through the breather hole",
      "Represents coding agents authoring interactive learning courses"
],
    facts: {"Type":"Authorship / Quantum","Contrast":"High","Readability":"Iconic","Metaphor":"Agent Authorship"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0A0D14"/>
    <!-- Pen Nib Body -->
    <path d="M300 840 L300 520 C300 400, 420 280, 512 160 C604 280, 724 400, 724 520 L724 840 Z" fill="#1E293B" stroke="#94A3B8" stroke-width="20"/>
    <!-- Golden Shoulder Inlays -->
    <path d="M340 760 L340 540 C340 440, 420 360, 512 260" fill="none" stroke="#F59E0B" stroke-width="16" stroke-linecap="round"/>
    <path d="M684 760 L684 540 C684 440, 604 360, 512 260" fill="none" stroke="#F59E0B" stroke-width="16" stroke-linecap="round"/>
    <!-- Center Slit -->
    <line x1="512" y1="160" x2="512" y2="480" stroke="#00F0FF" stroke-width="16" stroke-linecap="round"/>
    <!-- Breather Hole -->
    <circle cx="512" cy="480" r="44" fill="#0A0D14" stroke="#00F0FF" stroke-width="12"/>
    <!-- Electron Orbital Path -->
    <ellipse cx="512" cy="480" rx="180" ry="70" transform="rotate(-30 512 480)" fill="none" stroke="#38BDF8" stroke-width="10" stroke-dasharray="14 10"/>
    <!-- Orbiting Electron Particle -->
    <circle cx="650" cy="420" r="20" fill="#FFFFFF"/>
    <!-- Nib tip ink gleam -->
    <circle cx="512" cy="160" r="24" fill="#00F0FF"/>
  `
  });

  add({
    id: "c27_renaissance_spark",
    n: 27,
    group: "renaissance",
    name: "Polymath Octagram",
    tagline: "Eight-pointed multifaceted spark of interconnected human-AI faculties",
    concept: "An 8-pointed multifaceted star burst where each point represents an essential polymathic discipline: Mathematics, Systems, Algorithms, Physics, Artificial Intelligence, Design, Philosophy, and Pedagogy.",
    palette: [["Deep Cosmic","#080B14"],["Radiant Cyan","#00F0FF"],["Amethyst Point","#8B5CF6"],["Golden Spark","#FBBF24"]],
    moves: [
      "Symmetric 8-pointed star with dual-facet directional shading",
      "Concentric radial energy rings in background",
      "Center golden quad-spark core",
      "Tremendous visual energy and icon presence"
],
    facts: {"Type":"Radial Star","Contrast":"Maximum","Readability":"Instant","Metaphor":"Interconnected Faculties"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#080B14"/>
    <!-- Background radial rings -->
    <circle cx="512" cy="512" r="380" fill="none" stroke="#1E293B" stroke-width="8"/>
    <circle cx="512" cy="512" r="280" fill="none" stroke="#00F0FF" stroke-width="4" stroke-opacity="0.3" stroke-dasharray="8 8"/>
    <!-- 8 Star Points with Shading -->
    <!-- North -->
    <polygon points="512,140 540,440 512,512" fill="#00F0FF"/>
    <polygon points="512,140 484,440 512,512" fill="#0284C7"/>
    <!-- South -->
    <polygon points="512,884 540,584 512,512" fill="#8B5CF6"/>
    <polygon points="512,884 484,584 512,512" fill="#6D28D9"/>
    <!-- East -->
    <polygon points="884,512 584,540 512,512" fill="#00F0FF"/>
    <polygon points="884,512 584,484 512,512" fill="#0284C7"/>
    <!-- West -->
    <polygon points="140,512 440,540 512,512" fill="#8B5CF6"/>
    <polygon points="140,512 440,484 512,512" fill="#6D28D9"/>
    <!-- Diagonal NE -->
    <polygon points="775,249 565,475 512,512" fill="#FBBF24"/>
    <polygon points="775,249 535,455 512,512" fill="#D97706"/>
    <!-- Diagonal SW -->
    <polygon points="249,775 455,535 512,512" fill="#FBBF24"/>
    <polygon points="249,775 475,565 512,512" fill="#D97706"/>
    <!-- Diagonal NW -->
    <polygon points="249,249 475,455 512,512" fill="#38BDF8"/>
    <polygon points="249,249 455,475 512,512" fill="#0369A1"/>
    <!-- Diagonal SE -->
    <polygon points="775,775 535,565 512,512" fill="#38BDF8"/>
    <polygon points="775,775 565,535 512,512" fill="#0369A1"/>
    <!-- Center Golden Spark -->
    <circle cx="512" cy="512" r="44" fill="#FFFFFF" stroke="#FBBF24" stroke-width="12"/>
  `
  });

  add({
    id: "c28_socratic_dial",
    n: 28,
    group: "renaissance",
    name: "Socratic Dial",
    tagline: "Clockwork mechanical dial interlocking question and answer quadrants",
    concept: "Derived from the Socratic method of structured dialectic inquiry (mirrored in Polymath's `<SocraticQuiz>` widget). Two concentric rotating clockwork rings with interlocking gear teeth harmonize questions into definitive answers.",
    palette: [["Obsidian Core","#090D16"],["Gear Gold","#F59E0B"],["Dial Teal","#0D9488"],["Gleam White","#FFFFFF"]],
    moves: [
      "Outer circular dial ring with gear-tooth indexing",
      "Four quadrant aperture cutouts representing dialogue stages",
      "Interlocking question mark '?' and exclamation mark '!' glyphs",
      "Tactile horological / clockwork aesthetic"
],
    facts: {"Type":"Mechanism","Contrast":"High","Readability":"Intricate","Metaphor":"Dialectic Inquiry"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#090D16"/>
    <!-- Outer clockwork gear teeth ring -->
    <circle cx="512" cy="512" r="360" fill="none" stroke="#F59E0B" stroke-width="24"/>
    <!-- 8 radial gear teeth tabs -->
    <rect x="496" y="120" width="32" height="48" rx="8" fill="#F59E0B"/>
    <rect x="496" y="856" width="32" height="48" rx="8" fill="#F59E0B"/>
    <rect x="120" y="496" width="48" height="32" rx="8" fill="#F59E0B"/>
    <rect x="856" y="496" width="48" height="32" rx="8" fill="#F59E0B"/>
    <!-- Inner dial disc -->
    <circle cx="512" cy="512" r="280" fill="#0F172A" stroke="#0D9488" stroke-width="16"/>
    <!-- Quadrant crosshair slots -->
    <path d="M512 280 V420 M512 604 V744 M280 512 H420 M604 512 H744" stroke="#5EEAD4" stroke-width="14" stroke-linecap="round"/>
    <!-- Socratic Question Arc -->
    <path d="M440 440 C440 380, 584 380, 584 460 C584 520, 512 540, 512 590" fill="none" stroke="#F59E0B" stroke-width="28" stroke-linecap="round"/>
    <circle cx="512" cy="650" r="16" fill="#F59E0B"/>
    <!-- Center Jewel -->
    <circle cx="512" cy="512" r="32" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c29_prism_of_disciplines",
    n: 29,
    group: "renaissance",
    name: "Hexagonal Spectrum Lens",
    tagline: "Six discipline facets converging into a radiant white focus point",
    concept: "A regular hexagon divided into six equilateral triangles, each representing a core discipline in different spectral hues (Code, Hardware, Math, AI, Visuals, Logic). The rays converge into an ultra-bright white core.",
    palette: [["Space Void","#060911"],["White Focus","#FFFFFF"],["Teal Code","#06B6D4"],["Violet AI","#8B5CF6"],["Amber Math","#F59E0B"]],
    moves: [
      "Perfect geometric hexagon partitioned into 6 radial triangles",
      "Each sector tinted with a distinct discipline color",
      "White-hot focus node at the center convergence",
      "High optical symmetry and purity"
],
    facts: {"Type":"Radial Hexagon","Contrast":"Maximum","Readability":"Pure","Metaphor":"Synthesized Disciplines"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#060911"/>
    <!-- Outer Hexagon ring -->
    <polygon points="512,160 836,346 836,718 512,904 188,718 188,346" fill="none" stroke="#1E293B" stroke-width="24"/>
    <!-- 6 Triangular sectors -->
    <polygon points="512,512 512,180 818,356" fill="#06B6D4" fill-opacity="0.85"/>
    <polygon points="512,512 818,356 818,708" fill="#3B82F6" fill-opacity="0.85"/>
    <polygon points="512,512 818,708 512,884" fill="#8B5CF6" fill-opacity="0.85"/>
    <polygon points="512,512 512,884 206,708" fill="#EC4899" fill-opacity="0.85"/>
    <polygon points="512,512 206,708 206,356" fill="#F59E0B" fill-opacity="0.85"/>
    <polygon points="512,512 206,356 512,180" fill="#10B981" fill-opacity="0.85"/>
    <!-- Black seam dividing lines -->
    <line x1="512" y1="512" x2="512" y2="180" stroke="#060911" stroke-width="16"/>
    <line x1="512" y1="512" x2="818" y2="356" stroke="#060911" stroke-width="16"/>
    <line x1="512" y1="512" x2="818" y2="708" stroke="#060911" stroke-width="16"/>
    <line x1="512" y1="512" x2="512" y2="884" stroke="#060911" stroke-width="16"/>
    <line x1="512" y1="512" x2="206" y2="708" stroke="#060911" stroke-width="16"/>
    <line x1="512" y1="512" x2="206" y2="356" stroke="#060911" stroke-width="16"/>
    <!-- Central White Focus Orb -->
    <circle cx="512" cy="512" r="64" fill="#FFFFFF"/>
    <circle cx="512" cy="512" r="100" stroke="#FFFFFF" stroke-width="8" fill="none" opacity="0.5"/>
  `
  });

  add({
    id: "c30_synthesis_orb",
    n: 30,
    group: "renaissance",
    name: "Levitating Synthesis Core",
    tagline: "Crystalline sphere levitating inside magnetic induction calipers",
    concept: "A futuristic crystalline sphere suspended weightlessly between dual magnetic induction calipers. Inside the sphere, a recursive fractal geometric flame burns, symbolizing self-sustaining learning and agent autonomy.",
    palette: [["Dark Chamber","#070A12"],["Cyan Induction","#00F0FF"],["Violet Bracket","#8B5CF6"],["Plasma Flame","#F59E0B"]],
    moves: [
      "Opposing curved caliper brackets generating magnetic containment",
      "Glass sphere with specular rim lighting",
      "Internal geometric plasma flame icon",
      "Dynamic sci-fi containment visual"
],
    facts: {"Type":"Containment Core","Contrast":"High","Readability":"Dramatic","Metaphor":"Contained Intelligence"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#070A12"/>
    <!-- Top Magnetic Caliper Bracket -->
    <path d="M280 280 C400 180, 624 180, 744 280 L700 340 C600 260, 424 260, 324 340 Z" fill="#8B5CF6" stroke="#C084FC" stroke-width="8"/>
    <!-- Bottom Magnetic Caliper Bracket -->
    <path d="M280 744 C400 844, 624 844, 744 744 L700 684 C600 764, 424 764, 324 684 Z" fill="#8B5CF6" stroke="#C084FC" stroke-width="8"/>
    <!-- Levitating Glass Orb -->
    <circle cx="512" cy="512" r="230" fill="#0F172A" stroke="#00F0FF" stroke-width="20"/>
    <circle cx="512" cy="512" r="230" fill="#00F0FF" fill-opacity="0.15"/>
    <!-- Specular rim highlight -->
    <path d="M350 400 A230 230 0 0 1 512 282" fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
    <!-- Internal Geometric Flame / Diamond Core -->
    <polygon points="512,380 580,480 512,640 444,480" fill="#F59E0B" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="512" cy="512" r="28" fill="#FFFFFF"/>
    <!-- Magnetic induction arcs -->
    <line x1="512" y1="260" x2="512" y2="300" stroke="#00F0FF" stroke-width="12" stroke-linecap="round"/>
    <line x1="512" y1="724" x2="512" y2="764" stroke="#00F0FF" stroke-width="12" stroke-linecap="round"/>
  `
  });

  add({
    id: "c31_silicon_wafer_die",
    n: 31,
    group: "hardware",
    name: "Silicon Processor Die",
    tagline: "Microprocessor floorplan with 4 core clusters & L3 cache crossbar",
    concept: "Directly inspired by modern accelerator die floorplans (like Apple Silicon and GPU clusters). Features 4 compute core quadrants surrounding a central shared cache spine, framed by perimeter I/O PHY channels and gold bond pads.",
    palette: [["Silicon Dark","#0B0E17"],["Core Gold","#F59E0B"],["L3 Cyan","#06B6D4"],["Wire Copper","#D97706"]],
    moves: [
      "Architectural floorplan layout of modern accelerator SoC",
      "Four symmetric compute core blocks with micro-piping",
      "Central high-speed cache crossbar in radiant cyan",
      "Perimeter wire-bond pads reinforcing physical silicon aesthetic"
],
    facts: {"Type":"Silicon Die","Contrast":"High","Readability":"Technical","Metaphor":"Compute Engine"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Outer Die Perimeter Frame -->
    <rect x="180" y="180" width="664" height="664" rx="40" fill="#111827" stroke="#374151" stroke-width="16"/>
    <!-- 4 Core Quadrants -->
    <rect x="230" y="230" width="240" height="240" rx="24" fill="#1E293B" stroke="#F59E0B" stroke-width="12"/>
    <rect x="554" y="230" width="240" height="240" rx="24" fill="#1E293B" stroke="#F59E0B" stroke-width="12"/>
    <rect x="230" y="554" width="240" height="240" rx="24" fill="#1E293B" stroke="#F59E0B" stroke-width="12"/>
    <rect x="554" y="554" width="240" height="240" rx="24" fill="#1E293B" stroke="#F59E0B" stroke-width="12"/>
    <!-- Internal sub-core ALU stripes -->
    <line x1="270" y1="310" x2="430" y2="310" stroke="#F59E0B" stroke-width="8"/>
    <line x1="270" y1="390" x2="430" y2="390" stroke="#F59E0B" stroke-width="8"/>
    <line x1="594" y1="310" x2="754" y2="310" stroke="#F59E0B" stroke-width="8"/>
    <line x1="594" y1="390" x2="754" y2="390" stroke="#F59E0B" stroke-width="8"/>
    <line x1="270" y1="634" x2="430" y2="634" stroke="#F59E0B" stroke-width="8"/>
    <line x1="270" y1="714" x2="430" y2="714" stroke="#F59E0B" stroke-width="8"/>
    <line x1="594" y1="634" x2="754" y2="634" stroke="#F59E0B" stroke-width="8"/>
    <line x1="594" y1="714" x2="754" y2="714" stroke="#F59E0B" stroke-width="8"/>
    <!-- Central Shared L3 Cache / Crossbar -->
    <rect x="470" y="210" width="84" height="604" rx="16" fill="#06B6D4"/>
    <rect x="210" y="470" width="604" height="84" rx="16" fill="#06B6D4"/>
    <!-- Central Node Interconnect -->
    <rect x="450" y="450" width="124" height="124" rx="28" fill="#FFFFFF"/>
    <!-- Perimeter Wire Bond Pads -->
    <circle cx="512" cy="140" r="14" fill="#F59E0B"/>
    <circle cx="630" cy="140" r="14" fill="#F59E0B"/>
    <circle cx="394" cy="140" r="14" fill="#F59E0B"/>
    <circle cx="512" cy="884" r="14" fill="#F59E0B"/>
    <circle cx="630" cy="884" r="14" fill="#F59E0B"/>
    <circle cx="394" cy="884" r="14" fill="#F59E0B"/>
  `
  });

  add({
    id: "c32_roofline_curve",
    n: 32,
    group: "hardware",
    name: "Roofline Performance Plot",
    tagline: "Icon of Polymath's <RooflinePlot> widget: bandwidth slope & compute ceiling",
    concept: "Grounded directly in Polymath's built-in `<RooflinePlot>` component. Depicts the classic systems architecture roofline curve: a steep diagonal memory-bandwidth-bound slope intersecting the horizontal peak-compute saturation ceiling.",
    palette: [["Dark Terminal","#0F172A"],["Roofline Cyan","#00F0FF"],["Attainable Green","#10B981"],["Peak Coral","#F43F5E"]],
    moves: [
      "Iconic piecewise linear roofline curve (slope meeting ceiling)",
      "Coordinate axes with logarithmic grid tick marks",
      "Operating work point diamond sitting right on the knee-point",
      "Direct homage to Polymath's systems & hardware course curriculum"
],
    facts: {"Type":"Systems Model","Contrast":"High","Readability":"Analytical","Metaphor":"Hardware Performance"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0F172A"/>
    <!-- Coordinate Axes -->
    <path d="M220 220 V780 H804" stroke="#475569" stroke-width="16" stroke-linecap="round"/>
    <!-- Grid ticks -->
    <line x1="200" y1="360" x2="220" y2="360" stroke="#475569" stroke-width="12"/>
    <line x1="200" y1="540" x2="220" y2="540" stroke="#475569" stroke-width="12"/>
    <line x1="420" y1="780" x2="420" y2="800" stroke="#475569" stroke-width="12"/>
    <line x1="620" y1="780" x2="620" y2="800" stroke="#475569" stroke-width="12"/>
    <!-- Roofline Attainable Region (polygon fill) -->
    <polygon points="220,780 220,780 480,360 804,360 804,780" fill="#10B981" fill-opacity="0.12"/>
    <!-- Roofline Curve -->
    <path d="M220 780 L480 360 H804" fill="none" stroke="#00F0FF" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M220 780 L480 360 H804" fill="none" stroke="#00F0FF" stroke-width="64" stroke-opacity="0.3" filter="blur(8px)"/>
    <!-- Knee Point (Peak Operational Efficiency) -->
    <circle cx="480" cy="360" r="36" fill="#F43F5E" stroke="#FFFFFF" stroke-width="10"/>
    <!-- Operating workload point -->
    <circle cx="640" cy="480" r="24" fill="#10B981" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Label annotations -->
    <text x="560" y="310" fill="#38BDF8" font-family="monospace" font-size="36" font-weight="bold">PEAK GFLOPS</text>
  `
  });

  add({
    id: "c33_memory_block_matrix",
    n: 33,
    group: "hardware",
    name: "Memory Block Grid",
    tagline: "Icon of Polymath's <MemoryBlockGrid> widget: 4x4 matrix of cache line blocks",
    concept: "Derived from Polymath's core hardware course widget `<MemoryBlockGrid>`. Displays a 4x4 tiled cache line matrix with contrasting block states: cyan for cache hits, violet for cold misses, and solar amber for modified/dirty cache lines.",
    palette: [["Memory Slate","#0D1117"],["Cache Hit Cyan","#06B6D4"],["Cache Miss Violet","#8B5CF6"],["Dirty Line Amber","#F59E0B"]],
    moves: [
      "4x4 grid of rounded squircle memory cache blocks",
      "Real hardware state color-coding (hit, miss, dirty, evicted)",
      "Subtle address bus connecting lines between rows",
      "Instantly connects to course visualizer widgets"
],
    facts: {"Type":"Memory Matrix","Contrast":"High","Readability":"Modular","Metaphor":"Cache Hierarchy"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0D1117"/>
    <!-- 4x4 Memory Block Matrix (Spacing: 110px, Size: 96px, Offset: 260px) -->
    <!-- Row 1 -->
    <rect x="250" y="250" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="380" y="250" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="510" y="250" width="100" height="100" rx="24" fill="#8B5CF6"/>
    <rect x="640" y="250" width="100" height="100" rx="24" fill="#06B6D4"/>
    <!-- Row 2 -->
    <rect x="250" y="380" width="100" height="100" rx="24" fill="#F59E0B"/>
    <rect x="380" y="380" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="510" y="380" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="640" y="380" width="100" height="100" rx="24" fill="#8B5CF6"/>
    <!-- Row 3 -->
    <rect x="250" y="510" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="380" y="510" width="100" height="100" rx="24" fill="#8B5CF6"/>
    <rect x="510" y="510" width="100" height="100" rx="24" fill="#F59E0B"/>
    <rect x="640" y="510" width="100" height="100" rx="24" fill="#06B6D4"/>
    <!-- Row 4 -->
    <rect x="250" y="640" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="380" y="640" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="510" y="640" width="100" height="100" rx="24" fill="#06B6D4"/>
    <rect x="640" y="640" width="100" height="100" rx="24" fill="#FFFFFF"/>
    <!-- Address Bus highlight beam through diagonal -->
    <line x1="250" y1="250" x2="740" y2="740" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="16 12"/>
  `
  });

  add({
    id: "c34_cluster_topology",
    n: 34,
    group: "hardware",
    name: "Cluster Ring Topology",
    tagline: "Icon of Polymath's <ClusterTopology> widget: 8 GPU nodes in tensor ring",
    concept: "Modeled after Polymath's `<ClusterTopology>` component. Depicts an 8-GPU tensor-parallel training ring linked by high-bandwidth NVLink/optical interconnects, with bidirectional communication wavefronts pulsing between compute nodes.",
    palette: [["Obsidian Dark","#0B0E17"],["Node Teal","#00F0FF"],["AllReduce Violet","#8B5CF6"],["Packet Gold","#F59E0B"]],
    moves: [
      "8 compute nodes arranged uniformly around a 360-degree perimeter",
      "Interconnecting chord lines showing all-reduce communication paths",
      "Packet indicators traveling between node pairs",
      "Grounded in distributed training & cluster topology courses"
],
    facts: {"Type":"Topology","Contrast":"High","Readability":"Geometric","Metaphor":"Distributed Systems"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Outer interconnect perimeter ring -->
    <circle cx="512" cy="512" r="320" fill="none" stroke="#1E293B" stroke-width="20"/>
    <!-- All-to-all cross chords -->
    <polygon points="512,192 738,286 832,512 738,738 512,832 286,738 192,512 286,286" fill="none" stroke="#8B5CF6" stroke-width="8" stroke-opacity="0.4"/>
    <line x1="512" y1="192" x2="512" y2="832" stroke="#00F0FF" stroke-width="12" stroke-opacity="0.6"/>
    <line x1="192" y1="512" x2="832" y2="512" stroke="#00F0FF" stroke-width="12" stroke-opacity="0.6"/>
    <!-- 8 Compute Nodes -->
    <circle cx="512" cy="192" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="738" cy="286" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="832" cy="512" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="738" cy="738" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="512" cy="832" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="286" cy="738" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="192" cy="512" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="286" cy="286" r="36" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Active Packet Nodes -->
    <circle cx="625" cy="239" r="16" fill="#F59E0B"/>
    <circle cx="785" cy="399" r="16" fill="#F59E0B"/>
    <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c35_logic_wave_gate",
    n: 35,
    group: "hardware",
    name: "Logic Wave Gate",
    tagline: "Superimposed digital clock signals and analog phase transitions",
    concept: "Combines digital 0/1 clock square waveforms with smooth analog phase transitions. Highlights the hardware runtime layer where high-level course code compiles into electrical clock pulses and bus signals.",
    palette: [["Chamber Dark","#080B12"],["Clock Cyan","#00F0FF"],["Signal Green","#10B981"],["Bus Amber","#F59E0B"]],
    moves: [
      "Stepped square waves with sharp 90-degree transitions",
      "Superimposed sine wave demonstrating DAC conversion",
      "Digital bus timing ruler across the bottom",
      "Pulsing neon CRT oscilloscope screen aesthetic"
],
    facts: {"Type":"Waveform","Contrast":"Maximum","Readability":"Rhythmic","Metaphor":"Hardware Clock"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#080B12"/>
    <!-- Oscilloscope grid lines -->
    <line x1="160" y1="360" x2="864" y2="360" stroke="#1E293B" stroke-width="4"/>
    <line x1="160" y1="512" x2="864" y2="512" stroke="#1E293B" stroke-width="4"/>
    <line x1="160" y1="664" x2="864" y2="664" stroke="#1E293B" stroke-width="4"/>
    <!-- Clock Signal 1 (Green Square Wave) -->
    <path d="M180 420 H280 V300 H380 V420 H480 V300 H580 V420 H680 V300 H780 V420 H844" fill="none" stroke="#10B981" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Data Signal 2 (Cyan Complex Wave) -->
    <path d="M180 620 H340 V500 H540 V620 H680 V500 H844" fill="none" stroke="#00F0FF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M180 620 H340 V500 H540 V620 H680 V500 H844" fill="none" stroke="#00F0FF" stroke-width="50" stroke-opacity="0.3" filter="blur(6px)"/>
    <!-- Clock edge trigger points -->
    <circle cx="280" cy="300" r="16" fill="#F59E0B"/>
    <circle cx="480" cy="300" r="16" fill="#F59E0B"/>
    <circle cx="680" cy="300" r="16" fill="#F59E0B"/>
    <!-- Trigger Crosshair -->
    <circle cx="540" cy="500" r="32" fill="none" stroke="#FFFFFF" stroke-width="6"/>
  `
  });

  add({
    id: "c36_transformer_attention",
    n: 36,
    group: "hardware",
    name: "Attention Matrix Lattice",
    tagline: "Transformer multi-head self-attention query-key heatmap grid",
    concept: "Visualizes the mathematical heart of transformer architecture: the scaled dot-product attention matrix. An isometric grid of attention score squares with highlighted diagonal self-attention weights and cross-attention connection arcs.",
    palette: [["Deep Slate","#0B0F19"],["Attention Cyan","#06B6D4"],["Soft Magenta","#EC4899"],["Key Amber","#F59E0B"]],
    moves: [
      "Isometric perspective attention heatmap matrix",
      "Gradient weight distribution along the matrix diagonal",
      "Curved cross-attention vectors linking token representations",
      "Visual anchor for AI inference courses (vLLM, Transformers)"
],
    facts: {"Type":"Attention Map","Contrast":"High","Readability":"Technical","Metaphor":"Transformer Architecture"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0F19"/>
    <!-- Matrix Outer Border -->
    <rect x="220" y="220" width="584" height="584" rx="40" fill="#111827" stroke="#374151" stroke-width="16"/>
    <!-- Attention Heatmap Cells -->
    <rect x="260" y="260" width="100" height="100" rx="16" fill="#06B6D4"/>
    <rect x="380" y="260" width="100" height="100" rx="16" fill="#0284C7"/>
    <rect x="500" y="260" width="100" height="100" rx="16" fill="#1E293B"/>
    <rect x="620" y="260" width="100" height="100" rx="16" fill="#1E293B"/>

    <rect x="260" y="380" width="100" height="100" rx="16" fill="#0284C7"/>
    <rect x="380" y="380" width="100" height="100" rx="16" fill="#EC4899"/>
    <rect x="500" y="380" width="100" height="100" rx="16" fill="#F59E0B"/>
    <rect x="620" y="380" width="100" height="100" rx="16" fill="#1E293B"/>

    <rect x="260" y="500" width="100" height="100" rx="16" fill="#1E293B"/>
    <rect x="380" y="500" width="100" height="100" rx="16" fill="#F59E0B"/>
    <rect x="500" y="500" width="100" height="100" rx="16" fill="#EC4899"/>
    <rect x="620" y="500" width="100" height="100" rx="16" fill="#06B6D4"/>

    <rect x="260" y="620" width="100" height="100" rx="16" fill="#1E293B"/>
    <rect x="380" y="620" width="100" height="100" rx="16" fill="#1E293B"/>
    <rect x="500" y="620" width="100" height="100" rx="16" fill="#06B6D4"/>
    <rect x="620" y="620" width="100" height="100" rx="16" fill="#FFFFFF"/>
    <!-- Diagonal Attention Ridge line -->
    <line x1="260" y1="260" x2="720" y2="720" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
  `
  });

  add({
    id: "c37_pipeline_dispatcher",
    n: 37,
    group: "hardware",
    name: "Pipeline Dispatcher",
    tagline: "Staggered chevrons for Fetch, Decode, Execute, and Writeback stages",
    concept: "The foundational concept of superscalar CPU design: pipelining. Four overlapping, staggered chevrons represent the sequential execution phases (Fetch, Decode, Execute, Writeback) advancing simultaneously.",
    palette: [["Obsidian Dark","#090D16"],["Fetch Blue","#38BDF8"],["Decode Teal","#06B6D4"],["Execute Green","#10B981"],["Writeback Amber","#F59E0B"]],
    moves: [
      "Four staggered aerodynamic chevrons stacked horizontally",
      "Each stage tinted with an execution phase color",
      "Forward directional velocity and kinetic motion",
      "Signifies fast, non-blocking execution"
],
    facts: {"Type":"Pipeline Chevron","Contrast":"High","Readability":"Dynamic","Metaphor":"Pipelined Execution"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#090D16"/>
    <!-- 4 Staggered Pipeline Chevrons -->
    <!-- Chevron 1: Fetch (Blue) -->
    <path d="M220 280 L420 512 L220 744 H340 L540 512 L340 280 Z" fill="#38BDF8"/>
    <!-- Chevron 2: Decode (Teal) -->
    <path d="M380 280 L580 512 L380 744 H500 L700 512 L500 280 Z" fill="#06B6D4"/>
    <!-- Chevron 3: Execute (Green) -->
    <path d="M540 280 L740 512 L540 744 H660 L860 512 L660 280 Z" fill="#10B981"/>
    <!-- Specular rim along top edge -->
    <path d="M220 280 L420 512 L340 512 L140 280 Z" fill="#FFFFFF" fill-opacity="0.3"/>
    <!-- Dispatch clock marker line -->
    <line x1="220" y1="512" x2="860" y2="512" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="16 12"/>
  `
  });

  add({
    id: "c38_tensor_hypercube",
    n: 38,
    group: "hardware",
    name: "Tensor Hypercube",
    tagline: "Isometric multi-dimensional matrix cube with sliced tensor planes",
    concept: "Tensors are the fundamental data currency of modern machine learning. An isometric 3D cube divided into multi-rank tensor slices, showing cyan, magenta, and amber rank planes intersecting in space.",
    palette: [["Space Slate","#0B0E17"],["Tensor Cyan","#00F0FF"],["Rank Magenta","#EC4899"],["Stride Gold","#FBBF24"]],
    moves: [
      "Isometric 3D tensor lattice with sliced planar faces",
      "Distinct color coding for batch, sequence, and hidden dimensions",
      "Glowing edge coordinates and stride vectors",
      "Instantly establishes ML systems credentials"
],
    facts: {"Type":"Tensor Lattice","Contrast":"High","Readability":"Isometric","Metaphor":"Multi-Rank Tensors"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Isometric Top Face (Batch dimension) -->
    <polygon points="512,180 780,334 512,488 244,334" fill="#00F0FF" stroke="#FFFFFF" stroke-width="12"/>
    <line x1="378" y1="257" x2="646" y2="411" stroke="#FFFFFF" stroke-width="8"/>
    <line x1="512" y1="334" x2="780" y2="334" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Isometric Left Face (Sequence dimension) -->
    <polygon points="244,334 512,488 512,796 244,642" fill="#EC4899" stroke="#FFFFFF" stroke-width="12"/>
    <line x1="244" y1="488" x2="512" y2="642" stroke="#FFFFFF" stroke-width="8"/>
    <line x1="378" y1="411" x2="378" y2="719" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Isometric Right Face (Hidden dimension) -->
    <polygon points="512,488 780,334 780,642 512,796" fill="#FBBF24" stroke="#FFFFFF" stroke-width="12"/>
    <line x1="512" y1="642" x2="780" y2="488" stroke="#FFFFFF" stroke-width="8"/>
    <line x1="646" y1="411" x2="646" y2="719" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Internal tensor core spark -->
    <circle cx="512" cy="488" r="28" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c39_kernel_thread_ring",
    n: 39,
    group: "hardware",
    name: "Warp Scheduler Ring",
    tagline: "SIMT execution ring with 32 active hardware threads and wavefront beacon",
    concept: "GPU compute executes in locked SIMT warps of 32 parallel threads. A micro-circular dial divided into 32 radially arranged thread sectors, with an amber execution wavefront sweeping across the compute cores.",
    palette: [["Obsidian Dark","#080C14"],["Warp Cyan","#38BDF8"],["Wavefront Amber","#F59E0B"],["Lock White","#FFFFFF"]],
    moves: [
      "32 radial micro-segments forming a closed SIMT execution ring",
      "Amber wavefront sweep indicating current instruction counter",
      "Central kernel scheduling core glyph",
      "Perfect synthesis of micro-architecture with clean emblem design"
],
    facts: {"Type":"Thread Ring","Contrast":"High","Readability":"Circular","Metaphor":"SIMT Parallelism"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#080C14"/>
    <!-- Outer warp ring -->
    <circle cx="512" cy="512" r="340" fill="none" stroke="#1E293B" stroke-width="48"/>
    <!-- 8 Primary Thread Quadrant Markers (representing 32 threads) -->
    <circle cx="512" cy="172" r="24" fill="#F59E0B"/>
    <circle cx="752" cy="272" r="20" fill="#38BDF8"/>
    <circle cx="852" cy="512" r="20" fill="#38BDF8"/>
    <circle cx="752" cy="752" r="20" fill="#38BDF8"/>
    <circle cx="512" cy="852" r="20" fill="#38BDF8"/>
    <circle cx="272" cy="752" r="20" fill="#38BDF8"/>
    <circle cx="172" cy="512" r="20" fill="#38BDF8"/>
    <circle cx="272" cy="272" r="20" fill="#38BDF8"/>
    <!-- Sweep wavefront beam -->
    <path d="M512 512 L512 172 A340 340 0 0 1 752 272 Z" fill="#F59E0B" fill-opacity="0.3"/>
    <line x1="512" y1="512" x2="512" y2="172" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
    <!-- Central Kernel Scheduler Core -->
    <circle cx="512" cy="512" r="140" fill="#0F172A" stroke="#38BDF8" stroke-width="16"/>
    <!-- Warp Instruction Glyphs -->
    <rect x="462" y="462" width="100" height="100" rx="24" fill="#38BDF8"/>
    <polygon points="512,482 532,532 492,532" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c40_hbm_stack_die",
    n: 40,
    group: "hardware",
    name: "3D HBM Memory Stack",
    tagline: "Isometric vertical stack of DRAM dies linked by through-silicon vias",
    concept: "High Bandwidth Memory (HBM3) is the critical bottleneck in modern AI systems (featured prominently in Polymath's memory bandwidth chapters). Four vertically stacked DRAM dies connected by glowing vertical through-silicon vias (TSVs).",
    palette: [["Silicon Dark","#0B0E17"],["DRAM Blue","#0284C7"],["TSV Cyan","#00F0FF"],["Interposer Gold","#F59E0B"]],
    moves: [
      "Four stacked isometric silicon dies floating with uniform vertical pitch",
      "Vertical TSV laser pillars penetrating all four layers",
      "Silicon interposer base plate in gold",
      "Substantial physical weight and high-tech stature"
],
    facts: {"Type":"3D Stack","Contrast":"High","Readability":"Volumetric","Metaphor":"High Bandwidth Memory"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Interposer Base Plate (Die 0) -->
    <polygon points="512,680 780,780 512,880 244,780" fill="#F59E0B" stroke="#FDE68A" stroke-width="10"/>
    <!-- DRAM Layer 1 -->
    <polygon points="512,540 760,630 512,720 264,630" fill="#0369A1" stroke="#38BDF8" stroke-width="10"/>
    <!-- DRAM Layer 2 -->
    <polygon points="512,420 760,510 512,600 264,510" fill="#0284C7" stroke="#38BDF8" stroke-width="10"/>
    <!-- DRAM Layer 3 -->
    <polygon points="512,300 760,390 512,480 264,390" fill="#0EA5E9" stroke="#38BDF8" stroke-width="10"/>
    <!-- Top DRAM Layer 4 -->
    <polygon points="512,180 760,270 512,360 264,270" fill="#38BDF8" stroke="#FFFFFF" stroke-width="14"/>
    <!-- Through-Silicon Vias (TSVs) Vertical laser columns -->
    <line x1="380" y1="315" x2="380" y2="790" stroke="#00F0FF" stroke-width="10" stroke-linecap="round"/>
    <line x1="512" y1="360" x2="512" y2="835" stroke="#00F0FF" stroke-width="12" stroke-linecap="round"/>
    <line x1="644" y1="315" x2="644" y2="790" stroke="#00F0FF" stroke-width="10" stroke-linecap="round"/>
    <!-- Top layer circuit traces -->
    <circle cx="512" cy="270" r="28" fill="#FFFFFF"/>
    <circle cx="380" cy="270" r="16" fill="#00F0FF"/>
    <circle cx="644" cy="270" r="16" fill="#00F0FF"/>
  `
  });

  add({
    id: "c41_overlapping_lenses",
    n: 41,
    group: "minimalist",
    name: "Intersecting Orbital Lenses",
    tagline: "Two overlapping circular lenses forming an illuminated vesica piscis",
    concept: "Pure geometric minimalism. Two large overlapping circular rings—one representing human intuition, the other artificial intelligence—intersecting to create a brilliant cyan-white vesica piscis almond of synthesized insight.",
    palette: [["Deep Obsidian","#080B12"],["Left Lens Cyan","#06B6D4"],["Right Lens Violet","#8B5CF6"],["Intersection White","#FFFFFF"]],
    moves: [
      "Two overlapping circular outlines with precise mathematical intersection",
      "Multiplied luminous fill inside the vesica piscis core",
      "Ultra-clean Swiss modern silhouette",
      "Scales down flawlessly to a 16px favicon"
],
    facts: {"Type":"Minimalist Geometry","Contrast":"Very High","Readability":"Instant","Metaphor":"Human-AI Synergy"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#080B12"/>
    <!-- Left orbital circle (Human) -->
    <circle cx="430" cy="512" r="260" fill="none" stroke="#06B6D4" stroke-width="36"/>
    <!-- Right orbital circle (Agent) -->
    <circle cx="594" cy="512" r="260" fill="none" stroke="#8B5CF6" stroke-width="36"/>
    <!-- Center Vesica Piscis (Overlap almond) -->
    <path d="M512 288 C600 360, 640 440, 640 512 C640 584, 600 664, 512 736 C424 664, 384 584, 384 512 C384 440, 424 360, 512 288 Z" fill="#FFFFFF" fill-opacity="0.9"/>
    <!-- Core diamond node -->
    <polygon points="512,460 540,512 512,564 484,512" fill="#080B12"/>
  `
  });

  add({
    id: "c42_hyperbolic_paraboloid",
    n: 42,
    group: "minimalist",
    name: "Ruled Surface Saddle",
    tagline: "Hyperbolic paraboloid constructed entirely of straight gradient string lines",
    concept: "A mathematical wonder: a doubly-ruled surface where every point lies on two distinct straight lines, yet together they produce a magnificent sweeping 3D saddle curve. Represents complex knowledge arising from simple linear rules.",
    palette: [["Obsidian Dark","#090D16"],["Warp Cyan","#00F0FF"],["Weft Violet","#A855F7"],["Horizon Gold","#F59E0B"]],
    moves: [
      "Straight vector chords strung between dual boundary curves",
      "Continuous gradient color transition along the chord sweep",
      "Apparent 3D curvature generated solely through 2D lines",
      "Hypnotic mathematical elegance"
],
    facts: {"Type":"Ruled Surface","Contrast":"High","Readability":"Intricate","Metaphor":"Emergent Complexity"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#090D16"/>
    <!-- Outer boundary frame box -->
    <rect x="220" y="220" width="584" height="584" rx="40" fill="none" stroke="#1E293B" stroke-width="12"/>
    <!-- String art ruled lines (Family 1: Top-Left to Bottom-Right) -->
    <line x1="220" y1="220" x2="804" y2="804" stroke="#00F0FF" stroke-width="6"/>
    <line x1="280" y1="220" x2="804" y2="744" stroke="#06B6D4" stroke-width="6"/>
    <line x1="340" y1="220" x2="804" y2="684" stroke="#0284C7" stroke-width="6"/>
    <line x1="400" y1="220" x2="804" y2="624" stroke="#3B82F6" stroke-width="6"/>
    <line x1="460" y1="220" x2="804" y2="564" stroke="#6366F1" stroke-width="6"/>
    <line x1="520" y1="220" x2="804" y2="504" stroke="#8B5CF6" stroke-width="6"/>
    <line x1="580" y1="220" x2="804" y2="444" stroke="#A855F7" stroke-width="6"/>
    <line x1="640" y1="220" x2="804" y2="384" stroke="#D946EF" stroke-width="6"/>
    <line x1="700" y1="220" x2="804" y2="324" stroke="#EC4899" stroke-width="6"/>

    <line x1="220" y1="280" x2="744" y2="804" stroke="#06B6D4" stroke-width="6"/>
    <line x1="220" y1="340" x2="684" y2="804" stroke="#0284C7" stroke-width="6"/>
    <line x1="220" y1="400" x2="624" y2="804" stroke="#3B82F6" stroke-width="6"/>
    <line x1="220" y1="460" x2="564" y2="804" stroke="#6366F1" stroke-width="6"/>
    <line x1="220" y1="520" x2="504" y2="804" stroke="#8B5CF6" stroke-width="6"/>
    <line x1="220" y1="580" x2="444" y2="804" stroke="#A855F7" stroke-width="6"/>
    <line x1="220" y1="640" x2="384" y2="804" stroke="#D946EF" stroke-width="6"/>
    <line x1="220" y1="700" x2="324" y2="804" stroke="#EC4899" stroke-width="6"/>
    <!-- Saddle focal center node -->
    <circle cx="512" cy="512" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="6"/>
  `
  });

  add({
    id: "c43_aurora_gradient_badge",
    n: 43,
    group: "minimalist",
    name: "Obsidian Aurora Slice",
    tagline: "Ultra-dark obsidian tile bisected by a dynamic fluid light ribbon",
    concept: "Minimalist luxury aesthetic. A deep satin obsidian squircle is dynamically sliced by an angled fluid neon wave that transitions from radiant cyan to emerald green and violet, inspired by solar particle curtains.",
    palette: [["Obsidian Satin","#0A0D14"],["Aurora Teal","#06B6D4"],["Emerald Beam","#10B981"],["Plasma Violet","#8B5CF6"]],
    moves: [
      "Diagonal wave slice breaking across the squircle face",
      "Multi-stop atmospheric aurora gradient",
      "High-contrast satin dark background",
      "Pops dramatically against dark and light macOS wallpapers"
],
    facts: {"Type":"Fluid Gradient","Contrast":"Maximum","Readability":"Fluid","Metaphor":"Solar Illumination"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0A0D14"/>
    <!-- Aurora Ribbon Ambient Bloom -->
    <path d="M120 780 C320 680, 480 340, 720 240 C840 190, 920 220, 920 220" stroke="#06B6D4" stroke-width="180" stroke-opacity="0.25" fill="none" filter="blur(20px)"/>
    <!-- Main Aurora Wave Ribbon -->
    <path d="M120 800 C360 740, 480 380, 720 260 C840 200, 940 240, 940 240" stroke="#06B6D4" stroke-width="72" stroke-linecap="round" fill="none"/>
    <!-- Secondary Emerald Strand -->
    <path d="M140 840 C380 780, 460 420, 680 300 C800 240, 920 260, 920 260" stroke="#10B981" stroke-width="48" stroke-linecap="round" fill="none"/>
    <!-- Core Laser Filament -->
    <path d="M120 800 C360 740, 480 380, 720 260 C840 200, 940 240, 940 240" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" fill="none" opacity="0.9"/>
    <!-- Floating Spark Points -->
    <circle cx="720" cy="260" r="22" fill="#FFFFFF"/>
    <circle cx="480" cy="520" r="16" fill="#8B5CF6"/>
  `
  });

  add({
    id: "c44_stark_monochrome_seal",
    n: 44,
    group: "minimalist",
    name: "Brutalist Monomark",
    tagline: "Stark surgical white geometric glyph on deep abyss black",
    concept: "Pure, uncompromising graphic reduction. Uses only binary high-contrast black and surgical white. A solid triangle, circle, and square intersect to spell a stylized abstract 'P' with unmatched visual punch across all sizes.",
    palette: [["Abyss Black","#000000"],["Surgical White","#FFFFFF"]],
    moves: [
      "Zero colors; 100% binary contrast",
      "Intersection of Euclidean primary shapes (triangle, circle, square)",
      "Maximum legibility from 1024px down to 12px",
      "Uncompromising modernist authority"
],
    facts: {"Type":"Brutalist Monochrome","Contrast":"Maximum (100%)","Readability":"Extreme","Metaphor":"Binary Truth"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#000000"/>
    <!-- Heavy Solid White Vertical Column -->
    <rect x="240" y="220" width="140" height="584" rx="48" fill="#FFFFFF"/>
    <!-- Solid White Circle Bowl -->
    <circle cx="560" cy="420" r="200" fill="#FFFFFF"/>
    <circle cx="560" cy="420" r="90" fill="#000000"/>
    <!-- Intersecting Inverted Solid Triangle -->
    <polygon points="560,420 760,420 660,590" fill="#000000"/>
  `
  });

  add({
    id: "c45_eclipse_corona",
    n: 45,
    group: "minimalist",
    name: "Solar Corona Eclipse",
    tagline: "Total eclipse occluding a brilliant cyan-gold plasma magnetic halo",
    concept: "A total eclipse event where a dark core disc blocks the central body, revealing the majestic solar corona flares radiating outwards in cyan and solar gold. Represents hidden brilliance illuminated during deep study.",
    palette: [["Space Void","#05070D"],["Corona Cyan","#00F0FF"],["Plasma Gold","#F59E0B"],["Solar Core","#0A0F1D"]],
    moves: [
      "Dark central eclipse disc creating dramatic negative space",
      "Asymmetric magnetic corona flare arcs",
      "Dual cyan and solar gold high-temperature plasma rings",
      "Magnetic field line tendrils looping into the void"
],
    facts: {"Type":"Astrophysical","Contrast":"Maximum","Readability":"Dramatic","Metaphor":"Revealed Brilliance"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#05070D"/>
    <!-- Corona Diffuse Plasma Burst -->
    <circle cx="512" cy="512" r="340" fill="#00F0FF" fill-opacity="0.15" filter="blur(24px)"/>
    <!-- Magnetic Field Loops (Gold and Cyan Arcs) -->
    <path d="M300 300 C400 140, 624 140, 724 300" stroke="#F59E0B" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M724 724 C624 884, 400 884, 300 724" stroke="#00F0FF" stroke-width="16" fill="none" stroke-linecap="round"/>
    <!-- Prominence flare jet -->
    <path d="M720 420 Q880 400 820 540" stroke="#F59E0B" stroke-width="20" fill="none" stroke-linecap="round"/>
    <!-- Brilliant Plasma Ring Edge -->
    <circle cx="512" cy="512" r="260" fill="none" stroke="#FFFFFF" stroke-width="18"/>
    <!-- Dark Eclipse Disc Body -->
    <circle cx="512" cy="512" r="250" fill="#0A0F1D"/>
    <!-- Diamond Ring Flash -->
    <circle cx="680" cy="340" r="32" fill="#FFFFFF"/>
    <polygon points="680,290 690,340 730,340 695,355 710,390 680,365 650,390 665,355 630,340 670,340" fill="#00F0FF"/>
  `
  });

  add({
    id: "c46_kinetic_delta",
    n: 46,
    group: "minimalist",
    name: "Kinetic Tri-Blade Delta",
    tagline: "Three overlapping rotational blades forming a central aperture of focus",
    concept: "Three aerodynamic triangular blades rotating around a central hub, forming a tri-color aperture of focused knowledge. Echoes camera apertures, jet turbine impellers, and rotational symmetry.",
    palette: [["Carbon Dark","#0B0E17"],["Blade Cyan","#06B6D4"],["Blade Violet","#8B5CF6"],["Blade Amber","#F59E0B"]],
    moves: [
      "120-degree rotational symmetry with three overlapping blades",
      "Each blade rendered in a clean primary project hue",
      "Negative-space equilateral triangle at the center aperture",
      "Dynamic sense of continuous momentum"
],
    facts: {"Type":"Rotational Delta","Contrast":"High","Readability":"Balanced","Metaphor":"Focused Aperture"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E17"/>
    <!-- Outer guide ring -->
    <circle cx="512" cy="512" r="360" fill="none" stroke="#1E293B" stroke-width="12"/>
    <!-- Blade 1: Cyan (Top) -->
    <polygon points="512,180 680,480 440,480" fill="#06B6D4" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Blade 2: Violet (Bottom-Right) -->
    <polygon points="760,660 480,660 620,440" fill="#8B5CF6" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Blade 3: Amber (Bottom-Left) -->
    <polygon points="264,660 404,440 544,660" fill="#F59E0B" stroke="#FFFFFF" stroke-width="8"/>
    <!-- Center aperture triangle cutout (White) -->
    <polygon points="512,460 550,530 474,530" fill="#FFFFFF"/>
    <!-- Perimeter vortex dots -->
    <circle cx="512" cy="180" r="16" fill="#06B6D4"/>
    <circle cx="760" cy="660" r="16" fill="#8B5CF6"/>
    <circle cx="264" cy="660" r="16" fill="#F59E0B"/>
  `
  });

  add({
    id: "c47_isometric_glyph_trio",
    n: 47,
    group: "minimalist",
    name: "Ascending Step Triad",
    tagline: "Three floating isometric platforms representing Learn, Code, and Master",
    concept: "Three ascending geometric platforms hovering in 3D isometric space. Represents the three progressive tiers of the Polymath learning runtime: Foundations (Learn), Hardware Execution (Code), and Agentic Creation (Master).",
    palette: [["Space Slate","#0F172A"],["Step 1 Cyan","#38BDF8"],["Step 2 Violet","#8B5CF6"],["Step 3 Gold","#F59E0B"]],
    moves: [
      "Three stepped isometric rhomboid platforms ascending left to right",
      "Translucent vertical extrusion risers",
      "Golden summit beacon on the highest platform",
      "Clean architectural representation of progressive achievement"
],
    facts: {"Type":"Isometric Steps","Contrast":"High","Readability":"Clean","Metaphor":"Progressive Mastery"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0F172A"/>
    <!-- Step 1: Base Platform (Cyan) -->
    <polygon points="300,560 440,480 440,540 300,620" fill="#0284C7"/>
    <polygon points="440,480 580,560 580,620 440,540" fill="#0369A1"/>
    <polygon points="300,560 440,480 580,560 440,640" fill="#38BDF8" stroke="#FFFFFF" stroke-width="8"/>

    <!-- Step 2: Mid Platform (Violet) -->
    <polygon points="440,420 580,340 580,400 440,480" fill="#7C3AED"/>
    <polygon points="580,340 720,420 720,480 580,400" fill="#6D28D9"/>
    <polygon points="440,420 580,340 720,420 580,500" fill="#A855F7" stroke="#FFFFFF" stroke-width="8"/>

    <!-- Step 3: Top Platform (Gold) -->
    <polygon points="580,280 720,200 720,260 580,340" fill="#D97706"/>
    <polygon points="720,200 860,280 860,340 720,260" fill="#B45309"/>
    <polygon points="580,280 720,200 860,280 720,360" fill="#FBBF24" stroke="#FFFFFF" stroke-width="8"/>

    <!-- Top Summit Beacon Spark -->
    <circle cx="720" cy="200" r="28" fill="#FFFFFF"/>
    <line x1="720" y1="140" x2="720" y2="260" stroke="#FFFFFF" stroke-width="8"/>
    <line x1="660" y1="200" x2="780" y2="200" stroke="#FFFFFF" stroke-width="8"/>
  `
  });

  add({
    id: "c48_prismatic_hexagon",
    n: 48,
    group: "minimalist",
    name: "Honeycomb Isometric Cube",
    tagline: "Precision 3D cube tile with 3 refractive shaded faces in cyan, sapphire, and violet",
    concept: "The quintessential tech isometric cube refined to jewel-like perfection. Three visible rhombus faces rendered in electric cyan, deep sapphire, and vibrant violet, creating the optical illusion of either an extruded block or an open cubic room.",
    palette: [["Deep Slate","#0B0F19"],["Top Cyan","#38BDF8"],["Left Sapphire","#0284C7"],["Right Violet","#8B5CF6"]],
    moves: [
      "Perfect 120-degree isometric rhombuses",
      "High-contrast face shading for unmistakable 3D depth",
      "Gleaming white perimeter border and apex vertices",
      "Simple, powerful, and universally legible"
],
    facts: {"Type":"Isometric Cube","Contrast":"Very High","Readability":"Instant","Metaphor":"Building Block"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0F19"/>
    <!-- Top Face (Cyan) -->
    <polygon points="512,200 780,355 512,510 244,355" fill="#38BDF8" stroke="#FFFFFF" stroke-width="12"/>
    <!-- Left Face (Sapphire) -->
    <polygon points="244,355 512,510 512,820 244,665" fill="#0284C7" stroke="#FFFFFF" stroke-width="12"/>
    <!-- Right Face (Violet) -->
    <polygon points="512,510 780,355 780,665 512,820" fill="#8B5CF6" stroke="#FFFFFF" stroke-width="12"/>
    <!-- Center Apex Intersection Spark -->
    <circle cx="512" cy="510" r="24" fill="#FFFFFF"/>
    <!-- Vertex Corner Dots -->
    <circle cx="512" cy="200" r="14" fill="#FFFFFF"/>
    <circle cx="780" cy="355" r="14" fill="#FFFFFF"/>
    <circle cx="780" cy="665" r="14" fill="#FFFFFF"/>
    <circle cx="512" cy="820" r="14" fill="#FFFFFF"/>
    <circle cx="244" cy="665" r="14" fill="#FFFFFF"/>
    <circle cx="244" cy="355" r="14" fill="#FFFFFF"/>
  `
  });

  add({
    id: "c49_quantum_point_matrix",
    n: 49,
    group: "minimalist",
    name: "Constellation Point Lattice",
    tagline: "Stellar constellation of glowing data nodes connected by fine silver vectors",
    concept: "Visualizes polymathy as connecting distant, seemingly unrelated points of knowledge into a recognizable constellation. A matrix of glowing cyan and amber nodes interconnected by gossamer vector threads.",
    palette: [["Cosmic Black","#050811"],["Node Cyan","#00F0FF"],["Node Amber","#F59E0B"],["Thread Silver","#E2E8F0"]],
    moves: [
      "Asymmetric constellation network with golden proportion spacing",
      "Varying node radii signifying primary and secondary concepts",
      "Gleaming multi-hop connection paths",
      "Poetic celestial aesthetic"
],
    facts: {"Type":"Constellation","Contrast":"High","Readability":"Delicate","Metaphor":"Connecting the Dots"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#050811"/>
    <!-- Connecting Silver Vector Threads -->
    <line x1="512" y1="220" x2="740" y2="380" stroke="#94A3B8" stroke-width="8"/>
    <line x1="740" y1="380" x2="820" y2="640" stroke="#94A3B8" stroke-width="8"/>
    <line x1="820" y1="640" x2="580" y2="800" stroke="#94A3B8" stroke-width="8"/>
    <line x1="580" y1="800" x2="320" y2="720" stroke="#94A3B8" stroke-width="8"/>
    <line x1="320" y1="720" x2="240" y2="440" stroke="#94A3B8" stroke-width="8"/>
    <line x1="240" y1="440" x2="512" y2="220" stroke="#94A3B8" stroke-width="8"/>
    <!-- Internal cross-chords -->
    <line x1="512" y1="220" x2="512" y2="512" stroke="#00F0FF" stroke-width="12"/>
    <line x1="740" y1="380" x2="512" y2="512" stroke="#00F0FF" stroke-width="12"/>
    <line x1="820" y1="640" x2="512" y2="512" stroke="#00F0FF" stroke-width="12"/>
    <line x1="580" y1="800" x2="512" y2="512" stroke="#00F0FF" stroke-width="12"/>
    <line x1="320" y1="720" x2="512" y2="512" stroke="#00F0FF" stroke-width="12"/>
    <line x1="240" y1="440" x2="512" y2="512" stroke="#00F0FF" stroke-width="12"/>
    <!-- Constellation Nodes -->
    <circle cx="512" cy="220" r="32" fill="#00F0FF" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="740" cy="380" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="820" cy="640" r="24" fill="#00F0FF"/>
    <circle cx="580" cy="800" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="320" cy="720" r="24" fill="#00F0FF"/>
    <circle cx="240" cy="440" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="6"/>
    <!-- Core Hub Node -->
    <circle cx="512" cy="512" r="48" fill="#FFFFFF"/>
    <circle cx="512" cy="512" r="72" stroke="#00F0FF" stroke-width="8" fill="none" opacity="0.6"/>
  `
  });

  add({
    id: "c50_nordic_circuit_rune",
    n: 50,
    group: "minimalist",
    name: "Cyber-Runestone",
    tagline: "Ancient algorithmic bindrune carved with glowing neon copper circuit traces",
    concept: "Combines the timeless mystery of ancient Nordic / Germanic bindrunes with high-speed copper circuit lithography. A central vertical stave intersected by acute diagonal glyph branches that terminate in circuit solder pads.",
    palette: [["Obsidian Slab","#0B0E14"],["Neon Copper","#F59E0B"],["Litho Cyan","#00F0FF"],["Runic White","#FFFFFF"]],
    moves: [
      "Symmetric runic spine with interlocking chevron branches",
      "PCB circuit via pads terminating every branch node",
      "Carved chisel bevel depth on the main vertical axis",
      "Rich intersection of ancient heritage and futuristic code"
],
    facts: {"Type":"Runic Circuit","Contrast":"High","Readability":"Sacred","Metaphor":"Ancient Algorithm"},
    draw: ({ mode, uid }) => `
    <rect width="1024" height="1024" rx="224" fill="#0B0E14"/>
    <!-- Central Runic Vertical Spine -->
    <line x1="512" y1="180" x2="512" y2="844" stroke="#F59E0B" stroke-width="36" stroke-linecap="round"/>
    <line x1="512" y1="180" x2="512" y2="844" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
    <!-- Upper Diamond (Ingwaz rune geometry) -->
    <polygon points="512,240 680,380 512,520 344,380" fill="none" stroke="#00F0FF" stroke-width="24" stroke-linejoin="round"/>
    <!-- Lower Inverted Chevrons -->
    <path d="M344 640 L512 760 L680 640" fill="none" stroke="#00F0FF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Circuit Solder Via Pads -->
    <circle cx="512" cy="180" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="512" cy="844" r="28" fill="#F59E0B" stroke="#FFFFFF" stroke-width="8"/>
    <circle cx="680" cy="380" r="22" fill="#00F0FF" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="344" cy="380" r="22" fill="#00F0FF" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="344" cy="640" r="22" fill="#00F0FF" stroke="#FFFFFF" stroke-width="6"/>
    <circle cx="680" cy="640" r="22" fill="#00F0FF" stroke="#FFFFFF" stroke-width="6"/>
    <!-- Core Runic Center Eye -->
    <circle cx="512" cy="380" r="28" fill="#FFFFFF"/>
  `
  });

  // ══════════════════════════════════════════════════════════════════
  // REVIEW CONFIGURATION
  // ══════════════════════════════════════════════════════════════════
  window.REVIEW = {
    key: "2026-10-27-polymath-logo-redesign-v1",
    dir: "reports/2026-10-27-polymath-logo-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8819,
    project: "projects/polymath",
    context: [
      "projects/polymath/CLAUDE.md",
      "projects/polymath/docs/public/favicon.svg",
      "projects/polymath/apps/desktop/src-tauri/icons",
      "projects/polymath/services/web/index.html"
    ],
    brief: "Propose 50 logo and app icon redesigns for Polymath spanning 5 rich conceptual groups: Geometric Polyhedra & Prisms, Architectural & Bauhaus 'P' Monograms, Agent & Renaissance Synergy, Hardware & Runtime Visualizers, and Modern Minimalist Systems, tested across macOS Dock, iOS, Android, size ladder (128px to 16px favicon), and dark/light modes.",
    title: "Polymath · Logo & App Icon Redesign",
    subtitle: "50 candidates across 5 thematic directions + baseline",
    heading: "Pick a direction for Polymath's logo & app icon",
    intro: "Review <b>50 new icon candidates</b> for Polymath across five distinct axes: Da Vinci polyhedra, engineered 'P' monograms, Renaissance-agent synthesis, hardware runtime widgets, and modern minimalist marks. Each is previewed in full detail with <b>macOS Dock context</b>, platform squircles/circles, size ladders down to 16px favicon, and dark/light themes.",
    legend: ["<b>50</b> candidates", "<b>5</b> thematic groups", "<b>macOS Dock</b> ready", "Pick your favorites"],
    round: 1,
    frame: "icon",
    size: [400, 400],
    groups: [
      {
        id: "polyhedra",
        name: "Part 1 · Geometric Polyhedra & Prisms (01–10)",
        note: "Multifaceted Da Vinci crystals, refraction prisms, tesseracts, and isometric solids representing polymathic knowledge"
      },
      {
        id: "monogram",
        name: "Part 2 · Architectural & Bauhaus 'P' Monograms (11–20)",
        note: "Precision-engineered 'P' letterforms: Möbius loops, terminal chevron prompts, golden ratios, and constructivist geometry"
      },
      {
        id: "renaissance",
        name: "Part 3 · Agent & Renaissance Synergy (21–30)",
        note: "The synthesis of coding agents and renaissance inquiry: Cyber-astrolabes, neural codices, Vitruvian networks, and armillary spheres"
      },
      {
        id: "hardware",
        name: "Part 4 · Hardware, Memory & Runtime Visualizers (31–40)",
        note: "Grounded in Polymath's interactive course widgets: Roofline curves, silicon wafer dies, cache matrices, and attention lattices"
      },
      {
        id: "minimalist",
        name: "Part 5 · Modern Minimalist & Radiant Systems (41–50)",
        note: "Swiss modernism, orbital lens vesicas, hyperbolic paraboloids, aurora badges, and high-contrast brutalist monomarks"
      }
    ],
    candidates: C
  };
})();
