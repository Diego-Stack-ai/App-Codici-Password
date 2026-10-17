import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(path, 'utf8');

test('salvataggio documento offre la configurazione definitiva soltanto dopo la persistenza', async () => {
  const source = await read('Frontend/public/assets/js/modules/privato/profilo-actions.js');
  const saveIndex = source.indexOf('await syncData();', source.indexOf('export async function editUserDocument'));
  const offerIndex = source.indexOf('await onDocumentSaved?.', saveIndex);
  assert.ok(saveIndex > -1 && offerIndex > saveIndex);
});

test('runtime definitivo apre il modulo completo e conserva il pilot solo come compatibilità storica', async () => {
  const links = await read('Frontend/public/assets/js/modules/privato/profilo-links.js');
  const profile = await read('Frontend/public/assets/js/modules/privato/profilo_privato.js');
  assert.match(links, /buildLinkedDocumentDeadlineDraft/);
  assert.match(links, /profile-deadline-link-draft/);
  assert.match(links, /aggiungi_scadenza\.html\?profileDocumentId=/);
  assert.match(links, /profile_deadline_configure_existing_message/);
  assert.match(profile, /createDeadlineFromDocument\(/);
  assert.doesNotMatch(profile, /reconcileProfileDocumentDeadlinePilot/);
  assert.match(links, /showConfirmModal/);
});

test('lista e dettaglio mostrano il marcatore prova scadenze', async () => {
  const list = await read('Frontend/public/assets/js/modules/scadenze/scadenze.js');
  const detail = await read('Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js');
  assert.match(list, /experimentTag === 'prova-scadenze'/);
  assert.match(list, /pilot_deadline_badge/);
  assert.match(detail, /experimentTag === 'prova-scadenze'/);
  assert.match(detail, /pilot_deadline_badge/);
});

test('la card espone solo apertura e configurazione definitiva, senza comandi Prova scadenze', async () => {
  const source = await read('Frontend/public/assets/js/modules/privato/profilo-addresses-docs.js');
  assert.doesNotMatch(source, /profile_deadline_card_open_previous/);
  assert.match(source, /profile_deadline_card_configure/);
  assert.match(source, /profile_deadline_card_open/);
  assert.doesNotMatch(source, /pilot_deadline_card_(?:open|create)/);
});

test('tutte le lingue dichiarano le chiavi del flusso definitivo', async () => {
  const required = ['profile_deadline_configure_title', 'profile_deadline_configure_message',
    'profile_deadline_configure_existing_message', 'profile_deadline_configure_action',
    'profile_deadline_card_configure', 'profile_deadline_card_open',
    'profile_deadline_update_title',
    'profile_deadline_update_message', 'profile_deadline_updated', 'profile_deadline_error'];
  const files = ['translations/it.js', ...['en','es','fr','de','zh','hi','pt'].map(code => `translations/${code}.js`)];
  for (const file of files) {
    const source = await read(`Frontend/public/assets/js/${file}`);
    for (const key of required) assert.match(source, new RegExp(`${key}\\s*[\":]`), `${file}: ${key}`);
  }
});

test('il salvataggio crea una scadenza attiva con fonte e riferimento definitivo', async () => {
  const source = await read('Frontend/public/assets/js/modules/scadenze/deadline-save-service.js');
  assert.match(source, /notificationsEnabled\s*=\s*true/);
  assert.match(source, /pilotDeliveryDisabled\s*=\s*false/);
  assert.match(source, /linkKind:\s*'profile-document-deadline-v1'/);
  assert.match(source, /sourceFieldId:\s*'document\.expiry_date'/);
  assert.match(source, /La data del documento è cambiata/);
  assert.match(source, /runTransaction/);
  assert.match(source, /profileDocumentLinkDraft\.ownerUid !== user\.uid/);
  assert.match(source, /profile-documents\/\$\{documentId\}\/attachments/);
});

test('la cancellazione dalla lista scollega atomicamente la scadenza dal documento', async () => {
  const source = await read('Frontend/public/assets/js/modules/scadenze/scadenze.js');
  assert.match(source, /runTransaction/);
  assert.match(source, /item\.expiryReference\?\.deadlineId === id/);
  assert.match(source, /expiryReference: null/);
});

test('il modulo completo precompila regole, testo e documenti non ancora presenti nelle vecchie liste', async () => {
  const source = await read('Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js');
  const config = await read('Frontend/public/assets/js/modules/scadenze/deadline-config-controller.js');
  assert.match(source, /selectValuePreservingCustomOption\(typeSelect, documentType, schedule \|\| \{\}\)/);
  assert.match(source, /getSuggestedSchedule\(documentType\)/);
  assert.match(source, /getSuggestedTemplate\(documentType\) \|\| documentType/);
  assert.match(config, /getSuggestedSchedule\(type\)/);
});
