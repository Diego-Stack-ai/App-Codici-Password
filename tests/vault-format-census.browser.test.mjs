import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

// Collaudo browser della voce Impostazioni «Censimento formati Vault» con account sintetico.
// Reali: HTML di impostazioni.html, impostazioni.js, DOM helpers, cataloghi delle 8 lingue,
// servizio/modello/sonda del censimento, attachment-security e sharing-identity.
// Sostituiti: solo i confini esterni (Firebase, sblocco Vault, enumerazione dei record),
// che restituiscono dati sintetici. Nessun Firebase reale, emulatore o rete esterna.
const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const modulesRoot = path.join(publicRoot, 'assets/js/modules');
const settingsPath = '/assets/js/modules/settings/impostazioni.js';
const settingsSource = await readFile(path.join(publicRoot, settingsPath), 'utf8');
const settingsHtml = await readFile(path.join(publicRoot, 'impostazioni.html'), 'utf8');
const origin = 'http://127.0.0.1:41741';
const externalRequests = [], moduleErrors = [];
let browser;

// Dati sintetici generati con le vere funzioni crittografiche dell'app.
const asModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const withoutImports = source => source.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
const cryptoUtils = await asModule(await readFile(path.join(modulesRoot, 'core/crypto-utils.js'), 'utf8'));
const attachmentSecurity = await asModule(withoutImports(await readFile(path.join(modulesRoot, 'shared/attachment-security.js'), 'utf8')));
const sharingIdentity = await asModule(await readFile(path.join(modulesRoot, 'core/sharing-identity.js'), 'utf8'));
const UID = 'synthetic';
const PRIMARY = cryptoUtils.generateVaultKey();
const LEGACY = 'Sintetica-Master-Storica-2026!';
const OTHER = cryptoUtils.generateVaultKey();
const KEYRING = cryptoUtils.createVaultKeyring(PRIMARY, LEGACY);
const SECRET = 'valore-segreto-sintetico';
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
const identity = await sharingIdentity.createSharingIdentity({uid: UID, vaultKeyMaterial: KEYRING});
const fixtureData = {
    material: KEYRING,
    records: [
        {kind: 'record', scope: 'settings', id: 'security', data: {
            vaultKeyEnvelope: {version: 2, iterations: 600000, keyOrigin: 'random-with-legacy-fallback'},
            verifier: {version: 2, iterations: 600000}}},
        {kind: 'record', scope: 'private-account', id: 'acc-1', data: {
            password: await encryptV1(SECRET, LEGACY), note: await cryptoUtils.encrypt(SECRET, PRIMARY),
            illeggibile: await cryptoUtils.encrypt(SECRET, OTHER), codice: 'Q'.repeat(40)}},
        {kind: 'record', scope: 'private-account-attachment', id: 'att-1', data: {size: 10, encryption: await attachmentEncryption(KEYRING)}},
        {kind: 'record', scope: 'private-account-attachment', id: 'att-2', data: {size: 10, encryption: {version: 9}}}
    ],
    profileAttachments: [],
    identity
};
const forbidden = [SECRET, PRIMARY, LEGACY, OTHER, 'acc-1', 'att-1', 'att-2', UID];

const boot = String.raw`
  const options = new URLSearchParams(location.search);
  window.__census = Object.assign(${JSON.stringify(fixtureData)}, {
    ready: false, mode: options.get('mode') || 'complete',
    confirms: 0, unlocks: 0, collects: 0, toasts: [], holdCollect: null, releaseCollect: null
  });
`;

