import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash, webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';

const source = (await readFile(new URL('../Frontend/public/assets/js/modules/settings/recovery-asset-reader.js', import.meta.url), 'utf8')).replace(/export /g, '');
const uid = 'synthetic-owner', path = `users/${uid}/accounts/account/file`, generation = '90071992547409931234';
const PART_BYTES = 2 * 1024 * 1024, MAX_BYTES = 32 * 1024 * 1024 + 16;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(size = 11) {
    const bytes = Uint8Array.from({length: size}, (_value, index) => index % 251);
    const calls = [], captured = [], events = new EventTarget(), listeners = new Set();
    const controller = new AbortController();
    let owner = uid, active = true, mutate = () => {}, digestHook = () => {};
    const metadata = {storagePath: path, size: bytes.length, contentType: 'application/octet-stream', generation,
        binding: 'b'.repeat(64), sha256: hash(bytes), encrypted: 'v1'};
    class ObservedBytes extends Uint8Array {
        constructor(...args) { super(...args); captured.push(this); }
    }
    const context = {Uint8Array: ObservedBytes, Set, Math, Number, Object, String, Array, Error,
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        addEventListener(name, listener, config) { listeners.add(listener); events.addEventListener(name, listener, config); },
        removeEventListener(name, listener) { listeners.delete(listener); events.removeEventListener(name, listener); },
        crypto: {subtle: {async digest(...args) { const result = await webcrypto.subtle.digest(...args); digestHook(); return result; }}}};
    vm.createContext(context); vm.runInContext(source, context);
    const invoke = async request => {
        calls.push(request);
        let result;
        if (request.action === 'inspect') result = {...metadata};
        else result = {storagePath: path, generation, binding: metadata.binding, offset: request.offset, length: request.length,
            totalSize: bytes.length, content: Buffer.from(bytes.subarray(request.offset, request.offset + request.length)).toString('base64')};
        return mutate(request.action, result, request) || result;
    };
    const create = overrides => context.createRecoveryAssetReader({uid, invoke, getCurrentUid: () => owner,
        isActive: () => active, signal: controller.signal, ...overrides});
    const readAsset = create();
    return {readAsset, create, context, metadata, bytes, calls, captured, controller, events, listeners,
        setOwner: value => { owner = value; }, stop: () => { active = false; },
        mutate: value => { mutate = value; }, onDigest: value => { digestHook = value; }};
}
function assertCleared(f, transferred) {
    for (const bytes of f.captured) {
        if (transferred && bytes.buffer === transferred.buffer) continue;
        assert.equal(bytes.every(byte => byte === 0), true, 'owned partial/temporary buffer must be cleared');
    }
}

test('literal percent path characters are passed through without separator decoding', async () => {
    const f = fixture(), opaquePath = `users/${uid}/accounts/account/attachments/100%25-literal%2f-name.bin`;
    f.metadata.storagePath = opaquePath;
    f.mutate((_action, result) => ({...result, storagePath: opaquePath}));
    const result = await f.readAsset(opaquePath);
    assert.deepEqual(Array.from(result.bytes), Array.from(f.bytes));
    assert.equal(f.calls.every(call => call.storagePath === opaquePath), true);
    result.bytes.fill(0); f.readAsset.release();
});

test('reader assembles contiguous bounded parts, verifies full SHA-256 and transfers only the final buffer', async () => {
    const f = fixture(PART_BYTES + 5);
    const asset = await f.readAsset(path, {expectedGeneration: generation});
    assert.deepEqual(Array.from(asset.bytes), Array.from(f.bytes));
    assert.equal(asset.generation, generation); assert.equal(asset.size, f.bytes.length); assert.equal(asset.encrypted, 'v1');
    assert.equal(f.calls.length, 3); assert.equal(f.calls[0].action, 'inspect');
    assert.equal(f.calls[0].expectedGeneration, generation);
    assert.deepEqual(f.calls.slice(1).map(call => [call.offset, call.length]), [[0, PART_BYTES], [PART_BYTES, 5]]);
    for (const call of f.calls) {
        assert.equal(call.expectedOwnerUid, uid); assert.equal(call.storagePath, path);
        assert.equal(Object.keys(call).some(key => /token|password|keyMaterial|recoveryKey|url/i.test(key)), false);
    }
    assertCleared(f, asset.bytes);
    f.readAsset.release();
    assert.equal(f.listeners.size, 0);
    assert.deepEqual(Array.from(asset.bytes), Array.from(f.bytes), 'returned byte ownership belongs to exporter');
    asset.bytes.fill(0);
});

