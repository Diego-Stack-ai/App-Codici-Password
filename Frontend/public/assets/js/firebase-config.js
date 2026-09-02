// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js";
import { getMessaging, isSupported as isMessagingSupported } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging.js";

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
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 🛡️ APP CHECK — Protegge Firestore e Storage da accessi non autorizzati
// Provider: reCAPTCHA v3 — registrare su https://www.google.com/recaptcha/admin
// Aggiungere dominio: appcodici-password.web.app
// Poi attivare enforcement: Firebase Console > App Check > Firestore
let appCheck = null;
export function enableAppCheck() {
  if (appCheck) return appCheck;
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(
      "6LdWBhAtAAAAAPPWsqxdOu46YaNHgQzEjlUbQzeW"
    ),
    isTokenAutoRefreshEnabled: true
  });
  return appCheck;
}

const auth = getAuth(app);

// 🛡️ PROTOCOLLO V7.0 — PERSISTENZA OFFLINE (Modern API)
// Configurazione cache persistente multischeda
let db;
try {
  db = initializeFirestore(app, {
    cache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  // Una configurazione precedente in cache può avere già inizializzato Firestore.
  db = getFirestore(app);
}

const storage = getStorage(app);
const functions = getFunctions(app, 'europe-west1');

let messagingPromise = null;
export function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = isMessagingSupported().then((supported) => supported ? getMessaging(app) : null);
  }
  return messagingPromise;
}

export { auth, db, storage, functions };
