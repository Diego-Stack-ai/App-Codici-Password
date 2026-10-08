import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAccountWidgetWriteCapability, createSessionAccountWidgetWriter} from './account-widget-write-capability.mjs';
function fixture(extra = {}) {
  const controller = new AbortController(), sent = [];
  let uid = 'synthetic', online = true;
  const capability = createAccountWidgetWriteCapability({
    context: {user: {uid}, signal: controller.signal, assertUnlocked() {}}, getUser: () => ({uid}),
    account: {context: 'private', accountId: 'a'}, isOnline: () => online,
    operationId: () => 'stable-op', encrypt: async () => 'synthetic-cipher',
    prepare: async (data, account, encrypt) => ({title: data.title, valueEnc: await encrypt(data.secret)}),
    submit: async command => {sent.push(command); return {status: 'applied'};}, ...extra
  });
  return {capability, sent, controller, changeUser: () => {uid = 'other';}, offline: () => {online = false;}};
}
const draft = {action: 'create', widgetId: 'w', data: {title: 'Synthetic', secret: 'synthetic-plain'}};
test('failed transport retries the same command without repeating encryption', async () => {
  const calls = []; let encryptions = 0;
  const f = fixture({encrypt: async () => {encryptions++; return 'synthetic-cipher';}, submit: async command => {
    calls.push(command); if (calls.length === 1) throw Error('synthetic-response-lost'); return {status: 'applied', duplicate: true};
  }});
  const plan = await f.capability.prepare(draft);
  await assert.rejects(f.capability.send(plan), /response-lost/);
  assert.equal((await f.capability.send(plan)).duplicate, true);
  assert.deepEqual(calls[0], calls[1]); assert.equal(encryptions, 1);
});
test('session adapter rejects plaintext and malformed cipher before any transport', async () => {
  for (const output of ['synthetic-plain', '', '--ERRORE--']) {
    let sends = 0;
    const writer = createSessionAccountWidgetWriter({context: {user: {uid: 'synthetic'}, signal: new AbortController().signal,
      assertUnlocked() {}, encrypt: async () => output}, getUser: () => ({uid: 'synthetic'}),
      account: {context: 'private', accountId: 'a'}, isOnline: () => true,
      isEncryptedValue: value => value === 'valid-cipher',
      prepare: async (data, account, encrypt) => ({valueEnc: await encrypt(data.secret)}),
      submit: async () => {sends++;}});
    await assert.rejects(writer.prepare(draft), /WIDGET_CIPHER_INVALID/); assert.equal(sends, 0);
  }
});
test('existing application model prepares sensitive fields and company identity', async () => {
  const source = readFileSync(new URL('../../Frontend/public/assets/js/modules/data/shared-vault-data-model.js', import.meta.url), 'utf8');
  const {prepareEmbeddedAccountWidget} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const f = fixture({prepare: prepareEmbeddedAccountWidget, account: {context: 'company', accountId: 'a', companyId: 'c'}});
  const plan = await f.capability.prepare({action: 'update', widgetId: 'w', expectedRevision: 3,
    data: {title: 'Synthetic', fields: [{id: 'f', label: 'Secret', type: 'sensitive', value: 'synthetic-plain'}]}});
  await f.capability.send(plan);
  const command = f.sent[0];
  assert.equal(command.companyId, 'c'); assert.equal(command.expectedRevision, 3);
  assert.equal(command.data.fields[0].value, undefined);
  assert.equal(command.data.fields[0].valueEnc, 'synthetic-cipher');
});
test('late response after session disposal cannot be presented as current success', async () => {
  let finish;
  const f = fixture({submit: () => new Promise(resolve => {finish = resolve;})});
  const plan = await f.capability.prepare(draft), pending = f.capability.send(plan);
  await assert.rejects(f.capability.send(plan), /SEND_PENDING/);
  f.controller.abort(); finish({status: 'applied'});
  await assert.rejects(pending, /VIEW_DISPOSED/);
  // A rejected late response does not imply rollback of the server mutation.
});
test('opaque plans preserve prepared payload and retry identity, never send draft secrets', async () => {
  const f = fixture(), input = structuredClone(draft), plan = await f.capability.prepare(input);
  input.data.title = 'changed';
  await f.capability.send(plan); await f.capability.send(plan);
  assert.deepEqual(f.sent[0], f.sent[1]);
  assert.equal(f.sent[0].data.title, 'Synthetic');
  assert.equal(JSON.stringify(f.sent).includes('synthetic-plain'), false);
  await assert.rejects(f.capability.send({...plan}), /WIDGET_PLAN_INVALID/);
});
test('lock and owner change during encryption prohibit sending', async () => {
  for (const mode of ['lock', 'owner']) {
    let finish;
    const f = fixture({encrypt: () => new Promise(resolve => {finish = resolve;})});
    const pending = f.capability.prepare(draft);
    if (mode === 'lock') f.controller.abort(); else f.changeUser();
    finish('synthetic-cipher');
    await assert.rejects(pending, /VIEW_DISPOSED|AUTH_CHANGED/);
    assert.equal(f.sent.length, 0);
  }
});
test('offline/disposed plans fail and deletion requires a revision without encryption', async () => {
  const f = fixture({encrypt: () => {throw Error('must not encrypt deletion');}});
  await assert.rejects(f.capability.prepare({action: 'delete', widgetId: 'w'}), /REVISION/);
  const plan = await f.capability.prepare({action: 'delete', widgetId: 'w', expectedRevision: 2});
  await f.capability.send(plan); assert.equal(f.sent[0].data, undefined);
  f.offline(); await assert.rejects(f.capability.send(plan), /ONLINE/);
  f.capability.dispose(); await assert.rejects(f.capability.send(plan), /DISPOSED/);
});
