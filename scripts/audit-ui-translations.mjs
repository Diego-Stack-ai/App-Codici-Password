import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUiTopology } from './build-ui-topology.mjs';
import { buildI18nInventory } from './audit-i18n-quality.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const guidePath = path.join(projectRoot, 'Frontend', 'public', 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json');
const translationsDir = path.join(projectRoot, 'Frontend', 'public', 'assets', 'js', 'translations');

// The browser sources are ESM .js files while this repository intentionally has no
// package-level `type: module`. Evaluate these trusted, data-only catalogs without
// changing the module mode of the whole application or duplicating their contents.
function loadDefaultCatalog(fileName) {
  const source = fs.readFileSync(path.join(translationsDir, fileName), 'utf8');
  return Function(source.replace(/^export default\s+/m, 'return '))();
}

function loadNamedCatalog(fileName, exportName) {
  const source = fs.readFileSync(path.join(translationsDir, fileName), 'utf8')
    .replace(new RegExp(`export\\s+const\\s+${exportName}\\s*=`), `const ${exportName} =`);
  return Function(`${source}\nreturn ${exportName};`)();
}

const it = loadDefaultCatalog('it.js');
const en = loadDefaultCatalog('en.js');
const es = loadDefaultCatalog('es.js');
const fr = loadDefaultCatalog('fr.js');
const de = loadDefaultCatalog('de.js');
const zh = loadDefaultCatalog('zh.js');
const hi = loadDefaultCatalog('hi.js');
const pt = loadDefaultCatalog('pt.js');
const accessCatalogs = loadNamedCatalog('access.js', 'accessCatalogs');
const recipientCatalogs = loadNamedCatalog('recipients.js', 'recipientCatalogs');
const profileCatalogs = loadNamedCatalog('profile.js', 'profileCatalogs');
const settingsCatalogs = loadNamedCatalog('settings.js', 'settingsCatalogs');
const recoveryCatalogs = loadNamedCatalog('recovery.js', 'recoveryCatalogs');
const deadlineRulesCatalogs = loadNamedCatalog('deadline-rules.js', 'deadlineRulesCatalogs');
const dynamicUiCatalogs = loadNamedCatalog('dynamic-ui.js', 'dynamicUiCatalogs');
const RUNTIME_RELATIONS = new Set([
  'ui_translates_with',
  'ui_translates_placeholder_with',
  'ui_translates_aria_with',
  'ui_translates_title_with',
  'ui_translates_alt_with',
  'ui_uses_translation',
  'ui_flow_translates_with'
]);
const GUIDE_RELATIONS = new Set(['ui_guide_title', 'ui_guide_purpose', 'ui_guide_step_text']);
const DECLARATIVE_RELATIONS = new Set([...RUNTIME_RELATIONS].filter(relation => relation.startsWith('ui_translates')));
const PAGE_RUNTIME_RELATIONS = new Set([...DECLARATIVE_RELATIONS, 'ui_flow_translates_with']);
const BASE_CATALOGS = { it, en, es, fr, de, zh, hi, pt };
const DOMAIN_CATALOGS = [accessCatalogs, recipientCatalogs, profileCatalogs, settingsCatalogs, recoveryCatalogs, deadlineRulesCatalogs, dynamicUiCatalogs];

const keyFromTarget = target => target.startsWith('ui:i18n:') ? target.slice('ui:i18n:'.length) : null;
const uniqueSorted = values => [...new Set(values)].sort();

