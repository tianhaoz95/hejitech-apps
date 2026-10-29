// Shared drawing kit for Polymath logo & app icon redesign
// Provides Apple squircle paths, platform wrappers (macOS dock, iOS squircle, Android circular, favicon tile),
// multi-view inspect engines (large stage, platform variants, size ladder, and macOS dock desktop view).
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
  KIT.uid = (prefix = "poly") => `${prefix}_${++idCounter}_${Math.random().toString(36).slice(2, 7)}`;

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

    const svg = `<svg class="poly-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 1024 1024" style="${dropShadowStyle} display:block;"><defs>${clipDef}</defs>${wrapped}</svg>`;

    if (mode === "tinted") {
      return `<div class="poly-tint" style="width:${size}px;height:${size}px;border-radius:${size * 0.225}px;">${svg}</div>`;
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

  // ── View 2: Platform Adaptations (iOS, macOS Dock, Tinted, Android)
  KIT.viewPlatforms = (c, { dark = true } = {}) => {
    const iosDefault = KIT.renderIcon(c, { size: 104, shape: "ios", mode: dark ? "dark" : "light" });
    const macDock = KIT.renderIcon(c, { size: 104, shape: "mac", mode: dark ? "dark" : "light" });
    const iosTinted = KIT.renderIcon(c, { size: 104, shape: "ios", mode: "tinted" });
    const android = KIT.renderIcon(c, { size: 104, shape: "android", mode: dark ? "dark" : "light" });

    return `<div class="view-platforms ${dark ? "dark" : "light"}">
      <div class="plat-grid">
        <div class="plat-tile">
          <div class="plat-icon-box ${dark ? "dark-box" : "light-box"}">${iosDefault}</div>
          <span class="plat-lbl">Apple Squircle</span>
        </div>
        <div class="plat-tile">
          <div class="plat-icon-box mac-box">${macDock}</div>
          <span class="plat-lbl">macOS Dock Tile</span>
        </div>
        <div class="plat-tile">
          <div class="plat-icon-box dark-box">${iosTinted}</div>
          <span class="plat-lbl">iOS 18 / macOS Tinted</span>
        </div>
        <div class="plat-tile">
          <div class="plat-icon-box ${dark ? "dark-box" : "light-box"}">${android}</div>
          <span class="plat-lbl">Circular Adaptive</span>
        </div>
      </div>
    </div>`;
  };

  // ── View 3: Size Ladder (128px down to 16px)
  KIT.viewLadder = (c, { dark = true } = {}) => {
    const mode = dark ? "dark" : "light";
    const i128 = KIT.renderIcon(c, { size: 120, shape: "mac", mode, shadow: true });
    const i64 = KIT.renderIcon(c, { size: 64, shape: "ios", mode, shadow: false });
    const i32 = KIT.renderIcon(c, { size: 32, shape: "tile", mode, shadow: false });
    const i16 = KIT.renderIcon(c, { size: 16, shape: "tile", mode, shadow: false });

    return `<div class="view-ladder ${dark ? "dark" : "light"}">
      <div class="ladder-row">
        <div class="ladder-item">
          <div class="ladder-box">${i128}</div>
          <span class="ladder-lbl">128px · Mac App / Finder</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i64}</div>
          <span class="ladder-lbl">64px · Launchpad / Spotlight</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i32}</div>
          <span class="ladder-lbl">32px · Menu Bar / Tab</span>
        </div>
        <div class="ladder-item">
          <div class="ladder-box">${i16}</div>
          <span class="ladder-lbl">16px · Browser Favicon</span>
        </div>
      </div>
    </div>`;
  };

  // Dock Companion Apps
  const DOCK_APPS = [
    { name: "Finder", color: "#1d4ed8", icon: `<path d="M22 28C22 24 26 20 32 20H48C54 20 58 24 58 28V52C58 56 54 60 48 60H32C26 60 22 56 22 52Z" fill="#3b82f6"/><path d="M30 32C30 32 35 34 40 34C45 34 50 32 50 32" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="34" cy="38" r="3" fill="#fff"/><circle cx="46" cy="38" r="3" fill="#fff"/>` },
    { name: "Safari", color: "#0284c7", icon: `<circle cx="40" cy="40" r="20" fill="none" stroke="#fff" stroke-width="3"/><polygon points="40,24 45,38 40,40 35,38" fill="#ef4444"/><polygon points="40,56 45,42 40,40 35,42" fill="#fff"/>` },
    { name: "Terminal", color: "#0f172a", icon: `<path d="M26 32L36 40L26 48" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 48H52" stroke="#10b981" stroke-width="5" stroke-linecap="round"/>` },
    { name: "VS Code", color: "#007acc", icon: `<path d="M24 34L38 24L54 32L24 54V34Z" fill="#2563eb"/><path d="M24 46L38 56L54 48L24 26V46Z" fill="#3b82f6"/>` },
    { name: "Obsidian", color: "#4c1d95", icon: `<polygon points="40,22 56,36 48,58 32,58 24,36" fill="#8b5cf6"/>` },
    { name: "Settings", color: "#475569", icon: `<circle cx="40" cy="40" r="14" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="5 3"/><circle cx="40" cy="40" r="6" fill="#fff"/>` },
  ];

  const dockItem = (app, size = 40) => {
    return `<div class="dock-app-icon">
      <svg width="${size}" height="${size}" viewBox="0 0 80 80">
        <defs><clipPath id="cp_mac_${app.name}"><rect x="6" y="6" width="68" height="68" rx="16"/></clipPath></defs>
        <rect x="6" y="6" width="68" height="68" rx="16" fill="${app.color}"/>
        <g clip-path="url(#cp_mac_${app.name})">${app.icon}</g>
      </svg>
    </div>`;
  };

  // ── View 4: macOS Dock & Desktop Context
  KIT.viewDock = (c, { dark = true } = {}) => {
    const polyIcon = KIT.renderIcon(c, { size: 42, shape: "mac", mode: dark ? "dark" : "light", shadow: true });

    return `<div class="view-dock ${dark ? "dark" : "light"}">
      <div class="dock-mock">
        <div class="dock-menubar">
          <div class="dock-menubar-left">
            <span></span>
            <span style="font-weight:700;">Polymath</span>
            <span>File</span>
            <span>Course</span>
            <span>Agent</span>
            <span>View</span>
          </div>
          <div class="dock-menubar-right">
            <span>Agent Active ⚡</span>
            <span>9:41 AM</span>
          </div>
        </div>

        <div class="dock-desktop-content">
          <div class="dock-app-window">
            <div class="dock-win-titlebar">
              <span class="dock-win-dot dot-red"></span>
              <span class="dock-win-dot dot-yellow"></span>
              <span class="dock-win-dot dot-green"></span>
              <span class="dock-win-title">Polymath — LLM Inference Architecture (Chapter 3)</span>
            </div>
            <div class="dock-win-body">
              <div><span class="dim">// Course Runtime Active:</span> <span class="acc">&lt;RooflinePlot /&gt;</span></div>
              <div>&gt; Model: Transformer-70B · KV Cache: FP8</div>
              <div>&gt; Memory Bound: 3.2 TB/s HBM3 Bandwidth</div>
              <div style="color:#10b981;">✔ Claude Code pre-seeded with MCP authoring skills</div>
            </div>
          </div>
        </div>

        <div class="dock-shelf">
          ${dockItem(DOCK_APPS[0])}
          ${dockItem(DOCK_APPS[1])}
          ${dockItem(DOCK_APPS[2])}
          <div class="dock-app-icon active">
            ${polyIcon}
          </div>
          ${dockItem(DOCK_APPS[3])}
          ${dockItem(DOCK_APPS[4])}
          ${dockItem(DOCK_APPS[5])}
        </div>
      </div>
    </div>`;
  };

  // Helper to attach default multi-views to any candidate
  KIT.attachViews = (c) => {
    c.views = [
      {
        name: "Stage · Icon",
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
        name: "macOS Dock Context",
        render: ({ dark }) => KIT.viewDock(c, { dark }),
      },
    ];
    c.render = ({ dark }) => KIT.viewStage(c, { size: 240, dark, isThumb: true });
    return c;
  };
})();
