#!/usr/bin/env node
// Publishes a review site (reports/<slug>/site/) to Folio as one private artifact, and reads back
// the comments people leave on it there. Talks to Folio's MCP endpoint with a personal `fol_` token.
//
//   node .claude/skills/heji-candidate-review/publish_folio.mjs reports/<slug>            # create or update
//   node .claude/skills/heji-candidate-review/publish_folio.mjs reports/<slug> comments   # print Folio comments
//
// Token: $FOLIO_TOKEN, else FOLIO_TOKEN=… in ~/Credentials/folio/agent-token.env (Folio → Settings →
// Agent tokens). Server: $FOLIO_URL (default https://folio.hejitech.workers.dev; the local stack is
// http://127.0.0.1:8801 with fol_dev_local_token). The artifact's slug is kept in
// reports/<slug>/folio.json, so later runs update the same artifact instead of making a new one.
// Always private: never pass visibility "link" from here; sharing is the owner's call.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

const [dirArg, mode = "publish"] = process.argv.slice(2);
if (!dirArg || !["publish", "comments"].includes(mode)) {
  console.error("usage: publish_folio.mjs reports/<slug> [publish|comments]");
  process.exit(2);
}
const reportDir = resolve(dirArg);
const siteDir = join(reportDir, "site");
const statePath = join(reportDir, "folio.json");
if (!existsSync(join(siteDir, "index.html"))) fail(`no ${relative(process.cwd(), siteDir)}/index.html`);

const BASE = (process.env.FOLIO_URL || "https://folio.hejitech.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.FOLIO_TOKEN || tokenFromFile();
if (!TOKEN) fail("no Folio token: set FOLIO_TOKEN or put FOLIO_TOKEN=fol_… in ~/Credentials/folio/agent-token.env (Folio → Settings → Agent tokens)");

const TEXT = new Set(["html", "htm", "css", "js", "mjs", "json", "md", "txt", "csv", "tsv", "svg", "xml", "yaml", "yml"]);
const SKIP = new Set([".DS_Store"]);
const MAX_OPS = 100;

let session = null;
let rpcId = 0;

async function rpc(method, params) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${TOKEN}`,
      ...(session ? { "mcp-session-id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (res.status === 401) fail("Folio refused the token (401): make a new one in Folio → Settings");
  const sid = res.headers.get("mcp-session-id");
  if (sid) session = sid;
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text.startsWith("event:") || text.startsWith("data:") ? text.split("\n").find((l) => l.startsWith("data:")).slice(5) : text);
  } catch {
    fail(`Folio ${method}: HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (body.error) fail(`Folio ${method}: ${body.error.message}`);
  return body.result;
}

async function tool(name, args) {
  const r = await rpc("tools/call", { name, arguments: { agent: "heji-candidate-review", ...args } });
  if (r.isError) {
    const e = new Error(r.content?.[0]?.text || `${name} failed`);
    e.structured = r.structuredContent;
    throw e;
  }
  return r.structuredContent;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function localFiles() {
  return walk(siteDir).map((abs) => {
    const path = relative(siteDir, abs).split("\\").join("/");
    const bytes = readFileSync(abs);
    const ext = path.split(".").pop().toLowerCase();
    const file = TEXT.has(ext) ? { path, content: bytes.toString("utf8") } : { path, base64: bytes.toString("base64") };
    return { file, hash: createHash("sha256").update(bytes).digest("hex") };
  });
}

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function title() {
  const html = readFileSync(join(siteDir, "index.html"), "utf8");
  const t = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  return (t || relative(join(reportDir, ".."), reportDir)).slice(0, 140);
}

async function publish() {
  const files = localFiles();
  const state = readState();
  const dirName = relative(process.cwd(), reportDir);

  if (!state?.slug) {
    const r = await tool("create_artifact", {
      title: title(),
      description: `Candidate review site from ${dirName} (heji-candidate-review). Comment on a candidate to leave feedback.`,
      files: files.map((f) => f.file),
      message: "Published from the repo",
      visibility: "private",
    });
    writeFileSync(statePath, JSON.stringify({ slug: r.artifact.slug, url: r.artifact.url, server: BASE }, null, 2) + "\n");
    console.log(`created ${r.artifact.url} (version ${r.version}, ${files.length} files); slug saved in ${relative(process.cwd(), statePath)}`);
    return;
  }

  const head = await tool("get_artifact", { artifact: state.slug, include_content: false });
  let base = head.artifact.head_version;
  const remote = new Map(head.files.map((f) => [f.path, f.hash]));
  const local = new Set(files.map((f) => f.file.path));
  const ops = [
    ...files.filter((f) => remote.get(f.file.path) !== f.hash).map((f) => ({ op: "write", ...f.file })),
    ...[...remote.keys()].filter((p) => !local.has(p)).map((path) => ({ op: "delete", path })),
  ];
  if (!ops.length) {
    console.log(`${head.artifact.url} is already up to date (version ${base})`);
    return;
  }
  for (let i = 0; i < ops.length; i += MAX_OPS) {
    const r = await tool("edit_artifact", {
      artifact: state.slug,
      base_version: base,
      ops: ops.slice(i, i + MAX_OPS),
      message: `Updated from the repo (${ops.length} file${ops.length === 1 ? "" : "s"} changed)`,
    });
    base = r.version ?? r.head_version ?? base + 1;
  }
  console.log(`updated ${head.artifact.url} → version ${base} (${ops.length} file change${ops.length === 1 ? "" : "s"})`);
}

async function comments() {
  const state = readState();
  if (!state?.slug) fail(`${relative(process.cwd(), statePath)} not found: publish first`);
  const r = await tool("list_comments", { artifact: state.slug });
  console.log(JSON.stringify(r, null, 2));
}

function tokenFromFile() {
  try {
    const env = readFileSync(join(homedir(), "Credentials/folio/agent-token.env"), "utf8");
    return env.match(/^FOLIO_TOKEN=(.+)$/m)?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "heji-candidate-review", version: "1" } });
await (mode === "comments" ? comments() : publish());
