// POST /api/account/delete (src/worker/account.ts) with stubbed Supabase and Apple.
import { describe, expect, it } from "vitest";
import { appleClientSecret, handleAccountDelete, type AccountDeps, type AppleKey } from "../src/worker/account.ts";

async function appleKey(): Promise<{ key: AppleKey; publicKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
  return { key: { teamId: "TEAM", keyId: "KEY", privateKey: pem, clientId: "com.hejitech.weehours" }, publicKey: pair.publicKey };
}

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function deps(over: Partial<AccountDeps> = {}): AccountDeps & { deleted: string[]; revoked: string[] } {
  const deleted: string[] = [];
  const revoked: string[] = [];
  return {
    deleted,
    revoked,
    sessionUser: async (r) => (r.headers.get("Authorization") === "Bearer good" ? { id: "u1" } : null),
    deleteUserRows: async (id) => (deleted.push(id), { error: null }),
    revokeGrants: async (id) => void revoked.push(id),
    ...over,
  };
}

const post = (body: unknown = {}, auth = "Bearer good") =>
  new Request("https://x/api/account/delete", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body) });

describe("account deletion", () => {
  it("needs a session", async () => {
    const d = deps();
    expect((await handleAccountDelete(post({}, "Bearer bad"), d)).status).toBe(401);
    expect(d.deleted).toEqual([]);
  });

  it("revokes grants and deletes the user's rows", async () => {
    const d = deps();
    const res = await handleAccountDelete(post(), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, apple_revoked: false });
    expect(d.revoked).toEqual(["u1"]);
    expect(d.deleted).toEqual(["u1"]);
  });

  it("reports a failed delete", async () => {
    const d = deps({ deleteUserRows: async () => ({ error: new Error("db") }) });
    expect((await handleAccountDelete(post(), d)).status).toBe(502);
  });

  it("revokes the Apple token with the app's authorization code", async () => {
    const { key } = await appleKey();
    const calls: { url: string; body: URLSearchParams }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: new URLSearchParams(String(init.body)) });
      return url.endsWith("/auth/token") ? Response.json({ refresh_token: "rt", access_token: "at" }) : new Response("");
    }) as unknown as typeof fetch;
    const d = deps({ apple: key, fetch: fake });
    const res = await handleAccountDelete(post({ apple_authorization_code: "code1" }), d);
    expect(await res.json()).toEqual({ ok: true, apple_revoked: true });
    expect(calls.map((c) => c.url)).toEqual(["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/revoke"]);
    expect(calls[0].body.get("code")).toBe("code1");
    expect(calls[1].body.get("token")).toBe("rt");
    expect(calls[1].body.get("token_type_hint")).toBe("refresh_token");
    expect(d.deleted).toEqual(["u1"]);
  });

  it("still deletes the rows when Apple refuses the code", async () => {
    const { key } = await appleKey();
    const fake = (async () => new Response("invalid_grant", { status: 400 })) as unknown as typeof fetch;
    const d = deps({ apple: key, fetch: fake });
    expect(await (await handleAccountDelete(post({ apple_authorization_code: "old" }), d)).json()).toEqual({ ok: true, apple_revoked: false });
    expect(d.deleted).toEqual(["u1"]);
  });

  it("signs a client secret Apple can verify", async () => {
    const { key, publicKey } = await appleKey();
    const jwt = await appleClientSecret(key, 1000);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(fromB64url(h)))).toEqual({ alg: "ES256", kid: "KEY" });
    expect(JSON.parse(new TextDecoder().decode(fromB64url(p)))).toEqual({ iss: "TEAM", iat: 1000, exp: 1300, aud: "https://appleid.apple.com", sub: "com.hejitech.weehours" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });
});
