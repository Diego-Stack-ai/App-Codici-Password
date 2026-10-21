import { auth, db, functions } from '../../firebase-config.js?v=1.2.218';
import { doc, serverTimestamp, setDoc, deleteDoc } from "/assets/js/vendor/firebase-runtime.js";
import { httpsCallable } from "/assets/js/vendor/firebase-runtime.js";
import { deleteToken, getPushMessagingInstance, getToken, onMessage } from '../../push-messaging-client.js?push=20261019c';
import { getPushDevice, getPushDeviceConfirmed } from '../data/vault-repository.js';

const VAPID_KEY = 'BA8WqlVxBUaOWPlmyGLTANQz6P_OPT_pvOCSbPsSmx6vfIwtUBWoAzGieZacYK1CLufo2LOWwQxlx9RYEWALhUk';
const DEVICE_ID_KEY = 'codex_push_device_id';
const LAST_TEST_KEY = 'codex_push_last_test_at';
const ACTIVE_SCOPES_KEY = 'codex_push_active_scopes';
const PUSH_SW_GENERATION_KEY = 'codex_push_sw_generation';
const PUSH_SW_PATH = '/firebase-messaging-sw.js';
const PUSH_SW_SCOPE = '/firebase-cloud-messaging-push-scope';
let foregroundListenerStarted = false;

function rememberActiveScopes(scopes) {
    localStorage.setItem(ACTIVE_SCOPES_KEY, JSON.stringify([...new Set(scopes.filter(Boolean))]));
}

function rememberedActiveScopes() {
    try {
        const scopes = JSON.parse(localStorage.getItem(ACTIVE_SCOPES_KEY) || '[]');
        return Array.isArray(scopes) ? scopes.filter(scope => ['deadlines', 'sharing'].includes(scope)) : [];
    } catch {
        localStorage.removeItem(ACTIVE_SCOPES_KEY);
        return [];
    }
}

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

async function waitForActiveWorker(registration) {
    if (registration.active) return registration;
    const worker = registration.installing || registration.waiting;
    if (!worker) throw new TypeError('Il Service Worker Push non ha avviato l’installazione.');
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new TypeError('Attivazione del Service Worker Push scaduta.')), 15000);
        const checkState = () => {
            if (worker.state === 'activated') {
                clearTimeout(timeout);
                worker.removeEventListener('statechange', checkState);
                resolve();
            } else if (worker.state === 'redundant') {
                clearTimeout(timeout);
                worker.removeEventListener('statechange', checkState);
                reject(new TypeError('Installazione del Service Worker Push non riuscita.'));
            }
        };
        worker.addEventListener('statechange', checkState);
        checkState();
    });
    return registration;
}

function pushWorkerGeneration() {
    const value = Number.parseInt(localStorage.getItem(PUSH_SW_GENERATION_KEY) || '0', 10);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function pushWorkerScope(generation = pushWorkerGeneration()) {
    return generation > 0 ? `${PUSH_SW_SCOPE}-r${generation}/` : PUSH_SW_SCOPE;
}

async function registerPushWorker(generation = pushWorkerGeneration()) {
    const registration = await navigator.serviceWorker.register(PUSH_SW_PATH, {
        scope: pushWorkerScope(generation)
    });
    return waitForActiveWorker(registration);
}

async function serviceWorkerRegistration() {
    return registerPushWorker();
}

async function rotatePushWorkerRegistration() {
    const generation = pushWorkerGeneration() + 1;
    const registration = await registerPushWorker(generation);
    localStorage.setItem(PUSH_SW_GENERATION_KEY, String(generation));
    return registration;
}

async function unregisterReplacedPushWorker(registration) {
    if (!registration) return;
    try { await registration.unregister(); } catch (error) {
        console.warn('[PUSH] Service Worker precedente non revocabile.', error);
    }
}

function pushErrorMessage(error) {
    const code = String(error?.code || '');
    if (code.includes('permission-blocked') || Notification.permission === 'denied') {
        return 'Le notifiche sono bloccate nel browser. Abilitale nelle autorizzazioni del sito e riprova.';
    }
    if (code.includes('unsupported-browser') || code.includes('indexed-db-unsupported')) {
        return 'Il browser non supporta completamente le notifiche Push o il relativo archivio locale.';
    }
    if (code.includes('token-subscribe') || code.includes('fid-registration')) {
        return 'Registrazione notifiche non riuscita. Controlla la connessione e riprova.';
    }
    return 'Configurazione notifiche non riuscita su questo dispositivo. Ricarica la pagina e riprova.';
}

async function resetLocalPushSubscription(messaging, registration) {
    try { await deleteToken(messaging); } catch (error) { console.warn('[PUSH] Token locale precedente non revocabile.', error); }
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
    } catch (error) {
        console.warn('[PUSH] Sottoscrizione browser precedente non revocabile.', error);
    }
}

