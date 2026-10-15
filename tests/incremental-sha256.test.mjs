import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IncrementalSha256, hashReadableStream } from '../Frontend/public/assets/js/modules/assistant/incremental-sha256.js';

const hex = buffer => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('');

test('SHA-256 incrementale coincide con Web Crypto su chunk irregolari', async () => {
    const data = new TextEncoder().encode('abc'.repeat(100_003));
    const expected = hex(await webcrypto.subtle.digest('SHA-256', data));
    const hash = new IncrementalSha256();
    for (let offset = 0; offset < data.length; offset += 7919) hash.update(data.subarray(offset, offset + 7919));
    assert.equal(hash.digestHex(), expected);
});

test('lo stream mantiene un solo chunk applicativo e rispetta il budget sintetico', async () => {
    const chunkBytes = 64 * 1024;
    const chunks = 128;
    const payload = new Uint8Array(chunkBytes); payload.fill(0xa5);
    let emitted = 0;
    const stream = new ReadableStream({
        pull(controller) {
            if (emitted++ >= chunks) controller.close();
            else controller.enqueue(payload.slice());
        }
    });
    const started = performance.now();
    const result = await hashReadableStream(stream);
    assert.equal(result.bytes, chunkBytes * chunks);
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    assert.ok(performance.now() - started < 5000, 'hash sintetico 8 MiB oltre 5 secondi');
});
