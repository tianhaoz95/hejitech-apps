// The API (/api/*) for the Tether web dashboard, the iPhone app, and the Android app.
import {
  KEYBOARD_SHORTCUTS,
  normalizeSettings,
  normalizeSshHost,
  validatePaneTree,
  validateSshHost,
  type PaneTree,
  type SshHost,
  type TetherSettings,
} from "@tether/core";
import {
  admin,
  deleteBookmark,
  deleteHost,
  json,
  loadWorkspace,
  PREFIX,
  randomToken,
  saveWorkspaceTreeAndSettings,
  sha256,
  supabaseUser,
  upsertBookmark,
  upsertHost,
  type Env,
} from "./store.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  json(body, status, { ...cors, ...extra });

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin(env);
  const path = url.pathname;

  // ------------------------------------------------------------ public
  if (path === "/api/status" && req.method === "GET") {
    return reply({
      service: "tether",
      version: "0.1.0",
      tools: ["web", "ssh", "files"],
      max_panes: 4,
      shortcuts: KEYBOARD_SHORTCUTS,
    });
  }

  // ------------------------------------------------------------ authenticated session
  const user = await supabaseUser(env, req);
  if (!user) return reply({ error: "sign in required" }, 401);
  const userId = user.id;

  if (path === "/api/workspace" && req.method === "GET") {
    const ws = await loadWorkspace(db, userId);
    return reply({ ...ws, email: user.email ?? null });
  }

  if (path === "/api/workspace" && req.method === "PUT") {
    const body = (await req.json().catch(() => null)) as {
      tree?: PaneTree;
      settings?: Partial<TetherSettings>;
    } | null;
    if (!body?.tree) return reply({ error: "tree is required" }, 400);
    const issues = validatePaneTree(body.tree);
    if (issues.length) return reply({ error: "invalid pane tree", issues }, 422);
    const ws = await loadWorkspace(db, userId);
    const settings = normalizeSettings(body.settings ?? ws.settings);
    await saveWorkspaceTreeAndSettings(db, userId, body.tree, settings);
    return reply({ tree: body.tree, settings, saved: true });
  }

  if (path === "/api/hosts" && req.method === "GET") {
    const ws = await loadWorkspace(db, userId);
    return reply(ws.hosts);
  }

  if (path === "/api/hosts" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as Partial<SshHost> | null;
    const issues = validateSshHost(body);
    if (issues.length) return reply({ error: "invalid host entry", issues }, 422);
    const host = normalizeSshHost(body!);
    await upsertHost(db, userId, host);
    return reply(host, 201);
  }

  const hostMatch = path.match(/^\/api\/hosts\/([^/]+)$/);
  if (hostMatch && req.method === "DELETE") {
    await deleteHost(db, userId, decodeURIComponent(hostMatch[1]));
    return reply({ ok: true });
  }

  if (path === "/api/bookmarks" && req.method === "GET") {
    const ws = await loadWorkspace(db, userId);
    return reply(ws.bookmarks);
  }

  if (path === "/api/bookmarks" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { id?: string; title?: string; url?: string } | null;
    const urlStr = String(body?.url ?? "").trim();
    if (!urlStr || !/^https?:\/\//i.test(urlStr)) {
      return reply({ error: "valid http(s) url required" }, 422);
    }
    const bm = {
      id: String(body?.id ?? `bm-${Date.now()}`),
      title: String(body?.title ?? urlStr).trim() || urlStr,
      url: urlStr,
    };
    await upsertBookmark(db, userId, bm);
    return reply(bm, 201);
  }

  const bmMatch = path.match(/^\/api\/bookmarks\/([^/]+)$/);
  if (bmMatch && req.method === "DELETE") {
    await deleteBookmark(db, userId, decodeURIComponent(bmMatch[1]));
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ agent tokens (MCP)
  if (path === "/api/tokens" && req.method === "GET") {
    const { data } = await db
      .from("access_tokens")
      .select("id, name, created_at, last_used_at")
      .eq("user_id", userId)
      .order("created_at");
    return reply(data ?? []);
  }

  if (path === "/api/tokens" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const token = randomToken(PREFIX.agent);
    const { data, error } = await db
      .from("access_tokens")
      .insert({
        token_hash: await sha256(token),
        user_id: userId,
        name: String(body.name ?? "Assistant").slice(0, 60),
      })
      .select("id")
      .single();
    if (error) return reply({ error: error.message }, 500);
    return reply({ id: data.id, token });
  }

  const tok = path.match(/^\/api\/tokens\/([0-9a-f-]{36})$/);
  if (tok && req.method === "DELETE") {
    await db.from("access_tokens").delete().eq("user_id", userId).eq("id", tok[1]);
    return reply({ ok: true });
  }

  // ------------------------------------------------------------ delete everything Tether keeps
  if (path === "/api/account" && req.method === "DELETE") {
    for (const t of ["workspaces", "hosts", "bookmarks", "access_tokens"]) {
      const { error } = await db.from(t).delete().eq("user_id", userId);
      if (error) return reply({ error: `couldn't delete ${t}: ${error.message}` }, 500);
    }
    return reply({ ok: true });
  }

  return reply({ error: "not found" }, 404);
}
