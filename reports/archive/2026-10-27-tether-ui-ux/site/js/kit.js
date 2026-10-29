// Shared building blocks for Tether candidates: sample data, icons, formatting, chrome.
window.KIT = window.KIT || {};

(() => {
  const P = {
    web: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"/>',
    ssh: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    files: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    splitH: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
    splitV: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    max: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    restore: '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>',
    command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    key: '<path d="M21 2l-2 2m-1.5 1.5L16 7l-2-2-4 4a6.5 6.5 0 1 0 7.5 7.5l4-4-2-2 1.5-1.5M7 17a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    display: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    trackpad: '<rect width="20" height="16" x="2" y="4" rx="3"/><line x1="2" y1="15" x2="22" y2="15"/><line x1="12" y1="15" x2="12" y2="20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    ram: '<path d="M6 19v2M10 19v2M14 19v2M18 19v2M6 3v2M10 3v2M14 3v2M18 3v2M2 7h20v10H2z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    cursor: '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  };

  KIT.icon = (name, size = 16, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" class="ttr-icon" aria-hidden="true">${P[name] || ""}</svg>`;

  // Preset Layout SVG Thumbnails
  KIT.presetThumb = (id, active = false) => {
    const stroke = active ? "#38bdf8" : "currentColor";
    const bg = active ? "rgba(56, 189, 248, 0.15)" : "transparent";
    if (id === 1) {
      return `<svg width="18" height="14" viewBox="0 0 18 14" fill="${bg}" stroke="${stroke}" stroke-width="1.2"><rect x="1" y="1" width="16" height="12" rx="1.5"/></svg>`;
    } else if (id === 2) {
      return `<svg width="18" height="14" viewBox="0 0 18 14" fill="${bg}" stroke="${stroke}" stroke-width="1.2"><rect x="1" y="1" width="16" height="12" rx="1.5"/><line x1="9" y1="1" x2="9" y2="13"/></svg>`;
    } else if (id === 3) {
      return `<svg width="18" height="14" viewBox="0 0 18 14" fill="${bg}" stroke="${stroke}" stroke-width="1.2"><rect x="1" y="1" width="16" height="12" rx="1.5"/><line x1="8.5" y1="1" x2="8.5" y2="13"/><line x1="8.5" y1="7" x2="17" y2="7"/></svg>`;
    } else if (id === 4) {
      return `<svg width="18" height="14" viewBox="0 0 18 14" fill="${bg}" stroke="${stroke}" stroke-width="1.2"><rect x="1" y="1" width="16" height="12" rx="1.5"/><line x1="9" y1="1" x2="9" y2="13"/><line x1="1" y1="7" x2="17" y2="7"/></svg>`;
    }
    return "";
  };

  // Sample Workspace Data grounded in Tether models
  KIT.data = {
    display: {
      name: "LG UltraFine 4K",
      res: "3840×2160 @ 60Hz",
      mode: "USB-C DisplayPort Alt Mode",
      status: "Mirror / Extended Display Active",
    },
    device: {
      model: "iPhone 15 Pro",
      battery: "84%",
      charging: true,
      thermal: "Nominal",
      orientation: "Landscape (Docked)",
    },
    hosts: [
      { id: "h1", name: "prod-api-us-east", ip: "10.0.4.12", ping: "22ms", load: "0.48", os: "Ubuntu 24.04 LTS", status: "online", cipher: "chacha20-poly1305" },
      { id: "h2", name: "hetzner-staging-eu", ip: "178.63.42.108", ping: "78ms", load: "1.12", os: "Debian 12", status: "online", cipher: "aes256-gcm" },
      { id: "h3", name: "pi5-homelab-local", ip: "192.168.1.18", ping: "4ms", load: "0.08", os: "Alpine Linux 3.20", status: "online", cipher: "ed25519" },
    ],
    tabs: {
      web1: {
        id: "tab-w1",
        type: "web",
        title: "PR #18 · Tether VT100 Scrollback Buffer",
        url: "https://github.com/hejitech-apps/hejitech-apps/pull/18",
        favicon: "GH",
        ssl: true,
      },
      ssh1: {
        id: "tab-s1",
        type: "ssh",
        title: "root@prod-api-us-east: ~/tether",
        host: "prod-api-us-east",
        user: "root",
        path: "~/tether",
        prompt: "root@prod-api:~/tether# ",
      },
      files1: {
        id: "tab-f1",
        type: "files",
        title: "SFTP: /var/www/tether-api/dist",
        mode: "sftp",
        path: "/var/www/tether-api/dist",
        itemsCount: 14,
      },
      ssh2: {
        id: "tab-s2",
        type: "ssh",
        title: "pi5-homelab: docker compose ps",
        host: "pi5-homelab-local",
        user: "deploy",
        path: "~/stack",
        prompt: "deploy@pi5:~/stack$ ",
      },
    },
    fileList: [
      { name: "..", type: "up", size: "-", date: "-" },
      { name: "assets/", type: "dir", size: "4 items", date: "Oct 27 14:22" },
      { name: "index.html", type: "html", size: "14.2 KB", date: "Oct 27 16:50" },
      { name: "worker.js", type: "js", size: "184.8 KB", date: "Oct 27 17:05" },
      { name: "tether-core.wasm", type: "wasm", size: "412.0 KB", date: "Oct 26 21:10" },
      { name: "config.production.json", type: "json", size: "1.8 KB", date: "Oct 27 09:15" },
      { name: "style.css", type: "css", size: "32.4 KB", date: "Oct 27 15:40" },
      { name: "robots.txt", type: "txt", size: "240 B", date: "Oct 20 03:00" },
    ],
    terminalLog: [
      { line: "root@prod-api-us-east:~/tether# pnpm run build:worker", type: "input" },
      { line: "⚡ [wrangler] Building worker entry service/web/src/worker.ts...", type: "info" },
      { line: "✔ Compiled 42 modules into .wrangler/deploy/worker.js (214ms)", type: "success" },
      { line: "✨ Uploading worker (184.8 KiB) to Cloudflare global network...", type: "info" },
      { line: "Deployment complete: https://tether.hejitech.workers.dev", type: "accent" },
      { line: "root@prod-api-us-east:~/tether# docker compose logs -f --tail=20 api", type: "input" },
      { line: "2026-10-27T17:58:02Z [INFO] HTTP/2 GET /api/v1/workspace 200 OK (1.4ms)", type: "log" },
      { line: "2026-10-27T17:58:04Z [INFO] MCP stream session initialized for token ttr_...", type: "log" },
      { line: "2026-10-27T17:58:08Z [INFO] Synchronized split layout (3 panes, 1+2 preset)", type: "log" },
      { line: "root@prod-api-us-east:~/tether# █", type: "cursor" },
    ],
    dockerLog: [
      { line: "deploy@pi5:~/stack$ docker compose ps", type: "input" },
      { line: "NAME                IMAGE              COMMAND                  SERVICE   STATUS", type: "header" },
      { line: "tether-sync-db      postgres:16-alpine \"docker-entrypoint.s…\"   db        Up 14 days (healthy)", type: "success" },
      { line: "tether-worker-mcp   tether-mcp:v1.3    \"node dist/mcp.js\"       mcp       Up 6 days (healthy)", type: "success" },
      { line: "tether-caddy-proxy  caddy:2.8-alpine   \"caddy run --config…\"   proxy     Up 14 days", type: "success" },
      { line: "deploy@pi5:~/stack$ █", type: "cursor" },
    ],
  };

  // Helper to render phone controller frame
  KIT.renderPhoneController = (mode = "touchpad", opts = {}) => {
    const { title = "Trackpad", sub = "1-finger tap click · 2-finger scroll" } = opts;
    return `
      <div class="ph-controller-screen">
        <div class="ph-topbar">
          <div class="ph-status-pill"><span class="ph-dot live"></span> Ext Display: 4K Active</div>
          <div class="ph-mode-tabs">
            <span class="ph-tab ${mode === "touchpad" ? "active" : ""}">Touchpad</span>
            <span class="ph-tab ${mode === "keyboard" ? "active" : ""}">Keys</span>
            <span class="ph-tab ${mode === "macros" ? "active" : ""}">Macros</span>
            <span class="ph-tab ${mode === "settings" ? "active" : ""}">Settings</span>
          </div>
        </div>
        <div class="ph-surface ${mode}">
          ${mode === "touchpad" ? `
            <div class="ph-trackpad-area">
              <div class="ph-trackpad-crosshair"></div>
              <div class="ph-trackpad-hint">
                <span class="ph-hint-title">${title}</span>
                <span class="ph-hint-sub">${sub}</span>
              </div>
            </div>
            <div class="ph-click-bar">
              <button class="ph-btn left" type="button">Left Click</button>
              <button class="ph-btn drag" type="button">Hold to Drag</button>
              <button class="ph-btn right" type="button">Right Click</button>
            </div>
          ` : mode === "keyboard" ? `
            <div class="ph-keys-deck">
              <div class="ph-key-row">
                <span class="ph-key fn">ESC</span>
                <span class="ph-key fn">TAB</span>
                <span class="ph-key fn">CTRL</span>
                <span class="ph-key fn">ALT</span>
                <span class="ph-key fn danger">^C</span>
                <span class="ph-key fn danger">^D</span>
                <span class="ph-key">|</span>
                <span class="ph-key">~</span>
                <span class="ph-key">/</span>
              </div>
              <div class="ph-key-row arrows">
                <span class="ph-key nav">▲</span>
                <div class="ph-key-col">
                  <span class="ph-key nav">◀</span>
                  <span class="ph-key nav">▼</span>
                  <span class="ph-key nav">▶</span>
                </div>
                <span class="ph-key action">Enter ↵</span>
              </div>
            </div>
          ` : mode === "macros" ? `
            <div class="ph-macro-grid">
              <button class="ph-macro-tile" type="button"><span class="m-icon">⚡</span><b>tmux attach</b><small>Resume dev</small></button>
              <button class="ph-macro-tile" type="button"><span class="m-icon">🐳</span><b>docker ps</b><small>List containers</small></button>
              <button class="ph-macro-tile" type="button"><span class="m-icon">🐙</span><b>git status</b><small>Branch state</small></button>
              <button class="ph-macro-tile" type="button"><span class="m-icon">📊</span><b>htop</b><small>Server load</small></button>
              <button class="ph-macro-tile" type="button"><span class="m-icon">📁</span><b>Insert Path</b><small>Focused term</small></button>
              <button class="ph-macro-tile danger" type="button"><span class="m-icon">⛔</span><b>Kill Active</b><small>SIGINT (^C)</small></button>
            </div>
          ` : `
            <div class="ph-settings-sheet">
              <div class="ph-set-row"><span>Touchpad Sensitivity</span><input type="range" value="65" /></div>
              <div class="ph-set-row"><span>Physical Mouse Capture</span><b>Active (USB Dock)</b></div>
              <div class="ph-set-row"><span>Orientation</span><b>Landscape Dock</b></div>
            </div>
          `}
        </div>
      </div>
    `;
  };
})();
