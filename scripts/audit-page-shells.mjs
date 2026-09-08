import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

const publicRoot = new URL('../Frontend/public/', import.meta.url);
const testPages = new Set([
  'prova.html'
]);
const accessPages = new Set([
  'index.html',
  'login-v115.html',
  'registrati.html',
  'reset_password.html',
  'imposta_nuova_password.html'
]);
const internalPages = new Set([
  'account_azienda.html',
  'account_privati.html',
  'aggiungi_scadenza.html',
  'archivio_account.html',
  'area_privata.html',
  'configurazione_automezzi.html',
  'configurazione_documenti.html',
  'configurazione_generali.html',
  'dati_azienda.html',
  'dettaglio_account_azienda.html',
  'dettaglio_account_privato.html',
  'dettaglio_scadenza.html',
  'form_account_azienda.html',
  'form_account_privato.html',
  'gestione_destinatari.html',
  'home_page.html',
  'impostazioni.html',
  'lista_aziende.html',
  'modifica_azienda.html',
  'privacy.html',
  'profilo_privato.html',
  'regole_scadenze.html',
  'scadenze.html',
  'termini.html'
]);
const internalPageModels = new Map([
  ['hub', new Set([
    'area_privata.html',
    'home_page.html'
  ])],
  ['list', new Set([
    'account_azienda.html',
    'account_privati.html',
    'archivio_account.html',
    'lista_aziende.html',
    'scadenze.html'
  ])],
  ['detail', new Set([
    'dati_azienda.html',
    'dettaglio_account_azienda.html',
    'dettaglio_account_privato.html',
    'dettaglio_scadenza.html',
    'profilo_privato.html'
  ])],
  ['form', new Set([
    'aggiungi_scadenza.html',
    'form_account_azienda.html',
    'form_account_privato.html',
    'modifica_azienda.html'
  ])],
  ['configuration', new Set([
    'configurazione_automezzi.html',
    'configurazione_documenti.html',
    'configurazione_generali.html',
    'gestione_destinatari.html',
    'impostazioni.html',
    'regole_scadenze.html',
  ])],
  ['information', new Set([
    'privacy.html',
    'termini.html'
  ])]
]);

const modeledInternalPages = [...internalPageModels.values()]
  .flatMap(pages => [...pages])
  .sort();
assert.deepEqual(modeledInternalPages, [...internalPages].sort(),
  'I modelli UI non classificano esattamente le 24 pagine interne');

const publicPages = (await readdir(publicRoot))
  .filter(name => name.endsWith('.html') && !testPages.has(name))
  .sort();
const contractedPages = [...accessPages, ...internalPages].sort();
assert.deepEqual(publicPages, contractedPages, 'Le pagine pubbliche non coincidono con le 29 pagine contrattualizzate');

const hasStylesheet = (source, name) => new RegExp(`href=["'][^"']*${name.replace('.', '\\.')}(?:\\?[^"']*)?["']`).test(source);
const hasClass = (source, element, name) => new RegExp(`<${element}[^>]*class=["'][^"']*\\b${name}\\b`).test(source);

