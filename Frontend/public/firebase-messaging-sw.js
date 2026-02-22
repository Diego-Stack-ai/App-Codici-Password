/**
 * FIREBASE MESSAGING SERVICE WORKER (V4.5)
 * Gestisce le notifiche push in background.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configurazione (Deve corrispondere a firebase-config.js)
const firebaseConfig = {
    apiKey: "AIza" + "SyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o",
    authDomain: "appcodici-password.firebaseapp.com",
    projectId: "appcodici-password",
    storageBucket: "appcodici-password.firebasestorage.app",
    messagingSenderId: "343696844738",
    appId: "1:343696844738:web:3e62fa1fdd9375535b985b"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Gestione notifiche quando l'app è in background
messaging.onBackgroundMessage((payload) => {
    console.log('[sw] Notifica ricevuta in background:', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://appcodici-password.web.app/assets/images/app-icon.jpg',
        badge: 'https://appcodici-password.web.app/assets/images/app-icon.jpg',
        data: payload.data, // Manteniamo i dati per il click
        tag: 'deadline-alert', // Aggrega notifiche simili
        renotify: true
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestione Click sulla Notifica
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Default link
    let urlToOpen = 'https://appcodici-password.web.app/notifiche_storia.html';

    // Se c'è un ID scadenza specifico
    if (event.notification.data && event.notification.data.scadenzaId) {
        urlToOpen = `https://appcodici-password.web.app/dettaglio_scadenza.html?id=${event.notification.data.scadenzaId}`;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Se c'è già una finestra aperta, facciamo il focus
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Altrimenti apriamo una nuova
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
