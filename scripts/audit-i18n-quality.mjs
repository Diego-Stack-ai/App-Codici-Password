import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const publicRoot = path.join(projectRoot, 'Frontend', 'public');
const baselinePath = path.join(scriptDir, 'i18n-quality-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

const normalize = value => value.replace(/\\/g, '/');
const relative = file => normalize(path.relative(projectRoot, file));
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [absolute];
});
const isExcluded = file => baseline.excludedPathFragments.some(fragment => `/${relative(file)}`.includes(fragment));
const sourceFiles = walk(publicRoot).filter(file => /\.(?:html|js)$/.test(file) && !isExcluded(file));
const htmlFiles = sourceFiles.filter(file => file.endsWith('.html'));
const jsFiles = sourceFiles.filter(file => file.endsWith('.js'));

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function dictionaryKeys(source) {
  return [...source.matchAll(/^\s{4,}(?:"([^"]+)"|([A-Za-z0-9_.-]+))\s*:/gm)].map(match => match[1] || match[2]);
}

function readDictionaries() {
  const translationsPath = path.join(publicRoot, 'assets', 'js', 'translations.js');
  const source = fs.readFileSync(translationsPath, 'utf8');
  const languagesMatch = source.match(/APP_LANGUAGE_CODES\s*=\s*\[([^\]]+)\]/);
  const declaredLanguages = languagesMatch
    ? [...languagesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])
    : [];
  const start = source.indexOf('const _it = {');
  const end = source.indexOf('\n};', start);
  const dictionaries = { it: dictionaryKeys(source.slice(start, end)) };
  for (const language of declaredLanguages.filter(language => language !== 'it')) {
    const file = path.join(publicRoot, 'assets', 'js', 'translations', `${language}.js`);
    dictionaries[language] = fs.existsSync(file) ? dictionaryKeys(fs.readFileSync(file, 'utf8')) : [];
  }
  return { declaredLanguages, dictionaries };
}

function collectKeyUsage() {
  const usage = new Map();
  const add = (key, file, index, kind) => {
    if (!usage.has(key)) usage.set(key, []);
    usage.get(key).push({ file: relative(file), line: lineOf(fs.readFileSync(file, 'utf8'), index), kind });
  };
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const declarative = /data-t(?:-placeholder|-title|-aria)?\s*=\s*["']([^"']+)["']/g;
    const programmatic = /(?<![A-Za-z0-9_$])t\(\s*["']([^"']+)["']/g;
    for (const match of source.matchAll(declarative)) add(match[1], file, match.index, 'data-t');
    for (const match of source.matchAll(programmatic)) add(match[1], file, match.index, 't()');
  }
  return usage;
}

function isAllowlistedLiteral(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || !/[A-Za-zÀ-ÿ\u0900-\u097F\u4E00-\u9FFF]/u.test(normalized)) return true;
  if (/^(?:https?:|mailto:|tel:|\.\/|\.\.\/|\/assets\/)/.test(normalized)) return true;
  if (/^[A-Za-z0-9_.-]+\.(?:html|js|css|json|svg|png|jpg|webp)$/i.test(normalized)) return true;
  return baseline.nonTranslatableExact.includes(normalized);
}

function collectHtmlLiterals() {
  const findings = [];
  const pages = {};
  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const page = relative(file);
    const pageFindings = [];
    const withoutNonUi = source
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<!--([\s\S]*?)-->/g, '');
    for (const match of withoutNonUi.matchAll(/>([^<>]+)</g)) {
      const value = match[1].replace(/\s+/g, ' ').trim();
      if (isAllowlistedLiteral(value)) continue;
      const before = withoutNonUi.slice(Math.max(0, match.index - 220), match.index);
      if (/material-(?:symbols|icons)[^>]*>[^<]*$/i.test(before)) continue;
      pageFindings.push({ file: page, line: lineOf(withoutNonUi, match.index), kind: 'text', value });
    }
    for (const match of withoutNonUi.matchAll(/\b(placeholder|title|aria-label|alt)\s*=\s*["']([^"']+)["']/gi)) {
      const value = match[2].replace(/\s+/g, ' ').trim();
      const tagStart = withoutNonUi.lastIndexOf('<', match.index);
      const tag = withoutNonUi.slice(tagStart, withoutNonUi.indexOf('>', match.index) + 1);
      const translatedAttribute = match[1].toLowerCase() === 'placeholder' ? 'data-t-placeholder'
        : match[1].toLowerCase() === 'title' ? 'data-t-title'
          : match[1].toLowerCase() === 'aria-label' ? 'data-t-aria' : 'data-t-alt';
      if (tag.includes(translatedAttribute) || isAllowlistedLiteral(value)) continue;
      pageFindings.push({ file: page, line: lineOf(withoutNonUi, match.index), kind: match[1].toLowerCase(), value });
    }
    findings.push(...pageFindings);
    pages[page] = {
      translationMarkers: (source.match(/data-t(?:-placeholder|-title|-aria)?\s*=/g) || []).length,
      literalText: pageFindings.filter(item => item.kind === 'text').length,
      literalAttributes: pageFindings.filter(item => item.kind !== 'text').length
    };
  }
  return { findings, pages };
}

