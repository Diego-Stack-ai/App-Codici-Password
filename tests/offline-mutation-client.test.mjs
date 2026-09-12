import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/offline-mutation-client-core.js', import.meta.url), 'utf8');
const {createOfflineMutationClientCore, OFFLINE_MUTATION_WRITES_ENABLED} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function dependencies() {
  const queued = []; const sent = []; let notified = 0; let closed = 0;
  const queue = {
    enqueue: async operation => queued.push(operation),
    list: async () => queued,
    remove: async operationId => {
      const index = queued.findIndex(operation => operation.operationId === operationId);
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
