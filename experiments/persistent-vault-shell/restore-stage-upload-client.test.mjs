import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestoreStageUploadClient} from './restore-stage-upload-client.mjs';
import {createRestoreStageClient} from './restore-stage-client.mjs';
const config = {endpoint: 'http://127.0.0.1:4188/restore-stage/upload', origin: 'http://127.0.0.1:4188',
  getCredentials: async () => ({idToken: 'synthetic', appCheckToken: 'synthetic'}), isActive: () => true};
const stageId = 'a'.repeat(64);

test('unsupported generation upload explains uncertainty and clears only transport copy', async () => {
  let sent, cancelled = false, calls = 0;
  const bytes = new Uint8Array([1, 2]);
  const client = createRestoreStageUploadClient({...config, fetchImpl: async (_url, options) => {
    sent = options.body; calls++;
    return {status: 409, headers: new Headers({'x-stage-error': 'GENERATION_UNSUPPORTED'}),
      body: {cancel: async () => {cancelled = true;}}};
  }});
  await assert.rejects(client({stageId, bytes}), error => error.code === 'GENERATION_UNSUPPORTED' && error.message.includes('non confermato'));
  assert.equal(calls, 1); assert.equal(cancelled, true);
  assert.deepEqual([...sent], [0, 0]); assert.deepEqual([...bytes], [1, 2]);
});

test('abort clears transport copy even while fetch has not settled',async()=>{
  const controller=new AbortController(),bytes=new Uint8Array([7,8]);let sent,release,started;
  const fetching=new Promise(resolve=>{started=resolve;});
  const client=createRestoreStageUploadClient({...config,signal:controller.signal,fetchImpl:(_url,options)=>{
    sent=options.body;started();return new Promise(resolve=>{release=resolve;});}});
  const pending=client({stageId,bytes}),rejected=assert.rejects(pending,/INACTIVE/);
  await fetching;controller.abort();
  try{assert.deepEqual([...sent],[0,0]);assert.deepEqual([...bytes],[7,8]);}
  finally{release({status:200});await rejected;}
});

test('Buffer transport copies are wiped without changing caller bytes on success or failure',async()=>{
  for(const status of [200,400]) {
    const bytes=Buffer.from([3,4]);let sent;
    const client=createRestoreStageUploadClient({...config,fetchImpl:async(_url,options)=>{
      sent=options.body;assert.notEqual(sent.buffer,bytes.buffer);
      return {status,body:{cancel:async()=>{}}};
    }});
    if(status===200)await client({stageId,bytes});
    else await assert.rejects(client({stageId,bytes}),/UNCONFIRMED/);
    assert.deepEqual([...sent],[0,0]);assert.deepEqual([...bytes],[3,4]);
  }
});
test('upload snapshots bytes before credentials and clears its transport copy', async () => {
  let sent, released;
  const bytes = new Uint8Array([1, 2]);
  const client = createRestoreStageUploadClient({...config, getCredentials: async () => {
    bytes.fill(9); return config.getCredentials();
  }, fetchImpl: async (url, options) => {
    assert.equal(url, config.endpoint); assert.deepEqual([...options.body], [1, 2]);
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    sent = options.body;
    return {status: 200, body: {cancel: async () => {released = true;}}};
  }});
  assert.deepEqual(await client({stageId, bytes}), {uploaded: true});
  assert.deepEqual([...sent], [0, 0]); assert.deepEqual([...bytes], [9, 9]); assert.equal(released, true);
});
test('upload rejects malformed input, foreign endpoint, revocation and ambiguous response without retry', async () => {
  assert.throws(() => createRestoreStageUploadClient({...config, endpoint: 'http://foreign.invalid/restore-stage/upload', fetchImpl() {}}), /CONFIG/);
  let calls = 0;
  const client = createRestoreStageUploadClient({...config, fetchImpl: async () => {calls++; return {status: 400};}});
  for (const input of [{stageId: 'bad', bytes: new Uint8Array([1])}, {stageId, bytes: new Uint8Array()}])
    await assert.rejects(client(input), /INPUT/);
  await assert.rejects(client({stageId, bytes: new Uint8Array([1])}), /UNCONFIRMED/);
  assert.equal(calls, 1);
  let active = true;
  const revoked = createRestoreStageUploadClient({...config, isActive: () => active,
    getCredentials: async () => {active = false; return config.getCredentials();}, fetchImpl: async () => {calls++;}});
  await assert.rejects(revoked({stageId, bytes: new Uint8Array([1])}), /INACTIVE/);
  assert.equal(calls, 1);
});
test('download accepts only the exact bridge alias, not arbitrary paths', () => {
  const download = {...config, endpoint: `${config.origin}/restore-stage/download`, fetchImpl() {}};
  assert.equal(typeof createRestoreStageClient(download), 'function');
  assert.throws(() => createRestoreStageClient({...download, endpoint: `${config.origin}/restore-stage/download/extra`}), /CONFIG/);
});
