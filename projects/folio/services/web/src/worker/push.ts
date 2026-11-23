// Apple Push Notification service for the iPhone app: an agent (or another person) suggested a
// change, commented, or saved a version. Token auth with an ES256 JWT signed by the team's APNs key
// (WebCrypto, no dependency), cached for 50 minutes as Apple asks. Each device row says which APNs
// host it uses (Debug builds: sandbox) and what its owner wants to hear about. Unconfigured (no
// APNS_* secrets), nothing is sent. Locally APNS_HOST points both hosts at a test receiver.
import type { Db, Env } from "./store.ts";

const HOST = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;
let cached: { jwt: string; at: number; kid: string } | null = null;

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function pkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\\n/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function pushConfigured(env: Env): boolean {
  return Boolean(env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY);
}

async function token(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.kid === env.APNS_KEY_ID && now - cached.at < 50 * 60) return cached.jwt;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.APNS_PRIVATE_KEY!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${head}.${claims}`));
  cached = { jwt: `${head}.${claims}.${b64url(sig)}`, at: now, kid: env.APNS_KEY_ID! };
  return cached.jwt;
}

/** The events that notify, and the device preference each one needs. */
const PREF: Record<string, "notify_suggestions" | "notify_comments" | "notify_edits"> = {
  suggested: "notify_suggestions",
  suggestion_revised: "notify_suggestions",
  commented: "notify_comments",
  edited: "notify_edits",
  restored: "notify_edits",
  suggestion_accepted: "notify_edits",
};

export interface PushEvent {
  /** The event's id in folio.events (webhook payloads carry it). */
  id?: number;
  artifactId: string;
  kind: string;
  summary: string;
  agent: string;
  via: "web" | "mcp" | "api";
  actorId: string | null;
  version?: number;
  suggestion_number?: number;
  comment_id?: string;
}

/** Notification text and the app's category (its buttons) for an event on an artifact. */
export function notice(e: PushEvent, title: string): { alert: { title: string; subtitle?: string; body: string }; category: string } | null {
  const t = title.length > 60 ? `${title.slice(0, 59)}…` : title;
  const text = e.summary.replace(/^#\d+\s*/, "");
  switch (e.kind) {
    case "suggested":
      return { alert: { title: `${e.agent} suggested a change`, subtitle: t, body: text }, category: "FOLIO_SUGGESTION" };
    case "suggestion_revised":
      return { alert: { title: `${e.agent} revised suggestion #${e.suggestion_number}`, subtitle: t, body: text }, category: "FOLIO_SUGGESTION" };
    case "commented":
      return { alert: { title: `${e.agent} commented`, subtitle: t, body: e.summary.replace(/^(Commented|Replied)[^:]*:\s*/, "") }, category: "FOLIO_COMMENT" };
    case "edited":
    case "restored":
    case "suggestion_accepted":
      return { alert: { title: `${e.agent} saved v${e.version}`, subtitle: t, body: e.summary.replace(/^v\d+:\s*/, "") }, category: "FOLIO_VERSION" };
  }
  return null;
}

/**
 * Notifies the artifact's owner and members about an event. Changes someone makes in the web or
 * iPhone app don't notify that person (they know); their agents' changes do, which is the point.
 * Never throws: a notification is never worth failing the change it reports.
 */
export async function notifyEvent(env: Env, db: Db, e: PushEvent): Promise<number> {
  const pref = PREF[e.kind];
  if (!pref || !pushConfigured(env)) return 0;
  try {
    const { data: a } = await db.from("artifacts").select("slug, title, owner_id").eq("id", e.artifactId).maybeSingle();
    if (!a) return 0;
    const { data: mem } = await db.from("members").select("user_id").eq("artifact_id", e.artifactId);
    let people = [a.owner_id as string, ...((mem ?? []) as { user_id: string }[]).map((m) => m.user_id)];
    if (e.via === "web" && e.actorId) people = people.filter((p) => p !== e.actorId);
    if (!people.length) return 0;
    const { data: devices } = await db.from("push_devices").select("apns_token, environment").in("user_id", [...new Set(people)]).eq(pref, true);
    const n = notice(e, a.title as string);
    if (!n || !devices?.length) return 0;
    const payload = {
      aps: { alert: n.alert, sound: "default", "thread-id": `artifact-${a.slug}`, category: n.category, "mutable-content": 0 },
      slug: a.slug,
      kind: e.kind,
      ...(e.version ? { version: e.version } : {}),
      ...(e.suggestion_number ? { suggestion: e.suggestion_number } : {}),
      ...(e.comment_id ? { comment: e.comment_id } : {}),
    };
    let sent = 0;
    await Promise.all(
      (devices as { apns_token: string; environment: "production" | "sandbox" }[]).map(async (d) => {
        const host = env.APNS_HOST || HOST[d.environment];
        const res = await fetch(`${host}/3/device/${d.apns_token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${await token(env)}`,
            "apns-topic": env.APNS_TOPIC || "com.hejitech.folio",
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        }).catch(() => null);
        if (res?.ok) {
          sent++;
          await db.from("push_devices").update({ last_sent_at: new Date().toISOString() }).eq("apns_token", d.apns_token);
          return;
        }
        const reason = res ? ((await res.json().catch(() => ({}))) as { reason?: string }).reason : undefined;
        if (res && (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered")) {
          await db.from("push_devices").delete().eq("apns_token", d.apns_token);
        }
      })
    );
    return sent;
  } catch (err) {
    console.error("push failed", err);
    return 0;
  }
}
