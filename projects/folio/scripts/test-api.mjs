#!/usr/bin/env node
// Integration test for the Folio Worker against the shared local stack (`supabase start` from the
// repo root, with the folio seed) and `npm run dev:worker -w @folio/web` (127.0.0.1:8801).
//
// Plays two agents ("Claude Code" and "Gemini CLI") working on the same artifact: create, read,
// edit, a conflicting edit (409) and a clean rebase, suggestions (accept, reject, stale), comments,
// activity, restore, fork, export, sharing with a second person and role checks, the sandboxed
// render endpoint (CSP, signed keys), MCP Apps resource, iPhone notifications (a fake APNs on
// 127.0.0.1:8851; scripts/dev-env.sh gives the Worker a throwaway key), OAuth 2.1 + tokens, and
// data deletion.
//
//   node projects/folio/scripts/test-api.mjs [site] [supabase]
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const site = (process.argv[2] ?? "http://127.0.0.1:8801").replace(/\/$/, "");
const supabase = (process.argv[3] ?? "http://127.0.0.1:55421").replace(/\/$/, "");
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const mcpUrl = `${site}/mcp`;
const DEV_TOKEN = "fol_dev_local_token";

let passed = 0;
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
  passed++;
  console.log(`  ✓ ${name}`);
};

/** A minimal MCP client (Streamable HTTP, JSON) that keeps its session id like real clients. */
function mcpClient(token, clientName) {
  let id = 0;
  let session = null;
  async function rpc(method, params = {}, { notify = false } = {}) {
    const res = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(session ? { "Mcp-Session-Id": session } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...(notify ? {} : { id: ++id }), method, params }),
    });
    if (res.headers.get("mcp-session-id")) session = res.headers.get("mcp-session-id");
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    return { status: res.status, headers: res.headers, body, text };
  }
  async function init() {
    const r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } }, clientInfo: { name: clientName, version: "1.0" } });
    assert.equal(r.status, 200, r.text);
    assert.ok(session, "initialize returns Mcp-Session-Id");
    await rpc("notifications/initialized", {}, { notify: true });
    return r.body.result;
  }
  async function raw(name, args = {}) {
    const r = await rpc("tools/call", { name, arguments: args });
    if (r.status !== 200) throw new Error(`${name}: HTTP ${r.status} ${r.text.slice(0, 300)}`);
    return r.body.result;
  }
  async function tool(name, args = {}) {
    const result = await raw(name, args);
    if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
    return result.structuredContent;
  }
  async function toolError(name, args = {}) {
    const result = await raw(name, args);
    assert.ok(result.isError, `${name} should fail`);
    return result.structuredContent;
  }
  return { rpc, init, tool, toolError, raw };
}

