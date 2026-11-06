import { initializeApp, getApps } from "/assets/js/vendor/firebase-runtime.js";
import {
    deleteToken,
    getMessaging,
    getMessagingToken as getToken,
    isSupported,
    onMessage
} from "/assets/js/vendor/firebase-runtime.js";

const PUSH_APP_NAME = 'codici-password-push';
const firebaseConfig = {
    apiKey: 'AIzaSyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o',
    authDomain: 'appcodici-password.firebaseapp.com',
    projectId: 'appcodici-password',
    storageBucket: 'appcodici-password.firebasestorage.app',
    messagingSenderId: '343696844738',
    appId: '1:343696844738:web:3e62fa1fdd9375535b985b'
};

let messagingPromise = null;

export function getPushMessagingInstance() {
    if (!messagingPromise) {
        messagingPromise = isSupported().then((supported) => {
            if (!supported) return null;
            const app = getApps().find((item) => item.name === PUSH_APP_NAME)
                || initializeApp(firebaseConfig, PUSH_APP_NAME);
            return getMessaging(app);
        });
    }
    return messagingPromise;
}

export { deleteToken, getToken, onMessage };
