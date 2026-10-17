import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// Same dual-path pattern as android/ (see AuthManager.kt's doc comment):
// emulator mode by default in dev, real `contempo-str` project in a
// production build. Override with VITE_USE_FIREBASE_EMULATOR=false/true.
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR
  ? import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true"
  : import.meta.env.DEV;

// Web Firebase config is not a secret — security is enforced by Firestore/
// Storage rules, not by hiding this object — but it's still sourced from env
// vars (see .env.example) rather than hardcoded, so per-environment values
// (e.g. a future staging project) don't require code changes.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Callable Cloud Functions — currently just deleteAccount (see
// SettingsPage.tsx and backend/functions/src/account.ts). Region left at the
// default (us-central1), matching where the functions are actually deployed.
export const functions = getFunctions(app);

if (useEmulator) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
}
