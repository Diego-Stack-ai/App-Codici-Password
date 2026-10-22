import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../Frontend/public/aggiungi_scadenza.html', import.meta.url), 'utf8');
const editor = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js', import.meta.url), 'utf8');

test('il form espone una sola selezione Ambito, Regola e Parametro', () => {
  for (const id of ['deadline-domain-select', 'deadline-rule-select', 'deadline-parameter-select']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="deadline-mode-selector"[^>]*\bhidden\b/);
  assert.match(html, /id="notif_days_before"[^>]*\breadonly\b/);
  assert.match(html, /id="notif_frequency"[^>]*\breadonly\b/);
});

test('il salvataggio collega la scadenza alla regola e al parametro selezionati', () => {
  assert.match(editor, /\.\.\.deadlineRuleLinkFields\(currentDeadlineRule, currentDeadlineParameter\)/);
  assert.match(editor, /notif_days_before: Number\(currentDeadlineRule\.period\)/);
  assert.match(editor, /notif_frequency: Number\(currentDeadlineRule\.frequency\)/);
  assert.match(editor, /selectDeadlineRule\(\{[\s\S]*?ruleId: data\.ruleId/);
});

test('il catalogo usa le configurazioni già caricate senza creare una seconda sorgente', () => {
  assert.match(editor, /getUserSetting\(user\.uid, 'deadlineConfig'\)/);
  assert.match(editor, /getUserSetting\(user\.uid, 'deadlineConfigDocuments'\)/);
  assert.match(editor, /getUserSetting\(user\.uid, 'generalConfig'\)/);
  assert.match(editor, /return buildDeadlineRuleCatalog\(\{/);
});
