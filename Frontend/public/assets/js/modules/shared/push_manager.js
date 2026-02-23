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

    // 🚩 AMBIENTE: Evita di salvare token generati su localhost se siamo in produzione
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isProd = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');

    try {
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return null;
        }

        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: VAPID_KEY
        });

        if (token) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            let fcmTokens = [];
            let tokensMetadata = {};

            if (userSnap.exists()) {
                const data = userSnap.data();
                fcmTokens = data.fcmTokens || [];
                tokensMetadata = data.tokensMetadata || {};
            }

            // 🔍 WATCHDOG ANTI-ZOMBIE & DUPLICATI
            const now = new Date().toISOString();
            const deviceType = /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

            // Aggiorna/Aggiunge metadati per il token corrente
            tokensMetadata[token] = {
                createdAt: tokensMetadata[token]?.createdAt || now,
                lastUsed: now,
                deviceType: deviceType,
                userAgent: navigator.userAgent,
                origin: window.location.origin
            };

            // Se il token non è nell'elenco, aggiungilo
            if (!fcmTokens.includes(token)) {
                // Se siamo in produzione e il token è locale, logghiamo ma non blocchiamo se l'utente vuole testare.
                // Tuttavia, per sicurezza seguiamo la direttiva: "token localhost non in produzione".
                if (isProd && isLocal) {
                    console.warn("[PUSH] Blocca salvataggio token localhost su database produzione.");
                    return token;
                }
                fcmTokens.push(token);
            }

            // 🛡️ LIMITE MASSIMO DISPOSITIVI (Watchdog)
            // Se superiamo i 3 token, rimuoviamo i più vecchi basandoci su lastUsed
            if (fcmTokens.length > 3) {
                console.log(`[PUSH] Watchdog: Trovati ${fcmTokens.length} token. Pulizia in corso...`);
                // Ordina i token per data di ultimo utilizzo decrescente
                fcmTokens.sort((a, b) => {
                    const timeA = tokensMetadata[a]?.lastUsed || "";
                    const timeB = tokensMetadata[b]?.lastUsed || "";
                    return timeB.localeCompare(timeA);
                });

                // Taglia l'array ai primi 3 (i più recenti)
                const tokensToRemove = fcmTokens.slice(3);
                fcmTokens = fcmTokens.slice(0, 3);

                // Pulisci metadati
                tokensToRemove.forEach(t => delete tokensMetadata[t]);
                console.log(`[PUSH] Watchdog: Rimossi ${tokensToRemove.length} token obsoleti.`);
            }

            // Aggiornamento Atomico (Rimuove fcmToken legacy)
            const { deleteField } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");

            await updateDoc(userRef, {
                fcmTokens: fcmTokens,
                tokensMetadata: tokensMetadata,
                fcmToken: deleteField(), // 🗑️ Cleanup legacy
                lastTokenRefresh: now
            });

            console.log("[PUSH] Sincronizzazione completata con successo.");
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
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                const fcmTokens = (data.fcmTokens || []).filter(t => t !== token);
                const tokensMetadata = data.tokensMetadata || {};
                delete tokensMetadata[token];

                await updateDoc(userRef, {
                    fcmTokens: fcmTokens,
                    tokensMetadata: tokensMetadata
                });
                console.log("[PUSH] Token e metadati rimossi dal database.");
            }
        }
    } catch (e) {
        console.error("[PUSH] Errore rimozione token:", e);
    }
}

/**
 * Diagnostica completa da console.
 */
export async function debugPushStatus() {
    console.group("🚀 [PUSH DEBUG REPORT]");

    // 1. Supporto Browser
    const supported = isPushSupported();
    console.log("Supporto Push:", supported ? "✅" : "❌");

    // 2. Permessi
    console.log("Stato Permessi Notification:", Notification.permission);

    // 3. Service Worker
    if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        console.log("Service Workers registrati:", regs.length);
        regs.forEach(r => console.log(` - Scope: ${r.scope}, Active: ${!!r.active}`));
    }

    // 4. Token attuale
    if (auth.currentUser) {
        console.log("Utente loggato:", auth.currentUser.email);
        try {
            const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userSnap.exists()) {
                const data = userSnap.data();
                console.log("Prefs Push (Firestore):", data.prefs_push);
                console.log("Token salvati (Array):", data.fcmTokens?.length || 0);
            }
        } catch (e) { console.error("Errore fetch Firestore:", e); }
    } else {
        console.warn("Nessun utente loggato in Auth.");
    }

    console.groupEnd();
}

// Esponi al window per debug immediato (DISABILITATO IN PROD)
// window.debugPush = debugPushStatus;

/**
 * Listener per il refresh automatico del token.
 * Nota: onTokenRefresh è stato rimosso nelle versioni modulari dell'SDK (v9+).
 * La sincronizzazione viene gestita proattivamente all'avvio in home.js.
 */
export function listenForTokenRefresh(user) {
    // Mantenuta per compatibilità di firma ma non più necessaria con getToken() proattivo
}
