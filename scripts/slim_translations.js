/**
 * SCRIPT: Estrai chiavi translations usate nella codebase
 * Scansiona tutti i file JS/HTML, trova tutte le chiamate t('chiave'),
 * poi genera translations.slim.js con solo quelle chiavi.
 * 
 * Uso: node scripts/slim_translations.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'Frontend', 'public');
const TRANSLATIONS_FILE = path.join(ROOT, 'assets', 'js', 'translations.js');
const OUTPUT_FILE = path.join(ROOT, 'assets', 'js', 'translations.slim.js');
const MODULES_DIR = path.join(ROOT, 'assets', 'js');

// ── 1. Carica translations.js e estrai l'oggetto ─────────────────────────
function loadTranslations() {
    let src = fs.readFileSync(TRANSLATIONS_FILE, 'utf8');
    
    // Rimuovi export e wrapping
    src = src.replace(/^export\s+default\s+/, '');
    src = src.replace(/^const\s+\w+\s*=\s*/, '');
    src = src.replace(/;\s*export\s+default\s+\w+\s*;?\s*$/, '');
    src = src.replace(/;\s*export\s+\{[^}]+\}\s*;?\s*$/, '');
    
    // Rimuovi trailing semicolon se presente
    src = src.trimEnd().replace(/;$/, '');
    
    try {
        return eval('(' + src + ')');
    } catch (e) {
        console.error('Errore parsing translations:', e.message);
        process.exit(1);
    }
}

// ── 2. Scansiona il codice e trova tutte le chiavi usate ────────────────
function findUsedKeys(dir) {
    const usedKeys = new Set();
    
    // Pattern: t('key') o t("key") o data-t="key" o data-t-placeholder="key" o data-t-aria="key"
    const patterns = [
        /\bt\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\)/g,
        /data-t(?:-placeholder|-aria)?\s*=\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g,
    ];
    
    function scanFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                usedKeys.add(match[1]);
            }
        }
    }
    
    function scanDir(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(d, entry.name);
            if (entry.isDirectory()) {
                // Skip node_modules e directory non rilevanti
                if (!['node_modules', '.git', 'sw.js'].includes(entry.name)) {
                    scanDir(fullPath);
                }
            } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
                // Skip translations stessi per non auto-referenziarsi
                if (!entry.name.startsWith('translations')) {
                    scanFile(fullPath);
                }
            }
        }
    }
    
    scanDir(dir);
    return usedKeys;
}

// ── 3. Genera il file slim ───────────────────────────────────────────────
function generateSlim(allTranslations, usedKeys) {
    const slim = {};
    let foundCount = 0;
    let missingCount = 0;
    const missing = [];
    
    for (const key of usedKeys) {
        if (key in allTranslations) {
            slim[key] = allTranslations[key];
            foundCount++;
        } else {
            missingCount++;
            missing.push(key);
        }
    }
    
    // Chiavi sempre incluse (UI core anche se non trovate dal regex)
    const alwaysInclude = ['error', 'success', 'warning', 'info', 'cancel', 'confirm', 'save', 'delete', 'edit', 'close', 'back', 'next', 'loading', 'error_generic'];
    for (const key of alwaysInclude) {
        if (key in allTranslations && !(key in slim)) {
            slim[key] = allTranslations[key];
            foundCount++;
        }
    }
    
    console.log(`\n📊 ANALISI CHIAVI:`);
    console.log(`   Totale chiavi nel file originale: ${Object.keys(allTranslations).length}`);
    console.log(`   Chiavi usate trovate nel codice:  ${usedKeys.size}`);
    console.log(`   Chiavi estratte nel file slim:    ${Object.keys(slim).length}`);
    console.log(`   Chiavi usate ma non trovate:      ${missingCount}`);
    
    if (missing.length > 0) {
        console.log(`\n⚠️  Chiavi usate ma mancanti nel file translations:`);
        missing.forEach(k => console.log(`   - ${k}`));
    }
    
    // Genera output con stessa struttura dell'originale
    const entries = Object.entries(slim)
        .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
        .join(',\n');
    
    const totalOrig = Object.keys(allTranslations).length;
    const totalSlim = Object.keys(slim).length;
    const reduction = Math.round((1 - totalSlim / totalOrig) * 100);
    
    const output = `/**
 * TRANSLATIONS SLIM (Auto-generato da slim_translations.js)
 * Contiene solo le ${totalSlim} chiavi effettivamente usate nella codebase
 * su ${totalOrig} totali (riduzione: ${reduction}%).
 * 
 * Per rigenerare: node scripts/slim_translations.js
 * File originale completo: translations.full.js
 */

const it = {
${entries}
};

export function t(key) {
    return it[key] || key;
}

export default it;
`;
    
    return { output, slim, foundCount, missingCount, missing };
}

// ── MAIN ─────────────────────────────────────────────────────────────────
console.log('🔍 Caricamento translations.js...');
const allTranslations = loadTranslations();
console.log(`   Chiavi totali: ${Object.keys(allTranslations).length}`);

console.log('\n🔍 Scansione codebase per chiavi usate...');
const usedKeys = findUsedKeys(ROOT);
console.log(`   Chiavi trovate nel codice: ${usedKeys.size}`);

console.log('\n✂️  Generazione file slim...');
const { output, slim } = generateSlim(allTranslations, usedKeys);

fs.writeFileSync(OUTPUT_FILE, output, 'utf8');

const origSize = fs.statSync(TRANSLATIONS_FILE).size;
const slimSize = fs.statSync(OUTPUT_FILE).size;
const reduction = Math.round((1 - slimSize / origSize) * 100);

console.log(`\n✅ RISULTATO:`);
console.log(`   File originale: ${Math.round(origSize / 1024)}KB → ${TRANSLATIONS_FILE}`);
console.log(`   File slim:      ${Math.round(slimSize / 1024)}KB → ${OUTPUT_FILE}`);
console.log(`   Riduzione:      ${reduction}% (${Math.round((origSize - slimSize) / 1024)}KB risparmiati)`);
console.log(`\n   Prossimo passo: rinomina translations.js → translations.full.js`);
console.log(`                    e translations.slim.js → translations.js`);
