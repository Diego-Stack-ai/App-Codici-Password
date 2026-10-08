import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {createRestoreStageDownload} from './restore-stage-download.mjs';
const id = 'a'.repeat(64);
const headers = {host: 'localhost', authorization: 'Bearer synthetic', 'x-firebase-appcheck': 'synthetic', 'x-stage-id': id, 'content-length': '0'};
const result = () => ({bytes: Buffer.from([1, 2, 3]), size: 3, generation: '90071992547409931', sha256: 'b'.repeat(64)});
const verifiers = {verifyIdToken: async token => {if (token !== 'synthetic') throw Error('private'); return {uid: 'u1'};},
  verifyAppCheck: async token => {if (token !== 'synthetic') throw Error('private');}};

test('unsupported generation exposes only a fixed code, never internal details', async () => {
  const handler = createRestoreStageDownload({...verifiers, read: async () => {throw Object.assign(Error('SYNTHETIC_PRIVATE'), {code: 'BACKUP_STAGE_GENERATION_UNSUPPORTED'});}});
  const res = new EventEmitter(); let status, responseHeaders, body;
  res.writeHead = (code, values) => {status = code; responseHeaders = values;};
  res.end = value => {body = value; res.emit('finish');};
  await handler({method: 'POST', url: '/download', headers, socket: {remoteAddress: '127.0.0.1'}}, res);
  assert.equal(status, 409);
  assert.equal(responseHeaders['x-stage-error'], 'GENERATION_UNSUPPORTED');
  assert.equal(body, '{"error":"GENERATION_UNSUPPORTED"}');
});
test('real client socket disconnect clears read result arriving after server close', {timeout: 5000}, async t => {
  let releaseRead, readyResolve, closedResolve, doneResolve;
  const ready = new Promise(resolve => {readyResolve = resolve;});
  const closed = new Promise(resolve => {closedResolve = resolve;});
  const done = new Promise(resolve => {doneResolve = resolve;});
  const handler = createRestoreStageDownload({...verifiers, read: () => new Promise(resolve => {releaseRead = resolve; readyResolve();})});
  const server = http.createServer((req, res) => {
    res.once('close', closedResolve);
    handler(req, res).finally(doneResolve);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); return new Promise(resolve => server.close(resolve));});
  const req = http.request({host: '127.0.0.1', port: server.address().port, method: 'POST', path: '/download', headers, agent: false},
    () => assert.fail('response after disconnect'));
  req.on('error', () => {}); req.end();
  await ready; req.destroy(); await closed;
  const value = result(); releaseRead(value); await done;
  assert.deepEqual([...value.bytes], [0, 0, 0]);
});
test('invalid method, framing, path and loopback fail before verifiers or read', async () => {
  let calls = 0;
  const handler = createRestoreStageDownload({read: () => calls++, verifyIdToken: () => calls++, verifyAppCheck: () => calls++});
  const base = {method: 'POST', url: '/download', headers, socket: {remoteAddress: '127.0.0.1'}};
  for (const [patch, expected] of [[{method: 'GET'}, 405], [{headers: {...headers, 'content-length': '1'}}, 400],
    [{headers: {...headers, 'transfer-encoding': 'chunked'}}, 400], [{headers: {...headers, 'x-stage-id': 'bad'}}, 400],
    [{headers: {...headers, 'x-generation': '2'}}, 400], [{headers: {...headers, host: 'example.invalid'}}, 403],
    [{socket: {remoteAddress: '192.0.2.1'}}, 403]]) {
    const res = new EventEmitter(); let status;
    res.writeHead = value => {status = value;}; res.end = () => res.emit('finish');
    await handler({...base, ...patch}, res); assert.equal(status, expected);
  }
  assert.equal(calls, 0);
});
test('buffer stays intact until response completion and malformed metadata is cleared', async () => {
  for (const event of ['finish', 'close', 'error', 'invalid']) {
    const value = result(), res = new EventEmitter(); let status;
    if (event === 'invalid') value.generation = 42;
    res.writeHead = code => {status = code;}; res.end = () => {};
    await createRestoreStageDownload({...verifiers, read: async () => value})(
      {method: 'POST', url: '/download', headers, socket: {remoteAddress: '127.0.0.1'}}, res);
    if (event !== 'invalid') {
      assert.equal(status, 200); assert.deepEqual([...value.bytes], [1, 2, 3]);
      res.emit(event); res.emit('close');
    } else assert.equal(status, 500);
    assert.deepEqual([...value.bytes], [0, 0, 0]);
  }
});
test('service error status cannot turn a failure into HTTP success', async () => {
  const res = new EventEmitter(); let status, body;
  res.writeHead = value => {status = value;}; res.end = value => {body = value; res.emit('finish');};
  await createRestoreStageDownload({...verifiers, read: async () => {throw Object.assign(Error('private provider detail'), {status: 200});}})(
    {method: 'POST', url: '/download', headers, socket: {remoteAddress: '127.0.0.1'}}, res);
  assert.equal(status, 400); assert.equal(body, '{"error":"DOWNLOAD_FAILED"}');
});
test('HTTP response preserves bytes, server owner and generation then clears buffer; rejects bad requests', async t => {
  let calls = 0, last;
  const server = http.createServer(createRestoreStageDownload({...verifiers, read: async (uid, command) => {
    calls++; assert.equal(uid, 'u1'); assert.deepEqual(command, {stageId: id}); return last = result();
  }}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const send = (patch = {}, path = '/download') => new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port: server.address().port, method: 'POST', path, headers: {...headers, ...patch}, agent: false}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks)}));
    }); req.on('error', reject); req.end();
  });
  const good = await send(); assert.equal(good.status, 200); assert.deepEqual([...good.bytes], [1, 2, 3]);
  assert.equal(good.headers['cache-control'], 'no-store'); assert.equal(good.headers['x-storage-generation'], last.generation);
  assert.deepEqual([...last.bytes], [0, 0, 0]);
  for (const [patch, path, status] of [[{authorization: 'Bearer wrong'}, '/download', 401],
    [{'x-firebase-appcheck': 'wrong'}, '/download', 401], [{'x-uid': 'other'}, '/download', 400],
    [{}, '/download?path=x', 400]]) assert.equal((await send(patch, path)).status, status);
  assert.equal(calls, 1);
});
test('response closed while read pending clears late bytes without sending', async () => {
  let resolve;
  const res = new EventEmitter(); res.destroyed = false;
  res.writeHead = () => assert.fail('late response'); res.end = () => assert.fail('late response');
  const handler = createRestoreStageDownload({...verifiers, read: () => new Promise(yes => {resolve = yes;})});
  const pending = handler({method: 'POST', url: '/download', headers, socket: {remoteAddress: '127.0.0.1'}}, res);
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(typeof resolve, 'function'); res.emit('close');
  const value = result(); resolve(value); await pending; assert.deepEqual([...value.bytes], [0, 0, 0]);
});
