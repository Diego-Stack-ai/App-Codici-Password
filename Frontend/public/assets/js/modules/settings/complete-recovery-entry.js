import {auth, db, functions} from '../../firebase-config.js?v=1.2.271';
import {doc, getDocFromServer, httpsCallable, onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {COMPLETE_RECOVERY_ENABLED} from './complete-recovery-config.js';
import {mountCompleteRecoveryUi, promptCompleteRecoveryMasterPassword} from './complete-recovery-ui.js';
import {createCompleteRecoveryLocatorStore} from './complete-recovery-locator.js';
import {createRecoveryAssetReader} from './recovery-asset-reader.js';
import {createElement, setChildren} from '../../dom-utils.js';
import {t} from '../../translations.js';

function transport(name, uid, isActive = () => true) {
    const callable = httpsCallable(functions, name, {timeout: 130000});
    return async data => {
        if (auth.currentUser?.uid !== uid || !isActive()) throw new Error('RECOVERY_SESSION_INVALIDATED');
        try {
            const result = await callable(data);
            if (auth.currentUser?.uid !== uid || !isActive()) throw new Error('RECOVERY_SESSION_INVALIDATED');
            return result.data;
        } catch (error) {
            const reason = error?.details?.reason;
            if (typeof reason === 'string' && /^(?:FULL_RECOVERY|RECOVERY)_[A-Z0-9_]{1,96}$/.test(reason)) {
                throw Object.assign(new Error(reason), {code: reason});
            }
            throw error;
        }
    };
}
export async function discoverCompleteRecoveryOperation({uid, readFence, isActive}) {
    try {
        if (!isActive()) throw new Error('RECOVERY_SESSION_INVALIDATED');
        const value = await readFence();
        if (!isActive()) throw new Error('RECOVERY_SESSION_INVALIDATED');
        if (value === null) return null;
        if (value?.schemaVersion !== 1 || value.ownerUid !== uid || !['active', 'released'].includes(value.status) ||
            !/^[A-Za-z0-9._:-]{1,160}$/.test(value.operationId || '') || !/^[a-f0-9]{64}$/.test(value.planDigest || '') ||
            !/^[a-f0-9]{64}$/.test(value.digest || '')) throw new Error('RECOVERY_RESUME_LOOKUP_FAILED');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([
            1, uid, value.operationId, value.planDigest]))));
        if (!isActive()) { digest.fill(0); throw new Error('RECOVERY_SESSION_INVALIDATED'); }
        const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''); digest.fill(0);
        if (actual !== value.digest) throw new Error('RECOVERY_RESUME_LOOKUP_FAILED');
        return {operationId: value.operationId};
    } catch { throw new Error('RECOVERY_RESUME_LOOKUP_FAILED'); }
}
export function startCompleteRecoveryPage({user, isActive}) {
    if (!COMPLETE_RECOVERY_ENABLED) {
        if (isActive()) setChildren(document.querySelector('.base-main .page-container'), [
            createElement('h1', {className: 'modal-title', textContent: t('recovery_title')}),
            createElement('p', {role: 'status', className: 'modal-text', textContent: t('recovery_unavailable')})]);
        return {dispose() {}};
    }
    let storage;
    try { storage = window.localStorage; } catch { /* No RPC until a locator can be saved. */ }
    const uid = user.uid, current = () => auth.currentUser?.uid === uid && isActive();
    return mountCompleteRecoveryUi({root: document.querySelector('.base-main .page-container'), uid,
        enabled: COMPLETE_RECOVERY_ENABLED, isActive: current, getCurrentUid: () => auth.currentUser?.uid,
        subscribeToAuth: callback => onAuthStateChanged(auth, callback),
        locator: createCompleteRecoveryLocatorStore({uid, storage}), invoke: transport('manageFullVaultRecovery', uid, current),
        discoverOperation: () => discoverCompleteRecoveryOperation({uid, isActive: current, readFence: async () => {
            const snapshot = await getDocFromServer(doc(db, 'vaultRecoveryLocks', uid));
            return snapshot.exists() ? snapshot.data() : null;
        }})});
}
export function createCompleteRecoveryExportOptions({uid, signal, isActive}) {
    if (!COMPLETE_RECOVERY_ENABLED) return null;
    const readAsset = createRecoveryAssetReader({uid, signal, isActive, getCurrentUid: () => auth.currentUser?.uid,
        invoke: transport('readRecoveryBackupAsset', uid, isActive)});
    return {profile: 'complete-recovery', readAsset, dispose: () => readAsset.release(),
        promptMasterPassword: async () => {
            const password = await promptCompleteRecoveryMasterPassword({signal, isActive});
            if (password === null) throw new Error('RECOVERY_EXPORT_CANCELLED');
            return password;
        }};
}
