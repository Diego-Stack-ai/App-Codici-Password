import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-client-core.js', import.meta.url), 'utf8');
const {createOfflineMutationClientCore, OFFLINE_MUTATION_WRITES_ENABLED} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
// Moduli reali per la prova d'integrazione: il lettore compatibile è **asincrono**.
const queueSource = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-queue.js', import.meta.url), 'utf8');
const queue = await import(`data:text/javascript;base64,${Buffer.from(queueSource).toString('base64')}`);
const syncSource = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-sync.js', import.meta.url), 'utf8');
const {createOfflineMutationSynchronizer} = await import(`data:text/javascript;base64,${Buffer.from(syncSource).toString('base64')}`);

// Fixture di sola lettura per il lettore compatibile: versione, store e cursore reali.
function readerFixture({version = 1, rows = []} = {}) {
    const stores = version === 2 ? ['encryptedOperations', 'queueLeases'] : ['encryptedOperations'];
    return {open() {
        const request = {};
        const database = {
            version,
            objectStoreNames: Object.assign([...stores], {contains: name => stores.includes(name)}),
            onversionchange: null,
            close() {},
            transaction() {
                const tx = {aborted: false, error: null, oncomplete: null, onabort: null, onerror: null,
                    abort() { this.aborted = true; },
                    objectStore: () => ({
                        keyPath: 'id', autoIncrement: false, count() { return {}; },
                        openCursor() {
                            const cursor = {value: undefined};
                            const cursorRequest = {result: null, onsuccess: null, onerror: null};
                            let index = 0;
                            const step = () => setImmediate(() => {
                                if (index < rows.length) {
                                    cursor.value = structuredClone(rows[index++]);
                                    cursorRequest.result = cursor;
                                    cursorRequest.onsuccess?.();
                                    return;
                                }
                                cursorRequest.result = null; cursorRequest.onsuccess?.();
                                setImmediate(() => { tx.aborted ? tx.onabort?.() : tx.oncomplete?.(); });
                            });
                            cursor.continue = step;
                            step();
                            return cursorRequest;
                        }
                    })};
                return tx;
            }
        };
        setImmediate(() => { request.result = database; request.onsuccess?.(); });
        return request;
    }};
}
const sealedRow = async (uid, operationId, extra = {}) => queue.sealOfflineOperation(
    {uid, operationId, recordId: `record-${operationId}`, value: `fixture-${operationId}`, ...extra},
    await queue.deriveOfflineQueueKey('SYNTHETIC-KEY', uid));
// Il collegamento reale: factory del lettore **asincrona** (come `createOfflineQueueReader`) e
// sincronizzatore reale.
const realDependencies = ({indexedDb, sent, removed, states}) => ({
    createQueue: async () => ({isOperable: () => true, enqueue: async () => {}, list: async () => [],
        remove: async operation => removed.push(operation.operationId), close() {}}),
    createQueueReader: options => queue.createOfflineQueueReader({...options, indexedDb}),
    createSynchronizer: createOfflineMutationSynchronizer,
    withLease: async (_uid, task) => ({acquired: true, value: await task()}),
    isOnline: () => true,
    send: async operation => { sent.push(operation.operationId); return {status: 'applied'}; },
    createChannel: () => ({notify() {}, close() {}}),
    onState: state => states.push(state)
});

function dependencies() {
  const queued = []; const sent = []; let notified = 0; let closed = 0;
  const queue = {
    enqueue: async operation => queued.push(operation),
    list: async () => queued,
    remove: async expected => {
      const index = queued.findIndex(operation => operation.operationId === expected.operationId);
      if (index >= 0) queued.splice(index, 1);
    },
    close: () => { closed += 1; }
  };
  return {
    queued, sent, get notified() { return notified; }, get closed() { return closed; },
    createQueue: async () => queue,
    createSynchronizer: ({send, onState}) => ({
      flush: async () => {
        onState({state: 'syncing'});
        for (const operation of queued) sent.push(await send(operation));
        return {status: 'saved'};
      }
    }),
    withLease: async (_uid, task) => task(),
    createChannel: () => ({notify: () => { notified += 1; }, close: () => { closed += 1; }}),
    send: async operation => ({status: 'applied', operationId: operation.operationId})
  };
}

