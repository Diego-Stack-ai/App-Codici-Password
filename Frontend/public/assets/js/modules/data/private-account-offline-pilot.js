import {createOfflineMutationClient} from './offline-mutation-client.js';
import {resolveOfflineQueueLease} from './offline-mutation-lease.js';

const DEVICE_KEY = 'codex_m6_private_account_device_id';
const HANDOFF_PREFIX = 'codex_m6_private_account_handoff:';
const HANDOFF_TTL_MS = 60_000;

export function isPrivateAccountPilotEnabled(search = globalThis.location?.search || '') {
    return new URLSearchParams(search).get('m6pilot') === '1';
}

// [M6-A-8c] Opt-in **esplicito** del lease IndexedDB nel pilota, spento per default: serve
// `?m6lease=1` (in aggiunta a `?m6pilot=1`, che abilita il pilota) e comunque Web Locks deve
// mancare davvero, perché il percorso di piattaforma resta prioritario. Il parametro è l'unico modo
// per accendere il lease; nessun percorso lo attiva da sé.
export function isPrivateAccountLeaseFallbackEnabled(search = globalThis.location?.search || '') {
    return new URLSearchParams(search).get('m6lease') === '1';
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

export async function createPrivateAccountPilotClient({uid, vaultKeyMaterial, onState, isActive,
    leaseFallback = isPrivateAccountLeaseFallbackEnabled(), locks, indexedDb, holderId} = {}) {
    return createOfflineMutationClient({
        uid,
        vaultKeyMaterial,
        enabled: true,
        callableName: 'applyPrivateAccountMutation',
        onState,
        isActive,
        // [M6-A-8c] Senza opt-in la chiave `withLease` **non** viene passata: il client usa il confine
        // di sempre (`withOfflineQueueLease`) e il comportamento è identico a prima. Con l'opt-in il
        // risolutore decide a ogni chiamata: Web Locks se c'è, altrimenti il lease IndexedDB sul
        // database della coda (solo schema v2 valido, nessuna creazione, nessun upgrade).
        ...(leaseFallback === true
            ? {withLease: resolveOfflineQueueLease({uid, leaseFallback: true, isActive, locks, indexedDb, holderId})}
            : {})
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

export async function discardPrivateAccountPilotOperation(options) {
    const client = await createPrivateAccountPilotClient(options);
    try {
        await client.discard(options.operationId);
    } finally {
        client.close();
    }
}

export async function replacePrivateAccountPilotOperation(options) {
    const client = await createPrivateAccountPilotClient(options);
    try {
        return await client.replace(options.recoveryOperation, buildPrivateAccountOperation(options));
    } finally {
        client.close();
    }
}

// [M6-A-7] Upgrade additivo **su richiesta esplicita** del pilota di sviluppo: crea solo lo store
// del lease e lascia i contenitori sigillati identici. **Nessun** percorso dell'app lo avvia da
// sé: non è chiamato dalla costruzione del client, dal montaggio della pagina o dalla
// sincronizzazione. Quando aggiornare le PWA installate resta una decisione di prodotto aperta
// (M6-F3 e collaudi fisici). L'implementazione vive in un modulo senza dipendenze Firebase, così
// il percorso reale è provabile; qui viene riesportata per i chiamanti del pilota.
export {inspectPrivateAccountPilotQueue, upgradePrivateAccountPilotQueue} from './private-account-pilot-queue.js';
