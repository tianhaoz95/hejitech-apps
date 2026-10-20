// Shared building blocks: Voxbrief's iOS chrome (inset-grouped list, inline nav bar, orange capture
// button, accent #2673F2 from AccentColor.colorset), sample notes and a spec-card helper.
// Sample notes use only VoiceNote fields (Shared/Models/VoiceNote.swift): title, summary, duration,
// createdAt, source (NoteSource), tags, actionItems/completedActionItems, actionItemPriorities,
// status (NoteProcessingStatus), isPinned, isFavorite, colorTag, templateName, cleanupEngine.
// "Today" is Monday 2026-10-19.
window.KIT = window.KIT || {};

(() => {
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    watch: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l.6-3h4.8L15 6M9 18l.6 3h4.8l.6-3"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    mac: '<rect x="4" y="5" width="16" height="10.5" rx="1.5"/><path d="M2 19h20"/>',
    wave: '<path d="M3 12h1M7 8v8M11 5v14M15 9v6M19 7v10M22 12h-1"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
    pin: '<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    doc: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    flash: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5"/>',
  };
  KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
  const I = KIT.icon;

  KIT.statusBar = () => `<div class="sb"><b>9:41</b><span class="sbi"><i></i><i></i><i></i><em></em></span></div>`;
  KIT.homeBar = () => `<div class="hb"></div>`;
  KIT.phone = (body, cls = "") => `${KIT.statusBar()}<div class="body">${body}</div>${KIT.homeBar()}`;

  // The app's V-Wave monogram, drawn generically (rounded square + three bars).
  KIT.logo = (s = 26) => `<span class="vlogo" style="width:${s}px;height:${s}px"><i></i><i></i><i></i></span>`;

  // Inline nav bar like NoteListView (.navigationBarTitleDisplayMode(.inline), logo leading).
  KIT.nav = ({ left = KIT.logo(), title = "Notes", right = [I("search", 20), I("watch", 20), I("gear", 20)] } = {}) =>
    `<div class="nav"><div class="nl">${left}</div><b>${title}</b><div class="nr">${right.join("")}</div></div>`;

  KIT.capture = (label = "") => `<div class="cap"><span>${I("mic", 28, 2)}</span>${label ? `<small>${label}</small>` : ""}</div>`;

  const SRC = { watch_app: "watch", watch_complication: "watch", phone_app: "phone", mac_app: "mac", imported: "folder" };
  KIT.srcIcon = (src, s = 12) => I(SRC[src] || "phone", s);

  KIT.notes = [
    { id: "kitchen", title: "Kitchen reno: questions for the contractor", summary: "Cabinet lead time, whether the permit covers moving the sink, and a firm quote before Friday.",
      duration: "2:41", date: "Oct 19", source: "watch_app", isPinned: true, colorTag: "orange", actions: [0, 3], tags: ["home", "reno"], words: 412, template: "Action Items" },
    { id: "roadmap", title: "Q4 roadmap sync with Priya", summary: "Ship offline mode before the holiday freeze; Priya owns the pricing page; revisit Android in January.",
      duration: "31:12", date: "Oct 19", source: "mac_app", actions: [2, 6], tags: ["roadmap", "q4", "meeting"], words: 4630, template: "Meeting Notes" },
    { id: "interview", title: "Feedback on the onboarding flow from the user interview with Marcus at the coffee shop", summary: "",
      duration: "6:05", date: "Oct 19", source: "watch_complication", status: "Transcribing", tags: [] },
    { id: "trail", title: "Idea: offline maps for the trail app", summary: "Cache tiles per saved route; warn when a route leaves the cached area.",
      duration: "0:48", date: "Oct 18", source: "watch_complication", isFavorite: true, tags: ["idea"], words: 96, template: "Idea" },
    { id: "errands", title: "Errands before Thursday", summary: "Pharmacy pickup, return the drill, oat milk, birthday card for Dana.",
      duration: "0:35", date: "Oct 18", source: "phone_app", colorTag: "green", actions: [1, 4], tags: ["errands"], words: 58, template: "Checklist" },
    { id: "untitled", title: "Call with the bank about the mortgage", summary: "", duration: "4:10", date: "Oct 17", source: "watch_app", status: "Transcript only", tags: [] },
    { id: "books", title: "Book recommendations from Dana", summary: "Piranesi, The Overstory, and something by Ted Chiang she can't remember the name of.",
      duration: "1:12", date: "Oct 15", source: "watch_app", tags: ["books"], words: 140, template: "Bullet List" },
  ];
  KIT.note = (id) => KIT.notes.find((n) => n.id === id);

  const COLORS = { orange: "#FF9500", green: "#34C759", blue: "#007AFF", purple: "#AF52DE" };
  // NoteRowView: color bar, pin/title/status/star, 2-line summary, duration · reading time · n/m · date.
  KIT.row = (n, extra = "") => {
    const status = n.status === "Transcribing" ? `<span class="st"><i class="spin"></i>Transcribing</span>`
      : n.status === "Transcript only" ? `<span class="st warn">${I("warn", 11)}Transcript only</span>`
      : n.status ? `<span class="st">${n.status}</span>` : "";
    const read = n.words ? `<span class="t3">${Math.max(1, Math.round(n.words / 200))} min read</span>` : "";
    const act = n.actions ? `<span class="${n.actions[0] === n.actions[1] ? "ok" : ""}">${I("list", 11)} ${n.actions[0]}/${n.actions[1]}</span>` : "";
    return `<div class="ir" data-item>
      ${n.colorTag ? `<i class="ctag" style="background:${COLORS[n.colorTag]}"></i>` : ""}
      <div class="rc">
        <div class="rt">${n.isPinned ? `<span class="acc">${I("pin", 11)}</span>` : ""}<b>${n.title}</b>${status}${n.isFavorite ? `<span class="ifav">${I("star", 11)}</span>` : ""}</div>
        ${n.summary ? `<p>${n.summary}</p>` : ""}
        <div class="rm"><span>${I("wave", 11)} ${n.duration}</span>${read}${act}${extra}<span class="sp"></span><span class="t3">${n.date}</span></div>
      </div>
    </div>`;
  };
  KIT.section = (head, rows, cls = "") => `<div class="sh ${cls}">${head}</div><div class="ig">${rows}</div>`;

  // Spec card (frame "card"): Today vs Proposed, plus where it lands in the code and how to measure.
  // Styled with the review site's own tokens so it follows the site's light/dark theme.
  KIT.spec = ({ title, today, proposed, files = [], measure = [], risks = [] }) => `<div class="spec">
    <h3>${title}</h3>
    <div class="cols">
      <div><h5>Today</h5><ul>${today.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      <div class="pro"><h5>Proposed</h5><ul>${proposed.map((x) => `<li>${x}</li>`).join("")}</ul></div>
    </div>
    ${files.length ? `<h5>Where it lands</h5><div class="files">${files.map((f) => `<code>${f}</code>`).join("")}</div>` : ""}
    ${measure.length ? `<h5>How we'd know it worked</h5><ul class="m">${measure.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
    ${risks.length ? `<h5>Risks</h5><ul class="m risk">${risks.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
  </div>`;
})();
