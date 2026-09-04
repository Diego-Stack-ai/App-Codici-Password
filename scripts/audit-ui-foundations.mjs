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
const requiredSignals = [
  ['token --text-body', coreFonts.includes('--text-body:')],
  ['token --touch-target-min', core.includes('--touch-target-min:')],
  ['supporto movimento ridotto', core.includes('prefers-reduced-motion')],
  ['tema security-dark', theme.includes("themeMode = 'security-dark'")]
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
