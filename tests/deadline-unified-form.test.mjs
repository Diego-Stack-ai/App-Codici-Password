import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../Frontend/public/aggiungi_scadenza.html', import.meta.url), 'utf8');
const editor = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js', import.meta.url), 'utf8');
const companyContextEditor = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-company-context-controller.js', import.meta.url), 'utf8');

test('il form espone il tipo come primo passo e poi Regola e Riferimento', () => {
  for (const id of ['deadline-domain-select', 'deadline-rule-select', 'deadline-parameter-select']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="deadline-domain-tabs"[^>]*role="tablist"/);
  assert.match(html, /data-t="deadline_form_parameter">Riferimento</);
  assert.match(html, /id="deadline-personal-guidance"/);
  assert.match(html, /profilo_privato\.html\?profileTab=documents/);
  assert.ok(
    html.indexOf('id="deadline-domain-tabs"') < html.indexOf('id="deadline-rule-select"'),
    'il tipo deve precedere la scelta della regola'
  );
  assert.match(html, /id="deadline-mode-selector"[^>]*\bhidden\b/);
  assert.match(html, /id="notif_days_before"[^>]*\breadonly\b/);
  assert.match(html, /id="notif_frequency"[^>]*\breadonly\b/);
  assert.match(html, /id="btn-add-deadline-rule"[^>]*aria-label="Nuova regola"/);
  assert.match(html, /id="deadline-company-context-select"/);
  assert.match(companyContextEditor, /Destinatario già esistente/);
});

test('una nuova scadenza non preseleziona Automezzi, regola o riferimento', () => {
  assert.match(editor, /const initialDomain = isProfileDocumentEditor\(\) \? 'personal' : ''/);
  assert.doesNotMatch(editor, /domains\.find\(domain => domain\.id === 'vehicles'\)/);
  assert.match(editor, /currentDeadlineRule = preferredRule \|\| null/);
  assert.match(editor, /currentDeadlineParameter = preferredParameter \|\| \(selectFirst \? sourceParameters\[0\] : null\) \|\| null/);
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

test('la nuova regola conserva la bozza e il contesto azienda è un dato esplicito', () => {
  assert.match(editor, /async function openDeadlineRuleManager\(\)/);
  assert.match(editor, /sessionStorage\.setItem\(DEADLINE_EDITOR_RETURN_DRAFT_KEY/);
  assert.match(editor, /regole_scadenze\.html\?\$\{params\.toString\(\)\}/);
  assert.match(editor, /companyContextKind: companyContext\?\.kind/);
  assert.match(editor, /deadlineDomainNeedsCompany\(currentDeadlineRule\.domain\)/);
  assert.doesNotMatch(editor, /split\(['"]-['"]\).*company/i);
});
