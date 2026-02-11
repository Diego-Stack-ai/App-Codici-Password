#!/usr/bin/env node

/**
 * CSS AUDIT TOOL - Antigravity Edition
 * 
 * Funzionalità:
 * - Rimuove tutti i !important
 * - Deduplica regole CSS identiche
 * - Analizza conflitti di specificità
 * - Genera report dettagliato in JSON
 */

const fs = require('fs');
const path = require('path');

// Configurazione da linea di comando
const args = process.argv.slice(2);
const config = parseArgs(args);

function parseArgs(args) {
    const config = {
        input: null,
        output: null,
        removeImportant: false,
        deduplicate: false,
        report: null,
        analyzeConflicts: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--input':
                config.input = args[++i];
                break;
            case '--output':
                config.output = args[++i];
                break;
            case '--remove-important':
                config.removeImportant = true;
                break;
            case '--deduplicate':
                config.deduplicate = true;
                break;
            case '--report':
                config.report = args[++i];
                break;
            case '--analyze-conflicts':
                config.analyzeConflicts = true;
                break;
        }
    }

    return config;
}

// Calcola specificità CSS
function calculateSpecificity(selector) {
    let a = 0, b = 0, c = 0;

    // Rimuovi pseudo-elementi
    selector = selector.replace(/::(before|after|first-line|first-letter)/g, '');

    // ID selectors
    a = (selector.match(/#[\w-]+/g) || []).length;

    // Class, attribute, pseudo-class selectors
    b = (selector.match(/\.[\w-]+/g) || []).length;
    b += (selector.match(/\[[\w-]+/g) || []).length;
    b += (selector.match(/:(?!not\()([\w-]+)/g) || []).length;

    // Element selectors
    c = (selector.match(/^[\w-]+|[\s>+~][\w-]+/g) || []).length;

    return { a, b, c, value: a * 100 + b * 10 + c };
}

// Parser CSS semplificato
function parseCSS(cssContent) {
    const rules = [];
    const importantCount = { total: 0, byProperty: {} };

    // Regex per catturare regole CSS
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let match;

    while ((match = ruleRegex.exec(cssContent)) !== null) {
        const selector = match[1].trim();
        const declarations = match[2].trim();

        // Salta commenti e regole vuote
        if (selector.startsWith('/*') || !declarations) continue;

        // Parse dichiarazioni
        const props = [];
        const declRegex = /([^:;]+):([^;]+);?/g;
        let declMatch;

        while ((declMatch = declRegex.exec(declarations)) !== null) {
            const property = declMatch[1].trim();
            const value = declMatch[2].trim();
            const hasImportant = value.includes('!important');

            if (hasImportant) {
                importantCount.total++;
                importantCount.byProperty[property] = (importantCount.byProperty[property] || 0) + 1;
            }

            props.push({
                property,
                value,
                hasImportant
            });
        }

        rules.push({
            selector,
            declarations: props,
            specificity: calculateSpecificity(selector),
            raw: match[0]
        });
    }

    return { rules, importantCount };
}

// Rimuovi !important
function removeImportant(rules) {
    const removed = [];

    rules.forEach(rule => {
        rule.declarations.forEach(decl => {
            if (decl.hasImportant) {
                removed.push({
                    selector: rule.selector,
                    property: decl.property,
                    originalValue: decl.value
                });
                decl.value = decl.value.replace(/\s*!important\s*/g, '').trim();
                decl.hasImportant = false;
            }
        });
    });

    return removed;
}

// Deduplica regole
function deduplicateRules(rules) {
    const seen = new Map();
    const duplicates = [];
    const unique = [];

    rules.forEach((rule, index) => {
        const key = `${rule.selector}::${JSON.stringify(rule.declarations)}`;

        if (seen.has(key)) {
            duplicates.push({
                selector: rule.selector,
                firstOccurrence: seen.get(key),
                duplicateIndex: index,
                declarations: rule.declarations
            });
        } else {
            seen.set(key, index);
            unique.push(rule);
        }
    });

    return { unique, duplicates };
}

// Analizza conflitti
function analyzeConflicts(rules) {
    const conflicts = [];
    const propertyMap = new Map();

    // Raggruppa per proprietà
    rules.forEach((rule, ruleIndex) => {
        rule.declarations.forEach(decl => {
            const key = decl.property;
            if (!propertyMap.has(key)) {
                propertyMap.set(key, []);
            }
            propertyMap.get(key).push({
                selector: rule.selector,
                value: decl.value,
                specificity: rule.specificity,
                ruleIndex
            });
        });
    });

    // Trova conflitti
    propertyMap.forEach((entries, property) => {
        if (entries.length > 1) {
            // Ordina per specificità
            entries.sort((a, b) => b.specificity.value - a.specificity.value);

            const conflict = {
                property,
                totalOccurrences: entries.length,
                rules: entries.map(e => ({
                    selector: e.selector,
                    value: e.value,
                    specificity: e.specificity.value,
                    specificityBreakdown: `${e.specificity.a}-${e.specificity.b}-${e.specificity.c}`
                }))
            };

            // Identifica conflitti reali (stessa specificità, valori diversi)
            const sameSpecificity = entries.filter(e =>
                e.specificity.value === entries[0].specificity.value
            );

            if (sameSpecificity.length > 1) {
                const values = new Set(sameSpecificity.map(e => e.value));
                if (values.size > 1) {
                    conflict.hasConflict = true;
                    conflict.conflictType = 'same-specificity-different-values';
                }
            }

            conflicts.push(conflict);
        }
    });

    return conflicts;
}

// Genera CSS pulito
function generateCleanCSS(rules) {
    let css = '';

    rules.forEach(rule => {
        css += `${rule.selector} {\n`;
        rule.declarations.forEach(decl => {
            css += `    ${decl.property}: ${decl.value};\n`;
        });
        css += `}\n\n`;
    });

    return css;
}

// Main
function main() {
    console.log('🔍 CSS AUDIT TOOL - Antigravity Edition\n');

    if (!config.input) {
        console.error('❌ Errore: specificare --input <file>');
        process.exit(1);
    }

    // Leggi file CSS
    const inputPath = path.resolve(config.input);

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ File non trovato: ${inputPath}`);
        process.exit(1);
    }

    console.log(`📂 Input: ${config.input}`);
    const cssContent = fs.readFileSync(inputPath, 'utf-8');
    const originalSize = cssContent.length;

    // Parse CSS
    console.log('⚙️  Parsing CSS...');
    let { rules, importantCount } = parseCSS(cssContent);
    console.log(`   ✓ ${rules.length} regole trovate`);
    console.log(`   ✓ ${importantCount.total} dichiarazioni !important\n`);

    const report = {
        timestamp: new Date().toISOString(),
        input: config.input,
        output: config.output,
        originalStats: {
            size: originalSize,
            rules: rules.length,
            importantDeclarations: importantCount.total,
            importantByProperty: importantCount.byProperty
        },
        operations: [],
        finalStats: {}
    };

    // Rimuovi !important
    if (config.removeImportant) {
        console.log('🧹 Rimozione !important...');
        const removed = removeImportant(rules);
        console.log(`   ✓ ${removed.length} !important rimossi\n`);

        report.operations.push({
            type: 'remove-important',
            count: removed.length,
            details: removed.slice(0, 50) // Primi 50
        });
    }

    // Deduplica
    let duplicates = [];
    if (config.deduplicate) {
        console.log('🔄 Deduplicazione regole...');
        const result = deduplicateRules(rules);
        rules = result.unique;
        duplicates = result.duplicates;
        console.log(`   ✓ ${duplicates.length} duplicati rimossi\n`);

        report.operations.push({
            type: 'deduplicate',
            count: duplicates.length,
            details: duplicates.slice(0, 50)
        });
    }

    // Analizza conflitti
    let conflicts = [];
    if (config.analyzeConflicts) {
        console.log('⚔️  Analisi conflitti...');
        conflicts = analyzeConflicts(rules);
        const realConflicts = conflicts.filter(c => c.hasConflict);
        console.log(`   ✓ ${conflicts.length} proprietà con multiple definizioni`);
        console.log(`   ⚠️  ${realConflicts.length} conflitti reali rilevati\n`);

        report.operations.push({
            type: 'analyze-conflicts',
            totalProperties: conflicts.length,
            realConflicts: realConflicts.length,
            details: conflicts.slice(0, 100)
        });
    }

    // Genera CSS pulito
    const cleanCSS = generateCleanCSS(rules);
    const finalSize = cleanCSS.length;
    const reduction = ((originalSize - finalSize) / originalSize * 100).toFixed(2);

    report.finalStats = {
        size: finalSize,
        rules: rules.length,
        sizeReduction: `${reduction}%`,
        bytesReduced: originalSize - finalSize
    };

    // Salva output
    if (config.output) {
        const outputPath = path.resolve(config.output);
        fs.writeFileSync(outputPath, cleanCSS, 'utf-8');
        console.log(`💾 CSS pulito salvato: ${config.output}`);
        console.log(`   📊 Riduzione: ${reduction}% (${originalSize - finalSize} bytes)\n`);
    }

    // Salva report
    if (config.report) {
        const reportPath = path.resolve(config.report);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
        console.log(`📋 Report salvato: ${config.report}\n`);
    }

    // Summary
    console.log('✅ AUDIT COMPLETATO\n');
    console.log('📊 STATISTICHE FINALI:');
    console.log(`   • Regole originali: ${report.originalStats.rules}`);
    console.log(`   • Regole finali: ${report.finalStats.rules}`);
    console.log(`   • !important rimossi: ${config.removeImportant ? importantCount.total : 'N/A'}`);
    console.log(`   • Duplicati rimossi: ${config.deduplicate ? duplicates.length : 'N/A'}`);
    console.log(`   • Conflitti rilevati: ${config.analyzeConflicts ? conflicts.filter(c => c.hasConflict).length : 'N/A'}`);
    console.log(`   • Riduzione dimensione: ${reduction}%\n`);
}

main();
