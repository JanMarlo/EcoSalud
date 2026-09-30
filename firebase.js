import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDdhSmf6tOw4wzQLNuBW_GdBMOuuAYgnoI",
  authDomain: "ecosalud-de22c.firebaseapp.com",
  projectId: "ecosalud-de22c",
  messagingSenderId: "223749892216",
  appId: "1:223749892216:web:f64c88358b059321cca58d",
};

let app;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app);
