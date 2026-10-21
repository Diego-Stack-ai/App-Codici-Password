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
  assert.match(source, /settings', sourceId\), \{deadlineTypes: nextRules\}/);
  assert.match(source, /deadline_domain_rule_linked_blocked/);
});

test('personal document summary has loading, empty, error and responsive card states', async () => {
  const [html, source, css] = await Promise.all([
    read('regole_scadenze.html'),
    read('assets/js/modules/scadenze/deadline-rules-hub.js'),
    read('assets/css/regole_scadenze.css')
  ]);
  assert.doesNotMatch(html, /deadline-hub-badge|RICONCILIATE/);
  assert.match(html, /<div class="deadline-domain-panel deadline-personal-panel"/);
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
  assert.match(source, /createElement\('details'/);
  assert.match(source, /createElement\('summary'/);
  assert.match(source, /deadline-personal-card-chevron/);
  assert.match(css, /\.deadline-personal-grid/);
  assert.match(css, /\.deadline-personal-panel\s*\{[\s\S]*?border:\s*0;/);
  assert.match(css, /\.deadline-personal-card\[open\] \.deadline-personal-card-chevron/);
  assert.match(css, /\.deadline-domain-resource-card/);
  assert.match(css, /\.deadline-domain-schedule-warning/);
  assert.match(css, /\.deadline-domain-tab\s*\{[\s\S]*?background:\s*transparent;/);
  assert.match(css, /\.deadline-domain-tab\.is-active\s*\{[\s\S]*?background:\s*rgb\(var\(--accent-rgb\) \/ 0\.14\);/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.deadline-personal-grid \{ grid-template-columns: 1fr; \}/);
});

test('vehicle rules expose scoped management, safe actions and official list filters', async () => {
  const [html, hub, list, editor, controller, editorCss, pages, translations, catalog] = await Promise.all([
    read('regole_scadenze.html'), read('assets/js/modules/scadenze/deadline-rules-hub.js'),
    read('assets/js/modules/scadenze/scadenze.js'),
    read('assets/js/modules/scadenze/configurazione_automezzi_v2.js'),
    read('assets/js/modules/scadenze/deadline-config-controller.js'),
    read('assets/css/configurazione_automezzi.css'),
    read('assets/js/pages-init.js'), read('assets/js/translations.js'),
    read('assets/js/translations/deadline-rules.js')
  ]);
  assert.match(html, /id="btn-add-vehicle-rule"/);
  for (const domain of ['vehicles', 'home', 'health', 'sport', 'contracts', 'generic']) {
    assert.match(html, new RegExp(`data-deadline-add-rule="${domain}"`));
  }
  assert.match(hub, /scadenze\.html\?rule=/);
  assert.match(hub, /configurazione_automezzi\.html\?source=/);
  assert.match(hub, /configsBySource\[configuration\.sourceId\]/);
  assert.doesNotMatch(hub, /const vehicleRule =/);
  assert.match(hub, /linkedDeadlineIds\.length/);
  assert.match(list, /activeRuleFilter/);
  assert.match(list, /searchInput\.value = activeRuleFilter/);
  assert.match(list, /clearRuleFilterFromUrl/);
  assert.doesNotMatch(list, /renderRuleFilterChip|deadline-rule-filter/);
  assert.match(editor, /deadlineRuleVehicleCards/);
  assert.match(editor, /updateDeadlineRuleVehicleCards/);
  assert.match(editor, /usesVehicleCards/);
  assert.match(editor, /currentDomain === 'vehicles'/);
  assert.match(editor, /classifyDeadlineDomain\(\{\.\.\.currentRule\(\), sourceId: currentSourceId\}\) === 'vehicles'/);
  assert.match(editor, /withDeadlineVehicleReferences/);
  assert.match(editor, /getUserSetting\(user\.uid, 'deadlineConfig'\)/);
  assert.match(editor, /dataName: 'vehicleModel'|dataName/);
  assert.match(editor, /compileDeadlineMessage/);
  assert.match(editor, /objectText: currentRule\(\)\?\.name/);
  assert.doesNotMatch(editor, /\[data-object-name\]|\[data-object-text\]/);
  assert.match(editor, /dataName: 'rulePeriod'|rulePeriod/);
  assert.match(editor, /dataName: 'ruleFrequency'|ruleFrequency/);
  assert.match(editor, /dataName: 'vehicleCard'|vehicleCard/);
  assert.match(editor, /createElement\('details'/);
  assert.match(editor, /createElement\('summary'/);
  assert.match(editor, /vehicle-rule-object-chevron/);
  assert.match(editor, /deadlineConfigDocuments:[\s\S]*kind: 'references'/);
  assert.match(editor, /generalConfig:[\s\S]*kind: 'general'/);
  assert.match(editor, /sourceDefinition\.kind === 'references'/);
  assert.match(editor, /dataName: 'parameterTemplate'|parameterTemplate/);
  assert.match(editor, /validateDeadlineNotice\(parameter\.period\)/);
  assert.match(editor, /validateDeadlineFrequency\(parameter\.freq\)/);
  assert.match(controller, /Array\.isArray\(selectedRule\.parameters\)/);
  assert.match(controller, /populateParameterSelect/);
  assert.match(controller, /applySelectedParameterSchedule/);
  assert.match(controller, /selectedParameter\.references/);
  assert.match(hub, /showInputModal\(t\('prompt_days_notice'\)/);
  assert.match(hub, /showInputModal\(t\('prompt_freq_days'\)/);
  assert.match(editorCss, /\.vehicle-rule-fields\.vehicle-rule-schedule\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
  assert.match(editorCss, /\.vehicle-rule-object\[open\] \.vehicle-rule-object-chevron/);
  assert.match(catalog, /deadline_vehicle_reference:\s*'Parametri'/);
  assert.match(pages, /configurazione_automezzi_v2\.js/);
  assert.match(translations, /regole_scadenze\|configurazione_automezzi/);
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