const modules = new Map();
for (const match of settingsSource.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm)) {
    const url = new URL(match[2], origin + settingsPath);
    const names = match[1].split(',').map(value => value.trim()).filter(Boolean);
    modules.set(url.pathname, names.map(name => {
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw Error(`Unsupported test import: ${name}`);
        return `export function ${name}() { throw Error('UNEXPECTED_SERVICE_${name}'); }`;
    }).join('\n'));
}
modules.set('/assets/js/firebase-config.js', 'export const auth={currentUser:{uid:"synthetic"}}, db={}, storage={};');
modules.set('/assets/js/vendor/firebase-runtime.js', String.raw`
  export function signOut() { throw Error('UNEXPECTED_SIGN_OUT'); }
  export function onAuthStateChanged() { return () => {}; }
  export function doc() { throw Error('UNEXPECTED_FIRESTORE'); }
  export function updateDoc() { throw Error('UNEXPECTED_FIRESTORE'); }
`);
modules.set('/assets/js/modules/core/security-manager.js', String.raw`
  export function isBiometricUnlockConfigured() { return false; }
  export function decrypt() { throw Error('UNEXPECTED_VAULT'); }
  export async function ensureVaultKeyMaterial() {
    const s = window.__census; s.unlocks++;
    if (s.mode === 'unlock-cancelled') throw Error('USER_CANCELLED');
    return s.material;
  }
  export function clearSession() { throw Error('UNEXPECTED_VAULT'); }
  export function resetVault() { throw Error('UNEXPECTED_VAULT'); }
  export function changeMasterPassword() { throw Error('UNEXPECTED_VAULT'); }
`);
modules.set('/assets/js/modules/settings/portable-archive-service.js', 'export const privateTestOnly=true;');
modules.set('/assets/js/modules/settings/backup-export-service.js', String.raw`
  export async function collectOwnerBackup(uid, options) {
    const s = window.__census; s.collects++;
    if (s.mode === 'cancel-during-wait') await new Promise(resolve => { s.holdCollect = true; s.releaseCollect = resolve; });
    return {records: structuredClone(s.records), storagePaths: []};
  }
`);
modules.set('/assets/js/modules/data/vault-repository.js', String.raw`
  export function getUserProfile() { throw Error('UNEXPECTED_REPOSITORY'); }
  export function getUserSetting() { throw Error('UNEXPECTED_REPOSITORY'); }
  export function listProfileWidgets() { throw Error('UNEXPECTED_REPOSITORY'); }
  export async function listBackupProfileDocumentAttachments() { return structuredClone(window.__census.profileAttachments); }
  export async function getBackupSharingPublicIdentity() { return structuredClone(window.__census.identity.publicIdentity); }
  export async function getBackupSharingPrivateIdentity() { return structuredClone(window.__census.identity.privateEnvelope); }
`);
modules.set('/assets/js/ui-core-v129.js', String.raw`
  export function showToast(...args) { window.__census.toasts.push(args); }
  export async function showConfirmModal() { const s = window.__census; s.confirms++; return s.mode !== 'confirm-rejected'; }
  export async function showInputModal() { throw Error('UNEXPECTED_INPUT_DIALOG'); }
`);
modules.set('/assets/js/translations.js', String.raw`
  import {settingsCatalogs} from './translations/settings.js';
  export const getCurrentLanguage = () => 'it';
  // Le due voci generiche vengono dal catalogo base italiano (it.js), non da quello delle Impostazioni.
  const base = {close: 'Chiudi', cancel: 'Annulla'};
  export const t = key => settingsCatalogs.it[key] || base[key] || key;
  export const tf = (key, values) => t(key).replace(/\{([^}]+)\}/g, (_, name) => String(values[name] ?? ''));
`);
modules.delete('/assets/js/dom-utils.js');

async function responseFor(url) {
    if (url.pathname === '/favicon.ico') return {status: 204, body: ''};
    if (url.pathname === '/impostazioni.html') {
        const html = settingsHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<link\b[^>]*>/gi, '')
            .replace(/<body[^>]*>/, '<body>')
            .replace('</head>', '<style>.hidden{display:none!important}</style></head>')
            .replace('</body>', `<script>${boot}</script><script type="module">
              import {__testSetupCensus} from '${settingsPath}';
              __testSetupCensus(); window.__census.ready = true;
            </script></body>`);
        return {contentType: 'text/html', body: html};
    }
    if (url.pathname === settingsPath) {
        return {contentType: 'text/javascript', body: settingsSource + '\nexport function __testSetupCensus(){setupVaultFormatCensus({uid:"synthetic"});}\n'};
    }
    if (modules.has(url.pathname)) return {contentType: 'text/javascript', body: modules.get(url.pathname)};
    const file = path.resolve(publicRoot, `.${url.pathname}`);
    if (!file.startsWith(publicRoot + path.sep)) throw Error('OUTSIDE_PUBLIC_ROOT');
    return {contentType: 'text/javascript', body: await readFile(file)};
}

before(async () => {
    browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH
        ? {executablePath: process.env.CHROME_PATH}
        : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
});
after(async () => {
    try {
        assert.deepEqual(externalRequests, []);
        assert.deepEqual(moduleErrors, []);
    } finally { await browser?.close(); }
});

async function fixture(mode) {
    const context = await browser.newContext({acceptDownloads: true});
    const errors = [];
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.protocol === 'blob:') return route.continue();
        if (url.origin !== origin) { externalRequests.push(url.origin + url.pathname); return route.abort(); }
        try { return route.fulfill(await responseFor(url)); }
        catch (error) { moduleErrors.push(String(error.message)); return route.abort(); }
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error.message)));
    await page.goto(`${origin}/impostazioni.html?mode=${mode}`, {waitUntil: 'networkidle'});
    await page.waitForFunction(() => window.__census?.ready);
    return {page, async close() {
        try { assert.deepEqual(errors, []); } finally { await context.close(); }
    }};
}

const state = page => page.evaluate(() => {
    const s = window.__census;
    return {confirms: s.confirms, unlocks: s.unlocks, collects: s.collects, toasts: s.toasts.length,
        dialog: Boolean(document.querySelector('[aria-labelledby="vault-census-title"]')),
        working: Boolean(document.querySelector('.backup-working-overlay')),
        disabled: document.getElementById('btn-vault-format-census').disabled};
});
const settle = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));

