/**
 * CSP & SAFE JS CHECK – PROTOCOLLO BASE V3.6
 * Analizzatore automatico di conformità CSP per event handler inline
 */

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, 'public', 'assets', 'js');
const OUTPUT_JSON = path.join(__dirname, 'csp_analysis_report.json');
const OUTPUT_MD = path.join(__dirname, 'csp_safe_js_report.md');

// Pattern da rilevare (event handler inline)
const INLINE_PATTERNS = [
    { pattern: /\.onclick\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onclick', type: 'assignment' },
    { pattern: /\.onchange\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onchange', type: 'assignment' },
    { pattern: /\.oninput\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'oninput', type: 'assignment' },
    { pattern: /\.onsubmit\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onsubmit', type: 'assignment' },
    { pattern: /\.onload\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onload', type: 'assignment' },
    { pattern: /\.onfocus\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onfocus', type: 'assignment' },
    { pattern: /\.onblur\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onblur', type: 'assignment' },
    { pattern: /\.onkeydown\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onkeydown', type: 'assignment' },
    { pattern: /\.onkeyup\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onkeyup', type: 'assignment' },
    { pattern: /\.onmouseenter\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onmouseenter', type: 'assignment' },
    { pattern: /\.onmouseleave\s*=\s*(?:function|async\s+function|\([^)]*\)\s*=>)/g, event: 'onmouseleave', type: 'assignment' },
];

// Funzione per scansionare ricorsivamente i file JS
function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            getAllJsFiles(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

// Funzione per analizzare un singolo file
function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    INLINE_PATTERNS.forEach(({ pattern, event, type }) => {
        const matches = [...content.matchAll(pattern)];

        matches.forEach(match => {
            const position = match.index;
            const lineNumber = content.substring(0, position).split('\n').length;
            const lineContent = lines[lineNumber - 1].trim();

            violations.push({
                line: lineNumber,
                event: event,
                type: type,
                code: lineContent,
                suggestion: `Refactor: Declare a named function and use addEventListener('${event.replace('on', '')}', functionName)`
            });
        });
    });

    return violations;
}

// Funzione principale
function runAnalysis() {
    console.log('🔍 CSP & SAFE JS CHECK – PROTOCOLLO BASE V3.6');
    console.log('📁 Scanning directory:', JS_DIR);
    console.log('');

    const jsFiles = getAllJsFiles(JS_DIR);
    const results = [];
    let totalViolations = 0;
    let conformFiles = 0;
    let nonConformFiles = 0;

    jsFiles.forEach(filePath => {
        const relativePath = path.relative(JS_DIR, filePath);
        const violations = analyzeFile(filePath);

        const status = violations.length === 0 ? 'CONFORME CSP' : 'NON CONFORME CSP';

        if (violations.length === 0) {
            conformFiles++;
        } else {
            nonConformFiles++;
            totalViolations += violations.length;
        }

        results.push({
            file: relativePath,
            path: filePath,
            violations: violations,
            violationCount: violations.length,
            status: status
        });

        // Log progress
        const icon = violations.length === 0 ? '✅' : '❌';
        console.log(`${icon} ${relativePath} - ${status} (${violations.length} violations)`);
    });

    // Salva JSON
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), 'utf8');

    // Genera Markdown Report
    generateMarkdownReport(results, conformFiles, nonConformFiles, totalViolations);

    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   Total files analyzed: ${jsFiles.length}`);
    console.log(`   ✅ Conform files: ${conformFiles}`);
    console.log(`   ❌ Non-conform files: ${nonConformFiles}`);
    console.log(`   ⚠️  Total violations: ${totalViolations}`);
    console.log('');
    console.log(`📄 JSON Report: ${OUTPUT_JSON}`);
    console.log(`📄 Markdown Report: ${OUTPUT_MD}`);
}

// Funzione per generare il report Markdown
function generateMarkdownReport(results, conformFiles, nonConformFiles, totalViolations) {
    let md = `# CSP & SAFE JS CHECK – PROTOCOLLO BASE V3.6\n\n`;
    md += `**Data Analisi**: ${new Date().toLocaleString('it-IT')}\n\n`;
    md += `## 📊 Riepilogo\n\n`;
    md += `- **File Analizzati**: ${results.length}\n`;
    md += `- **✅ File Conformi CSP**: ${conformFiles}\n`;
    md += `- **❌ File Non Conformi**: ${nonConformFiles}\n`;
    md += `- **⚠️ Violazioni Totali**: ${totalViolations}\n\n`;
    md += `---\n\n`;

    // Sezione Non Conformi
    const nonConform = results.filter(r => r.violations.length > 0);
    if (nonConform.length > 0) {
        md += `## ❌ File Non Conformi CSP\n\n`;

        nonConform.forEach(file => {
            md += `### \`${file.file}\`\n\n`;
            md += `**Violazioni**: ${file.violationCount}\n\n`;

            file.violations.forEach((v, idx) => {
                md += `#### Violazione ${idx + 1}\n`;
                md += `- **Linea**: ${v.line}\n`;
                md += `- **Evento**: \`${v.event}\`\n`;
                md += `- **Tipo**: ${v.type}\n`;
                md += `- **Codice**:\n\`\`\`javascript\n${v.code}\n\`\`\`\n`;
                md += `- **✅ Suggerimento**: ${v.suggestion}\n\n`;
            });

            md += `---\n\n`;
        });
    }

    // Sezione Conformi
    const conform = results.filter(r => r.violations.length === 0);
    if (conform.length > 0) {
        md += `## ✅ File Conformi CSP\n\n`;
        md += `I seguenti file **NON** contengono event handler inline e sono conformi alla Content Security Policy:\n\n`;

        conform.forEach(file => {
            md += `- ✅ \`${file.file}\`\n`;
        });

        md += `\n---\n\n`;
    }

    md += `## 🎯 Raccomandazioni\n\n`;
    md += `Per rendere tutti i file conformi CSP:\n\n`;
    md += `1. **Rimuovere** tutti gli assignment diretti tipo \`.onclick = function() {...}\`\n`;
    md += `2. **Dichiarare** funzioni nominate nel modulo\n`;
    md += `3. **Usare** \`addEventListener('event', functionName)\` invece di inline handlers\n`;
    md += `4. **Evitare** funzioni anonime inline negli event listener\n\n`;
    md += `### Esempio di Refactoring\n\n`;
    md += `**❌ Non Conforme:**\n`;
    md += `\`\`\`javascript\n`;
    md += `element.onclick = function() {\n`;
    md += `    console.log('clicked');\n`;
    md += `};\n`;
    md += `\`\`\`\n\n`;
    md += `**✅ Conforme:**\n`;
    md += `\`\`\`javascript\n`;
    md += `function handleClick() {\n`;
    md += `    console.log('clicked');\n`;
    md += `}\n\n`;
    md += `element.addEventListener('click', handleClick);\n`;
    md += `\`\`\`\n\n`;

    fs.writeFileSync(OUTPUT_MD, md, 'utf8');
}

// Esegui l'analisi
runAnalysis();
