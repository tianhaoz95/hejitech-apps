// Shared building blocks for the candidates: sample data, icons, formatting.
// Sample data must use only fields the real app has (or the candidate lists what it needs in facts.Needs),
// with realistic values: real-looking names, dates relative to today, a long title, an empty state.
window.KIT = window.KIT || {};

(() => {
  const P = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
  };
  KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

  // iOS chrome for phone frames (390×844 screen).
  KIT.statusBar = () => `<div class="sb"><b>9:41</b><span>●●● ▮</span></div>`;
  KIT.homeBar = () => `<div class="hb"></div>`;

  KIT.items = [
    { id: "a", title: "Kyoto fall break", sub: "Oct 20 – 27 · 4 travelers" },
    { id: "b", title: "Grandma's 80th birthday weekend in Lisbon", sub: "Dec 18 – 28 · shared by Aunt May" },
    { id: "c", title: "Tahoe ski weekend", sub: "Feb 12 – 15 · downloading 64%" },
  ];
})();
