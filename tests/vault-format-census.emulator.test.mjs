import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {chromium} from 'playwright';

// Collaudo con Auth e Firestore emulati (progetto demo-vault-census), avviato da
// scripts/run-vault-census-emulators.mjs. Reali: tutte le pagine e i moduli dell'app,
// login dalla pagina login.html, sblocco con la Master Password sintetica, Rules del
// repository e SDK Firebase dello stesso pacchetto. Sostituiti dal solo server di test:
// firebase-config.js (progetto demo collegato agli emulatori, App Check disattivato)
// e firebase-runtime.js (stesso SDK con i connettori dell'emulatore).
const require = createRequire(import.meta.url);
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');
const PROJECT = 'demo-vault-census';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Avviare con scripts/run-vault-census-emulators.mjs');
}
const [authHost, authPort] = process.env.FIREBASE_AUTH_EMULATOR_HOST.split(':');
const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const modulesRoot = path.join(publicRoot, 'assets/js/modules');
const runtimeSource = await readFile(process.env.VAULT_CENSUS_RUNTIME, 'utf8');
const configSource = await readFile(path.join(publicRoot, 'assets/js/firebase-config.js'), 'utf8');

function emulatorConfig() {
    let source = configSource
        .replace(/const firebaseConfig = \{[\s\S]*?\n\};/, `const firebaseConfig = {apiKey: "demo-key", authDomain: "${PROJECT}.firebaseapp.com", projectId: "${PROJECT}", storageBucket: "${PROJECT}.appspot.com", messagingSenderId: "1", appId: "1:1:web:1"};`)
        .replace(/export function enableAppCheck\(\) \{[\s\S]*?\n\}/, 'export function enableAppCheck() { return null; }')
        .replace('const auth = getAuth(app);', `const auth = getAuth(app);\nconnectAuthEmulator(auth, "http://${authHost}:${authPort}", {disableWarnings: true});`)
        .replace('const storage = getStorage(app);', `connectFirestoreEmulator(db, "${firestoreHost}", ${Number(firestorePort)});\nconst storage = getStorage(app);`);
    for (const marker of ['demo-key', 'connectAuthEmulator(auth', 'connectFirestoreEmulator(db', 'return null; }']) {
        if (!source.includes(marker)) throw new Error(`EMULATOR_CONFIG_PATCH_FAILED: ${marker}`);
    }
    return `import {connectAuthEmulator, connectFirestoreEmulator} from "/assets/js/vendor/firebase-runtime.js";\n${source}`;
}

// Dati sintetici generati con le vere funzioni crittografiche dell'app.
const asModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const withoutImports = source => source.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
const cryptoUtils = await asModule(await readFile(path.join(modulesRoot, 'core/crypto-utils.js'), 'utf8'));
const attachmentSecurity = await asModule(withoutImports(await readFile(path.join(modulesRoot, 'shared/attachment-security.js'), 'utf8')));
const sharingIdentity = await asModule(await readFile(path.join(modulesRoot, 'core/sharing-identity.js'), 'utf8'));
const EMAIL = 'censimento.sintetico@example.test';
const LOGIN_PASSWORD = 'Sintetica-Login-2026!xQ';
const MASTER = 'Sintetica-Master-Corrente-2026!Zk';
const LEGACY = 'Sintetica-Master-Storica-2026!';
const PRIMARY = cryptoUtils.generateVaultKey();
const OTHER = cryptoUtils.generateVaultKey();
const KEYRING = cryptoUtils.createVaultKeyring(PRIMARY, LEGACY);
const SECRET = 'valore-segreto-sintetico-emulatore';
const b64 = bytes => Buffer.from(bytes).toString('base64');
async function encryptV1(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256'},
        material, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(text)));
    return b64(Buffer.concat([salt, iv, ct]));
}
async function attachmentEncryption(keyMaterial) {
    const wrap = await attachmentSecurity.wrapAttachmentFileKey(crypto.getRandomValues(new Uint8Array(32)), keyMaterial);
    return {version: 1, cipher: 'AES-GCM-256', ...wrap, contentIv: b64(crypto.getRandomValues(new Uint8Array(12))),
        originalType: 'application/pdf', originalSize: 10};
}

const adminApp = initializeApp({projectId: PROJECT});
const firestore = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
let uid, browser, server, origin;
const externalRequests = [];