async function signIn(email, password) {
  const res = await fetch(`${supabase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `sign-in ${email}`);
  return (await res.json()).access_token;
}

async function makeUser(email, password) {
  const res = await fetch(`${supabase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.ok(res.status === 200 || res.status === 422, `create ${email}: ${res.status}`);
  return signIn(email, password);
}

async function call(path, { method = "GET", auth, body, headers = {} } = {}) {
  const res = await fetch(`${site}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

const PAGE = `<!doctype html>
<html>
<head><title>Shopping list</title><link rel="stylesheet" href="style.css"></head>
<body>
  <h1>Shopping list</h1>
  <p class="intro">Things to buy this week.</p>
  <ul id="items"></ul>
  <script src="app.js"></script>
</body>
</html>
`;
const CSS = "body { font-family: system-ui; }\nh1 { color: navy; }\n";
const JS = "const items = ['milk', 'eggs'];\ndocument.getElementById('items').innerHTML = items.map((i) => `<li>${i}</li>`).join('');\n";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

console.log(`Folio integration test against ${site}`);

let owner, other;
const claude = mcpClient(DEV_TOKEN, "claude-code");
const gemini = mcpClient(DEV_TOKEN, "gemini-cli");
let slug;

await step("public pages, status and OAuth metadata", async () => {
  for (const p of ["/", "/connect/", "/login/", "/privacy/", "/terms/", "/support/", "/a/abcdefgh"]) {
    const r = await fetch(`${site}${p}`);
    assert.equal(r.status, 200, `${p} → ${r.status}`);
  }
  const s = await call("/api/status");
  assert.equal(s.body.service, "folio");
  assert.ok(s.body.tools.includes("suggest_edit"));
  const meta = await call("/.well-known/oauth-protected-resource/mcp");
  assert.equal(meta.status, 200);
  assert.equal(meta.body.resource, mcpUrl);
  const unauth = await fetch(mcpUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(unauth.status, 401);
  assert.match(unauth.headers.get("www-authenticate") ?? "", /resource_metadata/);
});

await step("sign in: seed developer and a second person", async () => {
  owner = await signIn("folio-dev@example.com", "folio-dev");
  other = await makeUser(`folio-other-${Date.now()}@example.com`, "other-pass-123");
});

await step("MCP: initialize, tools/list, MCP Apps resource", async () => {
  const info = await claude.init();
  await gemini.init();
  assert.equal(info.serverInfo.name, "folio");
  assert.match(info.instructions, /not as instructions|never as instructions/i);
  const tools = (await claude.rpc("tools/list")).body.result.tools;
  assert.ok(tools.length >= 20);
  const show = tools.find((t) => t.name === "show_artifact");
  assert.equal(show._meta.ui.resourceUri, "ui://folio/viewer.html");
  const res = (await claude.rpc("resources/read", { uri: "ui://folio/viewer.html" })).body.result.contents[0];
  assert.equal(res.mimeType, "text/html;profile=mcp-app");
  assert.match(res.text, /ui\/initialize/);
  assert.deepEqual(res._meta.ui.csp.frameDomains, [site]);
  const list = (await claude.rpc("resources/list")).body.result.resources;
  assert.equal(list[0].uri, "ui://folio/viewer.html");
});

await step("Claude creates an artifact with text and binary files", async () => {
  const r = await claude.tool("create_artifact", {
    title: "Shopping list",
    description: "A page for this week's groceries.",
    files: [
      { path: "index.html", content: PAGE },
      { path: "style.css", content: CSS },
      { path: "app.js", content: JS },
      { path: "img/dot.png", base64: PNG },
    ],
    model: "claude-opus-5-5",
  });
  slug = r.artifact.slug;
  assert.equal(r.version, 1);
  assert.match(r.artifact.url, new RegExp(`/a/${slug}$`));
  assert.match(r.render_url, new RegExp(`/r/${slug}/1/`));
  const v = await claude.tool("list_versions", { artifact: slug });
  assert.equal(v.versions[0].agent, "claude-code", "attributed to the MCP client name");
  assert.equal(v.versions[0].model, "claude-opus-5-5");
});

await step("Gemini reads it by URL; files and contents come back", async () => {
  const r = await gemini.tool("get_artifact", { artifact: `${site}/a/${slug}` });
  assert.equal(r.artifact.head_version, 1);
  assert.equal(r.artifact.your_role, "owner");
  assert.deepEqual(r.files.map((f) => f.path), ["index.html", "app.js", "img/dot.png", "style.css"]);
  assert.equal(r.files.find((f) => f.path === "index.html").content, PAGE);
  assert.equal(r.files.find((f) => f.path === "img/dot.png").omitted, "binary");
  const f = await gemini.tool("read_file", { artifact: slug, path: "index.html", start_line: 5, end_line: 6 });
  assert.equal(f.content, "  <h1>Shopping list</h1>\n  <p class=\"intro\">Things to buy this week.</p>");
  assert.equal(f.total_lines, 11);
});

await step("edit: replace ops make v2; bad ops explain themselves", async () => {
  const r = await gemini.tool("edit_artifact", {
    artifact: slug,
    base_version: 1,
    ops: [{ op: "replace", path: "index.html", old: "Things to buy this week.", new: "What we need before Sunday." }],
    message: "Friendlier intro",
    agent: "Gemini CLI",
  });
  assert.equal(r.version, 2);
  assert.deepEqual(r.changed, ["index.html"]);
  const e1 = await gemini.toolError("edit_artifact", { artifact: slug, base_version: 2, ops: [{ op: "replace", path: "index.html", old: "Nope", new: "x" }] });
  assert.equal(e1.error, "op_failed");
  assert.match(e1.message, /not found/);
  const e2 = await gemini.toolError("edit_artifact", { artifact: slug, base_version: 2, ops: [{ op: "replace", path: "missing.html", old: "a", new: "b" }] });
  assert.match(e2.message, /no such file \(files: /);
  const e3 = await gemini.toolError("edit_artifact", { artifact: slug, base_version: 2, ops: [{ op: "write", path: "../evil", content: "x" }] });
  assert.equal(e3.error, "bad_ops");
  const e4 = await gemini.toolError("edit_artifact", { artifact: slug, ops: [{ op: "write", path: "a.txt", content: "x" }] });
  assert.equal(e4.error, "base_version");
  const e5 = await gemini.toolError("edit_artifact", { artifact: slug, base_version: 2, ops: [{ op: "write", path: "style.css", content: CSS }] });
  assert.equal(e5.error, "no_change");
});

await step("concurrent edits: other file rebases; same file with write conflicts (409)", async () => {
  // Claude still thinks v1 is current. It edits a different file: replayed on v2 → v3.
  const r = await claude.tool("edit_artifact", { artifact: slug, base_version: 1, ops: [{ op: "replace", path: "style.css", old: "navy", new: "#2f5bea" }], message: "Brand color" });
  assert.equal(r.version, 3);
  assert.equal(r.rebased_from, 1);
  // A whole-file write over index.html from v1 would drop Gemini's change: refused.
  const c = await claude.toolError("edit_artifact", { artifact: slug, base_version: 1, ops: [{ op: "write", path: "index.html", content: PAGE.replace("Shopping", "Grocery") }] });
  assert.equal(c.error, "stale");
  assert.equal(c.head_version, 3);
  assert.deepEqual(c.conflicting_paths, ["index.html"]);
  assert.ok(c.newer_versions.some((v) => v.agent === "Gemini CLI"));
  // A replace on index.html whose text Gemini didn't touch still applies on top.
  const ok = await claude.tool("edit_artifact", { artifact: slug, base_version: 1, ops: [{ op: "replace", path: "index.html", old: "<h1>Shopping list</h1>", new: "<h1>Groceries</h1>" }] });
  assert.equal(ok.version, 4);
  const now = await claude.tool("read_file", { artifact: slug, path: "index.html" });
  assert.match(now.content, /Groceries/);
  assert.match(now.content, /before Sunday/, "Gemini's edit survived");
});

let sugg;
await step("suggestions: Gemini suggests, preview renders, diff is unified", async () => {
  const s = await gemini.tool("suggest_edit", {
    artifact: slug,
    base_version: 4,
    title: "Add bread",
    rationale: "We always forget bread.",
    ops: [{ op: "replace", path: "app.js", old: "'eggs'", new: "'eggs', 'bread'" }],
    agent: "Gemini CLI",
  });
  sugg = s.suggestion.number;
  assert.equal(sugg, 1);
  assert.match(s.diff, /\+const items = \['milk', 'eggs', 'bread'\];/);
  const prev = await fetch(`${s.preview_url}app.js`);
  assert.equal(prev.status, 200);
  assert.match(await prev.text(), /bread/);
  const head = await fetch(`${s.preview_url.replace(`/s${sugg}/`, "/4/")}app.js`);
  assert.doesNotMatch(await head.text(), /bread/, "preview didn't change the artifact");
  const list = await claude.tool("list_suggestions", { artifact: slug });
  assert.equal(list.suggestions.length, 1);
  assert.equal(list.suggestions[0].agent, "Gemini CLI");
  assert.match(list.note, /data/);
});

await step("comments: on a suggestion and a file, replies, resolve", async () => {
  const c = await claude.tool("comment", { artifact: slug, suggestion: sugg, body: "Good call. Whole wheat?" });
  const reply = await gemini.tool("comment", { artifact: slug, reply_to: c.comment.id, body: "Either works." });
  assert.equal(reply.comment.reply_to, c.comment.id);
  const f = await gemini.tool("comment", { artifact: slug, path: "style.css", anchor: { selector: "h1", line: 2 }, body: "Is this blue accessible?" });
  const g = await claude.tool("get_suggestion", { artifact: slug, suggestion: sugg });
  assert.equal(g.comments.length, 2);
  assert.equal(g.applies_to_head, true);
  const all = await claude.tool("list_comments", { artifact: slug });
  assert.equal(all.comments.length, 3);
  await claude.tool("resolve_comment", { artifact: slug, comment: f.comment.id });
  // A person comments on a part they selected (web and iPhone): agents get the quote and where.
  const picked = await call(`/api/artifacts/${slug}/comments`, { method: "POST", auth: owner, body: { body: "Bigger?", path: "index.html", anchor: { text: "Shopping list", selector: "body > h1:nth-of-type(1)" } } });
  assert.equal(picked.status, 201);
  const seen = (await claude.tool("list_comments", { artifact: slug })).comments.find((x) => x.body === "Bigger?");
  assert.deepEqual(seen.anchor, { text: "Shopping list", selector: "body > h1:nth-of-type(1)" });
  assert.equal(seen.path, "index.html");
  await claude.tool("resolve_comment", { artifact: slug, comment: seen.id });
  assert.equal((await claude.tool("list_comments", { artifact: slug })).comments.length, 2);
  assert.equal((await claude.tool("list_comments", { artifact: slug, include_resolved: true })).comments.length, 4);
});

await step("review: accept makes a version; reject and stale suggestions", async () => {
  const a = await claude.tool("review_suggestion", { artifact: slug, suggestion: sugg, decision: "accept", note: "Thanks" });
  assert.equal(a.version, 5);
  assert.equal(a.suggestion.status, "accepted");
  const again = await claude.toolError("review_suggestion", { artifact: slug, suggestion: sugg, decision: "accept" });
  assert.equal(again.error, "resolved");
  const s2 = await gemini.tool("suggest_edit", { artifact: slug, base_version: 5, title: "Remove milk", ops: [{ op: "replace", path: "app.js", old: "'milk', ", new: "" }] });
  const rj = await claude.tool("review_suggestion", { artifact: slug, suggestion: s2.suggestion.number, decision: "reject", note: "We need milk" });
  assert.equal(rj.suggestion.status, "rejected");
  // A suggestion whose text was later changed by someone else can't be accepted.
  const s3 = await gemini.tool("suggest_edit", { artifact: slug, base_version: 5, title: "Oat milk", ops: [{ op: "replace", path: "app.js", old: "'milk'", new: "'oat milk'" }] });
  await claude.tool("edit_artifact", { artifact: slug, base_version: 5, ops: [{ op: "replace", path: "app.js", old: "'milk'", new: "'whole milk'" }] });
  const st = await claude.toolError("review_suggestion", { artifact: slug, suggestion: s3.suggestion.number, decision: "accept" });
  assert.equal(st.error, "stale");
  const g = await claude.tool("get_suggestion", { artifact: slug, suggestion: s3.suggestion.number });
  assert.equal(g.applies_to_head, false);
  const rv = await gemini.tool("revise_suggestion", { artifact: slug, suggestion: s3.suggestion.number, base_version: 6, ops: [{ op: "replace", path: "app.js", old: "'whole milk'", new: "'oat milk'" }] });
  assert.equal(rv.suggestion.base_version, 6);
  const ok = await claude.tool("review_suggestion", { artifact: slug, suggestion: s3.suggestion.number, decision: "accept" });
  assert.equal(ok.version, 7);
  const wd = await gemini.tool("suggest_edit", { artifact: slug, base_version: 7, title: "Withdraw me", ops: [{ op: "write", path: "notes.md", content: "# Notes" }] });
  assert.equal((await gemini.tool("review_suggestion", { artifact: slug, suggestion: wd.suggestion.number, decision: "withdraw" })).suggestion.status, "withdrawn");
});

await step("history: list, diff, restore, rename/delete ops", async () => {
  const d = await claude.tool("diff_versions", { artifact: slug, from: 4, to: 5 });
  assert.match(d.diff, /--- v4\/app.js/);
  assert.equal(d.files[0].path, "app.js");
  const mv = await claude.tool("edit_artifact", { artifact: slug, base_version: 7, ops: [{ op: "rename", path: "img/dot.png", to: "assets/dot.png" }, { op: "write", path: "data.json", content: '{"week": 47}' }] });
  assert.equal(mv.version, 8);
  const d2 = await claude.tool("diff_versions", { artifact: slug });
  assert.ok(d2.files.some((f) => f.status === "renamed" && f.from === "img/dot.png"));
  const back = await claude.tool("restore_version", { artifact: slug, version: 2 });
  assert.equal(back.version, 9);
  const html = await claude.tool("read_file", { artifact: slug, path: "index.html" });
  assert.match(html.content, /Shopping list<\/h1>/);
  const h = await claude.tool("list_versions", { artifact: slug });
  assert.equal(h.head_version, 9);
  assert.equal(h.versions[0].kind, "restore");
  assert.ok(h.versions.some((v) => v.kind === "suggestion" && v.suggestion === 1));
});

await step("activity: per artifact after an id, and across artifacts since a time", async () => {
  const all = await gemini.tool("get_activity", { artifact: slug });
  assert.ok(all.events.length >= 10);
  const kinds = new Set(all.events.map((e) => e.kind));
  for (const k of ["created", "edited", "suggested", "suggestion_accepted", "suggestion_rejected", "commented", "restored"]) assert.ok(kinds.has(k), k);
  const mid = all.events[all.events.length - 3].id;
  const after = await gemini.tool("get_activity", { artifact: slug, after: mid });
  assert.equal(after.events.length, 2);
  assert.equal(after.last_event_id, all.last_event_id);
  const since = await gemini.tool("get_activity", { since: new Date(Date.now() - 3600_000).toISOString() });
  assert.ok(since.events.every((e) => e.artifact?.slug));
});

await step("render: sandbox CSP, signed keys for private, link visibility", async () => {
  const s = await claude.tool("show_artifact", { artifact: slug });
  assert.match(s.render_url, /\/r\/[a-z0-9]+\/9\/\d+\.[\w-]+\/$/);
  const page = await fetch(s.render_url);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /^sandbox allow-scripts/);
  assert.doesNotMatch(page.headers.get("content-security-policy"), /allow-same-origin/);
  assert.match(page.headers.get("content-type"), /text\/html/);
  const html = await page.text();
  assert.match(html, /Shopping list/);
  assert.doesNotMatch(html, /folio: "find"|kind: "selection"/, "no comment helper unless the workspace asks");
  const framed = await (await fetch(`${s.render_url}?folio=select`)).text();
  assert.match(framed, /kind: "selection"/, "the workspace's frame gets the comment helper");
  assert.ok(framed.includes(`)(${JSON.stringify(new URL(site).origin)});</script>`), "messages only go to Folio's origin");
  assert.ok(!/<\/body>/i.test(html) || framed.indexOf("<script>(function (origin)") < framed.toLowerCase().lastIndexOf("</body>"), "helper goes before </body>");
  const cssFramed = await (await fetch(`${s.render_url}style.css?folio=select`)).text();
  assert.doesNotMatch(cssFramed, /<script>/, "only HTML gets the helper");
  const css = await fetch(`${s.render_url}style.css`);
  assert.match(css.headers.get("content-type"), /text\/css/);
  const png = await fetch(`${s.render_url}img/dot.png`);
  assert.equal(png.headers.get("content-type"), "image/png");
  assert.equal((await png.arrayBuffer()).byteLength, 70);
  assert.equal((await fetch(`${site}/r/${slug}/9/p/`)).status, 403, "private needs a signed key");
  const forged = s.render_url.replace(/\.[\w-]+\/$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAA/");
  assert.equal((await fetch(forged)).status, 403);
  assert.equal((await fetch(`${s.render_url}nope.html`)).status, 404);
  await claude.tool("update_artifact", { artifact: slug, visibility: "link" });
  const pub = await fetch(`${site}/r/${slug}/9/p/`);
  assert.equal(pub.status, 200);
  assert.equal((await claude.tool("show_artifact", { artifact: slug })).render_url, `${site}/r/${slug}/9/p/`);
  await claude.tool("update_artifact", { artifact: slug, visibility: "private" });
  assert.equal((await fetch(`${site}/r/${slug}/9/p/`)).status, 403);
});

let shared;
await step("sharing: invite a second person as viewer; viewers suggest, not edit", async () => {
  const otherToken = (await call("/api/tokens", { method: "POST", auth: other, body: { name: "Other's agent" } })).body.token;
  const otherAgent = mcpClient(otherToken, "chatgpt");
  await otherAgent.init();
  const hidden = await otherAgent.toolError("get_artifact", { artifact: slug });
  assert.equal(hidden.error, "not_found", "private artifacts don't leak");
  const inv = await claude.tool("share_artifact", { artifact: slug, role: "viewer" });
  const token = inv.invite_url.split("#")[1];
  assert.equal((await call("/api/invites/preview", { method: "POST", body: { token } })).body.role, "viewer");
  const acc = await call("/api/invites/accept", { method: "POST", auth: other, body: { token } });
  assert.equal(acc.status, 200);
  assert.equal(acc.body.slug, slug);
  const r = await otherAgent.tool("get_artifact", { artifact: slug });
  assert.equal(r.artifact.your_role, "viewer");
  const denied = await otherAgent.toolError("edit_artifact", { artifact: slug, base_version: r.artifact.head_version, ops: [{ op: "write", path: "x.txt", content: "x" }] });
  assert.equal(denied.error, "forbidden");
  assert.match(denied.message, /suggest_edit/);
  const s = await otherAgent.tool("suggest_edit", { artifact: slug, base_version: r.artifact.head_version, title: "From a viewer", ops: [{ op: "write", path: "x.txt", content: "hi" }] });
  assert.equal((await otherAgent.toolError("review_suggestion", { artifact: slug, suggestion: s.suggestion.number, decision: "accept" })).error, "forbidden");
  assert.equal((await otherAgent.tool("review_suggestion", { artifact: slug, suggestion: s.suggestion.number, decision: "withdraw" })).suggestion.status, "withdrawn");
  assert.equal((await otherAgent.toolError("share_artifact", { artifact: slug, role: "editor" })).error, "forbidden");
  const mine = await otherAgent.tool("list_artifacts");
  assert.ok(mine.artifacts.some((a) => a.slug === slug && a.role === "viewer"));
  const sh = await call(`/api/artifacts/${slug}/sharing`, { auth: owner });
  assert.equal(sh.body.members.length, 1);
  assert.match(sh.body.members[0].email, /folio-other/);
  // Promote to editor; now edits work, attributed to the other person's agent.
  await call(`/api/artifacts/${slug}/members/${sh.body.members[0].user_id}`, { method: "PATCH", auth: owner, body: { role: "editor" } });
  const e = await otherAgent.tool("edit_artifact", { artifact: slug, base_version: r.artifact.head_version, ops: [{ op: "write", path: "notes.md", content: "# Notes\n" }] });
  assert.ok(e.version > r.artifact.head_version);
  shared = { otherAgent, userId: sh.body.members[0].user_id };
});

await step("fork and export", async () => {
  const f = await shared.otherAgent.tool("fork_artifact", { artifact: slug, version: 3, title: "My list" });
  assert.equal(f.artifact.title, "My list");
  const fr = await shared.otherAgent.tool("get_artifact", { artifact: f.artifact.slug });
  assert.equal(fr.artifact.your_role, "owner");
  assert.ok(fr.files.some((x) => x.path === "img/dot.png" && x.size === 70), "binary files copied");
  const zip = await fetch(`${site}/api/artifacts/${slug}/export.zip`, { headers: { Authorization: `Bearer ${owner}` } });
  assert.equal(zip.status, 200);
  assert.equal(zip.headers.get("content-type"), "application/zip");
  const buf = Buffer.from(await zip.arrayBuffer());
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  assert.ok(buf.includes(Buffer.from("index.html")));
});

await step("live data: set_data, pages read .folio/data.json, merge, limits, fork and export", async () => {
  const before = (await claude.tool("get_artifact", { artifact: slug })).artifact.head_version;
  const show = await claude.tool("show_artifact", { artifact: slug });
  const empty = await fetch(`${show.render_url}.folio/data.json`);
  assert.equal(empty.status, 200);
  assert.equal(await empty.text(), "null", "null until it's set");
  const set = await claude.tool("set_data", { artifact: slug, data: { temp: 21, city: "SF", list: [1, 2] } });
  assert.equal(set.read_at, ".folio/data.json");
  assert.ok(set.data.bytes > 10);
  const page = await fetch(`${show.render_url}.folio/data.json`);
  assert.deepEqual(await page.json(), { temp: 21, city: "SF", list: [1, 2] });
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.match(page.headers.get("content-security-policy"), /^sandbox/);
  assert.equal((await fetch(`${site}/r/${slug}/1/p/.folio/data.json`)).status, 403, "private data needs a signed key too");
  await gemini.tool("set_data", { artifact: slug, data: { temp: 22, city: null, wind: 5 }, merge: true });
  const got = await claude.tool("get_data", { artifact: slug });
  assert.deepEqual(got.data, { temp: 22, list: [1, 2], wind: 5 });
  assert.match(got.set.agent, /gemini/i);
  assert.equal((await claude.tool("get_artifact", { artifact: slug })).artifact.head_version, before, "setting data makes no version");
  assert.equal((await claude.toolError("set_data", { artifact: slug, data: { big: "x".repeat(300 * 1024) } })).error, "too_large");
  assert.equal((await claude.toolError("set_data", { artifact: slug, data: [1], merge: true })).error, "data");
  const reserved = await claude.toolError("edit_artifact", { artifact: slug, base_version: before, ops: [{ op: "write", path: ".folio/data.json", content: "{}" }] });
  assert.match(reserved.message, /Folio's own folder/);
  const web = await call(`/api/artifacts/${slug}/data`, { auth: owner });
  assert.deepEqual(web.body.data, got.data);
  const f = await claude.tool("fork_artifact", { artifact: slug, title: "Data fork" });
  assert.deepEqual((await claude.tool("get_data", { artifact: f.artifact.slug })).data, got.data, "a fork keeps the data");
  const zip = Buffer.from(await (await fetch(`${site}/api/artifacts/${slug}/export.zip`, { headers: { Authorization: `Bearer ${owner}` } })).arrayBuffer());
  assert.ok(zip.includes(Buffer.from(".folio/data.json")), "the zip carries the data");
});

await step("favorites: per person, in the list, idempotent", async () => {
  const find = async (auth) => (await call("/api/artifacts", { auth })).body.find((a) => a.slug === slug);
  assert.equal((await find(owner)).favorite, false);
  assert.equal((await call(`/api/artifacts/${slug}/favorite`, { method: "POST", auth: owner })).status, 200);
  assert.equal((await call(`/api/artifacts/${slug}/favorite`, { method: "POST", auth: owner })).status, 200, "starring twice is fine");
  assert.equal((await find(owner)).favorite, true);
  assert.equal((await find(other)).favorite, false, "a favorite is one person's");
  assert.equal((await call(`/api/artifacts/${slug}/favorite`, { method: "POST", auth: other })).status, 200, "members can star shared artifacts");
  assert.equal((await find(other)).favorite, true);
  assert.notEqual((await call("/api/artifacts/zzzzzzzz/favorite", { method: "POST", auth: owner })).status, 200, "unknown artifact");
  assert.equal((await call(`/api/artifacts/${slug}/favorite`, { method: "DELETE", auth: owner })).status, 200);
  assert.equal((await find(owner)).favorite, false);
});

await step("web API: artifact page data, edits by Web, comments, events polling", async () => {
  const d = await call(`/api/artifacts/${slug}`, { auth: owner });
  assert.equal(d.status, 200);
  assert.equal(d.body.role, "owner");
  const head = d.body.artifact.head_version;
  const e = await call(`/api/artifacts/${slug}/edits`, { method: "POST", auth: owner, body: { base_version: head, ops: [{ op: "write", path: "notes.md", content: "# Notes\n- from the web\n" }], message: "Notes" } });
  assert.equal(e.status, 200, e.text);
  const v = await call(`/api/artifacts/${slug}/versions`, { auth: owner });
  assert.equal(v.body[0].agent, "Web");
  const ev = await call(`/api/artifacts/${slug}/events?after=0`, { auth: owner });
  assert.ok(ev.body.events.length > 10);
  const anon = await call(`/api/artifacts/${slug}`);
  assert.equal(anon.status, 404, "private artifacts are hidden from signed-out visitors");
  const list = await call("/api/artifacts", { auth: owner });
  assert.ok(list.body.some((a) => a.slug === slug && a.open_suggestions === 0));
  const bad = await call(`/api/artifacts/${slug}/edits`, { method: "POST", auth: other, body: { base_version: 1, ops: [{ op: "write", path: "index.html", content: "x" }] } });
  assert.equal(bad.status, 409, "the other person (editor) gets a stale conflict, not silent overwrite");
});

/** Stands in for Apple's push service: records each push; answers 410 for tokens starting "dead". */
const pushes = [];
const apns = createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    const token = req.url.split("/").pop();
    pushes.push({ token, headers: req.headers, body: JSON.parse(data || "{}") });
    const dead = token.startsWith("dead");
    res.writeHead(dead ? 410 : 200, { "content-type": "application/json" });
    res.end(dead ? JSON.stringify({ reason: "Unregistered" }) : "");
  });
});
await new Promise((r) => apns.listen(8851, "127.0.0.1", r));
const hexToken = (prefix) => (prefix + randomBytes(32).toString("hex")).slice(0, 64);
const pushesTo = (t) => pushes.filter((p) => p.token === t);

await step("iPhone notifications: agents' work notifies, your own taps don't, prefs and dead tokens", async () => {
  const mine = hexToken("aa");
  const theirs = hexToken("bb");
  const bad = await call("/api/push", { method: "POST", auth: owner, body: { token: "nope" } });
  assert.equal(bad.status, 400);
  assert.equal((await call("/api/push", { method: "POST", body: { token: mine } })).status, 401);
  const r = await call("/api/push", { method: "POST", auth: owner, body: { token: mine, sandbox: true, edits: false } });
  assert.deepEqual(r.body, { ok: true, suggestions: true, comments: true, edits: false });
  await call("/api/push", { method: "POST", auth: other, body: { token: theirs } });
  pushes.length = 0;

  // Gemini (the owner's agent) suggests: both people hear about it, with Accept/Reject buttons.
  const head = (await call(`/api/artifacts/${slug}`, { auth: owner })).body.artifact.head_version;
  const s = await gemini.tool("suggest_edit", { artifact: slug, base_version: head, title: "Add butter", rationale: "Toast.", ops: [{ op: "write", path: "butter.txt", content: "butter\n" }], agent: "Gemini CLI" });
  const [p] = pushesTo(mine);
  assert.ok(p, "the owner's iPhone got the suggestion");
  assert.equal(p.body.aps.alert.title, "Gemini CLI suggested a change");
  assert.equal(p.body.aps.alert.subtitle, "Shopping list");
  assert.equal(p.body.aps.alert.body, "Add butter");
  assert.equal(p.body.aps.category, "FOLIO_SUGGESTION");
  assert.equal(p.body.slug, slug);
  assert.equal(p.body.suggestion, s.suggestion.number);
  assert.equal(p.headers["apns-topic"], "com.hejitech.folio");
  assert.equal(p.headers["apns-push-type"], "alert");
  const [h, c] = p.headers.authorization.replace(/^bearer /, "").split(".").slice(0, 2).map((x) => JSON.parse(Buffer.from(x, "base64url").toString()));
  assert.deepEqual([h.alg, h.kid, c.iss], ["ES256", "LOCALKEY01", "LOCALTEST1"], "ES256 provider token");
  assert.equal(pushesTo(theirs).length, 1, "members hear about it too");

  // The owner comments from the iPhone app: attributed "iPhone", and only the other person is told.
  pushes.length = 0;
  const cm = await call(`/api/artifacts/${slug}/comments`, { method: "POST", auth: owner, headers: { "X-Folio-Client": "iPhone" }, body: { body: "Salted, please." } });
  assert.equal(cm.status, 201, cm.text);
  assert.equal(cm.body.agent, "iPhone");
  assert.equal(pushesTo(mine).length, 0, "your own comment doesn't notify you");
  assert.equal(pushesTo(theirs)[0].body.aps.alert.title, "iPhone commented");
  assert.equal(pushesTo(theirs)[0].body.aps.alert.body, "Salted, please.");
  assert.equal(pushesTo(theirs)[0].body.aps.category, "FOLIO_COMMENT");

  // Claude saves a version: the owner turned edits off, the other person didn't.
  pushes.length = 0;
  const h2 = (await call(`/api/artifacts/${slug}`, { auth: owner })).body.artifact.head_version;
  await claude.tool("edit_artifact", { artifact: slug, base_version: h2, ops: [{ op: "write", path: "jam.txt", content: "jam\n" }], message: "Add jam" });
  assert.equal(pushesTo(mine).length, 0, "edits switched off");
  assert.equal(pushesTo(theirs)[0].body.aps.alert.title, `claude-code saved v${h2 + 1}`);
  assert.equal(pushesTo(theirs)[0].body.aps.alert.body, "Add jam");
  assert.equal(pushesTo(theirs)[0].body.version, h2 + 1);

  // Turning everything off, signing out (DELETE) and Apple's 410 all stop pushes.
  await call("/api/push", { method: "POST", auth: owner, body: { token: mine, suggestions: false, comments: false, edits: false } });
  await call(`/api/push/${theirs}`, { method: "DELETE", auth: other });
  const dead = hexToken("dead");
  await call("/api/push", { method: "POST", auth: other, body: { token: dead } });
  pushes.length = 0;
  await gemini.tool("comment", { artifact: slug, body: "One more thing." });
  assert.deepEqual(pushes.map((x) => x.token), [dead], "only the dead token was tried");
  pushes.length = 0;
  await gemini.tool("comment", { artifact: slug, body: "And another." });
  assert.equal(pushes.length, 0, "Apple's 410 removed the dead token");
  await call(`/api/artifacts/${slug}/suggestions/${s.suggestion.number}/review`, { method: "POST", auth: owner, body: { decision: "reject" } });
  await call(`/api/push/${mine}`, { method: "DELETE", auth: owner });
});
apns.close();

await step("review sign-in: wrong password 401; demo data on every sign-in, same account", async () => {
  const wrong = await call("/api/review-sign-in", { method: "POST", body: { email: "review@example.com", password: "nope" } });
  assert.equal(wrong.status, 401);
  const r = await call("/api/review-sign-in", { method: "POST", body: { email: "Review@Example.com ", password: "folio-review-dev" } });
  assert.equal(r.status, 200, r.text);
  assert.ok(r.body.access_token && r.body.refresh_token && r.body.user.id);
  const list = (await call("/api/artifacts", { auth: r.body.access_token })).body;
  assert.deepEqual(list.map((a) => a.title).sort(), ["Big Sur weekend", "Standing desks under $600"]);
  const trip = list.find((a) => a.title === "Big Sur weekend");
  assert.equal(trip.open_suggestions, 1);
  assert.equal(trip.review_agent, "Gemini", "the list says which agent asked for review");
  assert.equal(trip.unresolved_comments, 1);
  const desks = list.find((a) => a.title !== "Big Sur weekend");
  assert.equal(desks.review_agent, null);
  assert.equal(desks.unresolved_comments, 0);
  const versions = (await call(`/api/artifacts/${trip.slug}/versions`, { auth: r.body.access_token })).body;
  assert.deepEqual(versions.map((v) => v.agent), ["Gemini", "Claude"]);
  // The reviewer deletes things; the next sign-in brings the demo back for the same user.
  await call(`/api/artifacts/${trip.slug}`, { method: "DELETE", auth: r.body.access_token });
  const again = await call("/api/review-sign-in", { method: "POST", body: { email: "review@example.com", password: "folio-review-dev" } });
  assert.equal(again.body.user.id, r.body.user.id);
  assert.equal((await call("/api/artifacts", { auth: again.body.access_token })).body.length, 2);
});

await step("tokens: revoke stops access", async () => {
  const t = await call("/api/tokens", { method: "POST", auth: owner, body: { name: "Temp" } });
  const temp = mcpClient(t.body.token, "temp");
  await temp.init();
  assert.ok((await temp.tool("list_artifacts")).artifacts.length >= 1);
  await call(`/api/tokens/${t.body.id}`, { method: "DELETE", auth: owner });
  assert.equal((await temp.rpc("tools/list")).status, 401);
});

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const redirectUri = "http://127.0.0.1:9999/callback";
const cookiesOf = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
async function startAuthorize(clientId, challenge, state) {
  const u = new URL(`${site}/authorize`);
  for (const [k, v] of Object.entries({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "mcp", state, code_challenge: challenge, code_challenge_method: "S256", resource: mcpUrl }))
    u.searchParams.set(k, v);
  const res = await fetch(u, { redirect: "manual" });
  assert.equal(res.status, 302, `authorize → ${res.status}`);
  return { page: new URL(res.headers.get("Location")), cookie: cookiesOf(res) };
}
async function decide(page, cookie, decision, auth) {
  const res = await fetch(`${site}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ handle: page.searchParams.get("handle"), decision }),
  });
  return { status: res.status, body: await res.json() };
}

