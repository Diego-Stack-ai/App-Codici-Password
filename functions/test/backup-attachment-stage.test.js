const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {stageIdentity, prepareStage, verifyStageBytes, uploadStage, STAGE_TTL_MS, MAX_BYTES} = require('../backup-attachment-stage');
const bytes = Buffer.from('synthetic-ciphertext');
const input = {expectedOwnerUid: 'owner', operationId: 'restore-1', storagePath: 'users/owner/accounts/a/file',
  sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length};
const timestamp = value => ({toMillis: () => value});
test('installed SDK preserves large generation in media request without network', async () => {
  const {Storage} = require('@google-cloud/storage');
  const {generationFile} = require('../backup-attachment-stage');
  const storage = new Storage({projectId: 'demo-stage', retryOptions: {autoRetry: false}});
  let captured;
  storage.makeAuthenticatedRequest = options => {
    captured = options;
    const {PassThrough} = require('node:stream');
    const stream = new PassThrough();
    process.nextTick(() => stream.destroy(Error('SYNTHETIC_TRANSPORT_STOP')));
    return stream;
  };
  const bucket = storage.bucket('demo-stage');
  await assert.rejects(generationFile(bucket, 'synthetic', '9007199254740993').download(), /SYNTHETIC_TRANSPORT_STOP/);
  assert.equal(captured.qs.generation, '9007199254740993');
  assert.equal(captured.qs.alt, 'media');
  assert.throws(() => generationFile({file: () => ({generation: 9007199254740992})}, 'synthetic', '9007199254740993'), /GENERATION_UNSUPPORTED/);
  assert.equal(generationFile(bucket, 'synthetic', '123').generation, 123);
});
function fixture() {
  let descriptor, metadata = null, downloaded, generation;
  const reads = [], writes = [];
  const reference = {collection() { return this; }, doc() { return this; }};
  const store = {collection() { return reference; }, async runTransaction(run) {
    return run({get: async () => ({exists: !!descriptor, data: () => descriptor}),
      create(_ref, value) { descriptor = value; writes.push(value); }});
  }};
  const bucket = {file(path, options) {
    reads.push(path);
    return {async getMetadata() { if (!metadata) throw Object.assign(new Error('missing'), {code: 404}); return [metadata]; },
      async download() { generation = options?.generation; downloaded = Buffer.from(bytes); return [downloaded]; }};
  }};
  return {store, bucket, reads, writes, setDescriptor: value => { descriptor = value; },
    setMetadata: value => { metadata = value; }, get downloaded() { return downloaded; }, get generation() { return generation; }};
}
const prepare = (f, now = 100) => prepareStage({...f, uid: 'owner', input, now, timestamp});

test('stage identity binds owner, source, digest, length and import operation', () => {
  const identity = stageIdentity('owner', input);
  assert.deepEqual(stageIdentity('owner', {...input}), identity);
  assert.match(identity.storagePath, /^users\/owner\/restoreObjects\/[a-f0-9]{64}$/);
  for (const change of [{operationId: 'restore-2'}, {storagePath: 'users/owner/other'}, {sha256: 'a'.repeat(64)}, {size: 1}]) {
    assert.notEqual(stageIdentity('owner', {...input, ...change}).id, identity.id);
  }
  assert.throws(() => stageIdentity('other', input), /OWNER_MISMATCH/);
});

test('stage rejects invalid owner paths, lengths and identifiers', () => {
  for (const path of ['users/other/f', 'users/owner/../f', 'users/owner//f', 'users/owner/%2e/f', 'users/owner/f\n']) {
    assert.throws(() => stageIdentity('owner', {...input, storagePath: path}), /PATH_INVALID/);
  }
  for (const size of [0, -1, 1.2, MAX_BYTES + 1]) assert.throws(() => stageIdentity('owner', {...input, size}));
  assert.throws(() => stageIdentity('owner', {...input, operationId: undefined}));
});

test('prepare creates one seven-day reservation and retries without extending it', async () => {
  const f = fixture();
  assert.equal((await prepare(f)).uploadRequired, true);
  assert.equal((await prepare(f, 200)).uploadRequired, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].expiresAt.toMillis(), 100 + STAGE_TTL_MS);
});

