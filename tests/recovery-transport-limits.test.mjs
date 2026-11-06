import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const source = await readFile(new URL('../Frontend/public/assets/js/modules/settings/recovery-transport-limits.js', import.meta.url), 'utf8');
const client = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const server = createRequire(import.meta.url)('../functions/full-recovery-model.js');
const capacity = /TRANSPORT_CAPACITY_EXCEEDED/;

test('client and server bound complete UTF-8 JSON including commitment and header fields', () => {
    assert.equal(client.MAX_RECOVERY_CONTENT_BYTES, 20 * 1024 * 1024);
    assert.equal(client.MAX_RECOVERY_CONTENT_BYTES, server.MAX_CONTENT_BYTES);
    const value = {ownerUid: '界', backupId: 'backup', profile: 'complete-recovery', manifestDigest: 'a'.repeat(64),
        sourceDigest: 'A'.repeat(43) + '=', contentDigest: 'b'.repeat(64), records: [], assets: [], references: [], padding: ''};
    const overhead = Buffer.byteLength(JSON.stringify(value));
    const size = server.MAX_CONTENT_BYTES - overhead;
    value.padding = '界'.repeat(Math.floor(size / 3)) + 'x'.repeat(size % 3);
    assert.equal(JSON.stringify(value).length < server.MAX_CONTENT_BYTES, true);
    assert.equal(client.recoveryJsonUtf8Bytes(value), server.MAX_CONTENT_BYTES);
    assert.equal(server.jsonUtf8Bytes(value), server.MAX_CONTENT_BYTES);
    assert.equal(client.assertRecoveryContentCapacity(value), value);
    assert.equal(server.assertContentCapacity(value), value);
    value.ownerUid += 'x';
    assert.throws(() => client.assertRecoveryContentCapacity(value), capacity);
    assert.throws(() => server.assertContentCapacity(value), capacity);
    value.ownerUid = '界'; value.contentDigest += 'x';
    assert.throws(() => client.assertRecoveryContentCapacity(value), capacity);
    assert.throws(() => server.assertContentCapacity(value), capacity);
});

test('callable envelope accepts exactly 24 MiB and rejects one additional UTF-8 byte', () => {
    assert.equal(client.MAX_RECOVERY_CALLABLE_BODY_BYTES, 24 * 1024 * 1024);
    assert.equal(client.MAX_RECOVERY_CALLABLE_BODY_BYTES, server.MAX_CALLABLE_BODY_BYTES);
    const request = {action: 'finalize', operationId: 'o'.repeat(160), content: {text: ''}};
    const overhead = Buffer.byteLength(JSON.stringify({data: request}));
    request.content.text = 'x'.repeat(server.MAX_CALLABLE_BODY_BYTES - overhead);
    assert.equal(client.assertRecoveryCallableCapacity(request), request);
    assert.equal(server.assertCallableBodyCapacity(request), request);
    request.content.text += 'x';
    assert.throws(() => client.assertRecoveryCallableCapacity(request), capacity);
    assert.throws(() => server.assertCallableBodyCapacity(request), capacity);
});

test('maximum admitted content plus a full 2 MiB Base64 part fits the callable body', () => {
    const content = {text: ''}; content.text = 'x'.repeat(server.MAX_CONTENT_BYTES - server.jsonUtf8Bytes(content));
    const request = {action: 'uploadPart', operationId: 'o'.repeat(160), content, assetIndex: 9999, partIndex: 16,
        bytes: Buffer.alloc(server.PART_BYTES).toString('base64')};
    assert.equal(request.bytes.length, Math.ceil(server.PART_BYTES / 3) * 4);
    assert.ok(server.jsonUtf8Bytes({data: request}) < server.MAX_CALLABLE_BODY_BYTES);
    assert.doesNotThrow(() => client.assertRecoveryTransportAdmission(content, request.operationId, {security: {}}));
    assert.doesNotThrow(() => server.assertCallableBodyCapacity(request));
});

test('serialization failures return fixed codes without reflecting decoder or input text', () => {
    const circular = {}; circular.self = circular;
    for (const value of [circular, undefined, 1n, {toJSON() { throw new Error('RECOVERY_private arbitrary details'); }}]) {
        assert.throws(() => client.recoveryJsonUtf8Bytes(value), /^Error: RECOVERY_VALUE_INVALID$/);
        assert.throws(() => server.jsonUtf8Bytes(value), /^Error: FULL_RECOVERY_VALUE_INVALID$/);
    }
});
