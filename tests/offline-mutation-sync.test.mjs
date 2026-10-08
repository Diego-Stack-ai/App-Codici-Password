import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-sync.js', import.meta.url), 'utf8');
const {createOfflineMutationSynchronizer} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture({online = true, results = []} = {}) {
    const operations = [{operationId: 'op-1'}, {operationId: 'op-2'}];
    const removed = []; const states = []; let calls = 0;
    const sync = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        queue: {list: async () => [...operations], remove: async operation => removed.push(operation.operationId)},
        send: async () => results[calls++] || {status: 'applied'},
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => online,
        onState: state => states.push(state)
    });
    return {sync, removed, states, get calls() { return calls; }};
}

test('offline conserva la coda e comunica il numero pendente', async () => {
    const context = fixture({online: false});
    assert.deepEqual(await context.sync.flush(), {status: 'offline', pending: 2});
    assert.deepEqual(context.removed, []); assert.equal(context.calls, 0);
    assert.equal(context.states.at(-1).state, 'offline');
});

test('online rimuove soltanto operazioni confermate o duplicate', async () => {
    const context = fixture({results: [{status: 'applied'}, {status: 'applied', duplicate: true}]});
    const lease = await context.sync.flush();
    assert.equal(lease.value.status, 'saved'); assert.deepEqual(context.removed, ['op-1', 'op-2']);
    assert.equal(context.states.at(-1).state, 'saved');
});

test('un conflitto ferma la coda senza rimuovere l’operazione', async () => {
    const context = fixture({results: [{status: 'conflict', currentRevision: 4}]});
    const lease = await context.sync.flush();
    assert.equal(lease.value.status, 'conflict'); assert.deepEqual(context.removed, []); assert.equal(context.calls, 1);
    assert.equal(context.states.at(-1).state, 'conflict');
});

test('duplicate senza esito applicato non elimina la modifica dalla coda', async () => {
    for (const result of [{duplicate: true}, {status: 'unknown', duplicate: true}, {status: 'failed', duplicate: true}]) {
        const context = fixture({results: [result]});
        const lease = await context.sync.flush();
        assert.equal(lease.value.status, 'recoverable-error');
        assert.deepEqual(context.removed, []);
        assert.equal(context.calls, 1);
    }
});

test('un errore di rete è recuperabile e due flush simultanei sono accorpati', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const states = [];
    const sync = createOfflineMutationSynchronizer({
        uid: 'owner-a', queue: {list: async () => [{operationId: 'op-1'}], remove: async () => {}},
        send: async () => { await gate; throw new Error('rete'); },
        withLease: async (_uid, task) => ({acquired: true, value: await task()}), isOnline: () => true,
        onState: state => states.push(state)
    });
    const first = sync.flush(); const second = sync.flush(); assert.equal(first, second);
    release(); const lease = await first;
    assert.equal(lease.value.status, 'recoverable-error'); assert.equal(states.at(-1).state, 'recoverable-error');
});


test('legacy non verificato ferma la coda con la copia recuperabile e senza altre scritture', async () => {
    const operation = {uid:'owner',operationId:'old',recordId:'account'};
    for (const code of ['failed-precondition','functions/failed-precondition']) {
        const states=[],removed=[];let sends=0;
        const sync=createOfflineMutationSynchronizer({uid:'owner',queue:{list:async()=>[operation,{operationId:'next'}],remove:async id=>removed.push(id),markForReview:async op=>({...op,_queueState:'reconciliation-required'})},
            send:async()=>{sends++;throw Object.assign(new Error('legacy'),{code,details:{reason:'LEGACY_MUTATION_RESULT_UNVERIFIED'}})},
            withLease:async(_uid,fn)=>fn(),isOnline:()=>true,onState:state=>states.push(state)});
        const result=await sync.flush();assert.equal(result.status,'reconciliation-required');assert.equal(result.operation.operationId,operation.operationId);assert.equal(result.operation._queueState,'reconciliation-required');
        assert.equal(sends,1);assert.deepEqual(removed,[]);assert.equal(states.at(-1).state,'reconciliation-required');
    }
});

