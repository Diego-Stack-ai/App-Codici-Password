import {build} from 'esbuild';
import {mkdir, copyFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const base = import.meta.dirname, publicRoot = resolve(base, '../../Frontend/public');
export async function buildEmulator() {
    await mkdir(`${base}/dist/emulator-site/assets/images`, {recursive: true});
    const deny = 'const deny = () => {throw new Error("EMULATOR_READ_ONLY")};';
    const boundaries = {
        'firebase-config.js': 'export {auth, db} from "./emulator-firebase.mjs";',
        'firebase-runtime.js': `export {collection, doc, limit, orderBy, query, where, getDocFromCache, getDocFromServer, getDocsFromCache, getDocsFromServer} from 'firebase/firestore'; ${deny} export {deny as updateDoc, deny as deleteDoc, deny as writeBatch};`,
        'security-manager.js': `${deny} export {deny as ensureVaultKeyMaterial, deny as decrypt};`,
        'card-secret.js': `${deny} export function createCardSecretResolver(value, encrypted) { if (encrypted) return deny; return async () => value; }`,
        'logger.js': 'export const LOG = () => {};',
        'utils.js': 'export const logError = () => {};',
        'ui-core-v129.js': 'export const showToast = () => {}; export const showConfirmModal = async () => false;',
        'translations.js': `export const t = key => ({label_user:'Utente', label_account:'Codice', label_password:'Password', no_accounts_found:'Nessun account trovato'})[key] || key;`,
        'private-account-offline-pilot.js': `${deny} export {deny as consumePrivateAccountHandoff};`
    };
    const result = await build({entryPoints: [`${base}/emulator-entry.mjs`], outfile: `${base}/dist/emulator-site/emulator.js`,
        bundle: true, format: 'esm', platform: 'browser', metafile: true, target: ['safari16', 'chrome110'], logLevel: 'warning',
        plugins: [{name: 'emulator-boundaries', setup(builder) {
            builder.onResolve({filter: /\.js(?:\?.*)?$/}, args => {
                const name = args.path.split('/').pop().split('?')[0];
                if (Object.hasOwn(boundaries, name)) return {path: name, namespace: 'emulator'};
                if (args.path.startsWith('/assets/')) return {path: resolve(publicRoot, args.path.slice(1))};
            });
            builder.onLoad({filter: /.*/, namespace: 'emulator'}, args => ({contents: boundaries[args.path], loader: 'js', resolveDir: base}));
        }}]
    });
    const inputs = Object.keys(result.metafile.inputs).map(name => name.replaceAll('\\', '/'));
    for (const expected of ['modules/data/vault-repository.js', 'assets/js/offline-firestore.js', 'modules/data/request-coordinator.js', 'modules/privato/account_privati.js', 'modules/azienda/account_azienda.js']) {
        if (!inputs.some(name => name.endsWith(expected))) throw new Error(`MISSING_CANONICAL_MODULE: ${expected}`);
    }
    if (inputs.some(name => !name.startsWith('emulator:') && /(?:firebase-config|security-manager|vault-session|fixture-repository|dettaglio_account_privato|dettaglio_account_azienda)\.(?:js|mjs)$/.test(name))) throw new Error('UNEXPECTED_PRODUCTION_SESSION');
    await writeFile(`${base}/dist/emulator-inputs.json`, JSON.stringify(inputs, null, 2));
    for (const name of ['emulator.html', 'emulator.css']) await copyFile(`${base}/${name}`, `${base}/dist/emulator-site/${name}`);
    await copyFile(`${publicRoot}/assets/fonts/material-symbols/material-symbols-0.woff2`, `${base}/dist/emulator-site/symbols.woff2`);
    await copyFile(`${publicRoot}/assets/images/google-avatar.png`, `${base}/dist/emulator-site/assets/images/google-avatar.png`);
}
