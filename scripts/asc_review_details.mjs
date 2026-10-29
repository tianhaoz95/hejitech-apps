#!/usr/bin/env node
// Writes the App Review demo account and notes into App Store Connect for an app's editable
// version (App Store Connect › App Review Information): demo account required, user name,
// password, notes. Uses the App Store Connect API key from the environment.
//
//   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=…/AuthKey_….p8 \
//   node scripts/asc_review_details.mjs <bundle id> <email> <password> <notes file> [--dry-run]
//
// Without an editable version (nothing in "Prepare for Submission" and the like) it says so and
// exits 3: create the version in App Store Connect (or let cut_release.sh's upload do it), rerun.
// Called by scripts/review_account.sh.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const [bundleId, email, password, notesFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
if (!bundleId || !email || !password || !notesFile) {
  console.error("usage: asc_review_details.mjs <bundle id> <email> <password> <notes file> [--dry-run]");
  process.exit(2);
}
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) {
  console.error("!! set ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH (the .p8)");
  process.exit(2);
}
const notes = readFileSync(notesFile, "utf8").trim();

const b64url = (b) => Buffer.from(b).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const sig = createSign("SHA256").update(`${head}.${body}`).sign({ key: readFileSync(ASC_KEY_PATH), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}
const token = jwt();
async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const EDITABLE = new Set(["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY", "WAITING_FOR_REVIEW"]);

const app = (await asc("GET", `apps?filter[bundleId]=${encodeURIComponent(bundleId)}`)).data[0];
if (!app) {
  console.error(`!! no App Store Connect app with bundle id ${bundleId}`);
  process.exit(1);
}
const versions = (await asc("GET", `apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
const version = versions.find((v) => EDITABLE.has(v.attributes.appStoreState ?? v.attributes.appVersionState));
if (!version) {
  const states = versions.map((v) => `${v.attributes.versionString} ${v.attributes.appStoreState}`).join(", ") || "none";
  console.log(`== ${bundleId}: no editable App Store version (${states}); review details not written`);
  process.exit(3);
}
const attributes = { demoAccountRequired: true, demoAccountName: email, demoAccountPassword: password, notes };
const existing = await asc("GET", `appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null);
const where = `${bundleId} ${version.attributes.versionString} (${version.attributes.appStoreState})`;
if (dryRun) {
  console.log(`== would write the demo account (${email}) and notes to ${where}`);
} else if (existing?.data) {
  await asc("PATCH", `appStoreReviewDetails/${existing.data.id}`, { data: { type: "appStoreReviewDetails", id: existing.data.id, attributes } });
  console.log(`== updated App Review details for ${where}`);
} else {
  await asc("POST", "appStoreReviewDetails", {
    data: { type: "appStoreReviewDetails", attributes, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } } },
  });
  console.log(`== created App Review details for ${where}`);
}