for (const name of publicPages) {
  const source = await readFile(new URL(name, publicRoot), 'utf8');
  assert.match(source, /name=["']viewport["'][^>]*viewport-fit=cover/, `${name}: viewport-fit=cover mancante`);
  assert.ok(hasStylesheet(source, 'core.css'), `${name}: core.css mancante`);
  assert.ok(hasClass(source, 'body', 'base-bg'), `${name}: body.base-bg mancante`);

  if (internalPages.has(name)) {
    const expectedModel = [...internalPageModels]
      .find(([, pages]) => pages.has(name))?.[0];
    assert.match(source, new RegExp(`<body[^>]*data-ui-model=["']${expectedModel}["']`),
      `${name}: modello UI ${expectedModel} mancante`);
    assert.ok(hasStylesheet(source, 'core_fascie.css'), `${name}: core_fascie.css mancante`);
    assert.ok(hasClass(source, 'div', 'base-container'), `${name}: base-container mancante`);
    assert.ok(hasClass(source, 'main', 'base-main'), `${name}: base-main mancante`);
    assert.ok(hasClass(source, 'div', 'page-container'), `${name}: page-container mancante`);
    assert.ok(hasClass(source, 'div', 'pt-header-extra'), `${name}: pt-header-extra mancante`);
    assert.ok(hasClass(source, 'div', 'pb-footer-extra'), `${name}: pb-footer-extra mancante`);
    assert.ok(hasClass(source, 'header', 'base-header'), `${name}: base-header mancante`);
    assert.ok(hasClass(source, 'footer', 'base-footer'), `${name}: base-footer mancante`);
  } else {
    assert.ok(!hasStylesheet(source, 'core_fascie.css'), `${name}: le fasce non appartengono alla famiglia accesso`);
  }
}

for (const name of [...accessPages].filter(name => name !== 'index.html')) {
  const source = await readFile(new URL(name, publicRoot), 'utf8');
  assert.match(source, /<html[^>]*class=["'][^"']*\bprotocol-forced-dark\b/, `${name}: dark obbligatorio mancante`);
  assert.ok(hasStylesheet(source, 'accesso.css'), `${name}: accesso.css mancante`);
  assert.ok(hasClass(source, 'div', 'base-container'), `${name}: base-container mancante`);
  assert.ok(hasClass(source, 'div', 'vault'), `${name}: vault mancante`);
}

const indexSource = await readFile(new URL('index.html', publicRoot), 'utf8');
assert.match(indexSource, /<html[^>]*class=["'][^"']*\bdark\b/, 'index.html: tema dark iniziale mancante');
assert.match(indexSource, /http-equiv=["']refresh["'][^>]*login-v115\.html/, 'index.html: inoltro alla pagina di accesso mancante');

const core = await readFile(new URL('assets/css/core.css', publicRoot), 'utf8');
const bars = await readFile(new URL('assets/css/core_fascie.css', publicRoot), 'utf8');
const access = await readFile(new URL('assets/css/accesso.css', publicRoot), 'utf8');
assert.match(core, /\.base-bg\s*\{[\s\S]*?min-height:\s*100dvh/, 'core.css: fondale dinamico mancante');
assert.match(core, /--viewport-edge-color:\s*#ebf4fd/, 'core.css: colore canvas chiaro mancante');
assert.match(core, /\.dark\s*\{[\s\S]*?--viewport-edge-color:\s*#0c1326/, 'core.css: colore canvas dark mancante');
assert.match(core, /html\s*\{[\s\S]*?background-color:\s*var\(--viewport-edge-color\)/,
  'core.css: canvas radice non collegato al colore terminale');
assert.match(core, /@media \(max-width:\s*600px\)[\s\S]*?\.base-main\s*\{[\s\S]*?overflow-y:\s*auto/, 'core.css: area mobile scorrevole mancante');
assert.match(bars, /\.base-header\s*\{[\s\S]*?top:\s*0/, 'core_fascie.css: header non ancorato in alto');
assert.match(bars, /\.base-footer\s*\{[\s\S]*?bottom:\s*0/, 'core_fascie.css: footer non ancorato in basso');
assert.match(bars, /\.pb-footer-extra\s*\{[\s\S]*?safe-area-inset-bottom/, 'core_fascie.css: spazio inferiore sicuro mancante');
assert.match(bars, /\.pt-header-extra\s*\{[\s\S]*?safe-area-inset-top/, 'core_fascie.css: spazio superiore sicuro mancante');
assert.match(access, /\.base-container\s*\{\s*justify-content:\s*center/, 'accesso.css: centratura famiglia accesso mancante');

console.log('Contratto shell: 5 pagine accesso e 24 pagine interne conformi; prova.html esclusa dal contratto.');
