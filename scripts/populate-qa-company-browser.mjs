import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadQaCredentialBundle } from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
if (origin !== 'https://appcodici-password.web.app'
    && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}

const credentials = await loadQaCredentialBundle();
const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const browserProfile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-company-'));
const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-company-files-'));
const fixture = Object.freeze({
    name: 'QA Azienda Sintetica SRL',
    legalForm: 'SRL di collaudo',
    phone: '0000000100',
    fax: '0000000101',
    vat: '00000000000',
    sdi: 'QA00000',
    cciaa: 'QA-000000',
    registrationDate: '2030-02-20',
    referentRole: 'Referente QA',
    referentName: 'Collaudo',
    referentSurname: 'Sintetico',
    referentMobile: '0000000102',
    officeType: 'Sede legale sintetica',
    address: 'Via Azienda di Collaudo',
    civic: '10',
    city: 'Citta QA',
    province: 'QA',
    postalCode: '00000',
    extraOfficeType: 'Sede operativa sintetica',
    extraAddress: 'Viale Seconda Sede QA',
    extraCivic: '20',
    extraCity: 'Comune QA',
    extraProvince: 'QB',
    extraPostalCode: '00001',
    pec: 'pec.qa@appcodici-password.invalid',
    adminEmail: 'amministrazione.qa@appcodici-password.invalid',
    personalEmail: 'referente.qa@appcodici-password.invalid',
    extraEmail: 'supporto.qa@appcodici-password.invalid',
    password: 'QA-PASSWORD-NON-REALE',
    note: 'QA-SINTETICO · azienda priva di validita giuridica e fiscale.',
    attachmentName: 'qa-azienda-allegato-sintetico.txt'
});
const report = {
    schemaVersion: 1,
    origin,
    startedAt: new Date().toISOString(),
    actions: [],
    consoleErrors: [],
    networkErrors: []
};

function record(action, status, detail = '') {
    report.actions.push({ action, status, ...(detail ? { detail } : {}) });
}

async function waitForTranslatedPage(page) {
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, {
        timeout: 20_000
    });
}

