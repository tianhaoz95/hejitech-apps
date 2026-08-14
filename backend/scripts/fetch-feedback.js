#!/usr/bin/env node
/**
 * Fetches pending "shake to report" feedback (users/{uid}/appFeedback/{id},
 * a collection group — one subcollection per user, no top-level owner to
 * scope the read to) and downloads each screenshot locally, so the
 * triage-feedback skill (see ../../.claude/skills/triage-feedback/) has a
 * single deterministic call to make instead of chaining a bunch of
 * ad hoc Firestore/Storage reads.
 *
 * Auth: uses Application Default Credentials, i.e. run
 *   gcloud auth application-default login
 * once (interactively, needs a browser) as an account with Firestore +
 * Storage read (and, for --mark-triaged/--mark-resolved, write) access on
 * contempo-str — jacksonzhou666@gmail.com already has Owner on this
 * project, so its own ADC works fine, no separate service account needed.
 * Alternatively set GOOGLE_APPLICATION_CREDENTIALS to a service account
 * key's path if you'd rather use a dedicated key.
 *
 * Usage:
 *   node fetch-feedback.js [--status pending] [--limit 20] [--out <dir>]
 *   node fetch-feedback.js --mark-triaged users/<uid>/appFeedback/<id>
 *   node fetch-feedback.js --mark-resolved users/<uid>/appFeedback/<id>
 *
 * The default (fetch) mode prints one JSON array to stdout — see
 * `buildManifestEntry` below for the exact shape — and downloads each
 * screenshot into --out (default: an OS temp dir printed in the output).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
// firebase-admin v14 dropped the old admin.credential()/admin.firestore()
// namespaced API from the plain `require("firebase-admin")` object — it now
// only exposes app lifecycle functions there, and each service needs its
// own modular submodule import (same shape the client SDKs have used for a
// while). Confirmed live: the old style threw "Cannot read properties of
// undefined (reading 'applicationDefault')" against the version actually
// installed here.
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const PROJECT_ID = "contempo-str";
const STORAGE_BUCKET = "contempo-str.firebasestorage.app";

function parseArgs(argv) {
  const args = { status: "pending", limit: 20, out: null, markTriaged: null, markResolved: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--status":
        args.status = argv[++i];
        break;
      case "--limit":
        args.limit = parseInt(argv[++i], 10);
        break;
      case "--out":
        args.out = argv[++i];
        break;
      case "--mark-triaged":
        args.markTriaged = argv[++i];
        break;
      case "--mark-resolved":
        args.markResolved = argv[++i];
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function initAdmin() {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  });
}

// docPath looks like "users/{uid}/appFeedback/{feedbackId}" — the uid is
// the parent of the appFeedback subcollection, not a field on the doc
// itself (this collection has no owner field, ownership is the path).
function uidFromDocPath(docPath) {
  const segments = docPath.split("/");
  const usersIndex = segments.indexOf("users");
  return segments[usersIndex + 1];
}

async function markStatus(docPath, status) {
  const db = getFirestore();
  const update = { status };
  update[status === "triaged" ? "triagedAt" : "resolvedAt"] = FieldValue.serverTimestamp();
  await db.doc(docPath).update(update);
  process.stdout.write(`${docPath} -> ${status}\n`);
}

async function fetchFeedback(args) {
  const db = getFirestore();
  const outDir = args.out || fs.mkdtempSync(path.join(os.tmpdir(), "contempo-feedback-"));
  fs.mkdirSync(outDir, { recursive: true });

  const snapshot = await db
    .collectionGroup("appFeedback")
    .where("status", "==", args.status)
    .orderBy("createdAt", "asc")
    .limit(args.limit)
    .get();

  const bucket = getStorage().bucket();
  const manifest = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docPath = doc.ref.path;
    const uid = uidFromDocPath(docPath);
    const screenshotLocalPath = path.join(outDir, `${doc.id}.jpg`);

    await bucket.file(data.screenshotPath).download({ destination: screenshotLocalPath });

    manifest.push({
      feedbackId: doc.id,
      uid,
      docPath,
      screenshotLocalPath,
      description: data.description || "",
      region: data.region || null,
      environment: {
        appVersion: data.appVersion,
        buildNumber: data.buildNumber,
        osVersion: data.osVersion,
        deviceModel: data.deviceModel,
        screenName: data.screenName,
        locale: data.locale,
      },
      status: data.status,
      createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    });
  }

  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  initAdmin();

  if (args.markTriaged) {
    await markStatus(args.markTriaged, "triaged");
    return;
  }
  if (args.markResolved) {
    await markStatus(args.markResolved, "resolved");
    return;
  }
  await fetchFeedback(args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
