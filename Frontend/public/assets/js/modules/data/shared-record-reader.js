const FALLBACK_STATES = new Set(['legacy', 'prepared', 'dual-read']);
const SHARED_STATES = new Set(['dual-read', 'record-key', 'finalized']);
const TERMINAL_SHARED_ERRORS = new Set([
    'SHARED_ACCESS_DENIED',
    'SHARED_GRANT_REVOKED',
    'SHARED_GRANT_EXPIRED',
    'SHARED_AUTHENTICITY_INVALID',
    'SHARED_GENERATION_MISMATCH',
    'SHARED_RECORD_DIVERGED'
]);

export const SHARED_RECORD_READER_ENABLED = false;

function validateDescriptor(descriptor) {
    if (!descriptor || !FALLBACK_STATES.has(descriptor.migrationState)) {
        throw new Error('SHARED_MIGRATION_STATE_INVALID');
    }
    if (descriptor.migrationState !== 'legacy' && !descriptor.recordId) {
        throw new Error('SHARED_RECORD_ID_REQUIRED');
    }
}

function validateSharedBundle(bundle, descriptor, recipientId) {
    if (!bundle || bundle.schemaVersion !== 2 || bundle.cryptoProtocol !== 'record-key-v1') {
        throw new Error('SHARED_FORMAT_INVALID');
    }
    if (bundle.recordId !== descriptor.recordId || bundle.grant?.recordId !== descriptor.recordId ||
        bundle.grant?.recipientId !== recipientId) {
        throw new Error('SHARED_ACCESS_DENIED');
    }
    if (bundle.grant.status === 'revoked') throw new Error('SHARED_GRANT_REVOKED');
    if (bundle.grant.status !== 'active') throw new Error('SHARED_ACCESS_DENIED');
    if (bundle.keyGeneration !== bundle.grant.keyGeneration) throw new Error('SHARED_GENERATION_MISMATCH');
}

function isMissing(error) {
    return error?.code === 'not-found' || error?.message === 'SHARED_RECORD_NOT_FOUND';
}

export async function readMigratingRecord({
    descriptor,
    recipientId,
    loadLegacy,
    loadShared,
    decryptShared,
    compareRecords,
    enabled = SHARED_RECORD_READER_ENABLED
}) {
    validateDescriptor(descriptor);
    if (!enabled || !SHARED_STATES.has(descriptor.migrationState)) {
        return {source: 'legacy', record: await loadLegacy()};
    }

    try {
        const bundle = await loadShared(descriptor.recordId);
        validateSharedBundle(bundle, descriptor, recipientId);
        const record = await decryptShared(bundle);
        if (descriptor.migrationState === 'dual-read') {
            const legacy = await loadLegacy();
            if (compareRecords && !await compareRecords(legacy, record)) throw new Error('SHARED_RECORD_DIVERGED');
        }
        return {source: 'record-key', record};
    } catch (error) {
        if (TERMINAL_SHARED_ERRORS.has(error?.message) || !FALLBACK_STATES.has(descriptor.migrationState) || !isMissing(error)) {
            throw error;
        }
        return {source: 'legacy-fallback', record: await loadLegacy()};
    }
}
