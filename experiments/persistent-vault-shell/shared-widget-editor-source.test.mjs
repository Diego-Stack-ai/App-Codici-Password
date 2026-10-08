import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSharedWidgetEditorSource} from './shared-widget-editor-source.mjs';
function fixture(overrides = {}) {
  const abort = new AbortController(), sent = [];
  const widget = {id: 'w', kind: 'shared-reference', context: 'private', accountId: 'a', sharedDataId: 's', linkId: 'l'};
  const link = {id: 'l', context: 'private', accountId: 'a', sharedDataId: 's', widgetId: 'w'};
  const data = {id: 's', revision: 2, title: 'Common', fields: [{id: 'f', type: 'sensitive', label: 'Secret', encrypted: true, valueEnc: 'cipher:old'}]};
  const context = {user: {uid: 'synthetic'}, signal: abort.signal, assertUnlocked() {},
    read: async () => 'old', encrypt: async value => `cipher:${value}`};
  const source = createSharedWidgetEditorSource({context, getUser: () => ({uid: 'synthetic'}),
    account: {context: 'private', accountId: 'a'}, readAccount: async () => ({}),
    listWidgets: async () => [widget], listLinks: async () => [link], listShared: async () => [data],
    prepare: async (draft, encrypt) => ({title: draft.title, fields: await Promise.all(draft.fields.map(async field =>
      ({id: field.id, label: field.label, encrypted: true, valueEnc: await encrypt(field.value)})))}),
    isEncryptedValue: value => value.startsWith('cipher:'), isOnline: () => true,
    submit: async command => {sent.push(command); return {status: 'applied'};}, ...overrides});
  return {source, abort, sent, widget, link, data, context};
}

test('shared editor uses real field preparation and crypto without leaking cleartext to the command', async () => {
  const load = async path => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, import.meta.url), 'utf8')).toString('base64')}`);
  const cryptoApi = await load('../../Frontend/public/assets/js/modules/core/crypto-utils.js');
  const model = await load('../../Frontend/public/assets/js/modules/data/shared-vault-data-model.js');
  const key = cryptoApi.generateVaultKey();
  const f = fixture({prepare: model.prepareSharedVaultData, isEncryptedValue: cryptoApi.isEncryptedValue});
  f.context.read = async record => cryptoApi.decrypt(record.ciphertext, key);
  f.context.encrypt = async value => cryptoApi.encrypt(value, key);
  f.data.fields[0].valueEnc = await cryptoApi.encrypt('SYNTHETIC-OLD', key);
  const draft = await f.source.load('w');
  assert.equal(draft.fields[0].value, 'SYNTHETIC-OLD');
  draft.fields[0].value = 'SYNTHETIC-NEW';
  const plan = await f.source.prepare(draft);
  await f.source.send(plan);
  assert.equal(JSON.stringify(f.sent[0]).includes('SYNTHETIC-NEW'), false);
  const field = f.sent[0].data.fields[0];
  assert.equal(await cryptoApi.decrypt(field.valueEnc, key), 'SYNTHETIC-NEW');
  assert.equal(field.copyable, false); assert.equal(field.includeInQr, false);
  assert.equal(field.preview, false); assert.equal(field.encrypted, true);
  f.source.dispose();
});
test('shared update preserves trusted identity/revision and supports exact encrypted retry', async () => {
  const f = fixture(), draft = await f.source.load('w');
  draft.id = 'forged'; draft.revision = 100; draft.fields[0].label = 'forged'; draft.fields[0].value = 'new';
  const plan = await f.source.prepare(draft); await f.source.send(plan); await f.source.send(plan);
  assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(f.sent[0].sharedDataId, 's');
  assert.equal(f.sent[0].expectedRevision, 2); assert.equal(f.sent[0].data.fields[0].label, 'Secret');
  assert.equal(f.sent[0].data.fields[0].valueEnc, 'cipher:new'); assert.equal(f.source.prepareDelete, undefined);
  f.abort.abort(); await assert.rejects(f.source.send(plan), /DISPOSED/);
});

test('shared preparation captures the draft before asynchronous confirmed reads', async () => {
  let release, pause = false;
  const f = fixture({readAccount: async () => {
    if (pause) await new Promise(resolve => {release = resolve;}); return {};
  }});
  const draft = await f.source.load('w'); draft.fields[0].value = 'captured';
  pause = true;
  const pending = f.source.prepare(draft);
  draft.title = 'late substitution'; draft.fields[0].value = 'late substitution';
  release();
  const plan = await pending; await f.source.send(plan);
  assert.equal(f.sent[0].data.title, 'Common');
  assert.equal(f.sent[0].data.fields[0].valueEnc, 'cipher:captured');
  f.source.dispose();
});
test('shared editor rejects inconsistent links, banking placement and changed revisions', async () => {
  for (const mutate of [f => {f.link.widgetId = 'other';}, f => {f.link.accountId = 'other';},
    f => {f.widget.bankId = 'bank';}, f => {f.data.revision = undefined;}, f => {f.data.ownerId = 'other';}]) {
    const f = fixture(); mutate(f); await assert.rejects(f.source.load('w'), /UNAVAILABLE/); f.source.dispose();
  }
  const f = fixture(), draft = await f.source.load('w'); f.data.revision++;
  await assert.rejects(f.source.prepare(draft), /CHANGED/); assert.equal(f.sent.length, 0); f.source.dispose();
});
test('shared editor discards late decrypted content after link change or lock', async () => {
  for (const mutate of [f => {f.link.sharedDataId = 'other';}, f => {f.abort.abort();}]) {
    const f = fixture(); f.context.read = async () => {mutate(f); return 'old';};
    await assert.rejects(f.source.load('w'), /UNAVAILABLE|DISPOSED/); assert.equal(f.sent.length, 0); f.source.dispose();
  }
});

test('unlink captures this exact pair and revision without touching shared content; retries remain identical', async () => {
  const f = fixture(); await f.source.load('w');
  f.context.encrypt = async () => {throw Error('must not encrypt while unlinking');};
  const plan = await f.source.prepareUnlink();
  await f.source.send(plan); await f.source.send(plan);
  assert.deepEqual(f.sent[0], f.sent[1]);
  assert.deepEqual({...f.sent[0], operationId: 'opaque'}, {expectedOwnerUid: 'synthetic', operationId: 'opaque',
    action: 'unlink', sharedDataId: 's', expectedRevision: 2, linkId: 'l', widgetId: 'w',
    link: {context: 'private', accountId: 'a'}});
  f.source.dispose(); await assert.rejects(f.source.send(plan), /DISPOSED/);
});

test('unlink refuses changed revision or link before any request', async () => {
  for (const mutate of [f => {f.data.revision++;}, f => {f.link.widgetId = 'other';}]) {
    const f = fixture(); await f.source.load('w'); mutate(f);
    await assert.rejects(f.source.prepareUnlink(), /CHANGED|UNAVAILABLE/);
    assert.equal(f.sent.length, 0); f.source.dispose();
  }
});
