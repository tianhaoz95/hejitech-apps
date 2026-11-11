// Notifications to phones: iPhones through APNs, Android phones through Firebase Cloud Messaging
// (HTTP v1, a service account's RS256 JWT exchanged for a Google access token, cached until shortly
// before it expires). A device row has an APNs token or an FCM token, never both.
//
// Apple Push Notification service with token auth: an ES256 JWT signed with the team's APNs key
// (WebCrypto, no dependency), cached for 50 minutes as Apple asks (refresh at most every 20, at
// least every 60). Each device row says which APNs host it belongs to (Debug builds: sandbox).
import type { BoardActivityState, Notification } from "@headway/core";
import type { Env } from "./store.ts";

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

/** APNs is set up: iPhone notifications and Live Activities. */
export function apnsConfigured(env: Env): boolean {
  return Boolean(env.APNS_TEAM_ID && env.APNS_KEY_ID && env.APNS_PRIVATE_KEY);
}

/** FCM is set up: Android notifications. */
export function fcmConfigured(env: Env): boolean {
  return Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY);
}

/** Some phone can be notified. */
export function pushConfigured(env: Env): boolean {
  return apnsConfigured(env) || fcmConfigured(env);
}

/** A row of push_devices as the senders need it. */
export interface PushDevice {
  apns_token: string | null;
  fcm_token: string | null;
  environment: "production" | "sandbox";
}
/** The columns of push_devices that make a PushDevice. */
export const PUSH_DEVICE_COLUMNS = "apns_token, fcm_token, environment";

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

/** "Next trains" Live Activities register update tokens with trip_id `board:<from>><to>`. */
export const BOARD_ACTIVITY_PREFIX = "board:";
/** Live Activities of a family member's train register update tokens with trip_id `follow:<sharer id>:<trip id>`. */
export const FOLLOW_ACTIVITY_PREFIX = "follow:";
/** PostgREST filter for the activity tokens of your own tracked train (not a board's, not a followed train's, or none). */
export const NOT_BOARD_ACTIVITY = `trip_id.is.null,and(trip_id.not.like.${BOARD_ACTIVITY_PREFIX}*,trip_id.not.like.${FOLLOW_ACTIVITY_PREFIX}*)`;

export type PushResult = { ok: true } | { ok: false; status: number; reason: string; gone: boolean };

export interface LiveActivityContentState {
  pred_arr: number;
  delay_min: number | null;
  next: string | null;
  next_pred: number | null;
  stops_left: number;
  cancelled: boolean;
  arrived: boolean;
}

export interface LiveActivityPayload {
  event: "start" | "update" | "end";
  timestamp?: number; // epoch seconds
  dismissalDate?: number; // epoch seconds
  attributes?: {
    trip_id: string;
    train: string;
    kind: string;
    to: string;
    /** A family member's train: their name. */
    who?: string;
  };
  contentState: LiveActivityContentState | BoardActivityState;
}

/** Sends an ActivityKit Live Activity update, start or end push. */
export async function sendLiveActivityPush(
  env: Env,
  device: { token: string; environment: "production" | "sandbox" },
  payload: LiveActivityPayload
): Promise<PushResult> {
  if (!apnsConfigured(env)) return NOT_SET_UP;
  const nowSec = payload.timestamp ?? Math.floor(Date.now() / 1000);
  const aps: Record<string, unknown> = {
    timestamp: nowSec,
    event: payload.event,
    "content-state": payload.contentState,
  };
  if (payload.event === "start" && payload.attributes) {
    aps["attributes-type"] = "TrackActivityAttributes";
    aps.attributes = payload.attributes;
  }
  if (payload.event === "end" && payload.dismissalDate) {
    aps["dismissal-date"] = payload.dismissalDate;
  }

  const topic = `${env.APNS_TOPIC || "com.hejitech.headway"}.push-type.liveactivity`;
  const res = await fetch(`${HOST[device.environment]}/3/device/${device.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await token(env)}`,
      "apns-topic": topic,
      "apns-push-type": "liveactivity",
      "apns-priority": "cancelled" in payload.contentState && (payload.contentState.cancelled || (payload.contentState.delay_min ?? 0) >= 5) ? "10" : "5",
      "content-type": "application/json",
    },
    body: JSON.stringify({ aps }),
  });
  if (res.ok) return { ok: true };
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? `HTTP ${res.status}`;
  return { ok: false, status: res.status, reason, gone: res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" };
}

