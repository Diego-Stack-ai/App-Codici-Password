import {createMemoryVault} from './memory-vault.mjs';

// Candidate read-only bridge. Firebase/UI/crypto dependencies are explicit;
// no provisioning, legacy migration, persistence or production activation.
export function createLegacyAdapter({getUser, subscribeUser, loadSecurity, requestPassword, cryptoApi, onLock, now, timeoutMs}) {
    let disposed = false, observedUid = getUser()?.uid || null;
    const owner = () => {
        const uid = getUser()?.uid;
        if (disposed || !uid) throw new Error('AUTH_REQUIRED');
        return uid;
    };
    const assertOwner = uid => { if (owner() !== uid) throw new Error('AUTH_CHANGED'); };
    const vault = createMemoryVault({
        onLock, now, timeoutMs,
        async unlockKey(uid, {signal}) {
            const assertActive = () => {
                assertOwner(uid);
                if (signal.aborted) throw new Error('UNLOCK_CANCELLED');
            };
            assertActive();
            const security = await loadSecurity(uid, {signal});
            assertActive();
            const envelope = security?.vaultKeyEnvelope;
            if (!security?.verifier || envelope?.version !== 2 || envelope?.type !== 'vault-key-envelope') {
                throw new Error('MIGRATION_REQUIRED');
            }
            const password = await requestPassword({signal});
            assertActive();
            if (!password) throw new Error('UNLOCK_CANCELLED');
            if (!await cryptoApi.verifyVaultVerifier(security.verifier, 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', password)) {
                throw new Error('INVALID_MASTER_PASSWORD');
            }
            assertActive();
            const key = await cryptoApi.unwrapVaultKey(envelope, password);
            assertActive();
            return key;
        },
        async decryptRecord(key, record) {
            if (!cryptoApi.isEncryptedValue(record.ciphertext)) throw new Error('CIPHERTEXT_REQUIRED');
            return cryptoApi.decryptRequiredValue(record.ciphertext, key);
        }
    });
    const unsubscribe = subscribeUser(user => {
        const uid = user?.uid || null;
        if (!uid || uid !== observedUid) vault.lock('auth-change');
        observedUid = uid;
    });
    return Object.freeze({
        unlock: () => vault.unlock(owner()),
        lock: () => vault.lock(),
        async read(record) {
            const uid = owner();
            if (record.ownerId !== uid) throw new Error('OWNER_MISMATCH');
            const value = await vault.read(uid, record);
            assertOwner(uid);
            return value;
        },
        isUnlocked: () => !disposed && vault.isUnlocked(),
        touch: () => vault.touch(),
        dispose() {
            if (disposed) return;
            disposed = true;
            try { vault.lock('dispose'); } finally { unsubscribe(); }
        }
    });
}
