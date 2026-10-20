// The current logo (baseline) + 20 scrapbook-style candidates. Each render(c) draws a full-bleed
// 1024×1024 icon; the frames (squircle, circle, macOS body, favicon tile) are applied by LG.icon.
window.LG = window.LG || {};

(() => {
  const { bg, tape, tapeLine, pin, polaroid, scene, shadow, mix, hills, rough } = LG;
  const L = [];
  const add = (d) => L.push(d);
  const CAVEAT = `font-family="Caveat, cursive" font-weight="700"`;

  // ───────────── 0 · current
  add({
    id: "current", n: 0, name: "Current logo", baseline: true, word: "Inter",
    tagline: "Blue folded-map “W” with a pin (v1.0–1.2)",
    concept: "A white map pin dropped on a folded map whose four panels zigzag into a W, on a bright blue gradient. Clear and legible, but it's the only blue thing left in the app: since the scrapbook redesign every screen is kraft paper, coral and washi tape.",
    palette: [["Blue", "#2F86FF"], ["Deep blue", "#1452C2"], ["Fold", "#B9D3FF"], ["White", "#FFFFFF"]],
    moves: [],
    render: (c) => {
      const g = c.id("g");
      c.defs += `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.mode === "dark" ? "#1F3E78" : "#2f86ff"}"/><stop offset="1" stop-color="${c.mode === "dark" ? "#0D1F45" : "#1452c2"}"/></linearGradient>`;
      const x0 = 200, w = 156, hi = 478, lo = 558, h = 292, xs = [0, 1, 2, 3, 4].map((i) => x0 + i * w), ys = [hi, lo, hi, lo, hi];
      const panels = [0, 1, 2, 3].map((i) => `<polygon points="${xs[i]},${ys[i]} ${xs[i + 1]},${ys[i + 1]} ${xs[i + 1]},${ys[i + 1] + h} ${xs[i]},${ys[i] + h}" fill="${i % 2 ? "#b9d3ff" : "#fff"}"/>`).join("");
      return `<rect width="1024" height="1024" fill="url(#${g})"/>${panels}${pin(512, 270, 104, "#fff")}`;
    },
  });

  // ───────────── 1 · Taped polaroid
  add({
    id: "polaroid", n: 1, name: "Taped polaroid", word: "Caveat",
    tagline: "A tilted polaroid of the trip landscape, taped to kraft paper",
    concept: "The home screen's own object, as the icon: one polaroid of the app's drawn landscape (sun and two hills in coral), tilted and held on with a strip of washi tape, on dotted kraft. Instantly connects the icon to the first screen you see.",
    palette: [["Kraft", "#F3EADB"], ["Paper", "#FFFDF8"], ["Coral", "#D9694F"], ["Washi pink", "#F2A28B"]],
    moves: ["Same scene painter as trip covers", "Washi tape on top", "Tilt −6°"],
    render: (c) => bg(c, c.p.kraft) + polaroid(c, 512, 540, 640, -6, (x, y, w, h) => scene(c, x, y, w, h, "#D9694F")) + tape(c, 500, 238, 300, 76, -8, c.p.pink),
  });

  // ───────────── 2 · Washi W
  add({
    id: "washi", n: 2, name: "Washi W", word: "Caveat",
    tagline: "The letter W built from four strips of washi tape",
    concept: "A monogram made of the scrapbook's most recognisable material: four overlapping strips of striped washi tape (pink, mint, yellow, pink) zigzag into a W on kraft. Playful, very readable at small sizes, and unlike anything else on a home screen.",
    palette: [["Kraft", "#F3EADB"], ["Pink", "#F2A28B"], ["Mint", "#A9D3C0"], ["Yellow", "#F3D27A"]],
    moves: ["Strips overlap like real tape", "Torn ends", "No pin: the W carries the brand"],
    render: (c) => {
      const pts = [[190, 260], [350, 790], [512, 400], [674, 790], [834, 260]];
      const cols = [c.p.pink, c.p.mint, c.p.yellow, c.p.pink];
      return bg(c, c.p.kraft) + cols.map((col, i) => tapeLine(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 150, col)).join("");
    },
  });

  // ───────────── 3 · Paper pin
  add({
    id: "paperpin", n: 3, name: "Paper pin", word: "Caveat",
    tagline: "A coral map pin cut from paper, taped down with mint washi",
    concept: "Keeps today's pin, but makes it a craft object: cut from coral paper (soft shadow, slightly lifted), with a mint tape strip holding the head down. The hole shows the kraft underneath. The most direct evolution of the current mark.",
    palette: [["Kraft", "#F3EADB"], ["Coral", "#D9694F"], ["Mint tape", "#A9D3C0"]],
    moves: ["Pin is paper, not vector", "Tape diagonally across the head", "Kraft shows through the hole"],
    render: (c) => bg(c, c.p.kraft) + pin(512, 400, 230, c.p.coral, 0.36, shadow(c, 16, 14, 0.3)) + tape(c, 430, 230, 290, 88, -28, c.p.mint),
  });

  // ───────────── 4 · Sunny polaroid
  add({
    id: "sunny", n: 4, name: "Sunny polaroid", word: "Caveat",
    tagline: "A white polaroid on a solid coral tile, yellow tape",
    concept: "Same polaroid idea as #1 but on a solid coral background, so it pops on any wallpaper and reads as ‘the coral app’. The photo uses a warm mustard sky so the scene doesn't disappear into the coral.",
    palette: [["Coral", "#D9694F"], ["Paper", "#FFFDF8"], ["Mustard", "#D99A2B"], ["Yellow tape", "#F3D27A"]],
    moves: ["Solid coral field (strong on dark wallpapers)", "Mustard scene for contrast", "Tilt +5°"],
    render: (c) => `<rect width="1024" height="1024" fill="${c.p.coral}"/>` + polaroid(c, 512, 540, 640, 5, (x, y, w, h) => scene(c, x, y, w, h, "#D99A2B")) + tape(c, 520, 232, 280, 74, 4, c.p.yellow),
  });

  // ───────────── 5 · Handwritten W
  add({
    id: "handw", n: 5, name: "Handwritten W", word: "Caveat",
    tagline: "A big Caveat “W” in pencil ink, with a coral pin on the middle peak",
    concept: "The handwriting from the screen titles becomes the mark: one large Caveat W in dark pencil ink on kraft, with a small coral pin standing on its middle peak like a ‘you are here’. Warm, personal, and the letterform ties to the in-app titles.",
    palette: [["Kraft", "#F3EADB"], ["Pencil", "#4A3F35"], ["Coral", "#D9694F"]],
    moves: ["Caveat 700 W, outlined for production", "Coral pin on the middle stroke"],
    render: (c) => bg(c, c.p.kraft) + `<text x="512" y="790" text-anchor="middle" ${CAVEAT} font-size="760" fill="${c.p.ink}">W</text>` + pin(512, 250, 92, c.p.coral, 0.4),
  });

  // ───────────── 6 · Kraft fold
  add({
    id: "kraftfold", n: 6, name: "Kraft folded map", word: "Inter",
    tagline: "Today's folded-map W + pin, recoloured into the scrapbook palette",
    concept: "Lowest-risk option: keep the exact geometry people already know (folded map zigzagging into a W, pin on the middle fold) and only change the colours: paper and kraft panels on coral, cream pin. Recognisable to existing users, matches the app.",
    palette: [["Coral", "#D9694F"], ["Paper", "#FFFDF8"], ["Kraft fold", "#EAD9BF"]],
    moves: ["Same shapes as v1.x", "Coral field, paper panels", "Easiest to roll out"],
    render: (c) => {
      const x0 = 200, w = 156, hi = 478, lo = 558, h = 292, xs = [0, 1, 2, 3, 4].map((i) => x0 + i * w), ys = [hi, lo, hi, lo, hi];
      const panels = [0, 1, 2, 3].map((i) => `<polygon points="${xs[i]},${ys[i]} ${xs[i + 1]},${ys[i + 1]} ${xs[i + 1]},${ys[i + 1] + h} ${xs[i]},${ys[i] + h}" fill="${i % 2 ? "#EAD9BF" : "#FFFDF8"}"/>`).join("");
      return `<rect width="1024" height="1024" fill="${c.p.coral}"/>${panels}${pin(512, 270, 104, "#FFFDF8")}`;
    },
  });

  // ───────────── 7 · Postage stamp
  add({
    id: "stamp", n: 7, name: "Postage stamp", word: "Caveat",
    tagline: "A perforated stamp with the landscape and a tiny pin",
    concept: "Travel mail: a white perforated postage stamp showing the drawn landscape with a white pin, tilted on kraft. The perforated edge is a strong silhouette even at 29pt.",
    palette: [["Kraft", "#F3EADB"], ["Paper", "#FFFDF8"], ["Coral", "#D9694F"]],
    moves: ["Real perforations (cut-out circles)", "Scene + pin inside", "Tilt −4°"],
    render: (c) => {
      const s = 640, x = -s / 2, y = -s * 0.56, w = s, h = s * 1.12, r = 22, holes = [];
      for (let i = 0; i <= 10; i++) { holes.push([x + (w * i) / 10, y], [x + (w * i) / 10, y + h]); }
      for (let i = 1; i < 11; i++) { holes.push([x, y + (h * i) / 11], [x + w, y + (h * i) / 11]); }
      const m = c.id("perf");
      c.defs += `<mask id="${m}"><rect x="${x - 40}" y="${y - 40}" width="${w + 80}" height="${h + 80}" fill="#fff"/>${holes.map(([a, b]) => `<circle cx="${a}" cy="${b}" r="${r}" fill="#000"/>`).join("")}</mask>`;
      return bg(c, c.p.kraft) + `<g transform="translate(512 520) rotate(-4)"><g ${shadow(c, 10, 12, 0.25)}><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFDF8" mask="url(#${m})"/></g>${scene(c, x + 60, y + 60, w - 120, h - 120, "#D9694F")}${pin(0, y + 250, 70, "#FFFDF8", 0.42)}</g>`;
    },
  });

  // ───────────── 8 · Luggage tag
  add({
    id: "tag", n: 8, name: "Luggage tag", word: "Caveat",
    tagline: "A kraft luggage tag with a handwritten W, on coral",
    concept: "Packing for the trip: a kraft-paper luggage tag with a reinforced string hole and a handwritten W, hanging slightly askew on a coral field. ‘Way-pack’ in one object.",
    palette: [["Coral", "#D9694F"], ["Kraft tag", "#E9D6B4"], ["Pencil", "#4A3F35"]],
    moves: ["Tag silhouette with clipped corners", "String loop over the top", "Handwritten W"],
    render: (c) => {
      const tag = "M-230 -260 L230 -260 L230 330 L-230 330 L-230 -260 Z", top = "M-230 -260 L-110 -380 L110 -380 L230 -260 Z";
      return `<rect width="1024" height="1024" fill="${c.p.coral}"/><path d="M512 70 C 460 180 470 230 500 250" stroke="#FFFDF8" stroke-width="16" fill="none" stroke-linecap="round"/>` +
        `<g transform="translate(512 600) rotate(8)"><g ${shadow(c, 14, 14, 0.3)}><path d="${tag}" fill="#E9D6B4"/><path d="${top}" fill="#E9D6B4"/></g><circle cx="0" cy="-300" r="34" fill="#FFFDF8" stroke="#C9B48E" stroke-width="12"/><path d="M-170 -170 H170" stroke="#C9B48E" stroke-width="8" stroke-dasharray="18 14"/><text x="0" y="250" text-anchor="middle" ${CAVEAT} font-size="460" fill="#4A3F35">W</text></g>`;
    },
  });

  // ───────────── 9 · Sticky doodle
  add({
    id: "sticky", n: 9, name: "Sticky-note doodle", word: "Caveat",
    tagline: "A yellow sticky note with a hand-drawn pin and dashed trail",
    concept: "The app's notes, as the icon: a yellow sticky note with a curled corner, doodled in pencil: a dashed trail winding up to a pin. Feels like a plan scribbled on the fridge. The doodle is drawn with a slight wobble so it reads as handmade.",
    palette: [["Kraft", "#F3EADB"], ["Sticky", "#FFF6C9"], ["Pencil", "#4A3F35"], ["Coral", "#D9694F"]],
    moves: ["Curled corner", "Wobbly hand-drawn strokes", "Coral pin is the only colour"],
    render: (c) => bg(c, c.p.kraft) +
      `<g transform="translate(512 520) rotate(-3)"><g ${shadow(c, 14, 16, 0.3)}><path d="M-330 -330 H330 V210 L210 330 H-330 Z" fill="${c.p.sticky}"/></g><path d="M330 210 L210 330 L230 230 Z" fill="${mix(c.mode === "dark" ? "#F2E9B8" : "#FFF6C9", "#000", 0.12)}"/>` +
      `<path d="M-220 230 C -120 200 -180 80 -60 60 S 60 -20 90 -60" stroke="#4A3F35" stroke-width="22" stroke-dasharray="1 42" stroke-linecap="round" fill="none" ${rough(c, 2)}/>` +
      `<path d="${LG.pinPath(140, -170, 92, 0.4)}" fill="#D9694F" fill-rule="evenodd" stroke="#4A3F35" stroke-width="10" ${rough(c, 2)}/><circle cx="-220" cy="230" r="20" fill="#4A3F35"/></g>`,
  });

  // ───────────── 10 · Ticket stub
  add({
    id: "ticket", n: 10, name: "Ticket stub", word: "Caveat",
    tagline: "A paper ticket with notches, a perforation and a W on the stub",
    concept: "Today's itinerary items are ticket stubs; the icon is one big ticket on coral: notched sides, a dashed tear line, a handwritten W on the stub and a small pin on the ticket body. Strong horizontal silhouette.",
    palette: [["Coral", "#D9694F"], ["Paper", "#FFFDF8"], ["Pencil", "#3D332B"]],
    moves: ["Notches cut out of the sides", "Dashed tear line", "Stub W + body pin"],
    render: (c) => {
      const m = c.id("notch");
      c.defs += `<mask id="${m}"><rect x="-400" y="-260" width="800" height="520" fill="#fff"/><circle cx="-110" cy="-230" r="44" fill="#000"/><circle cx="-110" cy="230" r="44" fill="#000"/></mask>`;
      return `<rect width="1024" height="1024" fill="${c.p.coral}"/><g transform="translate(512 512) rotate(-10)"><g ${shadow(c, 14, 14, 0.3)}><rect x="-390" y="-230" width="780" height="460" rx="36" fill="#FFFDF8" mask="url(#${m})"/></g><path d="M-110 -170 V170" stroke="#C9B9A6" stroke-width="10" stroke-dasharray="22 18"/><text x="-250" y="110" text-anchor="middle" ${CAVEAT} font-size="300" fill="#3D332B">W</text>${pin(130, -40, 92, c.p.coral, 0.4)}</g>`;
    },
  });

  // ───────────── 11 · Compass sketch
  add({
    id: "compass", n: 11, name: "Compass sketch", word: "Caveat",
    tagline: "A hand-drawn compass rose with a coral north needle",
    concept: "Wayfinding drawn in a travel journal: a pencil-sketched compass ring with a four-point star; north is coral. Classic travel symbol with a handmade wobble so it fits the scrapbook rather than looking like a navigation app.",
    palette: [["Kraft", "#F3EADB"], ["Pencil", "#4A3F35"], ["Coral", "#D9694F"], ["Paper", "#FFFDF8"]],
    moves: ["Double pencil ring", "Coral N needle", "Rough hand-drawn filter"],
    render: (c) => {
      const ink = c.mode === "dark" ? "#EFE4D6" : "#4A3F35";
      return bg(c, c.p.kraft) + `<g ${rough(c, 2)}><circle cx="512" cy="512" r="330" fill="${c.p.paper}" stroke="${ink}" stroke-width="18"/><circle cx="512" cy="512" r="280" fill="none" stroke="${ink}" stroke-width="7"/></g>` +
        `<polygon points="512,190 566,512 512,500 458,512" fill="${c.p.coral}"/><polygon points="512,834 566,512 512,524 458,512" fill="#4A3F35"/><polygon points="190,512 512,466 500,512 512,558" fill="#B9A992"/><polygon points="834,512 512,466 524,512 512,558" fill="#B9A992"/><circle cx="512" cy="512" r="30" fill="#FFFDF8" stroke="#4A3F35" stroke-width="10"/>`;
    },
  });

  // ───────────── 12 · Little backpack
  add({
    id: "backpack", n: 12, name: "Little backpack", word: "Caveat",
    tagline: "A friendly coral backpack with a pin badge (Way-pack)",
    concept: "Takes the name literally: a rounded coral backpack with a paper flap, two straps and a mint pin badge on the pocket, on kraft. The most kid-friendly option, and very distinct from map apps.",
    palette: [["Kraft", "#F3EADB"], ["Coral", "#D9694F"], ["Flap", "#B4523A"], ["Mint", "#A9D3C0"]],
    moves: ["Chunky rounded silhouette", "Pin badge on the pocket", "Handle loop on top"],
    render: (c) => bg(c, c.p.kraft) +
      `<path d="M430 230 C 430 150 594 150 594 230" stroke="#B4523A" stroke-width="36" fill="none"/>` +
      `<g ${shadow(c, 16, 16, 0.28)}><rect x="282" y="230" width="460" height="580" rx="150" fill="#D9694F"/></g>` +
      `<path d="M282 380 C 282 270 742 270 742 380 V470 H282 Z" fill="#B4523A"/><rect x="360" y="560" width="304" height="200" rx="50" fill="#C55E46"/><path d="M360 600 H664" stroke="#B4523A" stroke-width="14"/>` +
      `<circle cx="512" cy="470" r="22" fill="#FFFDF8"/>` + pin(512, 650, 46, c.p.mint, 0.4),
  });

  // ───────────── 13 · Trail to the pin
  add({
    id: "trail", n: 13, name: "Trail to the pin", word: "Caveat",
    tagline: "A dashed coral trail winding across kraft to a pin",
    concept: "The ‘ticket trail’ from Today, as a mark: a dashed path starts at a small dot bottom-left and winds up to a coral pin. Says ‘route planned, follow it’. Simple shapes, so it survives small sizes.",
    palette: [["Kraft", "#F3EADB"], ["Coral", "#D9694F"], ["Pencil", "#4A3F35"]],
    moves: ["Same dashed line as Today", "Start dot + destination pin", "Lots of kraft breathing room"],
    render: (c) => bg(c, c.p.kraft) +
      `<path d="M230 820 C 420 800 210 600 420 560 S 680 560 640 470" stroke="${c.p.coral}" stroke-width="40" stroke-dasharray="2 70" stroke-linecap="round" fill="none"/><circle cx="230" cy="820" r="40" fill="${c.mode === "dark" ? "#EFE4D6" : "#4A3F35"}"/>` +
      pin(680, 260, 120, c.p.coral, 0.4, shadow(c, 10, 10, 0.22)),
  });

  // ───────────── 14 · Sun & hills
  add({
    id: "sunhills", n: 14, name: "Sun over hills", word: "Inter",
    tagline: "The app's landscape, full bleed and bold",
    concept: "No frame, no object: just the landscape that appears on every trip cover, simplified and bold. Cream sky, a big mustard sun, a coral far hill and a dark near hill. Calm and premium; leaves the scrapbook props to the app itself.",
    palette: [["Cream", "#FBE8CF"], ["Sun", "#F3C04F"], ["Coral", "#D9694F"], ["Cocoa", "#5A3A2C"]],
    moves: ["Full-bleed landscape", "Two hill layers", "Works as a wallpaper-like icon"],
    render: (c) => {
      const dark = c.mode === "dark";
      return `<rect width="1024" height="1024" fill="${dark ? "#2E2420" : "#FBE8CF"}"/><circle cx="640" cy="390" r="170" fill="${dark ? "#E6B04A" : "#F3C04F"}"/>` +
        `<path d="${hills(0, 1024, 640, 70, 1.4, 1024)}" fill="${dark ? "#C9654B" : "#D9694F"}"/><path d="${hills(0, 1024, 790, 50, 4, 1024)}" fill="${dark ? "#1A1310" : "#5A3A2C"}"/>`;
    },
  });

  // ───────────── 15 · Stacked polaroids
  add({
    id: "stack", n: 15, name: "Stacked polaroids", word: "Caveat",
    tagline: "Two polaroids fanned on top of each other",
    concept: "A collection, not a single trip: a mint-sky polaroid fanned behind a coral one, taped together. Suggests ‘all your family trips’ and echoes the sign-in photo pile.",
    palette: [["Kraft", "#F3EADB"], ["Coral", "#D9694F"], ["Teal", "#2F7F9E"], ["Paper", "#FFFDF8"]],
    moves: ["Back polaroid +12°, front −5°", "Two scenes in different colours", "One tape strip"],
    render: (c) => bg(c, c.p.kraft) + polaroid(c, 560, 470, 520, 12, (x, y, w, h) => scene(c, x, y, w, h, "#2F7F9E", { ph: 3 })) + polaroid(c, 470, 580, 540, -5, (x, y, w, h) => scene(c, x, y, w, h, "#D9694F")) + tape(c, 470, 330, 250, 70, -5, c.p.yellow),
  });

  // ───────────── 16 · Pin window
  add({
    id: "pinwindow", n: 16, name: "Pin window", word: "Inter",
    tagline: "A cream pin whose head is a window onto the landscape",
    concept: "Pin and polaroid in one shape: a big cream map pin on coral; its round head is cut out as a window showing the sun and hills. Bold silhouette, keeps the pin heritage, adds the scrapbook landscape.",
    palette: [["Coral", "#D9694F"], ["Cream", "#FFFDF8"], ["Mustard", "#D99A2B"]],
    moves: ["Pin silhouette retained", "Scene clipped into the head", "Solid coral field"],
    render: (c) => {
      const cl = c.id("head");
      c.defs += `<clipPath id="${cl}"><circle cx="512" cy="400" r="160"/></clipPath>`;
      return `<rect width="1024" height="1024" fill="${c.p.coral}"/>` + pin(512, 400, 230, "#FFFDF8", 0, shadow(c, 14, 14, 0.25)) + `<g clip-path="url(#${cl})">${scene(c, 352, 240, 320, 320, "#D99A2B")}</g>`;
    },
  });

  // ───────────── 17 · Rubber stamp
  add({
    id: "rubber", n: 17, name: "Rubber stamp", word: "Inter",
    tagline: "A round coral ink stamp: WAYPACK · TRIPS OFFLINE",
    concept: "The ‘offline ✓’ stamps from the polaroids, scaled up into a seal: a coral-ink double ring with ‘WAYPACK · TRIPS THAT WORK OFFLINE’ around it and a pin in the middle, slightly rotated and ink-textured. Very characterful; the ring text disappears below ~40pt, leaving ring + pin.",
    palette: [["Kraft", "#F3EADB"], ["Stamp ink", "#C0432B"]],
    moves: ["Text on a circular path", "Ink texture", "Rotated −12°"],
    render: (c) => {
      const id = c.id("ring"), ink = c.mode === "dark" ? "#F08A70" : "#C0432B";
      c.defs += `<path id="${id}" d="M512 512 m-262 0 a262 262 0 1 1 524 0 a262 262 0 1 1 -524 0"/>`;
      return bg(c, c.p.kraft) + `<g transform="rotate(-12 512 512)" opacity=".92" ${rough(c, 1)}><circle cx="512" cy="512" r="350" fill="none" stroke="${ink}" stroke-width="26"/><circle cx="512" cy="512" r="200" fill="none" stroke="${ink}" stroke-width="12"/>` +
        `<text font-family="Inter, sans-serif" font-weight="900" font-size="72" letter-spacing="14" fill="${ink}"><textPath href="#${id}">WAYPACK · TRIPS THAT WORK OFFLINE ·</textPath></text>${pin(512, 450, 92, ink, 0.4)}</g>`;
    },
  });

  // ───────────── 18 · Postcard
  add({
    id: "postcard", n: 18, name: "Postcard", word: "Caveat",
    tagline: "A postcard with a stamp in the corner and address lines",
    concept: "Sharing a trip is sending a postcard (the share sheet already uses them). A paper postcard, slightly tilted on kraft: coral stamp top-right, three pencil address lines, and a small pin doodle on the message side.",
    palette: [["Kraft", "#F3EADB"], ["Paper", "#FFFDF8"], ["Coral", "#D9694F"], ["Pencil", "#8C7D6E"]],
    moves: ["Stamp with dotted border", "Divider line", "Readable as ‘mail/trip’"],
    render: (c) => bg(c, c.p.kraft) +
      `<g transform="translate(512 520) rotate(-7)"><g ${shadow(c, 14, 14, 0.28)}><rect x="-400" y="-270" width="800" height="540" rx="14" fill="#FFFDF8"/></g><rect x="150" y="-210" width="180" height="210" fill="#D9694F" stroke="#FFFDF8" stroke-width="10" stroke-dasharray="4 14" stroke-linecap="round"/>${pin(240, -130, 40, "#FFFDF8", 0.4)}` +
      `<path d="M30 -200 V200" stroke="#D8CBB8" stroke-width="8"/><path d="M90 70 H330 M90 140 H330 M90 210 H260" stroke="#8C7D6E" stroke-width="12" stroke-linecap="round"/>` +
      `<text x="-200" y="70" text-anchor="middle" ${CAVEAT} font-size="240" fill="#3D332B">hi!</text></g>`,
  });

  // ───────────── 19 · Campfire dusk
  add({
    id: "dusk", n: 19, name: "Campfire dusk", word: "Caveat", prefers: "dark",
    tagline: "Ember sun over dark hills under a few stars (dark-first)",
    concept: "A night-time scrapbook page: deep cocoa sky, an ember-coral setting sun, layered dark hills and three stars. Rich and cosy on dark wallpapers and in iOS dark mode; in light mode the sky warms to a dusk peach.",
    palette: [["Cocoa", "#2B211B"], ["Ember", "#E88468"], ["Hill", "#4A3529"], ["Star", "#FFF3C4"]],
    moves: ["Designed for dark first", "Glowing sun disc", "Stars as tiny crosses"],
    render: (c) => {
      const g = c.id("dusk"), dark = c.mode === "dark";
      c.defs += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark ? "#1B1410" : "#5B3A44"}"/><stop offset="1" stop-color="${dark ? "#4A2C22" : "#F2A07E"}"/></linearGradient>`;
      return `<rect width="1024" height="1024" fill="url(#${g})"/>${[[220, 220], [780, 170], [640, 300]].map(([x, y]) => `<path d="M${x} ${y - 22} V${y + 22} M${x - 22} ${y} H${x + 22}" stroke="#FFF3C4" stroke-width="9" stroke-linecap="round"/>`).join("")}` +
        `<circle cx="512" cy="600" r="230" fill="#E88468" opacity=".25"/><circle cx="512" cy="600" r="160" fill="#E88468"/><path d="${hills(0, 1024, 640, 60, 2, 1024)}" fill="#4A3529"/><path d="${hills(0, 1024, 780, 45, 5, 1024)}" fill="#24180F"/>`;
    },
  });

  // ───────────── 20 · Cream & coral pin
  add({
    id: "minimal", n: 20, name: "Coral pin, cream paper", word: "Inter",
    tagline: "The simplest: one solid coral pin on dotted cream paper",
    concept: "Maximum legibility: a single solid coral pin on cream paper with faint dots, and a short washi strip as its ‘shadow’. Reads perfectly at 16px, matches the app colours, and leaves room for the scrapbook flourishes inside the app.",
    palette: [["Cream", "#FFFDF8"], ["Coral", "#D9694F"], ["Washi yellow", "#F3D27A"]],
    moves: ["One shape, one colour", "Tape as ground shadow", "Best at favicon sizes"],
    render: (c) => bg(c, c.mode === "dark" ? "#2A221D" : "#FFFDF8") + tape(c, 512, 820, 300, 70, -4, c.p.yellow) + pin(512, 380, 210, c.p.coral, 0.4),
  });

  LG.designs = L;
})();
