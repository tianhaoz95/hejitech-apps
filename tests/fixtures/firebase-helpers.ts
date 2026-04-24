import type { Page } from "@playwright/test"

const FIRESTORE_BASE = "http://localhost:8080/v1/projects/demo-icecap/databases/(default)/documents"
const AUTH_BASE = "http://localhost:9099"

// Create a test user in Firebase Auth emulator
export async function createTestUser(email: string, password: string): Promise<string> {
  const resp = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  if (!resp.ok) throw new Error(`Failed to create user: ${await resp.text()}`)
  const data = (await resp.json()) as { localId: string }
  return data.localId
}

// Sign in and return ID token
export async function signInTestUser(email: string, password: string): Promise<{ uid: string; idToken: string }> {
  const resp = await fetch(
    `${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )
  if (!resp.ok) throw new Error(`Sign in failed: ${await resp.text()}`)
  const data = (await resp.json()) as { localId: string; idToken: string }
  return { uid: data.localId, idToken: data.idToken }
}

// Write subscription document via emulator REST API
export async function setSubscription(
  uid: string,
  status: string,
  tier: string = "pro"
): Promise<void> {
  const url = `${FIRESTORE_BASE}/subscriptions/${uid}`
  const body = {
    fields: {
      uid: { stringValue: uid },
      tier: { stringValue: tier },
      status: { stringValue: status },
      aiUsageCurrentMonth: { integerValue: "0" },
      aiQuotaLimit: { integerValue: "50" },
      updatedAt: { integerValue: String(Date.now()) },
      createdAt: { integerValue: String(Date.now()) },
    },
  }
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`Failed to set subscription: ${await resp.text()}`)
}

// Write a property document
export async function addProperty(uid: string, property: Record<string, unknown>): Promise<string> {
  const url = `${FIRESTORE_BASE}/users/${uid}/properties`
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(property).map(([k, v]) => [k, { stringValue: String(v) }])
      ),
    }),
  })
  if (!resp.ok) throw new Error(`Failed to add property: ${await resp.text()}`)
  const data = (await resp.json()) as { name: string }
  return data.name.split("/").pop() ?? ""
}

// Clear all user data
export async function clearEmulatorData(): Promise<void> {
  await fetch("http://localhost:8080/emulator/v1/projects/demo-icecap/databases/(default)/documents", {
    method: "DELETE",
  })
  await fetch(`${AUTH_BASE}/emulator/v1/projects/demo-icecap/accounts`, {
    method: "DELETE",
  })
}

// Sign in via Firebase Auth emulator on a Playwright page
export async function signInOnPage(page: Page, email: string, password: string): Promise<void> {
  // Inject auth state by calling Firebase signInWithEmailAndPassword via page eval
  await page.evaluate(
    async ({ email, password }) => {
      const { getAuth, signInWithEmailAndPassword } = await import(
        "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js"
      )
      // The app should already be initialized on the page
      const auth = getAuth()
      await signInWithEmailAndPassword(auth, email, password)
    },
    { email, password }
  )
}
