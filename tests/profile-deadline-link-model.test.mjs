import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadModel() {
  const source = await readFile('Frontend/public/assets/js/modules/privato/profile-model.js', 'utf8');
  const result = await build({
    stdin: {contents: source, loader: 'js'}, bundle: true, format: 'esm', platform: 'browser', write: false
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('precompila nominativo, categoria, dettaglio e data nelle rispettive zone', () => {
  return loadModel().then(({buildProfileDocumentDeadlineDraft}) => assert.deepEqual(buildProfileDocumentDeadlineDraft({
    id: 'doc-1', type: 'Patente', num_serie: 'AB123', expiry_date: '2030-04-14'
  }, {nome: 'Diego', cognome: 'Boschetto'}), {
    profileDocumentId: 'doc-1', documentType: 'Patente', name: 'Diego Boschetto',
    detail: 'Patente - AB123', dueDate: '2030-04-14',
    sourceFieldId: 'document.expiry_date', sourceValueAtLink: '2030-04-14'
  }));
});

test('marca in modo esplicito soltanto il collegamento definitivo creato dal nuovo flusso', async () => {
  const {
    buildDefinitiveProfileDocumentDeadlineReference,
    isDefinitiveProfileDocumentDeadlineReference
  } = await loadModel();
  const reference = buildDefinitiveProfileDocumentDeadlineReference('deadline-new');
  assert.equal(isDefinitiveProfileDocumentDeadlineReference(reference), true);
  assert.equal(isDefinitiveProfileDocumentDeadlineReference({deadlineId: 'deadline-old'}), false);
  assert.equal(isDefinitiveProfileDocumentDeadlineReference({
    deadlineId: 'deadline-pilot', sourceType: 'profileDocument', experimentTag: 'prova-scadenze'
  }), false);
  assert.equal(isDefinitiveProfileDocumentDeadlineReference({
    deadlineId: 'deadline-old', sourceType: 'profileDocument'
  }), false);
});

test('riconosce una scadenza legacy per categoria e data senza falsi match evidenti', async () => {
  const {findCompatibleDocumentDeadlines} = await loadModel();
  const matches = findCompatibleDocumentDeadlines({type: 'Patente', expiry_date: '2030-04-14'}, [
    {id: 'd1', type: 'patente', dueDate: '2030-04-14'},
    {id: 'd2', type: 'Passaporto', dueDate: '2030-04-14'},
    {id: 'd3', type: 'Patente', dueDate: '2031-04-14'}
  ]);
  assert.deepEqual(matches.map(item => item.id), ['d1']);
});

test('distingue collegamento certo e scadenza legacy soltanto compatibile', async () => {
  const {resolveProfileDocumentDeadlineState} = await loadModel();
  const documents = [
    {id: 'doc-1', type: 'Patente', expiry_date: '2030-04-14'},
    {id: 'doc-2', type: 'Passaporto', expiry_date: '2031-05-20'}
  ];
  const result = resolveProfileDocumentDeadlineState(documents, [
    {id: 'd1', type: 'Patente', dueDate: '2030-04-14'},
    {id: 'd2', type: 'Passaporto', dueDate: '2031-05-20', linkKind: 'profile-document-deadline-v1',
      sourceRef: {type: 'profileDocument', id: 'doc-2'}}
  ]);
  assert.equal(result[0].compatibleDeadlineId, 'd1');
  assert.equal(result[0].expiryReference, undefined);
  assert.equal(result[1].expiryReference.deadlineId, 'd2');
  assert.equal(result[1].expiryReference.linkKind, 'profile-document-deadline-v1');
});

test('mantiene il collegamento reale e affianca un riferimento pilot soltanto di visualizzazione', async () => {
  const {resolveProfileDocumentDeadlineState} = await loadModel();
  const [result] = resolveProfileDocumentDeadlineState([{
    id: 'doc-parallel', type: 'Patente', expiry_date: '2030-04-14',
    expiryReference: {deadlineId: 'deadline-real'}
  }], [{
    id: 'deadline-pilot', experimentTag: 'prova-scadenze', sourceType: 'profileDocument',
    sourceDocumentId: 'doc-parallel', sourceFieldId: 'document.expiry_date'
  }]);
  assert.equal(result.expiryReference.deadlineId, 'deadline-real');
  assert.equal(result.pilotDeadlineReference.deadlineId, 'deadline-pilot');
});