/** Sends one notification to one device. `gone` means the token is dead: delete the device. */
export async function sendPush(env: Env, device: PushDevice, n: Notification): Promise<PushResult> {
  if (device.fcm_token) return fcmConfigured(env) ? sendFcm(env, device.fcm_token, n) : NOT_SET_UP;
  if (!device.apns_token || !apnsConfigured(env)) return NOT_SET_UP;
  const res = await fetch(`${HOST[device.environment]}/3/device/${device.apns_token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await token(env)}`,
      "apns-topic": env.APNS_TOPIC || "com.hejitech.headway",
      "apns-push-type": "alert",
      // Quiet notifications don't need waking the phone for.
      "apns-priority": n.priority ? "10" : "5",
      "apns-collapse-id": n.key.slice(0, 64),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: n.title, body: n.body },
        // Non-priority alerts land in Notification Center without a sound or lighting the screen.
        ...(n.priority ? { sound: "default" } : {}),
        "thread-id": n.thread,
        // Delays, cancellations, leave-now and arrival are time-sensitive (they break through Focus
        // when the user allows it); service alerts and news about family are ordinary.
        "interruption-level": !n.priority ? "passive" : n.kind === "service" || n.kind === "family" ? "active" : "time-sensitive",
      },
      kind: n.kind,
      priority: n.priority,
    }),
  });
  if (res.ok) return { ok: true };
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? `HTTP ${res.status}`;
  return { ok: false, status: res.status, reason, gone: res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" };
}

const NOT_SET_UP: PushResult = { ok: false, status: 0, reason: "NotConfigured", gone: false };

// ---------------------------------------------------------------- Firebase Cloud Messaging (Android)
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
let fcmCached: { token: string; until: number; email: string } | null = null;

async function fcmAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmCached && fcmCached.email === env.FCM_CLIENT_EMAIL && now < fcmCached.until) return fcmCached.token;
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.FCM_PRIVATE_KEY!), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: env.FCM_CLIENT_EMAIL, scope: FCM_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google token: ${body.error_description ?? `HTTP ${res.status}`}`);
  fcmCached = { token: body.access_token, until: now + (body.expires_in ?? 3600) - 300, email: env.FCM_CLIENT_EMAIL! };
  return fcmCached.token;
}

/** Android notification channels the app creates (PushService.kt): priority alerts make a sound, quiet ones don't. */
export const FCM_CHANNEL = { alerts: "headway_alerts", quiet: "headway_quiet" } as const;

/** The FCM v1 message for a notification: shown by the system when the app is closed, by the app when it's open. */
export function fcmMessage(token: string, n: Notification): Record<string, unknown> {
  return {
    token,
    notification: { title: n.title, body: n.body },
    // Data values must be strings.
    data: { key: n.key, kind: n.kind, priority: String(n.priority), thread: n.thread },
    android: {
      priority: n.priority ? "HIGH" : "NORMAL",
      // A delay or "leave now" is worthless once the train has gone.
      ttl: "1800s",
      // The same alert again replaces the one showing (the tag), like APNs' collapse id.
      notification: { channel_id: n.priority ? FCM_CHANNEL.alerts : FCM_CHANNEL.quiet, tag: n.key.slice(0, 64) },
    },
  };
}

async function sendFcm(env: Env, token: string, n: Notification): Promise<PushResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await fcmAccessToken(env)}`, "content-type": "application/json" },
    body: JSON.stringify({ message: fcmMessage(token, n) }),
  });
  if (res.ok) return { ok: true };
  const err = ((await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } }).error;
  const reason = err?.details?.find((d) => d.errorCode)?.errorCode ?? err?.status ?? `HTTP ${res.status}`;
  // UNREGISTERED: the app was uninstalled or the token rotated. A malformed token (INVALID_ARGUMENT on the token) can't be told from a bad message, so it stays.
  return { ok: false, status: res.status, reason, gone: res.status === 404 || reason === "UNREGISTERED" };
}
