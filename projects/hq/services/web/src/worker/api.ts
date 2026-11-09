// REST API for the portal (owner), the iOS app (owner) and runners (`hq_run_` tokens).
// Agents use the MCP server instead; the few routes they may also call are marked.
import { REJECT_REASONS, type Evidence, type Status } from "@hq/core";
import {
  attachEvidence, auditLog, cardDetail, claimRun, comment, createProposal, createToken, decide, digest, finishRun,
  getContext, getPolicy, getRun, healthBoard, HttpError, inbox, listCards, listRuns, listTokens, putHealth, requestVerb,
  revokeToken, schedule, setSetting, setStatus, syncPolicy, withdraw, enqueueRun, audit, now,
  type Caller, type Env,
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

const need = (caller: Caller, ...roles: Caller["role"][]) => {
  if (!roles.includes(caller.role)) throw new HttpError(403, `needs a ${roles.join(" or ")} token`);
};

const MAX_FILE = 10 * 1024 * 1024;

export async function handleApi(req: Request, env: Env, url: URL, caller: Caller | null): Promise<Response> {
  const p = url.pathname.replace(/\/+$/, "");
  const m = req.method;
  try {
    if (p === "/api/health-check") return json({ ok: true, service: "hq" });
    if (!caller) return json({ error: "sign in required: send Authorization: Bearer <token>" }, 401);

    if (p === "/api/me" && m === "GET") return json({ role: caller.role, name: caller.name });

    // ── policy & context
    if (p === "/api/config" && m === "GET") return json(await getPolicy(env));
    if (p === "/api/config" && m === "PUT") {
      need(caller, "owner", "runner");
      const b = await body<{ policy: never; commit?: string }>(req);
      await syncPolicy(env, caller, b.policy, b.commit ?? null);
      return json({ ok: true });
    }
    if (p === "/api/context" && m === "GET") return json(await getContext(env, url.searchParams.get("project")));

    // ── cards
    if (p === "/api/inbox" && m === "GET") { need(caller, "owner"); return json({ ...(await inbox(env)), reject_reasons: REJECT_REASONS }); }
    if (p === "/api/cards" && m === "GET") {
      const status = url.searchParams.get("status")?.split(",").filter(Boolean);
      return json(await listCards(env, { status, project: url.searchParams.get("project") ?? undefined, limit: Number(url.searchParams.get("limit") ?? 100) }));
    }
    if (p === "/api/cards" && m === "POST") return json(await createProposal(env, caller, await body(req)), 201);
    let mm = p.match(/^\/api\/cards\/([\w-]+)$/);
    if (mm && m === "GET") return json(await cardDetail(env, mm[1]));
    mm = p.match(/^\/api\/cards\/([\w-]+)\/decision$/);
    if (mm && m === "POST") {
      need(caller, "owner");
      const b = await body<{ decision: string; reason?: string }>(req);
      if (b.decision !== "approved" && b.decision !== "rejected") throw new HttpError(400, "decision: approved or rejected");
      await decide(env, caller, mm[1], b.decision, b.reason?.trim() || null);
      return json(await cardDetail(env, mm[1]));
    }
    mm = p.match(/^\/api\/cards\/([\w-]+)\/comments$/);
    if (mm && m === "POST") return json(await comment(env, caller, mm[1], String((await body(req)).body ?? "")));
    mm = p.match(/^\/api\/cards\/([\w-]+)\/status$/);
    if (mm && m === "POST") {
      const b = await body<{ status: Status; branch?: string; pr_url?: string; reason?: string }>(req);
      if (b.status === "withdrawn") return json(await withdraw(env, caller, mm[1], b.reason ?? ""));
      await setStatus(env, caller, mm[1], b.status, { branch: b.branch, pr_url: b.pr_url });
      if (caller.role === "owner" && b.status === "approved") {
        // Sent back for another build ("do it again" from in_review or failed).
        const card = (await cardDetail(env, mm[1])).card;
        await enqueueRun(env, { kind: "build", card_id: card.id, project: card.project, requested_by: "owner" });
      }
      if (caller.role === "owner" && b.status === "shipped") await audit(env, caller, "card.ship", mm[1]);
      return json(await cardDetail(env, mm[1]));
    }
    mm = p.match(/^\/api\/cards\/([\w-]+)\/evidence$/);
    if (mm && m === "POST") {
      const b = await body<{ phase?: string; evidence: Evidence }>(req);
      return json(await attachEvidence(env, caller, mm[1], b.phase ?? "build", b.evidence));
    }
    mm = p.match(/^\/api\/cards\/([\w-]+)\/files$/);
    if (mm && m === "POST") {
      need(caller, "runner", "agent", "owner");
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_FILE) throw new HttpError(413, "files up to 10 MB");
      const name = (url.searchParams.get("name") ?? "file").replace(/[^\w.-]/g, "_").slice(0, 80);
      const type = req.headers.get("content-type") ?? "application/octet-stream";
      const data = await req.arrayBuffer();
      if (data.byteLength > MAX_FILE) throw new HttpError(413, "files up to 10 MB");
      const key = `cards/${mm[1]}/${now().replace(/[:.]/g, "")}-${name}`;
      await env.FILES.put(key, data, { httpMetadata: { contentType: type } });
      const kind = type.startsWith("image/") ? "screenshot" : "file";
      await attachEvidence(env, caller, mm[1], url.searchParams.get("phase") ?? "build", { type: kind, ref: key, text: url.searchParams.get("caption") ?? name }, key);
      return json({ key }, 201);
    }
    mm = p.match(/^\/api\/files\/(.+)$/);
    if (mm && m === "GET") {
      const obj = await env.FILES.get(decodeURIComponent(mm[1]));
      if (!obj) throw new HttpError(404, "no such file");
      return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
    }

    // ── verbs (owner from the portal; agents use hq.run_verb)
    if (p === "/api/verbs" && m === "POST") {
      const b = await body<{ project: string; verb: string; dry_run?: boolean; card_id?: string }>(req);
      return json(await requestVerb(env, caller, b.project, b.verb, b.dry_run !== false ? !!b.dry_run : false, b.card_id ?? null), 202);
    }

    // ── runs (runner)
    if (p === "/api/runs" && m === "GET") return json(await listRuns(env, Number(url.searchParams.get("limit") ?? 50)));
    if (p === "/api/runs" && m === "POST") {
      need(caller, "owner");
      const b = await body<{ kind: string; scout?: string; project?: string }>(req);
      if (!["scout", "ceo", "health"].includes(b.kind)) throw new HttpError(400, "kind: scout, ceo or health");
      if (b.kind === "scout" && !b.scout) throw new HttpError(400, "scout: required");
      const policy = (await getPolicy(env))?.policy;
      const agent = b.kind === "ceo" ? policy?.agents.ceo : b.kind === "scout" ? policy?.agents.scout : null;
      const id = await enqueueRun(env, { kind: b.kind, scout: b.scout ?? null, project: b.project ?? (b.kind === "scout" ? "repo-wide" : null), agent, requested_by: "owner", args: { card_limit: 3 } });
      return json({ run_id: id }, 202);
    }
    mm = p.match(/^\/api\/runs\/([\w-]+)$/);
    if (mm && m === "GET") return json(await getRun(env, mm[1]));
    if (p === "/api/runs/claim" && m === "POST") {
      need(caller, "runner", "owner");
      const b = await body<{ runner?: string; capabilities?: string[] }>(req);
      return json(await claimRun(env, caller, b.runner ?? caller.name, b.capabilities ?? ["any"]));
    }
    mm = p.match(/^\/api\/runs\/([\w-]+)\/finish$/);
    if (mm && m === "POST") {
      need(caller, "runner", "owner");
      return json(await finishRun(env, caller, mm[1], await body(req)));
    }
    if (p === "/api/schedule" && m === "POST") { need(caller, "owner", "runner"); return json(await schedule(env)); }

    // ── health & digest
    if (p === "/api/health" && m === "GET") return json(await healthBoard(env));
    if (p === "/api/health" && m === "PUT") {
      const b = await body<{ project: string; data: Record<string, unknown> }>(req);
      if (!b.project) throw new HttpError(400, "project: required");
      return json(await putHealth(env, caller, b.project, b.data ?? {}));
    }
    if (p === "/api/digest" && m === "GET") return json(await digest(env, Number(url.searchParams.get("hours") ?? 24)));

    // ── owner controls
    if (p === "/api/settings" && m === "POST") {
      need(caller, "owner");
      const b = await body<{ paused?: boolean }>(req);
      if (typeof b.paused === "boolean") await setSetting(env, caller, "paused", b.paused ? "1" : "0");
      return json({ ok: true });
    }
    if (p === "/api/tokens" && m === "GET") { need(caller, "owner"); return json(await listTokens(env)); }
    if (p === "/api/tokens" && m === "POST") {
      const b = await body<{ name: string; role: "runner" | "agent" }>(req);
      return json(await createToken(env, caller, b.name, b.role), 201);
    }
    mm = p.match(/^\/api\/tokens\/([\w-]+)$/);
    if (mm && m === "DELETE") { await revokeToken(env, caller, mm[1]); return json({ ok: true }); }
    if (p === "/api/audit" && m === "GET") { need(caller, "owner"); return json(await auditLog(env, Number(url.searchParams.get("limit") ?? 100))); }

    return json({ error: "not found" }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
    console.error(e);
    return json({ error: "internal error" }, 500);
  }
}
