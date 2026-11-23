// Link previews. When someone pastes a Folio link in Slack, iMessage, Discord or a doc, the unfurl
// shows what the artifact is: its title, description and a picture of the page itself.
//
// Only artifacts anyone with the link can view (visibility "link") say anything: a private
// artifact's /a/ page gets Folio's generic card, so a pasted private link never leaks a title.
// The picture is a 1200×630 screenshot of the current version, taken with Cloudflare Browser
// Rendering (the BROWSER binding) the first time it's asked for and kept in the bucket at
// <artifact>/og-v<n>.png, so each version is drawn once. Without the binding, or when drawing
// fails, it's the plain Folio card (public/og.png).
import puppeteer from "@cloudflare/puppeteer";
import { SLUG_RE } from "@folio/core";
import { renderBase } from "./render.ts";
import type { ArtifactRow } from "./service.ts";
import { BUCKET, type Db, type Env } from "./store.ts";

const W = 1200;
const H = 630;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function linkArtifact(db: Db, slug: string): Promise<ArtifactRow | null> {
  if (!SLUG_RE.test(slug)) return null;
  const { data } = await db.from("artifacts").select("id, slug, title, description, visibility, head_version, updated_at").eq("slug", slug).maybeSingle();
  return data && data.visibility === "link" ? (data as ArtifactRow) : null;
}

/** The <meta> tags for an /a/<slug> page (generic for anything not shared by link). */
export async function previewTags(env: Env, db: Db, slug: string): Promise<string> {
  const a = await linkArtifact(db, slug).catch(() => null);
  const title = a ? a.title : "An artifact on Folio";
  const description = a
    ? a.description || `An artifact on Folio, version ${a.head_version}. Open it to see the page, its history, suggestions and comments.`
    : "Artifacts every AI agent can share: one page, its full history, and the agents that worked on it.";
  const image = a ? `${env.PUBLIC_URL}/og/${a.slug}/${a.head_version}.png` : `${env.PUBLIC_URL}/og.png`;
  const url = a ? `${env.PUBLIC_URL}/a/${a.slug}` : env.PUBLIC_URL;
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Folio">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description.slice(0, 300))}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="${W}">`,
    `<meta property="og:image:height" content="${H}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description.slice(0, 200))}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<meta name="description" content="${esc(description.slice(0, 300))}">`,
  ].join("\n    ");
}

/** Adds the preview tags to the /a/ page's <head> (and its title for link artifacts). */
export async function withPreview(env: Env, db: Db, slug: string, res: Response): Promise<Response> {
  if (!(res.headers.get("Content-Type") ?? "").includes("text/html")) return res;
  const tags = await previewTags(env, db, slug);
  const a = await linkArtifact(db, slug).catch(() => null);
  let rw = new HTMLRewriter().on("head", { element: (el) => void el.append(tags, { html: true }) });
  if (a) rw = rw.on("title", { element: (el) => void el.setInnerContent(`${a.title} · Folio`) });
  return rw.transform(res);
}

const png = (body: BodyInit, cache: string) => new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": cache } });

async function fallback(env: Env, req: Request): Promise<Response> {
  const u = new URL(req.url);
  u.pathname = "/og.png";
  const r = await env.ASSETS.fetch(new Request(u.toString()));
  return png(await r.arrayBuffer(), "public, max-age=600");
}

/** A screenshot of the page at 1200×630 (null when it can't be drawn). */
export async function screenshot(env: Env, url: string): Promise<Uint8Array | null> {
  if (!env.BROWSER) return null;
  const browser = await puppeteer.launch(env.BROWSER as never);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 8000 }).catch(() => undefined);
    // Charts and fonts settle a moment after the network goes quiet.
    await new Promise((r) => setTimeout(r, 400));
    return new Uint8Array((await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } })) as Uint8Array);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** GET /og/<slug>/<version>.png */
export async function handleOg(req: Request, env: Env, db: Db, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/og\/([^/]+)\/(\d+)\.png$/);
  const a = m ? await linkArtifact(db, m[1]).catch(() => null) : null;
  if (!a) return fallback(env, req);
  const version = Math.min(Number(m![2]) || a.head_version, a.head_version);
  const key = `${a.id}/og-v${version}.png`;
  const cached = await db.storage.from(BUCKET).download(key).catch(() => ({ data: null }));
  if (cached.data) return png(await cached.data.arrayBuffer(), "public, max-age=86400");
  try {
    const shot = await screenshot(env, `${await renderBase(env, a, version)}`);
    if (!shot) return fallback(env, req);
    await db.storage.from(BUCKET).upload(key, shot, { contentType: "image/png", upsert: true });
    return png(shot, "public, max-age=86400");
  } catch (e) {
    console.error("og screenshot failed", a.slug, e);
    return fallback(env, req);
  }
}
