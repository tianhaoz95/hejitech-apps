import { initializeApp, getApps } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithEmailAndPassword } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"
import { getAI, GoogleAIBackend, VertexAIBackend } from "firebase/ai"

const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: "icecap-platform.firebaseapp.com",
  projectId: useEmulator ? "demo-icecap" : "icecap-platform",
  storageBucket: "icecap-platform.firebasestorage.app",
  messagingSenderId: "117464393734",
  appId: "1:117464393734:web:a6d327244b151879163b87",
  measurementId: "G-V1M7Z1FDT3"
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Initialize analytics if supported (skip in emulator)
if (!useEmulator) {
  isSupported().then(yes => yes && getAnalytics(app))
}

const db = getFirestore(app)
const auth = getAuth(app)
const functions = getFunctions(app)
const googleProvider = new GoogleAuthProvider()

if (useEmulator) {
  // @ts-ignore - Force use of local Gemini Nano in emulator mode
  self.FIREBASE_AI_FORCE_BUILTIN = true
  // @ts-ignore
  self.FIREBASE_AI_USE_BUILTIN = true
  if (typeof window !== "undefined") {
    // @ts-ignore
    window.FIREBASE_AI_FORCE_BUILTIN = true
    // @ts-ignore
    window.FIREBASE_AI_USE_BUILTIN = true
  }
  console.log("[Icecap] AI: Local model flags enabled (FORCE + USE BUILTIN)")
}

const ai = getAI(app, {
  backend: useEmulator ? new GoogleAIBackend() : new VertexAIBackend()
})

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

export { db, auth, functions, googleProvider, ai, useEmulator }