test('il collegamento runtime-backend è disattivato per impostazione predefinita', async () => {
  assert.equal(OFFLINE_MUTATION_WRITES_ENABLED, false);
  await assert.rejects(createOfflineMutationClientCore({uid: 'owner', vaultKeyMaterial: 'fixture'}), /DISABLED/);
});

test('con flag esplicita accoda, notifica e inoltra una sola operazione dello stesso utente', async () => {
  const deps = dependencies(); const states = [];
  const client = await createOfflineMutationClientCore({
    ...deps, uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true, onState: state => states.push(state)
  });
  const operation = {uid: 'owner', operationId: 'op-1', recordId: 'record-1', encryptedPayload: {ciphertext: 'fixture'}};
  assert.deepEqual(await client.enqueue(operation), {status: 'saved'});
  assert.equal(deps.queued.length, 1); assert.equal(deps.sent.length, 1); assert.equal(deps.notified, 1);
  assert.equal(states.at(-1).state, 'syncing');
  await assert.rejects(client.enqueue({...operation, uid: 'other'}), /SCOPE/);
  await client.discard('op-1');
  assert.equal(deps.queued.length, 0);
  client.close(); assert.equal(deps.closed, 2);
});


test('sostituzione usa lease e CAS, senza eliminazione separata, poi sincronizza',async()=>{
    const events=[];const old={uid:'owner',operationId:'old',recordId:'record'},next={...old,operationId:'new'};
    const client=await createOfflineMutationClientCore({uid:'owner',vaultKeyMaterial:'fixture',enabled:true,
        createQueue:async()=>({replace:async(a,b)=>{assert.equal(a,old);assert.equal(b,next);events.push('replace')},remove:async()=>assert.fail('no discard')}),
        createSynchronizer:()=>({flush:async()=>{events.push('flush');return {status:'saved'}}}),
        withLease:async(_uid,task)=>{events.push('lock');const value=await task();events.push('unlock');return{acquired:true,value}},
        send:async()=>{},createChannel:()=>({notify:()=>events.push('notify')})});
    assert.equal((await client.replace(old,next)).status,'saved');assert.deepEqual(events,['lock','replace','unlock','notify','flush']);
});

test('lease occupato, CAS fallito e sessione scaduta non inviano né dichiarano salvato',async()=>{
    for(const mode of ['busy','cas','session']){
        let active=true,sends=0,replaces=0;
        const client=await createOfflineMutationClientCore({uid:'owner',vaultKeyMaterial:'fixture',enabled:true,isActive:()=>active,
            createQueue:async()=>({replace:async()=>{replaces++;throw Error('CHANGED')}}),createSynchronizer:()=>({flush:async()=>{sends++;return{status:'saved'}}}),
            withLease:async(_uid,fn)=>mode==='busy'?{acquired:false}:fn(),send:async()=>{}});
        if(mode==='session')active=false;
        const a={uid:'owner',operationId:'old'},b={uid:'owner',operationId:'new'};
        if(mode==='busy')assert.equal((await client.replace(a,b)).status,'recoverable-error');
        else await assert.rejects(client.replace(a,b),mode==='cas'?/CHANGED/:/SESSION_CHANGED/);
        assert.equal(sends,0);assert.equal(replaces,mode==='cas'?1:0);
    }
});


test('close invalida sessione e sostituzioni tardive',async()=>{
    let called=0,active;
    const client=await createOfflineMutationClientCore({uid:'owner',vaultKeyMaterial:'fixture',enabled:true,
        createQueue:async()=>({replace:async()=>called++,close(){}}),createSynchronizer:options=>{active=options.isActive;return{flush:async()=>{}}},
        withLease:async(_uid,fn)=>fn(),send:async()=>{}});
    assert.equal(active(),true);client.close();assert.equal(active(),false);
    await assert.rejects(client.replace({uid:'owner'},{uid:'owner'}),/SESSION_CHANGED/);assert.equal(called,0);
});

