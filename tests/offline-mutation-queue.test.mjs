import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-queue.js', import.meta.url), 'utf8');
const queue = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const upgradeSource = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-upgrade.js', import.meta.url), 'utf8');
const upgrade = await import(`data:text/javascript;base64,${Buffer.from(upgradeSource).toString('base64')}`);
const syncSource = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-sync.js', import.meta.url), 'utf8');
const {createOfflineMutationSynchronizer} = await import(`data:text/javascript;base64,${Buffer.from(syncSource).toString('base64')}`);

test('il contenitore runtime è cifrato, autenticato e legato allo UID', async () => {
    const key = await queue.deriveOfflineQueueKey('FIXTURE-NON-SEGRETO', 'owner-a');
    const operation = {uid: 'owner-a', operationId: 'device-a:1', recordId: 'record-1', changes: {password: 'fixture'}};
    const sealed = await queue.sealOfflineOperation(operation, key);
    assert.equal(JSON.stringify(sealed).includes('fixture'), false);
    assert.deepEqual(await queue.openOfflineOperation(sealed, key, 'owner-a'), operation);
    await assert.rejects(queue.openOfflineOperation(sealed, key, 'owner-b'), /SCOPE/);
    sealed.ciphertext = `${sealed.ciphertext.slice(0, -2)}AA`;
    await assert.rejects(queue.openOfflineOperation(sealed, key, 'owner-a'));
});

test('Web Lock concede la lavorazione a una sola scheda', async () => {
    let occupied = false;
    const locks = {request: async (_name, _options, callback) => {
        if (occupied) return callback(null);
        occupied = true;
        try { return await callback({name: 'lock'}); } finally { occupied = false; }
    }};
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const first = queue.withOfflineQueueLease('owner-a', () => gate, locks);
    await Promise.resolve();
    assert.deepEqual(await queue.withOfflineQueueLease('owner-a', () => 'seconda', locks), {acquired: false});
    release('prima');
    assert.deepEqual(await first, {acquired: true, value: 'prima'});
});

test('BroadcastChannel notifica soltanto la coda dello stesso utente', () => {
    let instance;
    class FakeChannel {
        constructor(name) { this.name = name; instance = this; }
        postMessage(value) { this.posted = value; }
        close() { this.closed = true; }
    }
    let changes = 0;
    const channel = queue.createOfflineQueueChannel('owner-a', () => { changes += 1; }, FakeChannel);
    channel.notify();
    assert.deepEqual(instance.posted, {type: 'changed', uid: 'owner-a'});
    instance.onmessage({data: {type: 'changed', uid: 'owner-b'}});
    instance.onmessage({data: {type: 'changed', uid: 'owner-a'}});
    assert.equal(changes, 1);
    channel.close(); assert.equal(instance.closed, true);
});

// Transactional in-memory IndexedDB boundary: requests, serial transactions and rollback on abort.
function indexedFixture() {
    const data = new Map();
    let tail = Promise.resolve(), beforeWrite, failAdd = false;
    const database = {
        close() {},
        transaction(_store, mode) {
            const requests = [];
            const tx = {aborted: false, abort() { this.aborted = true; }, objectStore: () => store};
            const request = (action, key, value) => { const req = {}; requests.push({action,key,value,req}); return req; };
            const store = {
                get: key => request('get', key), put: value => request('put', value.id, value),
                add: value => request('add', value.id, value), delete: key => request('delete', key),
                index: () => ({getAll: () => request('all')})
            };
            tail = tail.then(() => new Promise(resolve => setImmediate(async () => {
                if (mode === 'readwrite' && beforeWrite) { const hook=beforeWrite;beforeWrite=null;hook(data); }
                const draft = new Map(data);
                while (requests.length && !tx.aborted) {
                    const {action,key,value,req}=requests.shift();
                    try {
                        if (action==='get') req.result=structuredClone(draft.get(key));
                        if (action==='all') req.result=[...draft.values()].map(x=>structuredClone(x)).sort((a,b)=>a.queuedAt-b.queuedAt);
                        if (action==='delete') draft.delete(key);
                        if (action==='put' || action==='add') {
                            if (action==='add' && (failAdd || draft.has(key))) throw Error('INDEXED_DB_WRITE_FAILED');
                            draft.set(key,structuredClone(value));
                        }
                        req.onsuccess?.();
                    } catch(error) { tx.error=error;tx.aborted=true;req.error=error;req.onerror?.(); }
                }
                if (!tx.aborted && mode==='readwrite') {data.clear();for(const [k,v] of draft)data.set(k,v);}
                await Promise.resolve();
                if(tx.aborted)tx.onabort?.();else tx.oncomplete?.();
                resolve();
            })));
            return tx;
        }
    };
    return {data,set beforeWrite(fn){beforeWrite=fn},set failAdd(value){failAdd=value},indexedDb:{open(){const req={};setImmediate(()=>{req.result=database;req.onsuccess?.()});return req}}};
}
const oldOperation = {uid:'owner-a',operationId:'device:old',recordId:'account-1',expectedRevision:1,record:{password:'cipher-old'}};
const newOperation = {...oldOperation,operationId:'device:new',expectedRevision:2,record:{password:'cipher-new'}};
async function replacementFixture() {
    const idb=indexedFixture();
    const instance=await queue.createOfflineMutationQueue({uid:'owner-a',vaultKeyMaterial:'SYNTHETIC-KEY',indexedDb:idb.indexedDb});
    await instance.enqueue(oldOperation);
    return {idb,instance};
}