await step("OAuth 2.1: register → consent (deny, approve) → token → MCP attributed → disconnect", async () => {
  const reg = await fetch(`${site}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Test agent", redirect_uris: [redirectUri], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  });
  assert.equal(reg.status, 201);
  const clientId = (await reg.json()).client_id;
  const first = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s1");
  assert.equal(first.page.pathname, "/oauth/consent/");
  assert.equal(first.page.searchParams.get("client"), "Test agent");
  assert.equal((await fetch(first.page)).status, 200);
  assert.equal((await decide(first.page, first.cookie, "approve", null)).status, 401);
  const denied = await startAuthorize(clientId, b64url(createHash("sha256").update("x").digest()), "s2");
  assert.equal(new URL((await decide(denied.page, denied.cookie, "deny", null)).body.redirectTo).searchParams.get("error"), "access_denied");
  const verifier = b64url(randomBytes(32));
  const ok = await startAuthorize(clientId, b64url(createHash("sha256").update(verifier).digest()), "s3");
  const r = await decide(ok.page, ok.cookie, "approve", owner);
  const back = new URL(r.body.redirectTo);
  const tok = await fetch(`${site}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code"), redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource: mcpUrl }),
  });
  const access = (await tok.json()).access_token;
  assert.ok(access);
  // No initialize: the OAuth client's name is the fallback attribution.
  const viaOAuth = mcpClient(access, "unused");
  const c = await viaOAuth.tool("comment", { artifact: slug, body: "Hello via OAuth" });
  assert.equal(c.comment.agent, "Test agent");
  const grants = await call("/api/grants", { auth: owner });
  const g = grants.body.find((x) => x.client_name === "Test agent");
  await call(`/api/grants/${encodeURIComponent(g.id)}`, { method: "DELETE", auth: owner });
  assert.equal((await viaOAuth.rpc("tools/list")).status, 401);
});

