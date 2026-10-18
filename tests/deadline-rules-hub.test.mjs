import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const publicRoot = new URL('../Frontend/public/', import.meta.url);
const read = path => fs.readFile(new URL(path, publicRoot), 'utf8');

test('the deadline hub exposes nine accessible domains while preserving legacy configurations', async () => {
  const html = await read('regole_scadenze.html');
  const tabs = [...html.matchAll(/data-deadline-domain="([^"]+)"/g)].map(match => match[1]);
  const panels = [...html.matchAll(/data-deadline-panel="([^"]+)"/g)].map(match => match[1]);

  assert.deepEqual(tabs, ['personal', 'vehicles', 'home', 'health', 'sport', 'contracts', 'generic', 'user-company', 'company']);
  assert.deepEqual(panels, tabs);
  assert.match(html, /role="tablist"/);
  assert.match(html, /href="configurazione_automezzi\.html"/);
  assert.match(html, /href="configurazione_documenti\.html"/);
  assert.match(html, /href="configurazione_generali\.html"/);
  assert.match(html, /href="gestione_destinatari\.html"/);
  assert.match(html, /id="personal-documents-summary"/);
  assert.doesNotMatch(html, /Documenti personali collegati|Apri Documenti nel Profilo/);
});

test('the deadline hub loads profile documents and keeps keyboard navigation accessible', async () => {
  const source = await read('assets/js/modules/scadenze/deadline-rules-hub.js');
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /aria-selected/);
  assert.match(source, /getUserProfile/);
  assert.match(source, /listDeadlines/);
  assert.match(source, /resolveProfileDocumentDeadlineState/);
  assert.match(source, /isDefinitiveProfileDocumentDeadlineReference/);
  assert.match(source, /deadline\.linkKind !== 'profile-document-deadline-v1'/);
  assert.match(source, /sourceDocumentId === documentItem\.id/);
  assert.match(source, /profile_deadline_card_configure/);
  assert.match(source, /profile_deadline_card_open/);
  assert.match(source, /auth\.currentUser\?\.uid === user\.uid/);
  assert.match(source, /normalizeProfileDateInputValue/);
  assert.doesNotMatch(source, /profile_deadline_card_open_previous|pilotDeadlineReference\?\.deadlineId/);
  assert.doesNotMatch(source, /setDoc|addDoc|updateDoc|deleteDoc/);
});

test('personal document summary has loading, empty, error and responsive card states', async () => {
  const [source, css] = await Promise.all([
    read('assets/js/modules/scadenze/deadline-rules-hub.js'),
    read('assets/css/regole_scadenze.css')
  ]);
  assert.match(source, /deadline_personal_loading/);
  assert.match(source, /deadline_personal_empty/);
  assert.match(source, /deadline_personal_error/);
  assert.match(source, /deadline_personal_retry/);
  assert.match(source, /deadlineRecipientsFromRecord/);
  assert.match(source, /deadline\.attachments/);
  assert.match(source, /deadline\.notes/);
  assert.match(source, /deadline\.templateText/);
  assert.match(source, /deadline_personal_message/);
  assert.match(source, /deadline_personal_can_manage/);
  assert.match(source, /deadline_personal_view_only/);
  assert.match(css, /\.deadline-personal-grid/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.deadline-personal-grid \{ grid-template-columns: 1fr; \}/);
});

test('the deadline hub catalog has identical keys in all eight application languages', async () => {
  const source = await read('assets/js/translations/deadline-rules.js');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const { deadlineRulesCatalogs } = await import(moduleUrl);
  const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
  const expected = Object.keys(deadlineRulesCatalogs.it).sort();

  assert.deepEqual(Object.keys(deadlineRulesCatalogs).sort(), [...languages].sort());
  for (const language of languages) {
    assert.deepEqual(Object.keys(deadlineRulesCatalogs[language]).sort(), expected, `catalog mismatch for ${language}`);
    assert.ok(Object.values(deadlineRulesCatalogs[language]).every(value => typeof value === 'string' && value.trim()));
  }
});
