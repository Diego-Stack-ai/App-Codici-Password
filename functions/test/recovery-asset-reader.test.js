const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const {createRecoveryAssetReaderService, RECOVERY_ASSET_BUCKET, MAX_RECOVERY_ASSET_BYTES,
  MAX_RECOVERY_ASSET_PART_BYTES} = require('../recovery-asset-reader');
const {createVaultRecoveryBinding, acquireVaultRecoveryFence} = require('../vault-recovery-fence');
const {generationFile} = require('../backup-attachment-stage');
const {createGlobalPurgeLockBinding, acquireGlobalPurgeLock} = require('../archive-purge-global-lock');
const uid = 'synthetic-owner';
const storagePath = `users/${uid}/profile-documents/document/attachments/attachment`;
const generation = '90071992547409931234';
const instant = 1900000000000;
const request = data => ({auth: {uid, token: {email: 'synthetic@example.invalid', email_verified: true, auth_time: instant / 1000}},
  app: {appId: 'synthetic-app'}, data: {action: 'inspect', expectedOwnerUid: uid, storagePath, ...data}});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(options = {}) {
  const calls = [], downloaded = [], locks = new Map();
  let hook = () => {}, current = generation, metadataOverride = {}, failure, rounded = false;
  const source = Buffer.from('synthetic encrypted object bytes'), versions = new Map([[generation, source]]);
  const db = {doc: path => ({path}), async runTransaction(run) {
    calls.push({kind: 'transaction'});
    return run({get: async ref => ({exists: locks.has(ref.path), data: () => locks.get(ref.path)})});
  }};
  const bucket = {name: RECOVERY_ASSET_BUCKET, file(path, binding) {
    const selected = binding?.generation;
    calls.push({kind: 'file', path, generation: selected});
    const file = {async getMetadata() {
      calls.push({kind: 'metadata', generation: selected});
      if (failure) throw failure;
      const selectedGeneration = selected || current;
      const bytes = versions.get(selectedGeneration);
      if (!bytes) throw Object.assign(new Error('sensitive missing provider detail'), {code: 404});
      const value = {name: path, bucket: bucket.name, size: String(bytes.length), contentType: 'application/octet-stream',
        generation: selectedGeneration, metageneration: '1', metadata: {encrypted: 'v1'}, ...metadataOverride};
      hook('metadata', {pinned: !!selected, generation: selectedGeneration});
      return [value];
    }, async download(config) {
      calls.push({kind: 'download', generation: selected, config});
      if (failure) throw failure;
      const source = versions.get(selected || current);
      if (!source) throw Object.assign(new Error('sensitive provider deletion'), {code: 404});
      const bytes = Buffer.from(config.start === undefined ? source : source.subarray(config.start, config.end + 1));
      downloaded.push(bytes); hook('download', {bytes, config}); return [bytes];
    }};
    if (rounded && selected) file.generation = Number(selected);
    else if (selected) file.generation = selected;
    return file;
  }};
  const reader = createRecoveryAssetReaderService({db, bucket, now: () => instant, enabled: true, ...options});
  return {reader, db, bucket, calls, downloaded, locks, source, versions, setHook: value => { hook = value; },
    replace() { current = '90071992547409931235'; versions.set(current, Buffer.from('replacement')); },
    setMetadata: value => { metadataOverride = value; }, setFailure: value => { failure = value; },
    setRounded: () => { rounded = true; }};
}

test('default hard-off, authentication, verified email, App Check and recent auth prevent all source access', async () => {
  const f = fixture({enabled: false});
  await assert.rejects(f.reader.inspect(request()), /RECOVERY_ASSET_DISABLED/);
  assert.equal(f.calls.length, 0);
  for (const mutate of [r => { r.auth = null; }, r => { r.data.expectedOwnerUid = 'other'; },
    r => { r.app = null; }, r => { r.app = {}; }, r => { r.auth.token.email_verified = false; },
    r => { r.auth.token.email = ''; }, r => { r.auth.token.auth_time -= 301; },
    r => { r.auth.token.auth_time++; }, r => { r.auth.token.auth_time = String(instant / 1000); }]) {
    const candidate = request(); mutate(candidate);
    const denied = fixture(); await assert.rejects(denied.reader.inspect(candidate)); assert.equal(denied.calls.length, 0);
  }
  const enabledByString = fixture({enabled: 'true'});
  await assert.rejects(enabledByString.reader.inspect(request()), /DISABLED/);
  assert.equal(enabledByString.calls.length, 0);
});