test('a stale acknowledgement cannot remove an operation marked for reconciliation while send was pending', async () => {
    const {instance} = await replacementFixture();
    const sent = (await instance.list())[0];
    let marked;
    const states = [];
    const sync = createOfflineMutationSynchronizer({uid: 'owner-a', queue: instance,
        withLease: async (_uid, task) => task(), isOnline: () => true, onState: state => states.push(state),
        send: async () => { marked = await instance.markForReview(sent); return {status: 'applied'}; }});
    assert.equal((await sync.flush()).status, 'recoverable-error');
    assert.deepEqual(await instance.list(), [marked]);
    assert.equal(states.some(state => state.state === 'saved'), false);
});

test('ack final transaction rejects changed container, missing record and session invalidation', async () => {
    for (const mode of ['change', 'remove', 'session']) {
        const {idb, instance} = await replacementFixture();
        let active = true;
        idb.beforeWrite = data => {
            const id = `owner-a:${oldOperation.operationId}`;
            if (mode === 'change') data.set(id, {...data.get(id), queuedAt: 0});
            if (mode === 'remove') data.delete(id);
            if (mode === 'session') active = false;
        };
        await assert.rejects(instance.remove(oldOperation, {isActive: () => active}), mode === 'session' ? /SESSION_CHANGED/ : /ACK_CHANGED/);
        assert.equal(idb.data.size, mode === 'remove' ? 0 : 1);
    }
    const {instance} = await replacementFixture();
    await assert.rejects(instance.remove(oldOperation.operationId), /SCOPE_INVALID/);
    await instance.remove(oldOperation);
    await assert.rejects(instance.remove(oldOperation), /ACK_MISSING/);
});

test('enqueue identical ID is a no-op preserving ciphertext/order, changed command cannot overwrite', async () => {
    const {idb, instance} = await replacementFixture();
    const original = structuredClone([...idb.data.values()][0]);
    await instance.enqueue(structuredClone(oldOperation));
    assert.deepEqual([...idb.data.values()][0], original);
    await assert.rejects(instance.enqueue({...oldOperation, record: {password: 'changed'}}), /ID_REUSED/);
    assert.deepEqual(await instance.list(), [oldOperation]);
    const marked = await instance.markForReview(oldOperation);
    await assert.rejects(instance.enqueue(oldOperation), /ID_REUSED/);
    assert.deepEqual(await instance.list(), [marked]);
    assert.equal(JSON.stringify([...idb.data.values()]).includes('cipher-old'), false);
});

