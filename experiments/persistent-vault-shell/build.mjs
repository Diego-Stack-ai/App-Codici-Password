import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory = fileURLToPath(new URL('./', import.meta.url));
await mkdir(new URL('./dist/', import.meta.url), {recursive: true});
const boundaries = {
    'logger.js': 'export const LOG = () => {};',
    'utils.js': 'export const logError = () => {};',
    'ui-core-v129.js': 'export const showToast = () => {}; export const showConfirmModal = async () => false;',
    'translations.js': `export const t = key => ({label_user:'Utente', label_account:'Codice', label_password:'Password', no_accounts_found:'Nessun account trovato'})[key] || key;`,
    'card-secret.js': `export function createCardSecretResolver(value, encrypted) { if (encrypted) throw new Error('FIXTURE_ONLY'); return async () => value; }`,
    'firebase-config.js': 'export const db = null;',
    'firebase-runtime.js': 'const deny = () => { throw new Error("FIXTURE_READ_ONLY"); }; export {deny as doc, deny as updateDoc, deny as deleteDoc, deny as writeBatch};',
    'security-manager.js': 'export const ensureVaultKeyMaterial = async () => null; export const decrypt = () => { throw new Error("FIXTURE_ONLY"); };',
    'vault-repository.js': 'export * from "./fixture-repository.mjs";',
    'private-account-offline-pilot.js': 'export const consumePrivateAccountHandoff = () => { throw new Error("FIXTURE_ONLY"); };'
};
const result = await build({
    absWorkingDir: directory, entryPoints: ['real-lists-entry.mjs'], outfile: 'dist/real-lists.mjs',
    bundle: true, format: 'esm', minify: true, metafile: true, target: ['safari16', 'chrome110'],
    plugins: [{name: 'fixture-boundaries', setup(builder) {
        builder.onResolve({filter: /\.js(?:\?.*)?$/}, args => {
            const name = args.path.split('/').pop().split('?')[0];
            if (Object.hasOwn(boundaries, name)) return {path: name, namespace: 'fixture'};
        });
        builder.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({contents: boundaries[args.path], loader: 'js', resolveDir: directory}));
    }}]
});
if (Object.keys(result.metafile.inputs).some(name => !name.startsWith('fixture:') && /firebase|security-manager|vault-repository/.test(name))) throw new Error('Unexpected real backend dependency');
await writeFile(new URL('dist/inputs.json', import.meta.url), JSON.stringify(Object.keys(result.metafile.inputs), null, 2));
console.log('Orchestratori reali compilati per fixture, senza backend.');
