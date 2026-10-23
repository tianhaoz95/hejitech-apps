// The private podcast feed (PRD §7.3 fallback): every published card's audio as episodes, in card
// order, for a native podcast player that keeps playing with the phone locked. The feed token is
// in the URL because podcast apps can't send headers; it reads only this user's editions and is
// revoked from the web app like a device.
import { episodes, type Bundle } from "@g2digest/core";
import { BUCKET, resolveDevice, type Db, type Env } from "./store.ts";

const EDITIONS_IN_FEED = 14;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/x-m4a", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg" };

export async function podcastFeed(_req: Request, env: Env, db: Db, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/feed\/(g2f_[A-Za-z0-9_-]+)\/(podcast\.xml|audio\/(\d{4}-\d{2}-\d{2}\/[a-z0-9-]+\.[a-z0-9]+))$/);
  if (!m) return new Response("Not found", { status: 404 });
  const feed = await resolveDevice(db, m[1]);
  if (!feed || feed.kind !== "feed") return new Response("This feed was turned off. Make a new one in G2 Digest.", { status: 403 });

  if (m[3]) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(`${feed.userId}/${m[3]}`, 3600);
    return data?.signedUrl ? Response.redirect(data.signedUrl, 302) : new Response("Not found", { status: 404 });
  }

  const { data: rows } = await db.from("editions").select("date, title, bundle, published_at").eq("user_id", feed.userId).order("date", { ascending: false }).limit(EDITIONS_IN_FEED);
  const base = `${env.PUBLIC_URL}/feed/${m[1]}`;
  const items: string[] = [];
  for (const e of rows ?? []) {
    const b = e.bundle as Bundle;
    const t0 = Date.parse(e.published_at as string);
    for (const ep of episodes(b)) {
      const c = b.cards[ep.card_index];
      const kind = ep.kind === "glance" ? "glance" : "deep dive";
      const ext = ep.audio_path.split(".").pop() ?? "mp3";
      const label = c.kind === "section" ? `${b.edition.sections.find((s) => s.section_id === c.section_id)?.title ?? ""}: ${c.title}` : c.title;
      items.push(`<item>
  <title>${esc(`${e.date} · ${ep.n}. ${label} (${kind})`)}</title>
  <guid isPermaLink="false">${esc(`${e.date}-${c.slug}-${kind.replace(" ", "-")}`)}</guid>
  <pubDate>${new Date(t0 + ep.n * 1000).toUTCString()}</pubDate>
  <description>${esc(c.body)}</description>
  <enclosure url="${esc(`${base}/audio/${ep.audio_path}`)}" type="${MIME[ext] ?? "audio/mpeg"}" length="0"/>
  <itunes:duration>${Math.round(ep.duration_sec)}</itunes:duration>
  <itunes:episode>${ep.n}</itunes:episode>
</item>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>G2 Digest (private)</title>
  <link>${esc(env.PUBLIC_URL)}</link>
  <description>Your G2 Digest audio, card by card. Private to you.</description>
  <language>en</language>
  <itunes:type>serial</itunes:type>
  <itunes:block>Yes</itunes:block>
  <itunes:explicit>false</itunes:explicit>
${items.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
