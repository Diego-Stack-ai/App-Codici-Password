import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const publicRoot = path.join(projectRoot, 'Frontend', 'public');
const baseline = JSON.parse(fs.readFileSync(path.join(scriptDir, 'ui-quality-baseline.json'), 'utf8'));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const files = walk(publicRoot).filter(file => !file.includes('ui-preview'));
const cssFiles = files.filter(file => file.endsWith('.css'));
const markupFiles = files.filter(file => /\.(?:html|js)$/.test(file));
const findings = { smallFontDeclarations: 0, hardcodedFontDeclarations: 0, inlineStyleDeclarations: 0, nativeDialogs: 0 };
const smallByFile = new Map();

for (const file of cssFiles) {
  const source = fs.readFileSync(file, 'utf8');
  findings.hardcodedFontDeclarations += (source.match(/font-size\s*:\s*(?!var\()/g) || []).length;
  for (const match of source.matchAll(/font-size\s*:\s*([\d.]+)(px|rem)/g)) {
    const pixels = match[2] === 'rem' ? Number(match[1]) * 16 : Number(match[1]);
    if (pixels < 12) {
      findings.smallFontDeclarations += 1;
      const relative = path.relative(projectRoot, file);
      smallByFile.set(relative, (smallByFile.get(relative) || 0) + 1);
    }
  }
}

for (const file of markupFiles) {
  const source = fs.readFileSync(file, 'utf8');
  findings.inlineStyleDeclarations += (source.match(/style\s*=|style\s*:/g) || []).length;
  findings.nativeDialogs += (source.match(/\b(?:alert|confirm|prompt)\s*\(/g) || []).length;
}

const coreFonts = fs.readFileSync(path.join(publicRoot, 'assets', 'css', 'core_fonts.css'), 'utf8');
const core = fs.readFileSync(path.join(publicRoot, 'assets', 'css', 'core.css'), 'utf8');
const theme = fs.readFileSync(path.join(publicRoot, 'assets', 'js', 'theme-init.js'), 'utf8');
const components = fs.readFileSync(path.join(publicRoot, 'assets', 'js', 'components-v129.js'), 'utf8');
const home = fs.readFileSync(path.join(publicRoot, 'home_page.html'), 'utf8');
const privateAccountCss = [
  'area_privata.css',
  'account_privati.css',
  'form_account_privato.css',
  'dettaglio_account_privato.css'
].map(name => fs.readFileSync(path.join(publicRoot, 'assets', 'css', name), 'utf8')).join('\n');
const companyAccountCss = [
  'lista_aziende.css',
  'dati_azienda.css',
  'account_azienda.css',
  'form_account_azienda.css',
  'dettaglio_account_azienda.css'
].map(name => fs.readFileSync(path.join(publicRoot, 'assets', 'css', name), 'utf8')).join('\n');
const deadlineCss = [
  'scadenze.css',
  'aggiungi_scadenza.css',
  'dettaglio_scadenza.css'
].map(name => fs.readFileSync(path.join(publicRoot, 'assets', 'css', name), 'utf8')).join('\n');
const remainingUiCss = [
  'profilo_privato.css',
  'impostazioni.css',
  'archivio_account.css',
  'regole_scadenze.css',
  'configurazione_automezzi.css',
  'configurazione_documenti.css',
  'configurazione_generali.css',
  'vault-assistant.css'
].map(name => fs.readFileSync(path.join(publicRoot, 'assets', 'css', name), 'utf8')).join('\n');
const requiredSignals = [
  ['token --text-body', coreFonts.includes('--text-body:')],
  ['token --touch-target-min', core.includes('--touch-target-min:')],
  ['supporto movimento ridotto', core.includes('prefers-reduced-motion')],
  ['tema security-dark', theme.includes("themeMode = 'security-dark'")],
  ['header senza elemento fisso annidato', components.includes('setChildren(headerPh, headerContent)') && !components.includes("createElement('header', { className: 'base-header' }")],
  ['saluto Home con tipografia semantica', components.includes("className: 'header-greeting'") && !components.includes('text-[9px]')],
  ['versione Home senza stile inline', /<div class="version-display">/.test(home)],
  ['assistente AI collocato nell’header', components.includes("headerRight.appendChild(assistantStatus)") && home.includes('class="ai-assistant-label"')],
  ['account personali senza testi inferiori a 12px', !/font-size\s*:\s*(?:[0-9]|1[01])px/.test(privateAccountCss)],
  ['azioni account personali con target tattile', privateAccountCss.includes('width: var(--touch-target-min, 44px)')],
  ['card personali allineate nella griglia', /\.account-card\s*\{[\s\S]*?display:\s*flex;/.test(privateAccountCss) && /\.account-card \.swipe-content\s*\{[\s\S]*?flex:\s*1;/.test(privateAccountCss)],
  ['account aziendali senza testi inferiori a 12px', !/font-size\s*:\s*(?:[0-9]|1[01])px/.test(companyAccountCss)],
  ['azioni account aziendali con target tattile', companyAccountCss.includes('width: var(--touch-target-min, 44px)')],
  ['card aziendali allineate nella griglia', /\.account-card\s*\{[\s\S]*?display:\s*flex;/.test(companyAccountCss) && /\.account-card \.swipe-content\s*\{[\s\S]*?flex:\s*1;/.test(companyAccountCss)],
  ['scadenze senza testi inferiori a 12px', !/font-size\s*:\s*(?:[0-9]|1[01])px/.test(deadlineCss)],
  ['azioni scadenze con target tattile', deadlineCss.includes('width: var(--touch-target-min, 44px)')],
  ['controlli rimanenti con target tattile', (remainingUiCss.match(/var\(--touch-target-min, 44px\)/g) || []).length >= 12],
  ['assistente contenuto nel viewport', remainingUiCss.includes('max-height: calc(100dvh') && remainingUiCss.includes('overscroll-behavior: contain')]
];

const regressions = Object.entries(baseline).filter(([key, limit]) => findings[key] > limit);
const missing = requiredSignals.filter(([, present]) => !present);

console.log('Audit fondazioni UI');
console.table(findings);
console.log('Testi sotto 12px da ridurre progressivamente:');
console.table([...smallByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, count]) => ({ file, count })));

if (regressions.length || missing.length) {
  for (const [key, limit] of regressions) console.error(`Regressione: ${key} = ${findings[key]} (baseline ${limit})`);
  for (const [name] of missing) console.error(`Fondazione mancante: ${name}`);
  process.exitCode = 1;
} else {
  console.log('Nessuna nuova discrepanza rispetto alla baseline; fondazioni presenti.');
}
