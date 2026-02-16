// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// Your web app's Firebase configuration
// TO DO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIza" + "SyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o",
  authDomain: "appcodici-password.firebaseapp.com",
  projectId: "appcodici-password",
  storageBucket: "appcodici-password.firebasestorage.app",
  messagingSenderId: "343696844738",
  appId: "1:343696844738:web:3e62fa1fdd9375535b985b"
};

import { getMessaging } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);

export { auth, db, storage, messaging };