function collectJsLiteralSinks() {
  const findings = [];
  const patterns = [
    ['textContent', /\btextContent\s*(?::|=)\s*(["'`])([^\n]*?)\1/g],
    ['toast', /\bshowToast\s*\(\s*(["'`])([^\n]*?)\1/g],
    ['aria', /setAttribute\(\s*["'](?:aria-label|title)["']\s*,\s*(["'`])([^\n]*?)\1/g],
    ['dialog', /\b(?:alert|confirm|prompt)\s*\(\s*(["'`])([^\n]*?)\1/g]
  ];
  for (const file of jsFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [kind, pattern] of patterns) {
      for (const match of source.matchAll(pattern)) {
        const value = match[2].replace(/\\[nrt]/g, ' ').replace(/\s+/g, ' ').trim();
        if (isAllowlistedLiteral(value) || /\bt\(\s*["']/.test(value)) continue;
        findings.push({ file: relative(file), line: lineOf(source, match.index), kind, value });
      }
    }
  }
  return findings;
}

function collectOnboardingLanguages() {
  const file = path.join(publicRoot, 'assets', 'js', 'translations', 'onboarding.js');
  const source = fs.readFileSync(file, 'utf8');
  return [...source.matchAll(/^const\s+([a-z]{2})\s*=\s*\{/gm)].map(match => match[1]);
}

export function buildI18nInventory() {
  const { declaredLanguages, dictionaries } = readDictionaries();
  const usage = collectKeyUsage();
  const usedKeys = [...usage.keys()].sort();
  const duplicateKeys = Object.fromEntries(Object.entries(dictionaries).map(([language, keys]) => {
    const seen = new Set();
    return [language, keys.filter(key => seen.has(key) || !seen.add(key))];
  }));
  const missingKeysByLanguage = Object.fromEntries(Object.entries(dictionaries).map(([language, keys]) => {
    const available = new Set(keys);
    return [language, usedKeys.filter(key => !available.has(key))];
  }));
  const html = collectHtmlLiterals();
  const jsLiteralSinks = collectJsLiteralSinks();
  const onboardingLanguages = collectOnboardingLanguages();
  return {
    schemaVersion: 1,
    declaredLanguages,
    completeLanguages: baseline.completeLanguages,
    dictionaries: Object.fromEntries(Object.entries(dictionaries).map(([language, keys]) => [language, { keys: keys.length }])),
    usedKeys: { count: usedKeys.length, keys: usedKeys, locations: Object.fromEntries(usage) },
    duplicateKeys,
    missingKeysByLanguage,
    onboardingLanguages,
    onboardingMissingLanguages: declaredLanguages.filter(language => !onboardingLanguages.includes(language)),
    html: { pages: html.pages, literals: html.findings },
    javascript: { literalSinks: jsLiteralSinks }
  };
}

export function evaluateI18nBaseline(inventory = buildI18nInventory()) {
  const metrics = {
    missingItalianKeys: inventory.missingKeysByLanguage.it?.length || 0,
    missingKeysByLanguage: Object.fromEntries(Object.entries(inventory.missingKeysByLanguage).map(([language, keys]) => [language, keys.length])),
    onboardingMissingLanguages: inventory.onboardingMissingLanguages.length,
    htmlLiteralSegments: inventory.html.literals.filter(item => item.kind === 'text').length,
    htmlLiteralAttributes: inventory.html.literals.filter(item => item.kind !== 'text').length,
    jsLiteralSinks: inventory.javascript.literalSinks.length
  };
  const regressions = [];
  if (JSON.stringify(inventory.declaredLanguages) !== JSON.stringify(baseline.declaredLanguages)) {
    regressions.push(`Lingue dichiarate cambiate senza aggiornare la specifica: ${inventory.declaredLanguages.join(', ')}`);
  }
  for (const [language, duplicates] of Object.entries(inventory.duplicateKeys)) {
    if (duplicates.length) regressions.push(`Chiavi duplicate ${language}: ${duplicates.join(', ')}`);
  }
  for (const language of baseline.completeLanguages) {
    if ((metrics.missingKeysByLanguage[language] || 0) !== 0) regressions.push(`Lingua completa ${language} con chiavi mancanti`);
  }
  const scalarKeys = ['missingItalianKeys', 'onboardingMissingLanguages', 'htmlLiteralSegments', 'htmlLiteralAttributes', 'jsLiteralSinks'];
  for (const key of scalarKeys) {
    if (metrics[key] > baseline.debt[key]) regressions.push(`${key}=${metrics[key]} supera baseline=${baseline.debt[key]}`);
  }
  for (const [language, value] of Object.entries(metrics.missingKeysByLanguage)) {
    const limit = baseline.debt.missingKeysByLanguage[language];
    if (limit === undefined || value > limit) regressions.push(`missingKeysByLanguage.${language}=${value} supera baseline=${limit ?? 'assente'}`);
  }
  return { metrics, regressions, baseline };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = buildI18nInventory();
  const result = evaluateI18nBaseline(inventory);
  console.log('Audit i18n — baseline non peggiorabile');
  console.table(Object.entries(inventory.dictionaries).map(([language, data]) => ({
    language,
    dictionaryKeys: data.keys,
    missingUsedKeys: result.metrics.missingKeysByLanguage[language]
  })));
  console.table(result.metrics);
  console.log('Debito per pagina (prime 12):');
  console.table(Object.entries(inventory.html.pages)
    .map(([page, data]) => ({ page, ...data, debt: data.literalText + data.literalAttributes }))
    .sort((a, b) => b.debt - a.debt)
    .slice(0, 12));
  if (process.argv.includes('--json')) console.log(JSON.stringify(inventory, null, 2));
  if (result.regressions.length) {
    result.regressions.forEach(item => console.error(`Regressione: ${item}`));
    process.exitCode = 1;
  } else {
    console.log(`Il debito i18n non supera la baseline ${baseline.sourceVersion}. La baseline non certifica completezza editoriale.`);
  }
}
