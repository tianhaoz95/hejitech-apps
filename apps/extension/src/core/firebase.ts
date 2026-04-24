import { initializeApp, getApps } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"

const firebaseConfig = {
  apiKey: process.env.PLASMO_PUBLIC_FIREBASE_API_KEY ?? "demo-key",
  authDomain: process.env.PLASMO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo-icecap.firebaseapp.com",
  projectId: process.env.PLASMO_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-icecap",
  storageBucket: process.env.PLASMO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "demo-icecap.appspot.com",
  messagingSenderId: process.env.PLASMO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "123456789",
  appId: process.env.PLASMO_PUBLIC_FIREBASE_APP_ID ?? "1:123456789:web:abcdef",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)
const auth = getAuth(app)
const functions = getFunctions(app)

const useEmulator =
  process.env.PLASMO_PUBLIC_USE_EMULATOR === "true" ||
  process.env.NODE_ENV === "development"

if (useEmulator) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080)
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true })
    connectFunctionsEmulator(functions, "localhost", 5001)
    if (typeof window !== "undefined") {
      (window as any).auth = auth
    }
  } catch {
    // Already connected (hot reload)
  }
}

export { db, auth, functions }