test('concurrent same-ID enqueue cannot replace a winner, and final session guard prevents insertion', async () => {
    const idb = indexedFixture();
    const instance = await queue.createOfflineMutationQueue({uid: 'owner-a', vaultKeyMaterial: 'SYNTHETIC-KEY', indexedDb: idb.indexedDb});
    const other = {...oldOperation, record: {password: 'different'}};
    const outcomes = await Promise.allSettled([instance.enqueue(oldOperation), instance.enqueue(other)]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await instance.list()).length, 1);
    let active = true;
    idb.beforeWrite = () => { active = false; };
    await assert.rejects(instance.enqueue(newOperation, {isActive: () => active}), /SESSION_CHANGED/);
    assert.equal((await instance.list()).length, 1);
});
test('replace atomically substitutes encrypted operation and keeps original queue order',async()=>{
    const {idb,instance}=await replacementFixture();const queuedAt=[...idb.data.values()][0].queuedAt;
    assert.equal(await instance.replace(oldOperation,newOperation),'device:new');
    assert.deepEqual(await instance.list(),[newOperation]);
    assert.equal([...idb.data.values()][0].queuedAt,queuedAt);
    assert.equal(JSON.stringify([...idb.data.values()]).includes('cipher-new'),false);
});
test('replace rejects wrong UID, record, same ID, changed expected and absent original',async()=>{
    const {instance}=await replacementFixture();
    for(const replacement of [{...newOperation,uid:'owner-b'},{...newOperation,recordId:'other'},{...newOperation,operationId:oldOperation.operationId}]){
        await assert.rejects(instance.replace(oldOperation,replacement),/SCOPE_INVALID/);
    }
    await assert.rejects(instance.replace({...oldOperation,expectedRevision:99},newOperation),/CHANGED/);
    assert.deepEqual(await instance.list(),[oldOperation]);
    await instance.remove(oldOperation);
    await assert.rejects(instance.replace(oldOperation,newOperation),/MISSING/);
});
test('CAS rejects concurrent change/removal and replacement ID collision without losing queued data',async()=>{
    for(const mode of ['change','remove','collision']) {
        const {idb,instance}=await replacementFixture();
        if(mode==='collision') await instance.enqueue(newOperation);
        else idb.beforeWrite=data=>{const id=`owner-a:${oldOperation.operationId}`;if(mode==='remove')data.delete(id);else data.set(id,{...data.get(id),queuedAt:0});};
        await assert.rejects(instance.replace(oldOperation,newOperation),mode==='collision'?/EXISTS/:/CHANGED/);
        assert.equal(idb.data.size,mode==='remove'?0:mode==='collision'?2:1);
        if(mode!=='remove')assert.ok(idb.data.has(`owner-a:${oldOperation.operationId}`));
    }
});
test('write failure rolls back deletion and encryption failure leaves original intact',async()=>{
    const {idb,instance}=await replacementFixture();idb.failAdd=true;
    await assert.rejects(instance.replace(oldOperation,newOperation),/WRITE_FAILED/);
    assert.deepEqual(await instance.list(),[oldOperation]);
    idb.failAdd=false;
    const encrypt=crypto.subtle.encrypt;
    crypto.subtle.encrypt=async()=>{throw Error('ENCRYPTION_FAILED')};
    try {await assert.rejects(instance.replace(oldOperation,newOperation),/ENCRYPTION_FAILED/);} finally {crypto.subtle.encrypt=encrypt;}
    assert.deepEqual(await instance.list(),[oldOperation]);
});
test('session change during encryption or at final CAS preserves original',async()=>{
    for(const stage of ['encryption','commit']) {
        const {idb,instance}=await replacementFixture();let active=true;
        const encrypt=crypto.subtle.encrypt;
        if(stage==='encryption')crypto.subtle.encrypt=async function(...args){const value=await encrypt.apply(this,args);active=false;return value};
        else idb.beforeWrite=()=>{active=false};
        try {await assert.rejects(instance.replace(oldOperation,newOperation,{isActive:()=>active}),/OFFLINE_SESSION_CHANGED/);}finally{crypto.subtle.encrypt=encrypt;}
        assert.deepEqual(await instance.list(),[oldOperation]);
    }
});

