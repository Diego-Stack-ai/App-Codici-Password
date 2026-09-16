import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {buildEmulator} from './build-emulator.mjs';
import {createEmulatorNoteBridge} from './emulator-note-bridge.mjs';
import {createEmulatorQrBridge} from './emulator-qr-bridge.mjs';
import {withQrSelectionCandidateRules} from './qr-selection-candidate-rules.mjs';
import {withAccountNoteCandidateRules} from './account-note-candidate-rules.mjs';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, terminate} from 'firebase/firestore';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const base = import.meta.dirname;
const forced = process.argv.includes('--test-crash');
const restart = process.argv.includes('--test-restart') || forced;
const cold = process.argv.includes('--test-cold') || restart;
const automated = process.argv.includes('--test') || cold;
let reportResult;
await buildEmulator({persistent: cold});
const source = await readFile(`${base}/../../Frontend/public/assets/js/modules/core/crypto-utils.js`, 'utf8');
const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const fixtureUids = [];
const widgetEnvironment = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085}});
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
        await setDoc(doc(db, 'users', user.uid), {nome: await encrypted('Nome fittizio'), note: await encrypted('Nota anagrafica fittizia'),
            contactEmails: [{id: 'email', address: await encrypted('fixture@example.invalid'), linkedAccountId: 'zeta'}],
            contactPhones: [{id: 'phone', number: await encrypted('000000000'), linkedAccountId: 'zeta'}, {id: 'company-phone', number: await encrypted('000000001'), linkedAccountId: 'zeta', linkedAccountCompanyId: 'company'}],
            userAddresses: [{id: 'address', address: await encrypted('Via fittizia'), utilities: [{id: 'utility', type: 'Energia', value: await encrypted('POD-FITTIZIO'), linkedAccountId: 'zeta', linkedAccountCompanyId: 'company'}]}],
            documenti: [{id: 'document', num_serie: await encrypted('DOC-FITTIZIO'), linkedAccountId: 'zeta'}]});
        await setDoc(doc(db, 'users', user.uid, 'settings', 'qrCodeInclusions'), {nome: true, phones: ['phone'], emails: ['email'], addresses: ['address'], photo: false});
        await setDoc(doc(db, 'users', user.uid, 'aziende', 'company'), {ragioneSociale: await encrypted('Azienda fittizia'), qrConfig: {persEmail: false},
            partitaIva: await encrypted('IVA-FITTIZIA'), emails: {pec: {email: await encrypted('pec@example.invalid'), linkedAccountId: 'zeta', linkedAccountCompanyId: 'company'}, personale: {email: await encrypted('personale@example.invalid'), linkedAccountId: 'zeta'}},
            telefonoAzienda: await encrypted('111111111'), phoneAccountLinks: {telefonoAzienda: {linkedAccountId: 'zeta', linkedAccountCompanyId: 'company'}},
            indirizzoSede: await encrypted('Sede fittizia'), altreSedi: [{indirizzo: await encrypted('Filiale fittizia')}],
            allegati: [{name: await encrypted('Visura fittizia')}]});
        await setDoc(doc(db, 'users', user.uid, 'aziende', 'second-company'), {ragioneSociale: await encrypted('Seconda azienda fittizia'), partitaIva: await encrypted('IVA-SECONDA'),
            emails: {pec: {email: await encrypted('seconda@example.invalid'), linkedAccountId: 'zeta', linkedAccountCompanyId: 'second-company'}}});
        await setDoc(doc(db, 'users', user.uid, 'profileWidgets', 'fixture'), {title: 'Widget fittizio', description: '', tab: 'personal',
            order: 0, size: 'medium', collapsed: true, schemaVersion: 1, fields: [{id: 'field', label: 'PIN profilo', type: 'sensitive', encrypted: true, valueEnc: await encrypted('WIDGET-FITTIZIO')},
                {id: 'hidden', label: 'Testo senza anteprima', type: 'text', encrypted: false, value: 'ANTEPRIMA-FITTIZIA', preview: false, copyable: true}]});
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
            if (title === 'Banca') Object.assign(record, {isBanking: true, banking: [
                {bankId: 'fixture', iban: await encrypted('IBAN-FITTIZIO'), cards: [{pin: await encrypted('1234'), ccv: await encrypted('000')}]},
                {bankId: 'fixture-two', iban: await encrypted('IBAN-SECONDO'), cards: [{pin: await encrypted('5678'), ccv: await encrypted('111')}]}]});
            if (domain === 'private' && title === 'Alfa') Object.assign(record, {schemaVersion: 1, revision: 0, type: 'account', visibility: 'private'});
            for (const [field, value] of Object.entries(fields)) record[field] = await cryptoApi.encrypt(value, key);
            const path = ['users', user.uid];
            if (domain === 'company') path.push('aziende', 'company');
            path.push('accounts', title.toLowerCase());
            await setDoc(doc(db, ...path), record);
            if (domain === 'company' && title === 'Zeta') await setDoc(doc(db, 'users', user.uid, 'aziende', 'second-company', 'accounts', 'zeta'), {
                ...record, nomeAccount: await encrypted('Zeta seconda ' + suffix), password: await encrypted('SEGRETO-FITTIZIO-second-company-Zeta-' + suffix)});
        }
        // Function-only collections: seed only the loopback emulator via the
        // test administrator; never weaken production Rules for these fixtures.
        await widgetEnvironment.withSecurityRulesDisabled(async admin => {
            const root = `users/${user.uid}`;
            await admin.firestore().doc(`${root}/sharedVaultData/common`).set({ownerId: user.uid, title: 'Credenziale comune fittizia',
                fields: [{id: 'common', label: 'Codice comune', encrypted: true, valueEnc: await encrypted('COMMON-' + suffix), copyable: false}]});
            for (const scope of ['private', 'company', 'second-company']) {
                const target = {context: scope === 'private' ? 'private' : 'company', accountId: 'zeta',
                    ...(scope === 'private' ? {} : {companyId: scope})};
                await admin.firestore().doc(`${root}/accountWidgets/widget-${scope}`).set({ownerId: user.uid, ...target, kind: 'embedded', title: 'Widget ' + scope,
                    fields: [{id: 'pin', label: 'PIN Widget', encrypted: true, valueEnc: await encrypted(`WIDGET-${scope}-${suffix}`), copyable: false},
                        {id: 'plain', label: 'Descrizione', encrypted: false, value: 'Campo fittizio ' + scope, copyable: true}]});
                await admin.firestore().doc(`${root}/accountWidgets/link-${scope}`).set({ownerId: user.uid, ...target, kind: 'shared-reference', sharedDataId: 'common'});
                if (scope !== 'second-company') for (const bankId of ['fixture', 'fixture-two']) {
                    await admin.firestore().doc(`${root}/accountWidgets/bank-${scope}-${bankId}`).set({ownerId: user.uid, ...target, accountId: 'banca', bankId, kind: 'embedded',
                        title: 'Campi ' + bankId, fields: [{id: 'value', label: 'Dato banca', encrypted: true,
                            valueEnc: await encrypted(`BANK-WIDGET-${scope}-${bankId}-${suffix}`), copyable: false}]});
                }
            }
        });
    } finally { await terminate(db); await deleteApp(app); }
}
await widgetEnvironment.cleanup();
const qrRulesEnvironment = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085,
    rules: withAccountNoteCandidateRules(withQrSelectionCandidateRules(await readFile(`${base}/../../firestore.rules`, 'utf8')))}});
