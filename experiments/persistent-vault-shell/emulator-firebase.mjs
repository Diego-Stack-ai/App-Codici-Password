import {initializeApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator} from 'firebase/firestore';

if (location.origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'});
export const auth = initializeAuth(app, {persistence: inMemoryPersistence});
connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
export const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8085);