test('review marker persists encrypted with same identity/order and disappears only on explicit replacement',async()=>{
    const {idb,instance}=await replacementFixture();
    const originalContainer=[...idb.data.values()][0];
    const marked=await instance.markForReview(oldOperation);
    assert.deepEqual(marked,{...oldOperation,_queueState:'reconciliation-required'});
    assert.deepEqual(await instance.list(),[marked]);
    const container=[...idb.data.values()][0];
    assert.equal(container.id,originalContainer.id);assert.equal(container.queuedAt,originalContainer.queuedAt);
    assert.equal(JSON.stringify(container).includes('reconciliation-required'),false);
    assert.equal(oldOperation._queueState,undefined);
    await instance.replace(marked,newOperation);
    assert.deepEqual(await instance.list(),[newOperation]);
});
test('review marker CAS refuses concurrent change/removal and stale expected snapshot',async()=>{
    for(const mode of ['change','remove','stale']){
        const {idb,instance}=await replacementFixture();
        if(mode==='stale')await instance.markForReview(oldOperation);
        else idb.beforeWrite=data=>{const id=`owner-a:${oldOperation.operationId}`;if(mode==='remove')data.delete(id);else data.set(id,{...data.get(id),queuedAt:0});};
        await assert.rejects(instance.markForReview(oldOperation),/CHANGED/);
        assert.equal(idb.data.size,mode==='remove'?0:1);
        if(mode==='change')assert.deepEqual(await instance.list(),[oldOperation]);
    }
});
test('failed review write or changed session keeps original unmarked',async()=>{
    for(const mode of ['write','session']){
        const {idb,instance}=await replacementFixture();let active=true;
        if(mode==='write')idb.failAdd=true;else idb.beforeWrite=()=>{active=false};
        await assert.rejects(instance.markForReview(oldOperation,{isActive:()=>active}),mode==='write'?/WRITE_FAILED/:/SESSION_CHANGED/);
        assert.deepEqual(await instance.list(),[oldOperation]);
    }
});


test('scope review reason stays inside encrypted payload and survives reopening',async()=>{
    const {idb,instance}=await replacementFixture();
    const reason='PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED';
    const marked=await instance.markForReview(oldOperation,{reviewReason:reason});
    assert.equal(marked._reviewReason,reason);
    assert.deepEqual(await instance.list(),[marked]);
    assert.equal(JSON.stringify([...idb.data.values()]).includes(reason),false);
    await assert.rejects(instance.markForReview(marked,{reviewReason:'unknown'}),/REASON_INVALID/);
    assert.deepEqual(await instance.list(),[marked]);
});

function openingFixture() {
    const request = {};
    const database = {closed: 0, close() { this.closed++; }, transaction() {
        if (this.closed) throw Object.assign(new Error('la connessione è chiusa'), {name: 'InvalidStateError'});
        return {};
    }};
    const indexedDb = {open(name, version) { assert.equal(name, 'codex-offline-queue-owner-a'); assert.equal(version, 1); return request; }};
    return {request, database, indexedDb, succeed() { request.result = database; request.onsuccess(); }};
}

test('database lifecycle closes on version change without deleting or upgrading queued data', async () => {
    const f = openingFixture();
    const pending = queue.openOfflineQueueDatabase('owner-a', f.indexedDb);
    f.succeed(); assert.equal(await pending, f.database);
    assert.equal(f.database.closed, 0);
    f.database.onversionchange({newVersion: 2});
    assert.equal(f.database.closed, 1);
});

test('lo scrittore chiuso da un upgrade concorrente non è più operabile', async () => {
    const f = openingFixture();
    const pending = queue.createOfflineMutationQueue({uid: 'owner-a', vaultKeyMaterial: 'FIXTURE-KEY', indexedDb: f.indexedDb});
    // `createOfflineMutationQueue` deriva prima la chiave, quindi la richiesta viene aperta al giro
    // successivo: si attende che il gestore sia installato prima di simularne l'esito.
    while (typeof f.request.onsuccess !== 'function') await new Promise(resolve => setImmediate(resolve));
    f.succeed();
    const instance = await pending;
    assert.equal(instance.isOperable(), true);
    // Un'altra scheda esegue l'upgrade: la reazione a `versionchange` chiude la connessione v1,
    // ma l'oggetto coda resta in mano al chiamante.
    f.database.onversionchange({newVersion: 2});
    assert.equal(f.database.closed, 1);
    assert.equal(instance.isOperable(), false);
});

test('blocked and timed-out opens reject and close late success instead of leaking a handle', async () => {
    for (const mode of ['blocked', 'timeout']) {
        const f = openingFixture();
        const pending = queue.openOfflineQueueDatabase('owner-a', f.indexedDb, {timeoutMs: 10});
        const rejected = assert.rejects(pending, mode === 'blocked' ? /DATABASE_BLOCKED/ : /OPEN_TIMEOUT/);
        if (mode === 'blocked') f.request.onblocked();
        await rejected; f.succeed(); assert.equal(f.database.closed, 1);
    }
});

