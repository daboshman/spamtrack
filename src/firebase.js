import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDFsPmjzff1JBCph_SMTHmcMmGIzc5KKzI",
  authDomain: "spam-track.web.app",
  projectId: "spam-track",
  storageBucket: "spam-track.firebasestorage.app",
  messagingSenderId: "87123540306",
  appId: "1:87123540306:web:da46d9021611f68ca0628b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {
  setPersistence(auth, browserSessionPersistence);
});