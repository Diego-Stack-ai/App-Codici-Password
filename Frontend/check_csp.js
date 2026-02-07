const fs = require('fs');
const path = require('path');

const directoryPath = __dirname;

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const inlineScript = /<script[^>]*>.*<\/script>/gs;
    const inlineStyle = /<style[^>]*>.*<\/style>/gs;
    let issues = [];

    if (inlineScript.test(content)) {
        issues.push('Inline <script> found');
    }
    if (inlineStyle.test(content)) {
        issues.push('Inline <style> found');
    }
    if (content.includes('style="')) {
        issues.push('Inline style attribute found');
    }
    if (issues.length > 0) {
        console.log(`⚠ ${filePath}`);
        issues.forEach(i => console.log('   - ' + i));
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.html')) {
            checkFile(fullPath);
        }
    });
}

walkDir(directoryPath);
console.log('✅ CSP scan completed');

