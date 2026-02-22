/**
 * PUSH MANAGER (V5.0 - PRO)
 * Sistema centralizzato per la gestione dei token Firebase Cloud Messaging.
 * Supporta multi-device, auto-healing e pulizia automatica.
 */

import { auth, db, messaging } from '../../firebase-config.js';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging.js";

const VAPID_KEY = 'BLeoqii3Y7Qdd-mdHeUbroeLmRN4JzsoYAzMsO39W2TUDrV_2c_Gs9MMajKdBEI4_iRnkUMvS-zP8Xyz5eieJ3M';

/**
 * Verifica se l'ambiente supporta le notifiche push.
 */
export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Verifica restrizioni specifiche (es. iOS non PWA).
 */
export function checkPushCompatibility() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isStandalone) {
        console.warn("[PUSH] Su iOS le notifiche funzionano solo se l'app è installata nella Home (PWA).");
        return { compatible: false, reason: 'ios_not_pwa' };
    }

    if (!isPushSupported()) {
        return { compatible: false, reason: 'unsupported_browser' };
    }

    return { compatible: true };
}

/**
 * Sincronizza il token FCM dell'utente attuale con Firestore.
 * Da chiamare ad ogni avvio della Home o quando si attiva il toggle.
 */
export async function syncPushToken(user) {
    if (!user || !isPushSupported()) return null;

    const comp = checkPushCompatibility();
    if (!comp.compatible) return null;

    try {
        // 1. Verifica permessi
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;
        }

        // 2. Registrazione Service Worker (fondamentale per getToken)
        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');

        // 3. Ottieni Token
        const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY
        });

        if (token) {
            console.log("[PUSH] Token sincronizzato correttamente.");
            const userRef = doc(db, "users", user.uid);

            // Aggiornamento atomico: aggiunge il token all'array fcmTokens
            // e lo imposta anche come token principale fcmToken (legacy compatibility)
            await updateDoc(userRef, {
                fcmToken: token,
                fcmTokens: arrayUnion(token),
                lastTokenRefresh: new Date().toISOString()
            });

            return token;
        }
    } catch (e) {
        console.error("[PUSH] Errore sincronizzazione token:", e);
    }
    return null;
}

/**
 * Rimuove il token corrente (es. al logout o toggle OFF).
 */
export async function removePushToken(user) {
    if (!user || !isPushSupported()) return;

    try {
        // Nota: non possiamo revocare il token lato server facilmente senza admin SDK,
        // ma lo rimuoviamo dal database per smettere di inviare notifiche.
        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY
        });

        if (token) {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                fcmTokens: arrayRemove(token)
            });
            console.log("[PUSH] Token rimosso dal database.");
        }
    } catch (e) {
        console.error("[PUSH] Errore rimozione token:", e);
    }
}

/**
 * Listener per il refresh automatico del token.
 * Nota: onTokenRefresh è stato rimosso nelle versioni modulari dell'SDK (v9+).
 * La sincronizzazione viene gestita proattivamente all'avvio in home.js.
 */
export function listenForTokenRefresh(user) {
    // Mantenuta per compatibilità di firma ma non più necessaria con getToken() proattivo
}
