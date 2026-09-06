import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/request-coordinator.js', import.meta.url), 'utf8');
const {coalesceRead, clearPendingReads, pendingReadCount} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

beforeEach(clearPendingReads);

test('due letture contemporanee della stessa risorsa eseguono una sola operazione', async () => {
    let executions = 0;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const operation = async () => { executions += 1; await gate; return ['dato']; };
    const first = coalesceRead('accounts:uid-a', operation);
    const second = coalesceRead('accounts:uid-a', operation);
    assert.equal(first, second);
    assert.equal(pendingReadCount(), 1);
    release();
    assert.deepEqual(await first, ['dato']);
    assert.equal(executions, 1);
    assert.equal(pendingReadCount(), 0);
});

test('risorse diverse non vengono accorpate', async () => {
    assert.deepEqual(await Promise.all([
        coalesceRead('accounts:uid-a', async () => 'a'),
        coalesceRead('accounts:uid-b', async () => 'b')
    ]), ['a', 'b']);
});

test('un errore libera la chiave per il tentativo successivo', async () => {
    await assert.rejects(coalesceRead('companies:uid-a', async () => { throw new Error('rete'); }));
    assert.equal(pendingReadCount(), 0);
    assert.equal(await coalesceRead('companies:uid-a', async () => 'ok'), 'ok');
});
