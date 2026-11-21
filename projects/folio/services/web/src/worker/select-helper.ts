// A small script added to an artifact's HTML when the workspace frames it (`?folio=select`), so
// people can comment on a part they select. The page runs sandboxed in an opaque origin, so the
// workspace can't read its selection itself; this tells it, by postMessage, only what's selected
// (text, a CSS selector, the file) and finds a comment's quote when asked. Anything the artifact's
// own scripts post looks the same, and the worst that does is fill in a quote in the viewer's own
// comment box, which they see before sending.
//
// Plain JavaScript in a string, not a bundled function: the bundler may add helpers (`__name`)
// that wouldn't exist inside the artifact's page. The iPhone app runs the same selection and find
// logic (apps/ios/App/Sources/Views/WebPreview.swift, PreviewScript).

const HELPER = String.raw`(function (origin) {
  var top = window.parent;
  if (top === window) return;
  var path = "";
  try { path = decodeURIComponent(location.pathname.split("/").slice(5).join("/")); } catch (e) {}
  function post(msg) { msg.folio = true; msg.path = path; top.postMessage(msg, origin); }

  function selection() {
    var s = getSelection();
    var text = s ? s.toString().replace(/\s+/g, " ").trim() : "";
    if (!s || !text || !s.rangeCount) return null;
    var e = s.getRangeAt(0).commonAncestorContainer;
    if (e.nodeType !== 1) e = e.parentElement;
    var parts = [];
    while (e && e !== document.body && e !== document.documentElement && parts.length < 6) {
      if (e.id) { parts.unshift("#" + CSS.escape(e.id)); break; }
      var i = 1;
      for (var p = e.previousElementSibling; p; p = p.previousElementSibling) if (p.tagName === e.tagName) i++;
      parts.unshift(e.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
      e = e.parentElement;
    }
    if (parts.length && e === document.body) parts.unshift("body");
    return { text: text.slice(0, 500), selector: parts.join(" > ") };
  }

  var finding = false;
  function find(text, selector) {
    finding = true;
    setTimeout(function () { finding = false; }, 400);
    var s = getSelection();
    function tryFind(q) {
      if (!q || !s || !window.find) return false;
      s.removeAllRanges();
      var ok = window.find(q, false, false, true, false, false, false);
      if (ok && s.rangeCount) {
        var r = s.getRangeAt(0).getBoundingClientRect();
        window.scrollBy({ top: r.top - innerHeight / 3, behavior: "smooth" });
      }
      return ok;
    }
    var words = (text || "").split(" ");
    if (tryFind(text) || tryFind(words.slice(0, 8).join(" ")) || tryFind(words.slice(0, 4).join(" "))) return true;
    if (s) s.removeAllRanges();
    try {
      var el = selector ? document.querySelector(selector) : null;
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); return true; }
    } catch (e) {}
    return false;
  }

  var timer = 0;
  document.addEventListener("selectionchange", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (finding) return; // showing a comment's quote, not someone selecting
      var sel = selection() || { text: "" };
      post({ kind: "selection", text: sel.text, selector: sel.selector });
    }, 200);
  });
  addEventListener("message", function (e) {
    if (e.source !== top || e.origin !== origin) return;
    var d = e.data;
    if (d && d.folio === "find") post({ kind: "found", ok: find(String(d.text || ""), String(d.selector || "")) });
  });
  post({ kind: "ready" });
})`;

/** The script tag for pages framed by `origin` (Folio's own origin; messages go only there). */
export function selectHelper(origin: string): string {
  return `<script>${HELPER}(${JSON.stringify(origin).replace(/</g, "\\u003c")});</script>`;
}

/** The page with the helper before `</body>` (or at the end when there's none). */
export function withSelectHelper(html: string, origin: string): string {
  const tag = selectHelper(origin);
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i < 0 ? html + tag : html.slice(0, i) + tag + html.slice(i);
}