test('errore diverso e cambio sessione non diventano riconciliazione o successo', async()=>{
    for(const legacy of [false,true]){
        let active=true;const removed=[],states=[];
        const sync=createOfflineMutationSynchronizer({uid:'owner',queue:{list:async()=>[{operationId:'old'}],remove:async id=>removed.push(id)},
            send:async()=>{if(legacy){active=false;return {status:'applied'}}throw Object.assign(new Error('other'),{code:'functions/failed-precondition',details:{reason:'OTHER'}})},
            withLease:async(_uid,fn)=>fn(),isOnline:()=>true,isActive:()=>active,onState:state=>states.push(state)});
        assert.equal((await sync.flush()).status,'recoverable-error');assert.deepEqual(removed,[]);
        assert.notEqual(states.at(-1).state,'saved');
    }
});


test('operazione marcata resta sospesa nei flush successivi senza invio automatico',async()=>{
    const operation={uid:'owner',operationId:'old',_queueState:'reconciliation-required'};let calls=0;
    const sync=createOfflineMutationSynchronizer({uid:'owner',queue:{list:async()=>[operation],remove:async()=>assert.fail('remove')},send:async()=>{calls++},withLease:async(_uid,fn)=>fn(),isOnline:()=>true});
    for(let i=0;i<3;i++)assert.equal((await sync.flush()).status,'reconciliation-required');
    assert.equal(calls,0);
});


test('scope rejection is held persistently and never retried as a network failure',async()=>{
    let operation={uid:'owner',operationId:'held',recordId:'record'},calls=0;
    const queue={list:async()=>[operation],remove:async()=>assert.fail('remove'),
        markForReview:async(op,options)=>(operation={...op,_queueState:'reconciliation-required',_reviewReason:options.reviewReason})};
    const options={uid:'owner',queue,send:async()=>{calls++;throw Object.assign(new Error('scope'),{code:'functions/failed-precondition',details:{reason:'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'}})},withLease:async(_uid,task)=>task(),isOnline:()=>true};
    const first=await createOfflineMutationSynchronizer(options).flush();
    assert.equal(first.status,'reconciliation-required');
    assert.equal(first.operation._reviewReason,'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED');
    const reopened=await createOfflineMutationSynchronizer(options).flush();
    assert.equal(reopened.status,'reconciliation-required');assert.equal(calls,1);
});

// ── M6-A-6: indisponibilità dichiarata nel percorso reale di lettura ───────────────────────
test('lettura non disponibile diventa stato esplicito, mai coda vuota o salvataggio riuscito', async () => {
    const states = []; let sends = 0;
    const sync = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        queue: {list: async () => assert.fail('la coda non va letta dal vecchio percorso'), remove: async () => assert.fail('remove')},
        readQueue: async () => ({available: false, version: null, operations: null, reason: 'QUEUE_READER_SCHEMA'}),
        send: async () => { sends += 1; },
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => true,
        onState: state => states.push(state)
    });
    assert.deepEqual(await sync.flush(), {status: 'queue-unavailable', reason: 'QUEUE_READER_SCHEMA'});
    assert.equal(sends, 0);
    assert.deepEqual(states, [{state: 'queue-unavailable', reason: 'QUEUE_READER_SCHEMA', pending: null}]);
    assert.equal(states.some(state => ['idle', 'saved', 'offline'].includes(state.state)), false);
});

