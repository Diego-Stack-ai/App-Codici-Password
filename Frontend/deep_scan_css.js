const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// Classi specifiche da verificare
const CLASSES_TO_VERIFY = {
    modal: ['modal-overlay', 'modal-box', 'modal-icon', 'modal-title', 'modal-text', 'modal-actions',
        'btn-modal', 'btn-primary', 'btn-secondary', 'btn-danger'],
    micro: ['micro-account-avatar', 'micro-account-avatar-box', 'micro-account-badge',
        'micro-account-card', 'micro-account-content', 'micro-account-info',
        'micro-account-name', 'micro-account-pin', 'micro-account-subtitle',
        'micro-account-top-actions', 'micro-actions-divider', 'micro-btn-copy',
        'micro-btn-copy-inline', 'micro-btn-utility', 'micro-data-display',
        'micro-data-item', 'micro-data-label', 'micro-data-row', 'micro-data-tray',
        'micro-data-value', 'micro-item-badge', 'micro-item-badge-container',
        'micro-item-content', 'micro-item-icon-box', 'micro-item-title'],
    swipe: ['swipe-backgrounds', 'swipe-bg-left', 'swipe-bg-right', 'swipe-content'],
    dashboard: ['dashboard-list-item', 'item-badge', 'item-content', 'item-icon-box', 'item-title'],
    colors: ['bg-black', 'bg-blue-500', 'text-amber-500', 'text-emerald-500'],
    misc: ['flag', 'icon-accent-red']
};

// Risultati dettagliati
const results = {};
Object.keys(CLASSES_TO_VERIFY).forEach(category => {
    results[category] = {};
    CLASSES_TO_VERIFY[category].forEach(cls => {
        results[category][cls] = {
            found: false,
            locations: []
        };
    });
});

// Funzione per cercare una classe in un file
function searchClassInFile(filePath, className) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const locations = [];

    // Pattern di ricerca multipli
    const patterns = [
        // HTML: class="..."
        new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
        // JS: classList.add/remove/toggle
        new RegExp(`classList\\.(add|remove|toggle)\\s*\\(\\s*["']${className}["']\\s*\\)`, 'g'),
        // JS: querySelector
        new RegExp(`querySelector(?:All)?\\s*\\(\\s*["']\\.${className}["']`, 'g'),
        // JS: getElementsByClassName
        new RegExp(`getElementsByClassName\\s*\\(\\s*["']${className}["']`, 'g'),
        // JS: Template strings
        new RegExp(`\`[^\`]*\\b${className}\\b[^\`]*\``, 'g'),
        // JS: String concatenation
        new RegExp(`["']${className}["']`, 'g'),
        // JS: Partial match in template (per classi dinamiche)
        new RegExp(`["'\`][^"'\`]*${className.split('-')[0]}[^"'\`]*["'\`]`, 'g')
    ];

    const lines = content.split('\n');

    patterns.forEach((pattern, patternIndex) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            // Trova il numero di riga
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            const lineContent = lines[lineNumber - 1].trim();

            locations.push({
                line: lineNumber,
                content: lineContent.substring(0, 100), // Primi 100 caratteri
                patternType: ['HTML class', 'classList', 'querySelector', 'getByClassName', 'template', 'string', 'partial'][patternIndex]
            });
        }
    });

    return locations;
}

// Scansione ricorsiva
function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory() && file.name !== 'node_modules' && file.name !== '.git') {
            scanDirectory(fullPath);
        } else if (file.isFile() && (file.name.endsWith('.html') || file.name.endsWith('.js'))) {
            const relativePath = path.relative(publicDir, fullPath);

            // Cerca ogni classe in questo file
            Object.keys(CLASSES_TO_VERIFY).forEach(category => {
                CLASSES_TO_VERIFY[category].forEach(className => {
                    const locations = searchClassInFile(fullPath, className);
                    if (locations.length > 0) {
                        results[category][className].found = true;
                        results[category][className].locations.push({
                            file: relativePath,
                            matches: locations
                        });
                    }
                });
            });
        }
    }
}

console.log('🔍 SCANSIONE APPROFONDITA CSS...\n');
console.log('📂 Directory:', publicDir);
console.log('🎯 Classi da verificare:', Object.values(CLASSES_TO_VERIFY).flat().length);
console.log('\n⏳ Scansione in corso...\n');

scanDirectory(publicDir);

// Genera report
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 RISULTATI SCANSIONE APPROFONDITA');
console.log('═══════════════════════════════════════════════════════════\n');

Object.keys(results).forEach(category => {
    const classes = results[category];
    const found = Object.values(classes).filter(c => c.found).length;
    const total = Object.keys(classes).length;

    console.log(`\n📦 ${category.toUpperCase()}: ${found}/${total} utilizzate`);
    console.log('─'.repeat(60));

    Object.keys(classes).forEach(className => {
        const data = classes[className];
        if (data.found) {
            console.log(`  ✅ .${className}`);
            data.locations.forEach(loc => {
                console.log(`     📄 ${loc.file}`);
                loc.matches.forEach(match => {
                    console.log(`        L${match.line} [${match.patternType}]: ${match.content.substring(0, 60)}...`);
                });
            });
        } else {
            console.log(`  ❌ .${className} - NON TROVATA`);
        }
    });
});

// Genera lista finale classi da rimuovere
const toRemove = [];
Object.keys(results).forEach(category => {
    Object.keys(results[category]).forEach(className => {
        if (!results[category][className].found) {
            toRemove.push(className);
        }
    });
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🗑️  CLASSI DA RIMUOVERE (NON UTILIZZATE)');
console.log('═══════════════════════════════════════════════════════════\n');

if (toRemove.length === 0) {
    console.log('✅ Tutte le classi sono utilizzate! Nessuna rimozione necessaria.\n');
} else {
    console.log(`❌ Trovate ${toRemove.length} classi NON utilizzate:\n`);
    toRemove.forEach(cls => {
        console.log(`   • .${cls}`);
    });
    console.log('');
}

// Salva report dettagliato
const detailedReport = {
    timestamp: new Date().toISOString(),
    summary: {
        totalScanned: Object.values(CLASSES_TO_VERIFY).flat().length,
        found: Object.values(CLASSES_TO_VERIFY).flat().length - toRemove.length,
        notFound: toRemove.length
    },
    details: results,
    toRemove: toRemove
};

fs.writeFileSync(
    path.join(__dirname, 'deep_scan_report.json'),
    JSON.stringify(detailedReport, null, 2),
    'utf-8'
);

console.log('💾 Report dettagliato salvato in: deep_scan_report.json\n');
console.log('═══════════════════════════════════════════════════════════');
