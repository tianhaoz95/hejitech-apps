// The executor window: install, set up, see and control the local executor. Everything it does goes
// through the app's own commands (src-tauri/src/lib.rs), which run the installed CLI; nothing here
// approves, places or edits orders: approvals happen on the board, orders only in the daemon.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check as checkUpdate, type Update } from "@tauri-apps/plugin-updater";

interface ConfigSummary {
  board_url: string; executor_id: string; has_token: boolean; account_mask: string | null;
  model_enabled: boolean; model_url: string; model_name: string; allow_live: boolean;
}
interface Status {
  state: "running" | "stopped"; at: string; mode: "live" | "dry_run"; paused: boolean; policy_version: number | null;
  local_model_id: string | null; model_check_enabled: boolean; local_live_allowed: boolean; robinhood_connected: boolean;
  trade_approvals: string; account_mask: string | null; account_matches: boolean | null; last_error: string | null;
  version: string; board_url: string; board_ok_at: string | null;
}
interface Overview {
  home: string; bundled_version: string | null; cli_installed: boolean; cli_version: string | null;
  config: ConfigSummary | null; config_error: string | null; robinhood_tokens: boolean;
  service: { installed: boolean; loaded: boolean; running: boolean; pid: number | null };
  status: Status | null; status_age_secs: number | null; kill: boolean;
}

const DEFAULT_BOARD = "https://tradeboard.hejitech.workers.dev";
const STALE = 90;

type Child = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v as EventListener);
    else if (k in n && typeof v !== "string") (n as unknown as Record<string, unknown>)[k] = v;
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
}

function toast(msg: string, bad = false) {
  const t = el("div", { class: `toast${bad ? " bad" : ""}`, role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3000);
}

function confirmDialog(title: string, body: string[], confirm: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const d = el("dialog", {},
      el("h2", {}, title), ...body.map((p) => el("p", { class: "small" }, p)),
      el("div", { class: "row", style: "justify-content: flex-end; margin-top: 12px" },
        el("button", { class: "btn", onclick: () => { d.close(); resolve(false); } }, "Cancel"),
        el("button", { class: `btn ${danger ? "danger" : "primary"}`, onclick: () => { d.close(); resolve(true); } }, confirm)));
    d.addEventListener("close", () => { d.remove(); resolve(false); });
    document.body.append(d);
    d.showModal();
  });
}

/** Runs an action with its button disabled and a working label. */
async function busy<T>(btn: HTMLButtonElement, label: string, fn: () => Promise<T>): Promise<T | undefined> {
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    return await fn();
  } catch (e) {
    toast(String(e).slice(0, 300), true);
    return undefined;
  } finally {
    btn.disabled = false;
    btn.textContent = was;
  }
}

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleString();
};

let ov: Overview | null = null;
const root = document.getElementById("app")!;
const updateHost = el("div", {});
const headerHost = el("div", {});
const installHost = el("div", {});
const statusHost = el("div", {});
const setupHost = el("div", {});
const safetyHost = el("div", {});
const checkHost = el("div", {});
const logHost = el("div", {});
let setupBuiltFor = "";

// ------------------------------------------------------------------------------------ header

function header(o: Overview) {
  const st = state(o);
  return el("div", { class: "spread" },
    el("div", {}, el("h1", {}, "Tradeboard Executor"),
      el("p", { class: "muted small" }, "Places the orders you approve on your Trading Plan Board, from this Mac, through Robinhood's official MCP.")),
    el("span", { class: `badge ${st.tone}` }, st.label));
}

function state(o: Overview): { label: string; tone: "on" | "off" | "warn" | "neutral" } {
  if (!o.cli_installed) return { label: "Not installed", tone: "neutral" };
  if (!o.config) return { label: "Not set up", tone: "warn" };
  if (!o.service.running) return { label: "Stopped", tone: "off" };
  if (!o.status || (o.status_age_secs ?? 999) > STALE) return { label: "Starting…", tone: "warn" };
  if (o.kill) return { label: "Not claiming", tone: "warn" };
  return o.status.mode === "live" ? { label: "Running · live", tone: "on" } : { label: "Running · dry-run", tone: "on" };
}

