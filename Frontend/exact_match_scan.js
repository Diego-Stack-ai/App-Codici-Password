const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const cssFile = path.join(publicDir, 'assets', 'css', 'operatore.css');

// Estrai tutte le classi dal CSS
function extractCSSClasses(cssContent) {
    const classes = new Set();
    // Rimuovi commenti
    const cleanCSS = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

    // Trova tutti i selettori di classe
    const classMatches = cleanCSS.matchAll(/\.([a-zA-Z0-9_-]+)/g);
    for (const match of classMatches) {
        classes.add(match[1]);
    }

    return Array.from(classes).sort();
}

// Cerca occorrenze ESATTE di una classe
function findExactMatches(className, filePath, content) {
    const matches = [];
    const lines = content.split('\n');
    const relativePath = path.relative(publicDir, filePath);

    // Pattern per match esatto in HTML: class="... className ..."
    // Deve essere preceduto da inizio stringa, spazio, ", o '
    // Deve essere seguito da spazio, ", ', o fine stringa
    const htmlPattern = new RegExp(
        `class=["']([^"']*\\s)?${className}(\\s[^"']*)?["']`,
        'g'
    );

    // Pattern per classList.add/remove/toggle('className')
    const classListPattern = new RegExp(
        `classList\\.(add|remove|toggle)\\s*\\(\\s*["']${className}["']\\s*\\)`,
        'g'
    );

    // Pattern per querySelector('.className')
    const querySelectorPattern = new RegExp(
        `querySelector(?:All)?\\s*\\(\\s*["']\\.${className}["']`,
        'g'
    );

    // Pattern per getElementsByClassName('className')
    const getByClassPattern = new RegExp(
        `getElementsByClassName\\s*\\(\\s*["']${className}["']\\s*\\)`,
        'g'
    );

    // Cerca in ogni riga
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmedLine = line.trim();

        // Salta commenti
        if (trimmedLine.startsWith('//') ||
            trimmedLine.startsWith('/*') ||
            trimmedLine.startsWith('*') ||
            trimmedLine.startsWith('<!--')) {
            return;
        }

        // Test tutti i pattern
        const patterns = [
            { type: 'HTML class', pattern: htmlPattern },
            { type: 'classList', pattern: classListPattern },
            { type: 'querySelector', pattern: querySelectorPattern },
            { type: 'getByClassName', pattern: getByClassPattern }
        ];

        patterns.forEach(({ type, pattern }) => {
            pattern.lastIndex = 0; // Reset regex
            if (pattern.test(line)) {
                // Estrai contesto (±1 riga)
                const prevLine = index > 0 ? lines[index - 1].trim() : '';
                const nextLine = index < lines.length - 1 ? lines[index + 1].trim() : '';

                matches.push({
                    file: relativePath,
                    line: lineNum,
                    type: type,
                    context: {
                        prev: prevLine.substring(0, 80),
                        current: trimmedLine.substring(0, 120),
                        next: nextLine.substring(0, 80)
                    }
                });
            }
        });
    });

    return matches;
}

// Scansiona directory ricorsivamente
function scanDirectory(dir, className, results) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path.relative(publicDir, fullPath);

        // Salta operatore.css stesso
        if (relativePath === 'assets\\css\\operatore.css' ||
            relativePath === 'assets/css/operatore.css') {
            continue;
        }

        if (file.isDirectory() &&
            file.name !== 'node_modules' &&
            file.name !== '.git' &&
            file.name !== '.gemini') {
            scanDirectory(fullPath, className, results);
        } else if (file.isFile() &&
            (file.name.endsWith('.html') || file.name.endsWith('.js'))) {
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const matches = findExactMatches(className, fullPath, content);
                if (matches.length > 0) {
                    results.push(...matches);
                }
            } catch (err) {
                // Ignora errori di lettura
            }
        }
    }
}

// Main
console.log('🔍 SCANSIONE ESATTA CSS (No Partial Matching)\n');
console.log('📂 Directory:', publicDir);
console.log('📄 File CSS:', path.relative(__dirname, cssFile));
console.log('\n⏳ Estrazione classi CSS...\n');

const cssContent = fs.readFileSync(cssFile, 'utf-8');
const allClasses = extractCSSClasses(cssContent);

console.log(`✓ Trovate ${allClasses.length} classi CSS\n`);
console.log('⏳ Scansione file HTML e JS...\n');

const results = {};
const unusedClasses = [];

// Scansiona ogni classe
allClasses.forEach((className, index) => {
    if ((index + 1) % 50 === 0) {
        console.log(`   Processate ${index + 1}/${allClasses.length} classi...`);
    }

    const matches = [];
    scanDirectory(publicDir, className, matches);

    if (matches.length === 0) {
        unusedClasses.push(className);
    } else {
        results[className] = matches;
    }
});

console.log(`\n✓ Scansione completata!\n`);

// Genera report
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 RISULTATI SCANSIONE ESATTA');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`📈 STATISTICHE:`);
console.log(`   • Classi CSS totali:        ${allClasses.length}`);
console.log(`   • Classi utilizzate:        ${allClasses.length - unusedClasses.length}`);
console.log(`   • Classi NON utilizzate:    ${unusedClasses.length}`);
console.log(`   • Percentuale utilizzo:     ${((allClasses.length - unusedClasses.length) / allClasses.length * 100).toFixed(2)}%\n`);

if (unusedClasses.length > 0) {
    console.log('❌ CLASSI NON UTILIZZATE (0 occorrenze reali):\n');
    unusedClasses.forEach(cls => {
        console.log(`   • .${cls}`);
    });
    console.log('');
} else {
    console.log('✅ Tutte le classi sono utilizzate!\n');
}