// ── M6-A-6: copia non compatibile e schema non leggibile restano stati dichiarati ───────────
const unavailabilityDependencies = ({writerError = null, read = null} = {}) => {
    const states = []; let sends = 0, closed = 0;
    return {
        states, get sends() { return sends; }, get closed() { return closed; },
        createQueue: async () => { if (writerError) throw writerError; return {list: async () => [], close: () => { closed += 1; }}; },
        createQueueReader: () => ({read: async () => read}),
        createSynchronizer: ({queue, readQueue, send, onState}) => ({
            flush: async () => {
                const result = await readQueue();
                if (result?.available === false) { onState({state: 'queue-unavailable', reason: result.reason, pending: null}); return {status: 'queue-unavailable', reason: result.reason}; }
                if (!queue) { onState({state: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE', pending: result.operations.length}); return {status: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE'}; }
                sends += 1; return {status: 'saved'};
            }
        }),
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        send: async () => { sends += 1; },
        isOnline: () => true,
        onState: state => states.push(state)
    };
};

test('scrittore non apribile (copia non compatibile) e lettore compatibile: indisponibilità dichiarata, nessun invio', async () => {
    const deps = unavailabilityDependencies({writerError: Object.assign(new Error('VersionError'), {name: 'VersionError'}),
        read: {available: true, version: 2, operations: [{operationId: 'op-1'}]}});
    const client = await createOfflineMutationClientCore({...deps, uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true});
    assert.deepEqual(await client.flush(), {status: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE'});
    await assert.rejects(client.enqueue({uid: 'owner', operationId: 'op-2'}), /OFFLINE_QUEUE_WRITE_UNAVAILABLE/);
    assert.equal(deps.sends, 0);
    assert.equal(deps.states.at(-1).state, 'queue-unavailable');
    assert.notEqual(deps.states.at(-1).state, 'saved');
    client.close();
});

test('schema non leggibile: indisponibilità con motivo, mai coda vuota', async () => {
    const deps = unavailabilityDependencies({read: {available: false, version: null, operations: null, reason: 'QUEUE_READER_SCHEMA'}});
    const client = await createOfflineMutationClientCore({...deps, uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true});
    assert.deepEqual(await client.flush(), {status: 'queue-unavailable', reason: 'QUEUE_READER_SCHEMA'});
    assert.deepEqual(deps.states, [{state: 'queue-unavailable', reason: 'QUEUE_READER_SCHEMA', pending: null}]);
    assert.equal(deps.sends, 0);
    client.close();
});

test('senza lettore compatibile il comportamento resta quello di prima', async () => {
    const error = Object.assign(new Error('VersionError'), {name: 'VersionError'});
    await assert.rejects(createOfflineMutationClientCore({uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true,
        createQueue: async () => { throw error; },
        createSynchronizer: () => ({flush: async () => ({status: 'saved'})}),
        withLease: async (_uid, task) => task(), send: async () => {}}), /VersionError/);
});

test('scrittore chiuso da un upgrade dopo l’apertura: le scritture rifiutano in modo dichiarato', async () => {
    let closed = false, enqueued = 0;
    const deps = unavailabilityDependencies({read: {available: true, version: 2, operations: [{operationId: 'op-1'}]}});
    const client = await createOfflineMutationClientCore({...deps, uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true,
        createQueue: async () => ({isOperable: () => !closed, enqueue: async () => { enqueued += 1; }, list: async () => [], close() {}}),
        createSynchronizer: () => ({flush: async () => ({status: 'saved'})})});
    await client.enqueue({uid: 'owner', operationId: 'op-1'});
    assert.equal(enqueued, 1);
    closed = true;
    await assert.rejects(client.enqueue({uid: 'owner', operationId: 'op-2'}), /OFFLINE_QUEUE_WRITE_UNAVAILABLE/);
    await assert.rejects(client.replace({uid: 'owner', operationId: 'op-1'}, {uid: 'owner', operationId: 'op-2'}), /OFFLINE_QUEUE_WRITE_UNAVAILABLE/);
    assert.equal(enqueued, 1);
    client.close();
});

// ── M6-A-6 R2: la factory del lettore reale è asincrona e deve essere attesa ────────────────
test('factory asincrona del lettore: flush legge davvero una coda v1 e la sincronizza', async () => {
    const uid = 'owner-a';
    const rows = [await sealedRow(uid, 'device:1'),
        await sealedRow(uid, 'device:2', {_queueState: 'reconciliation-required', _reviewReason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'})];
    const sent = [], removed = [], states = [];
    const client = await createOfflineMutationClientCore({...realDependencies({indexedDb: readerFixture({version: 1, rows}), sent, removed, states}),
        uid, vaultKeyMaterial: 'SYNTHETIC-KEY', enabled: true});
    // `device:2` è in riconciliazione: la sincronizzazione si ferma lì, dopo aver letto la coda.
    const result = await client.flush();
    assert.equal(result.value.status, 'reconciliation-required');
    assert.deepEqual(sent, ['device:1']);
    assert.deepEqual(removed, ['device:1']);
    assert.equal(states.at(-1).state, 'reconciliation-required');
    assert.equal(states.some(state => state.state === 'queue-unavailable'), false);
    client.close();
});

test('factory asincrona del lettore: flush legge una coda v2 e riporta indisponibilità su schema ignoto', async () => {
    const uid = 'owner-a';
    const v2Sent = [], v2Removed = [], v2States = [];
    const v2 = await createOfflineMutationClientCore({...realDependencies({indexedDb: readerFixture({version: 2, rows: [await sealedRow(uid, 'device:1')]}),
        sent: v2Sent, removed: v2Removed, states: v2States}), uid, vaultKeyMaterial: 'SYNTHETIC-KEY', enabled: true});
    assert.equal((await v2.flush()).value.status, 'saved');
    assert.deepEqual(v2Sent, ['device:1']);
    assert.deepEqual(v2Removed, ['device:1']);
    v2.close();

    const v3Sent = [], v3Removed = [], v3States = [];
    const v3 = await createOfflineMutationClientCore({...realDependencies({indexedDb: readerFixture({version: 3, rows: [await sealedRow(uid, 'device:1')]}),
        sent: v3Sent, removed: v3Removed, states: v3States}), uid, vaultKeyMaterial: 'SYNTHETIC-KEY', enabled: true});
    assert.deepEqual(await v3.flush(), {status: 'queue-unavailable', reason: 'QUEUE_READER_SCHEMA'});
    assert.deepEqual(v3Sent, []);
    assert.deepEqual(v3Removed, []);
    assert.deepEqual(v3States.map(state => state.state), ['queue-unavailable']);
    v3.close();
});

test('sessione cambiata durante la creazione del lettore: nessuna risorsa lasciata aperta', async () => {
    let active = true, closed = 0;
    await assert.rejects(createOfflineMutationClientCore({uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true,
        isActive: () => active,
        createQueue: async () => ({list: async () => [], close() {}}),
        createQueueReader: async () => { active = false; return {read: async () => ({available: true, operations: []}), close() { closed += 1; }}; },
        createSynchronizer: () => ({flush: async () => ({status: 'saved'})}),
        withLease: async (_uid, task) => task(), send: async () => {}}), /SESSION_CHANGED/);
    assert.equal(closed, 1);
});

test('creazione del lettore fallita: indisponibilità dichiarata e nessun invio', async () => {
    let sends = 0;
    const client = await createOfflineMutationClientCore({uid: 'owner', vaultKeyMaterial: 'fixture', enabled: true,
        createQueue: async () => ({isOperable: () => true, list: async () => [], close() {}}),
        createQueueReader: async () => { throw Object.assign(new Error('chiave assente'), {code: 'QUEUE_READER_KEY_REQUIRED'}); },
        createSynchronizer: createOfflineMutationSynchronizer,
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        send: async () => { sends += 1; return {status: 'applied'}; },
        createChannel: () => ({notify() {}, close() {}})});
    assert.deepEqual(await client.flush(), {status: 'queue-unavailable', reason: 'QUEUE_READER_KEY_REQUIRED'});
    assert.equal(sends, 0);
    client.close();
});
