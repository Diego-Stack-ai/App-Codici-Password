import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/private-account-offline-pilot.js', import.meta.url), 'utf8');
// Da un `data:` URL uno specifier **relativo** non è risolvibile: la riesportazione del trigger di
// upgrade viene quindi sostituita da uno stub, mentre il percorso reale del trigger è provato sul
// modulo `private-account-pilot-queue.js` (prove Node dedicate e banco browser con IndexedDB reale).
const TRIGGER_EXPORT = "export {inspectPrivateAccountPilotQueue, upgradePrivateAccountPilotQueue} from './private-account-pilot-queue.js';";
const modelSource = source
    .replace("import {createOfflineMutationClient} from './offline-mutation-client.js';", 'const createOfflineMutationClient = globalThis.__createClient;')
    .replace(TRIGGER_EXPORT, 'export const inspectPrivateAccountPilotQueue = globalThis.__inspectTrigger;\nexport const upgradePrivateAccountPilotQueue = globalThis.__upgradeTrigger;')
    .replace('globalThis.location?.search', 'globalThis.__pilotSearch');
assert.notEqual(modelSource.includes(TRIGGER_EXPORT), true, 'la riesportazione va sostituita per il data: URL');
globalThis.__pilotSearch = '';
globalThis.__inspectTrigger = () => { throw new Error('non usato'); };
globalThis.__upgradeTrigger = () => { throw new Error('non usato'); };
globalThis.localStorage = (() => { const values = new Map(); return {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)}; })();
globalThis.sessionStorage = (() => { const values = new Map(); return {
  getItem: key => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
}; })();
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

test('consegna alla lista soltanto il record cifrato dello stesso utente e una sola volta', () => {
    const record = {_encrypted: true, nomeAccount: 'Prova', password: 'ciphertext'};
    pilot.storePrivateAccountHandoff({uid: 'owner', recordId: 'account-2', expectedRevision: 4, record});
    assert.equal(pilot.consumePrivateAccountHandoff('other'), null);
    const restored = pilot.consumePrivateAccountHandoff('owner');
    assert.equal(restored.id, 'account-2');
    assert.equal(restored.revision, 5);
    assert.equal(restored.password, 'ciphertext');
    assert.equal(pilot.consumePrivateAccountHandoff('owner'), null);
    assert.throws(() => pilot.storePrivateAccountHandoff({uid: 'owner', recordId: 'x', expectedRevision: 0, record: {password: 'plain'}}), /INVALID/);
});

test('il pilota riesporta il trigger di upgrade e non lo avvia da sé', () => {
    // La sorgente reale deve contenere la riesportazione (il percorso effettivo del trigger è
    // provato sul modulo dedicato), e il modulo caricato non deve invocarla al montaggio.
    assert.equal(source.includes(TRIGGER_EXPORT), true);
    assert.equal(typeof pilot.upgradePrivateAccountPilotQueue, 'function');
    assert.equal(typeof pilot.inspectPrivateAccountPilotQueue, 'function');
    assert.throws(() => pilot.upgradePrivateAccountPilotQueue({uid: 'owner'}), /non usato/, 'il trigger non deve essere chiamato dal montaggio');
});