// Salva report dettagliato
const detailedReport = {
    timestamp: new Date().toISOString(),
    summary: {
        totalClasses: allClasses.length,
        usedClasses: allClasses.length - unusedClasses.length,
        unusedClasses: unusedClasses.length,
        usagePercentage: ((allClasses.length - unusedClasses.length) / allClasses.length * 100).toFixed(2) + '%'
    },
    unusedClasses: unusedClasses,
    usedClasses: results
};

const reportPath = path.join(__dirname, 'exact_match_report.json');
fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2), 'utf-8');

console.log(`💾 Report dettagliato salvato in: exact_match_report.json`);

// Genera report markdown con tabelle
let markdown = `# 📊 REPORT SCANSIONE ESATTA CSS\n\n`;
markdown += `**Data**: ${new Date().toLocaleString('it-IT')}\n`;
markdown += `**Metodo**: Match esatto (no partial matching)\n`;
markdown += `**File Scansionati**: HTML + JS (escluso operatore.css)\n\n`;
markdown += `---\n\n`;

markdown += `## 📈 STATISTICHE\n\n`;
markdown += `| Metrica | Valore | Percentuale |\n`;
markdown += `|---------|--------|-------------|\n`;
markdown += `| **Classi CSS Totali** | ${allClasses.length} | 100% |\n`;
markdown += `| **Classi Utilizzate** | ${allClasses.length - unusedClasses.length} | ${detailedReport.summary.usagePercentage} |\n`;
markdown += `| **Classi NON Utilizzate** | ${unusedClasses.length} | ${(unusedClasses.length / allClasses.length * 100).toFixed(2)}% |\n\n`;

markdown += `---\n\n`;

if (unusedClasses.length > 0) {
    markdown += `## ❌ CLASSI NON UTILIZZATE (${unusedClasses.length})\n\n`;
    markdown += `Le seguenti classi hanno **0 occorrenze reali** nel codice:\n\n`;
    markdown += `| # | Classe | Stato |\n`;
    markdown += `|---|--------|-------|\n`;
    unusedClasses.forEach((cls, index) => {
        markdown += `| ${index + 1} | \`.${cls}\` | ❌ Non utilizzata |\n`;
    });
    markdown += `\n---\n\n`;
} else {
    markdown += `## ✅ TUTTE LE CLASSI SONO UTILIZZATE\n\n`;
    markdown += `Nessuna classe con 0 occorrenze trovata.\n\n`;
}

// Mostra esempi di classi utilizzate (prime 10)
markdown += `## ✅ ESEMPI CLASSI UTILIZZATE\n\n`;
const usedClassExamples = Object.keys(results).slice(0, 10);
usedClassExamples.forEach(className => {
    const matches = results[className];
    markdown += `### \`.${className}\` (${matches.length} occorrenze)\n\n`;
    markdown += `| File | Riga | Tipo | Codice |\n`;
    markdown += `|------|------|------|--------|\n`;
    matches.slice(0, 3).forEach(match => {
        const code = match.context.current.replace(/\|/g, '\\|');
        markdown += `| \`${match.file}\` | ${match.line} | ${match.type} | \`${code.substring(0, 60)}...\` |\n`;
    });
    if (matches.length > 3) {
        markdown += `| ... | ... | ... | *+${matches.length - 3} altre occorrenze* |\n`;
    }
    markdown += `\n`;
});

markdown += `\n---\n\n`;
markdown += `## 🔬 METODOLOGIA\n\n`;
markdown += `### Pattern di Ricerca (Match Esatto)\n\n`;
markdown += `1. **HTML class attribute**\n`;
markdown += `   \`\`\`regex\n`;
markdown += `   class=["']([^"']*\\s)?CLASSNAME(\\s[^"']*)?["']\n`;
markdown += `   \`\`\`\n\n`;
markdown += `2. **classList operations**\n`;
markdown += `   \`\`\`regex\n`;
markdown += `   classList\\.(add|remove|toggle)\\s*\\(\\s*["']CLASSNAME["']\\s*\\)\n`;
markdown += `   \`\`\`\n\n`;
markdown += `3. **querySelector**\n`;
markdown += `   \`\`\`regex\n`;
markdown += `   querySelector(?:All)?\\s*\\(\\s*["']\\.CLASSNAME["']\n`;
markdown += `   \`\`\`\n\n`;
markdown += `4. **getElementsByClassName**\n`;
markdown += `   \`\`\`regex\n`;
markdown += `   getElementsByClassName\\s*\\(\\s*["']CLASSNAME["']\\s*\\)\n`;
markdown += `   \`\`\`\n\n`;

markdown += `### Regole\n\n`;
markdown += `- ✅ Match esatto del nome classe\n`;
markdown += `- ✅ Ignora commenti (// /* <!-- )\n`;
markdown += `- ✅ Esclude operatore.css stesso\n`;
markdown += `- ❌ NO partial matching\n`;
markdown += `- ❌ NO prefissi/suffissi\n\n`;

markdown += `---\n\n`;
markdown += `**Report generato**: ${new Date().toLocaleString('it-IT')}\n`;
markdown += `**Script**: \`exact_match_scan.js\`\n`;

const markdownPath = path.join(__dirname, 'EXACT_MATCH_REPORT.md');
fs.writeFileSync(markdownPath, markdown, 'utf-8');

console.log(`📄 Report markdown salvato in: EXACT_MATCH_REPORT.md\n`);
console.log('═══════════════════════════════════════════════════════════');
