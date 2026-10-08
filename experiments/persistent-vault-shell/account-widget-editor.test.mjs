import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountWidgetEditorSource} from './account-widget-editor-source.mjs';
import {mountAccountWidgetEditor} from './account-widget-editor-view.mjs';
import {mountAccountWidgetCreate} from './account-widget-create-view.mjs';
function fixture(overrides = {}) {
  const abort = new AbortController(), sent = [];
  const row = {id: 'w', kind: 'embedded', context: 'private', accountId: 'a', revision: 2, title: 'Before', color: '#123456',
    fields: [{id: 'f', label: 'Secret', type: 'sensitive', encrypted: true, valueEnc: 'cipher:old', order: 4}]};
  const context = {user: {uid: 'u'}, signal: abort.signal, assertUnlocked() {}, read: async () => 'old', encrypt: async value => `cipher:${value}`};
  const source = createAccountWidgetEditorSource({context, getUser: () => ({uid: 'u'}), account: {context: 'private', accountId: 'a'},
    readAccount: async () => ({}), listConfirmed: async () => [row], isOnline: () => true, isEncryptedValue: value => value.startsWith('cipher:'),
    prepare: async (data, account, encrypt) => ({...data, fields: await Promise.all(data.fields.map(async field => {
      const next = {...field, valueEnc: await encrypt(field.value)}; delete next.value; return next;
    }))}), submit: async command => {sent.push(command); return {status: 'applied'};}, ...overrides});
  return {source, row, context, abort, sent};
}
test('editor preserves trusted metadata and revision while encrypting edited values', async () => {
  const f = fixture(), data = await f.source.load('w');
  data.title = 'After'; data.color = '#ffffff'; data.fields[0].label = 'tampered'; data.fields[0].value = 'new';
  await f.source.send(await f.source.prepare(data));
  const command = f.sent[0];
  assert.equal(command.expectedRevision, 2); assert.equal(command.data.color, '#123456');
  assert.equal(command.data.fields[0].label, 'Secret'); assert.equal(command.data.fields[0].valueEnc, 'cipher:new');
  f.source.dispose();
});
test('changed snapshot and aborted session cannot prepare a write', async () => {
  const f = fixture(), data = await f.source.load('w'); f.row.revision++;
  await assert.rejects(f.source.prepare(data), /WIDGET_CHANGED/);
  f.abort.abort(); await assert.rejects(f.source.load('w'), /DISPOSED/); assert.equal(f.sent.length, 0);
});

test('editor rejects missing, archived, foreign and ambiguous confirmed records', async () => {
  for (const parent of [null, {isArchived: true}, {ownerId: 'other'}]) {
    const f = fixture({readAccount: async () => parent});
    await assert.rejects(f.source.load('w'), /WIDGET_ACCOUNT_UNAVAILABLE/);
    assert.equal(f.sent.length, 0); f.source.dispose();
  }
  for (const patch of [{kind: 'shared'}, {context: 'company'}, {accountId: 'other'}, {companyId: 'other'},
    {isArchived: true}, {bankId: 'bank'}, {revision: undefined}, {revision: 0}, {revision: 1.5}, {fields: null}]) {
    const f = fixture(); Object.assign(f.row, patch);
    await assert.rejects(f.source.load('w'), /WIDGET_UNAVAILABLE/);
    assert.equal(f.sent.length, 0); f.source.dispose();
  }
  for (const rows of [[], [{id: 'w'}, {id: 'w'}]]) {
    const f = fixture({listConfirmed: async () => rows});
    await assert.rejects(f.source.load('w'), /WIDGET_UNAVAILABLE/); f.source.dispose();
  }
});

test('editor refuses failed decryption and changes during decryption', async () => {
  for (const value of ['cipher:old', '--ERRORE--', null]) {
    const f = fixture(); f.context.read = async () => value;
    await assert.rejects(f.source.load('w'), /WIDGET_DECRYPT_FAILED/);
    await assert.rejects(f.source.prepare({fields: []}), /WIDGET_NOT_LOADED/); f.source.dispose();
  }
  const f = fixture(); f.context.read = async () => {f.row.revision++; return 'old';};
  await assert.rejects(f.source.load('w'), /WIDGET_CHANGED/); assert.equal(f.sent.length, 0); f.source.dispose();
});

