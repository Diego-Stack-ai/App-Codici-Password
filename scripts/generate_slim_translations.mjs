/**
 * Script: genera translations.slim.js con le sole chiavi usate nella codebase.
 * Uso: node scripts/generate_slim_translations.mjs
 */

import { readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'Frontend', 'public');
const TRANS_FILE = join(ROOT, 'assets', 'js', 'translations.js');
const USED_KEYS_FILE = join(__dirname, '..', 'used_keys.txt');
const OUTPUT = join(ROOT, 'assets', 'js', 'translations.slim.js');

const LANGS = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];

// Leggi le chiavi usate
const usedKeys = new Set(
    readFileSync(USED_KEYS_FILE, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
);

// Estrai coppie chiave:valore da una sezione lingua
function extractSection(src, lang) {
    const langPattern = new RegExp(`\\b${lang}:\\s*\\{`);
    const startMatch = langPattern.exec(src);
    if (!startMatch) return {};
    const start = startMatch.index + startMatch[0].length;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
    }
    const body = src.substring(start, i - 1);
    const result = {};
    const pairPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),?\s*$/mg;
    let m;
    while ((m = pairPattern.exec(body)) !== null) {
        result[m[1]] = m[2].slice(1, -1);
    }
    return result;
}

// Chiavi sempre incluse (UI core)
const alwaysInclude = new Set([
    'error', 'success', 'warning', 'info', 'cancel', 'confirm', 'save',
    'delete', 'edit', 'close', 'back', 'next', 'loading', 'error_generic',
    'copied', 'ok', 'add_short', 'edit_short', 'save_short', 'cancel_short', 'delete_short'
]);
const finalKeys = new Set([...usedKeys, ...alwaysInclude]);

const src = readFileSync(TRANS_FILE, 'utf8');

// Estrai e filtra tutte le lingue
const allLangs = {};
let itTotal = 0;
for (const lang of LANGS) {
    const all = extractSection(src, lang);
    if (lang === 'it') itTotal = Object.keys(all).length;
    const slim = {};
    for (const k of finalKeys) {
        if (k in all) slim[k] = all[k];
    }
    allLangs[lang] = slim;
}
const itSlimCount = Object.keys(allLangs.it).length;

function objToStr(obj) {
    return Object.entries(obj)
        .map(([k, v]) => `        ${k}: ${JSON.stringify(v)}`)
        .join(',\n');
}

const langSections = LANGS.map(lang =>
    `    ${lang}: {\n${objToStr(allLangs[lang])}\n    }`
).join(',\n');

const today = new Date().toISOString().split('T')[0];
const reduction = Math.round((1 - itSlimCount / itTotal) * 100);

const output = `/**
 * TRANSLATIONS SLIM — Auto-generato il ${today}
 * Contiene SOLO le ${itSlimCount} chiavi usate nella codebase (su ${itTotal} totali per lingua).
 * Riduzione: ~${reduction}% del dizionario. Lingue: ${LANGS.join(', ')}
 *
 * NON MODIFICARE MANUALMENTE — Rigenera con: node scripts/generate_slim_translations.mjs
 * Dizionario completo disponibile in: translations.full.js
 */

export const translations = {
${langSections}
};

export const supportedLanguages = [
    { code: 'it', name: 'Italiano', flag: '\\u{1F1EE}\\u{1F1F9}' },
    { code: 'en', name: 'English', flag: '\\u{1F1FA}\\u{1F1F8}' },
    { code: 'es', name: 'Espa\\u00F1ol', flag: '\\u{1F1EA}\\u{1F1F8}' },
    { code: 'fr', name: 'Fran\\u00E7ais', flag: '\\u{1F1EB}\\u{1F1F7}' },
    { code: 'de', name: 'Deutsch', flag: '\\u{1F1E9}\\u{1F1EA}' },
    { code: 'zh', name: '\\u7B80\\u4F53\\u4E2D\\u6587', flag: '\\u{1F1E8}\\u{1F1F3}' },
    { code: 'hi', name: '\\u0939\\u093F\\u0928\\u094D\\u0926\\u0940', flag: '\\u{1F1EE}\\u{1F1F3}' },
    { code: 'pt', name: 'Portugu\\u00EAs', flag: '\\u{1F1F5}\\u{1F1F9}' }
];

export function getCurrentLanguage() {
    return localStorage.getItem('app_language') || 'it';
}

export function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang]?.[key] || translations['it'][key] || key;
}

export function applyGlobalTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.dataset.t;
        if (!key) return;
        const val = t(key);
        if (val && val !== key) el.textContent = val;
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(el => {
        const key = el.dataset.tPlaceholder;
        if (!key) return;
        const val = t(key);
        if (val && val !== key) el.placeholder = val;
    });
    document.querySelectorAll('[data-t-aria]').forEach(el => {
        const key = el.dataset.tAria;
        if (!key) return;
        const val = t(key);
        if (val && val !== key) el.setAttribute('aria-label', val);
    });
    document.documentElement.setAttribute('data-i18n', 'ready');
}

// Compatibilita con vecchi moduli
window.applyLocalTranslations = applyGlobalTranslations;
`;

writeFileSync(OUTPUT, output, 'utf8');

const origSize = statSync(TRANS_FILE).size;
const slimSize = statSync(OUTPUT).size;

console.log(`\n OK TRANSLATIONS SLIM generato (${LANGS.length} lingue):`);
console.log(`   File originale:  ${Math.round(origSize / 1024)}KB  (${itTotal} chiavi/lingua)`);
console.log(`   File slim:       ${Math.round(slimSize / 1024)}KB  (${itSlimCount} chiavi/lingua)`);
console.log(`   Riduzione:       ${Math.round((1 - slimSize / origSize) * 100)}%`);