await step("RLS: members read rows through PostgREST, others don't", async () => {
  const get = async (auth) =>
    (await fetch(`${supabase}/rest/v1/artifacts?select=slug&slug=eq.${slug}`, { headers: { apikey: ANON, Authorization: `Bearer ${auth}`, "Accept-Profile": "folio" } })).json();
  assert.equal((await get(owner)).length, 1);
  assert.equal((await get(other)).length, 1, "the editor member");
  const stranger = await makeUser(`folio-stranger-${Date.now()}@example.com`, "stranger-pass-1");
  assert.equal((await get(stranger)).length, 0);
  const write = await fetch(`${supabase}/rest/v1/artifacts?slug=eq.${slug}`, {
    method: "PATCH",
    headers: { apikey: ANON, Authorization: `Bearer ${owner}`, "Content-Profile": "folio", "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ title: "hacked" }),
  });
  assert.ok(write.status >= 400 || (await write.json()).length === 0, "clients can't write directly");
});

// ---- search, waiting for activity, Pro, webhooks, link previews (0.3.0)
const rest = (path, init = {}) =>
  fetch(`${supabase}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Profile": "folio", "Accept-Profile": "folio", "Content-Type": "application/json", Prefer: "resolution=merge-duplicates", ...(init.headers ?? {}) },
  });
const grantPro = (email) => rest("pro_grants", { method: "POST", body: JSON.stringify({ email, note: "test-api" }) });
const revokePro = (email) => rest(`pro_grants?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });

await step("search: titles, descriptions and file contents, phrases, excerpts", async () => {
  const word = `zebrafish${Date.now()}`;
  const made = await claude.tool("create_artifact", {
    title: "Aquarium notes",
    description: "Tank setup for the office",
    files: [
      { path: "index.html", content: `<!doctype html><title>Aquarium notes</title><style>.x{color:red}</style><h1>Fish</h1><p>Feed the ${word} twice a day with flakes.</p>` },
      { path: "data/plan.md", content: `# Plan\n\nBuy a heater. The ${word} like warm water.\n` },
    ],
  });
  const s = made.artifact.slug;
  const r = await claude.tool("search_artifacts", { query: word });
  const hit = r.hits.find((h) => h.slug === s);
  assert.ok(hit, "found by a word in its files");
  assert.deepEqual(hit.matched_in, ["files"]);
  assert.deepEqual(hit.files.map((f) => f.path).sort(), ["data/plan.md", "index.html"]);
  const html = hit.files.find((f) => f.path === "index.html").excerpt;
  assert.ok(html.includes(`Feed the ${word} twice`) && !html.includes("<p>") && !html.includes("color:red"), `readable excerpt: ${html}`);
  // Every word must match, in any file; a quoted phrase stays together.
  assert.ok((await claude.tool("search_artifacts", { query: `${word} heater` })).hits.some((h) => h.slug === s));
  assert.ok(!(await claude.tool("search_artifacts", { query: `${word} submarine` })).hits.some((h) => h.slug === s));
  assert.ok(!(await claude.tool("search_artifacts", { query: `"heater ${word}"` })).hits.some((h) => h.slug === s));
  // Titles rank first and say where they matched.
  const t = await claude.tool("search_artifacts", { query: "aquarium" });
  assert.equal(t.hits[0].slug, s);
  assert.ok(t.hits[0].matched_in.includes("title"));
  // The web dashboard's search, and nothing for people who can't open it.
  const web = await call(`/api/search?q=${word}`, { auth: owner });
  assert.equal(web.status, 200);
  assert.equal(web.body[0].artifact.slug, s);
  const stranger = await makeUser(`folio-search-${Date.now()}@example.com`, "search-pass-1");
  assert.equal((await call(`/api/search?q=${word}`, { auth: stranger })).body.length, 0);
  assert.equal((await claude.toolError("search_artifacts", { query: "  " })).error, "query");
});

