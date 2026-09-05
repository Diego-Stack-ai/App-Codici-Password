import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const publicRoot = join(root, 'Frontend', 'public');
const forbiddenRuntimeTerms = ['tesseract.js', '@zxing/browser', 'card-importer'];
const inspectedExtensions = new Set(['.html', '.js', '.json', '.css']);
const failures = [];

async function collectFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const absolute = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await collectFiles(absolute));
        else if (inspectedExtensions.has(extname(entry.name))) files.push(absolute);
    }
    return files;
}

for (const file of await collectFiles(publicRoot)) {
    const content = (await readFile(file, 'utf8')).toLowerCase();
    for (const term of forbiddenRuntimeTerms) {
        if (content.includes(term)) failures.push(`${relative(root, file)} contiene ${term}`);
    }
}

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
for (const dependency of ['tesseract.js', '@zxing/browser']) {
    if (packageJson.dependencies?.[dependency]) failures.push(`${dependency} non deve essere una dipendenza di produzione`);
    if (!packageJson.devDependencies?.[dependency]) failures.push(`${dependency} deve restare confinata alle devDependencies`);
}

const gitignore = await readFile(join(root, '.gitignore'), 'utf8');
if (!gitignore.includes('experiments/card-importer/dist/')) failures.push('Il bundle sperimentale deve essere ignorato da Git');

if (failures.length) {
    console.error('Gate app leggera non superato:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log('Gate app leggera superato: OCR/QR esclusi da runtime pubblico, shell offline e dipendenze di produzione.');
}
