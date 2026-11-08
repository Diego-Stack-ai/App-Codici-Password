import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUiTranslationAudit } from '../scripts/audit-ui-translations.mjs';

const audit = buildUiTranslationAudit();
const expectedLanguages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];

test('tutte le chiavi runtime collegate dalla topologia esistono nelle otto lingue', () => {
  assert.deepEqual(audit.languages, expectedLanguages);
  assert.equal(audit.summary.runtimeMissingTotal, 0);
  assert.equal(audit.summary.invalidRuntimeValueTotal, 0);
  assert.equal(audit.summary.pageRuntimeMissingTotal, 0);
  for (const language of expectedLanguages) {
    assert.deepEqual(audit.missingRuntimeByLanguage[language], []);
    assert.deepEqual(audit.invalidRuntimeValuesByLanguage[language], []);
    assert.deepEqual(audit.missingPageRuntimeByLanguage[language], []);
  }
  assert.deepEqual(audit.errors, []);
});

test('testo e attributi traducibili fanno parte del grafo UI', () => {
  assert.ok(audit.translationAttributeEdges.text > 0);
  assert.ok(audit.translationAttributeEdges.placeholder > 0);
  assert.ok(audit.translationAttributeEdges.aria > 0);
  assert.equal(audit.pages.length, 30);
  assert.ok(audit.summary.translatedElements > 0);
});

test('la copertura della guida distingue traduzione diretta e fallback italiano', () => {
  assert.equal(audit.fallbackLocale, 'it');
  assert.deepEqual(audit.missingGuideByLanguage.it, []);
  for (const language of expectedLanguages.filter(language => language !== 'it')) {
    assert.equal(audit.missingGuideByLanguage[language].length, audit.summary.guideKeys);
  }
  assert.equal(audit.summary.guideFallbackLanguages, 7);
});

test('il report non nasconde il debito letterale residuo', () => {
  assert.ok(audit.summary.htmlLiteralSegments > 0);
  assert.ok(audit.summary.htmlLiteralSegments <= 8);
  assert.equal(audit.summary.htmlLiteralAttributes, 0);
  assert.ok(audit.summary.javascriptLiteralSinkCandidates > 0);
  assert.ok(audit.summary.javascriptLiteralSinkCandidates <= 489);
  assert.ok(audit.pages.some(page => page.literalDebt > 0));
  assert.ok(Object.keys(audit.javascriptLiteralSinkFiles).length > 0);
});

test('le correzioni Supporto sono chiavi runtime complete', () => {
  for (const key of ['settings_app_version_label', 'settings_privacy_summary', 'settings_terms_summary']) {
    assert.ok(audit.runtimeKeys.includes(key), `${key} non collegata alla topologia runtime`);
  }
});
