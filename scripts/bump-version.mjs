import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const write = (path, content) => writeFile(new URL(path, root), content, 'utf8');

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const envPath = 'Frontend/public/assets/js/env-v126.js';
const homePath = 'Frontend/public/home_page.html';
const workerPath = 'Frontend/public/sw.js';

const pkg = JSON.parse(await read(packagePath));
const lock = JSON.parse(await read(lockPath));
const requested = process.argv[2] || 'patch';
const current = pkg.version;

function nextVersion(version, target) {
    if (/^\d+\.\d+\.\d+$/.test(target)) return target;
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error(`Versione corrente non valida: ${version}`);
    if (target === 'major') return `${parts[0] + 1}.0.0`;
    if (target === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
    if (target === 'patch') return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    throw new Error('Usa patch, minor, major oppure una versione esplicita X.Y.Z.');
}

const next = nextVersion(current, requested);
if (next === current) throw new Error(`La versione ${next} è già attiva.`);

pkg.version = next;
lock.version = next;
if (lock.packages?.['']) lock.packages[''].version = next;

const replaceVersion = (content, pattern, replacement, label) => {
    if (!pattern.test(content)) throw new Error(`Versione non trovata in ${label}`);
    return content.replace(pattern, replacement);
};

const env = replaceVersion(
    await read(envPath),
    /export const APP_VERSION = 'v\d+\.\d+\.\d+';/,
    `export const APP_VERSION = 'v${next}';`,
    envPath
);
const home = replaceVersion(
    await read(homePath),
    /data-app-version>v\d+\.\d+\.\d+</,
    `data-app-version>v${next}<`,
    homePath
);
const worker = replaceVersion(
    await read(workerPath),
    /const CACHE_NAME = 'codex-shell-v\d+\.\d+\.\d+';/,
    `const CACHE_NAME = 'codex-shell-v${next}';`,
    workerPath
);

await Promise.all([
    write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`),
    write(lockPath, `${JSON.stringify(lock, null, 2)}\n`),
    write(envPath, env),
    write(homePath, home),
    write(workerPath, worker)
]);

console.log(`Versione aggiornata: ${current} -> ${next}`);
