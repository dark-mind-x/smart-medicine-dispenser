import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBzYhd38IXSGek6BefLIGjl3MDcAZcMuaI",
  authDomain: "smart-medicine-dispenser-83235.firebaseapp.com",
  databaseURL: "https://smart-medicine-dispenser-83235-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-medicine-dispenser-83235",
  storageBucket: "smart-medicine-dispenser-83235.firebasestorage.app",
  messagingSenderId: "41724918233",
  appId: "1:41724918233:web:287dc5942e9026cf5481c8",
  measurementId: "G-3KHX5L4PYT"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
