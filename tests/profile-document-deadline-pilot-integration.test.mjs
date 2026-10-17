import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(path, 'utf8');

test('salvataggio documento offre il pilot soltanto dopo la persistenza', async () => {
  const source = await read('Frontend/public/assets/js/modules/privato/profilo-actions.js');
  const saveIndex = source.indexOf('await syncData();', source.indexOf('export async function editUserDocument'));
  const offerIndex = source.indexOf('await onDocumentSaved?.', saveIndex);
  assert.ok(saveIndex > -1 && offerIndex > saveIndex);
});

test('runtime pilot mantiene le consegne disattivate e collega gli allegati del documento', async () => {
  const source = await read('Frontend/public/assets/js/modules/privato/profile-document-deadline-pilot.js');
  assert.match(source, /pilotDeliveryDisabled:\s*true/);
  assert.match(source, /notificationsEnabled:\s*false/);
  assert.match(source, /recipients:\s*\[\]/);
  assert.match(source, /buildLinkedDocumentDeadlineDraft/);
  assert.match(source, /attachments:\s*linkedDraft\.attachments/);
  assert.match(source, /showConfirmModal/);
  assert.match(source, /await ensureDocumentPersisted\?\.\(\)/);
  assert.doesNotMatch(source, /uploadBytes|httpsCallable|sendEmail/);
});

test('lista e dettaglio mostrano il marcatore prova scadenze', async () => {
  const list = await read('Frontend/public/assets/js/modules/scadenze/scadenze.js');
  const detail = await read('Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js');
  assert.match(list, /experimentTag === 'prova-scadenze'/);
  assert.match(list, /pilot_deadline_badge/);
  assert.match(detail, /experimentTag === 'prova-scadenze'/);
  assert.match(detail, /pilot_deadline_badge/);
});

test('la card distingue apertura reale e creazione o apertura del pilot parallelo', async () => {
  const source = await read('Frontend/public/assets/js/modules/privato/profilo-addresses-docs.js');
  assert.match(source, /pilot_deadline_card_open_traditional/);
  assert.match(source, /pilot_deadline_card_create_parallel/);
  assert.match(source, /pilotDeadlineReference/);
});

test('tutte le lingue dichiarano le chiavi del pilot', async () => {
  const required = ['pilot_deadline_badge', 'pilot_deadline_create_title', 'pilot_deadline_create_message',
    'pilot_deadline_update_title', 'pilot_deadline_review_title', 'pilot_deadline_open_document',
    'pilot_deadline_date_required', 'pilot_deadline_existing_title', 'pilot_deadline_existing_message',
    'pilot_deadline_existing_multiple_message', 'pilot_deadline_create_parallel_message',
    'pilot_deadline_card_open', 'pilot_deadline_card_open_traditional',
    'pilot_deadline_card_create_parallel', 'pilot_deadline_card_create'];
  const files = ['translations/it.js', ...['en','es','fr','de','zh','hi','pt'].map(code => `translations/${code}.js`)];
  for (const file of files) {
    const source = await read(`Frontend/public/assets/js/${file}`);
    for (const key of required) assert.match(source, new RegExp(`${key}\\s*[\":]`), `${file}: ${key}`);
  }
});
