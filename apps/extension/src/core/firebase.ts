import { initializeApp, getApps } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, initializeAuth, connectAuthEmulator, GoogleAuthProvider, indexedDBLocalPersistence, signInWithCredential } from "firebase/auth/web-extension"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"
import { getAI, GoogleAIBackend } from "firebase/ai"
import { getRemoteConfig, fetchAndActivate, getString } from "firebase/remote-config"

const useEmulator =
  process.env.PLASMO_PUBLIC_USE_EMULATOR === "true"

console.log("[Icecap Debug] PLASMO_PUBLIC_USE_EMULATOR is:", process.env.PLASMO_PUBLIC_USE_EMULATOR)
console.log("[Icecap Debug] useEmulator evaluated to:", useEmulator)

// Helper to get env var with fallback, ignoring dummy values like '...'
const getEnv = (val: string | undefined, fallback: string) => {
  if (!val || val === "..." || val.includes("YOUR_")) return fallback
  return val
}

const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: getEnv(process.env.PLASMO_PUBLIC_FIREBASE_AUTH_DOMAIN, useEmulator ? "demo-icecap.firebaseapp.com" : "icecap-platform.firebaseapp.com"),
  projectId: useEmulator ? "demo-icecap" : getEnv(process.env.PLASMO_PUBLIC_FIREBASE_PROJECT_ID, "icecap-platform"),
  storageBucket: getEnv(process.env.PLASMO_PUBLIC_FIREBASE_STORAGE_BUCKET, useEmulator ? "demo-icecap.appspot.com" : "icecap-platform.firebasestorage.app"),
  messagingSenderId: getEnv(process.env.PLASMO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "117464393734"),
  appId: getEnv(process.env.PLASMO_PUBLIC_FIREBASE_APP_ID, useEmulator ? "1:117464393734:web:abcdef" : "1:117464393734:web:a6d327244b151879163b87"),
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)

// Initialize Auth with IndexedDB persistence for extension environment
let auth;
try {
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence
  })
} catch (e) {
  auth = getAuth(app)
}

const functions = getFunctions(app)

// Initialize Remote Config
const remoteConfig = getRemoteConfig(app)
remoteConfig.defaultConfig = {
  gemini_model_id: useEmulator ? "gemini-nano" : "gemini-3.1-flash-lite-preview"
}

// Set fetch interval: 10s for emulator, 1 minute for production (to speed up dev testing)
remoteConfig.settings.minimumFetchIntervalMillis = useEmulator ? 10000 : 60000

// Both local and production use GoogleAIBackend (Gemini Developer API).
// Local still prioritizes the built-in model (Gemini Nano) via flags below.
const ai = getAI(app, {
  backend: new GoogleAIBackend()
})

if (useEmulator) {
  // @ts-ignore - Force use of local Gemini Nano in emulator mode
  self.FIREBASE_AI_FORCE_BUILTIN = true
  // @ts-ignore
  self.FIREBASE_AI_USE_BUILTIN = true
  console.log("[Icecap] AI: Local model flags enabled (FORCE + USE BUILTIN)")
}

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

if (useEmulator) {
  console.log("Firebase using local emulators (127.0.0.1)");
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080)
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
    connectFunctionsEmulator(functions, "127.0.0.1", 5001)
  } catch {
    // Already connected (hot reload)
  }
}

fetchAndActivate(remoteConfig).then((newConfig) => {
  console.log(`[Icecap] Remote Config: ${newConfig ? "Fetched from server" : "Using cached values"}`)
  console.log("[Icecap] Active Model ID:", getString(remoteConfig, "gemini_model_id"))
}).catch((err) => {
  console.warn("[Icecap] Remote Config fetch failed:", err)
})

export const signInWithGoogle = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const clientId = process.env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error("PLASMO_PUBLIC_GOOGLE_CLIENT_ID is not set in .env"))
      return
    }
    const redirectURL = chrome.identity.getRedirectURL()
    const authURL = new URL("https://accounts.google.com/o/oauth2/auth")
    authURL.searchParams.set("client_id", clientId)
    authURL.searchParams.set("response_type", "token")
    authURL.searchParams.set("redirect_uri", redirectURL)
    authURL.searchParams.set("scope", "email profile openid")

    chrome.identity.launchWebAuthFlow({ url: authURL.toString(), interactive: true }, async (redirectUrl) => {
      try {
        if (chrome.runtime.lastError || !redirectUrl) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Authentication cancelled"))
          return
        }
        const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1))
        const accessToken = params.get("access_token")
        if (!accessToken) { reject(new Error("No access token in response")); return }
        await signInWithCredential(auth, GoogleAuthProvider.credential(null, accessToken))
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })

export { db, auth, functions, ai, googleProvider, useEmulator, remoteConfig }
