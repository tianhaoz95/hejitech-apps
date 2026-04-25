/**
 * check-users.mjs - Diagnostic script to list all users in the Auth emulator
 */
const PROJECT_ID = "demo-icecap";
const AUTH_BASE = "http://127.0.0.1:9099";

async function check() {
  console.log(`🔍 Checking users for project: ${PROJECT_ID}...`);
  try {
    // The emulator-specific endpoint for listing accounts using the Admin SDK style listing
    const resp = await fetch(`${AUTH_BASE}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=10`);
    
    if (!resp.ok) {
      console.error(`❌ Failed to fetch accounts: ${resp.status} ${resp.statusText}`);
      return;
    }
    
    const data = await resp.json();
    const users = data.users || [];
    
    console.log(`📊 Found ${users.length} user(s).`);
    users.forEach(u => {
      const providers = u.providerUserInfo?.map(p => p.providerId).join(', ') || 'none';
      console.log(`  - UID: ${u.localId}, Email: ${u.email}, Providers: [${providers}]`);
    });
    
    const hiUser = users.find(u => u.email === "hi@icecap.com");
    if (hiUser && hiUser.providerUserInfo?.some(p => p.providerId === "google.com")) {
        console.log("✅ hi@icecap.com is correctly configured with Google Provider.");
    } else if (hiUser) {
        console.log("❌ hi@icecap.com found but MISSING Google Provider.");
    } else {
        console.log("❌ hi@icecap.com NOT FOUND.");
    }

  } catch (e) {
    console.error(`❌ Connection error: ${e.message}. Is the emulator running?`);
  }
}

check();
