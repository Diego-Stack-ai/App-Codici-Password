import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile('Frontend/public/assets/js/modules/privato/profile-document-deadline-pilot-model.js', 'utf8');
const {
  buildProfileDocumentPilotDeadline,
  hasTraditionalProfileDocumentDeadlineReference,
  normalizedProfileDocumentType,
  planProfileDocumentDeadlineReconciliation,
  profileDocumentDeadlineCandidate,
  profileDocumentPilotDeadlineId,
  profileDocumentPilotTitle
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const documentFixture = {id: 'document-synthetic-1', type: 'Passaporto', expiry_date: '2035-04-12'};

test('riconosce soltanto una data ISO valida nel campo standard stabile', () => {
  assert.deepEqual(profileDocumentDeadlineCandidate(documentFixture), {
    sourceType: 'profileDocument', sourceDocumentId: 'document-synthetic-1',
    sourceFieldId: 'document.expiry_date', sourceValueAtLink: '2035-04-12', dueDate: '2035-04-12'
  });
  assert.equal(profileDocumentDeadlineCandidate({...documentFixture, expiry_date: '12/04/2035'}), null);
  assert.equal(profileDocumentDeadlineCandidate({...documentFixture, expiry_date: '2035-02-30'}), null);
});

test('l identificatore pilot è deterministico per documento e campo', () => {
  const first = profileDocumentPilotDeadlineId('document-synthetic-1');
  assert.equal(first, profileDocumentPilotDeadlineId('document-synthetic-1'));
  assert.notEqual(first, profileDocumentPilotDeadlineId('document-synthetic-2'));
  assert.match(first, /^pilot-profile-document-/);
});

test('record pilot è riconoscibile, privo di destinatari e allegati', () => {
  const record = buildProfileDocumentPilotDeadline(documentFixture, {nome: 'Mario', cognome: 'Rossi'}, new Date('2026-10-16T10:00:00Z'));
  assert.equal(record.experimentTag, 'prova-scadenze');
  assert.equal(record.title, 'Prova scadenze · Passaporto');
  assert.equal(record.sourceType, 'profileDocument');
  assert.equal(record.sourceDocumentId, documentFixture.id);
  assert.equal(record.sourceFieldId, 'document.expiry_date');
  assert.equal(record.sourceValueAtLink, '2035-04-12');
  assert.equal(record.pilotDeliveryDisabled, true);
  assert.equal(record.notificationsEnabled, false);
  assert.deepEqual(record.recipients, []);
  assert.deepEqual(record.attachments, []);
  assert.equal(record.name, 'Mario Rossi');
  assert.equal(Object.values(record).includes('AB123'), false);
});

test('normalizza i tipi noti e conserva un titolo facilmente promuovibile', () => {
  assert.equal(normalizedProfileDocumentType('Carta Identità'), "Carta d'identità");
  assert.equal(normalizedProfileDocumentType("carta d'identità"), "Carta d'identità");
  assert.equal(normalizedProfileDocumentType('Codice Fiscale'), 'Codice fiscale');
  assert.equal(normalizedProfileDocumentType('Patente'), 'Patente');
  assert.equal(normalizedProfileDocumentType('Permis de conduire'), 'Patente');
  assert.equal(normalizedProfileDocumentType('Personalausweis'), "Carta d'identità");
  assert.equal(normalizedProfileDocumentType('Pasaporte'), 'Passaporto');
  assert.equal(profileDocumentPilotTitle({type: 'Codice Fiscale'}), 'Prova scadenze · Codice fiscale');
  assert.equal(profileDocumentPilotTitle({type: 'Tessera professionale'}), 'Prova scadenze · Tessera professionale');
});

test('piano distingue creazione, modifica, rimozione, duplicati e stato corrente', () => {
  assert.equal(planProfileDocumentDeadlineReconciliation(documentFixture, []).action, 'offer-create');
  const linked = {...buildProfileDocumentPilotDeadline(documentFixture), id: 'deadline-synthetic'};
  assert.equal(planProfileDocumentDeadlineReconciliation(documentFixture, [linked]).action, 'current');
  assert.equal(planProfileDocumentDeadlineReconciliation({...documentFixture, expiry_date: '2036-01-01'}, [linked]).action, 'offer-update');
  assert.equal(planProfileDocumentDeadlineReconciliation({...documentFixture, expiry_date: ''}, [linked]).action, 'source-missing');
  assert.equal(planProfileDocumentDeadlineReconciliation(documentFixture, [linked, {...linked, id: 'deadline-duplicate'}]).action, 'duplicate');
});

test('le scadenze tradizionali consentono una sola copia pilot parallela senza essere adottate', () => {
  const different = {id: 'legacy-other', type: 'Passaporto', dueDate: '2036-04-12'};
  assert.equal(planProfileDocumentDeadlineReconciliation(documentFixture, [different]).action, 'offer-create');
  const compatible = {id: 'legacy', type: 'Passaporto', dueDate: '2035-04-12'};
  assert.equal(planProfileDocumentDeadlineReconciliation(documentFixture, [compatible]).action, 'offer-create-with-existing');
  assert.equal(planProfileDocumentDeadlineReconciliation(documentFixture, [compatible, {...compatible, id: 'legacy-2'}]).action, 'offer-create-with-existing');
  assert.equal(planProfileDocumentDeadlineReconciliation({
    ...documentFixture, expiryReference: {deadlineId: 'legacy-real'}
  }, [different]).action, 'offer-create-with-existing');
  const pilot = {...buildProfileDocumentPilotDeadline(documentFixture), id: 'pilot'};
  assert.equal(planProfileDocumentDeadlineReconciliation({
    ...documentFixture, expiryReference: {deadlineId: 'legacy-real'}
  }, [compatible, pilot]).action, 'current');
  assert.equal(hasTraditionalProfileDocumentDeadlineReference({expiryReference: {deadlineId: 'legacy-real'}}), true);
  assert.equal(hasTraditionalProfileDocumentDeadlineReference({
    expiryReference: {deadlineId: 'pilot', experimentTag: 'prova-scadenze'}
  }), false);
});
