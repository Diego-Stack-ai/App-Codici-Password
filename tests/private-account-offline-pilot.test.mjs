import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/private-account-offline-pilot.js', import.meta.url), 'utf8');
const modelSource = source
    .replace("import {createOfflineMutationClient} from './offline-mutation-client.js';", 'const createOfflineMutationClient = globalThis.__createClient;')
    .replace('globalThis.location?.search', 'globalThis.__pilotSearch');
globalThis.__pilotSearch = '';
globalThis.localStorage = (() => { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; })();
globalThis.__createClient = () => { throw new Error('non usato'); };
const pilot = await import(`data:text/javascript;base64,${Buffer.from(modelSource).toString('base64')}`);

test('il pilot si abilita soltanto con parametro esplicito', () => {
    assert.equal(pilot.isPrivateAccountPilotEnabled('?m6pilot=1'), true);
    assert.equal(pilot.isPrivateAccountPilotEnabled('?m6pilot=0'), false);
    assert.equal(pilot.isPrivateAccountPilotEnabled(''), false);
});

test('costruisce un comando revisionato e stabile nello scope utente', () => {
    const operation = pilot.buildPrivateAccountOperation({uid: 'owner', recordId: 'account-1', expectedRevision: 2, record: {type: 'account'}});
    assert.equal(operation.uid, 'owner');
    assert.equal(operation.recordId, 'account-1');
    assert.equal(operation.expectedRevision, 2);
    assert.match(operation.operationId, /^[a-f0-9-]+:[a-f0-9-]+$/i);
    assert.throws(() => pilot.buildPrivateAccountOperation({uid: '', recordId: 'x', expectedRevision: 0, record: {}}), /INVALID/);
});
