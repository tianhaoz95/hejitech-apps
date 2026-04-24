/**
 * Seed the Firebase Emulator with test data.
 * Run: node scripts/seed-emulator.mjs
 */

const FIRESTORE_BASE = "http://localhost:8080/v1/projects/demo-icecap/databases/(default)/documents"
const AUTH_BASE = "http://localhost:9099"

async function createUser(email, password) {
  const resp = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Failed to create user: ${JSON.stringify(data)}`)
  console.log(`✅ Created user: ${email} (${data.localId})`)
  return data.localId
}

async function setDocument(path, fields) {
  const url = `${FIRESTORE_BASE}/${path}`
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Failed to set ${path}: ${err}`)
  }
  console.log(`✅ Set document: ${path}`)
}

async function addDocument(collectionPath, fields) {
  const url = `${FIRESTORE_BASE}/${collectionPath}`
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Failed to add to ${collectionPath}: ${err}`)
  }
  const data = await resp.json()
  const id = data.name.split("/").pop()
  console.log(`✅ Added document: ${collectionPath}/${id}`)
  return id
}

function strVal(v) { return { stringValue: String(v) } }
function intVal(v) { return { integerValue: String(v) } }
function boolVal(v) { return { booleanValue: v } }
function numVal(v) { return { doubleValue: v } }

async function seed() {
  console.log("\n🌱 Seeding Firebase Emulator...\n")

  // ─── Test users ──────────────────────────────────────────────────────────

  const proUid = await createUser("pro-user@icecap-test.com", "TestPass123!")
  const proMaxUid = await createUser("promax-user@icecap-test.com", "TestPass123!")
  const pastDueUid = await createUser("pastdue-user@icecap-test.com", "TestPass123!")

  // ─── Subscriptions ───────────────────────────────────────────────────────

  const now = Date.now()
  const trialEnd = now + 30 * 24 * 3600 * 1000

  await setDocument(`subscriptions/${proUid}`, {
    uid: strVal(proUid),
    tier: strVal("pro"),
    status: strVal("trialling"),
    stripeCustomerId: strVal("cus_mock_pro"),
    aiUsageCurrentMonth: intVal(12),
    aiQuotaLimit: intVal(50),
    trialEnd: intVal(trialEnd),
    currentPeriodEnd: intVal(trialEnd),
    createdAt: intVal(now),
    updatedAt: intVal(now),
  })

  await setDocument(`subscriptions/${proMaxUid}`, {
    uid: strVal(proMaxUid),
    tier: strVal("pro_max"),
    status: strVal("active"),
    stripeCustomerId: strVal("cus_mock_promax"),
    aiUsageCurrentMonth: intVal(0),
    aiQuotaLimit: intVal(999999),
    createdAt: intVal(now),
    updatedAt: intVal(now),
  })

  await setDocument(`subscriptions/${pastDueUid}`, {
    uid: strVal(pastDueUid),
    tier: strVal("pro"),
    status: strVal("past_due"),
    stripeCustomerId: strVal("cus_mock_pastdue"),
    aiUsageCurrentMonth: intVal(0),
    aiQuotaLimit: intVal(50),
    createdAt: intVal(now),
    updatedAt: intVal(now),
  })

  // ─── Sample properties ───────────────────────────────────────────────────

  const sampleProps = [
    {
      mode: "rental",
      price: 350000,
      address: "1234 Oak Street, Austin, TX 78701",
      url: "https://www.redfin.com/TX/Austin/1234-Oak-St",
      taxes: 7000,
      hoa: 150,
      estimatedRent: 2400,
      rehabCost: 5000,
      arv: 380000,
      holdingCosts: 0,
    },
    {
      mode: "flip",
      price: 220000,
      address: "5678 Elm Avenue, Austin, TX 78702",
      url: "https://www.zillow.com/TX/Austin/5678-Elm-Ave",
      taxes: 4400,
      hoa: 0,
      estimatedRent: 0,
      rehabCost: 35000,
      arv: 310000,
      holdingCosts: 8000,
    },
    {
      mode: "rental",
      price: 280000,
      address: "999 Maple Drive, Austin, TX 78703",
      url: "https://www.realtor.com/TX/Austin/999-Maple-Dr",
      taxes: 5600,
      hoa: 80,
      estimatedRent: 1900,
      rehabCost: 10000,
      arv: 305000,
      holdingCosts: 0,
    },
  ]

  for (const prop of sampleProps) {
    const downPayment = prop.price * 0.2
    const loanAmount = prop.price - downPayment
    const monthlyRate = 0.07 / 12
    const n = 360
    const mortgage = (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) / (Math.pow(1 + monthlyRate, n) - 1)
    const monthlyExpenses = prop.taxes / 12 + prop.hoa + prop.estimatedRent * 0.18
    const cashFlow = prop.estimatedRent - mortgage - monthlyExpenses
    const capRate = ((prop.estimatedRent - monthlyExpenses) * 12 / prop.price) * 100

    const grm = prop.estimatedRent > 0 ? prop.price / (prop.estimatedRent * 12) : 0
    const onePercentRule = prop.price > 0 ? (prop.estimatedRent / prop.price) * 100 : 0

    await addDocument(`users/${proUid}/properties`, {
      mode: strVal(prop.mode),
      price: intVal(prop.price),
      address: strVal(prop.address),
      url: strVal(prop.url),
      taxes: intVal(prop.taxes),
      hoa: intVal(prop.hoa),
      estimatedRent: intVal(prop.estimatedRent),
      rehabCost: intVal(prop.rehabCost),
      arv: intVal(prop.arv),
      holdingCosts: intVal(prop.holdingCosts),
      "rentalMetrics.monthlyCashFlow": numVal(Math.round(cashFlow * 100) / 100),
      "rentalMetrics.capRate": numVal(Math.round(capRate * 100) / 100),
      "rentalMetrics.cocReturn": numVal(4.2),
      "rentalMetrics.grm": numVal(Math.round(grm * 100) / 100),
      "rentalMetrics.onePercentRule": numVal(Math.round(onePercentRule * 100) / 100),
      "rentalMetrics.totalCashToClose": numVal(downPayment + prop.rehabCost + prop.price * 0.03),
      userId: strVal(proUid),
      createdAt: intVal(now),
      updatedAt: intVal(now),
    })
  }

  // ─── Promo codes ─────────────────────────────────────────────────────────

  await addDocument("promo_codes", {
    code: strVal("ICECAP2026"),
    type: strVal("internal_free"),
    usageLimit: intVal(100),
    usageCount: intVal(3),
    isActive: boolVal(true),
    createdBy: strVal("admin"),
    createdAt: intVal(now),
  })

  await addDocument("promo_codes", {
    code: strVal("INVESTOR20"),
    type: strVal("stripe_linked"),
    stripeCouponId: strVal("coupon_20pct_off"),
    usageLimit: intVal(500),
    usageCount: intVal(47),
    isActive: boolVal(true),
    createdBy: strVal("admin"),
    createdAt: intVal(now),
  })

  console.log("\n🎉 Seed complete!\n")
  console.log("Test accounts:")
  console.log("  Pro (trialling):  pro-user@icecap-test.com / TestPass123!")
  console.log("  Pro Max (active): promax-user@icecap-test.com / TestPass123!")
  console.log("  Past Due:         pastdue-user@icecap-test.com / TestPass123!")
  console.log("\nPromo codes: ICECAP2026, INVESTOR20\n")
}

seed().catch((e) => {
  console.error("Seed failed:", e)
  process.exit(1)
})
