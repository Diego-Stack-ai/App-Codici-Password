import assert from 'node:assert/strict';
import test from 'node:test';
import { buildI18nInventory, evaluateI18nBaseline } from '../scripts/audit-i18n-quality.mjs';

test('l’inventario i18n non peggiora rispetto alla baseline integrata 1.2.190', () => {
  const inventory = buildI18nInventory();
  const { regressions } = evaluateI18nBaseline(inventory);
  assert.deepEqual(regressions, []);
});

test('l’inventario copre markup, attributi, chiamate t e sink UI dinamici', () => {
  const inventory = buildI18nInventory();
  assert.ok(inventory.usedKeys.count > 0);
  assert.ok(Object.keys(inventory.html.pages).length >= 30);
  assert.ok(inventory.html.literals.some(item => item.kind === 'aria-label'));
  assert.ok(inventory.javascript.literalSinks.some(item => item.kind === 'toast'));
  assert.deepEqual(inventory.declaredLanguages, ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt']);
});

test('una lingua potrà essere dichiarata completa soltanto con parità delle chiavi', () => {
  const inventory = buildI18nInventory();
  for (const language of inventory.completeLanguages) {
    assert.deepEqual(inventory.missingKeysByLanguage[language], []);
  }
});

test('il catalogo italiano è completo e non può tornare a mostrare chiavi tecniche', () => {
  const inventory = buildI18nInventory();
  assert.ok(inventory.completeLanguages.includes('it'));
  assert.deepEqual(inventory.missingKeysByLanguage.it, []);
});

test('il catalogo inglese è completo e non può ricadere su testi italiani', () => {
    const inventory = buildI18nInventory();
  assert.ok(inventory.completeLanguages.includes('en'));
  assert.deepEqual(inventory.missingKeysByLanguage.en, []);
});

test('la baseline conserva lo storico del delta Archivio senza nasconderlo', () => {
  const { baseline } = evaluateI18nBaseline(buildI18nInventory());
  assert.equal(baseline.sourceVersion, '1.2.197');
  assert.equal(
    baseline.previousBaseline.htmlLiteralSegments + baseline.acceptedBaseDelta.htmlLiteralSegments,
    baseline.debt.htmlLiteralSegments
  );
  assert.equal(
    baseline.previousBaseline.jsLiteralSinks + baseline.acceptedBaseDelta.jsLiteralSinks,
    baseline.debt.jsLiteralSinks
  );
});
