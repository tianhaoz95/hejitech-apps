// Screen recordings of the real Trading Plan Board portal for the tradeboard-launch promo.
// LOCAL ONLY: drives the local stack (supabase start + npm run dev:worker -w @tradeboard/web) with the
// seed user and the tba_dev_* agents, and the executor in dry-run against scripts/mock-robinhood.mjs.
// It never talks to production or Robinhood, and never places an order.
//
//   node branding/promo-videos/scripts/tradeboard-launch-record.mjs [beat …]
//
// Beats (default: all, in order, since each builds on the last): board, debate, approve, receipt,
// failclosed. Writes public/tradeboard-launch/rec-<beat>.mp4 (30 fps; desktop 1920×1080 from a 1120×630 window at 2×, so text is large; phone 1080×2340).
// It resets the seed user's board first (like projects/tradeboard/scripts/test-api.mjs does).
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../../..");
const OUT = resolve(here, "../public/tradeboard-launch");
const TB = `${REPO}/projects/tradeboard`;
const { chromium } = createRequire(`${REPO}/package.json`)("playwright");
const { base32Decode, hotp } = await import(`${TB}/packages/core/src/index.ts`);

const SITE = "http://127.0.0.1:8798", SUPA = "http://127.0.0.1:55421";
// Local Supabase's public demo anon key (same for every `supabase start`).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SEED_USER = "00000000-0000-4000-8000-00000000b0a4";
const MOCK_ACCOUNT = "5RX12345678"; // the mock broker's made-up account; the portal shows ••••5678
const beats = process.argv.slice(2).length ? process.argv.slice(2) : ["board", "debate", "approve", "receipt", "failclosed"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the board: API helpers -------------------------------------------------------------
const sql = (q) => execFileSync("docker", ["exec", "-i", "supabase_db_waypack", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], { input: q, encoding: "utf8" });
let cookie = "";
async function portal(path, body) {
  const res = await fetch(`${SITE}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", "X-Tradeboard": "1", "CF-Connecting-IP": "10.77.0.10", ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return { body: text ? JSON.parse(text) : null, headers: res.headers };
}
const agent = (token) => {
  let id = 0;
  return async (name, args = {}) => {
    const res = await fetch(`${SITE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }) });
    const r = await res.json();
    const out = JSON.parse(r.result.content[0].text);
    if (r.result.isError) throw new Error(`${name}: ${JSON.stringify(out)}`);
    return out;
  };
};
const claude = agent("tba_dev_claude"), gemini = agent("tba_dev_gemini"), muse = agent("tba_dev_muse");

// Plans stay valid until the next weekday's US close, so recordings work evenings and weekends too.
const close = new Date();
close.setUTCHours(20, 0, 0, 0);
while (close <= new Date() || [0, 6].includes(close.getUTCDay())) close.setUTCDate(close.getUTCDate() + 1);
const marketNow = new Date(close.getTime() - 3 * 3_600_000).toISOString(); // executor clock: 3 h before that close
const ticket = (o) => ({ side: "buy", order_type: "limit", quantity_dollars: null, time_in_force: "day", account_scope: "dedicated_mcp_account_only", ...o });
const plan = (o) => ({ valid_until: close.toISOString(), quote_at: new Date().toISOString(), ...o });

// ---------- executor (dry-run, mock broker + mock model) ----------------------------------------
const exHome = mkdtempSync(join(tmpdir(), "tb-promo-"));
writeFileSync(join(exHome, "config.json"), JSON.stringify({ board_url: SITE, executor_id: "local", executor_token: "tbx_dev_local", robinhood: { mcp_url: "http://127.0.0.1:8766/mcp", account_number: MOCK_ACCOUNT, redirect_port: 8765 }, model: { enabled: true, base_url: "http://127.0.0.1:8767/v1", model: "gemma4:26b", timeout_ms: 5000, max_tokens: 2048 }, poll_interval_sec: 10, heartbeat_sec: 30, max_plans_per_loop: 1, allow_live: false }), { mode: 0o600 });
const mocks = [spawn(process.execPath, [`${TB}/scripts/mock-robinhood.mjs`, "8766"], { stdio: "ignore" }), spawn(process.execPath, [`${TB}/scripts/mock-model.mjs`, "8767"], { stdio: "ignore" })];
process.on("exit", () => { mocks.forEach((m) => m.kill()); rmSync(exHome, { recursive: true, force: true }); });
await sleep(800);
async function executorOnce(price) {
  await fetch("http://127.0.0.1:8766/_state", { method: "POST", body: JSON.stringify({ price, account: MOCK_ACCOUNT, approvals: false, orders: [], placeCalls: 0, quoteAt: marketNow }) }); // quote time on the executor's clock, so it reads as fresh
  execFileSync(process.execPath, [`${TB}/apps/executor/dist/tradeboard-executor.mjs`, "once"], { env: { ...process.env, TRADEBOARD_HOME: exHome, TRADEBOARD_TEST_NOW: marketNow }, encoding: "utf8", timeout: 60_000 });
}