// ----------------------------------------------------------------------------------- install

function install(o: Overview) {
  if (o.cli_installed) {
    const older = o.cli_version && o.bundled_version && o.cli_version !== o.bundled_version;
    return older ? el("div", { class: "banner small" }, `Installed executor ${o.cli_version}; this app carries ${o.bundled_version}.`) : null;
  }
  const btn = el("button", { class: "btn primary" }, "Install the executor");
  btn.addEventListener("click", () => busy(btn, "Installing…", async () => {
    const out = await invoke<string>("install_cli");
    toast("Installed");
    checkHost.replaceChildren(result("Install", out));
    await load();
  }));
  return el("section", { class: "panel stack" },
    el("h2", {}, "Install the executor on this Mac"),
    el("p", {}, "This installs the same command-line executor as ", el("code", {}, "install.sh"), ": the program in ", el("code", {}, `${o.home}/bin`),
      ", Node if this Mac doesn't have a recent one, and a login service that keeps it running when this window is closed."),
    el("p", { class: "small muted" }, "Prefer the terminal? You can use ", el("code", {}, "tradeboard-executor"), " from that folder at any time; this app shows the same setup."),
    el("div", { class: "row" }, btn));
}

// ------------------------------------------------------------------------------------ status

function status(o: Overview) {
  if (!o.cli_installed || !o.config) return null;
  const s = o.status;
  const fresh = s && (o.status_age_secs ?? 999) < STALE;
  const svc = o.service;
  const start = el("button", { class: `btn ${svc.running ? "" : "primary"}` }, svc.running ? "Stop" : "Start");
  start.addEventListener("click", async () => {
    if (svc.running && !(await confirmDialog("Stop the executor?", ["It stops sending heartbeats and won't claim approved plans until you start it again. Plans already placed aren't affected."], "Stop", true))) return;
    await busy(start, svc.running ? "Stopping…" : "Starting…", async () => { await invoke("service", { action: svc.running ? "stop" : "start" }); await load(); });
  });
  const restart = el("button", { class: "btn", disabled: !svc.running }, "Restart");
  restart.addEventListener("click", () => busy(restart, "Restarting…", async () => { await invoke("service", { action: "restart" }); await load(); }));
  const portal = el("a", { onclick: () => openUrl(`${(o.config?.board_url || DEFAULT_BOARD).replace(/\/$/, "")}/executor/`) }, "Executor page on the board");
  return el("section", { class: "panel" },
    el("div", { class: "spread" }, el("h2", {}, "Status"), el("div", { class: "row" }, restart, start)),
    !svc.running ? el("p", { class: "warn" }, "The executor isn't running, so approved plans wait on the board.") : null,
    svc.running && !fresh ? el("p", { class: "muted" }, "Waiting for the executor's first heartbeat…") : null,
    s ? el("dl", { class: "kv" },
      el("dt", {}, "Board"), el("dd", {}, s.board_ok_at ? `reached ${ago(s.board_ok_at)}` : "not reached yet", " · ", portal),
      el("dt", {}, "Mode"), el("dd", {}, s.mode === "live" ? "live" : "dry-run", s.paused ? " · paused" : "", s.local_live_allowed ? "" : " (live not allowed on this Mac)"),
      el("dt", {}, "Policy"), el("dd", {}, s.policy_version ? `v${s.policy_version}` : "none loaded yet"),
      el("dt", {}, "Robinhood"), el("dd", { class: s.robinhood_connected ? "" : "warn" }, s.robinhood_connected ? "connected" : "not connected",
        s.account_mask ? ` · account ${s.account_mask}` : "", s.account_matches === false ? " · not the configured account" : ""),
      el("dt", {}, "Trade approvals"), el("dd", {}, s.trade_approvals),
      el("dt", {}, "Local model"), el("dd", {}, s.local_model_id ?? "—", s.model_check_enabled ? "" : " · check off"),
      el("dt", {}, "Last error"), el("dd", { class: s.last_error ? "error" : "muted" }, s.last_error ?? "none"),
      el("dt", {}, "Last heartbeat"), el("dd", {}, ago(s.at)),
      el("dt", {}, "Version"), el("dd", {}, s.version)) : null);
}

