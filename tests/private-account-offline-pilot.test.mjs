import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/private-account-offline-pilot.js', import.meta.url), 'utf8');
const dataUrl = value => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
// Moduli **reali** della coda e del risolutore del lease: quando l'opt-in è attivo il pilota usa
// davvero il risolutore, quindi la prova di collegamento non passa da un finto confine.
const queueUrl = dataUrl(await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-queue.js', import.meta.url), 'utf8'));
const leaseUrl = dataUrl((await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-lease.js', import.meta.url), 'utf8'))
    .replace("from './offline-mutation-queue.js'", `from '${queueUrl}'`));
const lease = await import(leaseUrl);

// Da un `data:` URL uno specifier **relativo** non è risolvibile: le due importazioni con percorso
// relativo vengono quindi sostituite da stub, mentre i percorsi reali sono provati dai moduli
// dedicati (suite del risolutore e banco browser con IndexedDB reale).
const TRIGGER_EXPORT = "export {inspectPrivateAccountPilotQueue, upgradePrivateAccountPilotQueue} from './private-account-pilot-queue.js';";
const modelSource = source
    .replace("import {createOfflineMutationClient} from './offline-mutation-client.js';", 'const createOfflineMutationClient = globalThis.__createClient;')
    .replace("import {resolveOfflineQueueLease} from './offline-mutation-lease.js';", 'const resolveOfflineQueueLease = globalThis.__resolveLease;')
    .replace(TRIGGER_EXPORT, 'export const inspectPrivateAccountPilotQueue = globalThis.__inspectTrigger;\nexport const upgradePrivateAccountPilotQueue = globalThis.__upgradeTrigger;')
    // Entrambe le letture del parametro di pagina (abilitazione del pilota e opt-in del lease).
    .replaceAll('globalThis.location?.search', 'globalThis.__pilotSearch');
assert.notEqual(modelSource.includes(TRIGGER_EXPORT), true, 'la riesportazione va sostituita per il data: URL');
globalThis.__pilotSearch = '';
globalThis.__inspectTrigger = () => { throw new Error('non usato'); };
globalThis.__upgradeTrigger = () => { throw new Error('non usato'); };
globalThis.localStorage = (() => { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; })();
globalThis.sessionStorage = (() => { const values = new Map(); return {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
}; })();
globalThis.__clientOptions = null;
globalThis.__createClient = options => { globalThis.__clientOptions = options; return {enqueue: async () => 'ok'}; };
globalThis.__resolveLease = lease.resolveOfflineQueueLease;
const pilot = await import(dataUrl(modelSource));

test('il pilot si abilita soltanto con parametro esplicito', () => {
    assert.equal(pilot.isPrivateAccountPilotEnabled('?m6pilot=1'), true);
    assert.equal(pilot.isPrivateAccountPilotEnabled('?m6pilot=0'), false);
    assert.equal(pilot.isPrivateAccountPilotEnabled(''), false);
});

test('costruisce un comando revisionato e stabile nello scope utente', () => {
    const operation = pilot.buildPrivateAccountOperation({uid: 'owner', recordId: 'account-1', expectedRevision: 2, record: {type: 'account'}});
    assert.equal(operation.uid, 'owner');
    assert.equal(operation.recordId, 'account-1');
    assert.equal(operation.expectedRevision, 2);
    assert.match(operation.operationId, /^[a-f0-9-]+:[a-f0-9-]+$/i);
    assert.throws(() => pilot.buildPrivateAccountOperation({uid: '', recordId: 'x', expectedRevision: 0, record: {}}), /INVALID/);
});

test('consegna alla lista soltanto il record cifrato dello stesso utente e una sola volta', () => {
    const record = {_encrypted: true, nomeAccount: 'Prova', password: 'ciphertext'};
    pilot.storePrivateAccountHandoff({uid: 'owner', recordId: 'account-2', expectedRevision: 4, record});
    assert.equal(pilot.consumePrivateAccountHandoff('other'), null);
    const restored = pilot.consumePrivateAccountHandoff('owner');
    assert.equal(restored.id, 'account-2');
    assert.equal(restored.revision, 5);
    assert.equal(restored.password, 'ciphertext');
    assert.equal(pilot.consumePrivateAccountHandoff('owner'), null);
    assert.throws(() => pilot.storePrivateAccountHandoff({uid: 'owner', recordId: 'x', expectedRevision: 0, record: {password: 'plain'}}), /INVALID/);
});

test('il pilota riesporta il trigger di upgrade e non lo avvia da sé', () => {
    // La sorgente reale deve contenere la riesportazione (il percorso effettivo del trigger è
    // provato sul modulo dedicato), e il modulo caricato non deve invocarla al montaggio.
    assert.equal(source.includes(TRIGGER_EXPORT), true);
    assert.equal(typeof pilot.upgradePrivateAccountPilotQueue, 'function');
    assert.equal(typeof pilot.inspectPrivateAccountPilotQueue, 'function');
    assert.throws(() => pilot.upgradePrivateAccountPilotQueue({uid: 'owner'}), /non usato/, 'il trigger non deve essere chiamato dal montaggio');
});

// ── M6-A-8c: opt-in del lease nel solo pilota, spento per default ────────────────────────────────
test('opt-in del lease spento per default: nessun confine alternativo iniettato', async () => {
    globalThis.__pilotSearch = '';
    globalThis.__clientOptions = null;
    await pilot.createPrivateAccountPilotClient({uid: 'owner', vaultKeyMaterial: 'fixture'});
    assert.equal(globalThis.__clientOptions.withLease, undefined, 'senza opt-in resta il confine di sempre');
    assert.equal(globalThis.__clientOptions.enabled, true, 'il pilota resta il percorso abilitato');
    assert.equal(pilot.isPrivateAccountLeaseFallbackEnabled(''), false);
    assert.equal(pilot.isPrivateAccountLeaseFallbackEnabled('?m6lease=0'), false);
    assert.equal(pilot.isPrivateAccountLeaseFallbackEnabled('?m6lease=1'), true);
    assert.equal(pilot.isPrivateAccountLeaseFallbackEnabled('?m6pilot=1'), false, 'i due opt-in sono distinti');
});

test('opt-in attivo: il pilota inietta il risolutore reale e Web Locks resta prioritario', async () => {
    globalThis.__pilotSearch = '?m6pilot=1&m6lease=1';
    globalThis.__clientOptions = null;
    const names = [];
    const locks = {request: async (name, _options, callback) => { names.push(name); return callback({name}); }};
    await pilot.createPrivateAccountPilotClient({uid: 'owner', vaultKeyMaterial: 'fixture', locks});
    assert.equal(typeof globalThis.__clientOptions.withLease, 'function', 'il confine iniettato è il risolutore');
    assert.deepEqual(await globalThis.__clientOptions.withLease('owner', async () => 'platform'), {acquired: true, value: 'platform'});
    assert.deepEqual(names, ['codex-offline-queue-owner'], 'con Web Locks presenti il lease IndexedDB non si usa');
});

test('opt-in attivo con Web Locks assente: il confine passa dal lease e fallisce chiuso senza coda', async () => {
    globalThis.__pilotSearch = '?m6lease=1';
    globalThis.__clientOptions = null;
    const probe = {aborted: false, open() {
        const request = {transaction: {abort() { probe.aborted = true; }}};
        setImmediate(() => request.onupgradeneeded?.());
        return request;
    }};
    await pilot.createPrivateAccountPilotClient({uid: 'owner', vaultKeyMaterial: 'fixture', locks: null, indexedDb: probe});
    let ran = false;
    await assert.rejects(globalThis.__clientOptions.withLease('owner', async () => { ran = true; }), /LEASE_DATABASE_MISSING/);
    assert.equal(ran, false, 'nessun task su una coda assente');
    assert.equal(probe.aborted, true, 'la transazione di cambio versione è annullata: nessun database creato');
});

test('l’opzione esplicita prevale sul parametro di pagina, in entrambe le direzioni', async () => {
    globalThis.__pilotSearch = '?m6lease=1';
    globalThis.__clientOptions = null;
    await pilot.createPrivateAccountPilotClient({uid: 'owner', vaultKeyMaterial: 'fixture', leaseFallback: false});
    assert.equal(globalThis.__clientOptions.withLease, undefined, 'opt-in spento esplicitamente');
    globalThis.__pilotSearch = '';
    globalThis.__clientOptions = null;
    await pilot.createPrivateAccountPilotClient({uid: 'owner', vaultKeyMaterial: 'fixture', leaseFallback: true,
        locks: null, indexedDb: {open() { return {transaction: {abort() {}}}; }}});
    assert.equal(typeof globalThis.__clientOptions.withLease, 'function', 'opt-in acceso esplicitamente');
});