test('expired reservations fail even when bytes exist; deleting stages cannot be published', async () => {
  const f = fixture();
  await prepare(f);
  f.setMetadata({size: input.size, generation: '123'});
  await assert.rejects(prepare(f, 100 + STAGE_TTL_MS), /STAGE_EXPIRED/);
  f.setDescriptor({...stageIdentity('owner', input), status: 'deleting'});
  await assert.rejects(prepare(f), /STAGE_UNVERIFIED/);
});

test('published missing object fails closed rather than authorizing replacement', async () => {
  const f = fixture(); f.setDescriptor({...stageIdentity('owner', input), status: 'published'});
  await assert.rejects(prepare(f), /PUBLISHED_MISSING/);
  assert.equal(f.writes.length, 0);
});

test('corrupt descriptors and malformed expiry never authorize upload', async () => {
  for (const patch of [{sourceHash: 'wrong'}, {operationId: 'different'}, {expiresAt: null},
    {expiresAt: timestamp(NaN)}, {expiresAt: timestamp(100)}]) {
    const f = fixture();
    f.setDescriptor({...stageIdentity('owner', input), status: 'pending', expiresAt: timestamp(500), ...patch});
    await assert.rejects(prepare(f));
    assert.equal(f.reads.length, 0);
    assert.equal(f.writes.length, 0);
  }
});

test('an existing valid object needs verification but never authorizes overwrite', async () => {
  const f = fixture(); f.setMetadata({size: String(input.size), generation: '123'});
  assert.equal((await prepare(f)).uploadRequired, false);
  assert.equal(f.downloaded, undefined);
  f.setDescriptor({...stageIdentity('owner', input), status: 'published'});
  assert.equal((await prepare(f, 100 + STAGE_TTL_MS)).uploadRequired, false);
});

test('numeric, absent and malformed generations are rejected before download', async () => {
  for (const generation of [123, undefined, '0', '-1', '1.5', '1e10', ' 123']) {
    const f = fixture(); f.setMetadata({size: String(input.size), generation});
    await assert.rejects(verifyStageBytes(f.bucket, stageIdentity('owner', input)), /UNVERIFIED/);
    assert.equal(f.downloaded, undefined);
  }
});

test('verification pins full generation string and erases downloaded bytes', async () => {
  const f = fixture(), identity = stageIdentity('owner', input), generation = '90071992547409931234';
  f.setMetadata({size: String(input.size), generation});
  assert.equal(await verifyStageBytes(f.bucket, identity), generation);
  assert.equal(f.generation, generation);
  assert.ok(f.downloaded.every(byte => byte === 0));
});

test('mismatched hash erases bytes and metadata mismatch prevents download', async () => {
  const f = fixture(), identity = stageIdentity('owner', input);
  f.setMetadata({size: String(input.size), generation: '123'});
  await assert.rejects(verifyStageBytes(f.bucket, {...identity, sha256: 'a'.repeat(64)}), /DIGEST_MISMATCH/);
  assert.ok(f.downloaded.every(byte => byte === 0));
  const g = fixture(); g.setMetadata({size: '1', generation: '123'});
  await assert.rejects(verifyStageBytes(g.bucket, identity), /UNVERIFIED/);
  assert.equal(g.downloaded, undefined);
});

function uploadFixture({saveError, racedBytes} = {}) {
  const f = fixture();
  let saved, calls = 0;
  const downloads = [];
  const bucket = {file(path, options) {
    assert.equal(path, stageIdentity('owner', input).storagePath);
    return {
      async getMetadata() {
        if (!saved) throw Object.assign(new Error('missing'), {code: 404});
        return [{size: String(saved.length), generation: '90071992547409931234'}];
      },
      async save(content, config) {
        calls++;
        assert.deepEqual(config.preconditionOpts, {ifGenerationMatch: 0});
        assert.equal(config.resumable, false);
        assert.equal(config.metadata.contentType, 'application/octet-stream');
        if (racedBytes) saved = Buffer.from(racedBytes);
        if (saveError) throw Object.assign(new Error('synthetic failure'), {code: saveError});
        saved = Buffer.from(content);
      },
      async download() {
        assert.equal(options.generation, '90071992547409931234');
        const copy = Buffer.from(saved); downloads.push(copy); return [copy];
      }
    };
  }};
  return {...f, bucket, downloads, get calls() { return calls; }};
}
const upload = (f, content = Buffer.from(bytes)) => uploadStage({store: f.store, bucket: f.bucket,
  uid: 'owner', input, bytes: content, now: 100, timestamp});

