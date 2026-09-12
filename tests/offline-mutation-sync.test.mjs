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
        queue: {list: async () => [...operations], remove: async id => removed.push(id)},
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
