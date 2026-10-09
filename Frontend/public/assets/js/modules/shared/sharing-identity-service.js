import {functions} from '../../firebase-config.js?v=1.2.145';
import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {createSharingIdentity, openSharingIdentity} from '../core/sharing-identity.js';
import {getSharingPrivateIdentity, getSharingPublicIdentity as readPublicIdentity} from '../data/vault-repository.js';

const pending = new Map();

async function loadIdentity(uid, confirmed = false) {
    const [publicIdentity, privateEnvelope] = await Promise.all([
        readPublicIdentity(uid, confirmed), getSharingPrivateIdentity(uid, confirmed)
    ]);
    if (Boolean(publicIdentity) !== Boolean(privateEnvelope)) {
        throw new Error('SHARING_IDENTITY_INCOMPLETE');
    }
    return publicIdentity ? {publicIdentity, privateEnvelope} : null;
}

async function ensure(uid, vaultKeyMaterial) {
    let stored = await loadIdentity(uid);
    if (!stored) {
        const candidate = await createSharingIdentity({uid, vaultKeyMaterial});
        await httpsCallable(functions, 'registerSharingIdentity')(candidate);
        stored = await loadIdentity(uid, true);
        if (!stored) throw new Error('SHARING_IDENTITY_NOT_PERSISTED');
    }
    return openSharingIdentity({...stored, uid, vaultKeyMaterial});
}

export function ensureSharingIdentity({uid, vaultKeyMaterial}) {
    if (!uid || !vaultKeyMaterial) return Promise.reject(new Error('SHARING_IDENTITY_INPUT_REQUIRED'));
    const key = String(uid);
    if (!pending.has(key)) {
        const operation = ensure(key, vaultKeyMaterial).finally(() => {
            if (pending.get(key) === operation) pending.delete(key);
        });
        pending.set(key, operation);
    }
    return pending.get(key);
}

export async function getSharingPublicIdentity(uid) {
    if (!uid) throw new Error('SHARING_UID_REQUIRED');
    const identity = await readPublicIdentity(uid);
    if (!identity) throw new Error('SHARING_PUBLIC_IDENTITY_MISSING');
    return identity;
}
