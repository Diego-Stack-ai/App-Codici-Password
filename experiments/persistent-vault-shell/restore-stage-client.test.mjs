import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRestoreStageClient} from './restore-stage-client.mjs';
const config = {endpoint: 'http://127.0.0.1:4188/download', origin: 'http://127.0.0.1:4188',
  getCredentials: async () => ({idToken: 'synthetic', appCheckToken: 'synthetic'}), isActive: () => true};
const command = {stageId: 'a'.repeat(64)};
test('unsupported generation yields fixed explanation and cancels response without reading bytes', async () => {
  let cancelled = false;
  const client = createRestoreStageClient({...config, fetchImpl: async () => ({status: 409,
    headers: new Headers({'x-stage-error': 'GENERATION_UNSUPPORTED'}), body: {
      cancel: async () => {cancelled = true;}, getReader: () => assert.fail('must not read bytes')
    }})});
  await assert.rejects(client(command), error => error.code === 'GENERATION_UNSUPPORTED' && error.message.includes('Recupero bloccato'));
  assert.equal(cancelled, true);
});
const headers = {'content-type': 'application/octet-stream', 'content-length': '2',
  'x-storage-generation': '90071992547409931', 'x-content-sha256': 'b'.repeat(64)};

for(const mode of ['abort','cancel-pending'])test(`download wipes consumed chunks before ${mode} finishes`,async()=>{
  const abort=new AbortController(),chunk=new Uint8Array(mode==='abort'?[1]:[1,2,3]);
  let started,release,reads=0;
  const ready=new Promise(resolve=>{started=resolve;});
  const client=createRestoreStageClient({...config,signal:abort.signal,fetchImpl:async()=>({status:200,headers:new Headers(headers),body:{getReader:()=>({
    read(){if(++reads===1)return Promise.resolve({done:false,value:chunk});started();return new Promise(resolve=>{release=()=>resolve({done:true});});},
    cancel(){if(mode==='abort')return Promise.resolve();started();return new Promise(resolve=>{release=resolve;});},releaseLock(){}
  })}})});
  const pending=client(command),rejected=assert.rejects(pending,mode==='abort'?/INACTIVE/:/SIZE/);
  await ready;if(mode==='abort')abort.abort();
  try{assert.ok(chunk.every(byte=>byte===0));}finally{release();await rejected;}
});
test('AbortSignal interrupts real fetch body stalled after a partial response', {timeout: 5000}, async t => {
  const controller = new AbortController();
  let startedResolve, closedResolve;
  const started = new Promise(resolve => {startedResolve = resolve;});
  const closed = new Promise(resolve => {closedResolve = resolve;});
  const server = http.createServer((_req, res) => {
    res.once('close', closedResolve); res.writeHead(200, headers); res.write(Buffer.from([1]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); return new Promise(resolve => server.close(resolve));});
  const origin = `http://127.0.0.1:${server.address().port}`;
  const client = createRestoreStageClient({...config, endpoint: `${origin}/download`, origin, signal: controller.signal,
    fetchImpl: async (...args) => {
      const response = await fetch(...args);
      return {status: response.status, headers: response.headers, redirected: response.redirected, body: {getReader() {
        const reader = response.body.getReader(); let reads = 0;
        return {read() {const pending = reader.read(); if (++reads === 2) startedResolve(); return pending;},
          cancel: () => reader.cancel(), releaseLock: () => reader.releaseLock()};
      }}};
    }});
  const pending = client(command), rejected = assert.rejects(pending);
  await started; controller.abort(); await rejected; await closed;
  await assert.rejects(client(command), /INACTIVE/);
});
test('bounded stream preserves metadata and clears source chunks with explicit fetch options', async () => {
  const chunk = new Uint8Array([1, 2]);
  const client = createRestoreStageClient({...config, fetchImpl: async (url, options) => {
    assert.equal(url, config.endpoint); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    return new Response(new ReadableStream({start(controller) {controller.enqueue(chunk); controller.close();}}), {headers});
  }});
  const value = await client(command); assert.deepEqual([...value.bytes], [1, 2]);
  assert.equal(value.generation, headers['x-storage-generation']); assert.deepEqual([...chunk], [0, 0]); value.bytes.fill(0);
});
test('oversize and revocation clear chunks and reject', async () => {
  for (const mode of ['oversize', 'revoked']) {
    let active = true; const chunk = new Uint8Array([1, 2, 3]);
    const client = createRestoreStageClient({...config, isActive: () => active, fetchImpl: async () =>
      new Response(new ReadableStream({pull(controller) {
        if (mode === 'revoked') active = false;
        controller.enqueue(chunk); controller.close();
      }}), {headers})});
    await assert.rejects(client(command), mode === 'oversize' ? /SIZE/ : /INACTIVE/);
    // If revocation happens before body acquisition, cancellation owns cleanup;
    // consumed chunks are explicitly cleared by the client.
    if (mode === 'oversize') assert.deepEqual([...chunk], [0, 0, 0]);
  }
});
test('foreign origins and redirects are not accepted', async () => {
  assert.throws(() => createRestoreStageClient({...config, endpoint: 'http://example.invalid/download', fetchImpl: async () => {}}), /CONFIG/);
  const client = createRestoreStageClient({...config, fetchImpl: async () => new Response(null, {status: 302, headers})});
  await assert.rejects(client(command), /RESPONSE/);
});

test('revocation during pending read clears delivered chunk and cancels reader', async () => {
  let active = true, resolveRead, readyResolve, cancelled = 0, released = 0;
  const ready = new Promise(resolve => {readyResolve = resolve;});
  const chunk = new Uint8Array([7, 8]);
  const client = createRestoreStageClient({...config, isActive: () => active, fetchImpl: async () => ({
    status: 200, headers: new Headers(headers), body: {getReader: () => ({
      read: () => new Promise(resolve => {resolveRead = resolve; readyResolve();}),
      cancel: async () => {cancelled++;}, releaseLock: () => {released++;}
    })}
  })});
  const pending = client(command); await ready; active = false; resolveRead({done: false, value: chunk});
  await assert.rejects(pending, /INACTIVE/); assert.deepEqual([...chunk], [0, 0]);
  assert.equal(cancelled, 1); assert.equal(released, 1);
});
test('truncated stream rejects and clears previously received bytes', async () => {
  const chunk = new Uint8Array([7]);
  const client = createRestoreStageClient({...config, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) {controller.enqueue(chunk); controller.close();}
  }), {headers})});
  await assert.rejects(client(command), /SIZE/); assert.deepEqual([...chunk], [0]);
});
