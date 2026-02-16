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
        icon: '/assets/images/app-icon.png' // Assicurati che l'icona esista
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
