import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAAN-6JFEEzDv9H_fK9eC4Eh7CJQbZI11Y",
  authDomain: "control-electoral-libre.firebaseapp.com",
  projectId: "control-electoral-libre",
  storageBucket: "control-electoral-libre.firebasestorage.app",
  messagingSenderId: "593332831012",
  appId: "1:593332831012:web:67a021420cb8b5efb9a9b1",
  measurementId: "G-E5GV00BWD8"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, firebaseConfig };