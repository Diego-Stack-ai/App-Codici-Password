import {onAuthStateChanged, signOut} from 'firebase/auth';
import {doc, getDoc} from 'firebase/firestore';
import {createLegacyAdapter} from './legacy-adapter.mjs';
import {createProtectedSession} from './protected-session.mjs';

// Candidate integration, not imported by the published application or preview.
// The caller supplies initialized SDK instances and an abortable password UI.
export function createFirebaseSession({auth, db, cryptoApi, requestPassword, routes, onState, onError}) {
    const getUser = () => auth.currentUser;
    const subscribeUser = listener => onAuthStateChanged(auth, listener);
    const assertActive = (signal, uid) => {
        if (signal.aborted || auth.currentUser?.uid !== uid) throw new Error('VIEW_DISPOSED');
    };
    const segment = value => {
        if (typeof value !== 'string' || !value || value.includes('/') || value === '.' || value === '..') throw new Error('INVALID_RECORD_ID');
        return value;
    };
    const boundRoutes = Object.fromEntries(Object.entries(routes).map(([name, mount]) => [name, context => mount({
        ...context,
        async readAccount({id, companyId, field}) {
            if (!['username', 'account', 'password', 'nomeAccount'].includes(field)) throw new Error('FIELD_NOT_ALLOWED');
            const uid = context.user?.uid;
            assertActive(context.signal, uid);
            if (!uid || !context.unlocked) throw new Error('VAULT_LOCKED');
            const path = ['users', uid];
            if (companyId !== undefined) path.push('aziende', segment(companyId));
            path.push('accounts', segment(id));
            const snapshot = await getDoc(doc(db, ...path));
            assertActive(context.signal, uid);
            if (!snapshot.exists()) throw new Error('RECORD_NOT_FOUND');
            const record = snapshot.data();
            if (Object.hasOwn(record, 'ownerId') && record.ownerId !== uid) throw new Error('OWNER_MISMATCH');
            // No automatic plaintext fallback or legacy migration.
            return context.read({ownerId: uid, ciphertext: record[field]});
        }
    })]));
    const session = createProtectedSession({getUser, subscribeUser, routes: boundRoutes, onState, onError,
        createVault: callbacks => {
            const adapter = createLegacyAdapter({getUser, subscribeUser, cryptoApi, requestPassword, ...callbacks,
                async loadSecurity(uid, {signal}) {
                    assertActive(signal, uid);
                    const snapshot = await getDoc(doc(db, 'users', uid, 'settings', 'security'));
                    assertActive(signal, uid);
                    return snapshot.exists() ? snapshot.data() : null;
                }
            });
            return {unlock: () => adapter.unlock(), read: (uid, record) => adapter.read(record),
                lock: adapter.lock, isUnlocked: adapter.isUnlocked, touch: adapter.touch, dispose: adapter.dispose};
        }
    });
    return Object.freeze({...session, logout: () => session.logout(() => signOut(auth))});
}
