// Collaudo del censimento dei formati con Auth e Firestore emulati (progetto demo isolato).
// 1. Costruisce in .codex-tmp un runtime Firebase di test: stesso pacchetto e stesse
//    funzioni del runtime di produzione, più connectAuthEmulator/connectFirestoreEmulator.
//    Il file Frontend/public/assets/js/vendor/firebase-runtime.js non viene toccato.
// 2. Avvia gli emulatori e il test browser tests/vault-format-census.emulator.test.mjs.
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {resolve, join, delimiter} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const scratch = resolve(root, '.codex-tmp/vault-census-emulators');
mkdirSync(scratch, {recursive: true});
const jsDir = join(root, 'Frontend/public/assets/js');
const vendorDir = join(jsDir, 'vendor');
const packageByModule = {
    'firebase-app': 'firebase/app', 'firebase-app-check': 'firebase/app-check', 'firebase-auth': 'firebase/auth',
    'firebase-firestore': 'firebase/firestore', 'firebase-functions': 'firebase/functions',
    'firebase-messaging': 'firebase/messaging', 'firebase-storage': 'firebase/storage'
};
const exportAliases = {getMessagingToken: {module: 'firebase-messaging', name: 'getToken'}};
const walk = directory => readdirSync(directory).flatMap(name => {
    const full = join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
});
const requested = new Set(['connectAuthEmulator', 'connectFirestoreEmulator']);
for (const file of walk(jsDir).filter(file => /\.m?js$/i.test(file) && !file.startsWith(vendorDir))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\/assets\/js\/vendor\/firebase-runtime\.js["']/g)) {
        for (const part of match[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/)[0];
            if (name) requested.add(name);
        }
    }
}
const owners = new Map(), byModule = new Map();
for (const [moduleName, packageName] of Object.entries(packageByModule)) {
    const exports = await import(packageName);
    for (const name of requested) {
        const alias = exportAliases[name];
        if (alias && alias.module !== moduleName) continue;
        const original = alias?.name || name;
        if (!(original in exports) || owners.has(name)) continue;
        owners.set(name, moduleName);
        const names = byModule.get(moduleName) || new Set();
        names.add(alias ? `${original} as ${name}` : name);
        byModule.set(moduleName, names);
    }
}
const missing = [...requested].filter(name => !owners.has(name));
if (missing.length) throw new Error(`Export Firebase non trovati: ${missing.join(', ')}`);
const entry = [...byModule].map(([moduleName, names]) => {
    const subpath = packageByModule[moduleName].slice('firebase/'.length);
    const file = join(root, 'node_modules/firebase', subpath, 'dist/index.mjs').replaceAll('\\', '/');
    return `export { ${[...names].sort().join(', ')} } from ${JSON.stringify(file)};`;
}).join('\n');
const runtimeFile = join(scratch, 'firebase-runtime.emulator.js');
await build({
    absWorkingDir: root, nodePaths: [join(root, 'node_modules')],
    stdin: {contents: entry, resolveDir: root, sourcefile: 'firebase-runtime-emulator-entry.js'},
    outfile: runtimeFile, bundle: true, format: 'esm', platform: 'browser',
    target: ['chrome100'], minify: true, legalComments: 'none'
});

const config = join(scratch, 'firebase.json');
writeFileSync(join(scratch, 'firestore.rules'), readFileSync(join(root, 'firestore.rules')));
writeFileSync(config, JSON.stringify({
    firestore: {rules: join(scratch, 'firestore.rules')},
    emulators: {auth: {host: '127.0.0.1', port: 19199}, firestore: {host: '127.0.0.1', port: 18199},
        hub: {host: '127.0.0.1', port: 14499}, logging: {host: '127.0.0.1', port: 14599}, ui: {enabled: false},
        singleProjectMode: true}
}));
const env = {...process.env, XDG_CONFIG_HOME: join(scratch, 'cli-config'), GCLOUD_PROJECT: 'demo-vault-census',
    GOOGLE_CLOUD_PROJECT: 'demo-vault-census', METADATA_SERVER_DETECTION: 'none',
    VAULT_CENSUS_RUNTIME: runtimeFile,
    NODE_PATH: [join(root, 'functions/node_modules'), join(root, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(delimiter)};
delete env.GOOGLE_APPLICATION_CREDENTIALS;
delete env.FIREBASE_TOKEN;
mkdirSync(env.XDG_CONFIG_HOME, {recursive: true});
// Un progetto demo-* non può raggiungere risorse Firebase reali.
const result = spawnSync(process.execPath, [join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
    'emulators:exec', '--config', config, '--project', 'demo-vault-census', '--only', 'auth,firestore',
    `${JSON.stringify(process.execPath)} --test --test-concurrency=1 ${JSON.stringify(join(root, 'tests/vault-format-census.emulator.test.mjs'))}`],
{cwd: scratch, env, stdio: 'inherit', shell: false});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