// ------------------------------------------------------------------------------------- setup

function setup(o: Overview) {
  if (!o.cli_installed) return null;
  const c = o.config;
  const boardUrl = el("input", { type: "url", value: c?.board_url || DEFAULT_BOARD, spellcheck: false });
  const execId = el("input", { type: "text", value: c?.executor_id || "mac", spellcheck: false });
  const token = el("input", { type: "password", placeholder: c?.has_token ? "saved (paste a new one to replace it)" : "tbx_…", autocomplete: "off" });
  const account = el("input", { type: "password", placeholder: c?.account_mask ? `saved: ${c.account_mask}` : "the dedicated agentic account's number", autocomplete: "off" });
  const modelOn = el("input", { type: "checkbox", checked: c ? c.model_enabled : true });
  const modelUrl = el("input", { type: "url", value: c?.model_url || "http://127.0.0.1:11434/v1", spellcheck: false });
  const modelName = el("input", { type: "text", value: c?.model_name || "gemma4:26b", spellcheck: false });
  const sync = () => { modelUrl.disabled = modelName.disabled = !modelOn.checked; };
  modelOn.addEventListener("change", sync);
  sync();

  const save = el("button", { class: "btn primary", type: "submit" }, c ? "Save" : "Save and start");
  const form = el("form", { class: "steps" },
    el("div", { class: "step" }, el("h3", {}, "Connect to your board"),
      el("p", { class: "small muted" }, "On the board's ", el("a", { onclick: () => openUrl(`${(boardUrl.value || DEFAULT_BOARD).replace(/\/$/, "")}/executor/`) }, "Executor page"),
        ", make a new executor credential with the same id as below and paste it here. It's shown once and stays on this Mac."),
      el("div", { class: "grid2" },
        el("label", {}, "Board URL", boardUrl),
        el("label", {}, "Executor id", execId, el("span", { class: "hint" }, "as issued on the board")),
        el("label", { style: "grid-column: 1 / -1" }, "Executor credential", token))),
    el("div", { class: "step" }, el("h3", {}, "Robinhood"),
      el("label", {}, "Dedicated account number", account,
        el("span", { class: "hint" }, "The agentic account Robinhood's MCP trades in. It stays on this Mac; the board only sees the last four digits.")),
      robinhood(o)),
    el("div", { class: "step" }, el("h3", {}, "Local model check"),
      el("p", { class: "small muted" }, "Before each order the executor asks a model whether the plan is consistent. Any OpenAI-compatible endpoint works: Ollama, LM Studio, llama.cpp, vLLM. Without it the executor stays in dry-run unless your policy allows otherwise."),
      el("label", { class: "check" }, modelOn, el("span", {}, "Check every order with a model")),
      el("div", { class: "grid2" }, el("label", {}, "Endpoint", modelUrl), el("label", {}, "Model", modelName)),
      el("div", { class: "row", style: "margin-top: 8px" }, checkButton("model-check", "Test the model"))),
    el("div", { class: "row" }, save));
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!c?.has_token && !token.value.trim()) return toast("Paste the executor credential from the board", true);
    if (!c?.account_mask && !account.value.trim()) return toast("Enter the dedicated account number", true);
    busy(save, "Saving…", async () => {
      const out = await invoke<string>("save_setup", {
        input: { board_url: boardUrl.value, executor_id: execId.value, token: token.value, account: account.value, model_enabled: modelOn.checked, model_url: modelUrl.value, model_name: modelName.value },
      });
      token.value = account.value = "";
      toast("Saved");
      checkHost.replaceChildren(result("Setup", out));
      setupBuiltFor = "";
      await load();
    });
  });
  return el("section", { class: "panel" }, el("h2", {}, c ? "Setup" : "Set up the executor"),
    o.config_error ? el("p", { class: "error" }, o.config_error) : null, form);
}

