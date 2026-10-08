import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// [M6-A-8d] Prove Node mirate sul **Worker dedicato** del pilota lease: la stessa factory usata dal
// Worker nel browser viene pilotata con una IndexedDB in memoria e i **moduli runtime reali** di
// `Frontend/public/**` (caricati da `data:` URL, convenzione delle suite di questo progetto).
// Insieme alle asserzioni strutturali su sorgente e cablaggio del banco, queste prove coprono la
// logica dei comandi: mutazioni fenced sotto token, takeover, sessione, timeout, conferma e rifiuti.
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const readRuntime = file => readFile(new URL(`../Frontend/public/assets/js/modules/data/${file}`, import.meta.url), 'utf8');
const queueUrl = dataUrl(await readRuntime('offline-mutation-queue.js'));
const syncUrl = dataUrl(await readRuntime('offline-mutation-sync.js'));
const coreUrl = dataUrl(await readRuntime('offline-mutation-client-core.js'));
const leaseUrl = dataUrl((await readRuntime('offline-mutation-lease.js'))
    .replace("from './offline-mutation-queue.js'", `from '${queueUrl}'`));
const queue = await import(queueUrl);
const lease = await import(leaseUrl);
const workerSource = await readFile(new URL('../experiments/offline-sync/pilot-lease-worker.mjs', import.meta.url), 'utf8');
const workerModule = await import(dataUrl(workerSource
    .replace("from './offline-mutation-queue.js'", `from '${queueUrl}'`)
    .replace("from './offline-mutation-sync.js'", `from '${syncUrl}'`)
    .replace("from './offline-mutation-client-core.js'", `from '${coreUrl}'`)
    .replace("from './offline-mutation-lease.js'", `from '${leaseUrl}'`)));
