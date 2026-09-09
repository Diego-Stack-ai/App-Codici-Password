import {createOfflineMutationClient} from './offline-mutation-client.js';

const DEVICE_KEY = 'codex_m6_private_account_device_id';

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
