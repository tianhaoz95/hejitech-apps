// The site's API (/api/*) for the web app. Same service layer as MCP; changes made here are
// attributed to "Web". Artifacts anyone with the link can view are readable without signing in.
import { bytesToBase64, isTextType, unifiedDiff, zip } from "@folio/core";
import { renderBase } from "./render.ts";
import {
  acceptInvite,
  access,
  activityAcross,
  addComment,
  createArtifact,
  createInvite,
  deleteAccountData,
  deleteArtifact,
  diffVersions,
  editArtifact,
  FolioError,
  forkArtifact,
  getSuggestion,
  listArtifacts,
  listComments,
  listEvents,
  listSharing,
  listSuggestions,
  listVersions,
  loadVersion,
  previewInvite,
  readBytes,
  readFile,
  removeMember,
  resolveComment,
  restoreVersion,
  reviewSuggestion,
  reviseSuggestion,
  revokeInvite,
  setMemberRole,
  suggestEdit,
  updateArtifact,
  versionFiles,
  webActor,
} from "./service.ts";
import { admin, json, PREFIX, randomToken, sha256, supabaseUser, type Env } from "./store.ts";
import { SERVER_VERSION, TOOLS } from "./mcp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) => json(body, status, { ...cors, ...extra });

async function body(req: Request): Promise<Record<string, unknown>> {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    return await route(req, env, url);
  } catch (e) {
    if (e instanceof FolioError) return reply({ error: e.message, code: e.code, ...e.extra }, e.status);
    console.error("api failed", url.pathname, e);
    return reply({ error: "Something went wrong on our side. Try again." }, 500);
  }
}