async function getTokenWithLocalRecovery(messaging, registration) {
    // Associa esplicitamente il token al worker che gestisce le notifiche:
    // su iOS/PWA evita che il rinnovo utilizzi una registrazione differente.
    const options = { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration };
    try {
        return await getToken(messaging, options);
    } catch (firstError) {
        const firstCode = String(firstError?.code || '');
        const recoverable = firstCode.includes('token-subscribe')
            || firstCode.includes('token-unsubscribe')
            || firstCode.includes('fid-registration');
        console.warn('[PUSH] Prima registrazione FCM fallita.', firstError);
        if (!recoverable) {
            throw new Error(pushErrorMessage(firstError));
        }

        console.warn('[PUSH] Registrazione locale non valida: eseguo un solo tentativo di ripristino.');
        await resetLocalPushSubscription(messaging, registration);
        try {
            return await getToken(messaging, options);
        } catch (retryError) {
            console.error('[PUSH] Ripristino registrazione locale fallito.', retryError);
            throw new Error(pushErrorMessage(retryError));
        }
    }
}

export async function getCurrentPushState(user = auth.currentUser, scope = 'deadlines') {
    const compatibility = getPushCompatibility();
    if (!user || !compatibility.compatible) return { enabled: false, ...compatibility };
    const device = await getPushDevice(user.uid, getDeviceId());
    const scopes = Array.isArray(device?.notificationScopes)
        ? device.notificationScopes : (device ? [device.notificationScope] : []);
    // Se il backend ha invalidato un token, conserviamo l'intenzione locale:
    // al prossimo avvio il dispositivo potrà registrarsi di nuovo.
    if (device?.enabled === true) rememberActiveScopes(scopes);
    else if (device?.status !== 'invalid') rememberActiveScopes([]);
    return {
        compatible: true,
        enabled: Notification.permission === 'granted' && device?.enabled === true && scopes.includes(scope),
        permission: Notification.permission
    };
}

async function writePushRegistration(user, scopes, {forceReset = false} = {}) {
    let messaging;
    try {
        messaging = await getPushMessagingInstance();
    } catch (error) {
        console.error('[PUSH] Inizializzazione Firebase Messaging fallita.', error);
        throw new Error(pushErrorMessage(error));
    }
    if (!messaging) throw new Error('Firebase Messaging non è supportato su questo dispositivo.');
    let registration;
    let replacedRegistration = null;
    try {
        registration = await serviceWorkerRegistration();
    } catch (error) {
        console.error('[PUSH] Service Worker non disponibile.', error);
        throw new Error('Impossibile preparare le notifiche su questo dispositivo. Ricarica la pagina e riprova.');
    }
    if (forceReset) {
        replacedRegistration = registration;
        await resetLocalPushSubscription(messaging, registration);
        // Su iOS una unsubscribe può restituire la stessa sottoscrizione. Un nuovo
        // scope crea invece una registrazione Web Push distinta e impedisce al SDK
        // Firebase di riutilizzare il token FCM già rifiutato dal backend.
        registration = await rotatePushWorkerRegistration();
    }
    const token = await getTokenWithLocalRecovery(messaging, registration);
    if (!token) throw new Error('Firebase non ha restituito il token del dispositivo.');

    const deviceId = getDeviceId();
    const deviceRef = doc(db, 'users', user.uid, 'pushDevices', deviceId);
    const notificationScopes = [...new Set(scopes.filter(scope => ['deadlines', 'sharing'].includes(scope)))];
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
    await unregisterReplacedPushWorker(replacedRegistration);
    rememberActiveScopes(notificationScopes);
    return true;
}

export async function recoverPushRegistration(user = auth.currentUser) {
    const compatibility = getPushCompatibility();
    if (!user || !compatibility.compatible || Notification.permission !== 'granted') return false;
    const deviceId = getDeviceId();
    const device = await getPushDeviceConfirmed(user.uid, deviceId);
    const serverScopes = Array.isArray(device?.notificationScopes)
        ? device.notificationScopes : (device?.notificationScope ? [device.notificationScope] : []);
    const intendedScopes = [...new Set([...rememberedActiveScopes(), ...serverScopes])]
        .filter(scope => ['deadlines', 'sharing'].includes(scope));
    if (!intendedScopes.length) return false;
    const current = device?.enabled === true && Boolean(device.token)
        && intendedScopes.every(scope => serverScopes.includes(scope));
    if (current) {
        rememberActiveScopes(intendedScopes);
        return false;
    }
    await writePushRegistration(user, intendedScopes, {forceReset: device?.status === 'invalid'});
    return true;
}

