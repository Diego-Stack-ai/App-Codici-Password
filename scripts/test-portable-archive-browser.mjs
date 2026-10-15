import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildPortableViewerHtml} from '../Frontend/public/assets/js/modules/settings/portable-archive-viewer.js';
import {
    createPortableArchiveWriter, createPortableHeader, PORTABLE_ARCHIVE_LIMITS
} from '../Frontend/public/assets/js/modules/settings/portable-archive-stream.js';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const password = 'Fiume!Quarzo-83#Luna';

function memorySink() {
    const parts = [];
    return {
        async write(value) { parts.push(Uint8Array.from(value)); },
        async close() {}, async abort() { parts.length = 0; },
        bytes() {
            const size = parts.reduce((sum, part) => sum + part.byteLength, 0), output = new Uint8Array(size);
            let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
            return output;
        }
    };
}

async function createArchive(records = [{
    key: 'private-account:::fixture', scope: 'private-account', id: 'fixture', title: '',
    data: {nomeAccount: 'Account sintetico', utente: 'utente-sintetico', campoFuturo: {valore: 42}}
}, {
    key: 'company:::azienda-fixture', scope: 'company', id: 'azienda-fixture', title: '',
    data: {ragioneSociale: 'Azienda sintetica'}
}, {
    key: 'company-account:azienda-fixture::account-fixture', scope: 'company-account', id: 'account-fixture',
    companyId: 'azienda-fixture', title: '', data: {nomeAccount: 'Portale sintetico', username: 'utente-azienda'}
}]) {
    const sink = memorySink();
    const writer = await createPortableArchiveWriter({
        sink, password, cryptoApi: webcrypto,
        header: createPortableHeader({createdAt: '2026-10-15T10:00:00.000Z', chunkSize: 64 * 1024, cryptoApi: webcrypto})
    });
    const payload = {format: 'codici-password-portable-data', version: 2, schemaVersion: 1, records};
    await writer.addEntry({id: 'records', kind: 'records', name: 'dati-interni.json', type: 'application/json'},
        new TextEncoder().encode(JSON.stringify(payload)));
    await writer.addEntry({id: 'projection:dati-completi.json', kind: 'json', name: 'dati-completi.json', type: 'application/json'},
        new TextEncoder().encode(JSON.stringify(payload, null, 2)));
    await writer.addEntry({id: 'projection:private-account.csv', kind: 'csv', name: 'private-account.csv', type: 'text/csv'},
        new TextEncoder().encode('title,utente\r\nAccount sintetico,utente-sintetico\r\n'));
    await writer.addEntry({id: 'attachment:fixture', kind: 'attachment', name: 'fixture.txt', type: 'text/plain',
        recordKeys: ['private-account:::fixture']}, new TextEncoder().encode('allegato sintetico senza dati reali'));
    await writer.close({counts: {records: records.length, attachments: 1, projections: 2}});
    return sink.bytes();
}

function canonicalHeader(header) {
    return JSON.stringify({format: header.format, formatVersion: header.formatVersion, schemaVersion: header.schemaVersion,
        archiveId: header.archiveId, createdAt: header.createdAt, chunkSize: header.chunkSize, kdf: header.kdf, cipher: header.cipher});
}

async function rewriteAuthenticatedEntryCount(bytes) {
    const lines = new TextDecoder().decode(bytes).trimEnd().split('\n');
    const header = JSON.parse(lines[0]), footerIndex = lines.length - 2, footer = JSON.parse(lines[footerIndex]);
    const raw = new TextEncoder().encode(password), salt = new Uint8Array(Buffer.from(header.kdf.salt, 'base64'));
    const material = await webcrypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: header.kdf.iterations},
        material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
    const aad = new TextEncoder().encode(`${canonicalHeader(header)}\nfooter\n${footer.sequence}\n${footer.previousDigest}`);
    const clear = new Uint8Array(await webcrypto.subtle.decrypt({
        name: 'AES-GCM', iv: Buffer.from(footer.iv, 'base64'), additionalData: aad
    }, key, Buffer.from(footer.ciphertext, 'base64')));
    const manifest = JSON.parse(new TextDecoder().decode(clear)); manifest.entryCount += 1;
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad}, key,
        new TextEncoder().encode(JSON.stringify(manifest))));
    footer.iv = Buffer.from(iv).toString('base64'); footer.ciphertext = Buffer.from(ciphertext).toString('base64');
    lines[footerIndex] = JSON.stringify(footer);
    lines[lines.length - 1] = JSON.stringify({...JSON.parse(lines[lines.length - 1]),
        finalDigest: Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(lines[footerIndex]))).toString('base64')});
    raw.fill(0); salt.fill(0); clear.fill(0); iv.fill(0); ciphertext.fill(0);
    return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

async function downloadBytes(page, role, name) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole(role, {name, exact: true}).click();
    const download = await downloadPromise;
    return Buffer.from(await download.createReadStream().then(async stream => {
        const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks);
    }));
}

