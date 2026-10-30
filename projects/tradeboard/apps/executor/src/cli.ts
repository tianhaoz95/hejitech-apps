#!/usr/bin/env node
// tradeboard-executor: the Trading Plan Board's local executor.
//
//   tradeboard-executor setup     write ~/.tradeboard/config.json (board URL, credential, account, model)
//   tradeboard-executor auth      sign in to the Robinhood MCP (loopback OAuth; headless: paste the callback URL)
//   tradeboard-executor check     config, board, Robinhood, account and model, without claiming anything
//   tradeboard-executor model-check   run the sanity check on a matching and a mismatched fixture
//   tradeboard-executor run       the daemon: heartbeat every 30 s, poll every 10–30 s
//   tradeboard-executor once      one loop iteration, then exit
//   touch ~/.tradeboard/KILL      stop claiming (same as Kill in the portal); rm it to allow again
import { createInterface } from "node:readline/promises";
import { DEFAULT_POLICY, type OrderTicket } from "@tradeboard/core";
import { boardClient } from "./board.ts";
import { checkConfig, DEFAULTS, ensureHome, home, killFilePresent, loadConfig, paths, readJson, redact, writeSecret, type Config } from "./config.ts";
import { Engine, EXECUTOR_VERSION } from "./engine.ts";
import { openAiChecker } from "./model.ts";
import { interactiveSignIn, robinhood, SignInNeeded } from "./robinhood.ts";

const HELP = `tradeboard-executor ${EXECUTOR_VERSION}: the Trading Plan Board's local executor.

  setup         write ~/.tradeboard/config.json (board URL, credential, account, model)
  auth          sign in to the Robinhood MCP (loopback OAuth; headless: paste the callback URL)
  check         config, board, Robinhood, account and model, without claiming anything
  model-check   run the sanity check on a matching and a mismatched fixture
  run           the daemon: heartbeat every 30 s, poll every 10–30 s
  once          one loop iteration, then exit

  touch ~/.tradeboard/KILL stops claiming (same as Kill in the portal); remove it to allow again.
  TRADEBOARD_HOME moves the folder.`;

const log = (s: string) => console.log(`${new Date().toISOString()} ${s}`);
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function ask(q: string, fallback = ""): Promise<string> {
  if (!process.stdin.isTTY) return fallback;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${q}${fallback ? ` [${fallback}]` : ""}: `)).trim();
  rl.close();
  return a || fallback;
}

async function setup() {
  ensureHome();
  const prev = readJson<Partial<Config>>(paths().config) ?? {};
  const c: Config = {
    ...DEFAULTS, ...prev,
    board_url: flag("board-url") ?? (await ask("Board URL", prev.board_url ?? "https://tradeboard.hejitech.workers.dev")),
    executor_id: flag("executor-id") ?? (await ask("Executor id (as issued in the portal)", prev.executor_id ?? "spark")),
    executor_token: flag("token") ?? process.env.TRADEBOARD_EXECUTOR_TOKEN ?? (await ask("Executor credential (tbx_…, from the portal's Executor page)", prev.executor_token ?? "")),
    robinhood: { ...DEFAULTS.robinhood, ...prev.robinhood, account_number: flag("account") ?? (await ask("Dedicated Robinhood account number (the agentic account; stays on this machine)", prev.robinhood?.account_number ?? "")) },
    model: { ...DEFAULTS.model, ...prev.model, base_url: flag("model-url") ?? (await ask("Model endpoint (OpenAI-compatible)", prev.model?.base_url ?? DEFAULTS.model.base_url)), model: flag("model") ?? (await ask("Model name", prev.model?.model ?? DEFAULTS.model.model)) },
    allow_live: prev.allow_live ?? false,
  } as Config;
  if (args.includes("--no-model")) c.model.enabled = false;
  const issues = checkConfig(c);
  if (!c.robinhood.account_number) issues.push("the dedicated account number is required");
  writeSecret(paths().config, JSON.stringify(c, null, 2));
  console.log(`Wrote ${paths().config} (mode 600). Live stays off until you set "allow_live": true there AND pass the portal's live-mode checklist.`);
  if (issues.length) console.log(`Still to fix:\n  ${issues.join("\n  ")}`);
}

function build(c: Config) {
  const board = boardClient(c.board_url, c.executor_token);
  const rh = robinhood(c);
  const model = c.model.enabled ? openAiChecker(c.model) : null;
  // Tests pin the clock (to run inside market hours); honoured only against a local board.
  const testNow = process.env.TRADEBOARD_TEST_NOW && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(c.board_url) ? new Date(process.env.TRADEBOARD_TEST_NOW) : null;
  const engine = new Engine({
    ...(testNow ? { now: () => testNow } : {}),
    executorId: c.executor_id, accountNumber: c.robinhood.account_number, allowLive: c.allow_live, maxPlansPerLoop: c.max_plans_per_loop,
    board, broker: () => (rh.connected() ? rh : null), model, killFile: killFilePresent, journalPath: paths().journal,
    log: (s) => log(redact(s, c)), savePolicy: (p) => writeSecret(paths().policy, JSON.stringify(p, null, 2)),
  });
  // A cached policy lets a restarted executor report its version before the first poll; it never overrides the board's.
  const cached = readJson<{ policy_version: number; policy: typeof DEFAULT_POLICY }>(paths().policy);
  if (cached) engine.policy = cached;
  return { board, rh, engine };
}