test('cancelled or stale opens cannot initialize a database or return a late handle', async () => {
    for (const mode of ['abort', 'session']) {
        const f = openingFixture(), controller = new AbortController(); let active = true, aborted = false;
        const pending = queue.openOfflineQueueDatabase('owner-a', f.indexedDb, {signal: controller.signal, isActive: () => active});
        const rejected = assert.rejects(pending, /SESSION_CHANGED/);
        if (mode === 'abort') controller.abort(); else active = false;
        f.request.transaction = {abort() { aborted = true; }};
        f.request.onupgradeneeded();
        await rejected; assert.equal(aborted, true);
        f.succeed(); assert.equal(f.database.closed, 1);
    }
});

test('database open errors propagate and invalid key or inactive session does not open a connection', async () => {
    const f = openingFixture();
    const pending = queue.openOfflineQueueDatabase('owner-a', f.indexedDb);
    const error = new Error('VersionError'); f.request.error = error; f.request.onerror();
    await assert.rejects(pending, failure => failure === error);
    const noOpen = {open() { assert.fail('database must not open'); }};
    await assert.rejects(queue.createOfflineMutationQueue({uid: 'owner-a', vaultKeyMaterial: '', indexedDb: noOpen}), /KEY_REQUIRED/);
    await assert.rejects(queue.createOfflineMutationQueue({uid: 'owner-a', vaultKeyMaterial: 'fixture', indexedDb: noOpen, isActive: () => false}), /SESSION_CHANGED/);
});

// ── M6-A-1: lettore compatibile v1/v2, sola lettura e nessun upgrade ────────
const validContainer = (uid, operationId, extra = {}) => ({id: `${uid}:${operationId}`, uid, operationId,
    schemaVersion: 1, iv: 'FIXTURE-IV', ciphertext: 'FIXTURE-CIPHERTEXT', queuedAt: 1, ...extra});

function readerFixture({version = 1, names = null, rows = [], missing = false, keyPath = 'id', autoIncrement = false} = {}) {
    const calls = {opens: [], created: [], writes: [], transactions: [], aborts: 0, closes: 0, upgradeAborts: 0};
    const stores = names ?? (version === 2 ? ['encryptedOperations', 'queueLeases'] : ['encryptedOperations']);
    const indexedDb = {open(...args) {
        calls.opens.push(args);
        const request = {transaction: {abort() { calls.upgradeAborts += 1; }}};
        if (missing) {
            setImmediate(() => { request.onupgradeneeded?.(); request.onerror?.(); });
            return request;
        }
        const database = {
            version,
            objectStoreNames: Object.assign([...stores], {contains: name => stores.includes(name)}),
            onversionchange: null,
            close() { calls.closes += 1; },
            transaction(requested, mode) {
                calls.transactions.push({requested: [...(Array.isArray(requested) ? requested : [requested])], mode});
                const tx = {aborted: false, error: null, oncomplete: null, onabort: null, onerror: null,
                    abort() { this.aborted = true; calls.aborts += 1; },
                    objectStore: () => ({
                        keyPath, autoIncrement,
                        put() { calls.writes.push('put'); }, add() { calls.writes.push('add'); },
                        delete() { calls.writes.push('delete'); }, clear() { calls.writes.push('clear'); },
                        openCursor() {
                            // API reale: la richiesta espone `result` = cursore finché ci sono
                            // righe e `null` alla fine; il cursore espone `value` e `continue()`.
                            const cursor = {value: undefined};
                            const request = {result: null, onsuccess: null, onerror: null};
                            let index = 0;
                            const step = () => setImmediate(() => {
                                if (index < rows.length) {
                                    cursor.value = structuredClone(rows[index++]);
                                    request.result = cursor;
                                    request.onsuccess?.();
                                    return;
                                }
                                request.result = null; request.onsuccess?.();
                                setImmediate(() => { tx.aborted ? tx.onabort?.() : tx.oncomplete?.(); });
                            });
                            cursor.continue = step;
                            step();
                            return request;
                        }
                    })};
                return tx;
            }
        };
        setImmediate(() => { request.result = database; request.onsuccess?.(); });
        return request;
    }};
    return {calls, indexedDb};
}

const readerCases = [
    {name: 'schema v1 con coda pendente', options: {version: 1, rows: [validContainer('owner-a', 'device:1'), validContainer('owner-a', 'device:2')]},
        expect: {version: 1, operationIds: ['device:1', 'device:2']}},
    {name: 'schema v2 con store del lease', options: {version: 2, rows: [validContainer('owner-a', 'device:1')]},
        expect: {version: 2, operationIds: ['device:1']}}
];

