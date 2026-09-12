import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-queue.js', import.meta.url), 'utf8');
const queue = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

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
    await instance.remove(oldOperation.operationId);
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