async function route(req: Request, env: Env, url: URL): Promise<Response> {
  const db = admin(env);
  const path = url.pathname;
  const method = req.method;

  if (path === "/api/status" && method === "GET") {
    return reply({ service: "folio", version: SERVER_VERSION, mcp: `${env.PUBLIC_URL}/mcp`, tools: TOOLS.map((t) => t.name) });
  }

  const user = await supabaseUser(env, req);
  const actor = webActor(user?.id ?? null);
  const need = () => {
    if (!user) throw new FolioError(401, "sign_in", "Sign in first.");
    return user;
  };

  // ---------------------------------------------------------------- invites (token in the body)
  if (path === "/api/invites/preview" && method === "POST") {
    return reply(await previewInvite(db, String((await body(req)).token ?? "")));
  }
  if (path === "/api/invites/accept" && method === "POST") {
    need();
    return reply(await acceptInvite(db, actor, String((await body(req)).token ?? "")));
  }

  // ---------------------------------------------------------------- artifacts
  if (path === "/api/me" && method === "GET") {
    const u = need();
    return reply({ id: u.id, email: u.email ?? null });
  }
  if (path === "/api/artifacts" && method === "GET") {
    need();
    return reply(await listArtifacts(db, actor.userId!, url.searchParams.get("q") ?? undefined, 500));
  }
  if (path === "/api/artifacts" && method === "POST") {
    need();
    const b = await body(req);
    const { a, version } = await createArtifact(db, actor, { title: b.title, description: b.description, files: b.files, message: b.message, visibility: b.visibility });
    return reply({ slug: a.slug, id: a.id, version }, 201);
  }
  if (path === "/api/activity" && method === "GET") {
    need();
    return reply(await activityAcross(db, actor.userId!, url.searchParams.get("since") ?? undefined, 100));
  }

  const m = path.match(/^\/api\/artifacts\/([^/]+)(\/.*)?$/);
  if (m) {
    const ref = decodeURIComponent(m[1]);
    const sub = m[2] ?? "";
    const num = (k: string) => (url.searchParams.get(k) ? Number(url.searchParams.get(k)) : undefined);

    if (sub === "" && method === "GET") {
      const { a, role } = await access(db, actor, ref, "read");
      const v = await loadVersion(db, a, a.head_version);
      const [files, sugg, comments] = await Promise.all([
        versionFiles(db, a, v, { content: false }),
        listSuggestions(db, actor, a.id, "open"),
        listComments(db, actor, a.id),
      ]);
      return reply({
        artifact: { ...a, owner_id: undefined },
        role,
        signed_in: !!user,
        is_owner: role === "owner",
        head: { number: v.number, message: v.message, agent: v.agent, model: v.model, kind: v.kind, created_at: v.created_at },
        files,
        open_suggestions: sugg.suggestions.length,
        unresolved_comments: comments.comments.length,
        mcp_url: `${env.PUBLIC_URL}/mcp`,
      });
    }
    if (sub === "" && method === "PATCH") {
      need();
      return reply(await updateArtifact(db, actor, ref, await body(req)));
    }
    if (sub === "" && method === "DELETE") {
      need();
      return reply(await deleteArtifact(db, actor, ref));
    }
    if (sub === "/render" && method === "GET") {
      const { a } = await access(db, actor, ref, "read");
      const s = num("suggestion");
      const v = s ? null : await loadVersion(db, a, num("version") ?? null);
      return reply({ url: await renderBase(env, a, s ? (`s${s}` as const) : v!.number) });
    }
    if (sub === "/versions" && method === "GET") {
      const r = await listVersions(db, actor, ref, num("limit") ?? 200);
      return reply(r.versions);
    }
    const vm = sub.match(/^\/versions\/(\d+)$/);
    if (vm && method === "GET") {
      const { a } = await access(db, actor, ref, "read");
      const v = await loadVersion(db, a, Number(vm[1]));
      const { manifest, ...meta } = v;
      return reply({ ...meta, files: await versionFiles(db, a, v, { content: false }), file_count: Object.keys(manifest).length });
    }
    if (sub === "/file" && method === "GET") {
      const r = await readFile(db, actor, ref, { path: url.searchParams.get("path"), version: num("version") });
      return reply({ path: r.path, version: r.version, type: r.type, size: r.size, content: r.content });
    }
    if (sub === "/diff" && method === "GET") {
      const r = await diffVersions(db, actor, ref, num("from"), num("to"));
      return reply({ from: r.from, to: r.to, files: r.files, unified: unifiedDiff(r.files, { a: `v${r.from}`, b: `v${r.to}` }) });
    }
    if (sub === "/edits" && method === "POST") {
      need();
      const b = await body(req);
      const r = await editArtifact(db, actor, ref, { base_version: b.base_version, ops: b.ops, message: b.message });
      return reply({ version: r.version, changed: r.changed, rebased_from: r.rebased_from ?? null });
    }
    if (sub === "/restore" && method === "POST") {
      need();
      const b = await body(req);
      return reply(await restoreVersion(db, actor, ref, b.version, b.message).then((r) => ({ version: r.version })));
    }
    if (sub === "/fork" && method === "POST") {
      need();
      const b = await body(req);
      const r = await forkArtifact(db, actor, ref, { title: b.title, version: b.version });
      return reply({ slug: r.a.slug, version: r.version }, 201);
    }
    if (sub === "/export.zip" && method === "GET") {
      const { a } = await access(db, actor, ref, "read");
      const v = await loadVersion(db, a, num("version") ?? null);
      const entries = await Promise.all(
        Object.entries(v.manifest).map(async ([p, f]) => ({ path: p, data: await readBytes(db, a.id, f.hash, f.type), date: new Date(v.created_at) }))
      );
      const name = `${a.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || a.slug}-v${v.number}.zip`;
      return new Response(zip(entries) as BodyInit, {
        headers: { ...cors, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
      });
    }
    if (sub === "/bundle" && method === "GET") {
      // Every file of a version in one response (text inline, bytes as base64): the web editor's source view.
      const { a } = await access(db, actor, ref, "read");
      const v = await loadVersion(db, a, num("version") ?? null);
      const files = await versionFiles(db, a, v, { content: true, budget: 5_000_000 });
      for (const f of files) if (!f.text && f.size < 2_000_000) (f as unknown as Record<string, unknown>).base64 = bytesToBase64(await readBytes(db, a.id, f.hash, f.type));
      return reply({ version: v.number, files: files.map((f) => ({ ...f, text: isTextType(f.type) })) });
    }

    // suggestions
    if (sub === "/suggestions" && method === "GET") {
      return reply((await listSuggestions(db, actor, ref, url.searchParams.get("status") ?? "all")).suggestions);
    }
    if (sub === "/suggestions" && method === "POST") {
      need();
      const b = await body(req);
      const r = await suggestEdit(db, actor, ref, { base_version: b.base_version, ops: b.ops, title: b.title, rationale: b.rationale });
      return reply({ number: r.suggestion.number }, 201);
    }
    const sm = sub.match(/^\/suggestions\/(\d+)(\/review)?$/);
    if (sm && !sm[2] && method === "GET") {
      const r = await getSuggestion(db, actor, ref, Number(sm[1]));
      return reply({ suggestion: r.suggestion, files: r.files, applies_to_head: r.applies_to_head, head_version: r.a.head_version });
    }
    if (sm && !sm[2] && method === "PATCH") {
      need();
      const r = await reviseSuggestion(db, actor, ref, Number(sm[1]), await body(req));
      return reply({ number: r.suggestion.number });
    }
    if (sm && sm[2] && method === "POST") {
      need();
      const b = await body(req);
      const r = await reviewSuggestion(db, actor, ref, Number(sm[1]), b.decision, b.note);
      return reply({ status: r.suggestion.status, version: r.version ?? null });
    }

    // comments
    if (sub === "/comments" && method === "GET") {
      return reply((await listComments(db, actor, ref, { include_resolved: url.searchParams.get("resolved") === "1", suggestion: url.searchParams.get("suggestion") ?? undefined })).comments);
    }
    if (sub === "/comments" && method === "POST") {
      need();
      const r = await addComment(db, actor, ref, (await body(req)) as { body: unknown });
      return reply(r.comment, 201);
    }
    const cm = sub.match(/^\/comments\/([0-9a-f-]{36})\/resolve$/);
    if (cm && method === "POST") {
      need();
      const b = await body(req);
      return reply(await resolveComment(db, actor, ref, cm[1], b.resolved !== false).then((r) => ({ id: r.id, resolved: r.resolved })));
    }

    // activity
    if (sub === "/events" && method === "GET") {
      const r = await listEvents(db, actor, ref, num("after") ?? 0, 100);
      return reply({ head_version: r.a.head_version, events: r.events });
    }

    // sharing
    if (sub === "/sharing" && method === "GET") {
      need();
      const r = await listSharing(db, actor, ref);
      return reply({ owner: r.owner, members: r.members, invites: r.invites, visibility: r.a.visibility });
    }
    if (sub === "/invites" && method === "POST") {
      need();
      const b = await body(req);
      const r = await createInvite(db, actor, ref, b.role, b.expires_in_days);
      return reply({ url: `${env.PUBLIC_URL}/invite/#${r.token}`, role: r.role, expires_at: r.expires_at }, 201);
    }
    const im = sub.match(/^\/invites\/([0-9a-f-]{36})$/);
    if (im && method === "DELETE") {
      need();
      return reply(await revokeInvite(db, actor, ref, im[1]));
    }
    const mm = sub.match(/^\/members\/([0-9a-f-]{36})$/);
    if (mm && method === "DELETE") {
      need();
      return reply(await removeMember(db, actor, ref, mm[1]));
    }
    if (mm && method === "PATCH") {
      need();
      return reply(await setMemberRole(db, actor, ref, mm[1], (await body(req)).role));
    }
  }

  // ---------------------------------------------------------------- agent tokens (MCP)
  if (path === "/api/tokens" && method === "GET") {
    need();
    const { data } = await db.from("access_tokens").select("id, name, created_at, last_used_at").eq("user_id", actor.userId!).order("created_at");
    return reply(data ?? []);
  }
  if (path === "/api/tokens" && method === "POST") {
    need();
    const b = await body(req);
    const token = randomToken(PREFIX.agent);
    const { data, error } = await db
      .from("access_tokens")
      .insert({ token_hash: await sha256(token), user_id: actor.userId, name: String(b.name ?? "Agent").trim().slice(0, 60) || "Agent" })
      .select("id")
      .single();
    if (error) throw new FolioError(500, "database", error.message);
    return reply({ id: data.id, token }, 201);
  }
  const tok = path.match(/^\/api\/tokens\/([0-9a-f-]{36})$/);
  if (tok && method === "DELETE") {
    need();
    await db.from("access_tokens").delete().eq("user_id", actor.userId!).eq("id", tok[1]);
    return reply({ ok: true });
  }

  // ---------------------------------------------------------------- delete everything Folio keeps
  if (path === "/api/account" && method === "DELETE") {
    need();
    await deleteAccountData(db, actor.userId!);
    return reply({ ok: true });
  }

  return reply({ error: "not found" }, 404);
}
