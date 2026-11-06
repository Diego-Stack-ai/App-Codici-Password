import {createRecoveryContentPayload, createFinalizePayload, verifyCompletedRecovery,
    visitRecoveryAssets, releaseCompleteRecovery} from './full-recovery-service.js';
import {recoveryBase64} from './full-recovery-model.js';
import {RECOVERY_PART_BYTES, assertRecoveryTransportAdmission, assertRecoveryCallableCapacity} from './recovery-transport-limits.js';

const PART_BYTES = RECOVERY_PART_BYTES;
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/;
const fail = code => { throw Object.assign(new Error(code), {code}); };

// No Firebase initialization, persistence or automatic activation. The caller
// supplies the authenticated project transport and a content-free resume store.
export async function executeCompleteRecovery(plan, newMasterPassword, options = {}) {
    const {uid, invoke, getCurrentUid, signal, isActive, onProgress,
        rememberOperation, clearRememberedOperation} = options;
    const operationId = options.operationId || crypto.randomUUID();
    let content, finalAuthority, serverMayBeActive = false, invalidated = false;
    const invalidate = () => { invalidated = true; newMasterPassword = ''; releaseCompleteRecovery(plan); };
    const check = () => {
        if (invalidated || signal?.aborted || getCurrentUid() !== uid || isActive?.() === false) fail('RECOVERY_SESSION_INVALIDATED');
    };
    const progress = (phase, completed, total) => {
        check(); onProgress?.({phase, completed, total}); check();
    };
    try {
        if (!IDENTIFIER.test(uid || '') || !IDENTIFIER.test(operationId) ||
            typeof invoke !== 'function' || typeof getCurrentUid !== 'function' ||
            options.confirmation !== 'RECOVER_EMPTY_VAULT') fail('RECOVERY_CONFIRMATION_REQUIRED');
        signal?.addEventListener('abort', invalidate, {once: true});
        globalThis.addEventListener?.('vault-session-locked', invalidate, {once: true});
        globalThis.addEventListener?.('pagehide', invalidate, {once: true});
        check();
        content = createRecoveryContentPayload(plan);
        if (content.ownerUid !== uid) fail('RECOVERY_OWNER_INVALID');
        finalAuthority = await createFinalizePayload(plan, newMasterPassword); check();
        assertRecoveryTransportAdmission(content, operationId, finalAuthority); check();
        const call = async (action, extra = {}) => {
            check();
            const request = {action, operationId, content: structuredClone(content), ...extra};
            assertRecoveryCallableCapacity(request); check();
            const result = await invoke(request);
            check();
            if (!result || typeof result !== 'object' || Array.isArray(result)) fail('RECOVERY_RESPONSE_INVALID');
            return result;
        };
        // Save before the first request: even a lost prepare response must keep
        // the same operation ID. Never place file content or keys in this locator.
        await rememberOperation?.({uid, operationId, backupId: content.backupId, contentDigest: content.contentDigest}); check();
        serverMayBeActive = true;
        let prepared, prepareFailure;
        try { prepared = await call('prepare'); }
        catch (error) {
            const reason = error?.code || error?.message;
            if (!['FULL_RECOVERY_TARGET_NONEMPTY', 'FULL_RECOVERY_STORAGE_NONEMPTY',
                'FULL_RECOVERY_IDENTITY_PRESENT', 'FULL_RECOVERY_ROOT_CHANGED'].includes(reason)) throw error;
            // Only the server can prove that the checking phase never admitted
            // any recovery write. A prepared or uncertain operation stays fenced.
            prepareFailure = reason;
            prepared = await call('abortChecking');
        }
        if (prepared.operationId !== operationId || typeof prepared.planDigest !== 'string' ||
            !/^[a-f0-9]{64}$/.test(prepared.planDigest)) fail('RECOVERY_RESPONSE_INVALID');
        if (prepared.status === 'not-started') {
            if (prepared.contentDigest !== content.contentDigest ||
                !/^[a-f0-9]{64}$/.test(prepared.abortReceiptDigest || '')) fail('RECOVERY_RESPONSE_INVALID');
            serverMayBeActive = false;
            await clearRememberedOperation?.({uid, operationId, contentDigest: content.contentDigest}); check();
            return {status: 'not-started', operationId, reason: prepareFailure || 'FULL_RECOVERY_CHECKING_ABORTED'};
        }
        if (prepareFailure) fail('RECOVERY_RESPONSE_INVALID');
        let repreviewed = false;
        if (prepared.status === 'expired') {
            const accepted = await options.confirmExpiredPlan?.({recordCount: content.records.length, assetCount: content.assets.length});
            check();
            if (accepted !== true) fail('RECOVERY_PLAN_REPREVIEW_REQUIRED');
            const refreshed = await call('repreview', {confirmation: 'REPREVIEW_EXPIRED_RECOVERY'});
            if (refreshed.status !== 'repreviewed' || refreshed.planDigest !== prepared.planDigest) fail('RECOVERY_RESPONSE_INVALID');
            prepared = {...refreshed, status: 'prepared', operationId};
            repreviewed = true;
        }
        if (prepared.status !== 'complete') {
            if (prepared.status !== 'prepared' || !Number.isSafeInteger(prepared.chunkCount) ||
                prepared.chunkCount < 0 || prepared.chunkCount > 10000 || prepared.partBytes !== PART_BYTES) fail('RECOVERY_RESPONSE_INVALID');
            progress('assets', 0, content.assets.length);
            let assetIndex = 0;
            await visitRecoveryAssets(plan, async (asset, bytes) => {
                check();
                if (content.assets[assetIndex]?.storagePath !== asset.storagePath ||
                    content.assets[assetIndex]?.sha256 !== asset.sha256) fail('RECOVERY_ASSET_INVALID');
                for (let offset = 0, partIndex = 0; offset < bytes.length; offset += PART_BYTES, partIndex++) {
                    const result = await call('uploadPart', {assetIndex, partIndex,
                        bytes: recoveryBase64(bytes.subarray(offset, offset + PART_BYTES))});
                    if (result.status !== 'staged' || result.assetIndex !== assetIndex || result.partIndex !== partIndex) fail('RECOVERY_RESPONSE_INVALID');
                }
                const finished = await call('finishAsset', {assetIndex});
                if (finished.status !== 'verified' || finished.assetIndex !== assetIndex) fail('RECOVERY_RESPONSE_INVALID');
                assetIndex++; progress('assets', assetIndex, content.assets.length);
            });
            check();
            if (assetIndex !== content.assets.length) fail('RECOVERY_ASSET_INVALID');
            for (let chunkIndex = 0; chunkIndex < prepared.chunkCount; chunkIndex++) {
                const result = await call('publishChunk', {chunkIndex});
                if (result.status !== 'published' || result.chunkIndex !== chunkIndex) fail('RECOVERY_RESPONSE_INVALID');
                progress('records', chunkIndex + 1, prepared.chunkCount);
            }
            const final = await call('finalize', {finalize: structuredClone(finalAuthority)});
            if (final.status !== 'complete' || final.operationId !== operationId) fail('RECOVERY_RESPONSE_INVALID');
        }
        // Read back committed authority, including the completed-resume path.
        // A newly generated local envelope cannot prove the stored password.
        const confirmed = prepared.status === 'complete' ? prepared : await call('prepare');
        if (confirmed.status !== 'complete' || confirmed.operationId !== operationId ||
            confirmed.planDigest !== prepared.planDigest) fail('RECOVERY_RESPONSE_INVALID');
        if (!await verifyCompletedRecovery(plan, confirmed.security, newMasterPassword)) fail('RECOVERY_COMPLETED_PASSWORD_MISMATCH');
        check();
        newMasterPassword = '';
        let cleanupPending = false;
        for (let assetIndex = 0; assetIndex < content.assets.length; assetIndex++) {
            try {
                const cleaned = await call('cleanupParts', {assetIndex});
                if (cleaned.status !== 'cleaned' || cleaned.assetIndex !== assetIndex) fail('RECOVERY_RESPONSE_INVALID');
            } catch {
                check(); cleanupPending = true; break;
            }
            progress('cleanup', assetIndex + 1, content.assets.length);
        }
        if (!cleanupPending) {
            await clearRememberedOperation?.({uid, operationId, contentDigest: content.contentDigest}); check();
        }
        return {status: 'complete', operationId, resumed: prepared.status === 'complete' || prepared.duplicate === true || repreviewed,
            recordCount: content.records.length, assetCount: content.assets.length, cleanupPending};
    } catch (error) {
        const candidate = error?.code || error?.message;
        const code = typeof candidate === 'string' && /^(?:RECOVERY|FULL_RECOVERY|BACKUP)_[A-Z0-9_]{1,96}$/.test(candidate)
            ? candidate : 'RECOVERY_OPERATION_UNCONFIRMED';
        throw Object.assign(new Error(code), {code, operationId, canResume: serverMayBeActive});
    } finally {
        if (content) { content.records.length = 0; content.assets.length = 0; content.references.length = 0; }
        if (finalAuthority) { finalAuthority.security = null; finalAuthority.sharingIdentity = null; }
        newMasterPassword = '';
        signal?.removeEventListener('abort', invalidate);
        globalThis.removeEventListener?.('vault-session-locked', invalidate);
        globalThis.removeEventListener?.('pagehide', invalidate);
        releaseCompleteRecovery(plan);
    }
}