await step("wait_for_activity: a person's comment arrives while waiting; agents' are skipped", async () => {
  const started = Date.now();
  const waiting = claude.tool("wait_for_activity", { artifact: slug, seconds: 15 });
  await new Promise((r) => setTimeout(r, 1200));
  await gemini.tool("comment", { artifact: slug, body: "An agent's note (skipped by default)" });
  await new Promise((r) => setTimeout(r, 600));
  await call(`/api/artifacts/${slug}/comments`, { method: "POST", auth: owner, body: { body: "Can you make the heading bigger?" } });
  const r = await waiting;
  assert.equal(r.timed_out, false);
  assert.ok(Date.now() - started < 12000, "returned soon after the comment");
  assert.equal(r.events.length, 1, JSON.stringify(r.events));
  assert.equal(r.events[0].kind, "commented");
  assert.equal(r.events[0].via, "web");
  assert.equal(r.events[0].artifact.slug, slug);
  // Keep listening from there: include agents, and a quiet wait times out.
  const again = await claude.tool("wait_for_activity", { after: r.last_event_id - 2, include_agents: true, seconds: 3 });
  assert.ok(again.events.some((e) => e.via === "mcp"));
  const quiet = await claude.tool("wait_for_activity", { artifact: slug, seconds: 3 });
  assert.equal(quiet.timed_out, true);
  assert.ok(quiet.next.includes(String(quiet.last_event_id)));
});