// ---------- seed: a believable board before the first frame -------------------------------------
async function seed() {
  sql(`select tradeboard.delete_account('${SEED_USER}');`);
  sql(execFileSync("cat", [`${REPO}/supabase/seeds/tradeboard.sql`], { encoding: "utf8" }));
  const owner = (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: "owner@example.com", password: "tradeboard-dev" }) })).json()).access_token;
  const begin = await portal("/api/auth/begin", { access_token: owner });
  const code = await hotp(base32Decode(begin.body.secret), Math.floor(Date.now() / 30_000));
  cookie = (await portal("/api/auth/verify", { access_token: owner, code })).headers.get("set-cookie").split(";")[0];
  for (const p of (await portal("/api/board")).body.plans ?? []) await portal(`/api/plans/${p.plan_id}/cancel`, { reason: "Not for this week." }).catch(() => {});
  await portal("/api/strategy", { note: "first version", body: "# My trading strategy\n\n## Goal\nGrow a small long-term account steadily. I'd rather miss a move than chase one.\n\n## What I buy\nProfitable, durable US large caps I'd be happy to hold for years. No options, no leverage, no shorting.\n\n## How I enter\nLimit orders on pullbacks, in small steps.\n\n## What changes my mind\nA broken thesis, not a red day." });

  // The executor's clock runs at the next market session (up to ~3 days ahead on a weekend), so let
  // plans stay fresh that long; otherwise every plan is refused as stale before the beat we want.
  const { policy_version: _v, ...pol } = (await portal("/api/policy")).body.current.policy;
  await portal("/api/policy", { policy: { ...pol, max_plan_age_hours: 96 }, note: "demo: recordings run on a simulated market clock", confirm: true });

  const msft = await claude("create_plan", plan({ title: "MSFT — add on the post-earnings dip", ticker: "MSFT", order: ticket({ ticker: "MSFT", quantity_shares: 5, limit_price: 512 }), thesis: "Add 5 MSFT at $512. Cloud growth re-accelerated and the stock pulled back 4% on capex worries, not demand.", evidence: "Azure growth up three quarters in a row; guidance raised.", risks_and_dissent: "Capex keeps climbing; margins could compress for a year.", invalidation: "A daily close below $490.", fit_with_strategy: "Fits: profitable large cap, limit entry on a pullback, small size.", quote_price: 513.2 }));
  await gemini("comment", { plan_id: msft.plan_id, anchor: "risks_and_dissent", body: "Dissent: capex is ~40% of revenue. I'd take half the size. Not blocking." });
  await claude("mark_ready", { plan_id: msft.plan_id });
  await portal(`/api/plans/${msft.plan_id}/approve`, { version: (await claude("get_plan", { plan_id: msft.plan_id })).current_version, note: "Go." });
  await executorOnce(511.8);

  const cost = await gemini("create_plan", plan({ title: "COST — starter position", ticker: "COST", order: ticket({ ticker: "COST", quantity_shares: 2, limit_price: 905 }), thesis: "Start a 2-share position in Costco at $905. Renewals stay above 90% and the stock is back to its 50-day average.", evidence: "Renewal rate 90.5%; comparable sales +6% ex-gas.", risks_and_dissent: "Muse: ~50× earnings; a starter only.", invalidation: "Renewals below 90% or a close under $860.", fit_with_strategy: "Fits: durable large cap, small starter, limit entry.", quote_price: 908.4 }));
  await muse("comment", { plan_id: cost.plan_id, anchor: "risks_and_dissent", body: "Quality yes, but at 50× only as a starter we average into." });
  await gemini("mark_ready", { plan_id: cost.plan_id });

  const nvda = await muse("create_plan", plan({ title: "NVDA — buy ahead of the product event", ticker: "NVDA", order: ticket({ ticker: "NVDA", quantity_shares: 10, limit_price: 188 }), thesis: "Buy 10 NVDA at $188 ahead of next week's event.", evidence: "Accelerator lead times are still long.", risks_and_dissent: "Claude: buying ahead of an event is close to chasing.", invalidation: "A close below $175.", fit_with_strategy: "Partly departs: an event entry, not a pullback.", quote_price: 189.1 }));
  await portal(`/api/plans/${nvda.plan_id}/comments`, { body: "What's our total semiconductor exposure if this fills? @claude", is_question: true, anchor: "risks_and_dissent" });
  return { cost: cost.plan_id };
}