test('conferma rifiutata: nessuno sblocco, nessuna lettura, nessun dialogo', async () => {
    const f = await fixture('confirm-rejected');
    try {
        await f.page.click('#btn-vault-format-census');
        await f.page.waitForFunction(() => window.__census.confirms === 1 && !document.getElementById('btn-vault-format-census').disabled);
        await settle(f.page);
        assert.deepEqual(await state(f.page), {confirms: 1, unlocks: 0, collects: 0, toasts: 0, dialog: false, working: false, disabled: false});
    } finally { await f.close(); }
});

test('sblocco annullato: nessuna lettura e nessun messaggio di errore', async () => {
    const f = await fixture('unlock-cancelled');
    try {
        await f.page.click('#btn-vault-format-census');
        await f.page.waitForFunction(() => window.__census.unlocks === 1 && !document.getElementById('btn-vault-format-census').disabled);
        await settle(f.page);
        assert.deepEqual(await state(f.page), {confirms: 1, unlocks: 1, collects: 0, toasts: 0, dialog: false, working: false, disabled: false});
    } finally { await f.close(); }
});

test('scansione completata con anomalie sintetiche: riepilogo, tabella e rapporto scaricato', async () => {
    const f = await fixture('complete');
    try {
        await f.page.click('#btn-vault-format-census');
        const dialog = f.page.locator('[aria-labelledby="vault-census-title"]');
        await dialog.waitFor({state: 'visible', timeout: 60000});
        const text = await dialog.innerText();
        // 1 CPFE2 di altra chiave + 1 allegato non valido = 2 non aperti; 1 valore ambiguo.
        assert.match(text, /Valori o allegati che non si aprono: 2\./);
        assert.match(text, /forse testo in chiaro: 1\./);
        assert.match(text, /Aperti solo dalla chiave legacy: 1\./);
        assert.match(text, /Allegati che dipendono dal portachiavi intero: 1\./);
        assert.match(text, /Errori di lettura: 0\./);
        assert.match(text, /L’identità di condivisione si apre solo con il portachiavi intero/);
        const headers = await dialog.locator('thead th').allInnerTexts();
        assert.deepEqual(headers, ['Area', 'Elementi', 'Formato vecchio', 'Chiave legacy', 'Non aperti', 'Ambigui', 'Errori']);
        const accounts = await dialog.locator('tbody tr', {hasText: 'private-accounts'}).locator('td').allInnerTexts();
        assert.deepEqual(accounts, ['1', '1', '1', '1', '1', '0']);
        for (const value of forbidden) assert.equal(text.includes(value), false, `il dialogo non mostra ${value}`);
        const [download] = await Promise.all([
            f.page.waitForEvent('download'),
            dialog.getByRole('button', {name: 'Scarica rapporto (JSON)'}).click()
        ]);
        assert.match(download.suggestedFilename(), /^censimento-vault-\d{4}-\d{2}-\d{2}\.json$/);
        const report = JSON.parse(await readFile(await download.path(), 'utf8'));
        assert.equal(report.schema, 'vault-format-census/v1');
        const serialized = JSON.stringify(report);
        for (const value of forbidden) assert.equal(serialized.includes(value), false, `il rapporto non contiene ${value}`);
        await dialog.getByRole('button', {name: 'Chiudi'}).click();
        await f.page.waitForFunction(() => !document.querySelector('[aria-labelledby="vault-census-title"]'));
        assert.equal((await state(f.page)).toasts, 0);
    } finally { await f.close(); }
});

test('annullamento durante l’attesa: nessun risultato, nessun messaggio, pulsante riattivato', async () => {
    const f = await fixture('cancel-during-wait');
    try {
        await f.page.click('#btn-vault-format-census');
        await f.page.waitForFunction(() => window.__census.holdCollect === true);
        await f.page.locator('.backup-working-overlay').getByRole('button', {name: 'Annulla'}).click();
        await f.page.evaluate(() => window.__census.releaseCollect());
        await f.page.waitForFunction(() => !document.getElementById('btn-vault-format-census').disabled);
        await settle(f.page);
        assert.deepEqual(await state(f.page), {confirms: 1, unlocks: 1, collects: 1, toasts: 0, dialog: false, working: false, disabled: false});
    } finally { await f.close(); }
});

test('blocco della Vault prima del download: il dialogo sparisce e non si scarica nulla', async () => {
    const f = await fixture('complete');
    try {
        const downloads = [];
        f.page.on('download', download => downloads.push(download));
        await f.page.click('#btn-vault-format-census');
        const dialog = f.page.locator('[aria-labelledby="vault-census-title"]');
        await dialog.waitFor({state: 'visible', timeout: 60000});
        await f.page.evaluate(() => window.dispatchEvent(new Event('vault-session-locked')));
        await f.page.waitForFunction(() => !document.querySelector('[aria-labelledby="vault-census-title"]'));
        assert.equal(await f.page.getByRole('button', {name: 'Scarica rapporto (JSON)'}).count(), 0);
        await settle(f.page);
        assert.deepEqual(downloads, []);
        assert.equal((await state(f.page)).toasts, 0);
    } finally { await f.close(); }
});
