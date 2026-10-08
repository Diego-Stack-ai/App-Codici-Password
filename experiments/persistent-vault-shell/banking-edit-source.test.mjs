import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBankingEditSource} from './banking-edit-source.mjs';
const cipher = value => Buffer.alloc(48, value.charCodeAt(0)).toString('base64');
test('bank source encrypts secrets, preserves identity and freezes drafts/retries', async () => {
  const abort = new AbortController(), sent = [];
  const record = {ownerId: 'synthetic', id: 'a', revision: 2, banking: [{bankId: 'bank', passwordDispositiva: cipher('Old'), iban: 'IBAN'}]};
  const source = createBankingEditSource({context: {user: {uid: 'synthetic'}, signal: abort.signal, assertUnlocked() {},
    read: async () => 'Old', encrypt: async value => cipher(value)}, getUser: () => ({uid: 'synthetic'}),
    account: {domain: 'private', id: 'a'}, bankId: 'bank', readRecord: async () => structuredClone(record),
    hash: value => createHash('sha256').update(value).digest('hex'), isEncryptedValue: value => typeof value === 'string' && value.length >= 60,
    isOnline: () => true, submit: async request => {sent.push(request); if (sent.length === 1) throw Error('lost'); return {status: 'confirmed'};}});
  assert.equal((await source.load()).passwordDispositiva, 'Old');
  const draft = {passwordDispositiva: 'New'}, pending = source.prepare(draft); draft.passwordDispositiva = 'Changed';
  const plan = await pending; await assert.rejects(source.send(plan), /lost/); await source.send(plan);
  assert.equal(sent[0].patch.passwordDispositiva, cipher('New')); assert.deepEqual(sent[0], sent[1]);
  assert.equal(sent[0].bankId, 'bank'); assert.equal(sent[0].expectedRevision, 2);
  record.revision++; await assert.rejects(source.prepare({iban: 'new'}), /CONFLICT/);
  abort.abort(); await assert.rejects(source.send(plan), /DISPOSED/);
});
