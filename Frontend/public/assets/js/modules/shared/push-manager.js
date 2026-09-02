import { auth, db, functions, getMessagingInstance } from '../../firebase-config.js?v=1.1.8';
import { doc, getDoc, serverTimestamp, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js";
import { deleteToken, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging.js";

const VAPID_KEY = 'BA8WqlVxBUaOWPlmyGLTANQz6P_OPT_pvOCSbPsSmx6vfIwtUBWoAzGieZacYK1CLufo2LOWwQxlx9RYEWALhUk';
const DEVICE_ID_KEY = 'codex_push_device_id';
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

export async function getCurrentPushState(user = auth.currentUser) {
    const compatibility = getPushCompatibility();
    if (!user || !compatibility.compatible) return { enabled: false, ...compatibility };
    const snap = await getDoc(doc(db, 'users', user.uid, 'pushDevices', getDeviceId()));
    return {
        compatible: true,
        enabled: Notification.permission === 'granted' && snap.exists() && snap.data().enabled === true,
        permission: Notification.permission
    };
}

export async function enableDeadlinePush(user = auth.currentUser) {
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
    await setDoc(doc(db, 'users', user.uid, 'pushDevices', deviceId), {
        token,
        platform: platformName(),
        browser: navigator.userAgentData?.brands?.map((b) => b.brand).join(', ') || 'browser',
        enabled: true,
        notificationScope: 'deadlines',
        privacyMode: 'detailed',
        schemaVersion: 1,
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
    }, { merge: true });
    return true;
}

export async function disableDeadlinePush(user = auth.currentUser) {
    if (!user) return;
    const messaging = await getMessagingInstance();
    if (messaging) {
        try { await deleteToken(messaging); } catch (error) { console.warn('[PUSH] Revoca token locale non riuscita', error); }
    }
    await deleteDoc(doc(db, 'users', user.uid, 'pushDevices', getDeviceId()));
}

export async function sendDeadlinePushTest() {
    const call = httpsCallable(functions, 'sendDeadlinePushTest');
    return (await call({ deviceId: getDeviceId() })).data;
}

export async function listenForDeadlinePushInForeground() {
    if (foregroundListenerStarted || Notification.permission !== 'granted') return;
    const messaging = await getMessagingInstance();
    if (!messaging) return;
    foregroundListenerStarted = true;
    onMessage(messaging, async (payload) => {
        if (payload.data?.eventType !== 'deadline') return;
        const registration = await serviceWorkerRegistration();
        await registration.showNotification(payload.data.title || 'Codici & Password', {
            body: payload.data.body || 'Hai una scadenza in arrivo.',
            icon: './assets/images/app-icon-192.png',
            badge: './assets/images/app-icon-192.png',
            tag: payload.data.deliveryTag || `deadline-${payload.data.deadlineId || 'reminder'}`,
            data: { eventType: 'deadline', deadlineId: payload.data.deadlineId || '' }
        });
    });
}