async function seed() {
    const user = await adminAuth.createUser({email: EMAIL, password: LOGIN_PASSWORD, emailVerified: true});
    uid = user.uid;
    const identity = await sharingIdentity.createSharingIdentity({uid, vaultKeyMaterial: KEYRING});
    const now = new Date().toISOString();
    const userRef = firestore.doc(`users/${uid}`);
    await userRef.set({email: EMAIL, passwordPolicyVersion: 1,
        settings: {language: 'it', firstConfiguration: {version: 1, completed: true, completedAt: now}},
        nome: await cryptoUtils.encrypt('Profilo sintetico', PRIMARY)});
    await userRef.collection('settings').doc('security').set({
        vaultKeyEnvelope: await cryptoUtils.wrapVaultKey(KEYRING, MASTER, 'random-with-legacy-fallback'),
        verifier: await cryptoUtils.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', MASTER)
    });
    await userRef.collection('accounts').doc('acc-1').set({nomeAccount: 'Account sintetico',
        password: await encryptV1(SECRET, LEGACY), note: await cryptoUtils.encrypt(SECRET, PRIMARY),
        illeggibile: await cryptoUtils.encrypt(SECRET, OTHER), codice: 'Q'.repeat(40)});
    await userRef.collection('accounts').doc('acc-2').set({nomeAccount: 'Archiviato sintetico', isArchived: true,
        password: await encryptV1(SECRET, PRIMARY)});
    await userRef.collection('accounts').doc('acc-1').collection('attachments').doc('att-1').set({
        name: 'sintetico.pdf', size: 10, encryption: await attachmentEncryption(KEYRING)});
    await userRef.collection('accounts').doc('acc-1').collection('attachments').doc('att-2').set({
        name: 'rotto.pdf', size: 10, encryption: {version: 9}});
    await userRef.collection('cryptoIdentity').doc('current').set(identity.privateEnvelope);
    await firestore.doc(`cryptoPublicKeys/${uid}`).set(identity.publicIdentity);
}

// Istantanea completa del database emulato (tutti i documenti, ricorsiva).
async function snapshot() {
    const out = {};
    const visit = async reference => {
        for (const collection of await reference.listCollections()) {
            for (const document of await collection.listDocuments()) {
                const value = await document.get();
                if (value.exists) out[document.path] = JSON.stringify(value.data());
                await visit(document);
            }
        }
    };
    await visit(firestore);
    return out;
}
const forbidden = () => [SECRET, PRIMARY, LEGACY, OTHER, MASTER, LOGIN_PASSWORD, EMAIL, uid, 'acc-1', 'acc-2', 'att-1', 'att-2'];

async function respond(request, response) {
    try {
        const url = new URL(request.url, origin);
        let body, type = 'text/javascript';
        if (url.pathname === '/assets/js/vendor/firebase-runtime.js') body = runtimeSource;
        else if (url.pathname === '/assets/js/firebase-config.js') body = emulatorConfig();
        else {
            const relative = url.pathname === '/' ? 'login.html' : decodeURIComponent(url.pathname.slice(1));
            const file = path.resolve(publicRoot, relative);
            if (!file.startsWith(publicRoot + path.sep) || !existsSync(file)) { response.writeHead(404); return response.end(); }
            body = await readFile(file);
            const ext = path.extname(file);
            type = {'.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
                '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon'}[ext] || 'text/javascript';
        }
        response.writeHead(200, {'content-type': type, 'cache-control': 'no-store'});
        response.end(body);
    } catch (error) {
        response.writeHead(500); response.end(String(error.message));
    }
}

before(async () => {
    await seed();
    server = createServer(respond);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH
        ? {executablePath: process.env.CHROME_PATH}
        : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
});
after(async () => {
    await browser?.close();
    await new Promise(resolve => server?.close(resolve));
    assert.deepEqual([...new Set(externalRequests)].filter(host => !/^127\.0\.0\.1(:\d+)?$/.test(host)), []);
});

