import {initializeApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, indexedDBLocalPersistence, connectAuthEmulator} from 'firebase/auth';
import {getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator} from 'firebase/firestore';
import {getFunctions, connectFunctionsEmulator} from 'firebase/functions';
import {getStorage, connectStorageEmulator} from 'firebase/storage';
import {initializeAppCheck, CustomProvider} from 'firebase/app-check';

if (location.origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key', appId: 'synthetic-vault-laboratory'});
const realFunctions = typeof __EMULATOR_REAL_FUNCTIONS__ !== 'undefined' && __EMULATOR_REAL_FUNCTIONS__;
// Unsigned synthetic attestation is accepted ONLY by the local Functions emulator.
const attestation = () => realFunctions ? `${btoa(JSON.stringify({alg: 'none', typ: 'JWT'}))}.${btoa(JSON.stringify({sub: 'synthetic-vault-laboratory', aud: ['projects/demo-vault-shell'], exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000)}))}.` : 'synthetic-app-check';
const emulatorAppCheck = initializeAppCheck(app, {provider: new CustomProvider({getToken: async () => ({token: attestation(), expireTimeMillis: Date.now() + 3600000})}), isTokenAutoRefreshEnabled: false});
// Admission reuses the initialized emulator instance; it must not substitute a
// no-op for initialization. This synthetic provider is NOT real attestation.
export function requireEmulatorAppCheck() {
    if (location.origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
    if (!emulatorAppCheck) throw new Error('EMULATOR_APPCHECK_NOT_INITIALIZED');
    return emulatorAppCheck;
}
export const functions = getFunctions(app, 'europe-west1');
connectFunctionsEmulator(functions, '127.0.0.1', realFunctions ? 5001 : 4188);
const persistent = typeof __EMULATOR_PERSISTENT_CACHE__ !== 'undefined' && __EMULATOR_PERSISTENT_CACHE__;
export const auth = initializeAuth(app, {persistence: persistent ? indexedDBLocalPersistence : inMemoryPersistence});
connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
export const db = persistent ? initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
}) : getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8085);
export const storage = getStorage(app, 'gs://demo-vault-shell.appspot.com');
connectStorageEmulator(storage, '127.0.0.1', 9199);
