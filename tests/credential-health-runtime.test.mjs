import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

globalThis.crypto ??= webcrypto;

async function loadModel() {
    const source = await readFile('Frontend/public/assets/js/modules/settings/credential-health-model.js', 'utf8');
    const result = await build({
        stdin: {contents: source, loader: 'js'}, bundle: true,
        format: 'esm', platform: 'browser', write: false
    });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('il runtime restituisce soltanto identificatore e flag di rischio', async () => {
    const {analyzeCredentialHealth} = await loadModel();
    const now = Date.parse('2026-09-08T00:00:00Z');
    const results = await analyzeCredentialHealth([
        {id: 'a', password: 'password', updatedAt: now},
        {id: 'b', password: 'Forte#Fixture123', updatedAt: '2025-01-01T00:00:00Z'},
        {id: 'c', password: 'Forte#Fixture123', updatedAt: now}
    ], {now, sessionKey: new Uint8Array(32).fill(7)});
    assert.deepEqual(results, [
        {recordId: 'a', flags: ['weak']},
        {recordId: 'b', flags: ['dated', 'duplicate']},
        {recordId: 'c', flags: ['duplicate']}
    ]);
    assert.equal(JSON.stringify(results).includes('Fixture123'), false);
});

test('la chiave HMAC di sessione non compare nei risultati', async () => {
    const {analyzeCredentialHealth} = await loadModel();
    const results = await analyzeCredentialHealth([{id: 'a', password: 'Aa#123456789'}]);
    assert.deepEqual(Object.keys(results[0]), ['recordId', 'flags']);
});

