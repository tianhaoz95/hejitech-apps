// Push notifications to phones: iPhones through APNs (ES256 JWT), Android phones through
// Firebase Cloud Messaging HTTP v1 (RS256 service-account JWT). Lifted from Headway's push.ts.
import { PRO } from "./pro-config.ts";
import type { Env } from "./store.ts";

const APNS_HOST = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;
let cachedApns: { jwt: string; at: number; kid: string } | null = null;
let cachedFcm: { token: string; until: number } | null = null;

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

export const apnsConfigured = (env: Env) => Boolean(env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY);
export const fcmConfigured = (env: Env) => Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY);
export const pushConfigured = (env: Env) => apnsConfigured(env) || fcmConfigured(env);

export interface PushDevice {
  apns_token: string | null;
  fcm_token: string | null;
  environment: "production" | "sandbox";
}

export interface AlertPayload {
  title: string;
  body: string;
  kind: string;
}

export type PushResult = { ok: true } | { ok: false; status: number; reason: string; gone: boolean };

async function apnsJwt(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApns && cachedApns.kid === env.APNS_KEY_ID && now - cachedApns.at < 50 * 60) return cachedApns.jwt;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.APNS_PRIVATE_KEY!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${head}.${claims}`));
  cachedApns = { jwt: `${head}.${claims}.${b64url(sig)}`, at: now, kid: env.APNS_KEY_ID! };
  return cachedApns.jwt;
}

async function fcmAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcm && cachedFcm.until > now + 60) return cachedFcm.token;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.FCM_PRIVATE_KEY!), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: env.FCM_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error(`FCM token exchange failed (${res.status})`);
  cachedFcm = { token: j.access_token, until: now + (j.expires_in ?? 3600) };
  return j.access_token;
}

export async function sendAlertPush(env: Env, device: PushDevice, alert: AlertPayload): Promise<PushResult> {
  if (device.apns_token) {
    if (!apnsConfigured(env)) return { ok: false, status: 503, reason: "APNs not configured", gone: false };
    const host = APNS_HOST[device.environment] ?? APNS_HOST.production;
    const res = await fetch(`${host}/3/device/${device.apns_token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await apnsJwt(env)}`,
        "apns-topic": PRO.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "5",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        aps: { alert: { title: alert.title, body: alert.body }, sound: "default" },
        kind: alert.kind,
      }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason ?? `HTTP ${res.status}`;
    return { ok: false, status: res.status, reason, gone: res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" };
  }

  if (device.fcm_token) {
    if (!fcmConfigured(env)) return { ok: false, status: 503, reason: "FCM not configured", gone: false };
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await fcmAccessToken(env)}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: device.fcm_token,
          notification: { title: alert.title, body: alert.body },
          data: { kind: alert.kind },
        },
      }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, reason: text.slice(0, 200), gone: res.status === 404 || text.includes("UNREGISTERED") };
  }

  return { ok: false, status: 400, reason: "No push token", gone: false };
}