await qrRulesEnvironment.cleanup();
const assets = new Map([['/assets/js/vendor/qrcode.min.js', ['assets/js/vendor/qrcode.min.js', 'text/javascript']], ['/', ['emulator.html', 'text/html']], ['/emulator.css', ['emulator.css', 'text/css']], ['/emulator.js', ['emulator.js', 'text/javascript']], ['/symbols.woff2', ['symbols.woff2', 'font/woff2']], ['/assets/images/google-avatar.png', ['assets/images/google-avatar.png', 'image/png']]]);
const handleNote = createEmulatorNoteBridge(fixtureUids);
assets.set('/company-summary-pdf.js', ['company-summary-pdf.js', 'text/javascript']);
for (const name of ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'LICENSE_LIBERATION']) {
    assets.set(`/assets/pdf/${name}`, [`assets/pdf/${name}`, name.endsWith('.ttf') ? 'font/ttf' : 'text/plain']);
}
const handleQr = await createEmulatorQrBridge(fixtureUids);
const server = createServer(async (request, response) => {
    if (request.headers.host !== '127.0.0.1:4188') { response.writeHead(403).end(); return; }
    if (await handleNote(request, response)) return;
    if (await handleQr(request, response)) return;
    if (automated && request.url === '/entry-result' && request.method === 'POST' && request.headers.origin === 'http://127.0.0.1:4188') {
        let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 10000) { response.writeHead(413).end(); return; } }
        reportResult?.(JSON.parse(body)); response.end('{}'); return;
    }
    if (automated && request.url === '/entry-check.mjs') {
        response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(`${base}/${cold ? 'emulator-cold-check.mjs' : 'emulator-entry-check.mjs'}`)); return;
    }
    if (cold && request.method === 'GET' && request.url === '/emulator-cold-sw.js') {
        response.setHeader('Content-Type', 'text/javascript'); response.setHeader('Cache-Control', 'no-store');
        response.end(await readFile(`${base}/emulator-cold-sw.js`)); return;
    }
    const asset = assets.get(request.url);
    if (request.method !== 'GET' || !asset) { response.writeHead(404).end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8085; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    try {
        let body = await readFile(`${base}/dist/emulator-site/${asset[0]}`);
        if (cold && request.url === '/') body = body.toString().replace('Al ricaricamento serve un nuovo accesso.', 'Prova cache persistente: al ricaricamento il Vault torna bloccato.');
        if (automated && request.url === '/') body = body.toString().replace('</body>', '<script type="module" src="/entry-check.mjs"></script></body>');
        response.writeHead(200, {'Content-Type': `${asset[1]}; charset=utf-8`}).end(body);
    }
    catch { response.writeHead(500).end(); }
});
await new Promise(done => server.listen(4188, '127.0.0.1', done));
console.log('Laboratorio pronto: http://127.0.0.1:4188 — solo fixture locali');
if (automated) {
    try { await (await import('./emulator-entry-runner.mjs')).runEntryBrowsers(() => new Promise(resolve => { reportResult = resolve; }), {restart, forced}); }
    finally { server.closeAllConnections(); await new Promise(done => server.close(done)); }
    process.exit(0);
}
