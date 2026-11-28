import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {chromium} from 'playwright';
import {PDFDocument, PDFName} from 'pdf-lib';
import {extractPdfText} from './pdf-text.mjs';

// Collaudo browser del pannello PDF della Tessera digitale (issue #379), con dati sintetici.
// Reali: pannello, modello, azioni PDF condivise con la scheda aziendale, bundle pdf-lib,
// font, codifica della foto, DOM helpers. Sostituiti: Firebase, stato di sblocco, ponte del
// frame Vault e cataloghi (che restituiscono la chiave). Nessuna rete esterna.
const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const origin = 'http://127.0.0.1:41742';
const PHOTO_URL = 'https://firebasestorage.googleapis.com/v0/b/appcodici-password.firebasestorage.app/o/users%2Fsynthetic%2Favatar_1?alt=media';
// PNG sintetico 16x16 (rosso) costruito qui, senza file binari nel repository.
const crcTable = Array.from({length: 256}, (_, n) => {let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;});
const crc = bytes => {let c = 0xffffffff; for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;};
const chunk = (type, data) => {const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4); return out;};
const header = Buffer.alloc(13); header.writeUInt32BE(16, 0); header.writeUInt32BE(16, 4); header[8] = 8; header[9] = 2;
const raster = Buffer.concat(Array.from({length: 16}, () => Buffer.from([0, ...Array.from({length: 16}, () => [200, 30, 30]).flat()])));
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raster)), chunk('IEND', Buffer.alloc(0))]);
const externalRequests = [];
let browser;

const stubs = {
    '/assets/js/firebase-config.js': `export const auth = {get currentUser() {return window.__card.user;}};`,
    '/assets/js/vendor/firebase-runtime.js': `export function onAuthStateChanged(_auth, callback) {window.__card.authCallback = callback; return () => {};}`,
    '/assets/js/modules/core/security-manager.js': `export function isVaultUnlocked() {return window.__card.unlocked;}`,
    '/assets/js/modules/core/vault-frame-client.js': `export function executeFrameNativeAction(target, action) {
        window.__card.native.push(target.scope); return action(target.snapshotBytes);}`,
    '/assets/js/translations.js': `export function t(key) {return key;}`
};
const page = `<!doctype html><meta charset="utf-8"><body><div id="root"></div><script type="module">
  window.__card = {user: {uid: 'synthetic'}, unlocked: true, native: [], shares: [], authCallback: null};
  const params = new URLSearchParams(location.search);
  if (params.get('share') === 'yes') {
    navigator.canShare = data => Array.isArray(data?.files) && data.files[0]?.type === 'application/pdf';
    navigator.share = async data => {window.__card.shares.push({name: data.files[0].name, title: data.title, size: data.files[0].size,
      activation: navigator.userActivation?.isActive ?? null});
      if (params.get('cancel') === 'yes') throw new DOMException('cancel', 'AbortError');};
  } else {navigator.canShare = undefined; navigator.share = undefined;}
  const photo = params.get('photo') === 'yes';
  const source = {userData: {nome: 'Mario', cognome: 'Rossi', photoURL: '${PHOTO_URL}',
      documenti: [{type: 'Codice Fiscale', cf_value: 'RSSMRA80B01G224X'}]},
    inclusions: {photo, nome: true, cf: params.get('cf') === 'yes', emails: ['e1']},
    options: {contactEmails: [{id: 'e1', address: 'mario@example.invalid'}, {id: 'e2', address: 'esclusa@example.invalid'}],
      customFields: [{label: 'PIN', type: 'text', value: 'SEGRETO-PIN', includeInQr: true, sensitivity: 'secret'}]}};
  const {mountDigitalCardPdf} = await import('/assets/js/modules/privato/digital-card-pdf.js');
  window.__card.dispose = mountDigitalCardPdf(document.getElementById('root'), {getSource: () => source});
  window.__card.ready = true;
</script>`;

before(async () => {
    browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
        : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
});
after(async () => {await browser?.close();});

async function open({share = false, photo = false, cf = false, cancel = false, photoFails = false} = {}) {
    const context = await browser.newContext({acceptDownloads: true});
    const tab = await context.newPage(), errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.href.startsWith('https://firebasestorage.googleapis.com/')) {
            if (photoFails) return route.fulfill({status: 404, body: ''});
            return route.fulfill({status: 200, contentType: 'image/png', body: PNG, headers: {'access-control-allow-origin': '*'}});
        }
        if (url.origin !== origin) {externalRequests.push(url.href); return route.abort();}
        if (url.pathname === '/card.html') return route.fulfill({contentType: 'text/html', body: page});
        if (stubs[url.pathname]) return route.fulfill({contentType: 'text/javascript', body: stubs[url.pathname]});
        const file = path.join(publicRoot, url.pathname);
        if (!file.startsWith(publicRoot) || !existsSync(file)) return route.fulfill({status: 404, body: ''});
        const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream';
        return route.fulfill({contentType: type, body: await readFile(file)});
    });
    const query = new URLSearchParams({share: share ? 'yes' : 'no', photo: photo ? 'yes' : 'no', cf: cf ? 'yes' : 'no', cancel: cancel ? 'yes' : 'no'});
    await tab.goto(`${origin}/card.html?${query}`);
    await tab.waitForFunction(() => window.__card?.ready === true);
    return {context, tab, errors};
}
const status = tab => tab.locator('[data-digital-card-pdf] [role=status]').textContent();
const button = (tab, key) => tab.locator('[data-digital-card-pdf] button', {hasText: key});
async function prepare(tab, expected) {
    await button(tab, 'digital_card_pdf_prepare').click();
    await tab.waitForFunction(value => document.querySelector('[data-digital-card-pdf] [role=status]')?.textContent === value, expected, {timeout: 15000})
        .catch(async error => {throw Error(`${error.message}; status: ${await status(tab)}`);});
}
async function downloaded(tab) {
    const [download] = await Promise.all([tab.waitForEvent('download'), button(tab, 'digital_card_pdf_download').click()]);
    assert.equal(download.suggestedFilename(), 'tessera-digitale.pdf');
    const dir = await mkdtemp(path.join(tmpdir(), 'tessera-browser-')), file = path.join(dir, 'card.pdf');
    try {
        await download.saveAs(file); const bytes = await readFile(file);
        return {bytes, text: await extractPdfText(bytes)};
    } finally {await rm(dir, {recursive: true, force: true});}
}
const imageCount = pdf => pdf.context.enumerateIndirectObjects().filter(([, object]) => object?.dict?.get?.(PDFName.of('Subtype')) === PDFName.of('Image')).length;