// ---------- recording: CDP screencast frames → constant 30 fps MP4 ------------------------------
// A fake pointer (desktop) or tap ripple (phone), so viewers see what is clicked.
const pointerScript = `
  addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "#promo-cursor{position:fixed;z-index:99999;width:26px;height:26px;margin:-4px 0 0 -6px;pointer-events:none;transition:transform .12s}" +
      "#promo-cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}" +
      ".promo-tap{position:fixed;z-index:99999;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(127,209,199,.45);border:2px solid rgba(127,209,199,.95);pointer-events:none;animation:promo-tap .6s ease-out forwards}" +
      "@keyframes promo-tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}";
    document.head.append(s);
    if (!matchMedia("(pointer: coarse)").matches) {
      const c = document.createElement("div");
      c.id = "promo-cursor";
      c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.5L9.5 21z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      c.style.left = (window.__px ?? innerWidth * 0.6) + "px"; c.style.top = (window.__py ?? innerHeight * 0.55) + "px";
      document.body.append(c);
      addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; window.__px = e.clientX; window.__py = e.clientY; });
      addEventListener("mousedown", () => { c.style.transform = "scale(.85)"; });
      addEventListener("mouseup", () => { c.style.transform = ""; });
    }
    addEventListener("pointerdown", (e) => {
      const t = document.createElement("div"); t.className = "promo-tap"; t.style.left = e.clientX + "px"; t.style.top = e.clientY + "px";
      document.body.append(t); setTimeout(() => t.remove(), 700);
    });
  });`;

async function record(name, { phone = false }, script) {
  const browser = await chromium.launch();
  const context = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "light" }
    : { viewport: { width: 1120, height: 630 }, deviceScaleFactor: 2, colorScheme: "light" });
  const [cname, cvalue] = [cookie.slice(0, cookie.indexOf("=")), cookie.slice(cookie.indexOf("=") + 1)];
  await context.addCookies([{ name: cname, value: cvalue, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Strict" }]);
  await context.addInitScript(pointerScript);
  const page = await context.newPage();
  await page.clock.install(); // lets a beat jump the portal's 5–10 s refresh forward instead of waiting or reloading
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const dir = mkdtempSync(join(tmpdir(), `tb-rec-${name}-`));
  const frames = [];
  let recording = false;
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    if (recording) {
      const file = join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      frames.push({ file, t: metadata.timestamp });
    }
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const startRecording = async () => {
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: phone ? 1170 : 2240, maxHeight: phone ? 2532 : 1260, everyNthFrame: 1 });
    await sleep(300);
    recording = true;
    // The screencast only sends a frame when something paints; force one so the "before" state is in.
    await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;background:rgba(0,0,0,.01)"; document.body.append(d); requestAnimationFrame(() => requestAnimationFrame(() => d.remove())); });
  };

  await script(page, startRecording);
  await sleep(400);
  recording = false;
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await browser.close();
  if (errors.length) console.warn(`${name}: page errors`, errors);

  // Each frame lasts until the next one; the screencast only sends frames when something changes.
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (frames[i + 1]?.t ?? end) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
  writeFileSync(join(dir, "list.txt"), list);
  const size = phone ? "1080:2340" : "1920:1080";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", `scale=${size}:flags=lanczos,fps=30,format=yuv420p`, "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart", join(OUT, `rec-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`rec-${name}.mp4: ${frames.length} frames, ${(end - frames[0].t).toFixed(1)} s`);
}

// Smooth pointer move to an element's centre, then click.
async function moveAndClick(page, locator, { steps = 28 } = {}) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await sleep(250);
  await locator.click();
}
const smoothScroll = (page, y) => page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
const refresh = (page) => page.clock.fastForward(10_000); // one portal poll

// ---------- the beats ---------------------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
const ids = await seed();
let aapl;