test('inspect hashes the exact pinned generation, checks both fences and clears its whole-object buffer', async () => {
  const f = fixture();
  const result = await f.reader.inspect(request({expectedGeneration: generation}));
  assert.deepEqual(Object.keys(result).sort(), ['storagePath', 'size', 'contentType', 'generation', 'binding', 'sha256', 'encrypted'].sort());
  assert.equal(result.generation, generation); assert.equal(result.sha256, hash(f.source)); assert.equal(result.encrypted, 'v1');
  assert.match(result.binding, /^[a-f0-9]{64}$/);
  const media = f.calls.filter(call => call.kind === 'download');
  assert.equal(media.length, 1); assert.equal(media[0].generation, generation);
  assert.deepEqual(media[0].config, {validation: 'crc32c', decompress: false});
  assert.equal(f.downloaded[0].every(byte => byte === 0), true);
  assert.equal(f.calls.filter(call => call.kind === 'transaction').length >= 10, true);
});

test('parts retain exact generation/binding and bounded range; whole SHA-256 is supplied only by inspect', async () => {
  const f = fixture(), descriptor = await f.reader.inspect(request());
  const part = await f.reader.readPart(request({action: 'readPart', generation, binding: descriptor.binding,
    offset: 2, length: 8, totalSize: descriptor.size}));
  assert.equal(Buffer.from(part.content, 'base64').toString(), f.source.subarray(2, 10).toString());
  assert.deepEqual(Object.keys(part).sort(), ['storagePath', 'generation', 'binding', 'offset', 'length', 'totalSize', 'content'].sort());
  assert.equal(part.generation, generation); assert.equal(part.offset, 2); assert.equal(part.totalSize, f.source.length);
  assert.deepEqual(f.calls.filter(call => call.kind === 'download').at(-1).config,
    {start: 2, end: 9, validation: false, decompress: false});
  assert.equal(f.downloaded.every(bytes => bytes.every(byte => byte === 0)), true);
  const input = {action: 'readPart', generation, binding: descriptor.binding, offset: 0, length: 1, totalSize: descriptor.size};
  for (const change of [{offset: -1}, {offset: 1.5}, {length: 0}, {length: MAX_RECOVERY_ASSET_PART_BYTES + 1},
    {offset: descriptor.size}, {length: descriptor.size + 1}, {totalSize: MAX_RECOVERY_ASSET_BYTES + 1}]) {
    const count = f.calls.length;
    await assert.rejects(f.reader.readPart(request({...input, ...change})), /RANGE_INVALID/);
    assert.equal(f.calls.length, count);
  }
  await assert.rejects(f.reader.readPart(request({...input, binding: '0'.repeat(64)})), /SOURCE_CHANGED/);
  f.replace();
  const before = f.calls.filter(call => call.kind === 'download').length;
  await assert.rejects(f.reader.readPart(request(input)), /SOURCE_CHANGED/);
  assert.equal(f.calls.filter(call => call.kind === 'download').length, before);
});

test('aliases, expected generation mismatches, missing/replaced objects and malformed metadata fail closed', async () => {
  for (const path of ['users/other/file', `users/${uid}/../file`, `users/${uid}//file`,
    'https://example.invalid/file', `users/${uid}/file?token=secret`]) {
    const f = fixture(); await assert.rejects(f.reader.inspect(request({storagePath: path})), /PATH_INVALID/); assert.equal(f.calls.length, 0);
  }
  const wrongGeneration = fixture();
  await assert.rejects(wrongGeneration.reader.inspect(request({expectedGeneration: '7'})), /SOURCE_CHANGED/);
  assert.equal(wrongGeneration.calls.some(call => call.kind === 'download'), false);
  for (const metadata of [{generation: Number(generation)}, {generation: '0'}, {size: MAX_RECOVERY_ASSET_BYTES + 1},
    {name: 'users/other/file'}, {bucket: 'other'}, {contentType: 'unknown'}, {metageneration: undefined},
    {contentEncoding: 'gzip'}, {metadata: {encrypted: 'not-supported'}}]) {
    const f = fixture(); f.setMetadata(metadata); await assert.rejects(f.reader.inspect(request()), /METADATA_INVALID/);
    assert.equal(f.calls.some(call => call.kind === 'download'), false);
  }
  const missing = fixture(); missing.versions.clear();
  await assert.rejects(missing.reader.inspect(request()), /SOURCE_MISSING/);
  const replaced = fixture(); replaced.setHook(phase => { if (phase === 'download') replaced.replace(); });
  await assert.rejects(replaced.reader.inspect(request()), /SOURCE_CHANGED/);
  assert.equal(replaced.downloaded.every(bytes => bytes.every(byte => byte === 0)), true);
  const changedMetadata = fixture(); changedMetadata.setHook(phase => { if (phase === 'download') changedMetadata.setMetadata({metageneration: '2'}); });
  await assert.rejects(changedMetadata.reader.inspect(request()), /SOURCE_CHANGED/);
});