test('without file sharing the PDF is prepared and downloaded, share stays disabled', async () => {
    const {context, tab, errors} = await open();
    try {
        assert.equal(await button(tab, 'digital_card_pdf_download').isDisabled(), true);
        await prepare(tab, 'digital_card_pdf_ready_download');
        assert.equal(await button(tab, 'digital_card_pdf_share').isDisabled(), true);
        const {bytes, text} = await downloaded(tab), pdf = await PDFDocument.load(bytes);
        assert.equal(pdf.getTitle(), 'Tessera digitale'); assert.equal(imageCount(pdf), 0);
        assert.match(text, /Mario Rossi/); assert.match(text, /mario@example\.invalid/);
        for (const absent of ['RSSMRA80B01G224X', 'esclusa@example', 'SEGRETO-PIN']) assert.doesNotMatch(text, new RegExp(absent), absent);
        assert.deepEqual(await tab.evaluate(() => window.__card.native), ['profile-pdf']);
        assert.deepEqual(errors, []);
    } finally {await context.close();}
});

test('with photo and fiscal code selected the PDF embeds the photo and the code', async () => {
    const {context, tab, errors} = await open({photo: true, cf: true});
    try {
        await prepare(tab, 'digital_card_pdf_ready_download');
        const {bytes, text} = await downloaded(tab), pdf = await PDFDocument.load(bytes);
        assert.equal(imageCount(pdf), 1); assert.match(text, /RSSMRA80B01G224X/); assert.doesNotMatch(text, /SEGRETO-PIN/);
        assert.deepEqual(errors, []);
    } finally {await context.close();}
});

test('an unavailable photo is reported and no PDF is offered', async () => {
    const {context, tab} = await open({photo: true, photoFails: true});
    try {
        await prepare(tab, 'digital_card_pdf_photo_error');
        assert.equal(await button(tab, 'digital_card_pdf_download').isDisabled(), true);
        assert.equal(await button(tab, 'digital_card_pdf_share').isDisabled(), true);
    } finally {await context.close();}
});

test('native share receives the PDF file inside the click gesture, download stays available', async () => {
    const {context, tab, errors} = await open({share: true});
    try {
        await prepare(tab, 'digital_card_pdf_ready_share');
        await button(tab, 'digital_card_pdf_share').click();
        await tab.waitForFunction(() => window.__card.shares.length === 1);
        const [shared] = await tab.evaluate(() => window.__card.shares);
        assert.equal(shared.name, 'tessera-digitale.pdf'); assert.equal(shared.title, 'Tessera digitale'); assert.ok(shared.size > 1000);
        // La chiamata a navigator.share avviene mentre l'attivazione del clic è ancora attiva.
        if (shared.activation !== null) assert.equal(shared.activation, true);
        assert.equal(await button(tab, 'digital_card_pdf_download').isDisabled(), false);
        await downloaded(tab);
        assert.deepEqual(errors, []);
    } finally {await context.close();}
});

test('a cancelled share is reported without losing the prepared PDF', async () => {
    const {context, tab} = await open({share: true, cancel: true});
    try {
        await prepare(tab, 'digital_card_pdf_ready_share');
        await button(tab, 'digital_card_pdf_share').click();
        await tab.waitForFunction(() => document.querySelector('[data-digital-card-pdf] [role=status]')?.textContent === 'digital_card_pdf_share_cancelled');
        await downloaded(tab);
    } finally {await context.close();}
});

test('locking the vault or changing account removes the panel and the prepared bytes', async () => {
    for (const revoke of [
        () => {window.__card.unlocked = false; window.dispatchEvent(new Event('vault-state-changed'));},
        () => window.dispatchEvent(new Event('vault-session-locked')),
        () => window.__card.authCallback({uid: 'other'})]) {
        const {context, tab} = await open();
        try {
            await prepare(tab, 'digital_card_pdf_ready_download');
            await tab.evaluate(revoke);
            assert.equal(await tab.locator('[data-digital-card-pdf]').count(), 0);
        } finally {await context.close();}
    }
});

test('a locked vault refuses to prepare the PDF', async () => {
    const {context, tab} = await open();
    try {
        await tab.evaluate(() => {window.__card.unlocked = false;});
        await button(tab, 'digital_card_pdf_prepare').click();
        await tab.waitForFunction(() => !document.querySelector('[data-digital-card-pdf]'));
    } finally {await context.close();}
});

test('the collaudo made no external requests', () => {assert.deepEqual(externalRequests, []);});