test('raw assets accept absent/null expectedGeneration and do not invent encryption metadata', async () => {
    const f = fixture(); f.mutate((action, result) => { if (action === 'inspect') delete result.encrypted; });
    const asset = await f.readAsset(path, {expectedGeneration: null});
    assert.equal(Object.hasOwn(asset, 'encrypted'), false);
    assert.equal(Object.hasOwn(f.calls[0], 'expectedGeneration'), false);
    asset.bytes.fill(0); f.readAsset.release();
});

test('unknown/oversized/aliased inspection and expected-generation mismatch reject before any part', async () => {
    const mutations = [result => { result.storagePath = 'users/other/file'; }, result => { result.generation = Number(generation); },
        result => { result.generation = '7'; }, result => { result.size = MAX_BYTES + 1; }, result => { result.size = 0; },
        result => { result.size = '10'; }, result => { result.contentType = 'unknown'; }, result => { result.binding = 'invalid'; },
        result => { result.sha256 = 'invalid'; }, result => { result.encrypted = 'plain'; },
        result => { result.downloadToken = 'SYNTHETIC_PROVIDER_DETAIL'; }];
    for (const mutate of mutations) {
        const f = fixture(); f.mutate((action, result) => { if (action === 'inspect') mutate(result); });
        await assert.rejects(f.readAsset(path, {expectedGeneration: generation}), /RESPONSE_INVALID/);
        assert.equal(f.calls.length, 1); assertCleared(f); f.readAsset.release();
    }
    for (const alias of ['users/other/file', `users/${uid}/../file`, `users/${uid}//file`,
        'https://example.invalid/file', `users/${uid}/file?token=synthetic`]) {
        const f = fixture(); await assert.rejects(f.readAsset(alias), /PATH_INVALID/); assert.equal(f.calls.length, 0); f.readAsset.release();
    }
});

test('part offset/length/generation/size/binding/schema/base64 substitution and wrong full digest clear the assembly', async () => {
    for (const mutate of [part => { part.offset++; }, part => { part.length++; }, part => { part.generation = '7'; },
        part => { part.totalSize++; }, part => { part.binding = '0'.repeat(64); }, part => { part.storagePath = 'users/other/file'; },
        part => { part.extra = true; }, part => { part.content += '\n'; }, part => { part.content = part.content.slice(4); },
        part => { part.content = Buffer.alloc(part.length, 91).toString('base64'); }]) {
        const f = fixture(); f.mutate((action, result) => { if (action === 'readPart') mutate(result); });
        await assert.rejects(f.readAsset(path), /RESPONSE_INVALID|DIGEST_INVALID/);
        assertCleared(f); f.readAsset.release();
    }
    const f = fixture(1); f.mutate((action, part) => { if (action === 'readPart') part.content = 'AB=='; });
    await assert.rejects(f.readAsset(path), /RESPONSE_INVALID/); assertCleared(f); f.readAsset.release();
});

for (const phase of ['inspect', 'readPart', 'digest']) for (const stop of ['uid', 'abort', 'lock', 'active']) {
    test(`late ${stop} at ${phase} prevents a result and clears buffers`, async () => {
        const f = fixture();
        const invalidate = () => {
            if (stop === 'uid') f.setOwner('next-owner');
            if (stop === 'abort') f.controller.abort();
            if (stop === 'lock') f.events.dispatchEvent(new Event('vault-session-locked'));
            if (stop === 'active') f.stop();
        };
        if (phase === 'digest') f.onDigest(invalidate);
        else f.mutate(action => { if (action === phase) invalidate(); });
        await assert.rejects(f.readAsset(path), /SESSION_INVALIDATED/);
        assertCleared(f); assert.equal(f.listeners.size, 0);
        const count = f.calls.length; await assert.rejects(f.readAsset(path), /SESSION_INVALIDATED/); assert.equal(f.calls.length, count);
    });
}

