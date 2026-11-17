import admin from "firebase-admin"

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"

admin.initializeApp({
  projectId: "demo-icecap",
})

const auth = admin.auth()
const db = admin.firestore()

async function clearAll() {
  console.log("🧹 Clearing all users and subscriptions...")
  
  // Clear Auth
  const listUsers = await auth.listUsers()
  if (listUsers.users.length > 0) {
    await auth.deleteUsers(listUsers.users.map(u => u.uid))
  }
  
  // Clear Firestore Subscriptions
  const subs = await db.collection("subscriptions").get()
  const batch = db.batch()
  subs.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
  
  console.log("✅ Cleanup complete.")
}

async function seed() {
  await clearAll()
  
  const uid = "icecap-main-user-2026"
  const email = "hi@icecap.com"
  const password = "TestPass123!"

  console.log(`👤 Creating/Updating user: ${email}...`)
  
  try {
    // Try to create user
    await auth.createUser({
      uid: uid,
      email: email,
      password: password,
      emailVerified: true,
      displayName: "Icecap User",
      photoURL: "https://lh3.googleusercontent.com/a/default-user",
    })
    console.log(`✅ User created: ${uid}`)
  } catch (e) {
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      console.log(`ℹ️ User already exists, updating password...`)
      await auth.updateUser(uid, { password: password })
      console.log(`✅ User updated: ${uid}`)
    } else {
      throw e
    }
  }

  console.log("📄 Seeding subscription...")
  await db.collection("subscriptions").doc(uid).set({
    uid: uid,
    tier: "pro",
    status: "active",
    stripeCustomerId: "cus_mock_hi",
    aiUsageCurrentMonth: 5,
    aiQuotaLimit: 50,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  console.log("\n🎉 Seed complete!\n")
}

seed().catch(console.error)
