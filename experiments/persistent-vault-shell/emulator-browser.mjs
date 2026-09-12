import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {buildEmulator} from './build-emulator.mjs';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, terminate} from 'firebase/firestore';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const base = import.meta.dirname;
await buildEmulator();
const source = await readFile(`${base}/../../Frontend/public/assets/js/modules/core/crypto-utils.js`, 'utf8');
const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const suffix of ['A', 'B']) {
    const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, suffix);
    const auth = initializeAuth(app, {persistence: inMemoryPersistence});
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
    try {
        const {user} = await createUserWithEmailAndPassword(auth, `${suffix.toLowerCase()}@example.invalid`, 'LOGIN-SOLO-EMULATORE!123');
        const key = cryptoApi.generateVaultKey(), master = `MASTER-FITTIZIA-${suffix}!123`;
        await setDoc(doc(db, 'users', user.uid, 'settings', 'security'), {
            verifier: await cryptoApi.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', master),
            vaultKeyEnvelope: await cryptoApi.wrapVaultKey(key, master)
        });
        for (const domain of ['private', 'company']) for (const title of ['Alfa', 'Zeta']) {
            const fields = {nomeAccount: `${title} ${domain === 'private' ? 'privato' : 'azienda'} ${suffix}`, username: `${title.toLowerCase()}-${suffix.toLowerCase()}@example.invalid`, account: `CODICE-FITTIZIO-${suffix}`, password: `SEGRETO-FITTIZIO-${domain}-${title}-${suffix}`};
            const record = {ownerId: user.uid, _encrypted: true};
            for (const [field, value] of Object.entries(fields)) record[field] = await cryptoApi.encrypt(value, key);
            const path = ['users', user.uid];
            if (domain === 'company') path.push('aziende', 'company');
            path.push('accounts', title.toLowerCase());
            await setDoc(doc(db, ...path), record);
        }
    } finally { await terminate(db); await deleteApp(app); }
}
const assets = new Map([['/', ['emulator.html', 'text/html']], ['/emulator.css', ['emulator.css', 'text/css']], ['/emulator.js', ['emulator.js', 'text/javascript']], ['/symbols.woff2', ['symbols.woff2', 'font/woff2']], ['/assets/images/google-avatar.png', ['assets/images/google-avatar.png', 'image/png']]]);
const server = createServer(async (request, response) => {
    if (request.headers.host !== '127.0.0.1:4188') { response.writeHead(403).end(); return; }
    const asset = assets.get(request.url);
    if (request.method !== 'GET' || !asset) { response.writeHead(404).end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src http://127.0.0.1:9099 http://127.0.0.1:8085; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    try { response.writeHead(200, {'Content-Type': `${asset[1]}; charset=utf-8`}).end(await readFile(`${base}/dist/emulator-site/${asset[0]}`)); }
    catch { response.writeHead(500).end(); }
});
server.listen(4188, '127.0.0.1', () => console.log('Laboratorio pronto: http://127.0.0.1:4188 — solo fixture locali'));