test('purge/recovery markers appearing during I/O prevent return and provider errors never escape', async () => {
  for (const phase of ['metadata', 'download']) {
    const f = fixture();
    const binding = createVaultRecoveryBinding({uid, operationId: 'synthetic-recovery', planDigest: '1'.repeat(64)});
    f.setHook(current => { if (current === phase) f.locks.set(`vaultRecoveryLocks/${uid}`, acquireVaultRecoveryFence(null, binding).record); });
    await assert.rejects(f.reader.inspect(request()), /RECOVERY_ASSET_BUSY/);
    assert.equal(f.downloaded.every(bytes => bytes.every(byte => byte === 0)), true);
    const purge = fixture();
    const purgeBinding = createGlobalPurgeLockBinding({uid, command: {context: 'private', accountId: 'synthetic-account',
      operationId: 'synthetic-purge', expectedRevision: 1}});
    purge.setHook(current => { if (current === phase) purge.locks.set(`archivePurgeLocks/${uid}`, acquireGlobalPurgeLock(null, purgeBinding).record); });
    await assert.rejects(purge.reader.inspect(request()), /RECOVERY_ASSET_BUSY/);
    assert.equal(purge.downloaded.every(bytes => bytes.every(byte => byte === 0)), true);
  }
  const provider = fixture(); provider.setFailure(Object.assign(new Error('SYNTHETIC_PRIVATE_PROVIDER_DETAIL'), {code: 500}));
  await assert.rejects(provider.reader.inspect(request()), error => error.message === 'RECOVERY_ASSET_READ_FAILED' && !JSON.stringify(error).includes('PRIVATE_PROVIDER'));
  const rounded = fixture(); rounded.setRounded();
  await assert.rejects(rounded.reader.inspect(request()), /RECOVERY_ASSET_READ_FAILED/);
  assert.equal(rounded.calls.some(call => call.kind === 'download'), false);
});

test('installed Admin SDK sends the exact 64-bit generation and requested range without network', async () => {
  const {Storage} = require('@google-cloud/storage');
  const storage = new Storage({projectId: 'demo-recovery-assets', retryOptions: {autoRetry: false}});
  let captured;
  storage.makeAuthenticatedRequest = (options, callback) => {
    captured = options;
    if (typeof callback === 'function') { process.nextTick(() => callback(new Error('SYNTHETIC_STOP'))); return; }
    const {PassThrough} = require('node:stream');
    const stream = new PassThrough(); process.nextTick(() => stream.destroy(new Error('SYNTHETIC_STOP'))); return stream;
  };
  await assert.rejects(generationFile(storage.bucket('demo-recovery-assets'), 'synthetic', generation)
    .download({start: 2, end: 9, validation: false, decompress: false}), /SYNTHETIC_STOP/);
  assert.equal(captured.qs.generation, generation); assert.equal(captured.qs.alt, 'media');
  assert.equal(captured.headers.Range, 'bytes=2-9');
  await assert.rejects(generationFile(storage.bucket('demo-recovery-assets'), 'synthetic', generation).getMetadata(), /SYNTHETIC_STOP/);
  assert.equal(captured.qs.generation, generation, 'metadata request must also retain exact generation');
  const opaquePath = `users/${uid}/accounts/account/attachments/100%25-literal%2f-name.bin`;
  await assert.rejects(generationFile(storage.bucket('demo-recovery-assets'), opaquePath, generation).getMetadata(), /SYNTHETIC_STOP/);
  assert.equal(String(captured.uri).includes(encodeURIComponent(opaquePath)), true, 'raw percent must be escaped once, not decoded as a separator');
});

test('literal percent object names remain opaque owner-bound paths', async () => {
  const f = fixture(), opaquePath = `users/${uid}/accounts/account/attachments/100%25-literal%2f-name.bin`;
  const result = await f.reader.inspect(request({storagePath: opaquePath}));
  assert.equal(result.storagePath, opaquePath);
  assert.equal(f.calls.filter(call => call.kind === 'file').every(call => call.path === opaquePath), true);
});

test('candidate is unregistered, source-only and has no secret/token/HTTP or persistence API', () => {
  const source = readFileSync(require.resolve('../recovery-asset-reader'), 'utf8');
  assert.doesNotMatch(source, /fetch\(|getDownloadURL|\.save\(|\.delete\(|(?:transaction|db|store)\.(?:set|update|create)\(|process\.env|console\./);
  assert.doesNotMatch(readFileSync(require.resolve('../index'), 'utf8'), /require\(['"]\.\/recovery-asset-reader/);
});
