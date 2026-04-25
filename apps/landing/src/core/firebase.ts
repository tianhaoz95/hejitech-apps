// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1D2A0h-IUcIyJynq7lh_scNZL6IrXVpc",
  authDomain: "icecap-platform.firebaseapp.com",
  projectId: "icecap-platform",
  storageBucket: "icecap-platform.firebasestorage.app",
  messagingSenderId: "117464393734",
  appId: "1:117464393734:web:6186b97673fc9307163b87",
  measurementId: "G-SJ1NEM9G0J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export default app;
