const fs = require('fs');
const path = require('path');

// Configurazione
const publicDir = path.join(__dirname, 'public');
const cssFile = path.join(publicDir, 'assets', 'css', 'operatore.css');
const outputFile = path.join(__dirname, 'css_analysis_report.json');

// Classi "a rischio" che non devono essere rimosse anche se non trovate
const PROTECTED_CLASSES = [
    'active', 'show', 'hidden', 'open', 'selected', 'disabled',
    'loading', 'error', 'success', 'visible', 'collapsed', 'expanded',
    'checked', 'focused', 'hover', 'pressed', 'filled'
];

// Funzione per estrarre classi da HTML
function extractClassesFromHTML(content) {
    const classes = new Set();
    // Match class="..." e class='...'
    const classMatches = content.matchAll(/class=["']([^"']+)["']/g);
    for (const match of classMatches) {
        const classList = match[1].split(/\s+/);
        classList.forEach(cls => {
            if (cls.trim()) classes.add(cls.trim());
        });
    }
    return classes;
}

// Funzione per estrarre ID da HTML
function extractIDsFromHTML(content) {
    const ids = new Set();
    const idMatches = content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of idMatches) {
        if (match[1].trim()) ids.add(match[1].trim());
    }
    return ids;
}

// Funzione per estrarre classi da JavaScript
function extractClassesFromJS(content) {
    const classes = new Set();

    // classList.add('class') o classList.add("class")
    const addMatches = content.matchAll(/classList\.add\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of addMatches) {
        classes.add(match[1]);
    }

    // classList.remove('class')
    const removeMatches = content.matchAll(/classList\.remove\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of removeMatches) {
        classes.add(match[1]);
    }

    // classList.toggle('class')
    const toggleMatches = content.matchAll(/classList\.toggle\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of toggleMatches) {
        classes.add(match[1]);
    }

    // querySelector('.class') e querySelectorAll('.class')
    const queryMatches = content.matchAll(/querySelector(?:All)?\s*\(\s*["']\.([a-zA-Z0-9_-]+)/g);
    for (const match of queryMatches) {
        classes.add(match[1]);
    }

    // getElementsByClassName('class')
    const getByClassMatches = content.matchAll(/getElementsByClassName\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of getByClassMatches) {
        classes.add(match[1]);
    }

    // Template strings con class="${...}" o class='${...}'
    const templateMatches = content.matchAll(/class=["'][^"']*\$\{[^}]*\}[^"']*["']/g);
    for (const match of templateMatches) {
        // Estrai le parti statiche
        const staticParts = match[0].match(/class=["']([^$"']+)/);
        if (staticParts && staticParts[1]) {
            staticParts[1].split(/\s+/).forEach(cls => {
                if (cls.trim()) classes.add(cls.trim());
            });
        }
    }

    // class="..." dentro template strings
    const templateClassMatches = content.matchAll(/`[^`]*class=["']([^"']+)["'][^`]*`/g);
    for (const match of templateClassMatches) {
        const classList = match[1].split(/\s+/);
        classList.forEach(cls => {
            if (cls.trim() && !cls.includes('$')) classes.add(cls.trim());
        });
    }

    return classes;
}

// Funzione per estrarre ID da JavaScript
function extractIDsFromJS(content) {
    const ids = new Set();

    // getElementById('id')
    const getByIdMatches = content.matchAll(/getElementById\s*\(\s*["']([^"']+)["']\s*\)/g);
    for (const match of idMatches) {
        ids.add(match[1]);
    }

    // querySelector('#id')
    const queryIdMatches = content.matchAll(/querySelector(?:All)?\s*\(\s*["']#([a-zA-Z0-9_-]+)/g);
    for (const match of queryIdMatches) {
        ids.add(match[1]);
    }

    return ids;
}

// Funzione per estrarre selettori CSS dal file CSS
function extractSelectorsFromCSS(content) {
    const selectors = {
        classes: new Set(),
        ids: new Set(),
        elements: new Set()
    };

    // Rimuovi commenti
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '');

    // Estrai tutti i selettori
    const selectorMatches = cleanContent.matchAll(/([^{}]+)\s*\{[^}]*\}/g);

    for (const match of selectorMatches) {
        const selectorGroup = match[1];

        // Split per virgola (selettori multipli)
        const individualSelectors = selectorGroup.split(',');

        for (let selector of individualSelectors) {
            selector = selector.trim();

            // Estrai classi (.class)
            const classMatches = selector.matchAll(/\.([a-zA-Z0-9_-]+)/g);
            for (const classMatch of classMatches) {
                selectors.classes.add(classMatch[1]);
            }

            // Estrai ID (#id)
            const idMatches = selector.matchAll(/#([a-zA-Z0-9_-]+)/g);
            for (const idMatch of idMatches) {
                selectors.ids.add(idMatch[1]);
            }
        }
    }

    return selectors;
}

// Funzione ricorsiva per scansionare directory
function scanDirectory(dir, extensions, extractFn) {
    const results = {
        classes: new Set(),
        ids: new Set()
    };

    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory() && file.name !== 'node_modules' && file.name !== '.git') {
            const subResults = scanDirectory(fullPath, extensions, extractFn);
            subResults.classes.forEach(cls => results.classes.add(cls));
            subResults.ids.forEach(id => results.ids.add(id));
        } else if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const extracted = extractFn(content);

                if (extracted.classes) {
                    extracted.classes.forEach(cls => results.classes.add(cls));
                }
                if (extracted.ids) {
                    extracted.ids.forEach(id => results.ids.add(id));
                }
            } catch (err) {
                console.error(`Error reading ${fullPath}:`, err.message);
            }
        }
    }

    return results;
}

// Main analysis
console.log('🔍 Avvio analisi CSS...\n');

// 1. Estrai selettori dal CSS
console.log('📄 Lettura operatore.css...');
const cssContent = fs.readFileSync(cssFile, 'utf-8');
const cssSelectors = extractSelectorsFromCSS(cssContent);
console.log(`   ✓ Trovate ${cssSelectors.classes.size} classi CSS`);
console.log(`   ✓ Trovati ${cssSelectors.ids.size} ID CSS\n`);

// 2. Scansiona HTML
console.log('📄 Scansione file HTML...');
const htmlResults = scanDirectory(publicDir, ['.html'], (content) => ({
    classes: extractClassesFromHTML(content),
    ids: extractIDsFromHTML(content)
}));
console.log(`   ✓ Trovate ${htmlResults.classes.size} classi in HTML`);
console.log(`   ✓ Trovati ${htmlResults.ids.size} ID in HTML\n`);

// 3. Scansiona JavaScript
console.log('📄 Scansione file JavaScript...');
const jsResults = scanDirectory(publicDir, ['.js'], (content) => ({
    classes: extractClassesFromJS(content),
    ids: extractIDsFromJS(content)
}));
console.log(`   ✓ Trovate ${jsResults.classes.size} classi in JS`);
console.log(`   ✓ Trovati ${jsResults.ids.size} ID in JS\n`);

// 4. Combina risultati
const usedClasses = new Set([...htmlResults.classes, ...jsResults.classes]);
const usedIds = new Set([...htmlResults.ids, ...jsResults.ids]);

// 5. Identifica classi non usate
const unusedClasses = new Set();
const usedCssClasses = new Set();
const protectedUnusedClasses = new Set();

for (const cssClass of cssSelectors.classes) {
    if (usedClasses.has(cssClass)) {
        usedCssClasses.add(cssClass);
    } else if (PROTECTED_CLASSES.includes(cssClass)) {
        protectedUnusedClasses.add(cssClass);
    } else {
        unusedClasses.add(cssClass);
    }
}

// 6. Identifica ID non usati
const unusedIds = new Set();
const usedCssIds = new Set();

for (const cssId of cssSelectors.ids) {
    if (usedIds.has(cssId)) {
        usedCssIds.add(cssId);
    } else {
        unusedIds.add(cssId);
    }
}

// 7. Genera report
const report = {
    summary: {
        totalCssClasses: cssSelectors.classes.size,
        totalCssIds: cssSelectors.ids.size,
        usedClasses: usedCssClasses.size,
        usedIds: usedCssIds.size,
        unusedClasses: unusedClasses.size,
        unusedIds: unusedIds.size,
        protectedClasses: protectedUnusedClasses.size,
        usagePercentage: {
            classes: ((usedCssClasses.size / cssSelectors.classes.size) * 100).toFixed(2) + '%',
            ids: cssSelectors.ids.size > 0 ? ((usedCssIds.size / cssSelectors.ids.size) * 100).toFixed(2) + '%' : 'N/A'
        }
    },
    usedClasses: Array.from(usedCssClasses).sort(),
    unusedClasses: Array.from(unusedClasses).sort(),
    protectedClasses: Array.from(protectedUnusedClasses).sort(),
    usedIds: Array.from(usedCssIds).sort(),
    unusedIds: Array.from(unusedIds).sort(),
    classesFoundInCode: Array.from(usedClasses).sort(),
    idsFoundInCode: Array.from(usedIds).sort()
};

// 8. Salva report
fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf-8');

// 9. Stampa risultati
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 REPORT ANALISI CSS - operatore.css');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📈 STATISTICHE GENERALI:');
console.log(`   • Classi CSS totali:        ${report.summary.totalCssClasses}`);
console.log(`   • Classi CSS utilizzate:    ${report.summary.usedClasses} (${report.summary.usagePercentage.classes})`);
console.log(`   • Classi CSS NON usate:     ${report.summary.unusedClasses}`);
console.log(`   • Classi protette:          ${report.summary.protectedClasses}`);
console.log(`   • ID CSS totali:            ${report.summary.totalCssIds}`);
console.log(`   • ID CSS utilizzati:        ${report.summary.usedIds} (${report.summary.usagePercentage.ids})`);
console.log(`   • ID CSS NON usati:         ${report.summary.unusedIds}\n`);

console.log('⚠️  CLASSI PROTETTE (non rimuovere):');
console.log(`   ${Array.from(protectedUnusedClasses).join(', ') || 'Nessuna'}\n`);

console.log(`✅ Report completo salvato in: ${outputFile}\n`);
console.log('═══════════════════════════════════════════════════════════');
