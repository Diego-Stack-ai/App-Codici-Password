import { readdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('Frontend/public/', root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const write = (path, content) => writeFile(new URL(path, root), content, 'utf8');

const packagePath = 'package.json';
const lockPath = 'package-lock.json';
const envPath = 'Frontend/public/assets/js/env-v126.js';
const homePath = 'Frontend/public/home_page.html';
const workerPath = 'Frontend/public/sw.js';
const versionedExtensions = new Set(['.html', '.js']);
const versionQueryPattern = /\?v=\d+(?:\.\d+)*(?:-[a-z0-9.-]+)?/gi;

function nextVersion(version, target) {
    if (/^\d+\.\d+\.\d+$/.test(target)) return target;
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        throw new Error(`Versione corrente non valida: ${version}`);
    }
    if (target === 'major') return `${parts[0] + 1}.0.0`;
    if (target === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
    if (target === 'patch') return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    throw new Error('Usa patch, minor, major oppure una versione esplicita X.Y.Z.');
}

async function listVersionedFiles(directory = publicRoot) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.name === 'vendor') continue;
        const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
        if (entry.isDirectory()) {
            files.push(...await listVersionedFiles(url));
            continue;
        }
        const extension = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
        if (versionedExtensions.has(extension)) files.push(url);
    }
    return files;
}

function replaceRequired(content, pattern, replacement, label) {
    if (!pattern.test(content)) throw new Error(`Versione non trovata in ${label}`);
    return content.replace(pattern, replacement);
}

function relativePath(url) {
    return decodeURIComponent(url.pathname.slice(root.pathname.length));
}

async function collectQueryUpdates(version, normalize = true) {
    const updates = new Map();
    let references = 0;
    for (const fileUrl of await listVersionedFiles()) {
        const content = await readFile(fileUrl, 'utf8');
        const matches = content.match(versionQueryPattern);
        if (!matches) continue;
        references += matches.length;
        updates.set(
            relativePath(fileUrl),
            normalize ? content.replace(versionQueryPattern, `?v=${version}`) : content
        );
    }
    return { updates, references };
}

function assertCanonicalVersions(files, expected) {
    const escaped = expected.replaceAll('.', '\\.');
    const checks = [
        [envPath, new RegExp(`export const APP_VERSION = 'v${escaped}';`)],
        [homePath, new RegExp(`data-app-version>v${escaped}<`)],
        [workerPath, new RegExp(`const CACHE_NAME = 'codex-shell-v${escaped}';`)]
    ];
    for (const [path, pattern] of checks) {
        if (!pattern.test(files.get(path))) throw new Error(`Versione canonica non allineata in ${path}`);
    }

    const stale = [];
    for (const [path, content] of files) {
        for (const match of content.matchAll(versionQueryPattern)) {
            if (match[0] !== `?v=${expected}`) stale.push(`${path}: ${match[0]}`);
        }
    }
    if (stale.length) {
        throw new Error(`Riferimenti asset non allineati:\n${stale.slice(0, 20).join('\n')}`);
    }
}

const pkg = JSON.parse(await read(packagePath));
const lock = JSON.parse(await read(lockPath));
const requested = process.argv[2] || 'patch';
const checkOnly = requested === '--check';
const current = pkg.version;
const target = checkOnly ? current : nextVersion(current, requested);
if (!checkOnly && target === current) throw new Error(`La versione ${target} è già attiva.`);

const { updates, references } = await collectQueryUpdates(target, !checkOnly);
const envSource = updates.get(envPath) ?? await read(envPath);
const env = replaceRequired(
    envSource,
    /export const APP_VERSION = 'v\d+\.\d+\.\d+';/,
    `export const APP_VERSION = 'v${target}';`,
    envPath
);
const homeSource = updates.get(homePath) ?? await read(homePath);
const home = replaceRequired(
    homeSource,
    /data-app-version>v\d+\.\d+\.\d+</,
    `data-app-version>v${target}<`,
    homePath
);
const workerSource = updates.get(workerPath) ?? await read(workerPath);
const worker = replaceRequired(
    workerSource,
    /const CACHE_NAME = 'codex-shell-v\d+\.\d+\.\d+';/,
    `const CACHE_NAME = 'codex-shell-v${target}';`,
    workerPath
);

updates.set(envPath, env);
updates.set(homePath, home);
updates.set(workerPath, worker);
assertCanonicalVersions(updates, target);

if (checkOnly) {
    if (lock.version !== current || lock.packages?.['']?.version !== current) {
        throw new Error('package-lock.json non è allineato con package.json');
    }
    console.log(`Versione ${current} coerente: ${references} riferimenti asset verificati.`);
    process.exit(0);
}

pkg.version = target;
lock.version = target;
if (lock.packages?.['']) lock.packages[''].version = target;
updates.set(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
updates.set(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

await Promise.all([...updates].map(([path, content]) => write(path, content)));
console.log(`Versione aggiornata: ${current} -> ${target}`);
console.log(`${references} riferimenti asset uniformati in ${updates.size - 5} file applicativi.`);
