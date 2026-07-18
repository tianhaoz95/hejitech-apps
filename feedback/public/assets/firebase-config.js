// Config for the "Contempo Feedback" Firebase Web App — a separate app
// registration from "Contempo Web" (see web/src/lib/firebase.ts), even
// though both live in the same contempo-platform project. Not a secret:
// security is enforced by Firestore rules, not by hiding this object — see
// web/src/lib/firebase.ts's comment for the same reasoning. Regenerate via:
//   firebase apps:sdkconfig WEB 1:646737053318:web:c3b24b46ce90169cac3307 --project contempo-platform
export const firebaseConfig = {
  apiKey: "AIzaSyDINP38Ufl3ZO0V1ISSNbwqdAOF6RE32YA",
  authDomain: "contempo-platform.firebaseapp.com",
  projectId: "contempo-platform",
  storageBucket: "contempo-platform.firebasestorage.app",
  messagingSenderId: "646737053318",
  appId: "1:646737053318:web:c3b24b46ce90169cac3307",
  measurementId: "G-QRSGK3DYZX",
};
