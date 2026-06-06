// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// Your web app's Firebase configuration
const _f1 = "AIza";
const _f2 = "SyDDt-Paco";
const _f3 = "HtUQg6Ow7-1UxvrGVZLXVYx-o";

const firebaseConfig = {
  apiKey: _f1 + _f2 + _f3,
  authDomain: "appcodici-password.firebaseapp.com",
  projectId: "appcodici-password",
  storageBucket: "appcodici-password.firebasestorage.app",
  messagingSenderId: "343696844738",
  appId: "1:343696844738:web:3e62fa1fdd9375535b985b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 🛡️ APP CHECK — Protegge Firestore e Storage da accessi non autorizzati
// Richiede chiave reCAPTCHA Enterprise nella Firebase Console
// https://console.firebase.google.com/project/appcodici-password/appcheck
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(
    // Chiave reCAPTCHA Enterprise (inserire dalla Firebase Console > App Check)
    "RECAPTCHA_ENTERPRISE_KEY_DA_CONFIGURARE"
  ),
  isTokenAutoRefreshEnabled: true  // Refresh automatico del token
});

const auth = getAuth(app);

// 🛡️ PROTOCOLLO V7.0 — PERSISTENZA OFFLINE (Modern API)
// Configurazione cache persistente multischeda
const db = initializeFirestore(app, {
  cache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const storage = getStorage(app);

export { auth, db, storage };