async function openSettings() {
    const context = await browser.newContext({serviceWorkers: 'block', acceptDownloads: true, locale: 'it-IT'});
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
        if (url.hostname !== '127.0.0.1') { externalRequests.push(url.host); return route.abort(); }
        return route.continue();
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    if (process.env.VAULT_CENSUS_DEBUG) {
        page.on('console', message => console.log('[console]', message.type(), message.text().slice(0, 300)));
        page.on('pageerror', error => console.log('[pageerror]', error.message));
        page.on('requestfailed', request => console.log('[requestfailed]', request.url().slice(0, 200), request.failure()?.errorText));
        page.on('response', response => { if (response.status() >= 400) console.log('[http]', response.status(), response.url().slice(0, 200)); });
    }
    await page.goto(`${origin}/login.html`);
    // Dispositivo nuovo: la scelta iniziale della lingua precede il login, come per ogni utente.
    const languageDialog = page.locator('#initial-language-dialog');
    await languageDialog.waitFor({state: 'visible', timeout: 15000});
    await languageDialog.locator('button[data-code="it"]').click();
    await Promise.all([page.waitForEvent('load'), languageDialog.locator('.first-configuration-primary').click()]);
    await page.locator('#login-submit-btn').waitFor({state: 'visible', timeout: 30000});
    await page.fill('#email', EMAIL);
    await page.fill('#password', LOGIN_PASSWORD);
    await page.click('#login-submit-btn');
    await page.waitForURL(/home_page\.html/, {timeout: 60000});
    await page.goto(`${origin}/impostazioni.html`);
    await page.locator('#btn-vault-format-census').waitFor({state: 'visible', timeout: 60000});
    // Le pagine private chiedono lo sblocco della Vault all'apertura.
    await page.locator('#protocol-input-modal').waitFor({state: 'visible', timeout: 30000});
    return {context, page, pageErrors};
}

async function unlockWithMaster(page) {
    const input = page.locator('#protocol-input-modal input');
    await input.waitFor({state: 'visible', timeout: 30000});
    await input.fill(MASTER);
    await page.click('#modal-confirm-btn');
}

const dialog = page => page.locator('[aria-labelledby="vault-census-title"]');

// Dopo «Sblocca e riprendi» la pagina si ricarica: il pulsante è visibile prima che
// initImpostazioni colleghi i gestori. Si ripete il clic finché compare la conferma reale.
async function openCensusConfirm(page) {
    for (let attempt = 0; attempt < 20; attempt++) {
        await page.click('#btn-vault-format-census');
        try {
            await page.locator('#confirm-ok-btn').waitFor({state: 'visible', timeout: 1500});
            return attempt;
        } catch { /* gestore non ancora collegato */ }
    }
    throw new Error('CENSUS_CONFIRM_NOT_SHOWN');
}
const settleMs = (page, ms = 300) => page.waitForTimeout(ms);