for (const {name, options, expect: expected} of readerCases) {
    test(`lettore compatibile: ${name}`, async () => {
        const f = readerFixture(options);
        const result = await queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: f.indexedDb});
        assert.equal(result.version, expected.version);
        assert.deepEqual(result.containers.map(row => row.operationId), expected.operationIds);
        assert.deepEqual(f.calls.opens.map(args => args.length), [1], 'apertura senza versione: nessun upgrade richiesto');
        assert.deepEqual(f.calls.created, [], 'nessuno store creato');
        assert.deepEqual(f.calls.writes, [], 'nessuna scrittura');
        assert.deepEqual(f.calls.transactions.map(tx => tx.mode), ['readonly']);
        assert.deepEqual(f.calls.transactions[0].requested,
            expected.version === 2 ? ['encryptedOperations', 'queueLeases'] : ['encryptedOperations']);
        assert.equal(f.calls.upgradeAborts, 0);
        assert.equal(f.calls.closes >= 1, true, 'connessione chiusa');
    });
}

test('lettore compatibile: database mancante resta mancante, nessuno store creato', async () => {
    const f = readerFixture({missing: true});
    await assert.rejects(queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: f.indexedDb}), /QUEUE_READER_MISSING/);
    assert.equal(f.calls.upgradeAborts, 1, 'upgrade annullato: il database non nasce');
    assert.deepEqual(f.calls.created, []);
    assert.deepEqual(f.calls.writes, []);
    assert.deepEqual(f.calls.transactions, []);
});

test('lettore compatibile: schema non supportato o malformato fallisce chiuso', async () => {
    const cases = [
        {options: {version: 3}, code: /QUEUE_READER_SCHEMA/},
        {options: {version: 2, names: ['encryptedOperations']}, code: /QUEUE_READER_SCHEMA/},
        {options: {version: 1, names: ['altraCollection']}, code: /QUEUE_READER_SCHEMA/},
        {options: {version: 1, keyPath: 'chiave'}, code: /QUEUE_READER_SCHEMA/},
        {options: {version: 1, autoIncrement: true}, code: /QUEUE_READER_SCHEMA/}
    ];
    for (const {options, code} of cases) {
        const f = readerFixture({rows: [validContainer('owner-a', 'device:1')], ...options});
        await assert.rejects(queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: f.indexedDb}), code);
        assert.deepEqual(f.calls.created, [], 'schema non supportato: nessuno store creato');
        assert.deepEqual(f.calls.writes, [], 'schema non supportato: nessuna scrittura');
    }
});

test('lettore compatibile: contenitore malformato fallisce chiuso senza scrivere', async () => {
    const malformed = [
        validContainer('owner-a', 'device:1', {schemaVersion: 2}),
        validContainer('owner-a', 'device:1', {id: 'owner-a:altro'}),
        validContainer('owner-a', 'device:1', {uid: 'owner-b'}),
        {...validContainer('owner-a', 'device:1'), ciphertext: undefined},
        {...validContainer('owner-a', 'device:1'), iv: 12}
    ];
    for (const row of malformed) {
        const f = readerFixture({rows: [row]});
        await assert.rejects(queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: f.indexedDb}), /QUEUE_READER_(CONTAINER|SCHEMA)/);
        assert.deepEqual(f.calls.writes, []);
    }
});

test('lettore compatibile: sessione non attiva, abort e timeout non aprono né scrivono', async () => {
    const inactive = readerFixture({rows: [validContainer('owner-a', 'device:1')]});
    await assert.rejects(queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: inactive.indexedDb, isActive: () => false}), /QUEUE_READER_SESSION/);
    assert.deepEqual(inactive.calls.opens, [], 'sessione non attiva: nessuna apertura');

    const invalid = readerFixture({rows: []});
    await assert.rejects(queue.readOfflineQueueContainers({uid: '', indexedDb: invalid.indexedDb}), /QUEUE_READER_CONFIG/);
    assert.deepEqual(invalid.calls.opens, []);

    const timedOut = readerFixture({rows: [validContainer('owner-a', 'device:1')]});
    const never = {open() { return {}; }};
    await assert.rejects(queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: never, timeoutMs: 5}), /QUEUE_READER_TIMEOUT/);
    await assert.rejects(queue.readOfflineQueueContainers({uid: 'owner-a', indexedDb: timedOut.indexedDb, timeoutMs: 5,
        isActive: () => false}), /QUEUE_READER_SESSION/);
    assert.deepEqual(timedOut.calls.writes, []);
});

