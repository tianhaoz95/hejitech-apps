import { initializeApp } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, connectAuthEmulator } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator } from "firebase/functions"
import { GoogleGenerativeAI } from "@google/generative-ai"

const firebaseConfig = {
  apiKey: "demo-key",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)
const functions = getFunctions(app)

// Use emulators if running locally
if (process.env.NODE_ENV === "development") {
  connectFirestoreEmulator(db, "localhost", 8080)
  connectAuthEmulator(auth, "http://localhost:9099")
  connectFunctionsEmulator(functions, "localhost", 5001)
}

export { db, auth, functions }

// Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.PLASMO_PUBLIC_GEMINI_API_KEY || "dummy-key")
export const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
