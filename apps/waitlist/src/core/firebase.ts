import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true";

const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: "icecap-platform.firebaseapp.com",
  projectId: useEmulator ? "demo-icecap" : "icecap-platform",
  storageBucket: "icecap-platform.firebasestorage.app",
  messagingSenderId: "117464393734",
  appId: "1:117464393734:web:a6d327244b151879163b87",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

if (useEmulator) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