test('comportamento invariato con e senza Web Locks dopo l’aggiunta del lettore', async () => {
    const locks = {request: async (_name, _options, callback) => callback({name: 'lock'})};
    assert.deepEqual(await queue.withOfflineQueueLease('owner-a', async () => 'eseguito', locks), {acquired: true, value: 'eseguito'});
    // Node espone `navigator.locks`: per simulare l'API assente si passa `null` esplicito,
    // mentre il ramo reale «API assente» è provato in browser dal banco M6-2 (`webLocks: "undefined"`).
    await assert.rejects(queue.withOfflineQueueLease('owner-a', async () => 'no', null), /OFFLINE_QUEUE_LOCKS_UNAVAILABLE/);
    await assert.rejects(queue.withOfflineQueueLease('owner-a', async () => 'no', {}), /OFFLINE_QUEUE_LOCKS_UNAVAILABLE/);
});

// ── M6-A-6: percorso di lettura dell'app (sola lettura, v1/v2, indisponibilità) ─────────────
const sealedRow = async (uid, operationId, extra = {}) => queue.sealOfflineOperation(
    {uid, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`, ...extra},
    await queue.deriveOfflineQueueKey('FIXTURE-KEY', uid));

test('lettore dell’app su coda v1 con operazioni pendenti e riconciliazione', async () => {
    const row = await sealedRow('owner-a', 'device:1');
    const reviewed = await sealedRow('owner-a', 'device:2', {_queueState: 'reconciliation-required', _reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'});
    const f = readerFixture({version: 1, rows: [row, reviewed]});
    const reader = await queue.createOfflineQueueReader({uid: 'owner-a', vaultKeyMaterial: 'FIXTURE-KEY', indexedDb: f.indexedDb});
    const result = await reader.read();
    assert.equal(result.available, true);
    assert.equal(result.version, 1);
    assert.deepEqual(result.operations, [
        {uid: 'owner-a', operationId: 'device:1', recordId: 'record-device:1', value: 'fixture-device:1'},
        {uid: 'owner-a', operationId: 'device:2', recordId: 'record-device:2', value: 'fixture-device:2',
            _queueState: 'reconciliation-required', _reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'}
    ]);
    // Sola lettura: nessuna scrittura e apertura senza versione (nessun upgrade richiesto).
    assert.deepEqual(f.calls.writes, []);
    assert.deepEqual(f.calls.opens.map(args => args.length), [1]);
    assert.deepEqual(f.calls.created, []);
});

test('lettore dell’app su coda v2 e su schema non supportato', async () => {
    const v2 = readerFixture({version: 2, rows: [await sealedRow('owner-a', 'device:1')]});
    const readerV2 = await queue.createOfflineQueueReader({uid: 'owner-a', vaultKeyMaterial: 'FIXTURE-KEY', indexedDb: v2.indexedDb});
    const resultV2 = await readerV2.read();
    assert.equal(resultV2.available, true);
    assert.equal(resultV2.version, 2);
    assert.deepEqual(resultV2.operations.map(operation => operation.operationId), ['device:1']);

    const unsupported = readerFixture({version: 3, rows: [await sealedRow('owner-a', 'device:1')]});
    const readerV3 = await queue.createOfflineQueueReader({uid: 'owner-a', vaultKeyMaterial: 'FIXTURE-KEY', indexedDb: unsupported.indexedDb});
    const resultV3 = await readerV3.read();
    // Indisponibilità dichiarata: mai una coda vuota, mai un salvataggio riuscito.
    assert.deepEqual(resultV3, {available: false, version: null, operations: null, reason: 'QUEUE_READER_SCHEMA'});
    assert.notDeepEqual(resultV3.operations, []);
    const malformed = readerFixture({version: 1, rows: [validContainer('owner-b', 'device:1')]});
    const readerMalformed = await queue.createOfflineQueueReader({uid: 'owner-a', vaultKeyMaterial: 'FIXTURE-KEY', indexedDb: malformed.indexedDb});
    assert.equal((await readerMalformed.read()).reason, 'QUEUE_READER_CONTAINER');
});

test('lettore dell’app: apertura che non si conclude diventa indisponibilità, non coda vuota', async () => {
    const never = {open() { return {}; }};
    const reader = await queue.createOfflineQueueReader({uid: 'owner-a', vaultKeyMaterial: 'FIXTURE-KEY', indexedDb: never, timeoutMs: 5});
    const result = await reader.read();
    assert.equal(result.available, false);
    assert.equal(result.reason, 'QUEUE_READER_TIMEOUT');
    assert.equal(result.operations, null);
});

// ── M6-A-7: upgrade del runtime invocabile solo esplicitamente ──────────────────────────────
test('upgrade del runtime: configurazione rifiutata e sonda di sola lettura', async () => {
    await assert.rejects(upgrade.upgradeOfflineQueueSchema({uid: '', indexedDb: {}}), /QUEUE_UPGRADE_CONFIG/);
    await assert.rejects(upgrade.upgradeOfflineQueueSchema({uid: 'owner-a', indexedDb: null}), /QUEUE_UPGRADE_CONFIG/);
    await assert.rejects(upgrade.upgradeOfflineQueueSchema({uid: 'owner-a', indexedDb: {}, timeoutMs: 0}), /QUEUE_UPGRADE_CONFIG/);
    // Sonda su coda v2 e su schema ignoto: nessuna scrittura, versione e store reali.
    const row = await sealedRow('owner-a', 'device:1');
    const v2 = readerFixture({version: 2, rows: [row]});
    assert.deepEqual(await upgrade.inspectOfflineQueueSchema({uid: 'owner-a', indexedDb: v2.indexedDb}),
        {version: 2, stores: ['encryptedOperations', 'queueLeases'], rows: [row]});
    assert.deepEqual(v2.calls.writes, []);
    const v3 = readerFixture({version: 3, rows: [row]});
    assert.equal((await upgrade.inspectOfflineQueueSchema({uid: 'owner-a', indexedDb: v3.indexedDb})).version, 3);
});

test('nessun percorso dell’app avvia l’upgrade da sé: solo il pilota lo invoca', async () => {
    const automatic = ['offline-mutation-client-core.js', 'offline-mutation-client.js', 'offline-mutation-sync.js', 'offline-mutation-queue.js'];
    for (const file of automatic) {
        const text = await readFile(new URL(`../Frontend/public/assets/js/modules/data/${file}`, import.meta.url), 'utf8');
        assert.equal(/upgradeOfflineQueueSchema|offline-mutation-upgrade/.test(text), false, `${file} non deve avviare l'upgrade`);
    }
    const trigger = await readFile(new URL('../Frontend/public/assets/js/modules/data/private-account-pilot-queue.js', import.meta.url), 'utf8');
    assert.equal(trigger.includes("from './offline-mutation-upgrade.js'"), true);
    assert.equal(trigger.includes('upgradePrivateAccountPilotQueue'), true);
    const pilot = await readFile(new URL('../Frontend/public/assets/js/modules/data/private-account-offline-pilot.js', import.meta.url), 'utf8');
    assert.equal(pilot.includes("from './private-account-pilot-queue.js'"), true, 'il pilota deve riesportare il trigger');
});

