/**
 * scripts/make-admin.mjs - Grant admin privileges to a user via Firebase Admin SDK.
 * 
 * Usage (Production): 
 *   pnpm admin:grant <uid_or_email>
 * 
 * Usage (Emulator):
 *   pnpm admin:grant <uid_or_email> --emulator
 */

import admin from "firebase-admin";

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith("-"));
const useEmulator = args.includes("--emulator");
const projectId = "icecap-platform";

if (!target) {
  console.error("❌ Please provide a UID or email address.");
  console.log("Usage: pnpm admin:grant <uid_or_email> [--emulator]");
  process.exit(1);
}

if (useEmulator) {
  console.log("🛠️ Using Firebase Emulator...");
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  admin.initializeApp({
    projectId: "demo-icecap",
  });
} else {
  console.log(`🚀 Initializing Admin SDK for Production: ${projectId}...`);
  // This requires either:
  // 1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
  // 2. Logged in via `gcloud auth application-default login`
  try {
    admin.initializeApp({
      projectId: projectId,
    });
  } catch (e) {
    console.error("❌ Failed to initialize Admin SDK.");
    console.error(e.message);
    console.log("\nTo fix this for production:");
    console.log("1. Install Google Cloud SDK (gcloud)");
    console.log("2. Run: gcloud auth application-default login");
    console.log("3. Run this script again\n");
    process.exit(1);
  }
}

async function makeAdmin() {
  try {
    let user;
    if (target.includes("@")) {
      console.log(`🔍 Looking up user by email: ${target}...`);
      user = await admin.auth().getUserByEmail(target);
    } else {
      console.log(`🔍 Looking up user by UID: ${target}...`);
      user = await admin.auth().getUser(target);
    }

    console.log(`👤 Found user: ${user.displayName || "No Name"} (${user.email})`);
    console.log(`🛡️ Granting admin claim to ${user.uid}...`);

    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log("✅ Admin privileges granted successfully!");
    console.log("ℹ️ The user MUST sign out and sign back in for the changes to take effect.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error granting admin privileges:");
    console.error(error.message);
    if (error.code === 'auth/user-not-found') {
        console.error("Tip: Make sure the user has signed in at least once to the correct environment.");
    }
    process.exit(1);
  }
}

makeAdmin();
