/**
 * scripts/make-admin.mjs - Grant admin privileges to a user via Firebase Admin SDK.
 * 
 * Usage: 
 *   pnpm admin:grant <uid_or_email> [--emulator] [--key=path/to/key.json]
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith("-"));
const useEmulator = args.includes("--emulator");
const keyArg = args.find(a => a.startsWith("--key="));
const serviceAccountPath = keyArg ? keyArg.split("=")[1] : null;
const projectId = "icecap-platform";

// Check if a default key exists in the root
const defaultKeyPath = join(process.cwd(), "service-account.json");
const hasDefaultKey = existsSync(defaultKeyPath);

function printInstructions(errorMsg) {
  if (errorMsg) {
    console.error(`❌ Initialization Error: ${errorMsg}\n`);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔑 HOW TO GRANT ADMIN ACCESS (Production)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("To modify production users, you need a Service Account Key:");
  console.log("");
  console.log("1. Open Firebase Console: https://console.firebase.google.com/");
  console.log("2. Project Settings (⚙️ icon) > Service Accounts");
  console.log("3. Click 'Generate new private key'");
  console.log("4. Save the file to this directory as 'service-account.json'");
  console.log("");
  console.log("Then run:");
  console.log(`  pnpm admin:grant ${target || "<uid_or_email>"}`);
  console.log("");
  console.log("OR use a specific path:");
  console.log(`  pnpm admin:grant ${target || "<uid_or_email>"} --key=./path/to/key.json`);
  console.log("");
  console.log("💡 For local testing, just use the emulator flag:");
  console.log(`  pnpm admin:grant ${target || "<uid_or_email>"} --emulator`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

if (!target) {
  console.error("❌ Please provide a UID or email address.");
  printInstructions();
  process.exit(1);
}

async function init() {
  if (useEmulator) {
    console.log("🛠️ Using Firebase Emulator...");
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    admin.initializeApp({ projectId: "demo-icecap" });
    return;
  }

  const activeKeyPath = serviceAccountPath || (hasDefaultKey ? defaultKeyPath : null);

  if (!activeKeyPath) {
    printInstructions("No credentials found.");
    process.exit(1);
  }

  try {
    console.log(`🚀 Initializing Admin SDK for Production: ${projectId}...`);
    console.log(`🔑 Using key: ${activeKeyPath}`);
    const serviceAccount = JSON.parse(readFileSync(activeKeyPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
  } catch (e) {
    printInstructions(e.message);
    process.exit(1);
  }
}

async function makeAdmin() {
  await init();
  
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

    console.log("\n✅ SUCCESS: Admin privileges granted!");
    console.log("ℹ️  Note: The user MUST sign out and sign back in for the changes to take effect.\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error granting admin privileges:");
    console.error(error.message);
    process.exit(1);
  }
}

makeAdmin();