function keysForRelations(topology, relations) {
  return uniqueSorted(topology.edges
    .filter(edge => relations.has(edge.relation))
    .map(edge => keyFromTarget(edge.target))
    .filter(Boolean));
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function pageDomainCatalog(page, language) {
  if (/^login\.html$/i.test(page)) return {...(accessCatalogs[language] || {}), ...(recoveryCatalogs[language] || {})};
  if (/^(?:registrati|reset_password|imposta_nuova_password|contatto_condiviso)\.html$/i.test(page)) return accessCatalogs[language] || {};
  if (/^gestione_destinatari\.html$/i.test(page)) return recipientCatalogs[language] || {};
  if (/^(?:profilo_privato|dati_azienda)\.html$/i.test(page)) return profileCatalogs[language] || {};
  if (/^impostazioni\.html$/i.test(page)) return {...(settingsCatalogs[language] || {}), ...(recoveryCatalogs[language] || {})};
  if (/^(?:regole_scadenze|configurazione_automezzi|aggiungi_scadenza)\.html$/i.test(page)) return deadlineRulesCatalogs[language] || {};
  return {};
}

const validTranslationValue = (catalog, key) => Object.hasOwn(catalog, key)
  && typeof catalog[key] === 'string'
  && catalog[key].trim().length > 0
  && catalog[key] !== key;

export function buildUiTranslationAudit() {
  const topology = buildUiTopology();
  const inventory = buildI18nInventory();
  const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'));
  const languages = inventory.declaredLanguages;
  const runtimeKeys = keysForRelations(topology, RUNTIME_RELATIONS);
  const guideKeys = keysForRelations(topology, GUIDE_RELATIONS);
  const dictionarySets = Object.fromEntries(languages.map(language => [
    language,
    new Set(inventory.dictionaries[language]?.keyList || [])
  ]));
  const missingRuntimeByLanguage = Object.fromEntries(languages.map(language => [
    language,
    runtimeKeys.filter(key => !dictionarySets[language].has(key))
  ]));
  const effectiveRuntimeCatalogs = Object.fromEntries(languages.map(language => [
    language,
    Object.assign({}, BASE_CATALOGS[language], ...DOMAIN_CATALOGS.map(catalog => catalog[language] || {}))
  ]));
  const invalidRuntimeValuesByLanguage = Object.fromEntries(languages.map(language => [
    language,
    runtimeKeys.filter(key => !validTranslationValue(effectiveRuntimeCatalogs[language], key))
  ]));
  const guideMessages = guide.messages || {};
  const missingGuideByLanguage = Object.fromEntries(languages.map(language => {
    const available = new Set(Object.keys(guideMessages[language] || {}));
    return [language, guideKeys.filter(key => !available.has(key))];
  }));

  const nodeById = new Map(topology.nodes.map(node => [node.id, node]));
  const pageTranslationEdges = topology.edges.filter(edge => PAGE_RUNTIME_RELATIONS.has(edge.relation))
    .map(edge => ({ ...edge, page: nodeById.get(edge.source)?.page, key: keyFromTarget(edge.target) }))
    .filter(edge => edge.page && edge.key);
  const missingPageRuntimeByLanguage = Object.fromEntries(languages.map(language => {
    const byPage = new Map();
    for (const edge of pageTranslationEdges) {
      const catalog = { ...BASE_CATALOGS[language], ...pageDomainCatalog(edge.page, language) };
      if (validTranslationValue(catalog, edge.key)) continue;
      const identity = `${edge.page}\u0000${edge.key}`;
      if (!byPage.has(identity)) byPage.set(identity, { page: edge.page, key: edge.key, relation: edge.relation });
    }
    return [language, [...byPage.values()].sort((left, right) => left.page.localeCompare(right.page) || left.key.localeCompare(right.key))];
  }));
  const translatedSources = new Set(topology.edges
    .filter(edge => DECLARATIVE_RELATIONS.has(edge.relation))
    .map(edge => edge.source));
  const pageChildren = new Map();
  for (const edge of topology.edges.filter(edge => edge.relation === 'ui_contains' || edge.relation === 'ui_contains_surface')) {
    if (!pageChildren.has(edge.source)) pageChildren.set(edge.source, []);
    pageChildren.get(edge.source).push(edge.target);
  }
  const pages = topology.nodes.filter(node => node.file_type === 'ui_page').map(pageNode => {
    const page = pageNode.label;
    const children = pageChildren.get(pageNode.id) || [];
    const controls = children.filter(id => nodeById.get(id)?.file_type === 'ui_control');
    const surfaces = children.filter(id => nodeById.get(id)?.file_type === 'ui_surface');
    const translatedElements = children.filter(id => translatedSources.has(id));
    const literalData = inventory.html.pages[`Frontend/public/${page}`] || {
      translationMarkers: 0,
      literalText: 0,
      literalAttributes: 0
    };
    return {
      page,
      controls: controls.length,
      surfaces: surfaces.length,
      translatedElements: translatedElements.length,
      ...literalData,
      literalDebt: literalData.literalText + literalData.literalAttributes
    };
  }).sort((left, right) => right.literalDebt - left.literalDebt || left.page.localeCompare(right.page));

  const declarativeEdges = topology.edges.filter(edge => DECLARATIVE_RELATIONS.has(edge.relation));
  const translationAttributeEdges = {
    text: declarativeEdges.filter(edge => edge.relation === 'ui_translates_with').length,
    placeholder: declarativeEdges.filter(edge => edge.relation === 'ui_translates_placeholder_with').length,
    aria: declarativeEdges.filter(edge => edge.relation === 'ui_translates_aria_with').length,
    title: declarativeEdges.filter(edge => edge.relation === 'ui_translates_title_with').length,
    alt: declarativeEdges.filter(edge => edge.relation === 'ui_translates_alt_with').length
  };
  const literalSinkFiles = countBy(inventory.javascript.literalSinks, item => item.file);
  const runtimeMissingTotal = Object.values(missingRuntimeByLanguage).reduce((total, keys) => total + keys.length, 0);
  const invalidRuntimeValueTotal = Object.values(invalidRuntimeValuesByLanguage).reduce((total, keys) => total + keys.length, 0);
  const pageRuntimeMissingTotal = Object.values(missingPageRuntimeByLanguage).reduce((total, entries) => total + entries.length, 0);
  const guideFallbackLanguages = languages.filter(language => missingGuideByLanguage[language].length > 0);
  const errors = [];
  if (runtimeMissingTotal) errors.push(`Chiavi runtime mancanti: ${runtimeMissingTotal}`);
  if (invalidRuntimeValueTotal) errors.push(`Valori runtime vuoti o tecnici: ${invalidRuntimeValueTotal}`);
  if (pageRuntimeMissingTotal) errors.push(`Chiavi non disponibili nel catalogo effettivamente caricato dalla pagina: ${pageRuntimeMissingTotal}`);
  if ((missingGuideByLanguage[guide.fallbackLocale] || []).length) {
    errors.push(`La guida non è completa nella lingua fallback ${guide.fallbackLocale}`);
  }
  if (topology.diagnostics.contractErrors.length || topology.diagnostics.guideErrors.length) {
    errors.push('La topologia contiene errori di contratto o guida');
  }
  const warnings = [];
  if (guideFallbackLanguages.length) {
    warnings.push(`Guida disponibile direttamente solo in ${guide.fallbackLocale}; fallback per: ${guideFallbackLanguages.filter(language => language !== guide.fallbackLocale).join(', ')}`);
  }
  if (inventory.html.literals.length || inventory.javascript.literalSinks.length) {
    warnings.push('Il debito letterale residuo richiede revisione editoriale/runtime e non consente di dichiarare la traduzione visiva completa.');
  }

  return {
    schemaVersion: 1,
    sourceFingerprint: topology.sourceFingerprint,
    languages,
    fallbackLocale: guide.fallbackLocale,
    summary: {
      pages: pages.length,
      runtimeKeys: runtimeKeys.length,
      guideKeys: guideKeys.length,
      runtimeMissingTotal,
      invalidRuntimeValueTotal,
      pageRuntimeMissingTotal,
      guideFallbackLanguages: guideFallbackLanguages.filter(language => language !== guide.fallbackLocale).length,
      htmlLiteralSegments: inventory.html.literals.filter(item => item.kind === 'text').length,
      htmlLiteralAttributes: inventory.html.literals.filter(item => item.kind !== 'text').length,
      javascriptLiteralSinkCandidates: inventory.javascript.literalSinks.length,
      translatedElements: translatedSources.size
    },
    translationAttributeEdges,
    runtimeKeys,
    guideKeys,
    missingRuntimeByLanguage,
    invalidRuntimeValuesByLanguage,
    missingPageRuntimeByLanguage,
    missingGuideByLanguage,
    pages,
    javascriptLiteralSinkFiles: literalSinkFiles,
    htmlLiteralCandidates: inventory.html.literals,
    javascriptLiteralSinkCandidates: inventory.javascript.literalSinks,
    errors,
    warnings
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const audit = buildUiTranslationAudit();
  console.log(`Topologia traduzioni: ${audit.summary.pages} pagine · ${audit.summary.runtimeKeys} chiavi runtime · ${audit.languages.length} lingue`);
  console.table(audit.languages.map(language => ({
    language,
    runtimeMissing: audit.missingRuntimeByLanguage[language].length,
    invalidValues: audit.invalidRuntimeValuesByLanguage[language].length,
    pageMissing: audit.missingPageRuntimeByLanguage[language].length,
    guideMissing: audit.missingGuideByLanguage[language].length,
    guideMode: audit.missingGuideByLanguage[language].length ? `fallback ${audit.fallbackLocale}` : 'diretta'
  })));
  console.log(`Marcatori UI: ${Object.entries(audit.translationAttributeEdges).map(([key, value]) => `${key}=${value}`).join(' · ')}`);
  console.log(`Debito da riesaminare: HTML testo=${audit.summary.htmlLiteralSegments} · attributi=${audit.summary.htmlLiteralAttributes} · sink JS=${audit.summary.javascriptLiteralSinkCandidates}`);
  console.table(audit.pages.filter(page => page.literalDebt > 0).slice(0, 12));
  for (const warning of audit.warnings) console.warn(`Avviso: ${warning}`);
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) {
    const output = path.resolve(process.argv[outputIndex + 1]);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log(`Report JSON: ${path.relative(projectRoot, output).replaceAll('\\', '/')}`);
  }
  if (audit.errors.length) {
    for (const error of audit.errors) console.error(`Errore: ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Audit topologico delle traduzioni runtime: OK');
  }
}
