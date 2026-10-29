// POST /api/account/delete: deletes the signed-in user's Wee Hours account (App Store guideline
// 5.1.1(v)). The app and the account page delete the household first (files, then
// `delete_household`); this revokes the user's assistant grants, revokes their Sign in with Apple
// token for Wee Hours when the app sends a fresh authorization code and the Apple key is
// configured, and deletes every weehours row left that points at the user. The login itself is the
// shared HEJI account other HEJI apps use, so it stays: no app deletes another app's account.

export interface AccountDeps {
  sessionUser: (req: Request) => Promise<{ id: string } | null>;
  /** Deletes the user's remaining weehours rows (memberships, invites, access tokens) with the secret key. */
  deleteUserRows: (id: string) => Promise<{ error: unknown }>;
  revokeGrants: (userId: string) => Promise<void>;
  apple?: AppleKey;
  fetch?: typeof fetch;
}

/** A Sign in with Apple key (developer portal → Keys) for com.hejitech.weehours. */
export interface AppleKey {
  teamId: string;
  keyId: string;
  /** The .p8 file's contents (PKCS#8 PEM). */
  privateKey: string;
  clientId: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function handleAccountDelete(req: Request, deps: AccountDeps): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const user = await deps.sessionUser(req);
  if (!user) return json({ error: "Your session expired. Sign in again." }, 401);
  const body = (await req.json().catch(() => ({}))) as { apple_authorization_code?: string };

  await deps.revokeGrants(user.id).catch(() => {});
  let appleRevoked = false;
  const code = String(body.apple_authorization_code ?? "");
  if (code && deps.apple) appleRevoked = await revokeApple(deps.apple, code, deps.fetch ?? fetch).catch(() => false);

  const { error } = await deps.deleteUserRows(user.id);
  if (error) return json({ error: "Couldn't delete your account. Try again, or email support." }, 502);
  return json({ ok: true, apple_revoked: appleRevoked });
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
