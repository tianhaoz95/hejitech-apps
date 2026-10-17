#!/usr/bin/env node
// Fetches "shake to report" feedback (contempo.app_feedback) and downloads each screenshot locally,
// for the triage-feedback skill (.claude/skills/triage-feedback). Replaces backend/scripts/
// fetch-feedback.js (Firestore). Uses the shared Supabase project's service key from the
// environment (SUPABASE_SECRET_KEY, e.g. `set -a; source ~/Credentials/waypack.env`); never commit it.
//
//   node scripts/fetch-feedback.mjs [--status pending] [--limit 20] [--out <dir>]
//   node scripts/fetch-feedback.mjs --mark-triaged <feedbackId>
//   node scripts/fetch-feedback.mjs --mark-resolved <feedbackId>
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_BASE = process.env.SUPABASE_URL ?? "https://jitdzllkxfhlrxxvljhp.supabase.co";
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("Set SUPABASE_SECRET_KEY (the shared project's service key), e.g. `set -a; source ~/Credentials/waypack.env`.");
  process.exit(1);
}
const headers = { apikey: KEY, authorization: `Bearer ${KEY}`, "accept-profile": "contempo", "content-profile": "contempo", "content-type": "application/json" };

const args = { status: "pending", limit: 20, out: null, mark: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--status") args.status = argv[++i];
  else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
  else if (argv[i] === "--out") args.out = argv[++i];
  else if (argv[i] === "--mark-triaged") args.mark = ["triaged", argv[++i]];
  else if (argv[i] === "--mark-resolved") args.mark = ["resolved", argv[++i]];
}

if (args.mark) {
  const [status, rawId] = args.mark;
  const id = rawId.split("/").pop(); // accepts an old-style docPath too
  const body = { status, [status === "triaged" ? "triaged_at" : "resolved_at"]: new Date().toISOString() };
  const res = await fetch(`${URL_BASE}/rest/v1/app_feedback?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`mark ${status} failed: ${res.status} ${await res.text()}`);
  console.log(`marked ${id} ${status}`);
  process.exit(0);
}

const outDir = args.out ?? mkdtempSync(join(tmpdir(), "contempo-feedback-"));
mkdirSync(outDir, { recursive: true });
const res = await fetch(`${URL_BASE}/rest/v1/app_feedback?status=eq.${args.status}&order=created_at.asc&limit=${args.limit}`, { headers });
if (!res.ok) throw new Error(`fetch failed: ${res.status} ${await res.text()}`);
const manifest = [];
for (const r of await res.json()) {
  const screenshotLocalPath = join(outDir, `${r.id}.jpg`);
  const img = await fetch(`${URL_BASE}/storage/v1/object/contempo/${r.screenshot_path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } });
  if (img.ok) writeFileSync(screenshotLocalPath, Buffer.from(await img.arrayBuffer()));
  manifest.push({
    feedbackId: r.id,
    uid: r.user_id,
    docPath: r.id,
    screenshotLocalPath: img.ok ? screenshotLocalPath : null,
    description: r.description ?? "",
    region: r.region ?? null,
    environment: {
      appVersion: r.app_version, buildNumber: r.build_number, osVersion: r.os_version,
      deviceModel: r.device_model, screenName: r.screen_name, locale: r.locale,
    },
    status: r.status,
    createdAt: r.created_at,
  });
}
process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
