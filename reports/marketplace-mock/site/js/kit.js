// Building blocks copied from reports/ios-all-redesign: icons, drawn scene covers, iOS status bar.
window.WP = window.WP || {};

(() => {
  const P = {
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    update: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    adult: '<circle cx="12" cy="6" r="3.2"/><path d="M6 21v-4.5a6 6 0 0 1 12 0V21"/>',
    kid: '<circle cx="12" cy="8.5" r="2.7"/><path d="M8 21v-3.5a4 4 0 0 1 8 0V21"/>',
    paw: '<circle cx="7" cy="9" r="1.6"/><circle cx="11" cy="6" r="1.6"/><circle cx="15" cy="6.5" r="1.6"/><circle cx="18" cy="10" r="1.6"/><path d="M8.5 17.5c0-2.5 1.8-5 4-5s4 2.5 4 5c0 1.6-1.5 2-4 2s-4-.4-4-2Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    open: '<path d="M7 17 17 7M8 7h9v9"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    nav: '<path d="m3 11 18-8-8 18-2-8z"/>',
    event: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r=".8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    shake: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>',
    disk: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15h.01M11 15h6"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    star: '<path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    userplus: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    bed: '<path d="M3 20V6M3 13h18v7M21 13a4 4 0 0 0-4-4h-6v4"/><circle cx="7" cy="10" r="2"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
    locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="7"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
    apple: '<path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.9-.8-3.1-.8C6.8 7.3 5 8.6 5 11.6c0 1.8.7 3.8 1.6 5 .7 1.1 1.4 2.1 2.5 2.1 1 0 1.4-.7 2.6-.7s1.6.7 2.6.7c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.4-.9-2.4-3.8ZM14.3 5.6c.6-.7 1-1.6.9-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.6-.9 2.5.9.1 1.8-.5 2.4-1.2Z" fill="currentColor" stroke="none"/>',
  };
  WP.icon = (name, size = 18, sw = 2) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

  // ---------- formatting
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  WP.parse = parse;
  WP.mon = (s) => MON[parse(s).getMonth()];
  WP.day = (s) => parse(s).getDate();
  WP.year = (s) => parse(s).getFullYear();
  WP.range = (t, withYear = false) => {
    const a = parse(t.start), b = parse(t.end);
    const y = withYear || a.getFullYear() !== WP.today.getFullYear() ? `, ${b.getFullYear()}` : "";
    return a.getMonth() === b.getMonth()
      ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}${y}`
      : `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}${y}`;
  };
  WP.nights = (t) => Math.round((parse(t.end) - parse(t.start)) / 864e5);
  WP.daysUntil = (t) => Math.round((parse(t.start) - WP.today) / 864e5);
  WP.when = (t) => {
    const d = WP.daysUntil(t);
    if (d <= 0) return "Now";
    if (d === 1) return "Tomorrow";
    if (d < 60) return `in ${d} days`;
    return `in ${Math.round(d / 30)} months`;
  };
  WP.size = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : Math.round(b / 1e6) + " MB");
  WP.crew = (t) => {
    const v = t.travelers, k = v.kids.length;
    const parts = [`${v.adults} adults`];
    if (k) parts.push(`${k === 1 ? "kid" : "kids"} ${v.kids.join(", ")}`);
    if (v.pets) parts.push(v.pets === 1 ? "dog" : `${v.pets} pets`);
    return parts.join(" · ");
  };
  WP.crewCount = (t) => t.travelers.adults + t.travelers.kids.length;
  WP.crewIcons = (t, size = 13) => {
    const v = t.travelers;
    let h = `<span class="crew">${WP.icon("adult", size)}<b>${v.adults}</b>`;
    if (v.kids.length) h += `${WP.icon("kid", size)}<b>${v.kids.length}</b>`;
    if (v.pets) h += WP.icon("paw", size);
    return h + "</span>";
  };
  WP.statusLabel = (t) => ({
    ready: "Ready offline",
    update: "Update ready",
    downloading: `${t.stage} · ${Math.round(t.progress * 100)}%`,
    cloud: "Not downloaded",
  })[t.status];
  WP.origin = (t) => (t.sharedBy ? `Shared by ${t.sharedBy.split("@")[0].replace(".", " ")}` : t.nearby ? "From a nearby phone" : "");

  // ---------- progress ring
  WP.ring = (pct, size = 28, sw = 3, label = true) => {
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    return `<span class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="${sw}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>${label ? `<i>${Math.round(pct * 100)}</i>` : ""}</span>`;
  };

  // ---------- scene covers (drawn from manifest.theme.scene, the same vocabulary the bundle uses)
  let uid = 0;
  const mix = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  WP.scene = (t, { dim = false } = {}) => {
    const s = t.scene, id = "g" + uid++;
    const W = 160, H = 100, hz = 66;
    const acc = t.accent;
    let g = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient></defs>`;
    g += `<rect width="${W}" height="${H}" fill="url(#${id})"/>`;
    if (s.sun === "sun") g += `<circle cx="122" cy="26" r="11" fill="#FFF3C4"/><circle cx="122" cy="26" r="17" fill="#FFF3C4" opacity=".35"/>`;
    if (s.sun === "low-sun") g += `<circle cx="104" cy="${hz - 6}" r="20" fill="#FFD9A0"/><circle cx="104" cy="${hz - 6}" r="29" fill="#FFE7C2" opacity=".45"/>`;
    if (s.sun === "moon") g += `<circle cx="120" cy="24" r="9" fill="#FFF8E8"/><circle cx="125" cy="21" r="8" fill="${s.sky[0]}"/>${[[30, 14], [56, 26], [84, 12], [146, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#fff"/>`).join("")}`;
    const far = mix(acc, s.sky[1], 0.55), mid = mix(acc, "#3a2a22", 0.15);
    if (s.mountains === "rolling") g += `<path d="M0 ${hz - 4} C30 ${hz - 22} 55 ${hz - 18} 80 ${hz - 6} S130 ${hz - 26} 160 ${hz - 10} V${H} H0Z" fill="${far}"/>`;
    if (s.mountains === "peaks" || s.mountains === "snowy-peaks") {
      g += `<path d="M-5 ${hz} L28 ${hz - 34} L52 ${hz - 12} L82 ${hz - 44} L112 ${hz - 10} L138 ${hz - 30} L170 ${hz} Z" fill="${far}"/>`;
      if (s.mountains === "snowy-peaks") g += `<path d="M82 ${hz - 44} L74 ${hz - 33} L80 ${hz - 35} L85 ${hz - 31} L91 ${hz - 34}Z M28 ${hz - 34} L21 ${hz - 25} L28 ${hz - 27} L35 ${hz - 25}Z M138 ${hz - 30} L132 ${hz - 23} L139 ${hz - 24} L144 ${hz - 23}Z" fill="#fff"/>`;
    }
    if (s.skyline) {
      const b = [[8, 22], [20, 34], [34, 18], [44, 40], [58, 26], [70, 30], [84, 46], [96, 24], [108, 32], [120, 20], [132, 36], [146, 26]];
      g += b.map(([x, h]) => `<rect x="${x}" y="${hz - h}" width="11" height="${h}" fill="${mix(acc, s.sky[1], 0.35)}"/>`).join("");
      g += b.filter((_, i) => i % 2).map(([x, h]) => `<rect x="${x + 3}" y="${hz - h + 6}" width="2" height="2" fill="#FFE9A8"/><rect x="${x + 6}" y="${hz - h + 12}" width="2" height="2" fill="#FFE9A8"/>`).join("");
    }
    const ground = { snow: "#F4F7FB", grass: mix("#7FA66A", acc, 0.15), sand: "#F2D6A2", rock: "#A79C8E", city: mix(acc, "#E9DCCB", 0.6) }[s.ground] || "#ddd";
    if (s.water && s.water !== "none") {
      const wc = s.water === "frozen-lake" ? "#DCE9F5" : mix("#5BA4C8", acc, 0.15);
      g += `<rect y="${hz}" width="${W}" height="${H - hz}" fill="${wc}"/>`;
      g += `<path d="M14 ${hz + 8} h18 M60 ${hz + 13} h26 M110 ${hz + 7} h20 M40 ${hz + 21} h14" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>`;
      g += `<path d="M0 ${H - 12} C40 ${H - 18} 90 ${H - 8} 160 ${H - 15} V${H} H0Z" fill="${ground}"/>`;
    } else {
      g += `<path d="M0 ${hz} C50 ${hz - 4} 110 ${hz + 4} 160 ${hz - 2} V${H} H0Z" fill="${ground}"/>`;
    }
    const tree = {
      pine: (x, y, k) => `<path d="M${x} ${y - 20 * k} L${x - 7 * k} ${y} H${x + 7 * k}Z" fill="${mix("#2F5D3A", acc, 0.1)}"/>`,
      "snowy-pine": (x, y, k) => `<path d="M${x} ${y - 20 * k} L${x - 7 * k} ${y} H${x + 7 * k}Z" fill="#2F5D4A"/><path d="M${x} ${y - 20 * k} L${x - 3 * k} ${y - 12 * k} H${x + 3 * k}Z" fill="#fff"/>`,
      autumn: (x, y, k) => `<rect x="${x - 1}" y="${y - 8 * k}" width="2" height="${8 * k}" fill="#6B4430"/><circle cx="${x}" cy="${y - 12 * k}" r="${7 * k}" fill="${["#D9562B", "#E8A33A", "#B8452A"][Math.round(x) % 3]}"/>`,
      palm: (x, y, k) => `<path d="M${x} ${y} q2 -10 ${4 * k} ${-20 * k}" stroke="#7A5A3A" stroke-width="2" fill="none"/><path d="M${x + 4 * k} ${y - 20 * k} q-10 -2 -14 6 M${x + 4 * k} ${y - 20 * k} q10 -3 13 5 M${x + 4 * k} ${y - 20 * k} q-4 -8 -11 -8 M${x + 4 * k} ${y - 20 * k} q6 -8 12 -6" stroke="#3E7D4E" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    }[s.trees];
    if (tree) {
      const spots = s.water && s.water !== "none" ? [[12, H - 12, 1.1], [26, H - 13, 0.8], [148, H - 13, 1]] : [[14, hz + 6, 1], [28, hz + 10, 1.3], [134, hz + 4, 0.9], [148, hz + 10, 1.2], [60, hz + 3, 0.7]];
      g += spots.map(([x, y, k]) => tree(x, y, k)).join("");
    }
    return `<svg class="scene${dim ? " dim" : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
  };

  // iOS status bar + home indicator, shared by every candidate.
  WP.statusBar = () =>
    `<div class="sb"><span class="sb-time">9:41</span><span class="sb-island"></span><span class="sb-icons"><svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg><svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 2.2c2.3 0 4.4.9 5.9 2.4l1.1-1.1A9.9 9.9 0 0 0 8 .6 9.9 9.9 0 0 0 1 3.5l1.1 1.1A8.3 8.3 0 0 1 8 2.2Zm0 3.2c1.4 0 2.7.6 3.6 1.5l1.1-1.1A6.6 6.6 0 0 0 8 3.8c-1.8 0-3.5.7-4.7 2l1.1 1.1c.9-.9 2.2-1.5 3.6-1.5ZM8 8.6c-.6 0-1.1.2-1.5.6L8 10.8l1.5-1.6c-.4-.4-.9-.6-1.5-.6Z" fill="currentColor"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><path d="M24 4v4c.8-.3 1.3-1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".4"/></svg></span></div>`;
  WP.homeBar = () => `<div class="hb"></div>`;
})();