test('coda leggibile ma non operabile: indisponibilità senza invio e senza conferme', async () => {
    const states = [];
    const sync = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        queue: null,
        readQueue: async () => ({available: true, version: 2, operations: [{operationId: 'op-1'}, {operationId: 'op-2'}]}),
        send: async () => assert.fail('nessun invio senza scrittore'),
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => true,
        onState: state => states.push(state)
    });
    assert.deepEqual(await sync.flush(), {status: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE'});
    assert.deepEqual(states, [{state: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE', pending: 2}]);
});

test('lettura disponibile: il percorso normale resta invariato', async () => {
    const removed = []; const states = [];
    const sync = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        queue: {list: async () => assert.fail('la lettura passa dal lettore iniettato'), remove: async operation => removed.push(operation.operationId)},
        readQueue: async () => ({available: true, version: 1, operations: [{operationId: 'op-1'}, {operationId: 'op-2'}]}),
        send: async () => ({status: 'applied'}),
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => true,
        onState: state => states.push(state)
    });
    const lease = await sync.flush();
    assert.equal(lease.value.status, 'saved');
    assert.deepEqual(removed, ['op-1', 'op-2']);
    assert.deepEqual(states.map(state => state.state), ['syncing', 'saved']);

    const offline = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        queue: {list: async () => assert.fail('la lettura passa dal lettore iniettato')},
        readQueue: async () => ({available: true, version: 2, operations: [{operationId: 'op-1'}]}),
        send: async () => assert.fail('offline'),
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => false
    });
    assert.deepEqual(await offline.flush(), {status: 'offline', pending: 1});
});

test('scrittore chiuso da un upgrade dopo l’apertura: nessun invio e indisponibilità dichiarata', async () => {
    const states = []; let sends = 0;
    const sync = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        // La connessione v1 è stata chiusa da un upgrade concorrente: `isOperable()` è falso, ma
        // l'oggetto coda è ancora non nullo e il lettore compatibile vede già le operazioni v2.
        queue: {list: async () => [{operationId: 'op-1'}], remove: async () => assert.fail('remove su scrittore chiuso'), isOperable: () => false},
        readQueue: async () => ({available: true, version: 2, operations: [{operationId: 'op-1'}]}),
        send: async () => { sends += 1; return {status: 'applied'}; },
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => true,
        onState: state => states.push(state)
    });
    assert.deepEqual(await sync.flush(), {status: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE'});
    assert.equal(sends, 0);
    assert.deepEqual(states, [{state: 'queue-unavailable', reason: 'OFFLINE_QUEUE_WRITE_UNAVAILABLE', pending: 1}]);
});

test('risposta mancante o malformata del lettore fallisce chiusa, mai coda vuota', async () => {
    const responses = [undefined, null, {}, {available: true}, {available: true, operations: null}, {available: 'yes', operations: []}];
    for (const response of responses) {
        const states = []; let sends = 0;
        const sync = createOfflineMutationSynchronizer({
            uid: 'owner-a',
            queue: {list: async () => assert.fail('la lettura passa dal lettore iniettato'), remove: async () => assert.fail('remove')},
            readQueue: async () => response,
            send: async () => { sends += 1; return {status: 'applied'}; },
            withLease: async (_uid, task) => ({acquired: true, value: await task()}),
            isOnline: () => true,
            onState: state => states.push(state)
        });
        const result = await sync.flush();
        assert.equal(result.status, 'queue-unavailable', `risposta ${JSON.stringify(response)}`);
        assert.equal(result.reason, 'QUEUE_READER_UNAVAILABLE');
        assert.equal(sends, 0);
        assert.equal(states.some(state => ['idle', 'saved', 'offline'].includes(state.state)), false);
    }
    // Anche un lettore che **lancia** fallisce chiuso, con il proprio codice.
    const throwing = createOfflineMutationSynchronizer({
        uid: 'owner-a',
        queue: {list: async () => assert.fail('no'), remove: async () => assert.fail('remove')},
        readQueue: async () => { throw Object.assign(new Error('scaduto'), {code: 'QUEUE_READER_TIMEOUT'}); },
        send: async () => assert.fail('nessun invio'),
        withLease: async (_uid, task) => ({acquired: true, value: await task()}),
        isOnline: () => true
    });
    assert.deepEqual(await throwing.flush(), {status: 'queue-unavailable', reason: 'QUEUE_READER_TIMEOUT'});
});