function robinhood(o: Overview) {
  const btn = el("button", { class: "btn", type: "button", disabled: !o.config }, o.robinhood_tokens ? "Sign in again" : "Sign in to Robinhood");
  btn.addEventListener("click", () => busy(btn, "Waiting for the browser…", async () => {
    toast("Finish signing in in your browser");
    const out = await invoke<string>("robinhood_sign_in");
    checkHost.replaceChildren(result("Robinhood sign-in", out));
    toast("Signed in to Robinhood");
    await load();
  }));
  return el("div", { class: "row", style: "margin-top: 8px" }, btn,
    el("span", { class: "small muted" }, !o.config ? "Save the setup first." : o.robinhood_tokens ? "Signed in on this Mac (tokens in its executor folder)." : "Opens Robinhood's sign-in in your browser."));
}

// ------------------------------------------------------------------------------------ safety

function safety(o: Overview, loginItem: boolean) {
  if (!o.cli_installed || !o.config) return null;
  const kill = el("input", { type: "checkbox", checked: !o.kill });
  kill.addEventListener("change", async () => {
    await invoke("set_kill", { on: !kill.checked }).catch((e) => toast(String(e), true));
    await load();
  });
  const live = el("input", { type: "checkbox", checked: o.config.allow_live });
  live.addEventListener("change", async () => {
    const want = live.checked;
    live.checked = !want;
    if (want && !(await confirmDialog("Allow live orders from this Mac?", [
      "This is this Mac's half of the live switch. Real orders still need the board's dry-run off, the live-mode checklist complete, Robinhood connected to the confirmed account and the model check (or your policy's waiver).",
      "Every order is one you approved on the board. You remain responsible for every trade.",
    ], "Allow live"))) return;
    await invoke<string>("set_live", { allow: want }).then(() => toast(want ? "Live allowed on this Mac" : "Live off on this Mac")).catch((e) => toast(String(e), true));
    await load();
  });
  const login = el("input", { type: "checkbox", checked: loginItem });
  login.addEventListener("change", async () => {
    await (login.checked ? enableAutostart() : disableAutostart()).catch((e) => toast(String(e), true));
    toast(login.checked ? "Opens at login" : "Won't open at login");
  });
  return el("section", { class: "panel stack" }, el("h2", {}, "Controls"),
    el("label", { class: "check" }, kill, el("span", {}, el("strong", {}, "Claim approved plans"), el("br", {}),
      el("span", { class: "small muted" }, "Off stops claiming new plans right away, like Kill on the board, while the executor keeps reporting in."))),
    el("label", { class: "check" }, live, el("span", {}, el("strong", {}, "Allow live orders on this Mac"), el("br", {}),
      el("span", { class: "small muted" }, "Off keeps this Mac in dry-run whatever the board says."))),
    el("label", { class: "check" }, login, el("span", {}, el("strong", {}, "Show in the menu bar at login"), el("br", {}),
      el("span", { class: "small muted" }, "The executor itself runs as a login service either way."))));
}

// ------------------------------------------------------------------------------ checks + log

