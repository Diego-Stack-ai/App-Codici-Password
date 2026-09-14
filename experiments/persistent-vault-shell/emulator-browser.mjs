import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {buildEmulator} from './build-emulator.mjs';
import {createEmulatorNoteBridge} from './emulator-note-bridge.mjs';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, terminate} from 'firebase/firestore';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const base = import.meta.dirname;
const automated = process.argv.includes('--test');
let reportResult;
await buildEmulator();
const source = await readFile(`${base}/../../Frontend/public/assets/js/modules/core/crypto-utils.js`, 'utf8');
const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixtureUids = [];
for (const suffix of ['A', 'B']) {
    const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, suffix);
    const auth = initializeAuth(app, {persistence: inMemoryPersistence});
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
    try {
        const {user} = await createUserWithEmailAndPassword(auth, `${suffix.toLowerCase()}@example.invalid`, 'LOGIN-SOLO-EMULATORE!123');
        fixtureUids.push(user.uid);
        await setDoc(doc(db, 'users', user.uid), {});
        const key = cryptoApi.generateVaultKey(), master = `MASTER-FITTIZIA-${suffix}!123`;
        const encrypted = value => cryptoApi.encrypt(value, key);
        await setDoc(doc(db, 'users', user.uid), {nome: await encrypted('Nome fittizio'),
            contactEmails: [{id: 'email', address: await encrypted('fixture@example.invalid'), linkedAccountId: 'zeta'}],
            contactPhones: [{id: 'phone', value: await encrypted('000000000')}],
            userAddresses: [{id: 'address', street: await encrypted('Via fittizia')}],
            documenti: [{id: 'document', numero: await encrypted('DOC-FITTIZIO')}]});
        await setDoc(doc(db, 'users', user.uid, 'aziende', 'company'), {ragioneSociale: await encrypted('Azienda fittizia')});
        await setDoc(doc(db, 'users', user.uid, 'profileWidgets', 'fixture'), {title: 'Widget fittizio', description: '', tab: 'personal',
            order: 0, size: 'medium', collapsed: false, schemaVersion: 1, fields: [{id: 'field', encrypted: true, value: await encrypted('WIDGET-FITTIZIO')}]});
        await setDoc(doc(db, 'users', user.uid, 'scadenze', 'fixture'), {note: await encrypted('SCADENZA-FITTIZIA')});
        await setDoc(doc(db, 'users', user.uid, 'accounts', 'banca', 'attachments', 'fixture'), {name: await encrypted('ALLEGATO-FITTIZIO'), createdAt: 1});
        await setDoc(doc(db, 'users', user.uid, 'settings', 'security'), {
            verifier: await cryptoApi.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', master),
            vaultKeyEnvelope: await cryptoApi.wrapVaultKey(key, master)
        });
        for (const domain of ['private', 'company']) for (const title of ['Alfa', 'Zeta', 'Banca']) {
            const fields = {nomeAccount: `${title} ${domain === 'private' ? 'privato' : 'azienda'} ${suffix}`, username: `${title.toLowerCase()}-${suffix.toLowerCase()}@example.invalid`, account: `CODICE-FITTIZIO-${suffix}`, password: `SEGRETO-FITTIZIO-${domain}-${title}-${suffix}`,
                note: `Nota fittizia per ${title} ${suffix}\nSeconda riga della nota.`, url: `https://example.invalid/${domain}/${title.toLowerCase()}`};
            const record = {ownerId: user.uid, _encrypted: true};
            if (title === 'Banca') Object.assign(record, {isBanking: true, banking: [{bankId: 'fixture', iban: await encrypted('IBAN-FITTIZIO'), cards: [{pin: await encrypted('1234'), ccv: await encrypted('000')}]}]});
            if (domain === 'private' && title === 'Alfa') Object.assign(record, {schemaVersion: 1, revision: 0, type: 'account', visibility: 'private'});
            for (const [field, value] of Object.entries(fields)) record[field] = await cryptoApi.encrypt(value, key);
            const path = ['users', user.uid];
            if (domain === 'company') path.push('aziende', 'company');
            path.push('accounts', title.toLowerCase());
            await setDoc(doc(db, ...path), record);
        }
    } finally { await terminate(db); await deleteApp(app); }
}
const assets = new Map([['/', ['emulator.html', 'text/html']], ['/emulator.css', ['emulator.css', 'text/css']], ['/emulator.js', ['emulator.js', 'text/javascript']], ['/symbols.woff2', ['symbols.woff2', 'font/woff2']], ['/assets/images/google-avatar.png', ['assets/images/google-avatar.png', 'image/png']]]);
const handleNote = createEmulatorNoteBridge(fixtureUids);
const server = createServer(async (request, response) => {
    if (request.headers.host !== '127.0.0.1:4188') { response.writeHead(403).end(); return; }
    if (await handleNote(request, response)) return;
    if (automated && request.url === '/entry-result' && request.method === 'POST' && request.headers.origin === 'http://127.0.0.1:4188') {
        let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 10000) { response.writeHead(413).end(); return; } }
        reportResult?.(JSON.parse(body)); response.end('{}'); return;
    }
    if (automated && request.url === '/entry-check.mjs') {
        response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(`${base}/emulator-entry-check.mjs`)); return;
    }
    const asset = assets.get(request.url);
    if (request.method !== 'GET' || !asset) { response.writeHead(404).end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8085; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    try {
        let body = await readFile(`${base}/dist/emulator-site/${asset[0]}`);
        if (automated && request.url === '/') body = body.toString().replace('</body>', '<script type="module" src="/entry-check.mjs"></script></body>');
        response.writeHead(200, {'Content-Type': `${asset[1]}; charset=utf-8`}).end(body);
    }
    catch { response.writeHead(500).end(); }
});
await new Promise(done => server.listen(4188, '127.0.0.1', done));
console.log('Laboratorio pronto: http://127.0.0.1:4188 — solo fixture locali');
if (automated) {
    try { await (await import('./emulator-entry-runner.mjs')).runEntryBrowsers(() => new Promise(resolve => { reportResult = resolve; })); }
    finally { server.closeAllConnections(); await new Promise(done => server.close(done)); }
    process.exit(0);
}