const temporary = await mkdtemp(path.join(os.tmpdir(), 'codici-password-portable-v2-'));
const viewerPath = path.join(temporary, 'visualizzatore.html');
const archivePath = path.join(temporary, 'archivio.cpportable');
const tamperedPath = path.join(temporary, 'archivio-manomesso.cpportable');
const incompletePath = path.join(temporary, 'archivio-incompleto.cpportable');
const invalidCountPath = path.join(temporary, 'archivio-conteggio-non-valido.cpportable');
const trailingPath = path.join(temporary, 'archivio-dati-finali.cpportable');
const excessiveLinesPath = path.join(temporary, 'archivio-righe-eccessive.cpportable');
const oversizedLinePath = path.join(temporary, 'archivio-linea-eccessiva.cpportable');
const excessiveRecordsPath = path.join(temporary, 'archivio-record-eccessivi.cpportable');
const archive = await createArchive();
await writeFile(viewerPath, buildPortableViewerHtml(), 'utf8');
await writeFile(archivePath, archive);
const tampered = archive.slice(); tampered[Math.floor(tampered.length / 2)] ^= 1;
await writeFile(tamperedPath, tampered);
await writeFile(incompletePath, archive.subarray(0, archive.length - 200));
await writeFile(invalidCountPath, await rewriteAuthenticatedEntryCount(archive));
await writeFile(trailingPath, Buffer.concat([Buffer.from(archive), Buffer.from('   \ncontenuto-non-autenticato\n')]));
await writeFile(excessiveLinesPath, Buffer.concat([
    Buffer.from(archive), Buffer.from(' \n'.repeat(PORTABLE_ARCHIVE_LIMITS.maxLines + 1))
]));
await writeFile(oversizedLinePath, Buffer.alloc(PORTABLE_ARCHIVE_LIMITS.maxLineBytes + 1, 0x61));
await writeFile(excessiveRecordsPath, await createArchive(Array.from({length: PORTABLE_ARCHIVE_LIMITS.maxRecords + 1}, (_, index) => ({
    key: `fixture:::${index}`, scope: 'fixture', id: String(index), data: {}
}))));

let browser;
try {
    browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
    const context = await browser.newContext({acceptDownloads: true});
    const page = await context.newPage();
    await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', {value: undefined, configurable: true}));
    const errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto(pathToFileURL(viewerPath).href);
    await page.locator('#archive').setInputFiles(archivePath);
    await page.locator('#password').fill('password-errata-123');
    await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
    await page.getByText('Password errata, archivio incompleto, troppo grande o manomesso.').waitFor();
    await page.locator('#password').fill(password);
    await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
    await page.getByText(/integrità AEAD verificata/).waitFor();
    assert.equal(await page.locator('#content').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', {name: /Account privati 1/}).click();
    await page.getByText('Account sintetico', {exact: true}).waitFor();
    assert.equal(await page.getByText('fixture', {exact: true}).count(), 0);
    await page.getByRole('button', {name: /Account aziendali 1/}).click();
    await page.locator('#company-filter').selectOption('azienda-fixture');
    await page.getByText('Portale sintetico', {exact: true}).waitFor();
    await page.locator('#search').fill('Portale sintetico');
    await page.getByText(/1 elementi mostrati su 3/).waitFor();

    await page.locator('.exports-panel').evaluate(element => { element.open = true; });
    const json = JSON.parse((await downloadBytes(page, 'button', 'Scarica Archivio completo (JSON)')).toString('utf8'));
    assert.equal(json.records[0].data.campoFuturo.valore, 42);
    const csv = (await downloadBytes(page, 'button', 'Scarica Account privati')).toString('utf8');
    assert.match(csv, /utente-sintetico/);
    await page.locator('#search').fill('Account sintetico');
    await page.getByRole('button', {name: /Account privati 1/}).click();
    const attachment = (await downloadBytes(page, 'button', 'Scarica allegato')).toString('utf8');
    assert.equal(attachment, 'allegato sintetico senza dati reali');

    await page.getByRole('button', {name: 'Chiudi archivio', exact: true}).click();
    assert.equal(await page.locator('#unlock').isVisible(), true);
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('#archive').setInputFiles(archivePath);
    await page.locator('#password').fill(password);
    await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
    await page.getByText(/integrità AEAD verificata/).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    await page.getByRole('button', {name: 'Chiudi archivio', exact: true}).click();
    for (const invalid of [
        tamperedPath, incompletePath, invalidCountPath, trailingPath, excessiveLinesPath, oversizedLinePath, excessiveRecordsPath
    ]) {
        await page.locator('#archive').setInputFiles(invalid);
        await page.locator('#password').fill(password);
        await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
        await page.getByText('Password errata, archivio incompleto, troppo grande o manomesso.').waitFor();
        assert.equal(await page.locator('#content').isHidden(), true);
    }
    assert.deepEqual(network, []);
    assert.deepEqual(errors, []);
    console.log('Archivio portabile v2 browser: offline, tamper, trailing data, entryCount, limiti, allegati, download e viewport OK');
} finally {
    await browser?.close();
    await rm(temporary, {recursive: true, force: true});
}
