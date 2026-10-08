import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachmentExportPlan as buildPlan, consumeAttachmentExport} from './attachment-export-plan.mjs';
// Browser ESM source lives under a CommonJS package; load unchanged source.
const source = readFileSync(new URL('../../Frontend/public/assets/js/modules/settings/backup-export-model.js', import.meta.url), 'utf8');
const {collectStoragePaths} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const attachmentExportPlan = (records, uid) => buildPlan(records, uid, collectStoragePaths);
const stageId = 'a'.repeat(64), restored = `users/u1/restoreObjects/${stageId}`;
const legacy = 'users/u1/attachments/a';

test('real collector deduplicates nested paths without losing published routing', () => {
  const records = [{data: {storagePath: restored, nested: [{storagePath: legacy}]}},
    {data: {attachments: [{storagePath: restored}, {storagePath: legacy}]}}];
  const before = structuredClone(records);
  const plan = attachmentExportPlan(records, 'u1');
  assert.deepEqual(plan, [{storagePath: legacy, route: {kind: 'legacy', storagePath: legacy}},
    {storagePath: restored, route: {kind: 'published', stageId}}]);
  assert.deepEqual(records, before);
  assert.ok(Object.isFrozen(plan) && plan.every(item => Object.isFrozen(item) && Object.isFrozen(item.route)));
});
test('invalid reserved path or foreign owner rejects complete plan', () => {
  for (const storagePath of ['users/u1/restoreObjects/bad', 'users/u2/attachments/a', 'users/u1/%61']) {
    assert.throws(() => attachmentExportPlan([{data: {storagePath: legacy}}, {data: {storagePath}}], 'u1'));
  }
});
test('empty records produce no attachment work', () => {
  assert.deepEqual(attachmentExportPlan([{data: {title: 'synthetic'}}], 'u1'), []);
});

test('candidate attachments round-trip through unchanged runtime encryption and chain verification', async () => {
  const cryptoSource = readFileSync(new URL('../../Frontend/public/assets/js/modules/settings/backup-crypto.js', import.meta.url), 'utf8');
  const api = await import(`data:text/javascript;base64,${Buffer.from(cryptoSource).toString('base64')}`);
  const header = api.createBackupHeader('u1'), key = await api.deriveBackupKey(header, api.generateRecoveryKey(), 'u1');
  const envelopes = [], buffers = [];
  let sequence = 0, previousDigest = '';
  const append = async entry => {
    const value = await api.encryptBackupEntry({header, key, sequence, previousDigest, entry});
    envelopes.push(value.envelope); previousDigest = value.digest; sequence++;
  };
  const read = async () => {const bytes = new Uint8Array([1, 2, 3]); buffers.push(bytes); return {bytes};};
  const count = await consumeAttachmentExport([{data: {attachments: [legacy, restored, restored].map(storagePath => ({storagePath}))}}], 'u1', {
    collectStoragePaths, isActive: () => true, readLegacy: read, readPublished: read,
    appendBytes: (storagePath, bytes) => append({kind: 'attachment', storagePath, content: Buffer.from(bytes).toString('base64')})
  });
  await assert.rejects(api.verifyBackupChain({header, key, envelopes}), /FOOTER/);
  await append({kind: 'footer', entryCount: sequence, recordCount: 0, attachmentCount: count});
  const verified = await api.verifyBackupChain({header, key, envelopes});
  assert.deepEqual(verified.entries.map(entry => [entry.storagePath, entry.content]), [[legacy, 'AQID'], [restored, 'AQID']]);
  assert.ok(buffers.every(bytes => bytes.every(value => value === 0)));
});

test('sequential consumption deduplicates, selects both readers and clears borrowed buffers', async () => {
  const buffers = [], calls = [], appended = [];
  const read = value => {calls.push(value); const bytes = new Uint8Array([7]); buffers.push(bytes); return {bytes};};
  const count = await consumeAttachmentExport([{data: {attachments: [legacy, restored, legacy].map(storagePath => ({storagePath}))}}], 'u1', {
    collectStoragePaths, isActive: () => true, readLegacy: read, readPublished: read,
    appendBytes: async (path, bytes) => {appended.push([path, [...bytes]]);}
  });
  assert.equal(count, 2); assert.deepEqual(calls, [legacy, stageId]);
  assert.deepEqual(appended, [[legacy, [7]], [restored, [7]]]);
  assert.ok(buffers.every(bytes => bytes[0] === 0));
});

test('revocation after read or append failure clears bytes and stops subsequent reads', async () => {
  for (const mode of ['revoked', 'append-error']) {
    let active = true, reads = 0, appends = 0;
    const bytes = new Uint8Array([9]);
    const read = async () => {reads++; if (mode === 'revoked') active = false; return {bytes};};
    await assert.rejects(consumeAttachmentExport([{data: {attachments: [legacy, restored].map(storagePath => ({storagePath}))}}], 'u1', {
      collectStoragePaths, isActive: () => active, readLegacy: read, readPublished: read,
      appendBytes: async () => {appends++; throw new Error('APPEND_FAILED');}
    }), mode === 'revoked' ? /SESSION_INACTIVE/ : /APPEND_FAILED/);
    assert.equal(reads, 1); assert.equal(appends, mode === 'revoked' ? 0 : 1); assert.equal(bytes[0], 0);
  }
});