await step("Pro: free limits with a 402 and a link; a grant lifts them; one answer in /api/pro", async () => {
  const email = `folio-free-${Date.now()}@example.com`;
  const free = await makeUser(email, "free-pass-1");
  const pro0 = await call("/api/pro", { auth: free });
  assert.equal(pro0.body.pro, false);
  assert.equal(pro0.body.limits.artifacts, 25);
  assert.equal(pro0.body.limits.webhooks, 0);
  // One version larger than the free plan's 10 MB needs Pro.
  const big = Buffer.alloc(5.5 * 1024 * 1024, 7).toString("base64");
  const tooBig = await call("/api/artifacts", { method: "POST", auth: free, body: { title: "Big", files: [{ path: "index.html", content: "<p>big</p>" }, { path: "a.bin", base64: big }, { path: "b.bin", base64: big }] } });
  assert.equal(tooBig.status, 402, tooBig.text.slice(0, 200));
  assert.equal(tooBig.body.code, "pro_required");
  assert.ok(tooBig.body.url.endsWith("/pro/"));
  for (let i = 0; i < 25; i++) {
    const r = await call("/api/artifacts", { method: "POST", auth: free, body: { title: `Note ${i}`, files: [{ path: "index.html", content: `<p>${i}</p>` }] } });
    assert.equal(r.status, 201, r.text);
  }
  const over = await call("/api/artifacts", { method: "POST", auth: free, body: { title: "One more", files: [{ path: "index.html", content: "<p>26</p>" }] } });
  assert.equal(over.status, 402);
  assert.match(over.body.error, /free plan/);
  assert.equal((await grantPro(email)).status, 201);
  const pro1 = await call("/api/pro", { auth: free });
  assert.equal(pro1.body.pro, true);
  assert.equal(pro1.body.source, "grant");
  assert.equal(pro1.body.artifacts, 25);
  assert.equal((await call("/api/artifacts", { method: "POST", auth: free, body: { title: "One more", files: [{ path: "index.html", content: "<p>26</p>" }] } })).status, 201);
  assert.equal((await call("/api/artifacts", { method: "POST", auth: free, body: { title: "Big", files: [{ path: "index.html", content: "<p>big</p>" }, { path: "a.bin", base64: big }, { path: "b.bin", base64: big }] } })).status, 201);
  await revokePro(email);
  await call("/api/account", { method: "DELETE", auth: free });
});

