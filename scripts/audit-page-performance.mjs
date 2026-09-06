import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'Frontend', 'public');
const output = path.join(root, 'docs', 'PAGE_PERFORMANCE_BASELINE.md');
const budgetFile = path.join(root, 'scripts', 'page-performance-budget.json');
const checkOnly = process.argv.includes('--check');
const excludedPages = new Set(['home-v126.html', 'home-v127.html']);
const pageModules = {
  'account_azienda.html': 'assets/js/modules/azienda/account_azienda.js',
  'account_privati.html': 'assets/js/modules/privato/account_privati.js',
  'aggiungi_scadenza.html': 'assets/js/modules/scadenze/aggiungi_scadenza.js',
  'archivio_account.html': 'assets/js/modules/settings/archivio_account.js',
  'area_privata.html': 'assets/js/modules/privato/area_privata.js',
  'configurazione_automezzi.html': 'assets/js/modules/scadenze/configurazione_automezzi.js',
  'configurazione_documenti.html': 'assets/js/modules/scadenze/configurazione_documenti.js',
  'configurazione_generali.html': 'assets/js/modules/scadenze/configurazione_generali.js',
  'dati_azienda.html': 'assets/js/modules/azienda/dati_azienda.js',
  'dettaglio_account_azienda.html': 'assets/js/modules/azienda/dettaglio_account_azienda.js',
  'dettaglio_account_privato.html': 'assets/js/modules/privato/dettaglio_account_privato.js',
  'dettaglio_scadenza.html': 'assets/js/modules/scadenze/dettaglio_scadenza.js',
  'form_account_azienda.html': 'assets/js/modules/azienda/form_account_azienda.js',
  'form_account_privato.html': 'assets/js/modules/privato/form_account_privato.js',
  'gestione_destinatari.html': 'assets/js/modules/shared/gestione-destinatari.js',
  'home_page.html': 'assets/js/modules/home/home.js',
  'imposta_nuova_password.html': 'assets/js/modules/auth/imposta_nuova_password.js',
  'impostazioni.html': 'assets/js/modules/settings/impostazioni.js',
  'lista_aziende.html': 'assets/js/modules/azienda/lista_aziende.js',
  'modifica_azienda.html': 'assets/js/modules/azienda/modifica_azienda.js',
  'profilo_privato.html': 'assets/js/modules/privato/profilo_privato.js',
  'registrati.html': 'assets/js/modules/auth/registrati.js',
  'reset_password.html': 'assets/js/modules/auth/reset_password.js',
  'scadenze.html': 'assets/js/modules/scadenze/scadenze.js'
};
const existsCache = new Map();

async function exists(file) {
  if (!existsCache.has(file)) existsCache.set(file, stat(file).then(() => true).catch(() => false));
  return existsCache.get(file);
}

function cleanRef(value) {
  return value.split('#')[0].split('?')[0].trim();
}

function resolvePublicRef(fromFile, ref) {
  const clean = cleanRef(ref);
  if (!clean || /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(clean)) return null;
  return clean.startsWith('/') ? path.join(publicRoot, clean.slice(1)) : path.resolve(path.dirname(fromFile), clean);
}

