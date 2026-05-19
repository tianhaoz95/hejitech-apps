import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: "icecap-platform.firebaseapp.com",
  projectId: "icecap-platform",
  storageBucket: "icecap-platform.firebasestorage.app",
  messagingSenderId: "117464393734",
  appId: "1:117464393734:web:f3526e79da07d84c163b87",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

export { auth, googleProvider }