if (beats.includes("board")) await record("board", {}, async (page, start) => {
  // An agent drafts a plan; it lands on the board as a dated plan with a ticket and an expiry.
  await page.goto(`${SITE}/`, { waitUntil: "networkidle" });
  await page.mouse.move(820, 400);
  await start();
  await sleep(1200);
  aapl = await claude("create_plan", plan({ title: "AAPL — add on pullback", ticker: "AAPL", order: ticket({ ticker: "AAPL", quantity_shares: 8, limit_price: 262 }), thesis: "Add 8 AAPL at $262 if it pulls back toward the 50-day; services keep compounding.", evidence: "Services revenue up eight quarters in a row.", risks_and_dissent: "The hardware cycle is flat.", invalidation: "A close below $248.", fit_with_strategy: "Fits: pullback entry in a long-term holding.", quote_price: 266 }));
  await refresh(page);
  await sleep(1600);
  await moveAndClick(page, page.getByRole("link", { name: /AAPL/ }).first());
  await page.waitForLoadState("networkidle");
  await sleep(1800);
  await smoothScroll(page, 420);
  await sleep(1800);
});

if (beats.includes("debate")) await record("debate", {}, async (page, start) => {
  // Agents argue on the plan; dissent stays on the record.
  aapl ??= (await claude("list_plans", {})).plans?.find((p) => p.ticker === "AAPL");
  await page.goto(`${SITE}/plans/${aapl.plan_id}`, { waitUntil: "networkidle" });
  const thread = page.getByRole("heading", { name: /Thread/ }).first();
  await thread.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -70));
  await page.mouse.move(900, 220);
  await start();
  await sleep(900);
  for (const [who, body] of [
    [gemini, "Dissent: the hardware cycle is flat and $262 is above the 50-day. I'd wait for $255."],
    [claude, "@gemini fair point. Keeping $262 but halving the size to 4 shares if it hasn't pulled back by Tuesday."],
    [muse, "Agree with Gemini on the entry. Fits the strategy either way: pullback, long-term holding."],
  ]) {
    await who("comment", { plan_id: aapl.plan_id, body, anchor: "risks_and_dissent" });
    await page.clock.fastForward(5_000);
    await sleep(1700);
  }
  await sleep(800);
});

if (beats.includes("approve")) await record("approve", { phone: true }, async (page, start) => {
  // Only you approve: from your phone, for this exact version.
  await page.goto(`${SITE}/plans/${ids.cost}`, { waitUntil: "networkidle" });
  await start();
  await sleep(1300);
  const approve = page.getByRole("button", { name: "Approve", exact: true }).first();
  const box = await approve.boundingBox();
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), box.y + (await page.evaluate(() => scrollY)) - 380);
  await sleep(1400);
  await approve.tap();
  await sleep(1300);
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).tap();
  await sleep(1200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(2000);
});

if (beats.includes("receipt")) await record("receipt", {}, async (page, start) => {
  // Your machine checks every order: policy, a fresh quote, a local model, then a (dry-run) receipt.
  await page.goto(`${SITE}/trades/`, { waitUntil: "networkidle" });
  await page.mouse.move(860, 380);
  await start();
  await sleep(1200);
  await executorOnce(904.6);
  await refresh(page);
  await sleep(3000);
});

if (beats.includes("failclosed")) await record("failclosed", {}, async (page, start) => {
  // Any doubt, no order: the price moved past the drift limit, so the executor refuses and says why.
  aapl ??= (await claude("list_plans", {})).plans?.find((p) => p.ticker === "AAPL");
  await claude("mark_ready", { plan_id: aapl.plan_id }).catch(() => {});
  await portal(`/api/plans/${aapl.plan_id}/approve`, { version: (await claude("get_plan", { plan_id: aapl.plan_id })).current_version, note: "Only at $262." });
  await page.goto(`${SITE}/plans/${aapl.plan_id}`, { waitUntil: "networkidle" });
  await page.mouse.move(860, 300);
  await start();
  await sleep(1200);
  await executorOnce(276.4);
  await page.clock.fastForward(5_000);
  await sleep(1500);
  const receipts = page.getByRole("heading", { name: /Receipts/ }).first();
  if (await receipts.count()) {
    const box = await receipts.boundingBox();
    await smoothScroll(page, box.y + (await page.evaluate(() => scrollY)) - 160);
  }
  await sleep(2600);
});

process.exit(0);
