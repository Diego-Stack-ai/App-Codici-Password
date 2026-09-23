import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// [M6-A-8e] Prove Node mirate sulla matrice **copie miste**: copia vecchia v1/Web-Locks-only,
// copia nuova con opt-in del lease e **rollback v2-compatibile**, sui moduli runtime reali di
// `Frontend/public/**` (caricati da `data:` URL, convenzione delle suite di questo progetto) e su
// una IndexedDB in memoria. Il Worker/banco di laboratorio sono verificati staticamente.
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const readRuntime = file => readFile(new URL(`../Frontend/public/assets/js/modules/data/${file}`, import.meta.url), 'utf8');
const queueUrl = dataUrl(await readRuntime('offline-mutation-queue.js'));
const syncUrl = dataUrl(await readRuntime('offline-mutation-sync.js'));
const coreUrl = dataUrl(await readRuntime('offline-mutation-client-core.js'));
const leaseUrl = dataUrl((await readRuntime('offline-mutation-lease.js'))
    .replace("from './offline-mutation-queue.js'", `from '${queueUrl}'`));
const queue = await import(queueUrl);
const lease = await import(leaseUrl);
const {createOfflineMutationClientCore} = await import(coreUrl);
const {createOfflineMutationSynchronizer, withOfflineQueueLease} = {...await import(syncUrl),
    ...await import(queueUrl)};
