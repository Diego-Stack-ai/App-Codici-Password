import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
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
const hostileHtml = '<!doctype html><html><body><p>HTML sintetico da mostrare come testo</p><script>parent.postMessage({portableAttachmentExecuted:true},"*");</script></body></html>';
const hostileSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2" onload="parent.postMessage({portableAttachmentExecuted:true},\'*\')"><rect width="2" height="2" fill="blue"/></svg>';
const largeText = 'Testo sintetico leggibile\n'.repeat(14000) + 'FINE ORIGINALE';

function syntheticPdf() {
    const objects = ['<</Type /Catalog /Pages 2 0 R>>', '<</Type /Pages /Kids [3 0 R] /Count 1>>',
        '<</Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R>>', '<</Length 0>>\nstream\n\nendstream'];
    let content = '%PDF-1.4\n';
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
        offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(content);
    content += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
    return Buffer.from(`${content}trailer\n<</Size 5 /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`);
}

function syntheticWave() {
    const bytes = Buffer.alloc(44 + 800);
    bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(8000, 28); bytes.writeUInt16LE(1, 32);
    bytes.writeUInt16LE(8, 34); bytes.write('data', 36); bytes.writeUInt32LE(800, 40); bytes.fill(128, 44);
    return bytes;
}

const previewFixtures = [
    {id: 'html', name: 'documento.html', type: 'text/html', bytes: Buffer.from(hostileHtml)},
    {id: 'svg', name: 'immagine.svg', type: 'image/svg+xml', bytes: Buffer.from(hostileSvg)},
    {id: 'xhtml', name: 'documento.xhtml', type: 'application/xhtml+xml', bytes: Buffer.from(hostileHtml)},
    {id: 'large-text', name: 'testo-grande.txt', type: 'text/plain', bytes: Buffer.from(largeText)},
    {id: 'xml', name: 'documento.xml', type: ' Text/XML ; charset=utf-8', bytes: Buffer.from(hostileHtml)},
    {id: 'pdf', name: 'documento.pdf', type: ' Application/PDF ; version=1.4', bytes: syntheticPdf()},
    {id: 'fake-pdf', name: 'html-rinominato.pdf', type: 'application/pdf', bytes: Buffer.from(hostileHtml)},
    {id: 'audio', name: 'silenzio.wav', type: 'audio/wav', bytes: syntheticWave()},
    {id: 'png', name: 'immagine.png', type: 'image/png', bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')}
];

const downloadOnlyFixtures = [
    {id: 'doc', name: 'documento.doc', type: 'application/msword', expectedName: 'documento.doc'},
    {id: 'docx', name: 'documento.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', expectedName: 'documento.docx'},
    {id: 'xls', name: 'foglio.xls', type: 'application/vnd.ms-excel', expectedName: 'foglio.xls'},
    {id: 'xlsx', name: 'foglio.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', expectedName: 'foglio.xlsx'},
    {id: 'heic', name: 'foto.heic', type: 'image/heic', expectedName: 'foto.heic'},
    {id: 'heif', name: 'foto.heif', type: 'image/heif', expectedName: 'foto.heif'},
    {id: 'mov', name: 'video.mov', type: 'video/quicktime', expectedName: 'video.mov'},
    {id: 'spoof-docx', name: 'fattura.pdf.exe', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', expectedName: 'fattura_pdf.docx'}
].map((fixture, index) => ({...fixture, bytes: Buffer.concat([Buffer.from([0, 255, index]), Buffer.from(hostileHtml)])}));

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
    data: {
        nomeAccount: 'Account sintetico', utente: 'utente-sintetico', account: '000123',
        type: 'account', isArchived: false, sharingCycle: 1, isExplicitMemo: false,
        isBanking: false, email: '   ', campoFuturo: {valore: 42}, nuovoWidget: {type: 'text'}
    }
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
    for (const fixture of [...previewFixtures, ...downloadOnlyFixtures]) {
        await writer.addEntry({id: `attachment:${fixture.id}`, kind: 'attachment', name: fixture.name, type: fixture.type,
            recordKeys: ['private-account:::fixture']}, fixture.bytes);
    }
    await writer.close({counts: {records: records.length, attachments: 1 + previewFixtures.length + downloadOnlyFixtures.length, projections: 2}});
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

async function downloadBytes(page, role, name, expectedName = name.replace(/^(?:Scarica |Salva sul PC )/, '')) {
    await page.getByRole(role, {name, exact: true}).click();
    await page.getByRole('button', {name: 'Continua e salva', exact: true}).click();
    await page.waitForFunction(() => window.__portableDownloads?.length > 0);
    const saved = await page.evaluate(() => window.__portableDownloads.shift());
    assert.equal(saved.name, expectedName);
    return Buffer.from(saved.bytes);
}

async function assertDownloadOnlyActions(page, {name, type, expectedName}) {
    for (const verb of ['Visualizza', 'Riproduci']) {
        assert.equal(await page.getByRole('button', {name: verb + ' ' + name, exact: true}).count(), 0);
    }
    const decision = await page.evaluate(entry => decideAttachmentContent(entry), {name, type});
    assert.equal(decision.action, 'download');
    assert.equal(decision.kind, null);
    assert.equal(decision.mimeType, 'application/octet-stream');
    assert.equal(decision.fileName, expectedName);
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
    await page.addInitScript(() => {
        window.__portableDownloads = [];
        addEventListener('message', event => { if (event.data?.portableAttachmentExecuted) window.__portableAttachmentExecuted = true; });
        window.__portableObjectUrls = [];
        window.__portableRevokedUrls = [];
        window.__portableObjectTypes = {};
        const createObjectURL = URL.createObjectURL.bind(URL), revokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = source => {
            const url = createObjectURL(source); window.__portableObjectUrls.push(url); window.__portableObjectTypes[url] = source.type; return url;
        };
        URL.revokeObjectURL = url => { window.__portableRevokedUrls.push(url); revokeObjectURL(url); };
        Object.defineProperty(window, 'showSaveFilePicker', {
            configurable: true,
            value: async ({suggestedName}) => ({
                async createWritable() {
                    const chunks = [];
                    return {
                        async write(value) { chunks.push(Array.from(value)); },
                        async close() {
                            window.__portableDownloads.push({name: suggestedName, bytes: chunks.flat()});
                        },
                        async abort() { chunks.length = 0; }
                    };
                }
            })
        });
    });
    const errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()); });
    await page.setViewportSize({width: 1280, height: 900});
    await page.goto(pathToFileURL(viewerPath).href);
    await page.locator('#archive').setInputFiles(archivePath);
    await page.locator('#password').fill('password-errata-123');
    await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
    await page.waitForTimeout(100);
    assert.deepEqual(errors, [], `Errori iniziali del visualizzatore: ${errors.join(' | ')}`);
    await page.getByText('Password errata, archivio incompleto, troppo grande o manomesso.').waitFor();
    await page.locator('#password').fill(password);
    await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
    await page.getByText(/integrità AEAD verificata/).waitFor();
    assert.equal(await page.locator('#content').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', {name: /Account privati 1/}).click();
    await page.getByRole('heading', {name: 'Account sintetico', exact: true}).waitFor();
    const privateDetail = page.locator('#detail');
    await privateDetail.getByText('000123', {exact: true}).waitFor();
    await privateDetail.getByText('text', {exact: true}).waitFor();
    assert.equal(await privateDetail.getByText('E-mail', {exact: true}).count(), 0);
    assert.equal(await privateDetail.getByText('Archiviato', {exact: true}).count(), 0);
    assert.equal(await privateDetail.getByText('Memorandum esplicito', {exact: true}).count(), 0);
    assert.equal(await privateDetail.getByText('Account bancario', {exact: true}).count(), 0);
    assert.equal(await page.getByText('fixture', {exact: true}).count(), 1);
    assert.equal(await page.getByText('fixture', {exact: true}).isHidden(), true);
    await privateDetail.locator('details.technical').evaluate(element => { element.open = true; });
    await privateDetail.getByText('Tipo', {exact: true}).waitFor();
    await privateDetail.getByText('account', {exact: true}).waitFor();
    await privateDetail.getByText('Ciclo condivisione', {exact: true}).waitFor();
    assert.equal(await page.getByText('fixture', {exact: true}).isVisible(), true);
    await page.getByRole('button', {name: /Account aziendali 1/}).click();
    await page.locator('#company-filter').selectOption('azienda-fixture');
    await page.getByRole('heading', {name: 'Portale sintetico', exact: true}).waitFor();
    await page.locator('#search').fill('Portale sintetico');
    await page.getByText(/1 schede su 3/).waitFor();

    await page.locator('.technical').first().evaluate(element => { element.open = true; });
    const json = JSON.parse((await downloadBytes(page, 'button', 'Scarica dati-completi.json')).toString('utf8'));
    assert.equal(json.records[0].data.campoFuturo.valore, 42);
    const csv = (await downloadBytes(page, 'button', 'Scarica private-account.csv')).toString('utf8');
    assert.match(csv, /utente-sintetico/);
    await page.locator('#search').fill('Account sintetico');
    await page.getByRole('button', {name: /Account privati 1/}).click();
    const attachment = (await downloadBytes(page, 'button', 'Salva sul PC fixture.txt')).toString('utf8');
    assert.equal(attachment, 'allegato sintetico senza dati reali');

    const pageCount = page.context().pages().length;
    for (const name of ['documento.html', 'documento.xhtml', 'documento.xml', 'immagine.svg']) {
        assert.equal(await page.getByRole('button', {name: `Visualizza ${name}`, exact: true}).count(), 0);
        const expected = name === 'immagine.svg' ? hostileSvg : hostileHtml;
        assert.equal((await downloadBytes(page, 'button', `Salva sul PC ${name}`, name.replace(/\.[^.]+$/, '.bin'))).toString('utf8'), expected);
        assert.equal(page.context().pages().length, pageCount);
        assert.equal(await page.evaluate(() => Boolean(window.__portableAttachmentExecuted)), false);
    }
    for (const fixture of downloadOnlyFixtures) {
        await assertDownloadOnlyActions(page, fixture);
        const objectUrlCount = await page.evaluate(() => window.__portableObjectUrls.length);
        const bytes = await downloadBytes(page, 'button', 'Salva sul PC ' + fixture.name, fixture.expectedName);
        assert.deepEqual(bytes, fixture.bytes, fixture.name);
        assert.equal(await page.evaluate(() => window.__portableObjectUrls.length), objectUrlCount);
        assert.equal(page.context().pages().length, pageCount);
        assert.equal(await page.evaluate(() => Boolean(window.__portableAttachmentExecuted)), false);
    }
    await page.getByRole('button', {name: 'Visualizza testo-grande.txt', exact: true}).click();
    await page.getByText(/Anteprima limitata ai primi/).waitFor();
    const textPreview = await page.locator('.preview pre').textContent();
    assert.ok(textPreview.length <= 256 * 1024);
    assert.ok(largeText.startsWith(textPreview));
    assert.ok(!textPreview.includes('FINE ORIGINALE'));
    assert.equal((await downloadBytes(page, 'button', 'Salva sul PC testo-grande.txt')).toString('utf8'), largeText);

    for (const name of ['immagine.png']) {
        await page.getByRole('button', {name: `Visualizza ${name}`, exact: true}).click();
        await page.locator('.preview img').waitFor();
        await page.waitForFunction(() => document.querySelector('.preview img')?.complete);
        assert.ok(await page.locator('.preview img').evaluate(image => image.naturalWidth > 0));
        assert.equal(await page.evaluate(() => Boolean(window.__portableAttachmentExecuted)), false);
    }
    await page.getByRole('button', {name: 'Riproduci silenzio.wav', exact: true}).click();
    await page.locator('.preview audio').waitFor();
    await page.waitForFunction(() => document.querySelector('.preview audio')?.readyState >= 1);
    assert.ok(await page.locator('.preview audio').evaluate(audio => audio.duration > 0));
    for (const name of ['documento.pdf', 'html-rinominato.pdf']) {
        await page.getByRole('button', {name: `Visualizza ${name}`, exact: true}).click();
        await page.locator('.preview object').waitFor();
        assert.equal(await page.locator('.preview object').getAttribute('type'), 'application/pdf');
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => Boolean(window.__portableAttachmentExecuted)), false);
    }
    await page.evaluate(() => {
        document.querySelector('[aria-label="Visualizza testo-grande.txt"]').click();
        document.querySelector('[aria-label="Visualizza immagine.png"]').click();
    });
    await page.locator('.preview img').waitFor();
    assert.equal(await page.locator('.preview pre').count(), 0);

    await page.getByRole('button', {name: 'Chiudi archivio', exact: true}).click();
    assert.equal(await page.locator('#unlock').isVisible(), true);
    assert.equal(await page.locator('.preview').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__portableObjectUrls.filter(url => !window.__portableRevokedUrls.includes(url))), []);
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('#archive').setInputFiles(archivePath);
    await page.locator('#password').fill(password);
    await page.getByRole('button', {name: 'Verifica e apri', exact: true}).click();
    await page.getByText(/integrità AEAD verificata/).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    // Exercise the real Blob-download fallback as well as the streamed picker fixture.
    await page.locator('#search').fill('Account sintetico');
    await page.getByRole('button', {name: /Account privati 1/}).click();
    await page.evaluate(() => Object.defineProperty(window, 'showSaveFilePicker', {configurable: true, value: undefined}));
    for (const fixture of [
        {name: 'documento.html', type: 'text/html', expectedName: 'documento.bin', bytes: Buffer.from(hostileHtml)},
        {name: 'immagine.svg', type: 'image/svg+xml', expectedName: 'immagine.bin', bytes: Buffer.from(hostileSvg)},
        ...downloadOnlyFixtures
    ]) {
        await assertDownloadOnlyActions(page, fixture);
        const pending = page.waitForEvent('download');
        await page.getByRole('button', {name: 'Salva sul PC ' + fixture.name, exact: true}).click();
        await page.getByRole('button', {name: 'Continua e salva', exact: true}).click();
        const download = await pending;
        assert.equal(download.suggestedFilename(), fixture.expectedName);
        assert.equal(await download.failure(), null);
        assert.deepEqual(await readFile(await download.path()), fixture.bytes, fixture.name);
        assert.equal(await page.evaluate(url => window.__portableObjectTypes[url], download.url()), 'application/octet-stream');
        assert.equal(page.context().pages().length, pageCount);
        assert.equal(await page.evaluate(() => Boolean(window.__portableAttachmentExecuted)), false);
    }

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
    console.log('Archivio portabile v2 browser: offline, tamper, limiti, tipi non supportati scaricati senza navigazione, immagini, PDF, audio, testo limitato, download e pulizia OK');
} finally {
    await browser?.close();
    await rm(temporary, {recursive: true, force: true});
}
