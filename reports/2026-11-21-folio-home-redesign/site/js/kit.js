// Shared building blocks: sample artifacts, icons, iOS chrome.
// Fields mirror FolioKit's ArtifactSummary (projects/folio/apps/ios/FolioKit/Sources/FolioKit/Models.swift):
//   title, description, visibility (private|link), role (owner|editor|viewer), head_version,
//   open_suggestions, favorite, updated_at. Only these are "real today".
// Extra fields some candidates use (listed in their facts.Needs): agent (who made the last version,
// from the head version's `agent`), comments (unresolved comments), kind (a preview colour/shape;
// stands in for a page thumbnail).
window.KIT = window.KIT || {};

(() => {
  const P = {
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    personCircle: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.2 18.4c1.4-2 3.4-3 5.8-3s4.4 1 5.8 3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 3-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2.2.7 3.5 2.6 3.5 5.2"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h0M3.5 12h0M3.5 18h0"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };
  KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
  KIT.starFill = (size = 12) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${P.star}</svg>`;

  // iOS chrome for the 390×844 phone screen.
  KIT.statusBar = () => `<div class="sb"><b>9:41</b><span class="sbr"><i></i><i></i><i></i><em></em></span></div>`;
  KIT.homeBar = () => `<div class="hb"></div>`;

  // The Bauhaus mark (projects/folio/brand/icon.svg): navy bar, coral quarter circle, mustard dot.
  KIT.mark = (size = 22) => `<svg class="mk" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <rect x="18" y="14" width="18" height="72" fill="var(--navy)"/>
    <path d="M36 14H82A46 46 0 0 1 36 60Z" fill="var(--coral)"/>
    <circle cx="66" cy="74" r="12" fill="var(--mustard)"/></svg>`;

  // Sample library: 13 artifacts, Saturday evening, Nov 21 2026. Order = updated_at, newest first
  // (the API's order). Awkward cases: a long title, an empty description, viewer/editor roles,
  // a link-shared one, three with open suggestions, favorites.
  KIT.items = [
    { id: "q4", title: "Q4 launch plan: pricing, regional rollout and the announcement calendar", desc: "Pricing tiers, rollout by region, and who owns each announcement.", v: 14, sugg: 2, fav: true, role: "owner", vis: "private", ago: "12m", agoLong: "12 minutes ago", agent: "Claude Code", comments: 3, kind: "doc" },
    { id: "onb", title: "Onboarding flow mockups", desc: "Three directions for the first-run screens.", v: 22, sugg: 1, fav: false, role: "editor", vis: "link", ago: "1h", agoLong: "1 hour ago", agent: "Cursor", comments: 1, kind: "screens" },
    { id: "inv", title: "Investor update, November", desc: "Highlights, metrics and asks for the monthly letter.", v: 5, sugg: 1, fav: false, role: "owner", vis: "private", ago: "5h", agoLong: "5 hours ago", agent: "Claude", comments: 0, kind: "doc" },
    { id: "kyo", title: "Kyoto trip itinerary", desc: "Day-by-day plan with maps and restaurant picks.", v: 6, sugg: 0, fav: true, role: "owner", vis: "private", ago: "2h", agoLong: "2 hours ago", agent: "Gemini CLI", comments: 0, kind: "map" },
    { id: "met", title: "Weekly metrics dashboard", desc: "Signups, retention and revenue from the live data.", v: 41, sugg: 0, fav: true, role: "owner", vis: "private", ago: "Yesterday", agoLong: "yesterday", agent: "Codex", comments: 2, kind: "chart" },
    { id: "api", title: "API migration checklist", desc: "Every endpoint moving to v2, with owners and dates.", v: 9, sugg: 0, fav: false, role: "viewer", vis: "private", ago: "Thu", agoLong: "2 days ago", agent: "Claude Code", comments: 0, kind: "list" },
    { id: "lnd", title: "Landing page copy test", desc: "", v: 7, sugg: 0, fav: false, role: "owner", vis: "link", ago: "Wed", agoLong: "3 days ago", agent: "ChatGPT", comments: 0, kind: "screens" },
    { id: "bug", title: "Bug triage board", desc: "Open issues sorted by impact, refreshed every morning.", v: 12, sugg: 0, fav: false, role: "editor", vis: "private", ago: "Tue", agoLong: "4 days ago", agent: "Claude Code", comments: 4, kind: "list" },
    { id: "soup", title: "Recipe cards: winter soups", desc: "Six soups with shopping lists.", v: 3, sugg: 0, fav: false, role: "owner", vis: "link", ago: "Nov 14", agoLong: "last week", agent: "Claude", comments: 0, kind: "doc" },
    { id: "read", title: "Reading list 2026", desc: "Books and long reads, with notes.", v: 18, sugg: 0, fav: false, role: "owner", vis: "private", ago: "Nov 10", agoLong: "2 weeks ago", agent: "Claude", comments: 0, kind: "list" },
    { id: "off", title: "Team offsite agenda", desc: "Two days in Sonoma: sessions, travel and rooms.", v: 4, sugg: 0, fav: false, role: "viewer", vis: "private", ago: "Nov 2", agoLong: "3 weeks ago", agent: "Gemini CLI", comments: 0, kind: "doc" },
    { id: "gar", title: "Garden planting calendar", desc: "What to sow each month for zone 9b.", v: 2, sugg: 0, fav: false, role: "owner", vis: "private", ago: "Oct 28", agoLong: "last month", agent: "ChatGPT", comments: 0, kind: "chart" },
    { id: "pod", title: "Podcast episode outline: agents at work", desc: "Segments, guests and the questions for each.", v: 8, sugg: 0, fav: false, role: "owner", vis: "private", ago: "Oct 19", agoLong: "last month", agent: "Claude", comments: 0, kind: "doc" },
  ];
  KIT.review = KIT.items.filter((a) => a.sugg > 0 && a.role !== "viewer");
  KIT.others = KIT.items.filter((a) => !(a.sugg > 0 && a.role !== "viewer"));
  KIT.favorites = KIT.others.filter((a) => a.fav);
  KIT.rest = KIT.others.filter((a) => !a.fav);
  KIT.suggTotal = KIT.review.reduce((n, a) => n + a.sugg, 0);

  // Meta line pieces as the app writes them today: "v14 · 12 minutes ago · Editor · 🔗".
  KIT.roleLabel = (a) => (a.role === "owner" ? "" : a.role[0].toUpperCase() + a.role.slice(1));
  KIT.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // A small abstract preview per artifact (stands in for a page thumbnail; needs one from the server).
  KIT.thumb = (a, w = 64, h = 48, fit = "slice") => {
    const shapes = {
      doc: `<rect x="8" y="9" width="30" height="4" rx="2" fill="var(--t1)"/><rect x="8" y="17" width="44" height="3" rx="1.5" fill="var(--t2)"/><rect x="8" y="23" width="40" height="3" rx="1.5" fill="var(--t2)"/><rect x="8" y="29" width="46" height="3" rx="1.5" fill="var(--t2)"/><rect x="8" y="35" width="26" height="3" rx="1.5" fill="var(--t2)"/>`,
      screens: `<rect x="9" y="8" width="13" height="32" rx="3" fill="var(--t1)"/><rect x="25" y="8" width="13" height="32" rx="3" fill="var(--t3)"/><rect x="41" y="8" width="13" height="32" rx="3" fill="var(--t2)"/>`,
      map: `<path d="M6 34c8-10 14 4 22-6s16-2 30-14" stroke="var(--t1)" stroke-width="3" fill="none"/><circle cx="28" cy="28" r="4" fill="var(--t3)"/><circle cx="48" cy="18" r="3" fill="var(--t1)"/>`,
      chart: `<rect x="10" y="26" width="7" height="14" rx="1.5" fill="var(--t2)"/><rect x="21" y="18" width="7" height="22" rx="1.5" fill="var(--t1)"/><rect x="32" y="22" width="7" height="18" rx="1.5" fill="var(--t2)"/><rect x="43" y="10" width="7" height="30" rx="1.5" fill="var(--t3)"/>`,
      list: `<circle cx="11" cy="12" r="2.5" fill="var(--t3)"/><rect x="17" y="10.5" width="34" height="3" rx="1.5" fill="var(--t2)"/><circle cx="11" cy="22" r="2.5" fill="var(--t1)"/><rect x="17" y="20.5" width="28" height="3" rx="1.5" fill="var(--t2)"/><circle cx="11" cy="32" r="2.5" fill="var(--t1)"/><rect x="17" y="30.5" width="31" height="3" rx="1.5" fill="var(--t2)"/>`,
    };
    return `<svg class="th" width="${w}" height="${h}" viewBox="0 0 64 48" preserveAspectRatio="xMidYMid ${fit}" aria-hidden="true">${shapes[a.kind] || shapes.doc}</svg>`;
  };

  // A tiny agent badge: initials on a colour from the name (for candidates that show the last agent).
  const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  KIT.agentDot = (name, size = 18) => {
    const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2);
    return `<span class="ag" style="--h:${hue(name)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px">${KIT.esc(initials)}</span>`;
  };
})();