async function connectRobinhood(rh: ReturnType<typeof robinhood>, engine: Engine) {
  try {
    await rh.connect();
    if (engine.lastError?.includes("Robinhood")) engine.lastError = null;
  } catch (e) {
    engine.lastError = e instanceof SignInNeeded ? e.message : `Robinhood unreachable: ${(e as Error).message}`;
  }
}

async function run(once: boolean) {
  const c = loadConfig();
  const { rh, engine } = build(c);
  log(`tradeboard-executor ${EXECUTOR_VERSION} as ${c.executor_id} → ${c.board_url} (home ${home()}, live ${c.allow_live ? "allowed locally" : "off locally"})`);
  await connectRobinhood(rh, engine);
  await engine.heartbeat();
  if (once) {
    const out = await engine.iterate();
    for (const o of out) log(`${o.plan_id.slice(0, 8)} ${o.result}: ${o.detail}`);
    await engine.heartbeat();
    await rh.close();
    return;
  }
  let stopping = false;
  const stop = () => { stopping = true; log("stopping after this step"); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const hb = setInterval(async () => {
    if (!rh.connected()) await connectRobinhood(rh, engine);
    await engine.heartbeat();
  }, c.heartbeat_sec * 1000);
  while (!stopping) {
    try {
      const out = await engine.iterate();
      for (const o of out) if (o.result !== "skipped") log(`${o.plan_id.slice(0, 8)} ${o.result}: ${o.detail}`);
    } catch (e) {
      engine.lastError = redact(`loop error: ${(e as Error).message}`, c);
      log(engine.lastError);
    }
    for (let i = 0; i < c.poll_interval_sec && !stopping; i++) await new Promise((r) => setTimeout(r, 1000));
  }
  clearInterval(hb);
  await engine.heartbeat();
  await rh.close();
}

async function check() {
  const c = loadConfig();
  const { rh, engine } = build(c);
  const line = (ok: boolean, s: string) => console.log(`${ok ? "ok  " : "FAIL"} ${s}`);
  line(true, `config ${paths().config}`);
  try {
    const p = await boardClient(c.board_url, c.executor_token).poll();
    line(true, `board: policy v${p.policy.policy_version}, dry-run ${p.control.dry_run ? "on" : "off"}, ${p.plans.length} approved plan(s)`);
  } catch (e) {
    line(false, `board: ${(e as Error).message}`);
  }
  await connectRobinhood(rh, engine);
  line(rh.connected(), rh.connected() ? "Robinhood MCP connected" : `Robinhood: ${engine.lastError}`);
  if (rh.connected()) {
    await engine.refreshAccount(true);
    line(!!engine.accountMatches, engine.accountMatches ? `account ${engine.accountMask} is the agentic account` : "configured account isn't Robinhood's agentic account");
    line(true, `trade approvals: ${engine.tradeApprovals}`);
    try {
      const q = await rh.quote("SPY");
      line(true, `quote SPY $${q.price} at ${q.at}`);
    } catch (e) {
      line(false, `quote: ${(e as Error).message}`);
    }
  }
  if (c.model.enabled) await modelCheck(c);
  else line(true, "model check disabled (dry-run only unless the policy allows live without it)");
  line(!killFilePresent(), killFilePresent() ? `KILL file present (${paths().kill})` : "no KILL file");
  await rh.close();
}

/** Two fixtures: a consistent plan must pass, a plan whose thesis is about another ticker must fail (§12.1 test 8). */
async function modelCheck(c = loadConfig()) {
  const m = openAiChecker(c.model);
  const ticket: OrderTicket = { ticker: "AAPL", side: "buy", order_type: "limit", quantity_shares: 10, quantity_dollars: null, limit_price: 285, stop_price: null, time_in_force: "day", account_scope: "dedicated_mcp_account_only" };
  const base = { title: "AAPL — add on pullback", ticker: "AAPL", evidence: "Services revenue grew double digits for 8 quarters.", risks_and_dissent: "Regulatory risk on the App Store.", invalidation: "Close below $270.", order: ticket, quote_price: 286, live_price: 285.4, policy: DEFAULT_POLICY };
  for (const [name, thesis, want] of [
    ["matching plan", "Add 10 shares of AAPL with a limit at $285 on the pullback: services growth and buybacks support the price.", "pass"],
    ["mismatched plan", "Buy 10 shares of MSFT at $285: Azure growth is accelerating and Microsoft is the better AI play.", "fail"],
  ] as const) {
    const t0 = Date.now();
    const v = await m.check({ ...base, thesis });
    console.log(`${v.verdict === want ? "ok  " : "FAIL"} model ${c.model.model}, ${name}: ${v.verdict} in ${((Date.now() - t0) / 1000).toFixed(1)} s (${v.reasons.join("; ").slice(0, 160)})`);
  }
}

const cmd = args[0];
const main = { setup, auth: async () => interactiveSignIn(loadConfig(), console.log), check, "model-check": () => modelCheck(), run: () => run(false), once: () => run(true) } as Record<string, () => Promise<void>>;
if (cmd === "version" || cmd === "--version") console.log(EXECUTOR_VERSION);
else if (!cmd || !main[cmd]) {
  console.log(HELP);
  process.exitCode = cmd ? 2 : 0;
} else {
  main[cmd]().catch((e) => {
    console.error(`error: ${redact((e as Error).message)}`);
    process.exitCode = 1;
  });
}
