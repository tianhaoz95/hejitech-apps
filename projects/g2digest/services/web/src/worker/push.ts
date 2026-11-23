// Push notifications for G2 Digest:
// - APNs (iPhone): ES256 JWT signed by the team's APNs key (WebCrypto, no dependency), with rich
//   edition metadata (date, lead headline, alert count, category NEW_EDITION for deep-linking).
// - FCM HTTP v1 (Android): RS256 service-account JWT → Google OAuth access token → FCM messages:send.
// Unconfigured (no APNS_* / FCM_* secrets, e.g. locally), nothing is sent.
import type { Db, Env } from "./store.ts";

const HOST = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;
let cachedApns: { jwt: string; at: number; kid: string } | null = null;
let cachedFcm: { token: string; until: number; email: string } | null = null;

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

export function fcmConfigured(env: Env): boolean {
  return Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY);
}

async function apnsToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApns && cachedApns.kid === env.APNS_KEY_ID && now - cachedApns.at < 50 * 60) return cachedApns.jwt;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.APNS_PRIVATE_KEY!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${head}.${claims}`));
  cachedApns = { jwt: `${head}.${claims}.${b64url(sig)}`, at: now, kid: env.APNS_KEY_ID! };
  return cachedApns.jwt;
}

async function fcmAccessToken(env: Env): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcm && cachedFcm.email === env.FCM_CLIENT_EMAIL && cachedFcm.until > now + 60) return cachedFcm.token;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8(env.FCM_PRIVATE_KEY!),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: env.FCM_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${claims}.${b64url(sig)}`,
    }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;
  cachedFcm = { token: body.access_token, until: now + (body.expires_in ?? 3600), email: env.FCM_CLIENT_EMAIL! };
  return cachedFcm.token;
}

export interface EditionNotification {
  date: string;
  title: string;
  cards: number;
  lead_title?: string;
  alert_count?: number;
}

/** What the notification says for a published edition (rich preview with lead card + alert count). */
export function editionNotice(e: EditionNotification): { title: string; subtitle?: string; body: string } {
  const alertPrefix = e.alert_count && e.alert_count > 0 ? `${e.alert_count} alert${e.alert_count > 1 ? "s" : ""} · ` : "";
  const summary = e.lead_title ? `${alertPrefix}${e.lead_title} (${e.cards} cards)` : `${alertPrefix}${e.cards} cards for ${e.date}. Open G2 Digest to read or listen.`;
  return {
    title: e.title || "Your edition is ready",
    subtitle: e.date,
    body: summary,
  };
}

/** Tells every iPhone (APNs) and Android phone (FCM) of the user about a newly published edition. */
export async function notifyEdition(env: Env, db: Db, userId: string, e: EditionNotification): Promise<number> {
  const n = editionNotice(e);
  let sent = 0;

  if (pushConfigured(env)) {
    const { data } = await db.from("push_devices").select("apns_token, environment").eq("user_id", userId);
    for (const d of (data ?? []) as { apns_token: string; environment: "production" | "sandbox" }[]) {
      const res = await fetch(`${HOST[d.environment]}/3/device/${d.apns_token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${await apnsToken(env)}`,
          "apns-topic": env.APNS_TOPIC || "com.hejitech.g2digest",
          "apns-push-type": "alert",
          "apns-priority": "10",
          "apns-collapse-id": `edition-${e.date}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          aps: { alert: n, sound: "default", "thread-id": "editions", category: "NEW_EDITION" },
          date: e.date,
          edition_date: e.date,
          lead_title: e.lead_title ?? "",
          alert_count: e.alert_count ?? 0,
        }),
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
  }

  if (fcmConfigured(env)) {
    const access = await fcmAccessToken(env).catch(() => null);
    if (access) {
      const { data: fcmRows } = await db.from("fcm_devices").select("fcm_token").eq("user_id", userId);
      for (const d of (fcmRows ?? []) as { fcm_token: string }[]) {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
          method: "POST",
          headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token: d.fcm_token,
              notification: { title: n.title, body: n.body },
              data: { edition_date: e.date, alert_count: String(e.alert_count ?? 0) },
              android: { notification: { channel_id: "editions", tag: `edition-${e.date}` } },
            },
          }),
        }).catch(() => null);
        if (res?.ok) {
          sent++;
          await db.from("fcm_devices").update({ last_sent_at: new Date().toISOString() }).eq("fcm_token", d.fcm_token);
        } else if (res && (res.status === 404 || res.status === 400)) {
          const txt = await res.text().catch(() => "");
          if (txt.includes("UNREGISTERED") || res.status === 404) {
            await db.from("fcm_devices").delete().eq("fcm_token", d.fcm_token);
          }
        }
      }
    }
  }

  return sent;
}
