/**
 * scripts/make-admin.mjs - Grant admin privileges to a user via Firebase Admin SDK.
 * 
 * Usage: 
 *   node scripts/make-admin.mjs <uid_or_email> [project_id]
 * 
 * Example:
 *   node scripts/make-admin.mjs user@example.com icecap-platform
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const target = process.argv[2];
const projectId = process.argv[3] || "icecap-platform";

if (!target) {
  console.error("❌ Please provide a UID or email address.");
  console.log("Usage: node scripts/make-admin.mjs <uid_or_email> [project_id]");
  process.exit(1);
}

console.log(`🚀 Initializing Admin SDK for project: ${projectId}...`);

// Use application default credentials (ADC)
// This works if you have GOOGLE_APPLICATION_CREDENTIALS set or if you've run `gcloud auth application-default login`
admin.initializeApp({
  projectId: projectId,
});

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
    console.log("ℹ️ The user may need to sign out and sign back in for the changes to take effect.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error granting admin privileges:");
    console.error(error.message);
    if (error.code === 'auth/user-not-found') {
        console.error("Tip: Make sure the user has signed in at least once.");
    }
    process.exit(1);
  }
}

makeAdmin();
