import { initializeApp, getApps } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithEmailAndPassword } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "demo-icecap.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-icecap",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "demo-icecap.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:123456789:web:abcdef",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const db = getFirestore(app)
const auth = getAuth(app)
const functions = getFunctions(app)
const googleProvider = new GoogleAuthProvider()

const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true" || import.meta.env.DEV

if (useEmulator) {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080)
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
    connectFunctionsEmulator(functions, "127.0.0.1", 5001)
    if (typeof window !== "undefined") {
      (window as any).auth = auth
      ;(window as any).signInWithEmailAndPassword = signInWithEmailAndPassword
    }
  } catch {
    // Already connected
  }
}

export { db, auth, functions, googleProvider }
