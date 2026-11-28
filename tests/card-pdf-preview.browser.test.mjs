import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium, devices} from 'playwright';
import {PDFDocument, PDFName} from 'pdf-lib';
import {extractPdfText} from './pdf-text.mjs';

// Il sito di collaudo della Tessera PDF (anteprima per Safari iPhone) si costruisce, si
// apre con la sua CSP e produce il PDF senza contattare alcun servizio.
const root = path.resolve(import.meta.dirname, '..');
const origin = 'http://127.0.0.1:41743';
let browser, dir, site, config;
const external = [];

before(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'card-preview-'));
    execFileSync(process.execPath, ['scripts/build-card-pdf-preview.mjs', '--out', dir, '--sha', '0123456'], {cwd: root});
    site = path.join(dir, 'public'); config = JSON.parse(await readFile(path.join(dir, 'firebase.json'), 'utf8'));
    browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
        : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
});
after(async () => {await browser?.close(); if (dir) await rm(dir, {recursive: true, force: true});});

async function open() {
    const context = await browser.newContext({...devices['iPhone 13'], acceptDownloads: true});
    const headers = Object.fromEntries(config.hosting.headers[0].headers.map(item => [item.key, item.value]));
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {external.push(url.href); return route.abort();}
        const file = path.join(site, url.pathname === '/' ? 'index.html' : url.pathname);
        if (!file.startsWith(site) || !existsSync(file)) return route.fulfill({status: 404, body: ''});
        const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
        return route.fulfill({contentType: type, headers, body: await readFile(file)});
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    await page.goto(origin + '/');
    await page.getByRole('button', {name: 'Prepara PDF'}).waitFor();
    return {context, page, errors};
}
async function download(page) {
    await page.getByRole('button', {name: 'Prepara PDF'}).click();
    await page.getByRole('button', {name: 'Scarica PDF'}).and(page.locator(':enabled')).waitFor();
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Scarica PDF'}).click()]);
    const target = path.join(dir, 'download.pdf'); await file.saveAs(target);
    const bytes = await readFile(target);
    return {name: file.suggestedFilename(), bytes, text: await extractPdfText(bytes), pdf: await PDFDocument.load(bytes)};
}
const images = pdf => pdf.context.enumerateIndirectObjects().filter(([, object]) => object?.dict?.get?.(PDFName.of('Subtype')) === PDFName.of('Image')).length;

test('the preview site holds only the panel, its real dependencies and synthetic adapters', async () => {
    assert.deepEqual(config.hosting.public, 'public');
    const csp = config.hosting.headers[0].headers.find(item => item.key === 'Content-Security-Policy').value;
    assert.match(csp, /connect-src 'self'/); assert.match(csp, /default-src 'self'/);
    const html = await readFile(path.join(site, 'index.html'), 'utf8');
    assert.match(html, /solo dati sintetici/); assert.match(html, /0123456/);
    for (const stub of ['assets/js/firebase-config.js', 'assets/js/vendor/firebase-runtime.js', 'assets/js/modules/core/security-manager.js']) {
        assert.doesNotMatch(await readFile(path.join(site, stub), 'utf8'), /https?:|apiKey|googleapis/i, stub);
    }
});

test('on an emulated iPhone the default selection downloads a PDF with photo and selected fields only', async () => {
    const {context, page, errors} = await open();
    try {
        const {name, text, pdf} = await download(page);
        assert.equal(name, 'tessera-digitale.pdf'); assert.equal(images(pdf), 1);
        for (const value of ['Mario Rossi', 'RSSMRA80B01G224X', '+39 333 000 0001', 'mario@example.invalid', 'CLUB-42']) assert.ok(text.includes(value), value);
        for (const value of ['SEGRETO-PIN', 'SEGRETO-CIFRATO', '+39 333 000 0002', 'esclusa@example.invalid', '01/02/1980', 'Via Roma']) assert.ok(!text.includes(value), value);
        assert.deepEqual(errors, []);
    } finally {await context.close();}
});

test('changing the selection remounts the panel and the PDF follows it, without photo', async () => {
    const {context, page, errors} = await open();
    try {
        for (const name of ['photo', 'cf', 'phone', 'custom']) await page.locator(`input[name=${name}]`).uncheck();
        await page.locator('input[name=address]').check();
        const {text, pdf} = await download(page);
        assert.equal(images(pdf), 0);
        assert.ok(text.includes('Via Roma 1, 35100 Padova')); assert.ok(text.includes('mario@example.invalid'));
        for (const value of ['RSSMRA80B01G224X', '+39 333 000 0001', 'CLUB-42']) assert.ok(!text.includes(value), value);
        assert.equal(await page.locator('[data-digital-card-pdf]').count(), 1);
        assert.deepEqual(errors, []);
    } finally {await context.close();}
});

test('an empty selection is refused with the localized message', async () => {
    const {context, page} = await open();
    try {
        for (const name of ['nome', 'cf', 'phone', 'email', 'custom']) await page.locator(`input[name=${name}]`).uncheck();
        await page.getByRole('button', {name: 'Prepara PDF'}).click();
        await page.getByText('Seleziona almeno un dato della tessera per creare il PDF.').waitFor();
        assert.equal(await page.getByRole('button', {name: 'Scarica PDF'}).isDisabled(), true);
    } finally {await context.close();}
});

test('the preview made no external requests', () => {assert.deepEqual(external, []);});