test('server upload uses create-if-absent and verifies pinned bytes; retry never rewrites', async () => {
  const f = uploadFixture(), content = Buffer.from(bytes);
  const result = await upload(f, content);
  assert.equal(result.generation, '90071992547409931234');
  assert.equal(f.calls, 1);
  assert.deepEqual(content, bytes);
  assert.ok(f.downloads[0].every(value => value === 0));
  assert.deepEqual(await upload(f), result);
  assert.equal(f.calls, 1);
});

test('server upload refuses mismatched input before any reservation or write', async () => {
  for (const content of [Buffer.from('wrong'), new Uint8Array(bytes)]) {
    const f = uploadFixture();
    await assert.rejects(upload(f, content), /DIGEST_MISMATCH/);
    assert.equal(f.writes.length, 0);
    assert.equal(f.calls, 0);
  }
});

test('412 is accepted only after verifying the raced object, never by overwrite', async () => {
  const f = uploadFixture({saveError: 412, racedBytes: bytes});
  assert.equal((await upload(f)).generation, '90071992547409931234');
  assert.equal(f.calls, 1);
  const corrupt = uploadFixture({saveError: 412, racedBytes: Buffer.alloc(bytes.length)});
  await assert.rejects(upload(corrupt), /DIGEST_MISMATCH/);
  assert.equal(corrupt.calls, 1);
  assert.ok(corrupt.downloads[0].every(value => value === 0));
});

test('transport failure is not mislabeled as a successful concurrent upload', async () => {
  const f = uploadFixture({saveError: 503, racedBytes: bytes});
  await assert.rejects(upload(f), error => error.code === 503);
  assert.equal(f.calls, 1);
  assert.equal(f.downloads.length, 0);
});

test('upload guard failures are never treated as Storage races and preserve caller bytes', async () => {
  for (const code of ['EXPIRED', 412]) {
    const f = uploadFixture(), content = Buffer.from(bytes);
    await assert.rejects(uploadStage({store: f.store, bucket: f.bucket, uid: 'owner', input,
      bytes: content, now: 100, timestamp,
      assertUploadAllowed() { throw Object.assign(new Error('guard rejected'), {code}); }}),
    error => error.code === code);
    assert.equal(f.calls, 0);
    assert.equal(f.downloads.length, 0);
    assert.deepEqual(content, bytes);
  }
});

test('upload waits for durable registration and rechecks its guard after that await', async () => {
  for (const mode of ['registration-error', 'expired', 'success']) {
    const f = uploadFixture(), content = Buffer.from(bytes);
    let release, entered, registered = false;
    const started = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const pending = uploadStage({store: f.store, bucket: f.bucket, uid: 'owner', input,
      bytes: content, now: 100, timestamp,
      async beforeUpload() {
        entered(); await gate;
        if (mode === 'registration-error') throw Error('REGISTRATION_FAILED');
        registered = true;
      },
      assertUploadAllowed() {
        assert.equal(registered, true);
        if (mode === 'expired') throw Error('EXPIRED_AFTER_REGISTRATION');
      }});
    await started;
    assert.equal(f.calls, 0, 'must not save while registration is pending');
    assert.equal(f.downloads.length, 0);
    release();
    if (mode === 'success') { await pending; assert.equal(f.calls, 1); }
    else { await assert.rejects(pending, /REGISTRATION_FAILED|EXPIRED_AFTER_REGISTRATION/); assert.equal(f.calls, 0); }
    assert.deepEqual(content, bytes);
  }
});
