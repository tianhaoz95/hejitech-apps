// Shared building blocks for the FitLoop logo review:
// - Apple iOS continuous superellipse (squircle) math on 1024x1024 grid
// - Multi-surface icon renderers: iOS squircle, Even Hub Store Icon (24x24 pixel-grid), Even G2 HUD glasses preview, Apple Watch casing, macOS dock tile, and Favicon ladder
window.KIT = window.KIT || {};

(() => {
  const KIT = window.KIT;
  // Apple iOS continuous corner superellipse (n=5) on 1024x1024 grid
  const squircle = (() => {
    const N = 5, R = 512, pts = [];
    for (let i = 0; i < 360; i += 3) {
      const t = (i * Math.PI) / 180, ct = Math.cos(t), st = Math.sin(t);
      pts.push([512 + R * Math.sign(ct) * Math.abs(ct) ** (2 / N), 512 + R * Math.sign(st) * Math.abs(st) ** (2 / N)]);
    }
    return "M" + pts.map((q) => q.map((v) => v.toFixed(1)).join(" ")).join(" L") + " Z";
  })();
  KIT.squircle = squircle;

  // Convert a 12-line 12-character grid (# and .) into crisp 12x12 SVG
  KIT.gridToSvg = (gridStr, color = "#F4F4F4") => {
    if (!gridStr) return "";
    const lines = gridStr.trim().split("\n").map(l => l.trim()).filter(Boolean);
    let rects = "";
    for (let y = 0; y < lines.length; y++) {
      for (let x = 0; x < lines[y].length; x++) {
        if (lines[y][x] === "#") {
          rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 12 12" width="100%" height="100%" shape-rendering="crispEdges">${rects}</svg>`;
  };

  // Primary icon wrapper: 320x320 stage displaying an iOS squircle app icon + Even Hub badge
  KIT.renderCard = (c, dark = false) => {
    const svgContent = typeof c.svg === "function" ? c.svg({ dark }) : "";
    const evenSvg = KIT.gridToSvg(c.evenGrid, "#F4F4F4");
    const uid = "c_" + c.id + (dark ? "_d" : "_l");
    return `
      <div class="icon-stage">
        <svg class="icon-svg" viewBox="0 0 1024 1024" width="210" height="210" aria-label="${c.name}">
          <defs>
            <clipPath id="sq_${uid}">
              <path d="${squircle}"/>
            </clipPath>
            <filter id="sh_${uid}" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#000" flood-opacity="0.38"/>
            </filter>
          </defs>
          <g filter="url(#sh_${uid})">
            <g clip-path="url(#sq_${uid})">
              ${svgContent}
            </g>
          </g>
        </svg>
        <div class="evenhub-badge" title="Even Hub 24×24 Store Icon">
          <span class="eh-lbl">EVEN HUB</span>
          <div class="eh-mini-icon">${evenSvg}</div>
        </div>
      </div>
    `;
  };

  // Multi-platform Detail Views
  KIT.renderView = (c, mode, dark = false) => {
    const svgContent = typeof c.svg === "function" ? c.svg({ dark }) : "";
    const monoSvg = typeof c.svgMono === "function" ? c.svgMono() : svgContent;
    const uid = "v_" + c.id + "_" + mode + (dark ? "_d" : "_l");

    switch (mode) {
      case "ios":
        return `
          <div class="view-surface view-ios">
            <svg viewBox="0 0 1024 1024" width="230" height="230">
              <defs>
                <clipPath id="sq_${uid}"><path d="${squircle}"/></clipPath>
                <filter id="sh_${uid}" x="-20%" y="-20%" width="140%" height="150%">
                  <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000" flood-opacity="0.32"/>
                </filter>
              </defs>
              <g filter="url(#sh_${uid})">
                <g clip-path="url(#sq_${uid})">
                  ${svgContent}
                </g>
              </g>
            </svg>
            <span class="view-tag">iOS App Icon (1024 squircle)</span>
          </div>
        `;

      case "evenhub":
        const grid = (c.evenGrid || "").trim();
        const gridSvg = KIT.gridToSvg(grid, "#F4F4F4");
        const oledSvg = KIT.gridToSvg(grid, "#00FF66");
        return `
          <div class="view-surface view-evenhub">
            <div class="evenhub-store-card">
              <div class="eh-header">
                <span>EVEN HUB // APP STORE</span>
                <span class="eh-spec">24×24 RGBA • #F4F4F4</span>
              </div>
              <div class="eh-body">
                <div class="eh-icon-box">
                  <div class="eh-1x-render">
                    ${gridSvg}
                  </div>
                  <small>1× Real</small>
                </div>
                <div class="eh-icon-box">
                  <div class="eh-icon-render">
                    ${gridSvg}
                  </div>
                  <small>Store 2×</small>
                </div>
                <div class="eh-icon-box">
                  <div class="eh-icon-render eh-oled-render">
                    ${oledSvg}
                  </div>
                  <small>G2 OLED</small>
                </div>
                <div class="eh-info">
                  <b>FitLoop</b>
                  <p>Your agent's plan, mid-set</p>
                  <div class="eh-badges">
                    <span class="eh-tag">HEALTH</span>
                    <span class="eh-status">STORE READY</span>
                  </div>
                </div>
              </div>
              <div class="eh-grid-preview">
                <pre class="eh-code">${grid}</pre>
                <small>12×12 Grid<br>2×2 px blocks</small>
              </div>
            </div>
            <span class="view-tag">Even Hub Store Icon & Listing (24×24 RGBA)</span>
          </div>
        `;

      case "glasses":
        return `
          <div class="view-surface view-glasses">
            <div class="glasses-hud">
              <div class="hud-header">
                <span class="hud-title">FITLOOP // G2 HUD</span>
                <span class="hud-hr">146 BPM</span>
              </div>
              <div class="hud-body">
                <svg viewBox="0 0 1024 1024" width="110" height="110" class="hud-svg">
                  ${monoSvg}
                </svg>
                <div class="hud-metrics">
                  <div><span>SET</span><b>3 / 4</b></div>
                  <div><span>REST</span><b>00:45</b></div>
                  <div><span>REPS</span><b>12</b></div>
                </div>
              </div>
              <div class="hud-footer">
                <span>R1 RING: CONNECTED</span>
                <span>MCP: SYNCED</span>
              </div>
            </div>
            <span class="view-tag">Even G2 Smart Glasses (Green OLED HUD)</span>
          </div>
        `;

      case "watch":
        return `
          <div class="view-surface view-watch">
            <div class="watch-chassis">
              <div class="watch-crown"></div>
              <div class="watch-button"></div>
              <div class="watch-screen">
                <svg viewBox="0 0 1024 1024" width="170" height="170">
                  <defs>
                    <clipPath id="circ_${uid}"><circle cx="512" cy="512" r="512"/></clipPath>
                  </defs>
                  <g clip-path="url(#circ_${uid})">
                    ${svgContent}
                  </g>
                </svg>
              </div>
            </div>
            <span class="view-tag">Apple Watch (44mm circular dial)</span>
          </div>
        `;

      case "mac":
        return `
          <div class="view-surface view-mac">
            <div class="mac-dock-preview">
              <svg viewBox="0 0 1024 1024" width="185" height="185">
                <defs>
                  <clipPath id="mac_${uid}"><rect x="96" y="96" width="832" height="832" rx="192"/></clipPath>
                  <filter id="mac_sh_${uid}" x="-20%" y="-20%" width="140%" height="150%">
                    <feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000" flood-opacity="0.45"/>
                  </filter>
                </defs>
                <g filter="url(#mac_sh_${uid})">
                  <g clip-path="url(#mac_${uid})">
                    <g transform="translate(96,96) scale(0.8125)">
                      ${svgContent}
                    </g>
                  </g>
                </g>
              </svg>
            </div>
            <span class="view-tag">macOS Dock & Desktop Tile</span>
          </div>
        `;

      case "ladder":
        return `
          <div class="view-surface view-ladder">
            <div class="ladder-row">
              <div class="ladder-item">
                <svg viewBox="0 0 1024 1024" width="68" height="68">
                  <clipPath id="l72_${uid}"><path d="${squircle}"/></clipPath>
                  <g clip-path="url(#l72_${uid})">${svgContent}</g>
                </svg>
                <small>68px</small>
              </div>
              <div class="ladder-item">
                <svg viewBox="0 0 1024 1024" width="48" height="48">
                  <clipPath id="l48_${uid}"><path d="${squircle}"/></clipPath>
                  <g clip-path="url(#l48_${uid})">${svgContent}</g>
                </svg>
                <small>48px</small>
              </div>
              <div class="ladder-item">
                <svg viewBox="0 0 1024 1024" width="32" height="32">
                  <clipPath id="l32_${uid}"><path d="${squircle}"/></clipPath>
                  <g clip-path="url(#l32_${uid})">${svgContent}</g>
                </svg>
                <small>32px</small>
              </div>
              <div class="ladder-item">
                <svg viewBox="0 0 1024 1024" width="16" height="16">
                  <clipPath id="l16_${uid}"><path d="${squircle}"/></clipPath>
                  <g clip-path="url(#l16_${uid})">${svgContent}</g>
                </svg>
                <small>16px</small>
              </div>
            </div>
            <span class="view-tag">Favicon & Glanceable Size Ladder (68 to 16px)</span>
          </div>
        `;

      default:
        return KIT.renderCard(c, dark);
    }
  };
})();
