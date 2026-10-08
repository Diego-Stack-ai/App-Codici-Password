import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestoreStageSource} from './restore-stage-source.mjs';
const command = () => ({operationId: 'op', storagePath: 'users/u1/attachments/a', bytes: new Uint8Array([1, 2])});
const value = revision => ({stageId: 'a'.repeat(64), revision, destinationPath: 'users/u1/attachments/staged',
  expiresAtMillis: 1000, generation: revision > 1 ? '123' : null});

for(const boundary of ['dispose','abort'])test(`${boundary} wipes pending upload copy immediately, before transport settles`,async()=>{
  const controller=new AbortController(),input=command(),calls=[];let retained,release,started;
  const uploading=new Promise(resolve=>{started=resolve;});
  const source=createRestoreStageSource({uid:'u1',signal:controller.signal,isActive:()=>true,
    submit:async data=>{calls.push(data.action);return value(1);},
    upload:({bytes})=>{retained=bytes;started();return new Promise(resolve=>{release=resolve;});}});
  const pending=source.prepare(input),rejected=assert.rejects(pending,/INACTIVE/);
  await uploading;
  if(boundary==='dispose')source.dispose();else controller.abort();
  try{assert.deepEqual([...retained],[0,0]);assert.deepEqual([...input.bytes],[1,2]);}
  finally{release();await rejected;}
  assert.deepEqual(calls,['claim']);await assert.rejects(source.prepare(input),/INACTIVE/);
});

test('Buffer inputs remain owned by the caller when staging clears its copy',async()=>{
  const bytes=Buffer.from([1,2]);
  const source=createRestoreStageSource({uid:'u1',isActive:()=>true,upload:async()=>{},submit:async()=>value(3)});
  await source.prepare({...command(),bytes});
  assert.deepEqual([...bytes],[1,2]);
});
test('lost upload or publication response recovers same stage without duplicate upload', async () => {
  for (const lose of ['upload', 'publish']) {
    let revision = 1, uploads = 0, fail = true, transportBytes;
    const claims = [];
    const source = createRestoreStageSource({uid: 'u1', isActive: () => true,
      upload: async ({bytes}) => {uploads++; transportBytes = bytes; revision = 2;
        if (lose === 'upload' && fail) {fail = false; throw Error('lost');}},
      submit: async data => {
        if (data.action === 'claim') claims.push(data);
        if (data.action === 'publish') {revision = 3; if (lose === 'publish' && fail) {fail = false; throw Error('lost');}}
        return value(revision);
      }});
    await assert.rejects(source.prepare(command()), /lost/);
    assert.deepEqual([...transportBytes], [0, 0]);
    assert.equal((await source.prepare(command())).stageId, value(3).stageId);
    assert.equal(uploads, 1); assert.deepEqual(claims[0], claims[1]);
  }
});
test('unconfirmed upload never publishes and lock after claim never uploads', async () => {
  let publishes = 0;
  const source = createRestoreStageSource({uid: 'u1', isActive: () => true, upload: async () => {},
    submit: async data => {if (data.action === 'publish') publishes++; return value(1);}});
  await assert.rejects(source.prepare(command()), /UNCONFIRMED/); assert.equal(publishes, 0);
  let active = true, uploads = 0;
  const locked = createRestoreStageSource({uid: 'u1', isActive: () => active, upload: async () => uploads++,
    submit: async () => {active = false; return value(1);}});
  await assert.rejects(locked.prepare(command()), /INACTIVE/); assert.equal(uploads, 0);
});
test('changed stage identity in status fails before publication', async () => {
  const source = createRestoreStageSource({uid: 'u1', isActive: () => true, upload: async () => {},
    submit: async data => data.action === 'claim' ? value(1) : {...value(2), stageId: 'b'.repeat(64)}});
  await assert.rejects(source.prepare(command()), /RESPONSE/);
});

test('publication cannot replace the verified generation', async () => {
  const source = createRestoreStageSource({uid: 'u1', isActive: () => true, upload: async () => {},
    submit: async data => data.action === 'claim' ? value(2) : {...value(3), generation: '456'}});
  await assert.rejects(source.prepare(command()), /RESPONSE/);
});

test('lock during upload clears the owned copy and prevents status or publication', async () => {
  let active = true, retained;
  const calls = [], input = command();
  const source = createRestoreStageSource({uid: 'u1', isActive: () => active,
    upload: async ({bytes}) => {retained = bytes; active = false;},
    submit: async data => {calls.push(data.action); return value(1);}});
  await assert.rejects(source.prepare(input), /INACTIVE/);
  assert.deepEqual(calls, ['claim']);
  assert.deepEqual([...retained], [0, 0]);
  assert.deepEqual([...input.bytes], [1, 2]);
});
