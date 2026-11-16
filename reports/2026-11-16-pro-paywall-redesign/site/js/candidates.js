// Pro paywall redesign: today's screens + 8 directions, each shown in all five apps that sell Pro on iPhone.
// A render(a) builds one app's paywall from KIT.apps[a] (real perks, prices and accents); views = one per app.
(() => {
  const K = KIT, I = K.icon, A = K.apps;
  const phone = (a, body, cls = "") =>
    `${K.statusBar()}<div class="pay a-${a.key} ${cls}" data-plan="${K.main(a).id}">${body}</div>${K.homeBar()}`;
  const perApp = (fn) => ({
    render: ({ dark }) => fn(A.headway, dark),
    views: K.order.map((k) => ({ name: A[k].name, render: ({ dark }) => fn(A[k], dark) })),
  });
  const ctaBar = (a, extra = "") => {
    const m = K.main(a);
    return `<div class="buy">${extra}<button class="cta"><span class="cta-t">${K.cta(a, m)}</span></button><div class="cta-s">${K.ctaSub(a, m)}</div></div>`;
  };
  const freeNote = (a) => a.gate === "some" ? `<p class="free">${I("check", 14, 2.5)} ${a.freeLine}</p>` : "";
  const status = (a) => a.status ? `<div class="status">${I("calendar", 14)} ${a.status}</div>` : "";

  // ── 0 · today, recreated from ProViews.swift (Headway, FitLoop, G2 Digest), Pro.swift (Wee Hours)
  // and pro_sheet.dart (Waypack, a paper sheet over the app)
  const baseline = (a) => {
    const m = K.main(a), l = K.life(a);
    if (a.key === "waypack") return phone(a, `<div class="dim"></div><div class="sheet"><i class="grab"></i><h1>Waypack Pro</h1>
      ${a.perks.map(([ic, t]) => `<div class="perk">${I(ic, 20)}<span>${t}</span></div>`).join("")}
      <button class="pbtn">Try 1 week free, then ${m.price}/year</button><p class="terms">${K.terms(a).replace(". Manage", "; manage")}</p>
      <button class="pbtn sec">Lifetime · ${l.price} once</button><div class="links">${["Restore Purchases", "Terms of Use", "Privacy Policy"].map((x) => `<span>${x}</span>`).join("")}</div></div>`, "base-wp");
    if (a.key === "weehours") return phone(a, `<div class="nav"><span>‹ Settings</span><b>Wee Hours Pro</b><span></span></div><div class="pad">
      <h1>Wee Hours Pro</h1><p class="sub">${a.status}</p>
      <div class="box">${a.perks.map(([ic, t]) => `<div class="lbl">${I(ic, 17)}<span>${t}</span></div>`).join("")}</div>
      <p class="fn">${a.freeLine}</p>
      ${a.plans.map((p) => `<button class="ibtn ${p.best ? "pro" : "brd"}"><b>${p.id === "lifetime" ? `Lifetime · ${p.price} once` : `${p.price} per ${p.per}`}</b>${p.best ? "<small>Best value</small>" : ""}</button>`).join("")}
      <p class="fn">${K.terms(a)}</p>
      <div class="box"><div class="ret">${I("cards", 16)} <b>Data Retention Notice</b></div><p class="fn">In the future, baby data that is inactive for more than a year might be archived. If that happens, we will provide a way to download your complete archive and re-import it anytime.</p></div>
      <div class="lnk"><span>Restore Purchases</span><span>Terms of Use</span><span>Privacy Policy</span></div></div>`, "base-ios");
    return phone(a, `<div class="pad"><h1>${a.pro}</h1><p class="sub">${a.sub}</p>
      ${a.perks.map(([ic, t]) => `<div class="lbl">${I(ic, 18)}<span>${t}</span></div>`).join("")}
      <button class="ibtn pro"><b>Try 1 week free, then ${m.price}/year</b></button>
      <p class="fn c">Free for 1 week, then ${m.price} a year, charged to your Apple Account. Renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your Apple Account settings.</p>
      <button class="ibtn brd"><b>Lifetime · ${l.price} once</b></button>
      <p class="fn c tint">Have a Pro invite? Sign in</p>
      <div class="lnk sp"><span>Restore Purchases</span><span>Terms of Use</span><span>Privacy Policy</span></div></div>`, "base-ios");
  };

  // radio-style plan rows shared by several candidates
  const planRows = (a, cls = "opts") => `<div class="${cls}">${a.plans.map((p, i) => `<div class="opt${i ? "" : " on"}" ${K.pickAttr(a, p)}>
      <i class="radio"></i><div class="ot"><b>${K.planName(p)}</b><small>${p.id === "lifetime" ? "Pay once, keep it for good" : p.trial ? `${p.trial} free, then ${p.price}/${p.per}` : `${p.price} every ${p.per}`}</small></div>
      <div class="op"><b>${K.planPrice(p)}</b>${p.id !== "lifetime" && p.per === "year" ? `<small>${K.perMonth(p)}/mo</small>` : ""}</div>
      ${p.trial ? `<em class="tag">${p.trial} free</em>` : p.best ? `<em class="tag">Best value</em>` : ""}</div>`).join("")}</div>`;

  // ── 1 · Scene
  const scene = (a) => phone(a, `<div class="hero">${K.art(a, 150)}</div><div class="pad">
      <div class="kick">${I("star", 13, 2.4)} ${a.pro}</div><h1>${a.hook}</h1>${status(a)}
      <div class="tiles">${a.short.map(([ic, t]) => `<div class="tile">${I(ic, 22)}<span>${t}</span></div>`).join("")}</div>
      ${freeNote(a)}${planRows(a)}<p class="terms">${K.terms(a)}</p>${K.links(a)}</div>${ctaBar(a)}`);

  // ── 2 · Free week, explained
  const timeline = (a) => {
    const m = K.main(a), l = K.life(a);
    const steps = a.key === "weehours"
      ? [["Nov 11", "Your household's trial began", "Voice, reminders, glasses and your assistant, for everyone at home.", "done"],
        ["Today", "9 days left", "Everything is included. Nothing to pay yet.", "now"],
        ["Nov 23", "We remind you", "A notification two days before the trial ends.", ""],
        ["Nov 25", "Pick a plan, or don't", "Without Pro, tap logging, your watch and your whole log stay free.", ""]]
      : [["Today", "Everything unlocks", a.perks[0][1].replace(/\.?$/, "."), "now"],
        ["Day 5", "We remind you", "A notification two days before your free week ends.", ""],
        ["Day 7", `Your yearly plan starts`, `${m.price} for the year. Cancel before then and you pay nothing.`, ""]];
    return phone(a, `<div class="pad"><div class="app">${I(a.short[0][0], 20)}</div>
      <h1>${a.key === "weehours" ? "How your trial works" : "How your free week works"}</h1>
      <ol class="tl">${steps.map(([d, t, s, st]) => `<li class="${st}"><i></i><small>${d}</small><b>${t}</b><p>${s}</p></li>`).join("")}</ol>
      ${a.key === "weehours" ? planRows(a) : ""}
      <div class="incl"><b>What Pro includes</b>${a.perks.map(([ic, t]) => `<div>${I("check", 15, 2.5)}<span>${t}</span></div>`).join("")}</div>
      <p class="terms">${K.terms(a)}</p>${K.links(a)}</div>
      ${a.key === "weehours" ? ctaBar(a) : `<div class="buy"><button class="cta" ${K.pickAttr(a, m)}><span>Start my free week</span></button><div class="cta-s">Then ${m.price}/year · cancel anytime in Settings</div>
      <button class="alt" ${K.pickAttr(a, l)}>Or pay once: <b>${l.price} for life</b></button></div>`}`);
  };

  // ── 3 · Show, don't list
  const preview = (a) => phone(a, `<div class="glow"></div><div class="pad">
      <div class="kick">${a.pro}</div><h1>${a.hook}</h1>
      <div class="stack">${K.preview(a)}</div>
      <div class="chips">${a.short.map(([ic, t]) => `<span>${I(ic, 14)} ${t}</span>`).join("")}</div>
      ${status(a)}${freeNote(a)}
      <div class="segs">${a.plans.map((p, i) => `<div class="sg${i ? "" : " on"}" ${K.pickAttr(a, p)}><b>${K.planName(p)}</b><small>${K.planPrice(p)}</small>${p.trial ? `<em>${p.trial} free</em>` : ""}</div>`).join("")}</div>
      <p class="terms">${K.terms(a)}</p>${K.links(a)}</div>${ctaBar(a)}`);

  // ── 4 · One card
  const onecard = (a) => {
    const m = K.main(a);
    return phone(a, `<div class="pad"><div class="top"><span class="x">${I("close", 16)}</span><span>Restore</span></div>
      <div class="badge">${I(a.short[0][0], 26)}</div><h1>${a.pro}</h1>${status(a)}
      <div class="tog">${a.plans.map((p, i) => `<div class="tg${i ? "" : " on"}" ${K.pickAttr(a, p)}>${K.planName(p)}</div>`).join("")}</div>
      <div class="card">
        ${a.plans.map((p) => `<div class="if-${p.id}"><div class="price"><b>${p.price}</b><span>${p.id === "lifetime" ? "once" : `/ ${p.per}`}</span></div>
          <small>${p.id === "lifetime" ? "One payment. Every Pro feature, for good." : p.trial ? `after your ${p.trial} free · ${K.perMonth(p)} a month` : p.per === "year" ? `${K.perMonth(p)} a month, billed yearly` : "billed monthly, cancel anytime"}</small></div>`).join("")}
        <div class="checks">${a.perks.slice(0, 4).map(([, t]) => `<div>${I("check", 15, 2.6)}<span>${t}</span></div>`).join("")}</div>
        <button class="cta"><span class="cta-t">${K.cta(a, m)}</span></button></div>
      ${freeNote(a)}<p class="terms">${K.terms(a)}</p>${K.links(a)}</div>`);
  };

  // ── 5 · Side by side
  const side = (a) => {
    const y = K.main(a), l = K.life(a), mo = K.monthly(a);
    const save = mo ? Math.round((1 - parseFloat(y.price.slice(1)) / (parseFloat(mo.price.slice(1)) * 12)) * 100) : 0;
    const col = (p, i) => `<div class="col${i ? "" : " on"}" ${K.pickAttr(a, p)}>${p.trial ? `<em>${p.trial} free</em>` : p.best ? `<em>Save ${save}%</em>` : p.id === "lifetime" ? `<em class="q">Pay once</em>` : `<em class="q">Flexible</em>`}
      <small>${K.planName(p)}</small><b>${p.price}</b><span>${p.id === "lifetime" ? "one time" : `per ${p.per}`}</span>
      <p>${p.id === "lifetime" ? `About ${K.breakEven(a)} years of yearly` : p.per === "year" ? `${K.perMonth(p)} a month` : "Cancel anytime"}</p><i class="radio"></i></div>`;
    const table = a.gate === "some"
      ? `<table class="vs"><tr><th></th><th>Free</th><th>Pro</th></tr>${a.free.map((f) => `<tr><td>${f}</td><td>${I("check", 15, 2.6)}</td><td>${I("check", 15, 2.6)}</td></tr>`).join("")}
         ${a.short.filter(([ic]) => ic !== "devices").map(([, t]) => `<tr><td>${t}</td><td class="no">–</td><td>${I("check", 15, 2.6)}</td></tr>`).join("")}</table>`
      : `<div class="incl">${a.perks.map(([ic, t]) => `<div>${I(ic, 16)}<span>${t}</span></div>`).join("")}</div>`;
    return phone(a, `<div class="pad"><h1>Choose your ${a.pro}</h1>${status(a)}
      <div class="cols n${a.plans.length}">${a.plans.map(col).join("")}</div>
      ${a.gate === "some" ? `<h3>Free vs Pro</h3>` : `<h3>Every plan includes</h3>`}${table}
      <p class="terms">${K.terms(a)}</p>${K.links(a)}</div>${ctaBar(a)}`);
  };

  // ── 6 · A note from the maker
  const letter = (a) => phone(a, `<div class="pad"><div class="mast"><span>${a.name}</span><span>${I("star", 12, 2.4)} Pro</span></div>
      <h1>${a.hook}</h1><p class="lede">${a.maker}</p>
      <div class="list">${a.perks.map(([ic, t], i) => `<div><span class="n">0${i + 1}</span><span>${t}</span></div>`).join("")}</div>
      <p class="sig">— HEJI TECH</p>${status(a)}
      <div class="lines">${a.plans.map((p, i) => `<div class="ln${i ? "" : " on"}" ${K.pickAttr(a, p)}><i class="radio"></i><b>${K.planName(p)}</b><span class="dots"></span><span>${K.planPrice(p)}</span>${p.trial ? `<small>${p.trial} free first</small>` : ""}</div>`).join("")}</div>
      <p class="terms">${K.terms(a)}</p>${K.links(a)}</div>${ctaBar(a)}`);

  // ── 7 · Membership pass
  const passCard = (a, plan, owned) => `<div class="pass"><div class="holo"></div><div class="ph"><span class="pi">${I(a.short[0][0], 18)}</span><b>${a.pro.toUpperCase()}</b></div>
      <div class="pk">${a.pass.kind}</div><div class="pl">${a.pass.line}</div>
      <div class="pf"><span><small>${owned ? "Member since" : "Valid"}</small>${owned ? "Nov 16, 2026" : `<span class="if-${K.main(a).id}">${K.main(a).per === "year" ? "1 year · renews" : "Monthly"}</span>${K.monthly(a) ? `<span class="if-monthly">1 month · renews</span>` : ""}<span class="if-lifetime">For life</span>`}</span>
      <span><small>No.</small>${a.pass.no}</span></div></div>`;
  const pass = (a) => phone(a, `<div class="pad"><p class="kick">Your ${a.pass.kind.toLowerCase()}</p>${passCard(a, K.main(a), false)}
      <h1>${a.hook}</h1>${status(a)}
      <div class="incl">${a.perks.map(([ic, t]) => `<div>${I(ic, 17)}<span>${t}</span></div>`).join("")}</div>${freeNote(a)}
      ${planRows(a)}<p class="terms">${K.terms(a)}</p>${K.links(a)}</div>${ctaBar(a)}`);
  const passSettings = (a) => phone(a, `<div class="pad"><h1 class="st">Settings</h1><p class="kick">${a.pro}</p>${passCard(a, K.main(a), true)}
      <div class="group"><div>Plan<span>Yearly · renews Nov 16, 2027</span></div><div class="tint">Manage Subscription</div><div class="tint">Restore Purchases</div></div></div>`);

  // ── 8 · Peek
  const peek = (a) => phone(a, `<div class="behind">${K.home(a)}</div><div class="veil"></div>
      <div class="sh"><i class="grab"></i><div class="lk">${I("lock", 15, 2.4)} ${a.gate === "all" ? `Unlock ${a.name}` : `Unlock all of ${a.name}`}</div>
      <h1>${a.hook}</h1>${status(a)}
      <div class="icons">${a.short.map(([ic, t]) => `<span>${I(ic, 18)}<small>${t}</small></span>`).join("")}</div>${freeNote(a)}
      ${planRows(a, "opts compact")}
      <button class="cta"><span class="cta-t">${K.cta(a, K.main(a))}</span></button><div class="cta-s">${K.ctaSub(a, K.main(a))}</div>
      <p class="terms">${K.terms(a)}</p>${K.links(a)}</div>`, "pk");

  const both = "Applies to all five apps: one shared SwiftUI view (Headway, FitLoop, G2 Digest, Wee Hours) and Waypack's Flutter sheet.";
  const common = (extra = []) => ({
    today: ["PaywallView in ProViews.swift (Headway, FitLoop, G2 Digest; copies differ only in name, perks, privacy URL), PaywallView in weehours Pro.swift (3 plans, trial status, Data Retention Notice), ProSheet in waypack pro_sheet.dart (scrapbook PaperButtons in a paper sheet). Title, perk list, a prominent yearly button, the renewal footnote, a bordered lifetime button, links."],
    proposed: [...extra, "Every candidate keeps what guideline 3.1.2 needs: the billed amount per period is the biggest price on screen (per-month figures stay small), the free week only when introEligible, the renewal text, Restore, Terms of Use, Privacy Policy, and 'Have a Pro invite? Sign in' where the app has it."],
    files: ["projects/headway/apps/ios/App/Sources/ProViews.swift", "projects/fitloop/apps/ios/App/Sources/ProViews.swift", "projects/g2digest/apps/ios/App/Sources/ProViews.swift", "projects/weehours/apps/ios/App/Sources/Pro.swift", "projects/waypack/apps/mobile/lib/widgets/pro_sheet.dart"],
    risks: ["Each app's IAP review screenshot shows the purchase screen: retake and upload after the change (heji-app-store-iap)."],
    verify: ["Debug build with StoreKit config: eligible and not-eligible for the trial, products loading / failed (Try Again), buying each plan, Restore; light and dark; largest Dynamic Type"],
  });

  window.REVIEW = {
    key: "2026-11-16-pro-paywall-redesign-v1",
    dir: "reports/2026-11-16-pro-paywall-redesign",
    repo: "tianhaoz95/hejitech-apps",
    port: 8839,
    project: "projects/headway",   // + fitloop, g2digest, weehours, waypack: same change in each (see context)
    context: ["CLAUDE.md (In-app purchases)", "projects/{headway,fitloop,g2digest,weehours,waypack}/CLAUDE.md", ".claude/skills/heji-app-store-iap/SKILL.md",
      "projects/headway/apps/ios/App/Sources/ProViews.swift", "projects/headway/apps/ios/App/Sources/ProStore.swift",
      "projects/weehours/apps/ios/App/Sources/Pro.swift", "projects/waypack/apps/mobile/lib/widgets/pro_sheet.dart"],
    brief: "Owner: \"I think the subscription ui for those apps can be a bit more attractive, give me a few redesign candidates.\" The Pro purchase screens of the five iPhone apps that sell Pro by StoreKit 2: Headway, FitLoop, G2 Digest (whole app gated after a 1-week free trial; yearly or lifetime), Wee Hours (14-day household trial; monthly, yearly, lifetime; tap logging stays free) and Waypack (Flutter sheet; free tier of one trip; yearly with 1-week trial, lifetime). One direction for all five so they read as one family, each in its own accent. Must keep guideline 3.1.2's content; prices are today's App Store prices.",
    title: "Pro paywall redesign",
    subtitle: "8 directions + today's screens, in all five apps",
    heading: "Pick a paywall direction",
    intro: "Each direction is drawn in Headway on its card; open it to see it in <b>Headway, FitLoop, G2 Digest, Wee Hours and Waypack</b>, scroll inside, and tap the plans (the button follows). Heart, rate, write what you'd change under each, crown one, then <b>Copy summary</b> and paste it to any agent.",
    legend: ["<b>5</b> apps per direction", "real perks and prices", "tap a plan to switch"],
    round: 1,
    frame: "phone",
    candidates: [
      { id: "current", n: 0, name: "Today", baseline: true, tagline: "The shipped screens, recreated from the code",
        ...perApp(baseline) },
      { id: "scene", n: 1, name: "Scene", round: 1, tagline: "Illustrated hero, tiles, one sticky button",
        concept: "The most conventional 'premium' paywall: a full-bleed illustration in the app's colour sells the mood, four short tiles say what's in it, and the plans become selectable cards with one sticky button that follows the choice. Familiar from the best-converting apps; the cost is drawing one hero per app.",
        moves: ["Hero illustration per app in its accent", "Outcome headline instead of 'X Pro'", "Perks as 4 short tiles", "Plans as selectable cards, yearly preselected with a '1 week free' tag", "One sticky CTA that follows the selected plan"],
        palette: [["Headway", "#1F8A4C"], ["FitLoop", "#E8612E"], ["G2 Digest", "#00E676"], ["Wee Hours", "#F29E66"], ["Waypack", "#D9694F"]],
        facts: { Type: "SF Pro Display 30/800 headline", Effort: "M", Needs: "One hero illustration per app (SVG → asset), a short headline per app" },
        ...perApp(scene), spec: common(["Selectable plan cards + one CTA replace the two stacked buttons"]) },
      { id: "timeline", n: 2, name: "Free week, explained", round: 1, tagline: "A timeline that answers 'when do I pay?'",
        concept: "People hesitate at trials because they fear forgetting to cancel. This screen leads with the answer: today everything unlocks, day 5 a reminder, day 7 the yearly plan starts. Lifetime stays one tap away. For Wee Hours it shows the household trial's real dates and that tap logging stays free.",
        moves: ["Trial timeline as the hero", "'Start my free week' as the only big button", "Lifetime as a secondary line under it", "Checklist of what Pro includes", "Wee Hours: real trial dates + plan rows"],
        palette: [["Accent", "#1F8A4C"], ["Rail", "#D1D1D6"]],
        facts: { Type: "SF Pro 28/800", Effort: "M", Needs: "A local reminder notification 2 days before the trial ends (scheduled after an intro-offer purchase; Wee Hours from Entitlement.trialEnds). Must really be sent if promised." },
        ...perApp(timeline), spec: common(["New: schedule a UNNotificationRequest 2 days before the intro offer ends (from Transaction.expirationDate when offer type is introductory); cancel it if the user buys lifetime or cancels.", "Wee Hours: reminder from Entitlement's trial end"]) },
      { id: "preview", n: 3, name: "Show, don't list", round: 1, prefers: "dark", tagline: "The app's own screens are the pitch",
        concept: "Instead of describing features, show them: a Live Activity for Headway, the workout player for FitLoop, a brief card for G2 Digest, a voice log for Wee Hours, an offline trip map for Waypack, floating on a dark glow in the app's colour. Plans are a segmented strip. Striking, but the previews must be kept in step with the real UI.",
        moves: ["Dark glow background in the accent", "2 stacked mini previews of the real UI", "Feature chips", "Plans as a 2–3 segment strip", "Sticky CTA"],
        palette: [["Night", "#07090B"], ["Glow", "accent 35%"]],
        facts: { Type: "SF Pro Display 30/800", Effort: "M", Needs: "Static preview views built from each app's real components (sample data, no network)" },
        ...perApp(preview), spec: common(["New PaywallPreview per app, made from the app's own row/card views with fixed sample data"]) },
      { id: "onecard", n: 4, name: "One card", round: 1, tagline: "A toggle and a single price card, fits one screen",
        concept: "The calmest option: a Yearly / Lifetime toggle and one card that shows only the chosen plan's price, what's included and the button. Nothing to scroll to decide. Least new art; looks tidy in every app but less emotional.",
        moves: ["Close + Restore in the top bar", "Plan toggle", "One price card with checks and the button inside", "Per-month figure kept small under the billed price"],
        palette: [["Card", "#F2F2F7"], ["Accent", "app"]],
        facts: { Type: "SF Pro Rounded 44/800 price", Effort: "S", Needs: "Nothing new" },
        ...perApp(onecard), spec: common(["Restyle only: same ProStore calls"]) },
      { id: "side", n: 5, name: "Side by side", round: 1, tagline: "Plans as columns, plus Free vs Pro where there's a free tier",
        concept: "Makes the choice explicit: plans as tall columns with the honest maths (lifetime ≈ N years of yearly, Wee Hours yearly saves 44% over monthly). Wee Hours and Waypack get a Free vs Pro table, which also tells people what they keep without paying.",
        moves: ["Plan columns with tags", "Break-even / savings line", "Free vs Pro table for apps with a free tier", "Perk list for whole-app apps", "Sticky CTA"],
        palette: [["Accent", "app"], ["Table", "#F2F2F7"]],
        facts: { Type: "SF Pro 30/800 prices", Effort: "S", Needs: "Short names for the free-tier features (Wee Hours, Waypack)" },
        ...perApp(side), spec: common(["Restyle; savings % computed from Product.price, not hard-coded"]) },
      { id: "letter", n: 6, name: "A note from the maker", round: 1, tagline: "Editorial type, an honest reason to pay",
        concept: "Small indie apps convert on trust. A serif headline, one honest paragraph about what Pro pays for, the perks as a numbered list, signed HEJI TECH. Plans are menu lines. Distinctive and warm, but it adds copy the owner must stand behind.",
        moves: ["Serif headline and lede", "Why Pro exists, in one paragraph", "Numbered perks", "Plans as dotted menu lines", "Sticky CTA"],
        palette: [["Paper", "#FBF8F3"], ["Ink", "#1B1A17"], ["Accent", "app"]],
        facts: { Type: "New York (serif) 30/700 + SF Pro", Effort: "S", Needs: "Owner-approved 'why Pro' paragraph per app (drafts in kit.js maker)" },
        ...perApp(letter), spec: common(["Uses the system serif (Font.Design.serif), no font files"]) },
      { id: "pass", n: 7, name: "Membership pass", round: 1, tagline: "Pro as a card you get to keep",
        concept: "Pro is a thing: a transit pass for Headway, a gym member card for FitLoop, a press pass for G2 Digest, a night pass for Wee Hours, a trail ticket for Waypack. The card changes with the plan, and after buying it lives in Settings as 'Member since'. Playful and memorable; most new UI.",
        moves: ["A glossy pass in the accent with a holo sheen", "Pass text follows the chosen plan", "Plan cards + sticky CTA", "Settings shows the same pass after purchase"],
        palette: [["Pass", "accent gradient"], ["Holo", "#FFFFFF 30%"]],
        facts: { Type: "SF Pro Rounded / SF Mono numbers", Effort: "M", Needs: "Purchase date from Transaction.originalPurchaseDate for 'Member since'; pass names per app" },
        render: ({ dark }) => pass(A.headway, dark),
        views: [...K.order.map((k) => ({ name: A[k].name, render: ({ dark }) => pass(A[k], dark) })), { name: "Headway · Settings after buying", render: ({ dark }) => passSettings(A.headway, dark) }],
        spec: common(["ProSettingsSection shows the pass with Member since (originalPurchaseDate) above Manage Subscription"]) },
      { id: "peek", n: 8, name: "Peek", round: 1, tagline: "The app, blurred, right behind the offer",
        concept: "The paywall becomes a sheet over the app it unlocks: you see your trains, plan or log blurred behind it. It makes Pro feel like opening a door rather than a separate store page. Compact plan rows keep everything above the fold.",
        moves: ["App home blurred behind", "Bottom sheet with lock label", "Icon row of 4 perks", "Compact plan rows + CTA inside the sheet"],
        palette: [["Veil", "bg 55%"], ["Sheet", "system bg"]],
        facts: { Type: "SF Pro 26/800", Effort: "M", Needs: "Render the real home view behind the gate with sample data (ProGate today shows only the paywall)" },
        ...perApp(peek), spec: common(["ProGate renders content() with sample/empty data under .blur + .allowsHitTesting(false), paywall as overlay sheet"]) },
    ],
  };
})();
