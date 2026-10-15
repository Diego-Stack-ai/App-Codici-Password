import assert from 'node:assert/strict';
import test from 'node:test';
import { buildI18nInventory, evaluateI18nBaseline } from '../scripts/audit-i18n-quality.mjs';

test('l’inventario i18n non peggiora rispetto alla baseline 1.2.189', () => {
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
