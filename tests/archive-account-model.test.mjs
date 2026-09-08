import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/settings/archive-account-model.js', import.meta.url), 'utf8');
const {ARCHIVE_RETENTION_DAYS, archiveRetention, createArchiveMetadata} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('l’archiviazione aggiunge 30 giorni e incrementa la revisione', () => {
  const now = Date.UTC(2026, 8, 8);
  const metadata = createArchiveMetadata({revision: 4}, now);
  assert.equal(ARCHIVE_RETENTION_DAYS, 30); assert.equal(metadata.isArchived, true); assert.equal(metadata.revision, 5);
  assert.equal(Date.parse(metadata.purgeAfter) - Date.parse(metadata.archivedAt), 30 * 86400000);
});

test('retention gestisce record moderni, scaduti e archivi legacy senza eliminarli automaticamente', () => {
  const now = Date.UTC(2026, 8, 8);
  assert.deepEqual(archiveRetention({purgeAfter: new Date(now + 2 * 86400000).toISOString()}, now), {legacy: false, expired: false, daysRemaining: 2});
  assert.deepEqual(archiveRetention({purgeAfter: new Date(now - 1).toISOString()}, now), {legacy: false, expired: true, daysRemaining: 0});
  assert.deepEqual(archiveRetention({}, now), {legacy: true, expired: false, daysRemaining: null});
});
