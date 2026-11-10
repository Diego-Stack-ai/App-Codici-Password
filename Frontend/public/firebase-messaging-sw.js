/* Firebase Messaging worker: separato dal Service Worker offline della PWA. */
const FRAME_PUSH_PROTOCOL = 'vault-frame-push/v1';
const FRAME_PUSH_TIMEOUT_MS = 1500;
const notificationId = value => value === undefined || value === '' ? '' :
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,1024}$/.test(value) ? value : null;

function notificationTarget(data) {
    if (!data || Array.isArray(data) || !['deadline', 'external_deadline', 'share_invite'].includes(data.eventType)) return null;
    const id = notificationId(data.deadlineId), received = notificationId(data.receivedDeadlineId), notification = notificationId(data.notificationId);
    if ([id, received, notification].includes(null)) return null;
    if (data.eventType === 'share_invite') return '/home_page.html';
    const key = data.eventType === 'deadline' ? 'id' : 'received';
    const value = data.eventType === 'deadline' ? id : received;
    if (!value) return '/scadenze.html';
    return `/dettaglio_scadenza.html?${key}=${encodeURIComponent(value)}${notification ? `&notification=${encodeURIComponent(notification)}` : ''}`;
}

function clientUrl(client) {
    try {
        const url = new URL(client.url);
        return url.origin === self.location.origin && !url.username && !url.password &&
            ['top-level', 'auxiliary'].includes(client.frameType) ? url : null;
    } catch { return null; }
}
function isFrameClient(client) {
    try { return decodeURIComponent(clientUrl(client)?.pathname || '').replace(/\/+$/, '') === '/app.html'; }
    catch { return false; }
}
const preference = client => (client.focused ? 2 : 0) + (client.visibilityState === 'visible' ? 1 : 0);

function requestFrameNavigation(client, path) {
    return new Promise(resolve => {
        const requestId = self.crypto.randomUUID(), channel = new MessageChannel();
        const expiresAt = Date.now() + FRAME_PUSH_TIMEOUT_MS;
        let done = false;
        const finish = accepted => {
            if (done) return; done = true; clearTimeout(timer);
            for (const port of [channel.port1, channel.port2]) {try {port.close();} catch { /* Transferred. */ }}
            resolve(accepted);
        };
        const timer = setTimeout(() => finish(false), FRAME_PUSH_TIMEOUT_MS);
        channel.port1.onmessage = event => {
            const data = event.data;
            if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'accepted,kind,path,protocol,requestId' ||
                data.protocol !== FRAME_PUSH_PROTOCOL || data.kind !== 'ack' || data.requestId !== requestId || data.path !== path ||
                typeof data.accepted !== 'boolean' || Date.now() >= expiresAt) return;
            finish(data.accepted);
        };
        channel.port1.onmessageerror = () => finish(false);
        // Focus can fail or stall; it never bypasses the shared deadline.
        Promise.resolve().then(() => client.focus()).catch(() => {}).then(() => {
            if (done) return;
            try {client.postMessage({protocol: FRAME_PUSH_PROTOCOL, kind: 'navigate', requestId, path, expiresAt}, [channel.port2]);}
            catch {finish(false);}
        });
    });
}

const FRAME_DIAG_PROTOCOL = 'vault-frame-diag/v1';
function reportFramePush(windows, code) {
    // Local messages only. The authenticated opt-in document owns persistence.
    for (const client of windows) {try {client.postMessage({protocol: FRAME_DIAG_PROTOCOL, code});} catch { /* No observer. */ }}
}
async function frameFallback(windows, target) {
    reportFramePush(windows, 'PUSH_FALLBACK_REQUESTED');
    try {const result = await self.clients.openWindow(target); reportFramePush(windows, 'PUSH_FALLBACK_RESOLVED'); return result;}
    catch (error) {reportFramePush(windows, 'PUSH_FALLBACK_FAILED'); throw error;}
}
self.addEventListener('message', event => {
    const data = event.data;
    if (!data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'kind,protocol' ||
        data.protocol !== FRAME_DIAG_PROTOCOL || data.kind !== 'probe' || event.ports?.length !== 1) return;
    try {
        if (new URL(event.source.url).origin !== self.location.origin) return;
        event.ports[0].postMessage({protocol: FRAME_DIAG_PROTOCOL, kind: 'ready', revision: 1});
        event.ports[0].close();
    } catch { /* Diagnostic readiness never affects push handling. */ }
});

// Install before FCM so its default click handler cannot navigate the frame.
self.addEventListener('notificationclick', event => {
    event.stopImmediatePropagation(); event.notification.close();
    const path = notificationTarget(event.notification.data);
    if (!path) return;
    const target = new URL(path, self.location.origin).href;
    event.waitUntil((async () => {
        const windows = (await self.clients.matchAll({type: 'window', includeUncontrolled: true}))
            .filter(client => clientUrl(client)).sort((a, b) => preference(b) - preference(a));
        const frame = windows.find(isFrameClient);
        if (frame) {
            try {if (await requestFrameNavigation(frame, path)) {reportFramePush([frame], 'PUSH_ACK_RECEIVED');return frame;}}
            catch { /* Missing channel/crypto support never triggers direct frame navigation. */ }
            return frameFallback([frame], target);
        }
        const existing = windows[0];
        if (existing) {
            try {const navigated = await existing.navigate(target); return await (navigated ? navigated.focus() : existing.focus());}
            catch { /* Preserve the ordinary new-window fallback. */ }
        }
        return frameFallback(existing ? [existing] : [], target);
    })());
});

importScripts('./assets/js/vendor/firebase-sw-runtime.js');

firebase.initializeApp({
    apiKey: 'AIzaSyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o',
    authDomain: 'appcodici-password.firebaseapp.com',
    projectId: 'appcodici-password',
    storageBucket: 'appcodici-password.firebasestorage.app',
    messagingSenderId: '343696844738',
    appId: '1:343696844738:web:3e62fa1fdd9375535b985b'
});

firebase.messaging().onBackgroundMessage((payload) => {
    if (!['deadline', 'external_deadline', 'share_invite'].includes(payload.data?.eventType)) return;
    return self.registration.showNotification(payload.data.title || 'Codici & Password', {
        body: payload.data.body || 'Hai una nuova notifica.',
        icon: '/assets/images/app-icon-192.png',
        badge: '/assets/images/app-icon-192.png',
        tag: payload.data.deliveryTag || `push-${payload.data.deadlineId || payload.data.notificationId || 'notice'}`,
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
