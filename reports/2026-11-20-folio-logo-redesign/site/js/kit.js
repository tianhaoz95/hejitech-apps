// Shared drawing kit for Folio logo redesign
// Provides Apple squircle paths, platform wrappers (iOS, Dark, Tinted, macOS, favicon),
// and multi-view inspect engines: squircle stage, web header/favicon, platforms, size ladder, and home screen.
window.KIT = window.KIT || {};

(() => {
  // Apple squircle superellipse path (N=5, R=512) for 1024x1024 coordinate space
  KIT.squircle = (() => {
    const N = 5, R = 512, pts = [];
    for (let i = 0; i < 360; i += 3) {
      const t = (i * Math.PI) / 180, ct = Math.cos(t), st = Math.sin(t);
      pts.push([
        512 + R * Math.sign(ct) * Math.abs(ct) ** (2 / N),
        512 + R * Math.sign(st) * Math.abs(st) ** (2 / N),
      ]);
    }
    return "M" + pts.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L") + " Z";
  })();

  let idCounter = 0;
  KIT.uid = (prefix = "fol") => `${prefix}_${++idCounter}_${Math.random().toString(36).slice(2, 7)}`;

  /**
   * Renders an icon candidate at a given size, shape and mode.
   * shapes: "ios" (squircle) | "mac" (macOS rounded tile) | "tile" (web/favicon rounded rect)
   * modes: "light" | "dark" | "tinted"
   */
  KIT.renderIcon = (c, { size = 256, shape = "ios", mode = "light", shadow = true, cls = "" } = {}) => {
    const id = KIT.uid("ico");
    const clipId = `${id}_clip`;
    const m = mode === "tinted" ? "dark" : mode;
    const body = c.draw ? c.draw({ mode: m, uid: id, size: 1024 }) : "";

    let clipDef = "";
    let wrapped = body;
    if (shape === "ios") {
      clipDef = `<clipPath id="${clipId}"><path d="${KIT.squircle}"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})">${body}</g>`;
    } else if (shape === "mac") {
      clipDef = `<clipPath id="${clipId}"><rect x="96" y="96" width="832" height="832" rx="188"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})"><g transform="translate(96 96) scale(${832 / 1024})">${body}</g></g>`;
    } else if (shape === "tile") {
      clipDef = `<clipPath id="${clipId}"><rect width="1024" height="1024" rx="224"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})">${body}</g>`;
    }

    const dropShadowStyle = shadow
      ? `filter: drop-shadow(0 12px 24px rgba(0,0,0,0.22)) drop-shadow(0 2px 6px rgba(0,0,0,0.12));`
      : "";

    const svg = `<svg class="fol-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 1024 1024" style="${dropShadowStyle} display:block;"><defs>${clipDef}</defs>${wrapped}</svg>`;

    if (mode === "tinted") {
      return `<div class="fol-tint" style="width:${size}px;height:${size}px;border-radius:${(size * 0.225).toFixed(1)}px;">${svg}</div>`;
    }
    return svg;
  };

  // ── View 1: Main Squircle Stage
  KIT.viewStage = (c, { size = 264, dark = false, isThumb = false } = {}) => {
    const iconHtml = KIT.renderIcon(c, { size, shape: "ios", mode: dark ? "dark" : "light", shadow: true });
    return `<div class="icon-stage ${dark ? "dark" : "light"}${isThumb ? " thumb" : ""}">
      <div class="stage-backdrop"></div>
      <div class="stage-center">${iconHtml}</div>
    </div>`;
  };

  // ── View 2: Web Header Lockup & Browser Tab Favicon (Light + Dark)
  KIT.viewWeb = (c, { dark = false } = {}) => {
    const favL = KIT.renderIcon(c, { size: 15, shape: "tile", mode: "light", shadow: false });
    const navL = KIT.renderIcon(c, { size: 24, shape: "tile", mode: "light", shadow: false });
    const favD = KIT.renderIcon(c, { size: 15, shape: "tile", mode: "dark", shadow: false });
    const navD = KIT.renderIcon(c, { size: 24, shape: "tile", mode: "dark", shadow: false });

    return `<div class="view-web ${dark ? "dark" : "light"}">
      <div class="web-lbl">Paper Light (#F7F6F2)</div>
      <div class="web-card">
        <div class="web-tabbar">
          <div class="web-dots"><i></i><i></i><i></i></div>
          <div class="web-tab">${favL}<span>Folio — Shared artifacts</span></div>
        </div>
        <div class="web-header">
          <div class="web-brand">${navL}<span>Folio</span></div>
          <div class="web-nav"><span>Artifacts</span><span>Connect</span><span>Settings</span></div>
        </div>
      </div>
      <div class="web-lbl">Ink Dark (#151514)</div>
      <div class="web-card is-dark">
        <div class="web-tabbar">
          <div class="web-dots"><i></i><i></i><i></i></div>
          <div class="web-tab">${favD}<span>Folio — Shared artifacts</span></div>
        </div>
        <div class="web-header">
          <div class="web-brand">${navD}<span>Folio</span></div>
          <div class="web-nav"><span>Artifacts</span><span>Connect</span><span>Settings</span></div>
        </div>
      </div>
    </div>`;
  };

  // ── View 3: Platform Adaptations (iOS Light, iOS Dark, iOS 18 Tinted, macOS / Share Tile)
  KIT.viewPlatforms = (c, { dark = false } = {}) => {
    const iosLight = KIT.renderIcon(c, { size: 100, shape: "ios", mode: "light" });
    const iosDark = KIT.renderIcon(c, { size: 100, shape: "ios", mode: "dark" });
    const iosTinted = KIT.renderIcon(c, { size: 100, shape: "ios", mode: "tinted" });
    const macTile = KIT.renderIcon(c, { size: 106, shape: "mac", mode: dark ? "dark" : "light" });

    return `<div class="view-platforms ${dark ? "dark" : "light"}">
      <div class="plat-grid">
        <div class="plat-tile">
          <div class="plat-icon-box light-box">${iosLight}</div>
          <span class="plat-lbl">iOS Default</span>
        </div>
        <div class="plat-tile">
          <div class="plat-icon-box dark-box">${iosDark}</div>
          <span class="plat-lbl">iOS Dark</span>
        </div>
        <div class="plat-tile">
          <div class="plat-icon-box dark-box">${iosTinted}</div>
          <span class="plat-lbl">iOS 18 Tinted</span>
        </div>
        <div class="plat-tile">
          <div class="plat-icon-box mac-box">${macTile}</div>
          <span class="plat-lbl">macOS / Share</span>
        </div>
      </div>
    </div>`;
  };

  // ── View 4: Size Ladder (112px down to 16px)
  KIT.viewLadder = (c, { dark = false } = {}) => {
    const mode = dark ? "dark" : "light";
    const i112 = KIT.renderIcon(c, { size: 108, shape: "ios", mode, shadow: true });
    const i64 = KIT.renderIcon(c, { size: 60, shape: "ios", mode, shadow: false });
    const i32 = KIT.renderIcon(c, { size: 32, shape: "tile", mode, shadow: false });
    const i16 = KIT.renderIcon(c, { size: 16, shape: "tile", mode, shadow: false });

    return `<div class="view-ladder ${dark ? "dark" : "light"}">
      <div class="ladder-row">
        <div class="ladder-item">
          <div class="ladder-box">${i112}</div>
          <span class="ladder-lbl">112px · App Store</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i64}</div>
          <span class="ladder-lbl">60px · Home Screen</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i32}</div>
          <span class="ladder-lbl">32px · Nav / Share</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i16}</div>
          <span class="ladder-lbl">16px · Favicon</span>
        </div>
      </div>
    </div>`;
  };

  // Generic companion apps on Home Screen (no real third-party brand logos)
  const COMPANIONS = [
    { name: "Notes", color: "#EAB308", icon: `<rect x="20" y="20" width="40" height="40" rx="8" fill="#FFF"/><path d="M28 32H52M28 41H52M28 50H42" stroke="#CA8A04" stroke-width="3.5" stroke-linecap="round"/>` },
    { name: "Files", color: "#2563EB", icon: `<path d="M18 27H34L40 33H62V54H18Z" fill="#FFF"/>` },
    { name: "Terminal", color: "#18181B", icon: `<path d="M22 30L34 42L22 54" stroke="#4ADE80" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M40 54H58" stroke="#4ADE80" stroke-width="5.5" stroke-linecap="round"/>` },
    { name: "Browser", color: "#0EA5E9", icon: `<circle cx="40" cy="40" r="19" fill="none" stroke="#FFF" stroke-width="4"/><polygon points="40,24 45,38 40,40 35,38" fill="#EF4444"/><polygon points="40,56 45,42 40,40 35,42" fill="#FFF"/>` },
    { name: "Calendar", color: "#FFFFFF", icon: `<rect x="0" y="0" width="80" height="24" fill="#EF4444"/><text x="40" y="60" text-anchor="middle" font-family="Inter,sans-serif" font-size="30" font-weight="700" fill="#18181B">20</text>` },
    { name: "Settings", color: "#52525B", icon: `<circle cx="40" cy="40" r="14" fill="none" stroke="#FFF" stroke-width="6" stroke-dasharray="6 4"/>` },
  ];

  const companionApp = (app, size = 50) => {
    const cid = KIT.uid("cp");
    return `<div class="hs-app">
      <svg width="${size}" height="${size}" viewBox="0 0 80 80">
        <defs><clipPath id="${cid}"><path d="${KIT.squircle}" transform="scale(${80 / 1024})"/></clipPath></defs>
        <g clip-path="url(#${cid})">
          <rect width="80" height="80" fill="${app.color}"/>
          ${app.icon}
        </g>
      </svg>
      <span>${app.name}</span>
    </div>`;
  };

  // ── View 5: Home Screen Context
  KIT.viewHomeScreen = (c, { dark = false } = {}) => {
    const mode = dark ? "dark" : "light";
    const folioIcon = KIT.renderIcon(c, { size: 50, shape: "ios", mode, shadow: true });
    const dockFolio = KIT.renderIcon(c, { size: 46, shape: "ios", mode, shadow: true });

    return `<div class="view-homescreen ${mode}">
      <div class="hs-mock">
        <div class="hs-statusbar">
          <span>9:41</span>
          <div class="hs-status-icons">
            <svg width="14" height="10" viewBox="0 0 15 10" fill="currentColor"><path d="M0 9h2v1H0zm3-2h2v3H3zm3-3h2v6H6zm3-3h2v9H9zm3-1h2v10h-2z"/></svg>
            <svg width="13" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 2C4.5 2 2.3 3.1.8 4.8L7 11l6.2-6.2C11.7 3.1 9.5 2 7 2z"/></svg>
            <div class="hs-battery"><div class="hs-bat-lvl"></div></div>
          </div>
        </div>
        <div class="hs-grid">
          ${companionApp(COMPANIONS[0])}
          <div class="hs-app me">
            ${folioIcon}
            <span>Folio</span>
          </div>
          ${companionApp(COMPANIONS[1])}
          ${companionApp(COMPANIONS[2])}
          ${companionApp(COMPANIONS[4])}
          ${companionApp(COMPANIONS[5])}
        </div>
        <div class="hs-dock">
          ${companionApp(COMPANIONS[3], 46)}
          <div class="hs-app me">${dockFolio}</div>
          ${companionApp(COMPANIONS[0], 46)}
          ${companionApp(COMPANIONS[1], 46)}
        </div>
      </div>
    </div>`;
  };

  KIT.attachViews = (c) => {
    c.views = [
      {
        name: "Icon · Squircle",
        render: ({ dark }) => KIT.viewStage(c, { size: 268, dark }),
      },
      {
        name: "Web Header & Favicon",
        render: ({ dark }) => KIT.viewWeb(c, { dark }),
      },
      {
        name: "Platforms & Tinted",
        render: ({ dark }) => KIT.viewPlatforms(c, { dark }),
      },
      {
        name: "Size Ladder (112 → 16px)",
        render: ({ dark }) => KIT.viewLadder(c, { dark }),
      },
      {
        name: "Home Screen Context",
        render: ({ dark }) => KIT.viewHomeScreen(c, { dark }),
      },
    ];
    c.render = ({ dark }) => KIT.viewStage(c, { size: 236, dark, isThumb: true });
    return c;
  };
})();
