/**
 * scripts/upload-sideload.mjs - Upload the sideload version of the extension to Firebase Storage.
 * 
 * Usage: 
 *   pnpm exec node scripts/upload-sideload.mjs [--key=path/to/key.json]
 */

import admin from "firebase-admin";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const keyArg = args.find(a => a.startsWith("--key="));
const serviceAccountPath = keyArg ? keyArg.split("=")[1] : null;
const projectId = "icecap-platform";
const bucketName = `${projectId}.firebasestorage.app`;

// Check if a default key exists in the root
const defaultKeyPath = join(process.cwd(), "service-account.json");
const hasDefaultKey = existsSync(defaultKeyPath);

async function init() {
  const activeKeyPath = serviceAccountPath || (hasDefaultKey ? defaultKeyPath : null);

  if (activeKeyPath) {
    console.log(`🚀 Initializing Admin SDK with key: ${activeKeyPath}`);
    const serviceAccount = JSON.parse(readFileSync(activeKeyPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    });
  } else {
    console.log(`🚀 Initializing Admin SDK with Application Default Credentials (ADC)`);
    admin.initializeApp({
      projectId: projectId,
      storageBucket: bucketName
    });
  }
}

async function upload() {
  await init();
  
  const buildDir = join(process.cwd(), "apps/extension/build");
  if (!existsSync(buildDir)) {
    console.error(`❌ Build directory not found: ${buildDir}`);
    process.exit(1);
  }

  // Find the ZIP file created by 'plasmo package'
  // It usually looks like 'icecap-extension-sideload-chrome-mv3.zip' or similar
  const files = readdirSync(buildDir);
  const zipFile = files.find(f => f.endsWith(".zip") && f.includes("sideload"));

  if (!zipFile) {
    console.error(`❌ Sideload ZIP file not found in ${buildDir}. Files present: ${files.join(", ")}`);
    process.exit(1);
  }

  const localPath = join(buildDir, zipFile);
  const remotePath = "extension/download/icecap-extension.zip";

  console.log(`📦 Found local ZIP: ${zipFile}`);
  console.log(`📤 Uploading to: gs://${bucketName}/${remotePath}`);

  try {
    const bucket = admin.storage().bucket();
    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: 'application/zip',
        cacheControl: 'no-cache, no-store, must-revalidate',
      },
    });

    // Make it publicly readable (if needed, otherwise users can't download)
    // Most sideload flows need a public link
    await bucket.file(remotePath).makePublic();

    console.log("\n✅ SUCCESS: Extension uploaded and made public!");
    console.log(`🔗 Download link: https://storage.googleapis.com/${bucketName}/${remotePath}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error uploading extension:");
    console.error(error.message);
    process.exit(1);
  }
}

upload();
