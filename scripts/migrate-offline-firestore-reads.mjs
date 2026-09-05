import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const jsRoot = path.resolve(process.cwd(), 'Frontend/public/assets/js');

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(async entry => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
    }))).flat();
}

let changed = 0;
for (const file of await walk(jsRoot)) {
    if (!file.endsWith('.js') || file.includes(`${path.sep}vendor${path.sep}`) || file.endsWith('offline-firestore.js')) continue;
    const source = await readFile(file, 'utf8');
    let needsDoc = false;
    let needsDocs = false;
    const updatedImports = source.replace(
        /import\s*\{([^}]+)\}\s*from\s*["']\/assets\/js\/vendor\/firebase-runtime\.js["'];?/g,
        (full, clause) => {
            const names = clause.split(',').map(item => item.trim()).filter(Boolean);
            const retained = names.filter(item => {
                const imported = item.split(/\s+as\s+/)[0];
                if (imported === 'getDoc') { needsDoc = true; return false; }
                if (imported === 'getDocs') { needsDocs = true; return false; }
                return true;
            });
            return retained.length
                ? `import { ${retained.join(', ')} } from "/assets/js/vendor/firebase-runtime.js";`
                : '';
        }
    );
    if (!needsDoc && !needsDocs) continue;
    const smartImports = [
        needsDoc ? 'getDocSmart as getDoc' : null,
        needsDocs ? 'getDocsSmart as getDocs' : null
    ].filter(Boolean).join(', ');
    const updated = `import { ${smartImports} } from "/assets/js/offline-firestore.js";\n${updatedImports}`;
    await writeFile(file, updated, 'utf8');
    changed += 1;
}

console.log(`Letture Firestore offline migrate in ${changed} moduli.`);