async function loginAndUnlock(page) {
    await page.goto(`${origin}/login-v115.html`, { waitUntil: 'networkidle', timeout: 45_000 });
    await waitForTranslatedPage(page);
    const languageDialog = page.locator('#initial-language-dialog');
    if (await languageDialog.isVisible().catch(() => false)) {
        await languageDialog.locator('button[data-code="it"]').click();
        await languageDialog.locator('.first-configuration-primary').click();
        await page.waitForLoadState('networkidle', { timeout: 45_000 });
        await waitForTranslatedPage(page);
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.accountPassword);
    await page.locator('#login-submit-btn').click();
    await page.waitForURL(/\/home_page\.html(?:[?#]|$)/, { timeout: 45_000 });
    const sessionAlreadyOpen = await page.evaluate(() => Boolean(sessionStorage.getItem('vault_session_v1')));
    if (!sessionAlreadyOpen) {
        const masterInput = page.locator('#protocol-input-modal-input');
        await masterInput.waitFor({ state: 'visible', timeout: 20_000 });
        await masterInput.fill(credentials.masterPassword);
        await page.locator('#modal-confirm-btn').click();
    }
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, { timeout: 45_000 });
    record('qa-login-and-vault', 'passed');
}

async function openSection(page, buttonSelector, sectionSelector) {
    const section = page.locator(sectionSelector);
    if (!await section.isVisible().catch(() => false)) await page.locator(buttonSelector).click();
    await section.waitFor({ state: 'visible', timeout: 10_000 });
}

async function fill(page, selector, value) {
    const field = page.locator(selector);
    await field.waitFor({ state: 'visible', timeout: 10_000 });
    await field.fill(value);
}

async function reuseOrCreateDynamicCard(page, cardSelector, valueSelector, expectedValue, addSelector) {
    let cards = page.locator(cardSelector);
    const matches = [];
    for (let index = 0; index < await cards.count(); index += 1) {
        if (await cards.nth(index).locator(valueSelector).inputValue() === expectedValue) matches.push(index);
    }
    for (const index of matches.slice(1).reverse()) {
        await cards.nth(index).locator('.btn-remove-item').click();
        cards = page.locator(cardSelector);
    }
    if (matches.length) {
        for (let index = 0; index < await cards.count(); index += 1) {
            if (await cards.nth(index).locator(valueSelector).inputValue() === expectedValue) return cards.nth(index);
        }
    }
    await page.locator(addSelector).click();
    return page.locator(cardSelector).last();
}

async function locateCompanyId(page) {
    await page.goto(`${origin}/lista_aziende.html`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await waitForTranslatedPage(page);
    const list = page.locator('#aziende-list-container');
    await list.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(name => {
        const container = document.getElementById('aziende-list-container');
        return Boolean(container && !container.querySelector('.ui-state-loading')
            && (container.textContent?.includes(name) || container.children.length));
    }, fixture.name, { timeout: 30_000 });
    const card = list.locator('.azienda-card').filter({ hasText: fixture.name }).first();
    if (!await card.count()) return '';
    await card.click();
    await page.waitForURL(/\/(?:account_azienda|dati_azienda)\.html\?id=/, { timeout: 45_000 });
    return new URL(page.url()).searchParams.get('id') || '';
}

async function prepareFixtureFiles() {
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAevJgJQAAAAASUVORK5CYII=', 'base64');
    const logo = path.join(fixtureDir, 'qa-company-logo.png');
    const referent = path.join(fixtureDir, 'qa-company-referent.png');
    const attachment = path.join(fixtureDir, fixture.attachmentName);
    await Promise.all([
        writeFile(logo, pixel),
        writeFile(referent, pixel),
        writeFile(attachment, 'QA-SINTETICO\nAllegato aziendale non reale.\n', 'utf8')
    ]);
    return { logo, referent, attachment };
}

async function populateCompany(page, companyId, files) {
    const suffix = companyId ? `?id=${encodeURIComponent(companyId)}` : '';
    await page.goto(`${origin}/modifica_azienda.html${suffix}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await waitForTranslatedPage(page);
    await page.locator('#btn-save').waitFor({ state: 'visible', timeout: 20_000 });
    if (companyId) {
        await page.waitForFunction(() => document.getElementById('btn-save')?.disabled === false, null, { timeout: 30_000 });
    }

    await fill(page, '#ragione-sociale', fixture.name);
    await fill(page, '#forma-giuridica', fixture.legalForm);
    await fill(page, '#telefono-azienda', fixture.phone);
    await fill(page, '#fax-azienda', fixture.fax);

    await openSection(page, '#btn-toggle-fiscal', '#section-fiscal-main');
    await fill(page, '#piva', fixture.vat);
    await fill(page, '#codice-sdi', fixture.sdi);
    await fill(page, '#cciaa', fixture.cciaa);
    await fill(page, '#data-iscrizione', fixture.registrationDate);

    await openSection(page, '#btn-toggle-referent', '#section-referente-main');
    await fill(page, '#referente-ruolo', fixture.referentRole);
    await fill(page, '#referente-nome', fixture.referentName);
    await fill(page, '#referente-cognome', fixture.referentSurname);
    await fill(page, '#referente-cellulare', fixture.referentMobile);

    await openSection(page, '#btn-toggle-locations', '#section-locations-main');
    await fill(page, '#tipo-sede-legale', fixture.officeType);
    await fill(page, '#indirizzo', fixture.address);
    await fill(page, '#civico', fixture.civic);
    await fill(page, '#citta', fixture.city);
    await fill(page, '#provincia', fixture.province);
    await fill(page, '#cap', fixture.postalCode);
    const extraOffice = await reuseOrCreateDynamicCard(page, '.extra-sede-item', '.sede-tipo',
        fixture.extraOfficeType, '#btn-add-sede');
    await extraOffice.locator('.sede-tipo').fill(fixture.extraOfficeType);
    await extraOffice.locator('.sede-indirizzo').fill(fixture.extraAddress);
    await extraOffice.locator('.sede-civico').fill(fixture.extraCivic);
    await extraOffice.locator('.sede-citta').fill(fixture.extraCity);
    await extraOffice.locator('.sede-provincia').fill(fixture.extraProvince);
    await extraOffice.locator('.sede-cap').fill(fixture.extraPostalCode);

    await openSection(page, '#btn-toggle-emails', '#section-emails-main');
    await fill(page, '#type-pec', 'PEC sintetica');
    await fill(page, '#email-pec', fixture.pec);
    await fill(page, '#email-pec-password', fixture.password);
    await fill(page, '#email-pec-note', 'QA-SINTETICO · PEC non raggiungibile.');
    await fill(page, '#type-amministrazione', 'Amministrazione sintetica');
    await fill(page, '#email-amministrazione', fixture.adminEmail);
    await fill(page, '#email-amministrazione-password', fixture.password);
    await fill(page, '#email-amministrazione-note', 'QA-SINTETICO · amministrazione non raggiungibile.');
    await fill(page, '#type-personale', 'Referente sintetico');
    await fill(page, '#email-personale', fixture.personalEmail);
    await fill(page, '#email-personale-password', fixture.password);
    await fill(page, '#email-personale-note', 'QA-SINTETICO · referente non raggiungibile.');
    const extraEmail = await reuseOrCreateDynamicCard(page, '.email-extra-item', '.email-type',
        'Supporto sintetico', '#btn-add-email');
    await extraEmail.locator('.email-type').fill('Supporto sintetico');
    await extraEmail.locator('.email-value').fill(fixture.extraEmail);
    await extraEmail.locator('.email-pass').fill(fixture.password);
    await extraEmail.locator('.email-note').fill('QA-SINTETICO · supporto non raggiungibile.');

    await openSection(page, '#btn-toggle-notes', '#section-notes-main');
    await fill(page, '#note-azienda', fixture.note);
    await page.locator('#logo-upload').setInputFiles(files.logo);
    await page.locator('#referente-photo-upload').setInputFiles(files.referent);
    if (!companyId || !await page.getByText(fixture.attachmentName, { exact: true }).count()) {
        await page.locator('#input-file').setInputFiles(files.attachment);
    }
    await page.getByText(fixture.attachmentName, { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: path.join(outputRoot, 'company-form-populated.png'), fullPage: true });

    await page.locator('#btn-save').click();
    await page.waitForURL(/\/dati_azienda\.html\?id=.*afterWrite=1/, { timeout: 60_000 });
    record('company-form', companyId ? 'updated-and-saved' : 'created-and-saved');
}

async function verifyCompany(page) {
    await waitForTranslatedPage(page);
    await page.locator('#ragione-sociale').filter({ hasText: fixture.name }).waitFor({ state: 'visible', timeout: 30_000 });
    const companyId = new URL(page.url()).searchParams.get('id') || '';
    assert.ok(companyId, 'ID azienda QA non rilevato');

    await page.locator('[data-company-tab="personal"]').click();
    await page.locator('#piva').waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await page.locator('#piva').inputValue(), fixture.vat);
    assert.equal(await page.locator('#codice-sdi').inputValue(), fixture.sdi);
    assert.equal(await page.locator('#referente-cellulare').inputValue(), fixture.referentMobile);
    await page.screenshot({ path: path.join(outputRoot, 'company-personal.png'), fullPage: true });

    await page.locator('[data-company-tab="contacts"]').click();
    const contacts = page.locator('#email-list-container');
    await contacts.getByText(fixture.pec, { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    const extraEmailValues = contacts.getByText(fixture.extraEmail, { exact: true });
    await extraEmailValues.first().waitFor({ state: 'visible', timeout: 10_000 });
    assert.equal(await extraEmailValues.count(), 1, 'L’e-mail extra QA deve essere presente una sola volta');
    assert.equal(await page.getByText(fixture.password, { exact: true }).count(), 0,
        'Le password aziendali non devono essere montate in chiaro');
    assert.ok(await page.getByRole('button', { name: /Mostra o nascondi Password nel profilo aziendale/ }).count() >= 4);
    await page.screenshot({ path: path.join(outputRoot, 'company-contacts-masked.png'), fullPage: true });

    await page.locator('[data-company-tab="addresses"]').click();
    const locations = page.locator('#company-locations-list');
    await locations.getByText(fixture.address, { exact: false }).first().waitFor({ state: 'visible', timeout: 10_000 });
    await locations.getByText(fixture.extraAddress, { exact: false }).first().waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: path.join(outputRoot, 'company-locations.png'), fullPage: true });

    await page.locator('[data-company-tab="documents"]').click();
    await page.getByText(fixture.attachmentName, { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });

    await page.locator('[data-company-tab="digital-card"]').click();
    const digitalCard = page.locator('#company-digital-card');
    await digitalCard.getByText(/Capacità utilizzata:/).waitFor({ state: 'visible', timeout: 20_000 });
    assert.equal(await digitalCard.locator('.digital-card-choice input[type="checkbox"]').count(), 14);
    assert.equal(await digitalCard.getByText(fixture.password, { exact: true }).count(), 0,
        'La Tessera digitale non deve contenere password');
    await page.screenshot({ path: path.join(outputRoot, 'company-digital-card.png'), fullPage: true });

    await page.locator('[data-company-tab="pdf-summary"]').click();
    const pdfPanel = page.locator('#company-pdf-summary');
    const preparePdf = pdfPanel.getByRole('button', { name: 'Prepara PDF', exact: true });
    await preparePdf.waitFor({ state: 'visible', timeout: 30_000 });
    await preparePdf.click();
    await pdfPanel.getByText(/PDF pronto\./).waitFor({ state: 'visible', timeout: 30_000 });
    assert.ok(await pdfPanel.locator('.company-pdf-preview dd').count() > 0);
    assert.equal(await pdfPanel.getByText(fixture.password, { exact: true }).count(), 0,
        'Il riepilogo PDF non deve contenere password');
    await page.screenshot({ path: path.join(outputRoot, 'company-pdf-summary.png'), fullPage: true });
    record('company-readback', 'passed', companyId);
    return companyId;
}

let browser;
let activePage;
try {
    await mkdir(outputRoot, { recursive: true });
    const files = await prepareFixtureFiles();
    browser = await chromium.launchPersistentContext(browserProfile, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check'],
        viewport: { width: 1440, height: 1000 }
    });
    const page = browser.pages()[0] || await browser.newPage();
    activePage = page;
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({
            text: message.text().slice(0, 400),
            resource: String(message.location()?.url || '').slice(0, 300)
        });
    });
    page.on('pageerror', error => report.consoleErrors.push({
        text: String(error?.message || error).slice(0, 400), resource: 'page'
    }));
    page.on('response', response => {
        if (response.status() >= 400) report.networkErrors.push({
            status: response.status(), url: response.url().slice(0, 300)
        });
    });

    await loginAndUnlock(page);
    const companyId = await locateCompanyId(page);
    record('company-discovery', companyId ? 'existing' : 'missing-create');
    await populateCompany(page, companyId, files);
    report.companyId = await verifyCompany(page);
} catch (error) {
    report.failure = String(error?.message || error).slice(0, 800);
    await mkdir(outputRoot, { recursive: true }).catch(() => {});
    await activePage?.screenshot({ path: path.join(outputRoot, 'company-failure.png'), fullPage: true }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    for (const candidate of [browserProfile, fixtureDir]) {
        const resolved = path.resolve(candidate);
        if (path.dirname(resolved) === path.resolve(os.tmpdir())
            && path.basename(resolved).startsWith('codici-password-qa-company-')) {
            await rm(resolved, { recursive: true, force: true });
        }
    }
}

const appCheckUrl = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
report.consoleErrors = report.consoleErrors.filter(error => !error.resource.includes(appCheckUrl));
report.consoleErrors = report.consoleErrors.filter(error => !(error.text.includes("Framing 'https://www.google.com/'")
    && error.text.includes('report-only Content Security Policy') && error.text.includes("frame-ancestors 'self'")));
report.networkErrors = report.networkErrors.filter(error => !(error.status === 403 && error.url.includes(appCheckUrl)));
report.completedAt = new Date().toISOString();
report.ok = report.actions.length >= 4 && !report.failure && !report.consoleErrors.length && !report.networkErrors.length;
await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'company-fixture.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    ok: report.ok,
    companyId: report.companyId || '',
    actions: report.actions,
    failure: report.failure || '',
    consoleErrors: report.consoleErrors,
    networkErrors: report.networkErrors,
    report: '.codex-tmp/qa-final/company-fixture.json'
}, null, 2));
if (!report.ok) process.exitCode = 1;
