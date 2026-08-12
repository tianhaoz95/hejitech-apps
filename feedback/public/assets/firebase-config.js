// Config for the "Contempo Feedback" Firebase Web App — a separate app
// registration from "Contempo Web" (see web/src/lib/firebase.ts), even
// though both live in the same contempo-str project. Not a secret:
// security is enforced by Firestore rules, not by hiding this object — see
// web/src/lib/firebase.ts's comment for the same reasoning. Regenerate via:
//   firebase apps:sdkconfig WEB 1:664765495548:web:c8ea0292ee5b4d31207f79 --project contempo-str
export const firebaseConfig = {
  apiKey: "AIzaSyDgbc4DCYmolfb6zKNwk6dl2Gt4mre2Ang",
  authDomain: "contempo-str.firebaseapp.com",
  projectId: "contempo-str",
  storageBucket: "contempo-str.firebasestorage.app",
  messagingSenderId: "664765495548",
  appId: "1:664765495548:web:c8ea0292ee5b4d31207f79",
  measurementId: "G-N5T4FDCRZN",
};
