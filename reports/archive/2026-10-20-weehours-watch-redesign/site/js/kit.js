// Shared building blocks for watchOS sensor & gesture candidates: sample data, icons, Apple Watch chrome.
window.KIT = window.KIT || {};

(() => {
  // SVG Icon path catalog for motion, gestures, accelerometer and micro-UI
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    drop: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    bottle: '<path d="M10 2h4v2h-4z"/><path d="M9 4h6v3l2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l2-2z"/><path d="M7 13h10M7 17h6"/>',
    breast: '<path d="M12 21a8 8 0 0 0 8-8c0-3.5-3-7-8-11-5 4-8 7.5-8 11a8 8 0 0 0 8 8z"/><circle cx="12" cy="14" r="1.5"/>',
    diaper: '<path d="M4 6h16v3c0 7-3.5 11-8 11S4 16 4 9V6z"/><path d="M4 9c3 0 5-1.5 5-3M20 9c-3 0-5-1.5-5-3"/>',
    poop: '<path d="M12 3c-1 2-2 3-3 4-2.5 2.5-3 5-1 7.5 1.5 1.8 4 2.5 7 1.5 3-1 4-3.5 3-6-.8-2-2.5-3.5-4-5-.6-.7-1.5-1.5-2-2z"/>',
    sparkle: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    pills: '<rect width="16" height="10" x="4" y="7" rx="5"/><line x1="12" x2="12" y1="7" y2="17"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    twin: '<circle cx="7" cy="8" r="4"/><circle cx="17" cy="8" r="4"/><path d="M2 19a5 5 0 0 1 10 0M12 19a5 5 0 0 1 10 0"/>',
    crown: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M20 12h-4M12 20v-4M4 12h4"/>',
    // Hand gestures & sensor icons
    doublePinch: '<path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.7-2.3L3.4 16.6a2 2 0 0 1 2.8-2.8L8 15"/><circle cx="19" cy="4" r="2.5" fill="currentColor"/>',
    pinch: '<circle cx="12" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><path d="M12 10v4"/>',
    clench: '<rect x="6" y="6" width="12" height="12" rx="4"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    tilt: '<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>',
    tiltLeft: '<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>',
    tiltRight: '<path d="m9 18 6-6-6-6"/><path d="M15 12H3"/>',
    flick: '<path d="M2 12h8l3-5 4 10 3-5h2"/>',
    accelerometer: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/>',
    gyro: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9M3 12a9 9 0 0 1 9-9"/>',
    waveMotion: '<path d="M2 12c2.5-4 5.5-4 8 0s5.5 4 8 0 5.5-4 8 0"/>',
    raiseWrist: '<path d="M12 2v20M17 7l-5-5-5 5"/>',
    bump: '<circle cx="7" cy="12" r="5"/><circle cx="17" cy="12" r="5"/><path d="M12 9v6"/>'
  };

  KIT.icon = (name, size = 16, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" class="ico ico-${name}" aria-hidden="true">${P[name] || ""}</svg>`;

  // Apple Watch Status Bar Header (360×440 canvas)
  KIT.watchHeader = ({ time = "9:41", child = "Mia", sensorTag = "" } = {}) => `
    <div class="watch-header">
      <div class="wh-left">
        <span class="wh-time">${time}</span>
        ${sensorTag ? `<span class="wh-sensor-pill">${sensorTag}</span>` : ""}
      </div>
      <div class="wh-right">
        ${child ? `<span class="wh-child-pill">${child}</span>` : ""}
      </div>
    </div>
  `;

  // ── Round 4: the tilt-lock compass (07 + the user's note), shared by candidates 21–25.
  // Sectors map to the watch's existing WCSession actions (WatchApp.swift → AppModel.session(didReceiveMessage:)).
  KIT.sectors = {
    n: { label: "Feed", icon: "drop", color: "#30D158", action: "toggleFeed" },
    e: { label: "Diaper", icon: "diaper", color: "#0A84FF", action: "diaper" },
    s: { label: "Sleep", icon: "moon", color: "#BF5AF2", action: "toggleSleep" },
    w: { label: "Vitamin D", icon: "pills", color: "#FF9F0A", action: "care (pinned[0])" }
  };
  const BUB = { n: [0, -40], e: [26, 0], s: [0, 40], w: [-26, 0] };
  // at: sector the bubble sits in (null = centre); dwell: 0..1 of the 1 s lock; sectors: override labels
  KIT.compass = ({ at = null, dwell = 0, sectors = KIT.sectors, drift = [0, 0], size = 210 } = {}) => {
    const r = size / 2, c = at ? sectors[at].color : "#8E8E93";
    const [dx, dy] = at ? BUB[at] : drift;
    const arc = (dir) => {
      const a0 = { n: -135, e: -45, s: 45, w: 135 }[dir], R = r - 4, rad = (d) => (d * Math.PI) / 180;
      const p = (d) => `${(r + R * Math.cos(rad(d))).toFixed(1)} ${(r + R * Math.sin(rad(d))).toFixed(1)}`;
      return `M${p(a0 + 4)} A${R} ${R} 0 0 1 ${p(a0 + 86)}`;
    };
    const L = 2 * Math.PI * (r - 4) / 4 * (82 / 90);
    return `<div class="cmp" style="width:${size}px;height:${size}px">
      <svg class="cmp-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        ${Object.keys(sectors).map((d) => `<path d="${arc(d)}" stroke="${sectors[d].color}" stroke-opacity="${d === at ? 0.28 : 0.16}" stroke-width="7" fill="none" stroke-linecap="round"/>`).join("")}
        ${at && dwell > 0 ? `<path d="${arc(at)}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${(L * dwell).toFixed(1)} 999"/>` : ""}
        <circle cx="${r}" cy="${r}" r="15" fill="none" stroke="#3A3A3C" stroke-width="1.5" stroke-dasharray="3 3"/>
      </svg>
      ${Object.entries(sectors).map(([d, s]) => `<div class="cmp-l ${d}${d === at ? " on" : ""}" style="--c:${s.color}">${KIT.icon(s.icon, 15)}<span>${s.label}</span></div>`).join("")}
      <div class="cmp-b" style="--c:${c};transform:translate(${dx}px,${dy}px)"></div>
    </div>`;
  };
  // The lock confirmation that replaces the compass after 1 s in a sector: only a double pinch logs it.
  KIT.lockCard = ({ s, title, sub = "Mia · 3:12 AM", left = 0.7, hint = "Double pinch to log" }) => `
    <div class="lock" style="--c:${s.color}">
      <div class="lock-ico">${KIT.icon(s.icon, 34)}</div>
      <div class="lock-t">${title}</div>
      <div class="lock-s">${sub}</div>
      <div class="lock-pinch">${KIT.icon("doublePinch", 18)} ${hint}</div>
      <div class="lock-bar"><i style="width:${left * 100}%"></i></div>
      <div class="lock-x">Tilt away or wait 4 s to cancel</div>
    </div>`;

  // Realistic sample data from Wee Hours specs & models
  KIT.data = {
    baby: { id: "b1", name: "Mia", age: "8 weeks", weight: "4.45 kg" },
    twin: { id: "b2", name: "Leo", age: "8 weeks", weight: "4.62 kg" },
    status: {
      line: "Fed 2h 40m ago · Left next · 120ml",
      predictedNext: { action: "Feed Bottle", details: "120ml recommended", timeSince: "2h 40m" },
      lastFeed: { time: "7:01 AM", elapsed: "2h 40m", kind: "bottle", amount: "120ml", side: "left" },
      lastDiaper: { time: "8:26 AM", elapsed: "1h 15m", kind: "wet" },
      lastSleep: { time: "8:15 AM", elapsed: "1h 26m awake", duration: "48m nap", state: "awake" },
      activeNursing: { leftSeconds: 522, rightSeconds: 0, activeSide: "left" }
    }
  };
})();
