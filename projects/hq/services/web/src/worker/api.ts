// REST API. People (the portal, the iOS app) send their Supabase session; runners and agents send a
// workspace token (hq_run_…, hq_agt_…).
//
//   GET  /api/me                          the person and their workspaces
//   POST /api/workspaces                  create one (you become its admin)
//   POST /api/invites/accept              join with an invite code
//   …    /api/w/<workspace>/<route>       everything else, scoped to a workspace (people need a role)
//   …    /api/<route>                     the same routes for tokens (their workspace is implied)
import { REJECT_REASONS, type Evidence, type MemberRole, type Status } from "@hq/core";
import {
  acceptInvite, admin, attachEvidence, auditLog, cardDetail, changeStatus, claimRun, comment, createInvite, createProposal, createToken,
  createWorkspace, decide, digest, finishRun, getContext, getFile, getPolicy, getRun, getWorkspace, healthBoard, HttpError, inbox, listCards,
  listMembers, listRuns, listTokens, memberRole, myWorkspaces, need, putFile, putHealth, removeMember, requestVerb, resolveToken, revokeToken,
  scheduleWorkspace, setMemberRole, setPaused, startRun, supabaseUser, syncPolicy,
  type Caller, type Ctx, type Env, type User,
} from "./store.ts";

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

const body = async <T = Record<string, unknown>>(req: Request): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "body: expected JSON");
  }
};

export const bearer = (req: Request) => req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";

const MAX_FILE = 10 * 1024 * 1024;

/** Who's calling: a workspace token, or a signed-in person (no workspace yet). */
export async function authenticate(x: Ctx, req: Request): Promise<{ token?: Caller; user?: User }> {
  const t = bearer(req);
  if (!t) return {};
  if (t.startsWith("hq_")) {
    const c = await resolveToken(x, t);
    return c ? { token: c } : {};
  }
  const user = await supabaseUser(x.env, t);
  return user ? { user } : {};
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const x: Ctx = { env, db: admin(env) };
  const m = req.method;
  try {
    const p = url.pathname.replace(/\/+$/, "");
    if (p === "/api/health-check") return json({ ok: true, service: "hq" });
    const who = await authenticate(x, req);
    if (!who.token && !who.user) return json({ error: "sign in required: send Authorization: Bearer <session or token>" }, 401);

    // ── a person's own routes
    if (who.user) {
      const user = who.user;
      if (p === "/api/me" && m === "GET") return json({ user, workspaces: await myWorkspaces(x, user) });
      if (p === "/api/workspaces" && m === "POST") {
        const b = await body<{ name: string; repo: string }>(req);
        return json(await createWorkspace(x, user, b.name, b.repo), 201);
      }
      if (p === "/api/invites/accept" && m === "POST") return json(await acceptInvite(x, user, String((await body(req)).code ?? "")));
    }
    if (who.token && p === "/api/me" && m === "GET") {
      const w = await getWorkspace(x, who.token.workspaceId);
      return json({ token: { role: who.token.role, name: who.token.name }, workspace: { id: w.id, name: w.name, repo: w.repo } });
    }

    // ── workspace routes
    let caller: Caller;
    let rest: string;
    const wm = p.match(/^\/api\/w\/([0-9a-f-]{36})(\/.*)?$/);
    if (wm) {
      rest = wm[2] ?? "/";
      if (who.token) {
        if (who.token.workspaceId !== wm[1]) return json({ error: "this token belongs to another workspace" }, 403);
        caller = who.token;
      } else {
        const role = await memberRole(x, wm[1], who.user!.id);
        if (!role) return json({ error: "you're not a member of this workspace" }, 403);
        caller = { role, name: who.user!.email ?? who.user!.id, workspaceId: wm[1], userId: who.user!.id };
      }
    } else if (who.token) {
      caller = who.token;
      rest = p.replace(/^\/api/, "") || "/";
    } else {
      return json({ error: "not found (workspace routes are /api/w/<workspace>/…)" }, 404);
    }
    return await workspaceRoute(x, req, url, caller, rest);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
    console.error(e);
    return json({ error: "internal error" }, 500);
  }
}