test('sonda sicura: coda assente non creata, blocco e scadenza dichiarati', async () => {
    // Coda assente: la richiesta di apertura riceve `onupgradeneeded` e la transazione va annullata.
    const missing = {aborted: false, open() {
        const request = {transaction: {abort() { missing.aborted = true; }}};
        setImmediate(() => request.onupgradeneeded?.());
        return request;
    }};
    await assert.rejects(upgrade.inspectOfflineQueueSchema({uid: 'owner-a', indexedDb: missing}), /QUEUE_UPGRADE_MISSING/);
    assert.equal(missing.aborted, true);
    // Apertura che non risponde: scadenza dichiarata, nessuna attesa indefinita.
    await assert.rejects(upgrade.inspectOfflineQueueSchema({uid: 'owner-a', indexedDb: {open() { return {}; }}, timeoutMs: 5}), /QUEUE_UPGRADE_TIMEOUT/);
    // Blocco dichiarato.
    const blocked = {open() {
        const request = {transaction: {abort() {}}};
        setImmediate(() => request.onblocked?.());
        return request;
    }};
    await assert.rejects(upgrade.inspectOfflineQueueSchema({uid: 'owner-a', indexedDb: blocked}), /QUEUE_UPGRADE_BLOCKED/);
    // Sessione già scaduta: nessuna apertura.
    await assert.rejects(upgrade.inspectOfflineQueueSchema({uid: 'owner-a', indexedDb: {open() { assert.fail('non deve aprire'); }}, isActive: () => false}), /QUEUE_UPGRADE_SESSION/);
});
