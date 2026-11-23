// The private podcast feed (PRD §7.3 fallback): every published card's audio as episodes, in card
// order, for a native podcast player that keeps playing with the phone locked. Supports:
//   /feed/<token>/podcast.xml      all audio (glance + deep dive), or ?filter=glance|deep_dive
//   /feed/<token>/glance.xml       glance audio only
//   /feed/<token>/deep-dive.xml    deep dive audio only
// Real enclosure byte lengths come from g2digest.audio_meta (populated on upload).
import { episodes, type Bundle } from "@g2digest/core";
import { proStatus } from "./billing.ts";
import { BUCKET, promoteDueEditions, resolveDevice, type Db, type Env } from "./store.ts";

const EDITIONS_IN_FEED = 14;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/x-m4a", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg" };

export async function podcastFeed(_req: Request, env: Env, db: Db, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/feed\/(g2f_[A-Za-z0-9_-]+)\/(podcast\.xml|glance\.xml|deep-dive\.xml|audio\/(\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.[a-z0-9]+))$/);
  if (!m) return new Response("Not found", { status: 404 });
  const feed = await resolveDevice(db, m[1]);
  if (!feed || feed.kind !== "feed") return new Response("This feed was turned off. Make a new one in G2 Digest.", { status: 403 });
  // The podcast feed is part of G2 Digest Pro, like the web app and the glasses (billing.ts).
  const email = (await db.auth.admin.getUserById(feed.userId).catch(() => null))?.data.user?.email;
  if (!(await proStatus(db, feed.userId, email)).pro) {
    return new Response(`This feed needs G2 Digest Pro. Start a free week in the app or at ${env.PUBLIC_URL}/pro/`, { status: 402 });
  }

  if (m[3]) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(`${feed.userId}/${m[3]}`, 3600);
    return data?.signedUrl ? Response.redirect(data.signedUrl, 302) : new Response("Not found", { status: 404 });
  }

  await promoteDueEditions(db, feed.userId).catch(() => undefined);
  const pathFilter = m[2] === "glance.xml" ? "glance" : m[2] === "deep-dive.xml" ? "deep_dive" : null;
  const queryFilter = url.searchParams.get("filter");
  const filter = pathFilter ?? (queryFilter === "glance" || queryFilter === "deep_dive" ? queryFilter : null);

  const [{ data: rows }, { data: metaRows }] = await Promise.all([
    db.from("editions").select("date, title, bundle, published_at").eq("user_id", feed.userId).eq("status", "published").order("date", { ascending: false }).limit(EDITIONS_IN_FEED),
    db.from("audio_meta").select("audio_path, bytes").eq("user_id", feed.userId),
  ]);
  const sizes = new Map<string, number>();
  for (const row of (metaRows ?? []) as { audio_path: string; bytes: number }[]) sizes.set(row.audio_path, row.bytes);

  const base = `${env.PUBLIC_URL}/feed/${m[1]}`;
  const items: string[] = [];
  for (const e of rows ?? []) {
    const b = e.bundle as Bundle;
    const t0 = Date.parse(e.published_at as string);
    for (const ep of episodes(b)) {
      if (filter && ep.kind !== filter) continue;
      const c = b.cards[ep.card_index];
      const kind = ep.kind === "glance" ? "glance" : "deep dive";
      const ext = ep.audio_path.split(".").pop() ?? "mp3";
      const label = c.kind === "section" ? `${b.edition.sections.find((s) => s.section_id === c.section_id)?.title ?? ""}: ${c.title}` : c.title;
      const byteLength = sizes.get(ep.audio_path) ?? Math.max(0, Math.round(ep.duration_sec * 16000));
      items.push(`<item>
  <title>${esc(`${e.date} · ${ep.n}. ${label} (${kind})`)}</title>
  <guid isPermaLink="false">${esc(`${e.date}-${c.slug}-${kind.replace(" ", "-")}`)}</guid>
  <pubDate>${new Date(t0 + ep.n * 1000).toUTCString()}</pubDate>
  <description>${esc(c.body)}</description>
  <enclosure url="${esc(`${base}/audio/${ep.audio_path}`)}" type="${MIME[ext] ?? "audio/mpeg"}" length="${byteLength}"/>
  <itunes:duration>${Math.round(ep.duration_sec)}</itunes:duration>
  <itunes:episode>${ep.n}</itunes:episode>
</item>`);
    }
  }
  const suffix = filter === "glance" ? " · Glances" : filter === "deep_dive" ? " · Deep Dives" : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>${esc(`G2 Digest (private)${suffix}`)}</title>
  <link>${esc(env.PUBLIC_URL)}</link>
  <description>Your G2 Digest audio, card by card. Private to you.</description>
  <language>en</language>
  <itunes:image href="${esc(`${env.PUBLIC_URL}/icon.png`)}"/>
  <itunes:type>serial</itunes:type>
  <itunes:block>Yes</itunes:block>
  <itunes:explicit>false</itunes:explicit>
${items.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