async function moduleClosure(entry, visited = new Set()) {
  if (!entry || visited.has(entry) || !await exists(entry) || path.extname(entry) !== '.js') return visited;
  visited.add(entry);
  const source = await readFile(entry, 'utf8');
  const refs = new Set();
  for (const match of source.matchAll(/(?:import\s+(?:[^'"()]*?\sfrom\s*)?|export\s+[^'"()]*?\sfrom\s*)['"]([^'"]+)['"]/g)) refs.add(match[1]);
  for (const ref of refs) await moduleClosure(resolvePublicRef(entry, ref), visited);
  return visited;
}

async function metrics(files) {
  let bytes = 0;
  let gzip = 0;
  for (const file of files) {
    const content = await readFile(file);
    bytes += content.length;
    gzip += gzipSync(content).length;
  }
  return { bytes, gzip };
}

const htmlFiles = (await readdir(publicRoot))
  .filter(name => name.endsWith('.html') && !excludedPages.has(name))
  .sort((a, b) => a.localeCompare(b));
const rows = [];
const budget = JSON.parse(await readFile(budgetFile, 'utf8'));

for (const name of htmlFiles) {
  const htmlFile = path.join(publicRoot, name);
  const html = await readFile(htmlFile, 'utf8');
  const css = new Set([...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map(match => resolvePublicRef(htmlFile, match[1])).filter(Boolean));
  const scriptRefs = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/gi)].map(match => resolvePublicRef(htmlFile, match[1])).filter(Boolean);
  const js = new Set();
  for (const entry of scriptRefs) await moduleClosure(entry, js);
  const pageEntry = pageModules[name] ? path.join(publicRoot, pageModules[name]) : null;
  await moduleClosure(pageEntry, js);
  const localCss = new Set();
  for (const file of css) {
    if (file.startsWith(publicRoot) && await exists(file)) localCss.add(file);
  }
  const localJs = new Set([...js].filter(file => file.startsWith(publicRoot)));
  const all = new Set([htmlFile, ...localCss, ...localJs]);
  const size = await metrics(all);
  rows.push({ name, htmlFile, css: localCss, js: localJs, all, ...size });
}

const formatKb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
const sorted = [...rows].sort((a, b) => b.gzip - a.gzip);
const counts = new Map();
for (const row of rows) for (const file of row.all) counts.set(file, (counts.get(file) || 0) + 1);
const shared = [...counts.entries()].filter(([, count]) => count >= Math.ceil(rows.length * 0.75)).sort((a, b) => b[1] - a[1]);

let markdown = '# Baseline statica delle prestazioni per pagina\n\n';
markdown += '> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.\n\n';
markdown += `Pagine canoniche analizzate: **${rows.length}**. Redirect storici esclusi: ${[...excludedPages].map(name => `\`${name}\``).join(', ')}.\n\n`;
markdown += '| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |\n|---|---:|---:|---:|---:|---:|\n';
for (const row of sorted) markdown += `| \`${row.name}\` | 1 | ${row.css.size} | ${row.js.size} | ${formatKb(row.bytes)} | ${formatKb(row.gzip)} |\n`;

markdown += '\n## Pagine con il maggiore carico statico\n\n';
for (const row of sorted.slice(0, 8)) markdown += `- \`${row.name}\`: ${formatKb(row.gzip)} gzip stimati, ${row.js.size} moduli JS e ${row.css.size} fogli CSS.\n`;

markdown += '\n## Asset condivisi da almeno il 75% delle pagine\n\n';
for (const [file, count] of shared) {
  const relative = path.relative(publicRoot, file).replaceAll('\\', '/');
  const content = await readFile(file);
  markdown += `- \`${relative}\`: ${formatKb(gzipSync(content).length)} gzip stimati, usato da ${count}/${rows.length} pagine.\n`;
}

markdown += '\n## Regola di utilizzo\n\n';
markdown += 'Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.\n';

const ceilings = budget.absoluteStaticCeilings;
const violations = [];
for (const row of rows) {
  const gzipKb = row.gzip / 1024;
  if (gzipKb > ceilings.maxInitialLocalGzipKb) violations.push(`${row.name}: ${gzipKb.toFixed(1)} KB gzip > ${ceilings.maxInitialLocalGzipKb} KB`);
  if (row.js.size > ceilings.maxJsModules) violations.push(`${row.name}: ${row.js.size} moduli JS > ${ceilings.maxJsModules}`);
  if (row.css.size > ceilings.maxCssFiles) violations.push(`${row.name}: ${row.css.size} CSS > ${ceilings.maxCssFiles}`);
}

if (!checkOnly) {
  await writeFile(output, markdown, 'utf8');
  console.log(`Baseline pagine scritta in ${path.relative(root, output)} (${rows.length} pagine).`);
}

if (violations.length) {
  console.error(`Budget statico non rispettato:\n- ${violations.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Budget statico rispettato da ${rows.length} pagine.`);
}
