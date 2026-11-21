// The MCP Apps view (ui://folio/viewer.html) hosts render for show_artifact: a header with the
// artifact's title and version, and the artifact itself in a sandboxed frame loaded from Folio's
// render URL. It speaks the host's postMessage JSON-RPC (ui/initialize → tool-input/tool-result
// notifications) by hand; no SDK, no network access of its own beyond that frame.
export const VIEWER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Folio</title>
<style>
  :root { --bg: #ffffff; --fg: #1d1d1b; --muted: #6b6b66; --line: #e6e4de; --accent: #1e2a78; color-scheme: light; }
  :root[data-theme="dark"] { --bg: #171716; --fg: #ecebe6; --muted: #a3a29b; --line: #34332f; --accent: #8f9bff; color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--line); min-height: 40px; }
  .mark { width: 18px; height: 18px; flex: none; display: block; }
  .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .meta { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
  button { font: inherit; color: var(--accent); background: none; border: 1px solid var(--line); border-radius: 6px; padding: 4px 9px; cursor: pointer; white-space: nowrap; }
  button:hover { border-color: var(--accent); }
  iframe { display: block; width: 100%; height: 520px; border: 0; background: #fff; }
  .empty { padding: 28px 16px; color: var(--muted); text-align: center; }
</style>
</head>
<body>
<header>
  <svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#f2ede4"/><rect x="17.5" y="13.5" width="11" height="37" rx="1.5" fill="#1e2a78"/><path d="M28.5 29.5v-16a16 16 0 0 1 16 16z" fill="#f25c3b"/><circle cx="35.5" cy="40" r="5.75" fill="#f2b630"/></svg>
  <div class="title" id="title">Folio</div>
  <div class="meta" id="meta"></div>
  <button id="open" type="button" hidden>Open in Folio</button>
</header>
<div id="body"><div class="empty">Loading artifact…</div></div>
<script>
(() => {
  let nextId = 1;
  const pending = new Map();
  let viewUrl = null;
  const send = (msg) => window.parent.postMessage(msg, "*");
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
  });
  const notify = (method, params) => send({ jsonrpc: "2.0", method, ...(params ? { params } : {}) });

  function applyTheme(ctx) {
    if (ctx && ctx.theme) document.documentElement.dataset.theme = ctx.theme === "dark" ? "dark" : "light";
    const h = ctx && ctx.containerDimensions && (ctx.containerDimensions.maxHeight || ctx.containerDimensions.height);
    if (h && frame) frame.style.height = Math.max(320, Math.min(900, h - 42)) + "px";
  }

  let frame = null;
  function show(result) {
    const s = (result && result.structuredContent) || {};
    const body = document.getElementById("body");
    if (result && result.isError) {
      body.innerHTML = "";
      const p = document.createElement("div");
      p.className = "empty";
      p.textContent = (s.message || "Folio couldn't open this artifact.");
      body.append(p);
      return;
    }
    const a = s.artifact || {};
    document.getElementById("title").textContent = a.title || "Untitled";
    const showing = s.showing || {};
    document.getElementById("meta").textContent = showing.suggestion
      ? "Suggestion #" + showing.suggestion + " (preview)"
      : "v" + (showing.version || a.head_version || "?") + (showing.agent ? " · " + showing.agent : "") + (showing.message ? " · " + showing.message : "");
    viewUrl = s.view_url || a.url || null;
    document.getElementById("open").hidden = !viewUrl;
    if (!s.render_url) return;
    frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("title", a.title || "Artifact");
    frame.src = s.render_url;
    body.replaceChildren(frame);
    reportSize();
  }

  function reportSize() {
    const h = document.documentElement.scrollHeight;
    notify("ui/notifications/size-changed", { width: document.documentElement.scrollWidth, height: h });
  }

  document.getElementById("open").addEventListener("click", () => {
    if (!viewUrl) return;
    request("ui/open-link", { url: viewUrl }).catch(() => window.open(viewUrl, "_blank", "noopener"));
  });

  window.addEventListener("message", (ev) => {
    if (ev.source !== window.parent) return;
    const m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && pending.has(m.id) && (m.result !== undefined || m.error !== undefined)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
      return;
    }
    switch (m.method) {
      case "ui/notifications/tool-result": show(m.params); break;
      case "ui/notifications/host-context-changed": applyTheme(m.params); break;
      case "ui/notifications/tool-cancelled": document.getElementById("body").innerHTML = '<div class="empty">Cancelled.</div>'; break;
      case "ui/resource-teardown": send({ jsonrpc: "2.0", id: m.id, result: {} }); break;
      case "ping": if (m.id !== undefined) send({ jsonrpc: "2.0", id: m.id, result: {} }); break;
    }
  });

  new ResizeObserver(() => reportSize()).observe(document.body);

  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appInfo: { name: "folio-viewer", version: "0.1.0" },
    appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] },
  }).then((r) => {
    applyTheme(r && r.hostContext);
    notify("ui/notifications/initialized");
  }).catch(() => notify("ui/notifications/initialized"));
})();
</script>
</body>
</html>`;
