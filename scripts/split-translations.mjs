/**
 * split-translations.mjs — V2
 * Parse testuale di translations.js senza bisogno di import ES6 cross-module.
 * Estrae ogni sezione lingua e crea file separati.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const transFile = path.join(root, 'Frontend', 'public', 'assets', 'js', 'translations.js');
const outDir   = path.join(root, 'Frontend', 'public', 'assets', 'js', 'translations');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const src = fs.readFileSync(transFile, 'utf8');

// Lingue supportate
const LANGUAGES = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];

/**
 * Estrae il blocco {...} di una lingua dal sorgente.
 * Usa un counter di parentesi per gestire correttamente nesting.
 */
function extractLangBlock(source, lang) {
    // Cerca l'inizio della sezione (es. "    it: {")
    const startMarker = new RegExp(`^\\s{4}${lang}:\\s*\\{`, 'm');
    const startMatch = startMarker.exec(source);
    if (!startMatch) return null;

    const start = startMatch.index + startMatch[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') depth--;
        i++;
    }
    // il blocco è da start a i-1 (escludi la parentesi di chiusura)
    return source.slice(start, i - 1);
}

/**
 * Converte il blocco testuale "key: \"value\",\n" in un oggetto JS.
 * Usa eval in modo sicuro (sorgente trusted, locale).
 */
function blockToObject(block) {
    try {
        return eval('({' + block + '})');
    } catch(e) {
        console.error('Parse error:', e.message);
        return null;
    }
}

let savedBytes = 0;

for (const lang of LANGUAGES) {
    if (lang === 'it') continue; // Italiano rimane inline

    const block = extractLangBlock(src, lang);
    if (!block) { console.warn(`⚠️  Lingua non trovata: ${lang}`); continue; }

    const dict = blockToObject(block);
    if (!dict) { console.error(`❌  Parse fallito per: ${lang}`); continue; }

    const count = Object.keys(dict).length;
    const content =
        `// Auto-generated — Non modificare manualmente\n` +
        `// Rigenera con: node scripts/split-translations.mjs\n` +
        `// Lingua: ${lang} — ${count} chiavi\n` +
        `export default ${JSON.stringify(dict, null, 4)};\n`;

    const outPath = path.join(outDir, `${lang}.js`);
    fs.writeFileSync(outPath, content, 'utf8');
    const bytes = Buffer.byteLength(content, 'utf8');
    savedBytes += bytes;
    console.log(`✅  ${lang}.js — ${count} chiavi — ${(bytes / 1024).toFixed(1)} KB`);
}

console.log(`\n📦  File creati in: ${outDir}`);
console.log(`📉  Peso spostato fuori dal bundle: ${(savedBytes / 1024).toFixed(1)} KB`);
