// Serving an artifact's files so they run as a page: /r/<slug>/<version>/<key>/<path>.
//
// Artifact HTML is untrusted (any agent wrote it), so every response carries a CSP `sandbox`
// directive without allow-same-origin: even opened directly, a page runs in an opaque origin and
// can't read Folio's session or call its API as the viewer. Relative links between the
// artifact's files keep working because they resolve under the same /r/… prefix.
//
// <version> is a number, or s<n> for suggestion #n applied to its base (previews before
// accepting). <key> is "p" for artifacts anyone with the link can view, else a signed,
// expiring token (`<exp>.<mac>`) handed out to people and agents who may read it.
import { contentTypeFor, entryFile, isTextType, SLUG_RE } from "@folio/core";
import { DATA_PATH } from "@folio/core";
import { dataRow, findArtifact, FolioError, loadTexts, loadVersion, readBytes, suggestionFiles, type ArtifactRow, type SuggestionRow } from "./service.ts";
import { withSelectHelper } from "./select-helper.ts";
import { b64url, sha256, type Db, type Env } from "./store.ts";

const TTL = 12 * 3600;

async function macKey(env: Env): Promise<CryptoKey> {
  const secret = env.RENDER_SECRET || `folio-render:${await sha256(env.SUPABASE_SERVICE_ROLE_KEY)}`;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function mac(env: Env, slug: string, exp: number): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await macKey(env), new TextEncoder().encode(`${slug}:${exp}`));
  return b64url(sig).slice(0, 27);
}

/** The base URL (ending in /) a reader can load this version (or suggestion preview) from. */
export async function renderBase(env: Env, a: Pick<ArtifactRow, "slug" | "visibility">, version: number | `s${number}`): Promise<string> {
  let key = "p";
  if (a.visibility !== "link") {
    const exp = Math.floor(Date.now() / 1000 / 3600) * 3600 + TTL; // hour-aligned so URLs cache well
    key = `${exp}.${await mac(env, a.slug, exp)}`;
  }
  return `${env.PUBLIC_URL}/r/${a.slug}/${version}/${key}/`;
}

async function keyOk(env: Env, a: ArtifactRow, key: string): Promise<boolean> {
  if (key === "p") return a.visibility === "link";
  const [expS, sig] = key.split(".");
  const exp = Number(expS);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !sig) return false;
  const want = await mac(env, a.slug, exp);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

const SANDBOX_CSP = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

function page(status: number, title: string, body: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:15px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f7f5;color:#333"><div style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:18px;margin:0 0 8px">${title}</h1><p style="margin:0;color:#666">${body}</p></div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": SANDBOX_CSP, "Cache-Control": "no-store" } }
  );
}

export async function handleRender(req: Request, env: Env, db: Db, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD" } });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  const m = url.pathname.match(/^\/r\/([^/]+)\/(s?\d+)\/([^/]+)(?:\/(.*))?$/);
  if (!m) return page(404, "Not found", "This link doesn't point to an artifact.");
  const [, slug, ver, key, rest] = m;
  if (!SLUG_RE.test(slug)) return page(404, "Not found", "This link doesn't point to an artifact.");
  if (rest === undefined) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301);
  let a: ArtifactRow;
  try {
    a = await findArtifact(db, slug);
  } catch {
    return page(404, "Not found", "This artifact doesn't exist or was deleted.");
  }
  if (!(await keyOk(env, a, key))) {
    return page(403, "Link expired", `Open it again from <a href="${env.PUBLIC_URL}/a/${a.slug}" target="_top">Folio</a> to get a fresh link.`);
  }
  let path: string;
  try {
    path = decodeURIComponent(rest);
  } catch {
    return page(400, "Bad link", "This file path isn't valid.");
  }

  // The artifact's live data (set_data): the same for every version, never cached.
  if (path === DATA_PATH) {
    const row = await dataRow(db, a.id);
    return new Response(req.method === "HEAD" ? null : JSON.stringify(row?.data ?? null), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Security-Policy": SANDBOX_CSP,
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        ...(row ? { "Last-Modified": new Date(row.updated_at).toUTCString() } : {}),
      },
    });
  }

  try {
    let body: Uint8Array;
    let type: string;
    let paths: string[];
    if (ver.startsWith("s")) {
      const { data } = await db.from("suggestions").select("*").eq("artifact_id", a.id).eq("number", Number(ver.slice(1))).maybeSingle();
      if (!data) return page(404, "Not found", "This suggestion doesn't exist.");
      const { files } = await suggestionFiles(db, a, data as SuggestionRow);
      paths = Object.keys(files);
      if (!path) path = entryFile(paths) ?? "";
      if (!files[path] && files[`${path}/index.html`]) path = `${path}/index.html`;
      const f = files[path];
      if (!f) return page(404, "No such file", `${escapeHtml(path)} isn't part of this artifact.`);
      type = f.type;
      if (f.text !== undefined) body = new TextEncoder().encode(f.text);
      else if (f.bytes) body = f.bytes;
      else if (f.hash) body = await readBytes(db, a.id, f.hash, f.type);
      else return page(404, "No such file", "This file has no contents.");
    } else {
      const v = await loadVersion(db, a, Number(ver));
      paths = Object.keys(v.manifest);
      if (!path) path = entryFile(paths) ?? "";
      if (!v.manifest[path] && v.manifest[`${path.replace(/\/$/, "")}/index.html`]) path = `${path.replace(/\/$/, "")}/index.html`;
      const f = v.manifest[path];
      if (!f) return page(404, "No such file", `${escapeHtml(path)} isn't part of this artifact.`);
      type = f.type;
      if (isTextType(f.type)) {
        const t = await loadTexts(db, a.id, [f.hash]);
        body = new TextEncoder().encode(t[f.hash] ?? "");
      } else body = await readBytes(db, a.id, f.hash, f.type);
    }
    // Framed by the workspace for commenting on a selection: add the helper (select-helper.ts).
    if (url.searchParams.get("folio") === "select" && (type || contentTypeFor(path)).startsWith("text/html")) {
      body = new TextEncoder().encode(withSelectHelper(new TextDecoder().decode(body), new URL(env.PUBLIC_URL).origin));
    }
    const headers = new Headers({
      "Content-Type": type || contentTypeFor(path),
      "Content-Security-Policy": SANDBOX_CSP,
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": ver.startsWith("s") ? "no-store" : key === "p" ? "public, max-age=300" : "private, max-age=3600",
    });
    return new Response(req.method === "HEAD" ? null : (body as BodyInit), { headers });
  } catch (e) {
    if (e instanceof FolioError) return page(e.status, "Can't open this", escapeHtml(e.message));
    throw e;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
