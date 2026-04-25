import { initializeApp, getApps } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"

const useEmulator =
  process.env.PLASMO_PUBLIC_USE_EMULATOR === "true" ||
  process.env.NODE_ENV === "development"

const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: process.env.PLASMO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "demo-icecap.firebaseapp.com",
  projectId: useEmulator ? "demo-icecap" : (process.env.PLASMO_PUBLIC_FIREBASE_PROJECT_ID ?? "icecap-platform"),
  storageBucket: process.env.PLASMO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "demo-icecap.appspot.com",
  messagingSenderId: process.env.PLASMO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "117464393734",
  appId: process.env.PLASMO_PUBLIC_FIREBASE_APP_ID ?? "1:117464393734:web:abcdef",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)
const auth = getAuth(app)
const functions = getFunctions(app)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

if (useEmulator) {
  console.log("Firebase using local emulators (127.0.0.1)");
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080)
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
    connectFunctionsEmulator(functions, "127.0.0.1", 5001)
    if (typeof window !== "undefined") {
      (window as any).auth = auth
    }
  } catch {
    // Already connected (hot reload)
  }
}

export { db, auth, functions, googleProvider }
