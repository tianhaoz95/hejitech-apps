// Apple Push Notification service for the iPhone app: "your new edition is ready" when an agent
// publishes one. Token auth with an ES256 JWT signed by the team's APNs key (WebCrypto, no
// dependency), cached for 50 minutes as Apple asks. Each device row says which APNs host it uses
// (Debug builds: sandbox). Unconfigured (no APNS_* secrets, e.g. locally), nothing is sent.
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

/** What the notification says for a published edition. */
export function editionNotice(e: { date: string; title: string; cards: number }): { title: string; body: string } {
  return { title: e.title || "Your edition is ready", body: `${e.cards} cards for ${e.date}. Open G2 Digest to read or listen.` };
}

/** Tells every iPhone of the user about a newly published edition; drops tokens Apple says are dead. */
export async function notifyEdition(env: Env, db: Db, userId: string, e: { date: string; title: string; cards: number }): Promise<number> {
  if (!pushConfigured(env)) return 0;
  const { data } = await db.from("push_devices").select("apns_token, environment").eq("user_id", userId);
  const n = editionNotice(e);
  let sent = 0;
  for (const d of (data ?? []) as { apns_token: string; environment: "production" | "sandbox" }[]) {
    const res = await fetch(`${HOST[d.environment]}/3/device/${d.apns_token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await token(env)}`,
        "apns-topic": env.APNS_TOPIC || "com.hejitech.g2digest",
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-collapse-id": `edition-${e.date}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ aps: { alert: n, sound: "default", "thread-id": "editions" }, date: e.date }),
    }).catch(() => null);
    if (res?.ok) {
      sent++;
      await db.from("push_devices").update({ last_sent_at: new Date().toISOString() }).eq("apns_token", d.apns_token);
      continue;
    }
    const reason = res ? ((await res.json().catch(() => ({}))) as { reason?: string }).reason : undefined;
    if (res && (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered")) {
      await db.from("push_devices").delete().eq("apns_token", d.apns_token);
    }
  }
  return sent;
}
