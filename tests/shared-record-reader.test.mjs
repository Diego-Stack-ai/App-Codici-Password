import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/data/shared-record-reader.js', import.meta.url), 'utf8');
const {readMigratingRecord, SHARED_RECORD_READER_ENABLED} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const descriptor = migrationState => ({migrationState, recordId: 'record-1'});
const bundle = overrides => ({
  schemaVersion: 2,
  cryptoProtocol: 'record-key-v1',
  recordId: 'record-1',
  keyGeneration: 3,
  grant: {recordId: 'record-1', recipientId: 'user-1', keyGeneration: 3, status: 'active'},
  ...overrides
});

test('il doppio lettore è disattivato per impostazione predefinita', async () => {
  assert.equal(SHARED_RECORD_READER_ENABLED, false);
  let sharedReads = 0;
  const result = await readMigratingRecord({
    descriptor: descriptor('dual-read'), recipientId: 'user-1',
    loadLegacy: async () => ({id: 'legacy'}),
    loadShared: async () => { sharedReads += 1; return bundle(); },
    decryptShared: async () => ({id: 'shared'})
  });
  assert.equal(sharedReads, 0);
  assert.deepEqual(result, {source: 'legacy', record: {id: 'legacy'}});
});

test('dual-read confronta i due formati prima di usare record-key', async () => {
  const result = await readMigratingRecord({
    descriptor: descriptor('dual-read'), recipientId: 'user-1', enabled: true,
    loadLegacy: async () => ({title: 'uguale'}), loadShared: async () => bundle(),
    decryptShared: async () => ({title: 'uguale'}),
    compareRecords: (legacy, shared) => legacy.title === shared.title
  });
  assert.equal(result.source, 'record-key');
});

test('fallback legacy avviene soltanto per record schema 2 assente', async () => {
  const result = await readMigratingRecord({
    descriptor: descriptor('dual-read'), recipientId: 'user-1', enabled: true,
    loadLegacy: async () => ({id: 'legacy'}),
    loadShared: async () => { throw new Error('SHARED_RECORD_NOT_FOUND'); },
    decryptShared: async () => null
  });
  assert.equal(result.source, 'legacy-fallback');
});

test('revoca, generazione errata, autenticità e divergenza non fanno fallback', async () => {
  const cases = [
    {loadShared: async () => bundle({grant: {...bundle().grant, status: 'revoked'}})},
    {loadShared: async () => bundle({keyGeneration: 4})},
    {loadShared: async () => bundle(), decryptShared: async () => { throw new Error('SHARED_AUTHENTICITY_INVALID'); }},
    {loadShared: async () => bundle(), compareRecords: () => false}
  ];
  for (const current of cases) {
    await assert.rejects(readMigratingRecord({
      descriptor: descriptor('dual-read'), recipientId: 'user-1', enabled: true,
      loadLegacy: async () => ({id: 'legacy'}), decryptShared: async () => ({id: 'shared'}),
      compareRecords: () => true, ...current
    }));
  }
});

test('record-key e finalized non possono tornare al legacy', async () => {
  for (const migrationState of ['record-key', 'finalized']) {
    await assert.rejects(readMigratingRecord({
      descriptor: descriptor(migrationState), recipientId: 'user-1', enabled: true,
      loadLegacy: async () => ({id: 'legacy'}),
      loadShared: async () => { throw new Error('SHARED_RECORD_NOT_FOUND'); },
      decryptShared: async () => null
    }));
  }
});
