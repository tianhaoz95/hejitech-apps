// Apple Push Notification service with token auth: an ES256 JWT signed with the team's APNs key
// (WebCrypto, no dependency), cached for 50 minutes as Apple asks (refresh at most every 20, at
// least every 60). Each device row says which APNs host it belongs to (Debug builds: sandbox).
import type { Notification } from "@headway/core";
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

export type PushResult = { ok: true } | { ok: false; status: number; reason: string; gone: boolean };

/** Sends one notification to one device. `gone` means the token is dead: delete the device. */
export async function sendPush(env: Env, device: { apns_token: string; environment: "production" | "sandbox" }, n: Notification): Promise<PushResult> {
  const res = await fetch(`${HOST[device.environment]}/3/device/${device.apns_token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await token(env)}`,
      "apns-topic": env.APNS_TOPIC || "com.hejitech.headway",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": n.key.slice(0, 64),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: n.title, body: n.body },
        sound: "default",
        "thread-id": n.thread,
        // Delays, cancellations, leave-now and arrival are time-sensitive (they break through Focus
        // when the user allows it); service alerts are ordinary.
        "interruption-level": n.kind === "service" ? "active" : "time-sensitive",
      },
      kind: n.kind,
    }),
  });
  if (res.ok) return { ok: true };
  const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? `HTTP ${res.status}`;
  return { ok: false, status: res.status, reason, gone: res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered" };
}
