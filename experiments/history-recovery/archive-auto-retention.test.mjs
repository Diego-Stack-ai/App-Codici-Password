import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveNoticeRecord, archiveRetentionDecision} from './archive-auto-retention.mjs';

const day = 86_400_000;
const at = value => Date.parse(value);
const account = (extra = {}) => ({ownerUid: 'owner', accountId: 'account', context: 'private', companyId: null,
  archived: true, archiveRevision: 3, archivedAt: new Date('2024-02-29T10:00:00Z'), ...extra});

test('due anni di calendario limitano il 29 febbraio e aprono l’avviso dieci giorni prima', () => {
  const before = archiveRetentionDecision({account: account(), now: at('2026-02-18T09:59:59Z')});
  assert.equal(before.status, 'retained');
  assert.equal(before.expiresAt, at('2026-02-28T10:00:00Z'));
  assert.equal(archiveRetentionDecision({account: account(), now: at('2026-02-18T10:00:00Z')}).status, 'notice-required');
});

test('avviso tardivo rinvia il purge finché non sono trascorsi dieci giorni interi', () => {
  const source = account(), createdAt = at('2026-03-05T12:00:00Z');
  const notice = archiveNoticeRecord(source, createdAt);
  assert.equal(archiveRetentionDecision({account: source, notice, now: createdAt + 10 * day - 1}).status, 'waiting-notice');
  assert.equal(archiveRetentionDecision({account: source, notice, now: createdAt + 10 * day}).status, 'eligible');
});

test('ripristino e nuova archiviazione invalidano l’avviso del ciclo precedente', () => {
  const first = account(), oldNotice = archiveNoticeRecord(first, at('2026-02-18T10:00:00Z'));
  const rearchived = account({archiveRevision: 4, archivedAt: new Date('2026-04-01T08:00:00Z')});
  assert.equal(archiveRetentionDecision({account: rearchived, notice: oldNotice, now: at('2028-03-25T08:00:00Z')}).status,
    'notice-required');
});

test('assenza, identità diversa o data inverificabile non autorizzano mai il purge', () => {
  const source = account(), now = at('2026-03-20T00:00:00Z');
  assert.equal(archiveRetentionDecision({account: source, now}).status, 'notice-required');
  const wrong = {...archiveNoticeRecord(source, at('2026-02-18T10:00:00Z')), accountId: 'other'};
  assert.equal(archiveRetentionDecision({account: source, notice: wrong, now}).status, 'notice-required');
  assert.equal(archiveRetentionDecision({account: account({archivedAt: '2024-02-29'}), now}).status, 'unverifiable');
  assert.equal(archiveRetentionDecision({account: account({archived: false}), now}).status, 'not-archived');
});

test('record avviso contiene solo identità, ciclo e date tecniche', () => {
  const notice = archiveNoticeRecord(account(), at('2026-02-18T10:00:00Z'));
  assert.deepEqual(Object.keys(notice).sort(), ['accountId', 'archiveRevision', 'archivedAt', 'companyId',
    'context', 'createdAt', 'ownerUid', 'schemaVersion']);
  assert.equal(JSON.stringify(notice).includes('password'), false);
});

test('ambito aziendale richiede e vincola companyId senza collisioni col privato', () => {
  const company = account({context: 'company', companyId: 'company-1'});
  const notice = archiveNoticeRecord(company, at('2026-02-18T10:00:00Z'));
  assert.equal(archiveRetentionDecision({account: company, notice, now: at('2026-03-20T00:00:00Z')}).status,
    'eligible');
  assert.equal(archiveRetentionDecision({account: {...company, companyId: 'company-2'}, notice,
    now: at('2026-03-20T00:00:00Z')}).status, 'notice-required');
  assert.throws(() => archiveNoticeRecord(account({context: 'company', companyId: null}),
    at('2026-02-18T10:00:00Z')), error => error.code === 'ARCHIVE_RETENTION_IDENTITY_INVALID');
});

test('marker temporali corrotti o futuri non anticipano mai l’eleggibilità', () => {
  const source = account(), valid = archiveNoticeRecord(source, at('2026-02-18T10:00:00Z'));
  for (const createdAt of [NaN, Infinity, -1, '2026-02-18', {seconds: -1}]) {
    assert.equal(archiveRetentionDecision({account: source, notice: {...valid, createdAt},
      now: at('2026-03-20T00:00:00Z')}).status, 'notice-required');
  }
  const future = account({archivedAt: new Date('2027-01-01T00:00:00Z')});
  assert.equal(archiveRetentionDecision({account: future, now: at('2026-03-20T00:00:00Z')}).status, 'retained');
});
