import { getDocSmart as getDoc } from "/assets/js/offline-firestore.js";
import { auth, db, functions, getMessagingInstance } from '../../firebase-config.js?v=1.2.38';
import { doc, serverTimestamp, setDoc, deleteDoc } from "/assets/js/vendor/firebase-runtime.js";
import { httpsCallable } from "/assets/js/vendor/firebase-runtime.js";
import { deleteToken, getToken, onMessage } from "/assets/js/vendor/firebase-runtime.js";

const VAPID_KEY = 'BA8WqlVxBUaOWPlmyGLTANQz6P_OPT_pvOCSbPsSmx6vfIwtUBWoAzGieZacYK1CLufo2LOWwQxlx9RYEWALhUk';
const DEVICE_ID_KEY = 'codex_push_device_id';
const LAST_TEST_KEY = 'codex_push_last_test_at';
let foregroundListenerStarted = false;

function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

function platformName() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    return 'other';
}

export function getPushCompatibility() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return { compatible: false, reason: 'Browser non compatibile con le notifiche Push.' };
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (ios && !standalone) {
        return { compatible: false, reason: 'Su iPhone aggiungi prima l’app alla schermata Home.' };
    }
    return { compatible: true, reason: '' };
}

async function serviceWorkerRegistration() {
    const registration = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    return registration;
}

export async function getCurrentPushState(user = auth.currentUser, scope = 'deadlines') {
    const compatibility = getPushCompatibility();
    if (!user || !compatibility.compatible) return { enabled: false, ...compatibility };
    const snap = await getDoc(doc(db, 'users', user.uid, 'pushDevices', getDeviceId()));
    const scopes = snap.exists() && Array.isArray(snap.data().notificationScopes)
        ? snap.data().notificationScopes : (snap.exists() ? [snap.data().notificationScope] : []);
    return {
        compatible: true,
        enabled: Notification.permission === 'granted' && snap.exists() && snap.data().enabled === true && scopes.includes(scope),
        permission: Notification.permission
    };
}

async function enablePushScope(scope, user = auth.currentUser) {
    const compatibility = getPushCompatibility();
    if (!user) throw new Error('Accesso richiesto.');
    if (!compatibility.compatible) throw new Error(compatibility.reason);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permesso notifiche non concesso.');

    const messaging = await getMessagingInstance();
    if (!messaging) throw new Error('Firebase Messaging non è supportato su questo dispositivo.');
    const registration = await serviceWorkerRegistration();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) throw new Error('Firebase non ha restituito il token del dispositivo.');

    const deviceId = getDeviceId();
    const deviceRef = doc(db, 'users', user.uid, 'pushDevices', deviceId);
    const existing = await getDoc(deviceRef);
    const previousScopes = existing.exists() && Array.isArray(existing.data().notificationScopes)
        ? existing.data().notificationScopes : (existing.exists() && existing.data().notificationScope ? [existing.data().notificationScope] : []);
    const notificationScopes = [...new Set([...previousScopes, scope])];
    await setDoc(deviceRef, {
        token,
        platform: platformName(),
        browser: navigator.userAgentData?.brands?.map((b) => b.brand).join(', ') || 'browser',
        enabled: true,
        notificationScope: 'deadlines',
        notificationScopes,
        privacyMode: 'detailed',
        schemaVersion: 1,
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
    }, { merge: true });
    return true;
}

export async function enableDeadlinePush(user = auth.currentUser) { return enablePushScope('deadlines', user); }
export async function enableSharingPush(user = auth.currentUser) { return enablePushScope('sharing', user); }

export async function disableDeadlinePush(user = auth.currentUser) {
    return disablePushScope('deadlines', user);
}

async function disablePushScope(scope, user = auth.currentUser) {
    if (!user) return;
    const deviceRef = doc(db, 'users', user.uid, 'pushDevices', getDeviceId());
    const snap = await getDoc(deviceRef);
    const scopes = snap.exists() && Array.isArray(snap.data().notificationScopes)
        ? snap.data().notificationScopes : (snap.exists() && snap.data().notificationScope ? [snap.data().notificationScope] : []);
    const remaining = scopes.filter(item => item !== scope);
    if (remaining.length) return setDoc(deviceRef, { notificationScopes: remaining, updatedAt: serverTimestamp() }, { merge: true });
    const messaging = await getMessagingInstance();
    if (messaging) try { await deleteToken(messaging); } catch (error) { console.warn('[PUSH] Revoca token locale non riuscita', error); }
    await deleteDoc(deviceRef);
}

export async function disableSharingPush(user = auth.currentUser) { return disablePushScope('sharing', user); }

export async function sendDeadlinePushTest() {
    const lastTestAt = Number(localStorage.getItem(LAST_TEST_KEY) || 0);
    const remainingSeconds = Math.ceil((60000 - (Date.now() - lastTestAt)) / 1000);
    if (remainingSeconds > 0) throw new Error(`Attendi ancora ${remainingSeconds} secondi prima di riprovare.`);
    const call = httpsCallable(functions, 'sendDeadlinePushTest');
    const result = (await call({ deviceId: getDeviceId() })).data;
    if (!result?.ok && result?.cooldownSeconds) {
        localStorage.setItem(LAST_TEST_KEY, String(Date.now() - (60000 - result.cooldownSeconds * 1000)));
        throw new Error(`Attendi ancora ${result.cooldownSeconds} secondi prima di riprovare.`);
    }
    localStorage.setItem(LAST_TEST_KEY, String(Date.now()));
    return result;
}

export async function listenForDeadlinePushInForeground() {
    if (foregroundListenerStarted || Notification.permission !== 'granted') return;
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    foregroundListenerStarted = true;
    onMessage(messaging, async (payload) => {
        if (!['deadline', 'external_deadline', 'share_invite'].includes(payload.data?.eventType)) return;
        const registration = await serviceWorkerRegistration();
        await registration.showNotification(payload.data.title || 'Codici & Password', {
            body: payload.data.body || 'Hai una scadenza in arrivo.',
            icon: './assets/images/app-icon-192.png',
            badge: './assets/images/app-icon-192.png',
            tag: payload.data.deliveryTag || `deadline-${payload.data.deadlineId || 'reminder'}`,
            renotify: true,
            timestamp: Date.now(),
            data: {
                eventType: payload.data.eventType,
                deadlineId: payload.data.deadlineId || '',
                notificationId: payload.data.notificationId || ''
            }
        });
    });
}
