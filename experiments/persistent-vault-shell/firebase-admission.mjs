import {reload} from 'firebase/auth';
import {doc, getDocFromServer, getDocFromCache} from 'firebase/firestore';
import {createAdmissionGate} from './admission-gate.mjs';

const firebaseSdk = Object.freeze({reload, doc, getDocFromServer, getDocFromCache});

// Candidate adapter only. The caller owns the presentation ticket and session.
// No Firebase configuration, credentials, listeners or Vault material live here.
export function createFirebaseAdmission({auth, db, presentationGate, isOnline,
    enableAppCheck, requiredPolicyVersion, sdk = firebaseSdk} = {}) {
    if (!auth || !db || !presentationGate || !sdk) throw new TypeError('INVALID_ADMISSION_DEPENDENCY');
    for (const fn of [presentationGate.acceptIdentity, presentationGate.active, sdk.reload,
        sdk.doc, sdk.getDocFromServer, sdk.getDocFromCache]) {
        if (typeof fn !== 'function') throw new TypeError('INVALID_ADMISSION_DEPENDENCY');
    }
    const assertOwner = uid => {
        if (auth.currentUser?.uid !== uid) throw new Error('ADMISSION_OWNER_CHANGED');
    };
    return createAdmissionGate({
        getUser: () => auth.currentUser,
        isOnline, enableAppCheck, requiredPolicyVersion,
        reloadUser: user => sdk.reload(user),
        acceptIdentity: (ticket, user) => presentationGate.acceptIdentity(ticket, user),
        isIdentityActive: ticket => presentationGate.active(ticket),
        async loadPolicy({uid, source}) {
            if (typeof uid !== 'string' || !uid || uid.includes('/') || uid === '.' || uid === '..') {
                throw new Error('INVALID_POLICY_OWNER');
            }
            if (!['server-only', 'cache-only'].includes(source)) throw new Error('INVALID_POLICY_SOURCE');
            assertOwner(uid);
            const ref = sdk.doc(db, 'users', uid);
            assertOwner(uid);
            const snapshot = source === 'server-only'
                ? await sdk.getDocFromServer(ref) : await sdk.getDocFromCache(ref);
            assertOwner(uid);
            // A server error is never converted into a cache read or a default policy.
            const exists = snapshot?.exists?.();
            if (exists === false) return null;
            if (exists !== true || typeof snapshot.data !== 'function') throw new Error('INVALID_POLICY_SNAPSHOT');
            const data = snapshot.data();
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_POLICY_SNAPSHOT');
            return {passwordPolicyVersion: data.passwordPolicyVersion};
        }
    });
}
