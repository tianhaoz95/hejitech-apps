// Shared drawing kit for Tether logo redesign
// Provides Apple squircle paths, platform wrappers (iOS, Android, macOS, favicon),
// and multi-view inspect engines: large stage, platform variants, size ladder, and home screen context.
window.KIT = window.KIT || {};

(() => {
  // Apple squircle superellipse path (N=5, R=512) for 1024x1024 coordinate space
  KIT.squircle = (() => {
    const N = 5, R = 512, pts = [];
    for (let i = 0; i < 360; i += 3) {
      const t = (i * Math.PI) / 180, ct = Math.cos(t), st = Math.sin(t);
      pts.push([512 + R * Math.sign(ct) * Math.abs(ct) ** (2 / N), 512 + R * Math.sign(st) * Math.abs(st) ** (2 / N)]);
    }
    return "M" + pts.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L") + " Z";
  })();

  let idCounter = 0;
  KIT.uid = (prefix = "ttr") => `${prefix}_${++idCounter}_${Math.random().toString(36).slice(2, 7)}`;

  /**
   * Renders an icon candidate at a given size, shape and mode.
   * shapes: "ios" (squircle) | "android" (circle) | "mac" (macOS dock tile) | "tile" (favicon)
   * modes: "light" | "dark" | "tinted"
   */
  KIT.renderIcon = (c, { size = 256, shape = "ios", mode = "dark", shadow = true, cls = "" } = {}) => {
    const id = KIT.uid("ico");
    const clipId = `${id}_clip`;
    const m = mode === "tinted" ? "dark" : mode;
    const body = c.draw ? c.draw({ mode: m, uid: id, size: 1024 }) : "";

    let clipDef = "";
    let wrapped = body;
    if (shape === "ios") {
      clipDef = `<clipPath id="${clipId}"><path d="${KIT.squircle}"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})">${body}</g>`;
    } else if (shape === "android") {
      clipDef = `<clipPath id="${clipId}"><circle cx="512" cy="512" r="512"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})"><g transform="translate(512 512) scale(1.18) translate(-512 -512)">${body}</g></g>`;
    } else if (shape === "mac") {
      clipDef = `<clipPath id="${clipId}"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})"><g transform="translate(100 100) scale(${824 / 1024})">${body}</g></g>`;
    } else if (shape === "tile") {
      clipDef = `<clipPath id="${clipId}"><rect width="1024" height="1024" rx="220"/></clipPath>`;
      wrapped = `<g clip-path="url(#${clipId})">${body}</g>`;
    }

    const dropShadowStyle = shadow
      ? `filter: drop-shadow(0 14px 28px rgba(0,0,0,0.28)) drop-shadow(0 3px 8px rgba(0,0,0,0.16));`
      : "";

    const svg = `<svg class="ttr-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 1024 1024" style="${dropShadowStyle} display:block;"><defs>${clipDef}</defs>${wrapped}</svg>`;

    if (mode === "tinted") {
      return `<div class="ttr-tint" style="width:${size}px;height:${size}px;border-radius:${size * 0.225}px;">${svg}</div>`;
    }
    return svg;
  };

  // ── View 1: Main Stage
  KIT.viewStage = (c, { size = 260, dark = true, isThumb = false } = {}) => {
    const iconHtml = KIT.renderIcon(c, { size, shape: "ios", mode: dark ? "dark" : "light", shadow: true });
    return `<div class="icon-stage ${dark ? "dark" : "light"}${isThumb ? " thumb" : ""}">
      <div class="stage-backdrop"></div>
      <div class="stage-center">${iconHtml}</div>
    </div>`;
  };

  // ── View 2: Platform Adaptations (iOS, Dark, Tinted, Android)
  KIT.viewPlatforms = (c, { dark = true } = {}) => {
    const iosLight = KIT.renderIcon(c, { size: 104, shape: "ios", mode: "light" });
    const iosDark = KIT.renderIcon(c, { size: 104, shape: "ios", mode: "dark" });
    const iosTinted = KIT.renderIcon(c, { size: 104, shape: "ios", mode: "tinted" });
    const android = KIT.renderIcon(c, { size: 104, shape: "android", mode: "dark" });

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
          <div class="plat-icon-box android-box">${android}</div>
          <span class="plat-lbl">Android Adaptive</span>
        </div>
      </div>
    </div>`;
  };

  // ── View 3: Size Ladder (128px down to 16px)
  KIT.viewLadder = (c, { dark = true } = {}) => {
    const mode = dark ? "dark" : "light";
    const i128 = KIT.renderIcon(c, { size: 120, shape: "ios", mode, shadow: true });
    const i64 = KIT.renderIcon(c, { size: 64, shape: "ios", mode, shadow: false });
    const i32 = KIT.renderIcon(c, { size: 32, shape: "tile", mode, shadow: false });
    const i16 = KIT.renderIcon(c, { size: 16, shape: "tile", mode, shadow: false });

    return `<div class="view-ladder ${dark ? "dark" : "light"}">
      <div class="ladder-row">
        <div class="ladder-item">
          <div class="ladder-box">${i128}</div>
          <span class="ladder-lbl">128px · Mac / Settings</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i64}</div>
          <span class="ladder-lbl">64px · App Library</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i32}</div>
          <span class="ladder-lbl">32px · Menu</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i16}</div>
          <span class="ladder-lbl">16px · Favicon</span>
        </div>
      </div>
    </div>`;
  };

  // Generic companion apps on home screen
  const COMPANIONS = [
    { name: "Terminal", color: "#18181B", icon: `<path d="M22 30L34 42L22 54" stroke="#4ADE80" stroke-width="6" stroke-linecap="round"/><path d="M40 54H58" stroke="#4ADE80" stroke-width="6" stroke-linecap="round"/>` },
    { name: "Files", color: "#2563EB", icon: `<path d="M18 26H34L40 32H62V54H18Z" fill="#FFFFFF"/>` },
    { name: "Notes", color: "#EAB308", icon: `<rect x="22" y="22" width="36" height="36" rx="6" fill="#FFFFFF"/><path d="M28 32H52M28 40H52M28 48H44" stroke="#D97706" stroke-width="3" stroke-linecap="round"/>` },
    { name: "Weather", color: "#0284C7", icon: `<circle cx="40" cy="40" r="14" fill="#FDE047"/>` },
    { name: "Safari", color: "#0284C7", icon: `<circle cx="40" cy="40" r="18" fill="none" stroke="#FFFFFF" stroke-width="4"/><polygon points="40,24 45,38 40,40 35,38" fill="#EF4444"/><polygon points="40,56 45,42 40,40 35,42" fill="#FFFFFF"/>` },
    { name: "Settings", color: "#475569", icon: `<circle cx="40" cy="40" r="14" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="6 3"/>` },
  ];

  const companionApp = (app, size = 52) => {
    return `<div class="hs-app">
      <svg width="${size}" height="${size}" viewBox="0 0 80 80">
        <defs><clipPath id="cp_${app.name}"><path d="${KIT.squircle}" transform="scale(${80 / 1024})"/></clipPath></defs>
        <rect width="80" height="80" fill="${app.color}" clip-path="url(#cp_${app.name})"/>
        <g clip-path="url(#cp_${app.name})">${app.icon}</g>
      </svg>
      <span>${app.name}</span>
    </div>`;
  };

  // ── View 4: Home Screen Context
  KIT.viewHomeScreen = (c, { dark = true } = {}) => {
    const tetherIcon = KIT.renderIcon(c, { size: 52, shape: "ios", mode: dark ? "dark" : "light", shadow: true });

    return `<div class="view-homescreen ${dark ? "dark" : "light"}">
      <div class="hs-mock">
        <div class="hs-statusbar">
          <span>9:41</span>
          <div class="hs-status-icons">
            <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor"><path d="M0 9h2v1H0zm3-2h2v3H3zm3-3h2v6H6zm3-3h2v9H9zm3-1h2v10h-2z"/></svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><path d="M7 2C4.5 2 2.3 3.1.8 4.8L7 11l6.2-6.2C11.7 3.1 9.5 2 7 2z"/></svg>
            <div class="hs-battery"><div class="hs-bat-lvl"></div></div>
          </div>
        </div>
        <div class="hs-grid">
          ${companionApp(COMPANIONS[0])}
          <div class="hs-app me">
            ${tetherIcon}
            <span>Tether</span>
          </div>
          ${companionApp(COMPANIONS[1])}
          ${companionApp(COMPANIONS[2])}
          ${companionApp(COMPANIONS[3])}
          ${companionApp(COMPANIONS[5])}
        </div>
        <div class="hs-dock">
          ${companionApp(COMPANIONS[4], 46)}
          <div class="hs-app me">
            ${KIT.renderIcon(c, { size: 46, shape: "ios", mode: dark ? "dark" : "light", shadow: true })}
          </div>
          ${companionApp(COMPANIONS[0], 46)}
          ${companionApp(COMPANIONS[1], 46)}
        </div>
      </div>
    </div>`;
  };

  // Helper to attach default multi-views to any candidate
  KIT.attachViews = (c) => {
    c.views = [
      {
        name: "Icon · Squircle",
        render: ({ dark }) => KIT.viewStage(c, { size: 270, dark }),
      },
      {
        name: "Platforms & Tinted",
        render: ({ dark }) => KIT.viewPlatforms(c, { dark }),
      },
      {
        name: "Size Ladder (128 → 16px)",
        render: ({ dark }) => KIT.viewLadder(c, { dark }),
      },
      {
        name: "Home Screen Context",
        render: ({ dark }) => KIT.viewHomeScreen(c, { dark }),
      },
    ];
    c.render = ({ dark }) => KIT.viewStage(c, { size: 240, dark, isThumb: true });
    return c;
  };
})();