test('company editor retains exact placement and rejects field identity replacement', async () => {
  const f = fixture({account: {context: 'company', accountId: 'a', companyId: 'c'}});
  Object.assign(f.row, {context: 'company', companyId: 'c'});
  const data = await f.source.load('w');
  data.fields[0].id = 'other'; await assert.rejects(f.source.prepare(data), /WIDGET_FIELDS_CHANGED/);
  data.fields[0].id = 'f'; data.accountId = 'other'; data.companyId = 'other';
  await f.source.send(await f.source.prepare(data));
  assert.equal(f.sent[0].accountId, 'a'); assert.equal(f.sent[0].companyId, 'c');
  assert.equal(f.sent[0].data.accountId, 'a'); assert.equal(f.sent[0].data.companyId, 'c'); f.source.dispose();
});
test('bank widget editor binds one canonical bank for create, update and delete', async () => {
  const parent = {banking: [{bankId: 'bank-a'}, {bankId: 'bank-b'}]};
  const f = fixture({account: {context: 'private', accountId: 'a', bankId: 'bank-a'}, readAccount: async () => parent});
  f.row.bankId = 'bank-a';
  const data = await f.source.load('w'); data.bankId = 'bank-b';
  await f.source.send(await f.source.prepare(data));
  assert.equal(f.sent[0].data.bankId, 'bank-a');
  await f.source.send(await f.source.prepareCreate(data));
  assert.equal(f.sent[1].data.bankId, 'bank-a');
  await f.source.send(await f.source.prepareDelete()); assert.equal(f.sent[2].action, 'delete');
  parent.banking = [{bankId: 'bank-b'}];
  await assert.rejects(f.source.prepare(data), /BANK_UNAVAILABLE/);
  await assert.rejects(f.source.prepareCreate(data), /BANK_UNAVAILABLE/);
  await assert.rejects(f.source.prepareDelete(), /BANK_UNAVAILABLE/); f.source.dispose();
});
test('bank widget editor refuses another bank and duplicate canonical bank identity', async () => {
  for (const banking of [[{bankId: 'bank-a'}], [{bankId: 'bank-a'}, {bankId: 'bank-a'}]]) {
    const f = fixture({account: {context: 'private', accountId: 'a', bankId: 'bank-a'}, readAccount: async () => ({banking})});
    f.row.bankId = 'bank-b';
    await assert.rejects(f.source.load('w'), /WIDGET_UNAVAILABLE|BANK_UNAVAILABLE/); f.source.dispose();
  }
});
class Node extends EventTarget {
  constructor(tag) {super(); this.tag = tag; this.children = []; this.value = '';}
  append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
  remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
  setAttribute() {}
  all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
test('generic creation encrypts fields, rejects parent changes and strips injected ownership', async () => {
  const f = fixture();
  const draft = {title: 'New', bankId: 'forged', revision: 40, accountId: 'other',
    fields: [{id: 'f', label: 'Secret', type: 'sensitive', value: 'new'}]};
  const plan = await f.source.prepareCreate(draft); await f.source.send(plan);
  assert.equal(f.sent[0].action, 'create'); assert.equal(f.sent[0].accountId, 'a');
  assert.equal(f.sent[0].data.bankId, undefined); assert.equal(f.sent[0].data.revision, undefined);
  assert.equal(f.sent[0].data.fields[0].valueEnc, 'cipher:new'); f.source.dispose();
  const archived = fixture({readAccount: async () => ({isArchived: true})});
  await assert.rejects(archived.source.prepareCreate(draft), /ACCOUNT_UNAVAILABLE/); archived.source.dispose();
});
test('creation masks drafts, wipes on preparation and retries the same plan', async () => {
  const root = new Node('root'), abort = new AbortController(), sent = [], drafts = [], plan = {};
  const source = {prepareCreate: async data => {drafts.push(data); return plan;},
    send: async value => {sent.push(value); if (sent.length === 1) throw Error('lost');}, dispose() {}};
  mountAccountWidgetCreate(root, {signal: abort.signal, assertUnlocked() {}}, {source});
  const inputs = root.all('input'); inputs[0].value = 'Title'; inputs[1].value = 'Secret'; inputs[2].value = 'synthetic';
  assert.equal(inputs[2].type, 'password'); assert.equal(inputs[3].checked, true);
  const save = root.all('button').find(node => node.textContent === 'Crea widget');
  save.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(drafts[0].fields[0].type, 'sensitive'); assert.ok(inputs.every(node => node.value === ''));
  save.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(drafts.length, 1); assert.deepEqual(sent, [plan, plan]); assert.equal(root.children.length, 0);
});
test('delete requires confirmation, keeps revision, retries one request and never encrypts a draft', async () => {
  const f = fixture(), root = new Node('root'); let attempts = 0;
  const send = f.source.send;
  const source = {...f.source, send: async plan => {await send(plan); if (++attempts === 1) throw Error('lost response');}};
  await mountAccountWidgetEditor(root, f.context, {source, widgetId: 'w'});
  const remove = root.all('button').find(node => node.textContent === 'Elimina widget');
  remove.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.sent.length, 0);
  remove.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].action, 'delete');
  assert.equal(f.sent[0].expectedRevision, 2); assert.equal(f.sent[0].data, undefined);
  assert.ok(root.all('input').every(node => node.value === ''));
  root.all('button')[0].dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.sent.length, 1);
  remove.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.sent[0], f.sent[1]); assert.equal(root.children.length, 0);
});
test('delete rejects changed or locked widget before sending', async () => {
  const f = fixture(); await f.source.load('w'); f.row.revision++;
  await assert.rejects(f.source.prepareDelete(), /WIDGET_CHANGED/);
  f.abort.abort(); await assert.rejects(f.source.prepareDelete(), /DISPOSED/);
  assert.equal(f.sent.length, 0);
});