await step("webhooks: people only, Pro only, signed deliveries, agents' changes skipped", async () => {
  const hits = [];
  const recv = createServer((req, res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      hits.push({ headers: req.headers, body: b });
      res.writeHead(200).end("ok");
    });
  });
  await new Promise((r) => recv.listen(8852, "127.0.0.1", r));
  const hookUrl = "http://127.0.0.1:8852/hook";
  try {
    const me = (await call("/api/me", { auth: owner })).body;
    await revokePro(me.email);
    const noPro = await call("/api/webhooks", { method: "POST", auth: owner, body: { url: hookUrl } });
    assert.equal(noPro.status, 402);
    await grantPro(me.email);
    assert.equal((await call("/api/webhooks", { method: "POST", auth: owner, body: { url: "ftp://nope" } })).status, 400);
    const made = await call("/api/webhooks", { method: "POST", auth: owner, body: { url: hookUrl, artifact: slug } });
    assert.equal(made.status, 201, made.text);
    assert.ok(made.body.secret.startsWith("fwh_"));
    assert.deepEqual(made.body.kinds, ["commented", "suggested", "suggestion_revised"]);
    // An agent's comment doesn't fire it (include_agents is off); a person's does, signed.
    await gemini.tool("comment", { artifact: slug, body: "agent says hi" });
    await call(`/api/artifacts/${slug}/comments`, { method: "POST", auth: owner, body: { body: "Please shorten the intro" } });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(hits.length, 1, JSON.stringify(hits.map((h) => h.body)));
    const h = hits[0];
    const payload = JSON.parse(h.body);
    assert.equal(h.headers["folio-event"], "commented");
    assert.equal(payload.kind, "commented");
    assert.equal(payload.artifact.slug, slug);
    assert.ok(payload.id > 0 && payload.comment);
    const [, t, v1] = h.headers["folio-signature"].match(/^t=(\d+),v1=([0-9a-f]{64})$/);
    const { createHmac } = await import("node:crypto");
    assert.equal(createHmac("sha256", made.body.secret).update(`${t}.${h.body}`).digest("hex"), v1);
    // Kinds it didn't ask for don't fire; the list shows how the last delivery went.
    await claude.tool("set_data", { artifact: slug, data: { x: 1 } });
    const list = await call("/api/webhooks", { auth: owner });
    assert.equal(list.body.webhooks[0].last_status, 200);
    assert.equal(list.body.webhooks[0].artifact, slug);
    const test = await call(`/api/webhooks/${made.body.id}/test`, { method: "POST", auth: owner });
    assert.equal(test.body.ok, true);
    assert.equal(hits.at(-1).headers["folio-event"], "ping");
    // Agents can't set one up: there's no tool, and their token can't reach the web API.
    assert.ok(!(await claude.rpc("tools/list")).body.result.tools.some((t) => /webhook/.test(t.name)));
    assert.equal((await call("/api/webhooks", { method: "POST", auth: DEV_TOKEN, body: { url: hookUrl } })).status, 401);
    // Without Pro, nothing is sent.
    await revokePro(me.email);
    const before = hits.length;
    await call(`/api/artifacts/${slug}/comments`, { method: "POST", auth: owner, body: { body: "after the plan ended" } });
    assert.equal(hits.length, before);
    assert.equal((await call(`/api/webhooks/${made.body.id}`, { method: "DELETE", auth: owner })).status, 200);
    assert.equal((await call("/api/webhooks", { auth: owner })).body.webhooks.length, 0);
  } finally {
    recv.close();
  }
});

await step("link previews: link artifacts unfurl with their title and a picture; private ones don't", async () => {
  const page = async () => (await fetch(`${site}/a/${slug}`)).text();
  const meta = (html, prop) => html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`))?.[1];
  const title = (await call(`/api/artifacts/${slug}`, { auth: owner })).body.artifact.title;
  await call(`/api/artifacts/${slug}`, { method: "PATCH", auth: owner, body: { visibility: "private" } });
  const priv = await page();
  assert.equal(meta(priv, "og:title"), "An artifact on Folio");
  assert.ok(!priv.includes(title), "a private title never leaks");
  await call(`/api/artifacts/${slug}`, { method: "PATCH", auth: owner, body: { visibility: "link" } });
  const pub = await page();
  assert.equal(meta(pub, "og:title"), title.replace(/&/g, "&amp;"));
  const img = meta(pub, "og:image");
  assert.match(img, new RegExp(`/og/${slug}/\\d+\\.png$`));
  assert.match(pub, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · Folio</title>`));
  const png = await fetch(img.replace(/^https?:\/\/[^/]+/, site));
  assert.equal(png.status, 200);
  assert.equal(png.headers.get("content-type"), "image/png");
  const bytes = new Uint8Array(await png.arrayBuffer());
  assert.deepEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47]);
  // Unknown or private: the plain card, never an error.
  assert.equal((await fetch(`${site}/og/nosuchslug2/1.png`)).status, 200);
  await call(`/api/artifacts/${slug}`, { method: "PATCH", auth: owner, body: { visibility: "private" } });
});

await step("leaving, and deleting a person's data", async () => {
  await call(`/api/artifacts/${slug}/members/${shared.userId}`, { method: "DELETE", auth: other });
  assert.equal((await shared.otherAgent.toolError("get_artifact", { artifact: slug })).error, "not_found");
  const del = await call("/api/account", { method: "DELETE", auth: other });
  assert.equal(del.status, 200);
  assert.equal((await call("/api/artifacts", { auth: other })).body.length, 0);
  const d = await call(`/api/artifacts/${slug}`, { method: "DELETE", auth: owner });
  assert.equal(d.status, 200);
  assert.equal((await call(`/api/artifacts/${slug}`, { auth: owner })).status, 404);
});

console.log(`\n${passed} checks passed.`);