const harnessSource = await readFile(new URL('../experiments/offline-sync/run-browser-tests.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const UID = 'owner-a';
const KEY = 'SYNTHETIC-NOT-A-USER-KEY';

// Fixture IndexedDB in memoria locale alla suite: store separati, bozza e commit alla conclusione,
// transazioni serializzate, blocco deliberato. Riproduce il contratto osservato dai moduli reali.
function databaseFixture({version = 2, stores = ['encryptedOperations', 'queueLeases'], structure = {}, missing = false, stall = false} = {}) {
    const data = new Map(stores.map(name => [name, new Map()]));
    const calls = {created: [], writes: [], transactions: []};
    let tail = Promise.resolve(), stalled = stall;
    const deferred = [];
    const database = {
        version,
        objectStoreNames: Object.assign([...stores], {contains: name => stores.includes(name)}),
        onversionchange: null,
        close() {},
        createObjectStore(name) { calls.created.push(name); return {createIndex() {}}; },
        transaction(requested, mode) {
            const wanted = Array.isArray(requested) ? requested : [requested];
            if (wanted.some(name => !stores.includes(name))) throw new Error('NotFoundError');
            calls.transactions.push({stores: [...wanted], mode});
            const requests = [];
            const tx = {db: database, mode, aborted: false, error: null, oncomplete: null, onabort: null, onerror: null,
                abort() { tx.aborted = true; },
                objectStore(name) {
                    const definition = structure[name] ?? {};
                    const enqueue = (action, key, value) => { const request = {}; requests.push({name, action, key, value, request}); return request; };
                    return {keyPath: definition.keyPath ?? 'id', autoIncrement: definition.autoIncrement ?? false,
                        get: key => enqueue('get', key), put: value => enqueue('put', value?.id, value),
                        add: value => enqueue('add', value?.id, value), delete: key => enqueue('delete', key),
                        count: () => enqueue('count'), openCursor: () => enqueue('cursor'),
                        index: () => ({getAll: () => enqueue('all')})};
                }};
            const run = () => {
                if (stalled) { deferred.push(run); return; }
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
    return {version, calls, store: name => data.get(name) ?? new Map(),
        record: () => (data.get('queueLeases')?.has(UID) ? structuredClone(data.get('queueLeases').get(UID)) : undefined),
        releaseStall() { stalled = false; for (const run of deferred.splice(0)) setImmediate(run); },
        indexedDb: {open() {
            const request = {transaction: {abort() {}}};
            if (missing) { setImmediate(() => { request.onupgradeneeded?.(); request.onerror?.(); }); return request; }
            setImmediate(() => { request.result = database; request.onsuccess?.(); });
            return request;
        }}};
}
const waitFor = async (predicate, timeoutMs = 3000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(resolve => setTimeout(resolve, 2)); }
    throw new Error('WAIT_TIMEOUT');
};
const rejection = async task => { try { await task(); return null; } catch (error) { return error?.code || error?.message; } };
const replies = messages => messages.filter(message => !message.event);
const last = messages => replies(messages).at(-1);
const spawnWorker = f => {
    const messages = [];
    const worker = workerModule.createPilotLeaseWorker({post: message => messages.push(message), indexedDb: f.indexedDb});
    return {messages, worker, command: payload => worker.handle(payload)};
};
const seed = async (f, operationIds) => {
    const key = await queue.deriveOfflineQueueKey(KEY, UID);
    for (const operationId of operationIds) {
        f.store('encryptedOperations').set(`${UID}:${operationId}`,
            await queue.sealOfflineOperation({uid: UID, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`}, key));
    }
};
const pageMutation = async (f, action, operationId, leaseContext) => {
    const instance = await queue.createOfflineMutationQueue({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
    try {
        const reader = await queue.createOfflineQueueReader({uid: UID, vaultKeyMaterial: KEY, indexedDb: f.indexedDb});
        const expected = (await reader.read()).operations.find(operation => operation.operationId === operationId);
        if (action === 'remove') return await instance.remove(expected, {isActive: () => true, lease: leaseContext});
        return await instance.markForReview(expected, {isActive: () => true, lease: leaseContext});
    } finally { instance.close(); }
};

// ── Struttura e cablaggio ───────────────────────────────────────────────────────────────────────
test('il Worker usa i moduli runtime, rimuove Web Locks e non importa da experiments', async () => {
    for (const specifier of ['./offline-mutation-queue.js', './offline-mutation-sync.js',
        './offline-mutation-client-core.js', './offline-mutation-lease.js']) {
        assert.equal(workerSource.includes(`from '${specifier}'`), true, `import runtime mancante: ${specifier}`);
    }
    assert.equal(/from\s+['"][^'"]*(?:experiments|\.mjs)['"]/.test(workerSource), false, 'il Worker non deve importare da experiments');
    assert.equal(workerSource.includes('offline-mutation-lease.mjs'), false, 'il candidato di laboratorio non è l’implementazione');
    assert.equal(workerSource.includes("Object.defineProperty(navigator, 'locks'"), true, 'Web Locks va rimossa nel realm');
    assert.equal(workerSource.includes("typeof navigator.locks !== 'undefined'"), true, 'la rimozione va verificata');
    assert.equal(workerSource.includes('resolveOfflineQueueLease'), true, 'il confine è il risolutore runtime');
    const page = await readFile(new URL('../experiments/offline-sync/browser-pilot-lease-worker.mjs', import.meta.url), 'utf8');
    assert.equal(page.includes("Object.defineProperty(navigator, 'locks'"), true, 'anche la pagina è senza Web Locks');
    assert.equal(page.includes("new Worker('/pilot-lease-worker.mjs', {type: 'module'})"), true, 'Worker dedicato di modulo');
    assert.equal(page.includes('experiments/offline-sync/offline-mutation-lease'), false, 'il banco non usa il candidato di laboratorio');
    assert.equal(harnessSource.includes("['/pilot-lease-worker.mjs', 'experiments/offline-sync/pilot-lease-worker.mjs']"), true, 'il banco deve servire il Worker');
    assert.equal(harnessSource.includes('--pilot-lease-worker'), true, 'modo del banco non registrato');
    assert.equal(typeof packageJson.scripts['test:offline-pilot-lease-worker'], 'string', 'script npm mancante');
});

// ── Comandi del Worker ──────────────────────────────────────────────────────────────────────────
test('con Web Locks di piattaforma presente il Worker resta sul percorso di piattaforma', async () => {
    // Node espone Web Locks solo su alcune piattaforme/build. Quando manca, il banco installa
    // l'equivalente minimo dell'API di piattaforma per provare comunque il **primo** ramo del
    // risolutore — Web Locks prioritario, nessun record di lease creato.
    if (typeof navigator.locks?.request !== 'function') {
        Object.defineProperty(navigator, 'locks', {configurable: true, value: {
            request: async (_name, _options, task) => task({name: _name, mode: 'exclusive'})
        }});
    }
    assert.equal(typeof navigator.locks?.request, 'function', 'Node deve offrire Web Locks per questo caso');
    const f = databaseFixture();
    await seed(f, ['device:1']);
    const {worker, messages} = spawnWorker(f);
    await worker.handle({op: 'mutate', id: 1, uid: UID, holderId: 'worker-locks', now: 1000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    assert.deepEqual([last(messages).ok, last(messages).after], [true, []], 'il percorso di piattaforma esegue la mutazione');
    assert.equal(f.record(), undefined, 'con Web Locks presenti il lease IndexedDB non viene usato');
    assert.deepEqual(f.calls.writes.filter(write => write.startsWith('queueLeases')), [], 'nessuna scrittura sul lease');
    // Da qui in avanti il realm è **senza** Web Locks, come il Worker nel browser: la rimozione è la
    // stessa (`Object.defineProperty` con valore `undefined`) e vale per il resto del processo.
    Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true});
    assert.equal(typeof navigator.locks, 'undefined', 'Web Locks rimossa nel realm delle prove');
});

test('le quattro mutazioni del Worker riescono sotto token con fencing e rilasciano il lease', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1']);
    const {worker, messages} = spawnWorker(f);
    const options = {uid: UID, holderId: 'worker-a', now: 1000, ttlMs: 30000};
    await worker.handle({...options, op: 'mutate', action: 'enqueue', operationId: 'device:9', id: 1});
    assert.deepEqual([last(messages).ok, last(messages).before, last(messages).after], [true, ['device:1'], ['device:1', 'device:9']]);
    await worker.handle({...options, op: 'mutate', action: 'replace', operationId: 'device:9', replacementOperationId: 'device:10', id: 2});
    assert.deepEqual([last(messages).ok, last(messages).after], [true, ['device:1', 'device:10']]);
    await worker.handle({...options, op: 'mutate', action: 'markForReview', operationId: 'device:10', id: 3});
    assert.deepEqual([last(messages).ok, last(messages).after], [true, ['device:1', 'device:10']]);
    await worker.handle({...options, op: 'mutate', action: 'remove', operationId: 'device:10', id: 4});
    assert.deepEqual([last(messages).ok, last(messages).after], [true, ['device:1']]);
    assert.ok(f.record().token >= 4, 'ogni mutazione ha preso un token');
    assert.equal(f.record().holderId, null, 'il lease è rilasciato alla fine di ogni comando');
    assert.deepEqual(f.calls.created, [], 'nessuno store creato');
});

test('takeover: il Worker con il token vecchio ottiene LEASE_LOST e zero scritture, il nuovo titolare prosegue', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1']);
    const {worker, messages} = spawnWorker(f);
    const hold = worker.handle({op: 'hold', id: 'h', uid: UID, holderId: 'worker-a', now: 1000, ttlMs: 50,
        action: 'remove', operationId: 'device:1', advanceTo: 2000});
    await waitFor(() => messages.some(message => message.event === 'held'));
    let pageEntered = false, releasePage;
    const pageGate = new Promise(resolve => { releasePage = resolve; });
    const page = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb,
        holderId: 'page-b', now: () => 2000, ttlMs: 30000});
    const pageRun = page(UID, async leaseContext => {
        pageEntered = true;
        await pageGate;
        await pageMutation(f, 'remove', 'device:1', leaseContext);
        return 'page';
    });
    await waitFor(() => pageEntered);
    await worker.handle({release: true});
    await hold;
    assert.deepEqual([last(messages).ok, last(messages).code], [false, 'LEASE_LOST']);
    assert.deepEqual([last(messages).before, last(messages).after], [['device:1'], ['device:1']], 'zero rimozioni');
    assert.equal(f.store('encryptedOperations').size, 1, 'il contenitore è rimasto');
    releasePage();
    assert.deepEqual(await pageRun, {acquired: true, value: 'page'});
    assert.equal(f.store('encryptedOperations').size, 0, 'il nuovo titolare completa la rimozione');
});

test('sessione scaduta prima e durante il task: nessuna scrittura e lease rilasciato', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1']);
    const {worker, messages} = spawnWorker(f);
    await worker.handle({op: 'session', id: 1, uid: UID, holderId: 'worker-a', now: 1000, ttlMs: 30000});
    assert.deepEqual([last(messages).ok, last(messages).code, last(messages).ran], [false, 'LEASE_SESSION_INACTIVE', false]);
    await worker.handle({op: 'session', id: 2, uid: UID, holderId: 'worker-b', now: 1000, ttlMs: 30000, during: true});
    assert.deepEqual([last(messages).ok, last(messages).code, last(messages).ran], [false, 'LEASE_SESSION_INACTIVE', true]);
    assert.equal(f.record().holderId, null, 'il lease è rilasciato anche quando la sessione cade nel task');
    assert.equal(f.store('encryptedOperations').size, 1);
});

test('errore del task, timeout di acquisizione e conferma con trasporto in errore', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1']);
    const {worker, messages} = spawnWorker(f);
    await worker.handle({op: 'failing', id: 1, uid: UID, holderId: 'worker-a', now: 1000, ttlMs: 30000});
    assert.deepEqual([last(messages).ok, last(messages).code, last(messages).ran], [false, 'SYNTHETIC_TASK_FAILURE', true]);
    assert.equal(f.record().holderId, null, 'rilascio dopo l’errore');

    const stalled = databaseFixture({stall: true});
    await seed(stalled, ['device:1']);
    const stalledWorker = spawnWorker(stalled);
    await stalledWorker.command({op: 'blocked', id: 1, uid: UID, holderId: 'worker-b', now: 1000, acquireTimeoutMs: 20});
    assert.deepEqual([last(stalledWorker.messages).ok, last(stalledWorker.messages).code, last(stalledWorker.messages).ran],
        [false, 'LEASE_ACQUIRE_TIMEOUT', false]);
    stalled.releaseStall();
    await waitFor(() => stalled.record()?.holderId === null);

    await worker.handle({op: 'flush', id: 2, uid: UID, holderId: 'worker-c', now: 1000, ttlMs: 30000});
    assert.deepEqual([last(messages).ok, last(messages).outcome?.value?.status], [true, 'saved']);
    assert.deepEqual(last(messages).after, [], 'la conferma rimuove l’operazione');
    await seed(f, ['device:2']);
    await worker.handle({op: 'flush', id: 3, uid: UID, holderId: 'worker-d', now: 1000, ttlMs: 30000, send: 'fail'});
    assert.deepEqual([last(messages).ok, last(messages).outcome?.value?.status], [true, 'recoverable-error']);
    assert.deepEqual(last(messages).after, ['device:2'], 'la coda resta conservata');
    assert.equal(f.record().holderId, null, 'il lease è rilasciato anche con il trasporto in errore');
});

test('rifiuti del Worker su coda v1, database assente e schema malformato senza modifiche', async () => {
    const v1 = databaseFixture({version: 1, stores: ['encryptedOperations']});
    await seed(v1, ['device:1']);
    const v1Worker = spawnWorker(v1);
    await v1Worker.command({op: 'mutate', id: 1, uid: UID, holderId: 'worker-a', now: 1000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    assert.deepEqual([last(v1Worker.messages).ok, last(v1Worker.messages).code], [false, 'LEASE_SCHEMA_V1']);
    assert.equal(v1.store('encryptedOperations').size, 1, 'nessuna rimozione su schema v1');
    assert.deepEqual(v1.calls.created, []);

    const absent = databaseFixture({missing: true});
    const absentWorker = spawnWorker(absent);
    await absentWorker.command({op: 'mutate', id: 1, uid: UID, holderId: 'worker-b', now: 1000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    assert.deepEqual([last(absentWorker.messages).ok, last(absentWorker.messages).code], [false, 'LEASE_DATABASE_MISSING']);
    assert.deepEqual(absent.calls.created, [], 'nessun database creato');

    const malformed = databaseFixture({structure: {queueLeases: {keyPath: 'chiave'}}});
    await seed(malformed, ['device:1']);
    const malformedWorker = spawnWorker(malformed);
    await malformedWorker.command({op: 'mutate', id: 1, uid: UID, holderId: 'worker-c', now: 1000, ttlMs: 30000, action: 'remove', operationId: 'device:1'});
    assert.deepEqual([last(malformedWorker.messages).ok, last(malformedWorker.messages).code], [false, 'LEASE_SCHEMA_MALFORMED']);
    assert.equal(malformed.store('encryptedOperations').size, 1, 'contenitore invariato');
});

test('esclusione fra i due contesti: lease occupato dal Worker e dal lato pagina', async () => {
    const f = databaseFixture();
    await seed(f, ['device:1']);
    const {worker, messages} = spawnWorker(f);
    let entered = false;
    const hold = worker.handle({op: 'hold', id: 'h', uid: UID, holderId: 'worker-a', now: 1000, ttlMs: 30000});
    await waitFor(() => messages.some(message => message.event === 'held'));
    const page = lease.resolveOfflineQueueLease({uid: UID, leaseFallback: true, locks: null, indexedDb: f.indexedDb, holderId: 'page-a', now: () => 1000});
    const pageBlocked = await page(UID, async () => { entered = true; });
    assert.equal(pageBlocked.acquired, false, 'la pagina non entra mentre il Worker tiene il lease');
    assert.equal(entered, false);
    await worker.handle({release: true});
    await hold;
    assert.deepEqual([last(messages).ok, last(messages).outcome?.acquired], [true, true]);
    const pageFree = await page(UID, async () => 'page');
    assert.deepEqual(pageFree, {acquired: true, value: 'page'});
});
