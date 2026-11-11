#!/usr/bin/env node
// A dependency-free Google Play Developer API client for HEJI apps (Node 18+).
//
//   node .claude/skills/heji-google-play/play.mjs check  <package>              # auth + what each track holds
//   node .claude/skills/heji-google-play/play.mjs upload <package> <app.aab> [track] [release name]
//
// Credentials: PLAY_SERVICE_ACCOUNT_JSON (the JSON itself, as in CI) or PLAY_SERVICE_ACCOUNT_FILE,
// default ~/Credentials/heji-play-publisher.json. `check` opens an edit and deletes it: it changes
// nothing. `upload` rolls the bundle out to the track (default internal) as "completed".
// The Play API can't create apps or make an app's first upload: do those in the Play Console.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";

function credentials() {
  if (process.env.PLAY_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON);
  const file = process.env.PLAY_SERVICE_ACCOUNT_FILE ?? join(homedir(), "Credentials", "heji-play-publisher.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

const b64url = (b) => Buffer.from(b).toString("base64url");

/** OAuth access token for the service account (JWT bearer grant). */
async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
  const r = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token: ${r.status} ${JSON.stringify(j)}`);
  return j.access_token;
}

async function call(auth, method, url, body, type = "application/json") {
  const r = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${auth}`, ...(body ? { "content-type": type } : {}) },
    body: body && type === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url.replace(/\?.*/, "")}: ${r.status} ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

const [cmd, pkg, file, track = "internal", name] = process.argv.slice(2);
if (!["check", "upload"].includes(cmd) || !pkg || (cmd === "upload" && !file)) {
  console.error("usage: play.mjs check <package> | play.mjs upload <package> <app.aab> [track] [release name]");
  process.exit(2);
}

const sa = credentials();
const auth = await token(sa);
console.log(`signed in as ${sa.client_email}`);
const edit = await call(auth, "POST", `${API}/${pkg}/edits`, {});
const base = `${API}/${pkg}/edits/${edit.id}`;
try {
  if (cmd === "check") {
    const { tracks = [] } = await call(auth, "GET", `${base}/tracks`);
    for (const t of tracks) {
      const rel = (t.releases ?? []).map((r) => `${r.name ?? "?"} [${r.status}] codes ${(r.versionCodes ?? []).join(",")}`);
      console.log(`${t.track}: ${rel.join("; ") || "empty"}`);
    }
    await call(auth, "DELETE", base);
    console.log("ok: the service account can open edits for", pkg, "(nothing changed)");
  } else {
    const bundle = await call(auth, "POST", `${UPLOAD}/${pkg}/edits/${edit.id}/bundles?uploadType=media`,
      readFileSync(file), "application/octet-stream");
    console.log(`uploaded versionCode ${bundle.versionCode}`);
    await call(auth, "PUT", `${base}/tracks/${track}`, {
      track, releases: [{ name: name ?? String(bundle.versionCode), versionCodes: [String(bundle.versionCode)], status: "completed" }],
    });
    await call(auth, "POST", `${base}:commit`);
    console.log(`released ${bundle.versionCode} on ${track}`);
  }
} catch (e) {
  await call(auth, "DELETE", base).catch(() => {});
  throw e;
}
