// /pair: the pairing code for the glasses plugin, paired devices (revoke), the private podcast feed
// (the native-player fallback), agent tokens and connected assistants (PRD §4.3 steps 2 and 6).
import { api, el, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;

interface Device { id: string; kind: "glasses" | "feed"; label: string; created_at: string; last_used_at: string | null }
interface Token { id: string; name: string; created_at: string; last_used_at: string | null }
interface Grant { id: string; client_name: string | null; created_at: string }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");

async function render() {
  root.replaceChildren(spinner());
  const session = await requireSession(root, render);
  if (!session) return;

  // ---------------------------------------------------------------- pairing code
  const codeBox = el("div", { class: "code", "aria-live": "polite" }, "······");
  const expiry = el("p", { class: "muted small" });
  let timer: ReturnType<typeof setInterval> | null = null;
  const newCode = async () => {
    const r = await api<{ code: string; expires_at: string; error?: string }>("/api/pairing-code", { method: "POST" });
    if (!r.ok) return void (expiry.textContent = r.body.error ?? "Couldn't make a code.");
    codeBox.textContent = r.body.code;
    const until = Date.parse(r.body.expires_at);
    if (timer) clearInterval(timer);
    const tick = () => {
      const s = Math.max(0, Math.round((until - Date.now()) / 1000));
      expiry.textContent = s ? `Expires in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}. Works once.` : "Expired. Get a new code.";
      if (!s) { codeBox.textContent = "······"; if (timer) clearInterval(timer); }
    };
    tick();
    timer = setInterval(tick, 1000);
  };
  const pairPanel = el("section", { class: "panel" },
    el("h1", {}, "Pair your glasses"),
    el("p", { class: "muted" }, "Open G2 Digest in the Even app on your phone and type this code. Paired glasses can read your editions and nothing else."),
    codeBox, expiry,
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "button", onclick: newCode }, "New code"),
      el("a", { class: "btn secondary", href: "/preview/latest" }, "Preview today's cards")));

  // ---------------------------------------------------------------- devices + feeds
  const devices = el("ul", { class: "list" });
  const feedOut = el("div", { class: "stack" });
  const loadDevices = async () => {
    const r = await api<Device[]>("/api/devices");
    devices.replaceChildren(...(r.body.length ? r.body : []).map((d) =>
      el("li", {},
        el("div", {}, el("b", {}, d.label), " ", el("span", { class: "badge" }, d.kind === "feed" ? "podcast feed" : "glasses"),
          el("div", { class: "muted small" }, `Paired ${when(d.created_at)} · last used ${when(d.last_used_at)}`)),
        el("button", { class: "btn danger", type: "button", onclick: async () => {
          if (!confirm(`Revoke "${d.label}"? It stops working right away.`)) return;
          await api(`/api/devices/${d.id}`, { method: "DELETE" });
          void loadDevices();
        } }, "Revoke"))));
    if (!r.body.length) devices.append(el("li", { class: "muted" }, "Nothing paired yet."));
  };
  const devicesPanel = el("section", { class: "panel" },
    el("h2", {}, "Paired devices"), devices,
    el("h3", { style: "margin-top: 18px" }, "Podcast feed"),
    el("p", { class: "muted small" }, "A private feed of every card's audio, for a podcast app that keeps playing with the phone locked. The glasses then tell you which episode to play. Anyone with the link can listen, so keep it to yourself; revoke it above."),
    feedOut,
    el("button", { class: "btn secondary", type: "button", onclick: async () => {
      const r = await api<{ url: string; error?: string }>("/api/feeds", { method: "POST" });
      feedOut.replaceChildren(r.ok
        ? el("div", {}, el("p", { class: "small" }, "Add this URL in your podcast app (shown once):"), el("div", { class: "secret mono" }, r.body.url))
        : el("p", { class: "error" }, r.body.error ?? "Couldn't make a feed."));
      void loadDevices();
    } }, "Make a feed link"));

  // ---------------------------------------------------------------- agent tokens + assistants
  const tokens = el("ul", { class: "list" });
  const tokenOut = el("div");
  const grants = el("ul", { class: "list" });
  const loadTokens = async () => {
    const [t, g] = await Promise.all([api<Token[]>("/api/tokens"), api<Grant[]>("/api/grants")]);
    tokens.replaceChildren(...t.body.map((x) => el("li", {},
      el("div", {}, el("b", {}, x.name), el("div", { class: "muted small" }, `Made ${when(x.created_at)} · last used ${when(x.last_used_at)}`)),
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/tokens/${x.id}`, { method: "DELETE" }); void loadTokens(); } }, "Revoke"))));
    if (!t.body.length) tokens.append(el("li", { class: "muted" }, "No agent tokens."));
    grants.replaceChildren(...(Array.isArray(g.body) ? g.body : []).map((x) => el("li", {},
      el("div", {}, el("b", {}, x.client_name ?? "Unnamed assistant"), el("div", { class: "muted small" }, `Connected ${when(x.created_at)}`)),
      el("button", { class: "btn danger", type: "button", onclick: async () => { await api(`/api/grants/${encodeURIComponent(x.id)}`, { method: "DELETE" }); void loadTokens(); } }, "Disconnect"))));
    if (!grants.children.length) grants.append(el("li", { class: "muted" }, "No assistants connected over OAuth."));
  };
  const name = el("input", { placeholder: "Token name, e.g. Daily build", value: "Daily build" });
  const agentsPanel = el("section", { class: "panel" },
    el("h2", {}, "Build agents"),
    el("p", { class: "muted small" }, "The agent that compiles your editions connects to ", el("code", {}, `${location.origin}/mcp`), " with OAuth, or with a token from here. See ", el("a", { href: "/agents/" }, "Build agents"), "."),
    tokens,
    el("div", { class: "row", style: "margin-top: 10px" }, name, el("button", { class: "btn secondary", type: "button", onclick: async () => {
      const r = await api<{ token: string; error?: string }>("/api/tokens", { method: "POST", body: JSON.stringify({ name: name.value }) });
      tokenOut.replaceChildren(r.ok ? el("div", {}, el("p", { class: "small" }, "Copy it now, it's shown once:"), el("div", { class: "secret mono" }, r.body.token)) : el("p", { class: "error" }, r.body.error ?? "Couldn't make a token."));
      void loadTokens();
    } }, "Make token")),
    tokenOut,
    el("h3", { style: "margin-top: 18px" }, "Connected assistants"), grants);

  root.replaceChildren(pairPanel, devicesPanel, agentsPanel);
  await Promise.all([newCode(), loadDevices(), loadTokens()]);
}
void render();