async function enablePushScope(scope, user = auth.currentUser) {
    const compatibility = getPushCompatibility();
    if (!user) throw new Error('Accesso richiesto.');
    if (!compatibility.compatible) throw new Error(compatibility.reason);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permesso notifiche non concesso.');

    const deviceId = getDeviceId();
    const existing = await getPushDeviceConfirmed(user.uid, deviceId);
    const previousScopes = Array.isArray(existing?.notificationScopes)
        ? existing.notificationScopes : (existing?.notificationScope ? [existing.notificationScope] : []);
    const notificationScopes = [...new Set([...previousScopes, scope])];
    return writePushRegistration(user, notificationScopes, {forceReset: existing?.status === 'invalid'});
}

export async function enableDeadlinePush(user = auth.currentUser) { return enablePushScope('deadlines', user); }
export async function enableSharingPush(user = auth.currentUser) { return enablePushScope('sharing', user); }

export async function disableDeadlinePush(user = auth.currentUser) {
    return disablePushScope('deadlines', user);
}

async function disablePushScope(scope, user = auth.currentUser) {
    if (!user) return;
    const deviceRef = doc(db, 'users', user.uid, 'pushDevices', getDeviceId());
    const device = await getPushDevice(user.uid, getDeviceId());
    const scopes = Array.isArray(device?.notificationScopes)
        ? device.notificationScopes : (device?.notificationScope ? [device.notificationScope] : []);
    const remaining = scopes.filter(item => item !== scope);
    if (remaining.length) {
        rememberActiveScopes(remaining);
        return setDoc(deviceRef, { notificationScopes: remaining, updatedAt: serverTimestamp() }, { merge: true });
    }
    const messaging = await getPushMessagingInstance();
    if (messaging) try { await deleteToken(messaging); } catch (error) { console.warn('[PUSH] Revoca token locale non riuscita', error); }
    await deleteDoc(deviceRef);
    rememberActiveScopes([]);
}

export async function disableSharingPush(user = auth.currentUser) { return disablePushScope('sharing', user); }

function pushTestNeedsRecovery(error) {
    const reason = String(error?.details?.reason || '');
    const message = String(error?.message || '');
    return reason === 'push-token-invalid'
        || (error?.code === 'functions/failed-precondition'
            && message.includes('Notifiche non attive su questo dispositivo'));
}

async function renewDeadlinePushRegistration(user) {
    if (!user) throw new Error('Accesso richiesto.');
    const device = await getPushDeviceConfirmed(user.uid, getDeviceId());
    const serverScopes = Array.isArray(device?.notificationScopes)
        ? device.notificationScopes : (device?.notificationScope ? [device.notificationScope] : []);
    const scopes = [...new Set([...rememberedActiveScopes(), ...serverScopes, 'deadlines'])];
    await writePushRegistration(user, scopes, {forceReset: true});
}

async function ensureDeadlinePushTestRegistration(user) {
    if (!user) throw new Error('Accesso richiesto.');
    const device = await getPushDeviceConfirmed(user.uid, getDeviceId());
    const scopes = Array.isArray(device?.notificationScopes)
        ? device.notificationScopes : (device?.notificationScope ? [device.notificationScope] : []);
    const active = device?.enabled === true && device?.status !== 'invalid'
        && Boolean(device.token) && scopes.includes('deadlines');
    if (!active) await renewDeadlinePushRegistration(user);
}

export async function sendDeadlinePushTest() {
    const lastTestAt = Number(localStorage.getItem(LAST_TEST_KEY) || 0);
    const remainingSeconds = Math.ceil((60000 - (Date.now() - lastTestAt)) / 1000);
    if (remainingSeconds > 0) throw new Error(`Attendi ancora ${remainingSeconds} secondi prima di riprovare.`);
    const user = auth.currentUser;
    await ensureDeadlinePushTestRegistration(user);
    const call = httpsCallable(functions, 'sendDeadlinePushTest');
    const deviceId = getDeviceId();
    let result;
    try {
        result = (await call({ deviceId })).data;
    } catch (error) {
        if (!pushTestNeedsRecovery(error)) throw error;
        // Il backend può aver già invalidato il token oppure il dispositivo può
        // risultare non attivo dopo un ripristino locale interrotto. In entrambi
        // i casi creiamo una registrazione distinta e ritentiamo una sola volta.
        await renewDeadlinePushRegistration(user);
        result = (await call({ deviceId })).data;
    }
    if (!result?.ok && result?.cooldownSeconds) {
        localStorage.setItem(LAST_TEST_KEY, String(Date.now() - (60000 - result.cooldownSeconds * 1000)));
        throw new Error(`Attendi ancora ${result.cooldownSeconds} secondi prima di riprovare.`);
    }
    localStorage.setItem(LAST_TEST_KEY, String(Date.now()));
    return result;
}

export async function listenForDeadlinePushInForeground() {
    if (foregroundListenerStarted || Notification.permission !== 'granted') return;
    const state = await getCurrentPushState(auth.currentUser, 'deadlines');
    if (!state.enabled) return;
    const messaging = await getPushMessagingInstance();
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
                receivedDeadlineId: payload.data.receivedDeadlineId || '',
                notificationId: payload.data.notificationId || ''
            }
        });
    });
}