const workerSource = await readFile(new URL('../experiments/offline-sync/mixed-current-worker.mjs', import.meta.url), 'utf8');
const benchSource = await readFile(new URL('../experiments/offline-sync/browser-mixed-current.mjs', import.meta.url), 'utf8');
const harnessSource = await readFile(new URL('../experiments/offline-sync/run-browser-tests.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const UID = 'owner-a';
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';
const NAME = `codex-offline-queue-${UID}`;
const rejection = async task => { try { await task(); return null; } catch (error) { return error?.code || error?.message; } };

// Fixture IndexedDB in memoria: store separati, bozza e commit, e **VersionError** quando si apre con
// una versione diversa da quella corrente (è il comportamento della copia vecchia davanti a v2).
function databaseFixture({version = 2, stores = ['encryptedOperations', 'queueLeases']} = {}) {
    const data = new Map(stores.map(name => [name, new Map()]));
    const calls = {writes: [], created: [], transactions: []};
    let tail = Promise.resolve();
    const database = {
        version,
        objectStoreNames: Object.assign([...stores], {contains: name => stores.includes(name)}),
        onversionchange: null,
        close() {},
        createObjectStore(name) { calls.created.push(name); return {}; },
        transaction(requested, mode) {
            const wanted = Array.isArray(requested) ? requested : [requested];
            if (wanted.some(name => !stores.includes(name))) throw new Error('NotFoundError');
            calls.transactions.push({stores: [...wanted], mode});
            const requests = [];
            const tx = {db: database, mode, aborted: false, error: null, oncomplete: null, onabort: null, onerror: null,
                abort() { tx.aborted = true; },
                objectStore(name) {
                    const enqueue = (action, key, value) => { const request = {}; requests.push({name, action, key, value, request}); return request; };
                    return {keyPath: 'id', autoIncrement: false,
                        get: key => enqueue('get', key), put: value => enqueue('put', value?.id, value),
                        add: value => enqueue('add', value?.id, value), delete: key => enqueue('delete', key),
                        count: () => enqueue('count'), openCursor: () => enqueue('cursor'),
                        index: () => ({getAll: () => enqueue('all')})};
                }};
            const run = () => {
                if (tx.aborted) { tx.onabort?.(); return; }
                const drafts = new Map(wanted.map(name => [name, new Map(data.get(name))]));
                while (requests.length && !tx.aborted) {
                    const {name, action, key, value, request} = requests.shift();
                    const draft = drafts.get(name);
                    try {
                        if (action === 'get') request.result = structuredClone(draft.get(key));
                        else if (action === 'all') request.result = [...draft.values()].map(row => structuredClone(row));
                        else if (action === 'count') request.result = draft.size;
                        else if (action === 'delete') draft.delete(key);
                        else if (action === 'cursor') {
                            const rows = [...draft.values()].map(row => structuredClone(row));
                            const cursor = {value: undefined};
                            let index = 0;
                            const step = () => {
                                if (index < rows.length) { cursor.value = rows[index++]; request.result = cursor; request.onsuccess?.(); }
                                else { request.result = null; request.onsuccess?.(); }
                            };
                            cursor.continue = step;
                            step();
                        } else { draft.set(key, structuredClone(value)); calls.writes.push(`${name}:${action}`); }
                        if (action !== 'cursor') request.onsuccess?.();
                    } catch (error) { tx.error = error; tx.aborted = true; request.error = error; request.onerror?.(); }
                }
                if (!tx.aborted && mode === 'readwrite') for (const [name, draft] of drafts) data.set(name, draft);
                if (tx.aborted) tx.onabort?.(); else tx.oncomplete?.();
            };
            tail = tail.then(() => new Promise(resolve => setImmediate(() => { run(); resolve(); })));
            return tx;
        }
    };
    return {version, calls, store: name => data.get(name),
        record: () => (data.get('queueLeases')?.has(UID) ? structuredClone(data.get('queueLeases').get(UID)) : undefined),
        indexedDb: {open(_name, requestedVersion) {
            const request = {};
            if (requestedVersion !== undefined && requestedVersion !== version) {
                setImmediate(() => {
                    request.error = Object.assign(new Error('VersionError'), {name: 'VersionError'});
                    request.onerror?.();
                });
                return request;
            }
            setImmediate(() => { request.result = database; request.onsuccess?.(); });
            return request;
        }}};
}
const seed = async (f, operationIds) => {
    const key = await queue.deriveOfflineQueueKey(KEY, UID);
    for (const operationId of operationIds) {
        f.store('encryptedOperations').set(`${UID}:${operationId}`,
            await queue.sealOfflineOperation({uid: UID, operationId, recordId: `record-${operationId}`, value: operationId}, key));
    }
};
const canonicalRows = f => JSON.stringify([...f.store('encryptedOperations').values()]
    .slice().sort((left, right) => left.id.localeCompare(right.id)));
// Lettore della copia **precedente** (solo schema 1): modello del suo comportamento dichiarato.
const readWithPreviousV1Reader = async (f, uid) => {
    const database = await new Promise((resolve, reject) => {
        const request = f.indexedDb.open(`codex-offline-queue-${uid}`);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(Object.assign(new Error('OPEN'), {code: 'OPEN'}));
    });
    try {
        if (database.version !== 1) throw Object.assign(new Error('QUEUE_UNAVAILABLE_SCHEMA'), {code: 'QUEUE_UNAVAILABLE_SCHEMA'});
        return {version: database.version, rows: [...f.store('encryptedOperations').values()]};
    } finally { database.close(); }
};
const rollbackClient = async (f, {locks = null, sent}) => createOfflineMutationClientCore({
    uid: UID, vaultKeyMaterial: KEY, enabled: true,
    createQueue: options => queue.createOfflineMutationQueue({...options, indexedDb: f.indexedDb}),
    createQueueReader: options => queue.createOfflineQueueReader({...options, indexedDb: f.indexedDb}),
    createSynchronizer: createOfflineMutationSynchronizer,
    // Rollback: **nessun** fallback, solo il lock di piattaforma (qui assente).
    withLease: (id, task) => withOfflineQueueLease(id, task, locks),
    createChannel: () => ({notify() {}, close() {}}),
    send: async operation => { sent.push(operation.operationId); return {status: 'applied', operationId: operation.operationId}; },
    isOnline: () => true, onState: () => {}
});

// ── Struttura e cablaggio ───────────────────────────────────────────────────────────────────────
test('banco e Worker dedicati usano i moduli runtime e sono registrati', () => {
    for (const specifier of ['./offline-mutation-queue.js', './offline-mutation-sync.js',
        './offline-mutation-client-core.js', './offline-mutation-lease.js']) {
        assert.equal(workerSource.includes(`from '${specifier}'`), true, `import runtime mancante: ${specifier}`);
    }
    assert.equal(/from\s+['"][^'"]*(?:experiments|\.mjs)['"]/.test(workerSource), false, 'il Worker non deve importare da experiments');
    assert.equal(benchSource.includes("from './offline-mutation-upgrade.js'"), true, 'il banco usa il percorso di upgrade del runtime');
    assert.equal(benchSource.includes("new Worker('/mixed-current-worker.mjs', {type: 'module'})"), true, 'Worker dedicato di modulo');
    assert.equal(harnessSource.includes("['/mixed-current-worker.mjs', 'experiments/offline-sync/mixed-current-worker.mjs']"), true, 'il banco deve servire il Worker');
    assert.equal(harnessSource.includes('--mixed-current'), true, 'modo del banco non registrato');
    assert.equal(typeof packageJson.scripts['test:offline-mixed-current'], 'string', 'script npm mancante');
    // Il rollback non è mai modellato come lettore solo-v1: il banco usa il lettore compatibile.
    assert.equal(benchSource.includes('rollback-read'), true, 'il banco prova il lettore compatibile nel rollback');
});

// ── Copia vecchia e lettore precedente ──────────────────────────────────────────────────────────
test('copia vecchia: legge la v1 e fallisce in modo esplicito davanti alla v2 senza scrivere', async () => {
    const v1 = databaseFixture({version: 1, stores: ['encryptedOperations']});
    await seed(v1, ['device:1', 'device:2']);
    const previous = await readWithPreviousV1Reader(v1, UID);
    assert.deepEqual([previous.version, previous.rows.length], [1, 2], 'la copia vecchia legge la v1');
    const v2 = databaseFixture();
    await seed(v2, ['device:1', 'device:2']);
    const rows = canonicalRows(v2);
    assert.equal(await new Promise(resolve => {
        const request = v2.indexedDb.open(NAME, 1);
        request.onerror = () => resolve(request.error?.name || 'ERROR');
    }), 'VersionError', 'apertura a versione 1 su uno schema v2');
    await assert.rejects(readWithPreviousV1Reader(v2, UID), /QUEUE_UNAVAILABLE_SCHEMA/);
    assert.equal(canonicalRows(v2), rows, 'contenitori intatti');
    assert.deepEqual(v2.calls.writes, [], 'nessuna scrittura');
});

// ── Rollback v2-compatibile ─────────────────────────────────────────────────────────────────────
test('rollback v2-compatibile: legge la v2 ma rifiuta sincronizzazione e mutazioni senza lock', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1', 'device:2']);
    const rows = canonicalRows(f);
    const sent = [];
    const client = await rollbackClient(f, {locks: null, sent});
    const reader = await queue.createOfflineQueueReader({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
    const state = await reader.read();
    assert.deepEqual([state.available, state.version, state.operations.length], [true, 2, 2], 'il rollback **legge** la v2');
    assert.equal(await rejection(() => client.flush()), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE');
    assert.deepEqual(sent, [], 'nessun invio dal rollback senza lock');
    assert.equal(await rejection(() => client.discard('device:1')), 'OFFLINE_QUEUE_LOCKS_UNAVAILABLE');
    assert.equal(canonicalRows(f), rows, 'contenitori byte-identici');
    assert.equal(f.record(), undefined, 'il rollback non crea né usa il lease');
    assert.equal(f.calls.writes.filter(write => write.startsWith('queueLeases')).length, 0, 'nessuna scrittura sul lease');
    client.close();
});

// ── Copia nuova con opt-in del lease ────────────────────────────────────────────────────────────
test('copia nuova con opt-in: lavora sotto il lease sulla v2 e il vecchio non può mescolarsi', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1', 'device:2']);
    const rows = canonicalRows(f);
    const boundary = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null,
        indexedDb: f.indexedDb, holderId: 'page-new', now: () => 1000, ttlMs: 30000});
    const instance = await queue.createOfflineMutationQueue({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
    const outcome = await boundary(UID, async context => {
        const reader = await queue.createOfflineQueueReader({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
        const expected = (await reader.read()).operations.find(operation => operation.operationId === 'device:1');
        await instance.markForReview(expected, {isActive: () => true, lease: context});
        return context.token;
    });
    assert.equal(outcome.acquired, true);
    assert.equal(f.record().holderId, null, 'il lease è rilasciato');
    assert.notEqual(canonicalRows(f), rows, 'la marcatura risigilla il contenitore (nuovo IV)');
    assert.deepEqual([...f.store('encryptedOperations').keys()].sort(), [`${UID}:device:1`, `${UID}:device:2`]);
    // Il vecchio non può scrivere su v2: la sua apertura a versione 1 fallisce e nulla cambia.
    const afterMarker = canonicalRows(f);
    assert.equal(await new Promise(resolve => {
        const request = f.indexedDb.open(NAME, 1);
        request.onerror = () => resolve(request.error?.name || 'ERROR');
    }), 'VersionError');
    assert.equal(canonicalRows(f), afterMarker, 'nessuna scrittura della copia vecchia');
    assert.equal(f.store('encryptedOperations').size, 2, 'nessun duplicato e nessuna cancellazione');
    instance.close();
});
