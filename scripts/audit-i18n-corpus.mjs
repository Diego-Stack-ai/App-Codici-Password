import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildI18nInventory } from './audit-i18n-quality.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const publicRoot = path.join(root, 'Frontend', 'public');
const output = path.join(root, '.codex-tmp', 'i18n-corpus-1.2.190.json');
const toPosix = value => value.replace(/\\/g, '/');
const relative = value => toPosix(path.relative(root, value));
const lineOf = (source, index) => source.slice(0, index).split('\n').length;
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});
const allFiles = walk(publicRoot).filter(file => /\.(?:html|js|css)$/i.test(file));
const sources = new Map(allFiles.map(file => [relative(file), fs.readFileSync(file, 'utf8')]));
const filesByType = extension => [...sources.keys()].filter(file => file.endsWith(extension));
const htmlFiles = filesByType('.html');
const jsFiles = filesByType('.js');
const cssFiles = filesByType('.css');
const vendor = file => file.includes('/assets/js/vendor/');

const evidence = (classification, file, source, match, kind, value, extra = {}) => ({
  classification,
  file,
  line: lineOf(source, match.index),
  kind,
  value: String(value).replace(/\s+/g, ' ').trim(),
  ...extra
});

function parseHtml(file, source) {
  const ids = [...source.matchAll(/\sid\s*=\s*(["'])([^"']+)\1/gi)].map(match => ({ id: match[2], line: lineOf(source, match.index) }));
  const idCounts = new Map();
  ids.forEach(item => idCounts.set(item.id, (idCounts.get(item.id) || 0) + 1));
  const duplicateIds = ids.filter(item => idCounts.get(item.id) > 1);
  const scripts = [...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi)].map(match => ({
    src: match[2], line: lineOf(source, match.index)
  }));
  const styles = [...source.matchAll(/<link\b[^>]*\brel\s*=\s*(["'])stylesheet\1[^>]*\bhref\s*=\s*(["'])([^"']+)\2[^>]*>|<link\b[^>]*\bhref\s*=\s*(["'])([^"']+)\4[^>]*\brel\s*=\s*(["'])stylesheet\6[^>]*>/gi)].map(match => ({
    href: match[3] || match[5], line: lineOf(source, match.index)
  }));
  const translationAttributes = [...source.matchAll(/\b(data-t(?:-placeholder|-title|-aria|-alt)?)\s*=\s*(["'])([^"']+)\2/gi)].map(match => ({
    attribute: match[1], key: match[3], line: lineOf(source, match.index)
  }));
  const literalAttributes = [...source.matchAll(/\b(placeholder|title|aria-label|alt)\s*=\s*(["'])([^"']+)\2/gi)].map(match => {
    const tagStart = source.lastIndexOf('<', match.index);
    const tagEnd = source.indexOf('>', match.index);
    const tag = source.slice(tagStart, tagEnd + 1);
    const mapped = match[1].toLowerCase() === 'placeholder' ? 'data-t-placeholder'
      : match[1].toLowerCase() === 'title' ? 'data-t-title'
        : match[1].toLowerCase() === 'aria-label' ? 'data-t-aria' : 'data-t-alt';
    return evidence(tag.includes(mapped) ? 'confirmed-translated' : 'confirmed-debt', file, source, match, match[1].toLowerCase(), match[3], {
      autoTranslateRisk: !/\btranslate\s*=\s*(["'])no\1/i.test(tag) && !/\bnotranslate\b/i.test(tag)
    });
  });
  const withoutTechnicalBlocks = source
    .replace(/<!--[\s\S]*?-->/g, match => '\n'.repeat((match.match(/\n/g) || []).length))
    .replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, match => '\n'.repeat((match.match(/\n/g) || []).length));
  const literalText = [...withoutTechnicalBlocks.matchAll(/>([^<>]+)</g)].map(match => {
    const tagStart = withoutTechnicalBlocks.lastIndexOf('<', match.index);
    const tag = withoutTechnicalBlocks.slice(tagStart, match.index + 1);
    const value = match[1].replace(/\s+/g, ' ').trim();
    const translated = /\b(?:data-t|data-onboarding-key)\s*=/.test(tag);
    const icon = /material-(?:symbols|icons)/i.test(tag);
    const excluded = /\btranslate\s*=\s*(["'])no\1/i.test(tag) || /\bnotranslate\b/i.test(tag);
    return evidence(translated || icon || excluded ? 'confirmed-translated-or-technical' : 'confirmed-debt', file, withoutTechnicalBlocks, match, 'text', value, {
      autoTranslateRisk: !translated && !icon && !/\btranslate\s*=\s*(["'])no\1/i.test(tag) && !/\bnotranslate\b/i.test(tag)
    });
  }).filter(item => /[A-Za-zÀ-ÿ\u0900-\u097F\u4E00-\u9FFF]/u.test(item.value));
  return { ids, duplicateIds, scripts, styles, translationAttributes, literalAttributes, literalText };
}

function parseJs(file, source) {
  const imports = [...source.matchAll(/(?:import\s+(?:[\s\S]*?\s+from\s+)?|import\s*\()\s*(["'])([^"']+)\1/g)].map(match => ({
    specifier: match[2], line: lineOf(source, match.index)
  }));
  const selectors = [...source.matchAll(/(?:getElementById\(\s*(["'])([^"']+)\1|querySelector(?:All)?\(\s*(["'])([^"']+)\3)/g)].map(match => ({
    selector: match[2] ? `#${match[2]}` : match[4], line: lineOf(source, match.index)
  }));
  const handlers = [...source.matchAll(/(?:addEventListener\(\s*(["'])([^"']+)\1|\.on(?:click|change|input|submit|keydown|keyup)\s*=)/g)].map(match => ({
    event: match[2] || match[0].match(/\.on([a-z]+)/)?.[1] || 'inline', line: lineOf(source, match.index)
  }));
  const translationCalls = [...source.matchAll(/(?<![A-Za-z0-9_$])t\(\s*(["'])([^"']+)\1/g)].map(match => ({
    key: match[2], line: lineOf(source, match.index)
  }));
  const sinks = [];
  const patterns = [
    ['textContent', /\btextContent\s*(?::|=)\s*(["'`])([^\n]*?)\1/g],
    ['innerHTML', /\binnerHTML\s*(?::|=)\s*(["'`])([\s\S]*?)\1/g],
    ['insertAdjacentHTML', /\binsertAdjacentHTML\s*\(\s*(["'])(?:beforebegin|afterbegin|beforeend|afterend)\1\s*,\s*(["'`])([\s\S]*?)\2/g],
    ['toast', /\bshowToast\s*\(\s*(["'`])([^\n]*?)\1/g],
    ['dialog', /\b(?:alert|confirm|prompt)\s*\(\s*(["'`])([^\n]*?)\1/g],
    ['attribute', /setAttribute\(\s*(["'])(?:aria-label|title|placeholder|alt)\1\s*,\s*(["'`])([^\n]*?)\2/g]
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[kind === 'insertAdjacentHTML' || kind === 'attribute' ? 3 : 2] || '';
      sinks.push(evidence(/\bt\(\s*["']/.test(value) ? 'confirmed-translated' : 'confirmed-debt', file, source, match, kind, value));
    }
  }
  const mountSignals = [...source.matchAll(/\b(?:append|appendChild|prepend|replaceChildren|insertAdjacentHTML)\s*\(/g)].map(match => lineOf(source, match.index));
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length))
    .replace(/(^|[^:])\/\/.*$/gm, match => ' '.repeat(match.length));
  const translationApplications = [...codeOnly.matchAll(/\bapplyGlobalTranslations\s*\(/g)].map(match => lineOf(codeOnly, match.index));
  return { imports, selectors, handlers, translationCalls, sinks, mountSignals, translationApplications };
}

function parseCss(file, source) {
  const generatedContent = [...source.matchAll(/(?:^|[;{])\s*content\s*:\s*([^;}]+)/gim)].map(match => {
    const propertyOffset = match[0].toLowerCase().indexOf('content');
    const propertyMatch = { ...match, index: match.index + Math.max(0, propertyOffset) };
    return evidence(
      /(?:""|'')/.test(match[1].trim()) ? 'confirmed-technical' : 'confirmed-debt',
      file, source, propertyMatch, 'css-content', match[1]
    );
  });
  const idSelectors = [...source.matchAll(/#([A-Za-z_][\w-]*)/g)].map(match => ({ id: match[1], line: lineOf(source, match.index) }));
  const hidingRules = [...source.matchAll(/([^{}]+)\{[^{}]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)[^{}]*\}/gi)].map(match => evidence(
    'inferred', file, source, match, 'hiding-rule', match[1]
  ));
  return { generatedContent, idSelectors, hidingRules };
}

const html = Object.fromEntries(htmlFiles.map(file => [file, parseHtml(file, sources.get(file))]));
const javascript = Object.fromEntries(jsFiles.map(file => [file, parseJs(file, sources.get(file))]));
const css = Object.fromEntries(cssFiles.map(file => [file, parseCss(file, sources.get(file))]));

function resolveAsset(page, specifier) {
  const clean = specifier.split(/[?#]/)[0];
  if (/^(?:https?:|data:)/.test(clean)) return null;
  const pageDir = path.posix.dirname(page);
  const joined = clean.startsWith('/') ? `Frontend/public${clean}` : path.posix.normalize(path.posix.join(pageDir, clean));
  return joined;
}

function resolveJsImport(importer, specifier) {
  const clean = specifier.split(/[?#]/)[0];
  if (/^(?:https?:|data:|node:)/.test(clean) || !clean.startsWith('.')) return null;
  let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(importer), clean));
  if (!path.posix.extname(resolved)) resolved += '.js';
  return sources.has(resolved) ? resolved : null;
}

function scriptClosure(entries) {
  const seen = new Set();
  const pending = entries.filter(file => javascript[file]);
  while (pending.length) {
    const file = pending.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const imported of javascript[file].imports) {
      const resolved = resolveJsImport(file, imported.specifier);
      if (resolved && !seen.has(resolved)) pending.push(resolved);
    }
  }
  return [...seen].sort();
}

const missingByLanguage = Object.fromEntries(Object.entries(buildI18nInventory().missingKeysByLanguage)
  .map(([language, keys]) => [language, new Set(keys)]));

const pageMatrix = {};
const PAGE_ROUTE_MODULES = {
  'Frontend/public/login-v115.html': 'Frontend/public/assets/js/modules/auth/login.js',
  'Frontend/public/registrati.html': 'Frontend/public/assets/js/modules/auth/registrati.js',
  'Frontend/public/reset_password.html': 'Frontend/public/assets/js/modules/auth/reset_password.js',
  'Frontend/public/imposta_nuova_password.html': 'Frontend/public/assets/js/modules/auth/imposta_nuova_password.js',
  'Frontend/public/home_page.html': 'Frontend/public/assets/js/modules/home/home.js',
  'Frontend/public/area_privata.html': 'Frontend/public/assets/js/modules/privato/area_privata.js',
  'Frontend/public/account_privati.html': 'Frontend/public/assets/js/modules/privato/account_privati.js',
  'Frontend/public/form_account_privato.html': 'Frontend/public/assets/js/modules/privato/form_account_privato.js',
  'Frontend/public/dettaglio_account_privato.html': 'Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js',
  'Frontend/public/archivio_account.html': 'Frontend/public/assets/js/modules/settings/archivio_account.js',
  'Frontend/public/profilo_privato.html': 'Frontend/public/assets/js/modules/privato/profilo_privato.js',
  'Frontend/public/impostazioni.html': 'Frontend/public/assets/js/modules/settings/impostazioni.js',
  'Frontend/public/gestione_destinatari.html': 'Frontend/public/assets/js/modules/shared/gestione-destinatari.js',
  'Frontend/public/scadenze.html': 'Frontend/public/assets/js/modules/scadenze/scadenze.js',
  'Frontend/public/aggiungi_scadenza.html': 'Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js',
  'Frontend/public/dettaglio_scadenza.html': 'Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js',
  'Frontend/public/configurazione_automezzi.html': 'Frontend/public/assets/js/modules/scadenze/configurazione_automezzi_v2.js',
  'Frontend/public/configurazione_documenti.html': 'Frontend/public/assets/js/modules/scadenze/configurazione_documenti.js',
  'Frontend/public/configurazione_generali.html': 'Frontend/public/assets/js/modules/scadenze/configurazione_generali.js',
  'Frontend/public/lista_aziende.html': 'Frontend/public/assets/js/modules/azienda/lista_aziende.js',
  'Frontend/public/modifica_azienda.html': 'Frontend/public/assets/js/modules/azienda/modifica_azienda.js',
  'Frontend/public/dati_azienda.html': 'Frontend/public/assets/js/modules/azienda/dati_azienda.js',
  'Frontend/public/account_azienda.html': 'Frontend/public/assets/js/modules/azienda/account_azienda.js',
  'Frontend/public/dettaglio_account_azienda.html': 'Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js',
  'Frontend/public/form_account_azienda.html': 'Frontend/public/assets/js/modules/azienda/form_account_azienda.js'
};
for (const page of htmlFiles) {
  const parsed = html[page];
  const directScripts = parsed.scripts.map(item => resolveAsset(page, item.src)).filter(Boolean);
  const directStyles = parsed.styles.map(item => resolveAsset(page, item.href)).filter(Boolean);
  const scripts = scriptClosure(directScripts);
  const routedModule = PAGE_ROUTE_MODULES[page] || null;
  const routeClosure = routedModule ? scriptClosure([routedModule]) : [];
  const pageIds = new Set(parsed.ids.map(item => item.id));
  const selectorCollisions = [];
  const selectorMisses = [];
  for (const script of scripts) {
    for (const item of javascript[script]?.selectors || []) {
      if (/^#[A-Za-z_][\w-]*$/.test(item.selector) && !pageIds.has(item.selector.slice(1))) {
        selectorMisses.push({ classification: 'inferred', script, line: item.line, selector: item.selector });
      }
    }
  }
  for (const duplicate of parsed.duplicateIds) selectorCollisions.push({ classification: 'confirmed', ...duplicate });
  pageMatrix[page] = {
    directScripts,
    scriptClosure: scripts,
    routedModule,
    routeClosure,
    directStyles,
    text: {
      staticSegments: parsed.literalText.length,
      untranslatedSegments: parsed.literalText.filter(item => item.classification === 'confirmed-debt').length,
      attributes: parsed.literalAttributes.length,
      untranslatedAttributes: parsed.literalAttributes.filter(item => item.classification === 'confirmed-debt').length,
      translationKeys: [...new Set(parsed.translationAttributes.map(item => item.key))],
      translationCoverage: Object.fromEntries([...new Set(parsed.translationAttributes.map(item => item.key))].map(key => [key, {
        present: Object.keys(missingByLanguage).filter(language => !missingByLanguage[language].has(key)),
        missing: Object.keys(missingByLanguage).filter(language => missingByLanguage[language].has(key))
      }]))
    },
    controls: {
      buttons: (sources.get(page).match(/<button\b/gi) || []).length,
      labels: (sources.get(page).match(/<label\b/gi) || []).length,
      dialogs: (sources.get(page).match(/(?:<dialog\b|role\s*=\s*["']dialog["'])/gi) || []).length
    },
    duplicateIds: selectorCollisions,
    selectorMissesInClosure: selectorMisses,
    dynamicUiSources: scripts.flatMap(script => (javascript[script]?.sinks || []).map(item => ({ ...item, bootstrapClassification: 'inferred' }))),
    routedDynamicUiSources: routeClosure.flatMap(script => (javascript[script]?.sinks || []).map(item => ({ ...item, bootstrapClassification: 'confirmed-route-inferred-runtime' }))),
    handlers: scripts.flatMap(script => (javascript[script]?.handlers || []).map(item => ({ script, ...item }))),
    autoTranslateRisk: parsed.literalText.filter(item => item.classification === 'confirmed-debt' && item.autoTranslateRisk).length
      + parsed.literalAttributes.filter(item => item.classification === 'confirmed-debt' && item.autoTranslateRisk).length
  };
}

const allHtmlIds = new Set(Object.values(html).flatMap(item => item.ids.map(id => id.id)));
const cssIdMisses = Object.entries(css).flatMap(([file, parsed]) => parsed.idSelectors
  .filter(item => !allHtmlIds.has(item.id))
  .map(item => ({ classification: 'inferred', file, ...item })));
const dynamicAfterBootstrap = Object.entries(javascript).flatMap(([file, parsed]) => {
  if (!parsed.mountSignals.length || parsed.translationApplications.length || !parsed.sinks.some(item => item.classification === 'confirmed-debt')) return [];
  return [{ classification: 'inferred', file, mountSignals: parsed.mountSignals.length, literalSinks: parsed.sinks.filter(item => item.classification === 'confirmed-debt').length }];
});

const reachableScripts = new Set(Object.values(pageMatrix).flatMap(page => page.scriptClosure));
const inferredOrphanScripts = jsFiles.filter(file => !vendor(file) && !reachableScripts.has(file)).map(file => ({
  classification: 'inferred',
  file,
  reason: 'Non raggiunto dagli script dichiarati nelle pagine tramite import statici/dinamici con percorso letterale.'
}));

const repeatedHtmlLiterals = [...Object.entries(html).flatMap(([file, parsed]) => parsed.literalText
  .filter(item => item.classification === 'confirmed-debt')
  .map(item => ({ file, line: item.line, value: item.value, normalized: item.value.toLocaleLowerCase('it-IT') })))
  .reduce((groups, item) => groups.set(item.normalized, [...(groups.get(item.normalized) || []), item]), new Map())]
  .filter(([, locations]) => locations.length > 1)
  .map(([normalized, locations]) => ({ classification: 'confirmed', normalized, locations }));

const inventory = buildI18nInventory();
const catalogAvailability = Object.fromEntries(Object.keys(inventory.dictionaries).map(language => [language, {
  dictionaryKeys: inventory.dictionaries[language].keys,
  missingUsedKeys: inventory.missingKeysByLanguage[language].length
}]));
const corpus = [...sources.entries()].map(([file, source]) => ({
  file,
  type: path.extname(file).slice(1),
  bytes: Buffer.byteLength(source),
  lines: source.split('\n').length,
  sha256: crypto.createHash('sha256').update(source).digest('hex'),
  readCompletely: true,
  semanticScope: vendor(file) ? 'excluded-vendor-no-app-ui-ownership' : 'included'
}));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  base: { version: '1.2.190', commit: 'cee3929925a2bd4f30255906f3f358316ff049bf', candidate: '1.2.191' },
  method: {
    confirmed: 'Sintassi presente direttamente nel file e nella riga indicata.',
    inferred: 'Pista statica da verificare nel flusso runtime o nel browser; non è dichiarata finding confermata.',
    limitations: ['Regex conservative: non sostituiscono DOM/browser.', 'Selector e codice morto richiedono verifica del bootstrap e delle route.', 'La qualità semantica delle traduzioni richiede revisione umana madrelingua.']
  },
  corpusSummary: {
    files: corpus.length,
    html: htmlFiles.length,
    javascript: jsFiles.length,
    css: cssFiles.length,
    bytes: corpus.reduce((sum, item) => sum + item.bytes, 0),
    lines: corpus.reduce((sum, item) => sum + item.lines, 0),
    vendorReadButExcludedFromSemanticOwnership: corpus.filter(item => item.semanticScope.startsWith('excluded')).length
  },
  corpus,
  catalogAvailability,
  onboardingLanguages: inventory.onboardingLanguages,
  pages: pageMatrix,
  html,
  javascript,
  css,
  crossChecks: {
    cssIdMisses,
    dynamicAfterBootstrap,
    inferredOrphanScripts,
    repeatedHtmlLiterals,
    filesCallingApplyGlobalTranslations: Object.entries(javascript).filter(([, item]) => item.translationApplications.length).map(([file, item]) => ({ file, lines: item.translationApplications })),
    cssGeneratedContent: Object.values(css).reduce((sum, item) => sum + item.generatedContent.length, 0),
    duplicateIds: Object.values(pageMatrix).reduce((sum, page) => sum + page.duplicateIds.length, 0)
  }
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Corpus i18n completo: ${report.corpusSummary.files} file, ${report.corpusSummary.lines} righe, ${report.corpusSummary.bytes} byte.`);
console.log(`HTML ${report.corpusSummary.html}; JS ${report.corpusSummary.javascript}; CSS ${report.corpusSummary.css}.`);
console.log(`Artefatto: ${relative(output)}`);
console.log(`Piste post-bootstrap: ${dynamicAfterBootstrap.length}; CSS content: ${report.crossChecks.cssGeneratedContent}; ID duplicati: ${report.crossChecks.duplicateIds}.`);
