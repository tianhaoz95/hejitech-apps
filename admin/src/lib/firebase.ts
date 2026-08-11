import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// Same dual-path pattern as web/src/lib/firebase.ts and android/ (see
// AuthManager.kt's doc comment): emulator mode by default in dev, real
// `contempo-platform` project in a production build.
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR
  ? import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true"
  : import.meta.env.DEV;

// Not a secret — security is enforced by Firestore/Storage rules and the
// admin custom claim, not by hiding this object. See .env.example for why
// this is VITE_ADMIN_FIREBASE_* rather than web/'s VITE_FIREBASE_* names.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_ADMIN_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_ADMIN_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_ADMIN_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_ADMIN_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_ADMIN_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_ADMIN_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_ADMIN_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Callable Cloud Functions — adminListCoupons/adminCreateCoupon/etc (see
// backend/functions-billing/src/index.ts). Region left at the default
// (us-central1), matching where those functions are actually deployed.
export const functions = getFunctions(app);

if (useEmulator) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
  connectStorageEmulator(storage, "localhost", 9199);
}
