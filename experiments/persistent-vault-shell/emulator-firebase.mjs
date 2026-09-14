import {initializeApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator} from 'firebase/firestore';
import {getFunctions, connectFunctionsEmulator} from 'firebase/functions';
import {initializeAppCheck, CustomProvider} from 'firebase/app-check';

if (location.origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key', appId: 'synthetic-vault-laboratory'});
initializeAppCheck(app, {provider: new CustomProvider({getToken: async () => ({token: 'synthetic-app-check', expireTimeMillis: Date.now() + 3600000})}), isTokenAutoRefreshEnabled: false});
export const functions = getFunctions(app, 'europe-west1');
connectFunctionsEmulator(functions, '127.0.0.1', 4188);
export const auth = initializeAuth(app, {persistence: inMemoryPersistence});
connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
export const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8085);
