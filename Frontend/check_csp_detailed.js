const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "public");

function scanFile(filePath) {
    const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
    let found = false;

    lines.forEach((line, index) => {
        if (/<script[^>]*>/.test(line) && !/<script[^>]*src=/.test(line)) {
            console.log(`⚠ ${filePath} (riga ${index + 1}): Inline <script> trovato`);
            found = true;
        }
        if (/style\s*=\s*["'].*?["']/.test(line)) {
            console.log(`⚠ ${filePath} (riga ${index + 1}): Inline style trovato`);
            found = true;
        }
    });

    if (!found) {
        console.log(`✅ ${filePath}: Nessuna violazione CSP trovata`);
    }
}

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (file.endsWith(".html")) {
            scanFile(fullPath);
        }
    });
}

console.log("🔍 Avvio scansione CSP dettagliata...");
scanDir(baseDir);
console.log("✅ Scansione completata.");
