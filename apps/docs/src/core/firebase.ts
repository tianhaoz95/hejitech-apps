import { initializeApp, getApps } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"

const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: "icecap-platform.firebaseapp.com",
  projectId: useEmulator ? "demo-icecap" : "icecap-platform",
  storageBucket: "icecap-platform.firebasestorage.app",
  messagingSenderId: "117464393734",
  appId: "1:117464393734:web:f3526e79da07d84c163b87",
  measurementId: "G-LE13J3TJG4"
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Initialize analytics if supported
isSupported().then(yes => yes && getAnalytics(app))

const db = getFirestore(app)
const auth = getAuth(app)
const functions = getFunctions(app)
const googleProvider = new GoogleAuthProvider()

if (useEmulator) {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080)
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
    connectFunctionsEmulator(functions, "127.0.0.1", 5001)
  } catch {}
}

export { db, auth, functions, googleProvider, useEmulator }