test('collaudo in emulatore: conferma, sblocco, conteggi, download, annullamento, blocco e nessuna scrittura', {timeout: 600000}, async t => {
    const {context, page, pageErrors} = await openSettings();
    const before = await snapshot();
    const downloads = [];
    page.on('download', download => downloads.push(download));
    try {
        await t.test('sblocco annullato all’apertura: Vault bloccata e censimento non raggiungibile', async () => {
            await page.click('#modal-cancel-btn');
            await page.locator('#protocol-input-modal').waitFor({state: 'detached', timeout: 15000});
            const resume = page.getByRole('button', {name: /Sblocca e riprendi/i});
            await resume.waitFor({state: 'visible', timeout: 15000});
            assert.match(await page.locator('body').innerText(), /Vault bloccata/);
            await page.locator('#btn-vault-format-census').waitFor({state: 'hidden', timeout: 15000});
            assert.equal(await dialog(page).count(), 0);
            assert.equal(await page.locator('.backup-working-overlay').count(), 0);
            // Sblocco normale con la Master Password sintetica.
            await resume.click();
            await unlockWithMaster(page);
            await page.locator('#btn-vault-format-census').waitFor({state: 'visible', timeout: 60000});
        });

        await t.test('conferma rifiutata: nessuna scansione', async () => {
            await openCensusConfirm(page);
            await page.click('#confirm-cancel-btn');
            await settleMs(page);
            assert.equal(await page.locator('.backup-working-overlay').count(), 0);
            assert.equal(await dialog(page).count(), 0);
            assert.equal(await page.locator('#btn-vault-format-census').isDisabled(), false);
        });

        await t.test('scansione completa: conteggi, anomalie e rapporto locale senza valori', async () => {
            await openCensusConfirm(page);
            await page.click('#confirm-ok-btn');
            // La Vault è già sbloccata: il censimento non chiede di nuovo la Master Password.
            await dialog(page).waitFor({state: 'visible', timeout: 180000});
            assert.equal(await page.locator('#protocol-input-modal').count(), 0);
            const text = await dialog(page).innerText();
            // 1 CPFE2 di altra chiave + 1 allegato non valido = 2 non aperti; 1 valore ambiguo;
            // legacy: 1 v1 aperto solo dalla vecchia Master; formato vecchio: 2 v1.
            assert.match(text, /Formato vecchio a 100\.000 iterazioni: 2\./);
            assert.match(text, /Aperti solo dalla chiave legacy: 1\./);
            assert.match(text, /Allegati che dipendono dal portachiavi intero: 1\./);
            assert.match(text, /Valori o allegati che non si aprono: 2\./);
            assert.match(text, /forse testo in chiaro: 1\./);
            assert.match(text, /Errori di lettura: 0\./);
            assert.match(text, /L’identità di condivisione si apre solo con il portachiavi intero/);
            const accounts = await dialog(page).locator('tbody tr', {hasText: 'private-accounts'}).locator('td').allInnerTexts();
            assert.deepEqual(accounts, ['2', '2', '1', '1', '1', '0']);
            for (const value of forbidden()) assert.equal(text.includes(value), false, `il dialogo non mostra ${value}`);
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                dialog(page).getByRole('button', {name: 'Scarica rapporto (JSON)'}).click()
            ]);
            const report = JSON.parse(await readFile(await download.path(), 'utf8'));
            assert.equal(report.schema, 'vault-format-census/v1');
            assert.equal(report.security.keyringKind, 'keyring');
            assert.equal(report.security.legacyKeyPresent, true);
            assert.equal(report.security.keyOrigin, 'random-with-legacy-fallback');
            assert.equal(report.areas.find(area => area.id === 'private-accounts').archived, 1);
            const serialized = JSON.stringify(report);
            for (const value of forbidden()) assert.equal(serialized.includes(value), false, `il rapporto non contiene ${value}`);
            await dialog(page).getByRole('button', {name: 'Chiudi'}).click();
            await page.waitForFunction(() => !document.querySelector('[aria-labelledby="vault-census-title"]'));
        });

        await t.test('annullamento durante l’attesa: nessun risultato', async () => {
            await openCensusConfirm(page);
            await page.click('#confirm-ok-btn');
            const overlay = page.locator('.backup-working-overlay');
            await overlay.waitFor({state: 'visible', timeout: 30000});
            await overlay.getByRole('button', {name: 'Annulla'}).click();
            await page.waitForFunction(() => !document.getElementById('btn-vault-format-census').disabled, null, {timeout: 60000});
            await settleMs(page, 2000);
            assert.equal(await dialog(page).count(), 0);
        });

        await t.test('blocco reale della Vault prima del download: dialogo rimosso, nessun file', async () => {
            const downloadsBefore = downloads.length;
            await openCensusConfirm(page);
            await page.click('#confirm-ok-btn');
            await dialog(page).waitFor({state: 'visible', timeout: 180000});
            await page.evaluate(async () => {
                const manager = await import('/assets/js/modules/core/security-manager.js');
                manager.softLock();
            });
            await page.waitForFunction(() => !document.querySelector('[aria-labelledby="vault-census-title"]'));
            assert.equal(await page.getByRole('button', {name: 'Scarica rapporto (JSON)'}).count(), 0);
            await settleMs(page, 500);
            assert.equal(downloads.length, downloadsBefore);
        });

        await t.test('nessuna scrittura sui dati applicativi durante gli scenari', async () => {
            const afterSnapshot = await snapshot();
            // L'istantanea copre tutto il database: gli 8 documenti seminati, più quelli eventualmente
            // creati dall'app all'apertura della pagina (prima della prima istantanea).
            assert.ok(Object.keys(before).length >= 8, `istantanea incompleta: ${Object.keys(before).length}`);
            for (const expected of ['users/<uid>', 'users/<uid>/settings/security', 'users/<uid>/accounts/acc-1',
                'users/<uid>/accounts/acc-1/attachments/att-1', 'users/<uid>/cryptoIdentity/current', 'cryptoPublicKeys/<uid>']) {
                assert.ok(expected.replaceAll('<uid>', uid) in before, `istantanea senza ${expected}`);
            }
            assert.deepEqual(Object.keys(afterSnapshot).sort(), Object.keys(before).sort(), 'stessi documenti');
            for (const [documentPath, value] of Object.entries(before)) {
                assert.equal(afterSnapshot[documentPath], value, `documento invariato: ${documentPath.replace(uid, '<uid>')}`);
            }
        });
    } finally {
        await context.close();
    }
    assert.deepEqual(pageErrors, []);
});
