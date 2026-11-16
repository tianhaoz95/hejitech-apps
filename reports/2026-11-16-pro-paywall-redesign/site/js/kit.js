// Shared building blocks: the five apps that sell Pro on iPhone, their real perks, prices and accents
// (from each app's ProViews.swift / Pro.swift / pro_sheet.dart and App Store Connect, 2026-11-16),
// icons, hero art and mini previews of each app's own UI.
window.KIT = window.KIT || {};

(() => {
  // ── icons (SF Symbol stand-ins, stroke style)
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    tram: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    watch: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-4h4l1 4M9 18l1 4h4l1-4"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.2c2.9.2 5 2.6 5 5.8"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    cards: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v10"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    glasses: '<circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 14h4M3 14 4.5 7M21 14l-1.5-7"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
    sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 8"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    luggage: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 11v5M15 11v5"/>',
    devices: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h6"/><rect x="17" y="8" width="5" height="12" rx="1.2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4s0 4 4 4c4 0 6.5-3 4-4S12 8 12 8"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    infinity: '<path d="M7 9c-2.2 0-4 1.3-4 3s1.8 3 4 3c3.5 0 6.5-6 10-6 2.2 0 4 1.3 4 3s-1.8 3-4 3c-3.5 0-6.5-6-10-6z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    wave: '<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0"/>',
  };
  const I = KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

  KIT.statusBar = () => `<div class="sb"><b>9:41</b><span class="sbi"><i></i><i></i><i></i><em></em></span></div>`;
  KIT.homeBar = () => `<div class="hb"></div>`;

  // ── the apps. perks: the exact lines in each app's paywall today. plans: App Store Connect products.
  // gate "all": the whole iPhone app needs Pro after the free week (Headway, FitLoop, G2 Digest).
  // gate "some": a free tier stays (Wee Hours: tap logging + Watch; Waypack: one active trip).
  KIT.apps = {
    headway: {
      key: "headway", name: "Headway", pro: "Headway Pro", sub: "Everything in Headway, on your iPhone.",
      hook: "Never run for a train again.", gate: "all", invite: true, host: "headway.hejitech.workers.dev",
      perks: [["tram", "Live Caltrain departures, delays and leave-by times"], ["bell", "Alerts when your train is late, cancelled or near your stop"],
        ["watch", "Your watch, widgets and Live Activities"], ["people", "Family groups, Even G2 glasses and your AI assistant"]],
      short: [["tram", "Live departures"], ["bell", "Delay alerts"], ["watch", "Watch & widgets"], ["people", "Family & glasses"]],
      plans: [{ id: "annual", price: "$4.99", per: "year", trial: "1 week" }, { id: "lifetime", price: "$9.99" }],
      maker: "Headway has no ads and no account to make. Pro is what pays for the live data feed and keeps Headway on your train line.",
      pass: { kind: "Transit pass", line: "Caltrain · all zones", no: "HW-0412" },
    },
    fitloop: {
      key: "fitloop", name: "FitLoop", pro: "FitLoop Pro", sub: "Everything in FitLoop, on your iPhone.",
      hook: "Your agent writes the plan. You just press play.", gate: "all", invite: true, host: "fitloop.hejitech.workers.dev",
      perks: [["clipboard", "Your agent's plan, day by day: workouts and meals"], ["dumbbell", "The workout player: sets, rest timer and demos"],
        ["heart", "Heart rate from your watch, saved to Health"], ["chat", "Check-ins and feedback your agent reads"]],
      short: [["clipboard", "Daily plan"], ["dumbbell", "Workout player"], ["heart", "Heart rate"], ["chat", "Check-ins"]],
      plans: [{ id: "annual", price: "$19.99", per: "year", trial: "1 week" }, { id: "lifetime", price: "$39.99" }],
      maker: "FitLoop has no AI of its own and no AI bill: it works with the assistant you already use. Pro is the whole app, with no ads.",
      pass: { kind: "Member card", line: "All workouts · all meals", no: "FL-2291" },
    },
    g2digest: {
      key: "g2digest", name: "G2 Digest", pro: "G2 Digest Pro", sub: "Everything in G2 Digest, on your iPhone.",
      hook: "Your brief, ready before you are.", gate: "all", invite: true, host: "g2digest.hejitech.workers.dev",
      perks: [["cards", "Your daily brief as cards and audio"], ["sliders", "The brief editor, build agents and podcast feed"],
        ["bell", "A notification when your edition is ready"], ["glasses", "Read it on Even G2 glasses with the R1 ring"]],
      short: [["cards", "Cards & audio"], ["sliders", "Brief editor"], ["bell", "Ready alerts"], ["glasses", "On your glasses"]],
      plans: [{ id: "annual", price: "$14.99", per: "year", trial: "1 week" }, { id: "lifetime", price: "$29.99" }],
      maker: "Your agent does the reading; G2 Digest stores and delivers what it writes. Pro covers that storage and delivery, with no ads.",
      pass: { kind: "Press pass", line: "Daily edition · audio", no: "G2-0730" },
    },
    weehours: {
      key: "weehours", name: "Wee Hours", pro: "Wee Hours Pro", sub: "Everything for your household, on every phone in it.",
      hook: "Log the night without opening your eyes.", gate: "some", invite: false, host: "weehours.hejitech.workers.dev",
      status: "Free trial: 9 days left, everything included",
      perks: [["mic", "Log by voice, hands-free, with the on-device AI"], ["bell", "Reminders for whoever is on duty"], ["glasses", "Even G2 glasses and R1 ring"],
        ["sparkles", "Your AI assistant over MCP"], ["photo", "Photos on entries and CSV export"], ["people", "One purchase covers everyone in your household"]],
      short: [["mic", "Voice logging"], ["bell", "Duty reminders"], ["glasses", "Glasses & ring"], ["sparkles", "AI assistant"]],
      free: ["Logging by tap", "Your watch", "Your whole log"],
      freeLine: "Logging by tap, the Watch and your whole log stay free, always.",
      plans: [{ id: "yearly", price: "$19.99", per: "year", best: true }, { id: "monthly", price: "$2.99", per: "month" }, { id: "lifetime", price: "$39.99" }],
      maker: "Tap logging, your watch and your whole log stay free, always. Pro adds the hands-free parts, for everyone in your household.",
      pass: { kind: "Night pass", line: "Whole household", no: "WH-0303" },
    },
    waypack: {
      key: "waypack", name: "Waypack", pro: "Waypack Pro", sub: "Offline maps and more trips.", sheet: true,
      hook: "Keep the trip working when the signal drops.", gate: "some", invite: false, host: "waypack.app",
      perks: [["map", "Offline maps for every trip: up to 4 map areas each, cut for you when a trip is published."],
        ["luggage", "Up to 10 active trips at once (free: 1)."], ["devices", "Works on your account everywhere: iPhone, Mac and the web."]],
      short: [["map", "Offline maps"], ["luggage", "10 active trips"], ["devices", "iPhone, Mac, web"]],
      free: ["1 active trip", "Your itinerary offline", "iPhone, Mac and the web"],
      freeLine: "Free: one active trip.",
      plans: [{ id: "annual", price: "$14.99", per: "year", trial: "1 week" }, { id: "lifetime", price: "$39.99" }],
      maker: "Your agent plans the trip; Waypack cuts the maps and keeps it working offline. Pro pays for the map storage.",
      pass: { kind: "Trail ticket", line: "Admit one · all trips", no: "WP-1108" },
    },
  };
  KIT.order = ["headway", "fitloop", "g2digest", "weehours", "waypack"];

  const A = KIT.apps;
  KIT.main = (a) => a.plans[0];                     // the plan preselected: yearly
  KIT.life = (a) => a.plans.find((p) => p.id === "lifetime");
  KIT.monthly = (a) => a.plans.find((p) => p.id === "monthly");
  const num = (s) => parseFloat(s.replace("$", ""));
  KIT.perMonth = (p) => `$${(num(p.price) / 12).toFixed(2)}`;
  KIT.breakEven = (a) => Math.round(num(KIT.life(a).price) / num(KIT.main(a).price));

  // The call to action for a plan, as the apps word it today.
  KIT.cta = (a, p) => p.id === "lifetime" ? `Unlock for life · ${p.price}` : p.trial ? `Try ${p.trial} free` : `Continue · ${p.price}/${p.per}`;
  KIT.ctaSub = (a, p) => p.id === "lifetime" ? "One payment. Yours for good." : p.trial ? `Then ${p.price} a ${p.per}. Cancel anytime.` : `Renews every ${p.per}. Cancel anytime.`;
  KIT.planName = (p) => ({ annual: "Yearly", yearly: "Yearly", monthly: "Monthly", lifetime: "Lifetime" })[p.id];
  KIT.planPrice = (p) => p.id === "lifetime" ? `${p.price} once` : `${p.price}/${p.per}`;

  // Clicking a plan selects it and rewrites the CTA (data-cta / data-cta-sub), so mocks feel real.
  KIT.pickAttr = (a, p) =>
    `data-plan="${p.id}" data-cta="${KIT.cta(a, p)}" data-sub="${KIT.ctaSub(a, p)}" onclick="KIT.pick(this)"`;
  KIT.pick = (el) => {
    const root = el.closest(".pay");
    root.dataset.plan = el.dataset.plan;
    root.querySelectorAll("[data-cta]").forEach((e) => e.classList.toggle("on", e.dataset.plan === el.dataset.plan));
    root.querySelectorAll(".cta-t").forEach((e) => (e.textContent = el.dataset.cta));
    root.querySelectorAll(".cta-s").forEach((e) => (e.textContent = el.dataset.sub));
  };

  // What guideline 3.1.2 asks for, the same in every candidate: billed amount per period, the free
  // week, renewal and cancellation terms, Restore, Terms of Use (Apple's EULA), Privacy Policy.
  KIT.terms = (a) => {
    const m = KIT.main(a), mo = KIT.monthly(a);
    return mo
      ? `Subscriptions (${mo.price} a month or ${m.price} a year) are charged to your Apple Account and renew automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel them in your Apple Account settings. Lifetime is a one-time purchase.`
      : `Free for ${m.trial}, then ${m.price} a ${m.per}, charged to your Apple Account. Renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your Apple Account settings.`;
  };
  KIT.links = (a) => `<div class="links"><span>Restore Purchases</span><span>Terms of Use</span><span>Privacy Policy</span></div>${a.invite ? `<div class="invite">Have a Pro invite? <b>Sign in</b></div>` : ""}`;
  KIT.legal = (a) => `<p class="terms">${KIT.terms(a)}</p>${KIT.links(a)}`;

  // ── hero art per app: inline SVG in the app's accent (currentColor = --ac, .s2 = soft tint)
  KIT.art = (a, h = 150) => {
    const s = {
      headway: `<svg viewBox="0 0 300 150" height="${h}"><path class="s2f" d="M0 150 120 40h60l120 110z" opacity=".35"/><path class="ln" d="M130 40 70 150M170 40l60 110M118 70h64M108 90h84M96 112h108M82 136h136"/>
        <rect class="fill" x="112" y="16" width="76" height="86" rx="18"/><rect class="win" x="122" y="28" width="56" height="30" rx="7"/><circle class="win" cx="128" cy="80" r="6"/><circle class="win" cx="172" cy="80" r="6"/><rect class="win" x="140" y="74" width="20" height="12" rx="3"/>
        <circle class="fill" cx="232" cy="34" r="20"/><path class="win-s" d="M232 22v12l8 6"/></svg>`,
      fitloop: `<svg viewBox="0 0 300 150" height="${h}"><circle class="s2s" cx="150" cy="75" r="62" stroke-width="10" fill="none" stroke-dasharray="300 90"/><path class="fillp" d="M201 30l18 8-16 12z"/>
        <rect class="fill" x="88" y="52" width="18" height="46" rx="6"/><rect class="fill" x="194" y="52" width="18" height="46" rx="6"/><rect class="fill" x="72" y="62" width="14" height="26" rx="5"/><rect class="fill" x="214" y="62" width="14" height="26" rx="5"/><rect class="fill" x="104" y="70" width="92" height="10" rx="5"/></svg>`,
      g2digest: `<svg viewBox="0 0 300 150" height="${h}"><rect class="s2f" x="70" y="22" width="110" height="70" rx="10" opacity=".45" transform="rotate(-8 125 57)"/><rect class="s2f" x="120" y="18" width="110" height="70" rx="10" opacity=".7" transform="rotate(6 175 53)"/>
        <rect class="card" x="96" y="28" width="110" height="70" rx="10"/><path class="cardln" d="M110 46h60M110 60h80M110 72h50"/><circle class="fill" cx="96" cy="112" r="24"/><circle class="fill" cx="204" cy="112" r="24"/><circle class="win" cx="96" cy="112" r="15"/><circle class="win" cx="204" cy="112" r="15"/><path class="ln" d="M120 112h60"/></svg>`,
      weehours: `<svg viewBox="0 0 300 150" height="${h}"><path class="fill" d="M170 20a52 52 0 1 0 50 72 42 42 0 0 1-50-72z"/><g class="fill"><circle cx="90" cy="34" r="3"/><circle cx="66" cy="70" r="2"/><circle cx="236" cy="30" r="2.5"/><circle cx="252" cy="70" r="3"/></g>
        <path class="s2f" d="M40 150c30-26 70-30 110-20s80 6 110-10v30z" opacity=".5"/><rect class="card" x="84" y="88" width="34" height="48" rx="10"/><rect class="fill" x="92" y="78" width="18" height="12" rx="4"/><path class="cardln" d="M90 108h22M90 118h22"/></svg>`,
      waypack: `<svg viewBox="0 0 300 150" height="${h}"><path class="card" d="M60 30l60-12 60 12 60-12v100l-60 12-60-12-60 12z"/><path class="cardln" d="M120 18v112M180 30v100"/><path class="ln dash" d="M80 104c20-30 40-20 60-40s50-10 70-30"/><circle class="fill" cx="80" cy="104" r="6"/>
        <path class="fill" d="M214 46s-16-14-16-26a16 16 0 0 1 32 0c0 12-16 26-16 26z"/><circle class="win" cx="214" cy="20" r="6"/></svg>`,
    }[a.key];
    return `<div class="art">${s}</div>`;
  };

  // ── mini previews of each app's own UI, using its real data fields
  KIT.preview = (a) => ({
    headway: `<div class="pv pv-la"><div class="pv-row"><b class="pv-ac">${I("tram", 16)} Caltrain 151</b><span class="pv-ok">On time</span></div>
      <div class="pv-big">Leave in 6 min</div><div class="pv-row pv-mut"><span>Palo Alto 7:42</span><span>→</span><span>San Francisco 8:39</span></div><div class="pv-bar"><i style="width:38%"></i></div></div>
      <div class="pv pv-alert">${I("bell", 15)}<span><b>Train 153 is 8 min late</b><br><small>Next: 155 at 8:12 from Palo Alto</small></span></div>`,
    fitloop: `<div class="pv"><div class="pv-row pv-mut"><span>Push day · Week 3</span><span class="pv-ac">${I("heart", 13)} 128</span></div>
      <div class="pv-big">Bench press</div><div class="pv-row"><span>Set 2 of 4 · 8 reps · 135 lb</span></div><div class="pv-sets"><i class="d"></i><i class="n"></i><i></i><i></i></div></div>
      <div class="pv pv-alert">${I("clipboard", 15)}<span><b>Lunch: chicken rice bowl</b><br><small>42 g protein · from your agent's plan</small></span></div>`,
    g2digest: `<div class="pv"><div class="pv-row pv-mut"><span>Monday edition · 6 cards</span><span>4 min</span></div>
      <div class="pv-big">Chipmakers lift the market on strong earnings</div><div class="pv-row pv-mut"><span>Card 1 of 6</span><span class="pv-ac">${I("play", 13)} Listen</span></div></div>
      <div class="pv pv-alert">${I("glasses", 15)}<span><b>On your G2 glasses</b><br><small>Swipe the R1 ring for the next card</small></span></div>`,
    weehours: `<div class="pv pv-voice">${I("mic", 15)}<span>“Log a four-ounce bottle”</span></div>
      <div class="pv"><div class="pv-row"><b>Feed · bottle 120 ml</b><span class="pv-mut">3:12 AM</span></div><div class="pv-row pv-mut"><span>Logged by voice · Sam</span></div></div>
      <div class="pv"><div class="pv-row"><b>Sleep</b><span class="pv-mut">11:05 PM – 2:30 AM</span></div><div class="pv-row pv-mut"><span>3 h 25 min · Ada</span></div></div>`,
    waypack: `<div class="pv pv-map"><svg viewBox="0 0 300 110"><path d="M0 70c40-20 80 10 120-10s70-40 110-20 50 10 70 0" class="t1"/><path d="M0 95c50-10 90 5 140-15s90-10 160-30" class="t2"/><path d="M40 90c30-40 70-20 100-50s60-20 90-30" class="rt"/><circle cx="40" cy="90" r="5" class="me"/></svg></div>
      <div class="pv"><div class="pv-row"><b>Yosemite long weekend</b><span class="pv-ok">Offline</span></div><div class="pv-row pv-mut"><span>3 map areas · 212 MB · no signal needed</span></div></div>`,
  })[a.key];

  // The app's own home screen behind a paywall (for "peek"), drawn roughly from its real layout.
  KIT.home = (a) => ({
    headway: `<h2>Departures</h2><div class="hm-seg"><b>Palo Alto → SF</b></div>${[["151", "7:42", "Local · 6 min"], ["153", "8:12", "Limited · 8 min late"], ["155", "8:42", "Express"], ["157", "9:12", "Local"]].map(([n, t, s]) => `<div class="hm-row"><b>${t}</b><span>Train ${n}<small>${s}</small></span></div>`).join("")}`,
    fitloop: `<h2>Today</h2>${[["Push day", "6 exercises · 50 min"], ["Breakfast", "Greek yogurt bowl · 31 g protein"], ["Lunch", "Chicken rice bowl · 42 g"], ["Dinner", "Salmon, greens · 38 g"]].map(([t, s]) => `<div class="hm-row"><b>${t}</b><span><small>${s}</small></span></div>`).join("")}`,
    g2digest: `<h2>Today's brief</h2>${[["Markets", "Chipmakers lift the market"], ["Tech", "A new on-device model for phones"], ["Local", "Weekend road closures downtown"], ["Weather", "Rain clears by noon"]].map(([t, s]) => `<div class="hm-row"><b>${t}</b><span><small>${s}</small></span></div>`).join("")}`,
    weehours: `<h2>Ada · 6 weeks</h2>${[["3:12 AM", "Feed · bottle 120 ml"], ["2:40 AM", "Diaper · wet"], ["11:05 PM", "Sleep · 3 h 25 min"], ["10:30 PM", "Feed · left 14 min"]].map(([t, s]) => `<div class="hm-row"><b>${t}</b><span><small>${s}</small></span></div>`).join("")}`,
    waypack: `<h2>Trips</h2>${[["Yosemite long weekend", "Nov 21 – 24 · offline ready"], ["Kyoto in spring", "Apr 2 – 9 · planning"]].map(([t, s]) => `<div class="hm-row"><b>${t}</b><span><small>${s}</small></span></div>`).join("")}`,
  })[a.key];
})();
