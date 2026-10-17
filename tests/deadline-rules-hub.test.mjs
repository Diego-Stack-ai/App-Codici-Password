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
});

test('the deadline hub controller is navigation-only and keyboard accessible', async () => {
  const source = await read('assets/js/modules/scadenze/deadline-rules-hub.js');
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /aria-selected/);
  assert.doesNotMatch(source, /firebase|setDoc|addDoc|updateDoc|deleteDoc/);
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
