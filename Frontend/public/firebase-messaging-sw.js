/* Firebase Messaging worker: separato dal Service Worker offline della PWA. */
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
            notificationId: payload.data.notificationId || ''
        }
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    let path = '/home_page.html';
    if (data.eventType === 'deadline' || data.eventType === 'external_deadline') {
        const deadlineId = encodeURIComponent(data.deadlineId || '');
        const notificationId = encodeURIComponent(data.notificationId || '');
        const query = notificationId ? `&notification=${notificationId}` : '';
        path = deadlineId ? `/dettaglio_scadenza.html?id=${deadlineId}${query}` : '/scadenze.html';
    }
    const target = new URL(path, self.location.origin).href;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
        const existing = windows.find((client) => client.url.startsWith(self.location.origin));
        if (existing) {
            try {
                const navigated = await existing.navigate(target);
                return navigated ? navigated.focus() : existing.focus();
            } catch (error) {
                console.warn('[PUSH] Navigazione finestra esistente non riuscita', error);
            }
        }
        return self.clients.openWindow(target);
    }));
});