test('provider errors are sanitized and caller cannot pass URLs, tokens or arbitrary options', async () => {
    for (const action of ['inspect', 'readPart']) {
        const f = fixture(); f.mutate(current => { if (action === current) throw new Error('SYNTHETIC_PRIVATE_PROVIDER_DETAIL'); });
        await assert.rejects(f.readAsset(path), error => error.message === 'RECOVERY_ASSET_READ_FAILED');
        assertCleared(f); f.readAsset.release();
    }
    const f = fixture();
    await assert.rejects(f.readAsset(path, {expectedGeneration: generation, token: 'synthetic'}), /RESPONSE_INVALID/);
    assert.equal(f.calls.length, 0); f.readAsset.release();
    assert.doesNotMatch(source, /fetch\(|getIdToken|getToken\(|localStorage|sessionStorage|console\./);
});

test('late failures in a later part clear already assembled bytes as well', async () => {
    const f = fixture(PART_BYTES + 5);
    f.mutate((action, result, request) => { if (action === 'readPart' && request.offset) result.generation = '7'; });
    await assert.rejects(f.readAsset(path), /RESPONSE_INVALID/);
    assertCleared(f); f.readAsset.release();
});

test('real browser/server contract round-trips via injected callable data without URLs or token plumbing', async () => {
    const require = createRequire(import.meta.url);
    const {createRecoveryAssetReaderService, RECOVERY_ASSET_BUCKET} = require('../functions/recovery-asset-reader');
    const bytes = Buffer.alloc(PART_BYTES + 9, 53), buffers = [], downloads = [];
    const db = {doc: path => ({path}), runTransaction: run => run({get: async () => ({exists: false})})};
    const bucket = {name: RECOVERY_ASSET_BUCKET, file(sourcePath, options) {
        return {generation: options?.generation, getMetadata: async () => [{name: sourcePath, bucket: bucket.name,
            generation, metageneration: '1', size: String(bytes.length), contentType: 'application/octet-stream', metadata: {encrypted: 'v1'}}],
        download: async config => {
            assert.equal(options?.generation, generation, 'media must never use the latest unbound reference');
            downloads.push(config);
            const result = Buffer.from(config.start === undefined ? bytes : bytes.subarray(config.start, config.end + 1));
            buffers.push(result); return [result];
        }};
    }};
    const time = 1900000000000;
    const server = createRecoveryAssetReaderService({db, bucket, enabled: true, now: () => time});
    const f = fixture(1);
    const adapter = f.create({invoke: data => server.handle({data, auth: {uid, token: {email: 'synthetic@example.invalid',
        email_verified: true, auth_time: time / 1000}}, app: {appId: 'synthetic-app'}})});
    const result = await adapter(path, {expectedGeneration: generation});
    assert.deepEqual(Buffer.from(result.bytes), bytes);
    assert.equal(result.generation, generation); assert.equal(result.encrypted, 'v1');
    assert.deepEqual(downloads.map(options => options.validation), ['crc32c', false, false]);
    assert.equal(buffers.every(buffer => buffer.every(byte => byte === 0)), true);
    result.bytes.fill(0); adapter.release(); f.readAsset.release();
});

test('only enumerated callable reason codes survive sanitization', async () => {
    for (const code of ['RECOVERY_ASSET_SOURCE_MISSING', 'RECOVERY_ASSET_SOURCE_CHANGED', 'RECOVERY_ASSET_RECENT_AUTH_REQUIRED']) {
        const f = fixture(), adapter = f.create({invoke: async () => { throw Object.assign(new Error('SYNTHETIC_PROVIDER_DETAIL'), {details: {reason: code}}); }});
        await assert.rejects(adapter(path), error => error.message === code);
        adapter.release(); f.readAsset.release();
    }
});