test('shared unlink has distinct confirmation, retains one retry plan and never invokes delete', async () => {
  const root = new Node('root'), abort = new AbortController(), plan = {}, sent = [];
  let prepared = 0;
  const source = {load: async () => ({title: 'Common', fields: []}),
    prepareUnlink: async () => {prepared++; return plan;},
    prepareDelete: () => {throw Error('must not delete common data');},
    send: async value => {sent.push(value); if (sent.length === 1) throw Error('lost response');}, dispose() {}};
  await mountAccountWidgetEditor(root, {signal: abort.signal, assertUnlocked() {}}, {source, widgetId: 'w'});
  const button = root.all('button').find(node => node.textContent === 'Scollega da questo Account');
  assert.ok(button);
  button.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(prepared, 0); assert.equal(button.textContent, 'Conferma scollegamento');
  assert.match(root.all('p')[0].textContent, /altri collegamenti resteranno/);
  button.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.match(root.all('p')[0].textContent, /Scollegamento non confermato/);
  assert.ok(root.all('input').every(input => input.value === ''));
  button.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(prepared, 1); assert.deepEqual(sent, [plan, plan]); assert.equal(root.children.length, 0);
});
test('numeric empty or nonfinite draft is rejected without coercing it to zero', async () => {
  const root = new Node('root'), abort = new AbortController(), prepared = [];
  const context = {signal: abort.signal, assertUnlocked() {}};
  const source = {load: async () => ({title: 'Numbers', fields: [{id: 'n', label: 'Number', value: 12}]}),
    prepare: async data => {prepared.push(data); return {};}, send: async () => {}, dispose() {}};
  await mountAccountWidgetEditor(root, context, {source, widgetId: 'w'});
  const input = root.all('input')[1], save = root.all('button')[0];
  for (const value of ['', '   ', 'Infinity', 'not-a-number']) {
    input.value = value; save.dispatchEvent(new Event('click'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(prepared.length, 0); assert.equal(save.disabled, false);
    assert.match(root.all('p')[0].textContent, /numero valido/);
  }
  input.value = '0'; save.dispatchEvent(new Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prepared.length, 1); assert.equal(prepared[0].fields[0].value, 0);
});

test('unconfirmed save retries the same plan without preparing or sending twice concurrently', async () => {
  const root = new Node('root'), abort = new AbortController(), plan = {}, sent = [];
  let preparations = 0, rejectFirst;
  const source = {load: async () => ({title: 'Retry', fields: []}),
    prepare: async () => {preparations++; return plan;},
    send: async value => {sent.push(value); if (sent.length === 1) await new Promise((resolve, reject) => {rejectFirst = reject;});}, dispose() {}};
  await mountAccountWidgetEditor(root, {signal: abort.signal, assertUnlocked() {}}, {source, widgetId: 'w'});
  const save = root.all('button')[0], title = root.all('input')[0];
  save.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  save.dispatchEvent(new Event('click')); assert.equal(sent.length, 1);
  assert.equal(title.value, ''); assert.equal(title.disabled, true);
  rejectFirst(new Error('synthetic lost response')); await new Promise(resolve => setImmediate(resolve));
  assert.match(root.all('p')[0].textContent, /Esito non confermato/);
  save.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(preparations, 1); assert.deepEqual(sent, [plan, plan]); assert.equal(root.children.length, 0);
});
test('mounted editor masks secrets and clears retained input nodes on lock', async () => {
  const f = fixture(), root = new Node('root');
  await mountAccountWidgetEditor(root, f.context, {source: f.source, widgetId: 'w'});
  const inputs = root.all('input'); assert.equal(inputs[1].type, 'password'); assert.equal(inputs[1].value, 'old');
  f.abort.abort(); assert.equal(root.children.length, 0); assert.ok(inputs.every(input => input.value === ''));
});
test('mounted editor saves and clears draft before completion', async () => {
  const f = fixture(), root = new Node('root'); let saved = false;
  await mountAccountWidgetEditor(root, f.context, {source: f.source, widgetId: 'w', onSaved: () => {saved = true;}});
  const inputs = root.all('input'); inputs[1].value = 'new';
  root.all('button')[0].dispatchEvent(new Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(saved, true); assert.equal(f.sent.length, 1); assert.ok(inputs.every(input => input.value === ''));
});
