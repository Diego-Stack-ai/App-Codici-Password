import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controllerPath = 'Frontend/public/assets/js/modules/scadenze/deadline-config-controller.js';
const editorPath = 'Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js';

async function loadComparisonHelpers() {
  const source = await readFile(controllerPath, 'utf8');
  const start = source.indexOf('export function normalizeDeadlineComparableValue');
  const end = source.indexOf('export function createDeadlineConfigController');
  assert.ok(start >= 0 && end > start, 'le funzioni pure di confronto devono restare esportate');
  const moduleSource = source.slice(start, end);
  return import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
}

test('il confronto delle categorie tollera maiuscole, accenti e apostrofi tipografici', async () => {
  const {deadlineConfigValuesMatch, normalizeDeadlineComparableValue} = await loadComparisonHelpers();
  assert.equal(deadlineConfigValuesMatch("Carta d'identità", 'CARTA D’IDENTITA'), true);
  assert.equal(deadlineConfigValuesMatch("Carta d'identità", 'Carta Identità'), true);
  assert.equal(deadlineConfigValuesMatch('Passaporto', ' passaporto '), true);
  assert.equal(deadlineConfigValuesMatch('合同', '合同'), true);
  assert.equal(deadlineConfigValuesMatch('Patente', 'Passaporto'), false);
  assert.equal(normalizeDeadlineComparableValue("Carta d’identità"), 'carta identita');
});

test('la bozza documento personale è vincolata all’UID e viene rimossa se incoerente o annullata', async () => {
  const source = await readFile(editorPath, 'utf8');
  assert.match(source, /draft\.ownerUid === user\.uid/);
  assert.match(source, /draft\?\.profileDocumentId === profileDocumentId/);
  assert.match(source, /function discardProfileDocumentDraft\(\)[\s\S]*sessionStorage\.removeItem\(PROFILE_DEADLINE_DRAFT_KEY\)/);
  assert.match(source, /onclick:\s*\(\) => \{[\s\S]*discardProfileDocumentDraft\(\)/);
  assert.match(source, /auth\.currentUser\.uid !== currentUser\?\.uid[\s\S]*discardProfileDocumentDraft\(\)/);
});

test('la modifica collegata al Profilo resta nei documenti e conserva valori personalizzati', async () => {
  const source = await readFile(editorPath, 'utf8');
  assert.match(source, /linkedSourceRef\?\.type === 'profileDocument'[\s\S]*\? 'documenti'/);
  assert.match(source, /selectValuePreservingCustomOption\(typeSelect, data\.type\)/);
  assert.match(source, /selectValuePreservingCustomOption\(testoEmailSelect, data\.templateText\)/);
  assert.match(source, /deadlineConfigValuesMatch\(item\.value, value\)/);
});

test('regole e template usano il confronto normalizzato', async () => {
  const source = await readFile(controllerPath, 'utf8');
  assert.match(source, /getModeForDeadlineType\(type\)[\s\S]*deadlineConfigValuesMatch\(itemName\(item\), type\)/);
  assert.match(source, /getSuggestedTemplate\(type\)[\s\S]*deadlineConfigValuesMatch\(itemName\(item\), type\)/);
  assert.match(source, /getSuggestedSchedule\(type\)[\s\S]*deadlineConfigValuesMatch\(itemName\(entry\), type\)/);
});
