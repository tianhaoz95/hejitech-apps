// Sign in with Apple token revocation on account deletion (App Store guideline 5.1.1(v)). The iPhone
// app asks Apple for a fresh authorization code just before deleting and sends it along; this trades
// it for Tether's Apple tokens and revokes them, so the person's Apple ID no longer lists Tether. Needs
// APPLE_TEAM_ID (var) and APPLE_SIWA_KEY_ID + APPLE_SIWA_PRIVATE_KEY (secrets, a Sign in with Apple
// key from the developer portal → Keys); without them, or without a code, deletion skips it.

/** A Sign in with Apple key (developer portal → Keys) for com.hejitech.tether. */
export interface AppleKey {
  teamId: string;
  keyId: string;
  /** The .p8 file's contents (PKCS#8 PEM). */
  privateKey: string;
  clientId: string;
}

export const CLIENT_ID = "com.hejitech.tether";

export function appleKey(env: { APPLE_TEAM_ID?: string; APPLE_SIWA_KEY_ID?: string; APPLE_SIWA_PRIVATE_KEY?: string }): AppleKey | undefined {
  return env.APPLE_TEAM_ID && env.APPLE_SIWA_KEY_ID && env.APPLE_SIWA_PRIVATE_KEY
    ? { teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_SIWA_KEY_ID, privateKey: env.APPLE_SIWA_PRIVATE_KEY, clientId: CLIENT_ID }
    : undefined;
}

/** Revokes when both a key and a code are there; never throws (deletion goes ahead either way). */
export async function revokeIfPossible(key: AppleKey | undefined, code: unknown, f: typeof fetch = fetch): Promise<boolean> {
  const c = typeof code === "string" ? code : "";
  if (!key || !c) return false;
  return revokeApple(key, c, f).catch(() => false);
}

/** Trades the app's authorization code for Apple's tokens and revokes them. */
export async function revokeApple(key: AppleKey, code: string, f: typeof fetch): Promise<boolean> {
  const secret = await appleClientSecret(key);
  const form = (o: Record<string, string>) => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(o).toString(),
  });
  const res = await f("https://appleid.apple.com/auth/token", form({ client_id: key.clientId, client_secret: secret, code, grant_type: "authorization_code" }));
  if (!res.ok) return false;
  const t = (await res.json()) as { refresh_token?: string; access_token?: string };
  const token = t.refresh_token ?? t.access_token;
  if (!token) return false;
  const hint = t.refresh_token ? "refresh_token" : "access_token";
  const revoked = await f("https://appleid.apple.com/auth/revoke", form({ client_id: key.clientId, client_secret: secret, token, token_type_hint: hint }));
  return revoked.ok;
}

/** The ES256 client secret Apple's token endpoints take (valid five minutes). */
export async function appleClientSecret(key: AppleKey, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const b64url = (b: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const der = Uint8Array.from(atob(key.privateKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const signer = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const input = `${enc({ alg: "ES256", kid: key.keyId })}.${enc({ iss: key.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: key.clientId })}`;
  // WebCrypto's ECDSA signature is already r || s, the form JWS wants
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signer, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}