function checkButton(kind: "check" | "model-check", label: string) {
  const btn = el("button", { class: "btn", type: "button" }, label);
  btn.addEventListener("click", () => busy(btn, "Checking…", async () => {
    const out = await invoke<string>("run_check", { kind });
    checkHost.replaceChildren(result(label, out));
    checkHost.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));
  return btn;
}

function result(title: string, out: string) {
  const lines = out.trim().split("\n");
  const fails = lines.filter((l) => l.startsWith("FAIL")).length;
  return el("section", { class: "panel" },
    el("div", { class: "spread" }, el("h2", {}, title), fails ? el("span", { class: "badge off" }, `${fails} failed`) : lines.some((l) => l.startsWith("ok")) ? el("span", { class: "badge on" }, "All ok") : null,
      el("button", { class: "btn small", onclick: () => checkHost.replaceChildren() }, "Close")),
    el("pre", {}, out.trim() || "(no output)"));
}

const logText = el("pre", { class: "mono" }, "Nothing logged yet.");
let logPanelBuilt = false;
async function logPanel() {
  const path = await invoke<string>("log_path");
  return el("section", { class: "panel" },
    el("div", { class: "spread" }, el("h2", {}, "Log"),
      el("div", { class: "row" }, checkButton("check", "Run full check"),
        el("button", { class: "btn", onclick: () => revealItemInDir(path).catch(() => toast("No log file yet", true)) }, "Show in Finder"))),
    logText);
}

// ----------------------------------------------------------------------------------- updates

async function updates(manual: boolean) {
  let u: Update | null = null;
  try {
    u = await checkUpdate();
  } catch (e) {
    if (manual) toast(`Couldn't check for updates: ${e}`, true);
    return;
  }
  if (!u) {
    if (manual) toast("You're up to date");
    return;
  }
  const update = u;
  const btn = el("button", { class: "btn primary" }, "Install and restart");
  btn.addEventListener("click", () => busy(btn, "Downloading…", async () => {
    await update.downloadAndInstall();
    await relaunch();
  }));
  updateHost.replaceChildren(el("div", { class: "banner note spread" },
    el("span", {}, `Tradeboard Executor ${update.version} is available. It updates the executor too.`), btn));
}

// -------------------------------------------------------------------------------------- load

async function load() {
  ov = await invoke<Overview>("overview");
  const o = ov;
  headerHost.replaceChildren(header(o));
  installHost.replaceChildren(install(o) ?? "");
  statusHost.replaceChildren(status(o) ?? "");
  // Forms are rebuilt only when what they show changed and nobody is typing in them.
  const key = JSON.stringify([o.cli_installed, o.config, o.robinhood_tokens]);
  if (key !== setupBuiltFor && !setupHost.contains(document.activeElement)) {
    setupHost.replaceChildren(setup(o) ?? "");
    setupBuiltFor = key;
  }
  const loginItem = await autostartEnabled().catch(() => false);
  if (!safetyHost.contains(document.activeElement)) safetyHost.replaceChildren(safety(o, loginItem) ?? "");
  if (o.cli_installed) {
    if (!logPanelBuilt) { logHost.replaceChildren(await logPanel()); logPanelBuilt = true; }
    const text = await invoke<string>("read_log", { lines: 120 });
    if (logText.textContent !== (text || "Nothing logged yet.")) {
      const atEnd = logText.scrollTop + logText.clientHeight >= logText.scrollHeight - 4;
      logText.textContent = text || "Nothing logged yet.";
      if (atEnd) logText.scrollTop = logText.scrollHeight;
    }
  }
}

root.replaceChildren(updateHost, headerHost, installHost, statusHost, checkHost, setupHost, safetyHost, logHost,
  el("p", { class: "small muted" }, "This app never places orders itself. You approve plans on the board; the executor places them after its own checks."));

await load().catch((e) => root.prepend(el("p", { class: "error" }, String(e))));
setInterval(() => load().catch(() => {}), 3000);
listen("overview-changed", () => load().catch(() => {}));
listen("check-updates", () => updates(true));
listen<string>("cli-updated", (e) => toast(e.payload));
if (!import.meta.env.DEV) updates(false);
