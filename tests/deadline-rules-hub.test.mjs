import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const publicRoot = new URL('../Frontend/public/', import.meta.url);
const read = path => fs.readFile(new URL(path, publicRoot), 'utf8');

test('the deadline hub exposes nine accessible domains and removes the three separate legacy cards', async () => {
  const html = await read('regole_scadenze.html');
  const tabs = [...html.matchAll(/data-deadline-domain="([^"]+)"/g)].map(match => match[1]);
  const panels = [...html.matchAll(/data-deadline-panel="([^"]+)"/g)].map(match => match[1]);

  assert.deepEqual(tabs, ['personal', 'vehicles', 'home', 'health', 'sport', 'contracts', 'generic', 'user-company', 'company']);
  assert.deepEqual(panels, tabs);
  assert.match(html, /role="tablist"/);
  assert.doesNotMatch(html, /href="configurazione_automezzi\.html"/);
  assert.doesNotMatch(html, /href="configurazione_documenti\.html"/);
  assert.doesNotMatch(html, /href="configurazione_generali\.html"/);
  assert.match(html, /href="gestione_destinatari\.html"/);
  assert.doesNotMatch(html, /deadline-legacy-divider/);
  assert.match(html, /id="personal-documents-summary"/);
  for (const domain of ['vehicles', 'home', 'health', 'sport', 'contracts', 'generic']) {
    assert.match(html, new RegExp(`data-deadline-domain-summary="${domain}"`));
  }
  assert.doesNotMatch(html, /Documenti personali collegati|Apri Documenti nel Profilo/);
});

test('the deadline hub loads profile documents and keeps keyboard navigation accessible', async () => {
  const [source, main] = await Promise.all([
    read('assets/js/modules/scadenze/deadline-rules-hub.js'),
    read('assets/js/main-v129.js')
  ]);
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
  assert.ok(
    main.indexOf("path.includes('regole_scadenze')") < main.indexOf("path.includes('scadenze')"),
    'the specialized deadline-rules route must be resolved before the generic deadlines route'
  );
  assert.doesNotMatch(source, /profile_deadline_card_open_previous|pilotDeadlineReference\?\.deadlineId/);
  assert.match(source, /deadlineConfig'\), \{deadlineTypes: nextRules\}/);
  assert.match(source, /deadline_domain_rule_linked_blocked/);
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
  assert.match(source, /buildDeadlineDomainInventory/);
  assert.match(source, /deadline\.templateText \|\| deadline\.oggetto_email/);
  assert.match(source, /deadline\.attachments\.length/);
  assert.doesNotMatch(source, /blocks\.push\(renderResourceSection/);
  assert.doesNotMatch(source, /group\.deadlines\.map\(renderMappedDeadline\)/);
  assert.doesNotMatch(source, /deadline_domain_duplicate_warning/);
  assert.match(source, /getUserSetting\(user\.uid, 'deadlineConfig'\)/);
  assert.match(source, /getUserSetting\(user\.uid, 'deadlineConfigDocuments'\)/);
  assert.match(source, /getUserSetting\(user\.uid, 'generalConfig'\)/);
  assert.match(source, /deadline\.notes/);
  assert.match(source, /deadline\.templateText/);
  assert.match(source, /renderDocumentReference/);
  assert.doesNotMatch(source, /deadline_personal_number/);
  assert.match(source, /deadline_personal_message/);
  assert.match(source, /deadline_personal_can_manage/);
  assert.match(source, /deadline_personal_view_only/);
  assert.match(css, /\.deadline-personal-grid/);
  assert.match(css, /\.deadline-domain-resource-card/);
  assert.match(css, /\.deadline-domain-schedule-warning/);
  assert.match(css, /\.deadline-domain-tab\s*\{[\s\S]*?background:\s*transparent;/);
  assert.match(css, /\.deadline-domain-tab\.is-active\s*\{[\s\S]*?background:\s*rgb\(var\(--accent-rgb\) \/ 0\.14\);/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.deadline-personal-grid \{ grid-template-columns: 1fr; \}/);
});

test('vehicle rules expose scoped management, safe actions and official list filters', async () => {
  const [html, hub, list, editor, pages] = await Promise.all([
    read('regole_scadenze.html'), read('assets/js/modules/scadenze/deadline-rules-hub.js'),
    read('assets/js/modules/scadenze/scadenze.js'),
    read('assets/js/modules/scadenze/configurazione_automezzi_v2.js'),
    read('assets/js/pages-init.js')
  ]);
  assert.match(html, /id="btn-add-vehicle-rule"/);
  assert.match(hub, /scadenze\.html\?rule=/);
  assert.match(hub, /configuration\.href\}\?rule=/);
  assert.match(hub, /linkedDeadlineIds\.length/);
  assert.match(list, /activeRuleFilter/);
  assert.match(list, /deadline-rule-filter/);
  assert.match(editor, /deadlineRuleEmailObjects/);
  assert.match(editor, /dataName: 'vehicleModel'|dataName/);
  assert.match(editor, /compileDeadlineMessage/);
  assert.match(pages, /configurazione_automezzi_v2\.js/);
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
