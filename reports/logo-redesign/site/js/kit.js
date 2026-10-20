// Drawing kit for the icon candidates: palettes, paper/tape/pin/scene primitives on a 1024 grid,
// and the frames each icon is shown in (iOS squircle, Android circle, macOS body, favicon tile).
window.LG = window.LG || {};

(() => {
  // The scrapbook palette from the app (lib/widgets/scrapbook.dart).
  LG.pal = {
    light: { kraft: "#F3EADB", dots: "rgba(120,90,60,.2)", paper: "#FFFDF8", ink: "#4A3F35", cap: "#3D332B", coral: "#D9694F", coralDeep: "#B4523A",
      pink: "#F2A28B", mint: "#A9D3C0", yellow: "#F3D27A", sticky: "#FFF6C9", ok: "#4F8A62", sky: "#FBE3C8", sun: "#FFF3C4", night: "#2B211B" },
    dark: { kraft: "#231D18", dots: "rgba(255,230,200,.09)", paper: "#EDE4D4", ink: "#EFE4D6", cap: "#3D332B", coral: "#E88468", coralDeep: "#C9654B",
      pink: "#E8937C", mint: "#93C2AE", yellow: "#E6C365", sticky: "#F2E9B8", ok: "#5E9A70", sky: "#3A2E26", sun: "#F7DFA0", night: "#16110D" },
  };

  let n = 0;
  /** A render context: unique ids and a <defs> buffer for one SVG. */
  LG.ctx = (mode) => {
    const p = LG.pal[mode === "light" ? "light" : "dark"];
    const k = "i" + n++;
    const c = { p, mode, defs: "", id: (s) => `${k}${s}` };
    return c;
  };

  // ── primitives (all on the 1024 grid)
  LG.dots = (c, color = c.p.dots, step = 56, r = 5) => {
    const id = c.id("dots");
    c.defs += `<pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="${step / 2}" cy="${step / 2}" r="${r}" fill="${color}"/></pattern>`;
    return `<rect width="1024" height="1024" fill="url(#${id})"/>`;
  };
  LG.bg = (c, color, dots = true) => `<rect width="1024" height="1024" fill="${color}"/>${dots ? LG.dots(c) : ""}`;

  LG.shadow = (c, dy = 14, blur = 16, op = 0.28) => {
    const id = c.id("sh" + dy + blur);
    if (!c.defs.includes(`id="${id}"`)) c.defs += `<filter id="${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="#3C2814" flood-opacity="${op}"/></filter>`;
    return `filter="url(#${id})"`;
  };

  /** Washi tape: a striped strip, centre (x,y), size w×h, rotated. */
  LG.tape = (c, x, y, w, h, rot, color) => {
    const id = c.id("tp" + Math.round(Math.random() * 1e9));
    c.defs += `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="26" height="26" fill="${color}"/><rect width="12" height="26" fill="rgba(255,255,255,.32)"/></pattern>`;
    const j = h * 0.12;
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2 + j], [w / 2 - j, 0], [w / 2, h / 2], [-w / 2, h / 2 - j], [-w / 2 + j, 0]];
    return `<g transform="translate(${x} ${y}) rotate(${rot})" opacity=".92"><polygon points="${pts.map((q) => q.join(",")).join(" ")}" fill="url(#${id})"/></g>`;
  };

  /** Tape strip between two points (for the washi W). */
  LG.tapeLine = (c, x1, y1, x2, y2, h, color) => {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    return LG.tape(c, (x1 + x2) / 2, (y1 + y2) / 2, len, h, (Math.atan2(dy, dx) * 180) / Math.PI, color);
  };

  /** Map pin path with a hole; tip at (cx, cy + r*2.2). */
  LG.pinPath = (cx, cy, r, holeK = 0.4) => {
    const tip = cy + r * 2.2, hole = r * holeK;
    let d = `M${cx} ${tip} C ${cx - r * 0.3} ${cy + r * 1.62} ${cx - r} ${cy + r * 0.98} ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} C ${cx + r} ${cy + r * 0.98} ${cx + r * 0.3} ${cy + r * 1.62} ${cx} ${tip} Z`;
    if (holeK > 0) d += ` M${cx - hole} ${cy} A ${hole} ${hole} 0 1 0 ${cx + hole} ${cy} A ${hole} ${hole} 0 1 0 ${cx - hole} ${cy} Z`;
    return d;
  };
  LG.pin = (cx, cy, r, fill, holeK = 0.4, extra = "") => `<path d="${LG.pinPath(cx, cy, r, holeK)}" fill="${fill}" fill-rule="evenodd" ${extra}/>`;

  const mix = (a, b, t) => {
    const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const x = h(a), y = h(b);
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  LG.mix = mix;

  /** Hills path across [x, x+w], base y, amplitude, phase. */
  const hills = (x, w, yb, amp, ph, bottom) => {
    let d = `M${x} ${bottom}`;
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, xx = x + w * t;
      const y = yb + Math.sin(t * Math.PI * 2.2 + ph) * amp + Math.sin(t * Math.PI * 5.1 + ph * 2) * amp * 0.35;
      d += ` L${xx.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d + ` L${x + w} ${bottom} Z`;
  };
  LG.hills = hills;

  /** The app's drawn landscape (ScenePainter): sky, sun, two hills, in a rect. */
  LG.scene = (c, x, y, w, h, accent, { sun = true, ph = 1.3 } = {}) => {
    const g = c.id("sky" + Math.round(x + y + w));
    const cl = c.id("cl" + Math.round(x * 7 + y + w));
    const sky1 = mix(accent, "#FFF4E2", 0.62), sky2 = mix(accent, "#FFFBF2", 0.85);
    c.defs += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient><clipPath id="${cl}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`;
    const far = mix(accent, sky2, 0.5), near = mix(accent, "#3A2A22", 0.12);
    return `<g clip-path="url(#${cl})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${g})"/>${sun ? `<circle cx="${x + w * 0.7}" cy="${y + h * 0.3}" r="${h * 0.2}" fill="#FFF3C4" opacity=".35"/><circle cx="${x + w * 0.7}" cy="${y + h * 0.3}" r="${h * 0.12}" fill="#FFF3C4"/>` : ""}<path d="${hills(x, w, y + h * 0.6, h * 0.1, ph, y + h)}" fill="${far}"/><path d="${hills(x, w, y + h * 0.78, h * 0.07, ph + 2.4, y + h)}" fill="${near}"/></g>`;
  };

  /** A polaroid: paper frame with a photo area; returns svg. (x,y) centre, w, rotation. */
  LG.polaroid = (c, cx, cy, w, rot, photo, { paper = c.p.paper, ratio = 0.8, chin = 0.22, shadow = true } = {}) => {
    const pad = w * 0.06, pw = w - pad * 2, ph = pw * ratio, h = pad + ph + w * chin;
    const x = -w / 2, y = -h / 2;
    return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${paper}" ${shadow ? LG.shadow(c) : ""}/>${photo(x + pad, y + pad, pw, ph)}</g>`;
  };

  /** Superellipse (iOS continuous corners) on the 1024 grid. */
  LG.squircle = (() => {
    const N = 5, R = 512, pts = [];
    for (let i = 0; i < 360; i += 3) {
      const t = (i * Math.PI) / 180, ct = Math.cos(t), st = Math.sin(t);
      pts.push([512 + R * Math.sign(ct) * Math.abs(ct) ** (2 / N), 512 + R * Math.sign(st) * Math.abs(st) ** (2 / N)]);
    }
    return "M" + pts.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L") + " Z";
  })();

  /**
   * One icon as inline SVG.
   *  shape: "ios" (squircle) | "android" (circle, adaptive safe zone) | "tile" (rounded rect, favicon/site) | "square" | "mac"
   *  mode: "light" | "dark" | "tinted" (iOS 18 tinted: grayscale of the dark icon, tinted)
   */
  LG.icon = (d, { size = 120, shape = "ios", mode = "light", cls = "" } = {}) => {
    const m = mode === "tinted" ? "dark" : mode;
    const c = LG.ctx(m);
    const body = d.render(c);
    const clip = c.id("clip");
    let frame = "", content = body, viewBox = "0 0 1024 1024";
    if (shape === "ios") frame = `<clipPath id="${clip}"><path d="${LG.squircle}"/></clipPath>`;
    else if (shape === "android") { frame = `<clipPath id="${clip}"><circle cx="512" cy="512" r="512"/></clipPath>`; content = `<g transform="translate(512 512) scale(1.18) translate(-512 -512)">${body}</g>`; }
    else if (shape === "tile") frame = `<clipPath id="${clip}"><rect width="1024" height="1024" rx="230"/></clipPath>`;
    else if (shape === "mac") {
      frame = `<clipPath id="${clip}"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath><filter id="${clip}s" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".28"/></filter>`;
      return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="${viewBox}" aria-hidden="true"><defs>${c.defs}${frame}</defs><g filter="url(#${clip}s)"><g clip-path="url(#${clip})"><g transform="translate(100 100) scale(${824 / 1024})">${body}</g></g></g></svg>`;
    }
    const svg = `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="${viewBox}" aria-hidden="true"><defs>${c.defs}${frame}</defs>${shape === "square" ? content : `<g clip-path="url(#${clip})">${content}</g>`}</svg>`;
    return mode === "tinted" ? `<span class="tint" style="width:${size}px;height:${size}px;border-radius:${size * 0.225}px">${svg}</span>` : svg;
  };

  /** Hand-drawn wobble for strokes (so doodles don't look vector-perfect). */
  LG.rough = (c, amount = 3) => {
    const id = c.id("rough" + amount);
    if (!c.defs.includes(`id="${id}"`)) c.defs += `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="${amount * 4}"/></filter>`;
    return `filter="url(#${id})"`;
  };
})();
