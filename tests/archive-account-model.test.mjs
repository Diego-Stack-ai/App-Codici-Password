import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/settings/archive-account-model.js', import.meta.url), 'utf8');
const {createArchiveMetadata} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('l’archiviazione non pianifica cancellazioni e incrementa la revisione', () => {
  const now = Date.UTC(2026, 8, 8);
  const metadata = createArchiveMetadata({revision: 4}, now);
  assert.equal(metadata.isArchived, true);
  assert.equal(metadata.archiveSchemaVersion, 2);
  assert.equal(metadata.revision, 5);
  assert.equal(metadata.purgeAfter, undefined);
});
