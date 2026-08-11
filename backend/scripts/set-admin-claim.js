#!/usr/bin/env node
/**
 * Grants or revokes the `admin: true` custom claim that backs the admin/
 * site (see admin/README.md and firestore.rules' isAdmin()). Firebase
 * custom claims can only be set via the Admin SDK — there's no client or
 * Console UI path — so this is the one-time (or per-admin) provisioning
 * step: run it once for each Google account that should get into admin/,
 * then have that person sign out and back in (or wait ~1hr for their ID
 * token to naturally refresh) so the new claim actually lands in their
 * token — see admin/src/auth/AuthContext.tsx's forced getIdTokenResult(true)
 * refresh, which shortens that wait to "next page load."
 *
 * Auth: uses Application Default Credentials, same as fetch-feedback.js —
 * run `gcloud auth application-default login` once if this fails with an
 * auth error. jacksonzhou666@gmail.com already has Owner on
 * contempo-platform, so its own ADC works fine, no separate service
 * account needed.
 *
 * Usage:
 *   node set-admin-claim.js --grant someone@example.com
 *   node set-admin-claim.js --revoke someone@example.com
 *   node set-admin-claim.js --list-admins
 */

// firebase-admin v14 dropped the old admin.credential()/admin.auth()
// namespaced API from the plain `require("firebase-admin")` object — see
// fetch-feedback.js's matching comment for the confirmed-live error this
// caused with the old style.
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const PROJECT_ID = "contempo-platform";

function parseArgs(argv) {
  const args = { grant: null, revoke: null, listAdmins: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--grant":
        args.grant = argv[++i];
        break;
      case "--revoke":
        args.revoke = argv[++i];
        break;
      case "--list-admins":
        args.listAdmins = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!args.grant && !args.revoke && !args.listAdmins) {
    throw new Error("Pass one of --grant <email>, --revoke <email>, or --list-admins.");
  }
  return args;
}

function initAdmin() {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
}

// Custom claims are a single object per user (not merged automatically) —
// this preserves any other claim that might exist alongside `admin` in the
// future rather than clobbering the whole object.
async function setAdminClaim(email, isAdmin) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const nextClaims = { ...(user.customClaims || {}) };
  if (isAdmin) {
    nextClaims.admin = true;
  } else {
    delete nextClaims.admin;
  }
  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(`${isAdmin ? "Granted" : "Revoked"} admin for ${email} (uid ${user.uid}).`);
  console.log("They need to sign out and back in on admin/ for the new claim to take effect.");
}

// listUsers pages through the whole project's user base, which is fine at
// this MVP's user count — revisit if that ever stops being true.
async function listAdmins() {
  const auth = getAuth();
  let admins = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    admins = admins.concat(page.users.filter((u) => u.customClaims && u.customClaims.admin === true));
    pageToken = page.pageToken;
  } while (pageToken);

  if (admins.length === 0) {
    console.log("No admins currently granted.");
    return;
  }
  for (const u of admins) {
    console.log(`${u.email ?? "(no email)"}  uid=${u.uid}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  initAdmin();

  if (args.listAdmins) {
    await listAdmins();
  } else if (args.grant) {
    await setAdminClaim(args.grant, true);
  } else if (args.revoke) {
    await setAdminClaim(args.revoke, false);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
