// The home page's "Try the ring" card: the sample edition (development fixture) through the same
// Reader and preview the plugin and /preview use, so the page shows real cards, not a mock.
// No keyboard shortcuts here (Space and the arrows keep scrolling the page).
import { Reader, HtmlAudio, mountPreview, previewStatus } from "@g2digest/plugin";
import { positionDots, type Bundle } from "@g2digest/core";
import fixture from "@g2digest/core/fixtures/2026-10-22/bundle.json";

const host = document.getElementById("h-preview");
if (host) {
  const reader: Reader = new Reader({
    audio: new HtmlAudio(),
    audioUrl: async (p) => `/fixture/${p}`,
    onChange: (lines, r) => { preview.show(lines, positionDots(r.state.index, r.frames.length)); preview.status(previewStatus(r)); },
  });
  const preview = mountPreview(host, { onGesture: (g) => void reader.gesture(g), keyboard: false, note: false });
  reader.load(fixture as unknown as Bundle);
}
