// Gallery-specific building blocks shared by all ten candidates: facts, polaroids, maps, the web shell.
(() => {
  const I = WP.icon;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  WP.esc = esc;
  WP.T = WP.templates;

  WP.crewTxt = (t) => {
    const c = t.crew, p = [`${c.adults} adults`];
    if (c.kids.length) p.push(`kids ${c.kids.join(", ")}`);
    if (c.pets) p.push("dog");
    return p.join(" · ");
  };
  WP.crewIc = (t, size = 13) => {
    const c = t.crew;
    let h = `<span class="crew">${I("adult", size)}<b>${c.adults}</b>`;
    if (c.kids.length) h += `${I("kid", size)}<b>${c.kids.length}</b>`;
    if (c.pets) h += I("paw", size);
    return h + "</span>";
  };
  WP.len = (t) => `${t.days} days`;
  WP.facts = (t) => `${t.days} days · ${WP.MONTHS[t.month]} · ${t.pace}`;
  WP.k = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));

  // Polaroid of a template's drawn scene.
  WP.pol = (t, { cap = t.title, meta = WP.facts(t), tape = "", rot = 0, cls = "", stamp = false, ratio = "" } = {}) =>
    `<div class="pol ${cls}" style="${rot ? `transform:rotate(${rot}deg);` : ""}">${tape ? `<i class="tape ${tape}"></i>` : ""}<div class="ph"${ratio ? ` style="aspect-ratio:${ratio}"` : ""}>${WP.scene(t)}${stamp ? `<span class="pm">${WP.postmark(t, 54)}</span>` : ""}</div><div class="cap">${esc(cap)}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div>`;

  // Round "traveled" postmark: the proof the trip actually happened.
  WP.postmark = (t, size = 64, color = "#A9583F") => {
    const id = "pm" + Math.random().toString(36).slice(2, 8);
    return `<svg class="postmark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-label="Traveled ${t.traveled}"><defs><path id="${id}" d="M32 32 m-22 0 a22 22 0 1 1 44 0 a22 22 0 1 1 -44 0"/></defs><circle cx="32" cy="32" r="29" fill="none" stroke="${color}" stroke-width="2.4"/><circle cx="32" cy="32" r="16" fill="none" stroke="${color}" stroke-width="1.4"/><text font-size="7.2" font-weight="800" letter-spacing="1.6" fill="${color}" font-family="Inter,sans-serif"><textPath href="#${id}">TRAVELED · WAYPACK · TRAVELED ·</textPath></text><text x="32" y="30" text-anchor="middle" font-size="8.5" font-weight="900" fill="${color}" font-family="Inter,sans-serif">${t.traveled.split(" ")[0].toUpperCase()}</text><text x="32" y="40" text-anchor="middle" font-size="8.5" font-weight="900" fill="${color}" font-family="Inter,sans-serif">${t.traveled.split(" ")[1]}</text></svg>`;
  };

  WP.stampT = (t, cls = "st-ok") => `<span class="stamp ${cls}">${I("check", 11, 3)}Traveled ${t.traveled}</span>`;
  WP.remixT = (t) => `<span class="rmx">${I("sparkle", 13)}<b>${t.remixes}</b>&nbsp;planned from it</span>`;
  WP.tagsH = (t, n = 9) => t.tags.slice(0, n).map((x) => `<span class="wchip">${esc(x)}</span>`).join("");

  // Notes from the trip: kept / cut / surprise.
  WP.NOTE_KINDS = [
    ["kept", "Kept", "#4F8A62", "heart"],
    ["cut", "Would cut", "#C0432B", "x"],
    ["surprise", "Surprised us", "#B87810", "sparkle"],
  ];
  WP.noteList = (t, cls = "nl") =>
    `<div class="${cls}">${WP.NOTE_KINDS.map(([k, lbl, c, ic]) => t[k].map((n) => `<div class="ni"><span class="nk" style="color:${c}">${I(ic, 13, 2.4)}${lbl}</span><p>${esc(n)}</p></div>`).join("")).join("")}</div>`;

  // Rough hand-drawn world map in equirectangular projection, with optional pins.
  const LAND = [
    [[-168, 65], [-140, 70], [-95, 72], [-80, 63], [-60, 55], [-66, 45], [-76, 38], [-80, 32], [-81, 25], [-90, 29], [-97, 26], [-105, 20], [-92, 15], [-80, 8], [-86, 13], [-106, 23], [-117, 32], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 55]],
    [[-52, 60], [-22, 70], [-22, 82], [-60, 82], [-72, 76]],
    [[-80, 8], [-60, 10], [-35, -6], [-40, -22], [-58, -38], [-68, -55], [-75, -45], [-71, -18], [-81, -5]],
    [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [3, 51], [8, 54], [12, 56], [20, 60], [25, 66], [30, 70], [45, 68], [60, 68], [60, 45], [40, 42], [28, 41], [22, 36], [15, 38], [12, 44], [5, 43], [0, 38]],
    [[-17, 21], [-6, 36], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -28], [20, -35], [12, -17], [9, 4], [-8, 4], [-17, 14]],
    [[60, 68], [100, 78], [140, 72], [180, 68], [160, 58], [140, 52], [130, 42], [122, 30], [110, 20], [105, 10], [100, 2], [98, 15], [92, 22], [80, 10], [72, 20], [60, 25], [50, 30], [44, 12], [35, 32], [40, 42], [60, 45]],
    [[130, 31], [136, 34], [141, 38], [142, 44], [140, 41], [135, 35]],
    [[114, -22], [130, -12], [142, -11], [153, -27], [146, -39], [135, -34], [115, -34]],
    [[-24.5, 63.5], [-13.5, 64.3], [-15, 66.5], [-22.5, 66.4]],
    [[-5.5, 50], [1.5, 51], [-2, 56], [-5, 58.5], [-6.5, 55]],
  ];
  // view = [lonMin, lonMax, latMax, latMin]
  WP.proj = (lon, lat, W, H, v) => [((lon - v[0]) / (v[1] - v[0])) * W, ((v[2] - lat) / (v[2] - v[3])) * H];
  WP.worldMap = ({ W = 400, H = 220, center = [0, 20], span = 340, pins = WP.T, pin = "dot", sel = "", dark = false, labels = false } = {}) => {
    const view = [center[0] - span / 2, center[0] + span / 2, center[1] + (span * H) / W / 2, center[1] - (span * H) / W / 2];
    const sea = dark ? "#2A3138" : "#D8E6EC", land = dark ? "#4A4038" : "#EFE4CF", edge = dark ? "#6A5B4E" : "#C9B597";
    let g = `<rect width="${W}" height="${H}" fill="${sea}"/>`;
    for (let x = 0; x < W; x += W / 12) g += `<path d="M${x} 0V${H}" stroke="${dark ? "#fff" : "#7FA3B5"}" stroke-opacity=".12"/>`;
    for (let y = 0; y < H; y += H / 6) g += `<path d="M0 ${y}H${W}" stroke="${dark ? "#fff" : "#7FA3B5"}" stroke-opacity=".12"/>`;
    g += LAND.map((poly) => `<path d="M${poly.map(([a, b]) => WP.proj(a, b, W, H, view).map((n) => n.toFixed(1)).join(" ")).join("L")}Z" fill="${land}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/>`).join("");
    g += [[-156.3, 20.8], [-157.8, 21.4], [-155.5, 19.6]].map(([a, b]) => { const [x, y] = WP.proj(a, b, W, H, view); return `<circle cx="${x}" cy="${y}" r="${W / 260}" fill="${land}" stroke="${edge}"/>`; }).join("");
    g += pins.map((t) => {
      const [x, y] = WP.proj(t.lon, t.lat, W, H, view), on = t.id === sel;
      if (pin === "pol") return "";
      const r = on ? 8 : 5.5;
      return `<g><circle cx="${x}" cy="${y}" r="${r + 3}" fill="${t.accent}" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="${on ? "#D9694F" : t.accent}" stroke="#FFFDF8" stroke-width="2"/>${labels ? `<text x="${x + r + 4}" y="${y + 4}" font-size="11" font-weight="700" fill="${dark ? "#EFE4D6" : "#3D332B"}" font-family="Inter,sans-serif" paint-order="stroke" stroke="${sea}" stroke-width="3">${esc(t.title.split(" ").slice(0, 2).join(" "))}</text>` : ""}</g>`;
    }).join("");
    return `<svg class="wmap" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">${g}</svg>`;
  };

  // Stylised route map for one template: numbered stops along a road, one colour per day.
  const DAYC = ["#D9694F", "#3E7A8C", "#B87810", "#4F8A62", "#8A5BB8", "#C2562D"];
  WP.dayColor = (i) => DAYC[i % DAYC.length];
  WP.routeMap = (t, { W = 360, H = 220, dark = false } = {}) => {
    let seed = [...t.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const bg = dark ? "#2A2621" : "#EDE6D8", road = dark ? "#4A4038" : "#FFFFFF", water = dark ? "#2A3A44" : "#CFE1E8", park = dark ? "#2F3A2C" : "#D7E5C8";
    let g = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
    g += `<path d="M${W * 0.62} 0 C${W * 0.7} ${H * 0.3} ${W * 0.55} ${H * 0.55} ${W * 0.78} ${H}" stroke="${water}" stroke-width="${W / 22}" fill="none"/>`;
    g += `<ellipse cx="${W * 0.25}" cy="${H * 0.3}" rx="${W * 0.22}" ry="${H * 0.2}" fill="${park}"/><ellipse cx="${W * 0.85}" cy="${H * 0.75}" rx="${W * 0.16}" ry="${H * 0.18}" fill="${park}"/>`;
    for (let i = 0; i < 6; i++) g += `<path d="M0 ${rnd() * H} C${W * 0.3} ${rnd() * H} ${W * 0.6} ${rnd() * H} ${W} ${rnd() * H}" stroke="${road}" stroke-width="${2 + rnd() * 3}" fill="none" opacity=".9"/>`;
    const stops = [];
    t.plan.forEach((d, di) => d.s.forEach((_, si) => stops.push([di, si])));
    const n = stops.length, pts = stops.map((_, i) => [W * (0.1 + 0.8 * (i / (n - 1 || 1))) + (rnd() - 0.5) * W * 0.03, H * (0.5 + 0.13 * Math.sin(i * 0.45 + seed)) + (rnd() - 0.5) * H * 0.06]);
    for (let i = 1; i < n; i++) g += `<path d="M${pts[i - 1][0]} ${pts[i - 1][1]} L${pts[i][0]} ${pts[i][1]}" stroke="${WP.dayColor(stops[i][0])}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="${stops[i][0] === stops[i - 1][0] ? "0" : "5 5"}"/>`;
    g += pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${WP.dayColor(stops[i][0])}" stroke="#FFFDF8" stroke-width="2"/><text x="${x}" y="${y + 3}" text-anchor="middle" font-size="7.5" font-weight="900" fill="#fff" font-family="Inter,sans-serif">${i + 1}</text>`).join("");
    return `<svg class="rmap" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">${g}</svg>`;
  };

  // Months strip: which months this plan suits (filled) and the month it was traveled (stamped).
  WP.monthStrip = (t, cls = "ms") =>
    `<div class="${cls}">${WP.MONTHS.map((m, i) => `<span class="${t.months.includes(i) ? "on" : ""}${i === t.month ? " tr" : ""}">${m[0]}</span>`).join("")}</div>`;

  // The prompt the "Plan this trip" button hands the user's agent.
  WP.prompt = (t) => `Plan a trip based on the Waypack template "${t.title}" (waypack.app/t/${t.id}). Ask me only what's different: our dates, who's coming, our pace.`;

  // ── Web portal shell: browser chrome + the site's header (same for every candidate).
  WP.web = (body, { url = "waypack.app/trips", tab = "Discover", cls = "" } = {}) => `
    <div class="bw-chrome"><span class="dots"><i></i><i></i><i></i></span><span class="url">${I("shield", 12)}${esc(url)}</span><span class="sp"></span></div>
    <div class="wv sk ${cls}">
      <header class="wh"><span class="wl"></span><b class="wn">Waypack</b>
        <nav>${["Discover", "My trips", "Account"].map((n) => `<span class="${n === tab ? "on" : ""}">${n}</span>`).join("")}</nav>
        <span class="wsp"></span><span class="wbtn">${I("plus", 14, 2.4)}Share a trip</span><span class="wav">Z</span></header>
      ${body}
    </div>`;

  // Primary CTA used in every detail view.
  WP.planBtn = (cls = "btn", label = "Plan this trip") => `<span class="${cls}">${I("sparkle", 16, 2.2)}${label}</span>`;
})();
