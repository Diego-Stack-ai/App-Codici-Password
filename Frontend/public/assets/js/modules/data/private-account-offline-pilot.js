import {createOfflineMutationClient} from './offline-mutation-client.js';

const DEVICE_KEY = 'codex_m6_private_account_device_id';
const HANDOFF_PREFIX = 'codex_m6_private_account_handoff:';
const HANDOFF_TTL_MS = 60_000;

export function isPrivateAccountPilotEnabled(search = globalThis.location?.search || '') {
    return new URLSearchParams(search).get('m6pilot') === '1';
}

function deviceId() {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
        value = crypto.randomUUID();
        localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
}

export function buildPrivateAccountOperation({uid, recordId, expectedRevision, record}) {
    if (!uid || !recordId || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
        throw new Error('PRIVATE_ACCOUNT_PILOT_INPUT_INVALID');
    }
    const currentDeviceId = deviceId();
    return {
        schemaVersion: 1,
        uid,
        operationId: `${currentDeviceId}:${crypto.randomUUID()}`,
        deviceId: currentDeviceId,
        recordId,
        expectedRevision,
        record
    };
}

export function storePrivateAccountHandoff({uid, recordId, expectedRevision, record}, storage = sessionStorage) {
    if (!uid || !recordId || !record?._encrypted || !storage) {
        throw new Error('PRIVATE_ACCOUNT_HANDOFF_INVALID');
    }
    storage.setItem(`${HANDOFF_PREFIX}${uid}`, JSON.stringify({
        uid,
        recordId,
        expiresAt: Date.now() + HANDOFF_TTL_MS,
        record: {
            ...record,
            id: recordId,
            schemaVersion: 1,
            revision: expectedRevision + 1
        }
    }));
}

export function consumePrivateAccountHandoff(uid, storage = sessionStorage) {
    if (!uid || !storage) return null;
    const key = `${HANDOFF_PREFIX}${uid}`;
    const raw = storage.getItem(key);
    storage.removeItem(key);
    if (!raw) return null;
    try {
        const handoff = JSON.parse(raw);
        if (handoff.uid !== uid || handoff.expiresAt < Date.now() || !handoff.record?._encrypted) return null;
        return handoff.record;
    } catch {
        return null;
    }
}

export async function createPrivateAccountPilotClient({uid, vaultKeyMaterial, onState}) {
    return createOfflineMutationClient({
        uid,
        vaultKeyMaterial,
        enabled: true,
        callableName: 'applyPrivateAccountMutation',
        onState
    });
}

export async function enqueuePrivateAccountPilot(options) {
    const client = await createPrivateAccountPilotClient(options);
    try {
        return await client.enqueue(buildPrivateAccountOperation(options));
    } finally {
        client.close();
    }
}

export async function flushPrivateAccountPilot(options) {
    const client = await createPrivateAccountPilotClient(options);
    try {
        return await client.flush();
    } finally {
        client.close();
    }
}