async function workspaceRoute(x: Ctx, req: Request, url: URL, c: Caller, p: string): Promise<Response> {
  const m = req.method;
  const q = url.searchParams;

  if (p === "/" && m === "GET") {
    need(c, "read");
    const w = await getWorkspace(x, c.workspaceId);
    return json({ id: w.id, name: w.name, repo: w.repo, paused: w.paused, synced_at: w.synced_at, commit_sha: w.commit_sha, role: c.role });
  }

  // policy & context
  if (p === "/config" && m === "GET") { need(c, "read"); return json(await getPolicy(x, c.workspaceId)); }
  if (p === "/config" && m === "PUT") {
    const b = await body<{ policy: never; commit?: string }>(req);
    await syncPolicy(x, c, b.policy, b.commit ?? null);
    return json({ ok: true });
  }
  if (p === "/context" && m === "GET") return json(await getContext(x, c, q.get("project")));

  // cards
  if (p === "/inbox" && m === "GET") { need(c, "read"); return json({ ...(await inbox(x, c)), reject_reasons: REJECT_REASONS }); }
  if (p === "/cards" && m === "GET") return json(await listCards(x, c, { status: q.get("status")?.split(",").filter(Boolean), project: q.get("project") ?? undefined, limit: Number(q.get("limit") ?? 100) }));
  if (p === "/cards" && m === "POST") return json(await createProposal(x, c, await body(req)), 201);
  let mm = p.match(/^\/cards\/([\w-]+)$/);
  if (mm && m === "GET") return json(await cardDetail(x, c, mm[1]));
  mm = p.match(/^\/cards\/([\w-]+)\/decision$/);
  if (mm && m === "POST") {
    const b = await body<{ decision: string; reason?: string }>(req);
    if (b.decision !== "approved" && b.decision !== "rejected") throw new HttpError(400, "decision: approved or rejected");
    await decide(x, c, mm[1], b.decision, b.reason?.trim() || null);
    return json(await cardDetail(x, c, mm[1]));
  }
  mm = p.match(/^\/cards\/([\w-]+)\/comments$/);
  if (mm && m === "POST") return json(await comment(x, c, mm[1], String((await body(req)).body ?? "")));
  mm = p.match(/^\/cards\/([\w-]+)\/status$/);
  if (mm && m === "POST") {
    const b = await body<{ status: Status; branch?: string; pr_url?: string; reason?: string }>(req);
    await changeStatus(x, c, mm[1], b.status, b);
    return json(await cardDetail(x, c, mm[1]));
  }
  mm = p.match(/^\/cards\/([\w-]+)\/evidence$/);
  if (mm && m === "POST") {
    const b = await body<{ phase?: string; evidence: Evidence }>(req);
    return json(await attachEvidence(x, c, mm[1], b.phase ?? "build", b.evidence));
  }
  mm = p.match(/^\/cards\/([\w-]+)\/files$/);
  if (mm && m === "POST") {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_FILE) throw new HttpError(413, "files up to 10 MB");
    const data = await req.arrayBuffer();
    if (data.byteLength > MAX_FILE) throw new HttpError(413, "files up to 10 MB");
    const name = (q.get("name") ?? "file").replace(/[^\w.-]/g, "_").slice(0, 80);
    return json(await putFile(x, c, mm[1], name, req.headers.get("content-type") ?? "application/octet-stream", data, q.get("phase") ?? "build", q.get("caption")), 201);
  }
  mm = p.match(/^\/files\/(.+)$/);
  if (mm && m === "GET") {
    const blob = await getFile(x, c, decodeURIComponent(mm[1]));
    return new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
  }

  // verbs
  if (p === "/verbs" && m === "POST") {
    const b = await body<{ project: string; verb: string; dry_run?: boolean; card_id?: string }>(req);
    return json(await requestVerb(x, c, b.project, b.verb, b.dry_run === true, b.card_id ?? null), 202);
  }

  // runs
  if (p === "/runs" && m === "GET") return json(await listRuns(x, c, Number(q.get("limit") ?? 50)));
  if (p === "/runs" && m === "POST") {
    const b = await body<{ kind: string; scout?: string; project?: string }>(req);
    return json({ run_id: await startRun(x, c, b.kind, b.scout ?? null, b.project ?? null) }, 202);
  }
  if (p === "/runs/claim" && m === "POST") {
    const b = await body<{ runner?: string; capabilities?: string[] }>(req);
    return json(await claimRun(x, c, b.runner ?? c.name, b.capabilities ?? ["any"]));
  }
  mm = p.match(/^\/runs\/([\w-]+)$/);
  if (mm && m === "GET") return json(await getRun(x, c, mm[1]));
  mm = p.match(/^\/runs\/([\w-]+)\/finish$/);
  if (mm && m === "POST") return json(await finishRun(x, c, mm[1], await body(req)));
  if (p === "/schedule" && m === "POST") { need(c, "start_run"); return json(await scheduleWorkspace(x, c.workspaceId)); }

  // health & digest
  if (p === "/health" && m === "GET") return json(await healthBoard(x, c));
  if (p === "/health" && m === "PUT") {
    const b = await body<{ project: string; data: Record<string, unknown> }>(req);
    if (!b.project) throw new HttpError(400, "project: required");
    return json(await putHealth(x, c, b.project, b.data ?? {}));
  }
  if (p === "/digest" && m === "GET") return json(await digest(x, c, Number(q.get("hours") ?? 24)));

  // workspace administration
  if (p === "/settings" && m === "POST") {
    const b = await body<{ paused?: boolean }>(req);
    if (typeof b.paused === "boolean") await setPaused(x, c, b.paused);
    return json({ ok: true });
  }
  if (p === "/members" && m === "GET") return json(await listMembers(x, c));
  mm = p.match(/^\/members\/([0-9a-f-]{36})$/);
  if (mm && m === "PATCH") { await setMemberRole(x, c, mm[1], String((await body(req)).role) as MemberRole); return json(await listMembers(x, c)); }
  if (mm && m === "DELETE") { await removeMember(x, c, mm[1]); return json({ ok: true }); }
  if (p === "/invites" && m === "POST") {
    const b = await body<{ role?: MemberRole; days?: number }>(req);
    return json(await createInvite(x, c, b.role ?? "approver", b.days ?? 7), 201);
  }
  if (p === "/tokens" && m === "GET") return json(await listTokens(x, c));
  if (p === "/tokens" && m === "POST") {
    const b = await body<{ name: string; role: "runner" | "agent" }>(req);
    return json(await createToken(x, c, b.name, b.role), 201);
  }
  mm = p.match(/^\/tokens\/([\w-]+)$/);
  if (mm && m === "DELETE") { await revokeToken(x, c, mm[1]); return json({ ok: true }); }
  if (p === "/audit" && m === "GET") return json(await auditLog(x, c, Number(q.get("limit") ?? 100)));

  return json({ error: "not found" }, 404);
}
