// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-11-01-youtube-channel-v1", dir: "reports/2026-11-01-youtube-channel", repo: "tianhaoz95/hejitech-apps", port: 8828,   // new.sh fills these
  title: "HEJI TECH YouTube channel setup",
  project: "repo-wide (the HEJI TECH YouTube channel that hosts every project's promo videos)",
  context: [
    "reports/2026-11-01-youtube-channel/script/assets/ (banner.html, avatar.html, watermark.svg: the sources of the three images)",
    "pages/public/heji.svg and pages/.vitepress/theme/apps.ts (the HEJI logo, app names and taglines used here)",
    "branding/README.md and the promo-video reports (reports/2026-10-30-*-promo-video, reports/2026-10-31-*-promo-video) for the videos the channel holds",
  ],
  brief: "Customize the HEJI TECH YouTube channel, where the promotional videos are uploaded: banner, picture, name, handle, description, links, contact email, watermark and the Home tab, from screenshots of YouTube Studio's Channel customization page.",
  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh).`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done; pick up from the first open one.` : "",
    "If the reader asks for a different banner, picture or watermark, edit the sources in script/assets/, re-render them with the cached Playwright chrome-headless-shell (banner 2560x1440, picture 800x800; watermark with rsvg-convert at 150x150) and replace the files in site/media/.",
    "If they change the description or links, update the fields in §3 so the report stays the record.",
  ].filter(Boolean),

  blocks: {
    order: {
      kind: "steps", title: "The order to do it in",
      note: "Playlists come first because the Home tab can only show playlists that exist.",
      steps: [
        { actor: "Studio · Content", text: "Upload the promo cuts (if not already) and make one playlist per app." },
        { actor: "Customization · Profile", text: "Banner, picture, description, links, email, watermark. Click Publish." },
        { actor: "Customization · Home tab", text: "Trailer for new visitors, featured video for subscribers, sections. Publish." },
        { actor: "Settings", text: "Keywords, audience (not made for kids), upload defaults." },
        { actor: "Your channel page", text: "Check it on a phone and a computer, signed out." },
      ],
    },
    sizes: {
      kind: "table", title: "The three images: YouTube's limits and what's in this report",
      head: ["Image", "YouTube asks for", "File here", "Size"],
      rows: [
        ["Banner", "≥ 2048 × 1152, ≤ 6 MB; only the middle 1546 × 423 (of 2560 × 1440) shows on every device", "heji-youtube-banner.png", "2560 × 1440 PNG, 459 KB"],
        ["Picture", "PNG or static GIF, ≥ 98 × 98, ≤ 4 MB; shown as a circle", "heji-youtube-picture.png", "800 × 800 PNG, 10 KB"],
        ["Watermark", "150 × 150 recommended; PNG, GIF (no animation), BMP or JPEG, ≤ 1 MB", "heji-youtube-watermark.png", "150 × 150 PNG, transparent corners, 4 KB"],
      ],
    },
  },
};
