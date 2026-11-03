import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadQaCredentialBundle } from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
if (origin !== 'https://appcodici-password.web.app' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}

const credentials = await loadQaCredentialBundle();
const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-profile-'));
const fixture = Object.freeze({
    name: 'Collaudo',
    surname: 'Sintetico',
    birthDate: '1980-01-15',
    birthPlace: 'Citta QA',
    birthProvince: 'QA',
    note: 'QA-SINTETICO · nota profilo per collaudo funzionale.',
    phone: '0000000000',
    email: 'profilo.qa@appcodici-password.invalid',
    emailNote: 'QA-SINTETICO · recapito non raggiungibile.',
    address: 'Via Collaudo Sintetico',
    civic: '1',
    postalCode: '00000',
    city: 'Citta QA',
    province: 'QA',
    utility: 'QA-SINTETICO-POD-0001'
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

async function fillModal(page, values) {
    const modal = page.locator('#profile-edit-modal');
    await modal.waitFor({ state: 'visible', timeout: 10_000 });
    for (const [label, value] of Object.entries(values)) {
        const fields = modal.locator('.glass-field-container');
        let field = null;
        for (let index = 0; index < await fields.count(); index += 1) {
            const candidate = fields.nth(index);
            const candidateLabel = (await candidate.locator('label').first().textContent().catch(() => ''))?.trim();
            if (candidateLabel === label || candidateLabel?.startsWith(`${label} (`)) {
                field = candidate;
                break;
            }
        }
        assert.ok(field, `Campo modale non trovato: ${label}`);
        const select = field.locator('select');
        if (await select.count()) await select.selectOption({ label: value }, { force: true });
        else await field.locator('input, textarea').first().fill(value);
    }
    await modal.locator('.btn-primary').click();
    try {
        await modal.waitFor({ state: 'detached', timeout: 20_000 });
    } catch {
        const toast = (await page.locator('#toast').textContent().catch(() => ''))?.trim();
        throw new Error(`PROFILE_MODAL_SAVE_FAILED:${toast || 'NO_TOAST'}`);
    }
}

async function activateTab(page, name) {
    await page.locator(`[data-profile-tab-target="${name}"]`).click();
    await page.locator(`[data-profile-tab="${name}"]`).first().waitFor({ state: 'visible', timeout: 10_000 });
}

async function expandSection(page, name) {
    const header = page.locator(`.collapsible-header[data-section="${name}"]`);
    const container = page.locator(`#${name}-view-container`);
    if (await header.evaluate(element => element.classList.contains('collapsed'))) await header.click();
    await container.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(section => !document.getElementById(`${section}-view-container`)?.classList.contains('collapsed'), name);
}

let browser;
try {
    browser = await chromium.launchPersistentContext(profileDir, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check'],
        viewport: { width: 1440, height: 1000 }
    });
    const page = browser.pages()[0] || await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({
            text: message.text().slice(0, 400),
            resource: String(message.location()?.url || '').slice(0, 300)
        });
    });
    page.on('pageerror', error => report.consoleErrors.push({ text: String(error?.message || error).slice(0, 400), resource: 'page' }));
    page.on('response', response => {
        if (response.status() >= 400) report.networkErrors.push({ status: response.status(), url: response.url().slice(0, 300) });
    });

    await page.goto(`${origin}/login-v115.html`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    const languageDialog = page.locator('#initial-language-dialog');
    if (await languageDialog.isVisible().catch(() => false)) {
        await languageDialog.locator('button[data-code="it"]').click();
        await languageDialog.locator('.first-configuration-primary').click();
        await page.waitForLoadState('networkidle', { timeout: 45_000 });
        await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
        record('initial-language', 'confirmed-it');
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.accountPassword);
    await page.locator('#login-submit-btn').click();
    await page.waitForURL(/\/home_page\.html(?:[?#]|$)/, { timeout: 45_000 });
    await page.locator('#protocol-input-modal-input').fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, { timeout: 45_000 });

    await page.goto(`${origin}/profilo_privato.html`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    await page.locator('#profile-tabs').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('#profile-overview')?.children.length > 0, null, { timeout: 20_000 });

    await activateTab(page, 'personal');
    await page.locator('[data-action="edit-section"][data-target="dati-personali"]').click();
    await fillModal(page, {
        Nome: fixture.name,
        Cognome: fixture.surname,
        'Data di Nascita': fixture.birthDate,
        'Luogo di Nascita': fixture.birthPlace,
        'Provincia Nascita': fixture.birthProvince
    });
    await page.waitForFunction(expected => document.querySelector('#nome-view')?.textContent?.includes(expected), `${fixture.name} ${fixture.surname}`);
    record('personal-data', 'saved-and-read');

    await page.locator('[data-action="edit-section"][data-target="note"]').click();
    await fillModal(page, { Note: fixture.note });
    await page.waitForFunction(expected => document.querySelector('#note-view')?.textContent?.includes(expected), 'QA-SINTETICO');
    record('profile-note', 'saved-encrypted-and-read');

    await activateTab(page, 'contacts');
    await expandSection(page, 'telefoni');
    await expandSection(page, 'email');
    const phoneContainer = page.locator('#telefoni-view-container');
    if (!await phoneContainer.getByText(fixture.phone, { exact: true }).count()) {
        await phoneContainer.locator(':scope > .btn-upload-trigger').click();
        await fillModal(page, { Etichetta: 'Cellulare', Numero: fixture.phone, 'Telefono principale': 'Sì' });
        record('phone', 'created');
    } else record('phone', 'already-present');
    await phoneContainer.getByText(fixture.phone, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    const emailContainer = page.locator('#email-view-container');
    if (!await emailContainer.getByText(fixture.email, { exact: true }).count()) {
        await emailContainer.locator(':scope > .btn-upload-trigger').click();
        await fillModal(page, {
            Etichetta: 'Personale',
            'Indirizzo Email': fixture.email,
            'Note (opzionale)': fixture.emailNote,
            'Email principale': 'Sì'
        });
        record('email', 'created');
    } else record('email', 'already-present');
    await emailContainer.getByText(fixture.email, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    await activateTab(page, 'addresses');
    await expandSection(page, 'indirizzi');
    const addressContainer = page.locator('#indirizzi-view-container');
    let addressCard = addressContainer.locator('.form-card').filter({ hasText: fixture.address }).first();
    if (!await addressCard.count()) {
        await addressContainer.locator(':scope > .btn-upload-trigger').click();
        await fillModal(page, {
            Tipo: 'Residenza',
            Indirizzo: fixture.address,
            Civico: fixture.civic,
            CAP: fixture.postalCode,
            'Città': fixture.city,
            Provincia: fixture.province,
            'Indirizzo principale': 'Sì'
        });
        record('address', 'created');
        addressCard = addressContainer.locator('.form-card').filter({ hasText: fixture.address }).first();
    } else record('address', 'already-present');
    await addressCard.waitFor({ state: 'visible', timeout: 15_000 });

    if (!await addressCard.getByText(fixture.utility, { exact: true }).count()) {
        await addressCard.locator('[data-action="add-utility"]').click();
        await fillModal(page, { Tipo: 'Codice POD', 'Codice / Identificativo': fixture.utility });
        record('utility', 'created-encrypted');
    } else record('utility', 'already-present');
    addressCard = addressContainer.locator('.form-card').filter({ hasText: fixture.address }).first();
    await addressCard.getByText(fixture.utility, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    await page.locator('#profile-tabs').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('#profile-overview')?.children.length > 0, null, { timeout: 20_000 });
    assert.match(await page.locator('#nome-view').textContent(), /Collaudo Sintetico/);
    await activateTab(page, 'contacts');
    await expandSection(page, 'telefoni');
    await expandSection(page, 'email');
    await page.locator('#telefoni-view-container').getByText(fixture.phone, { exact: true }).waitFor({ state: 'visible' });
    await page.locator('#email-view-container').getByText(fixture.email, { exact: true }).waitFor({ state: 'visible' });
    await activateTab(page, 'addresses');
    await expandSection(page, 'indirizzi');
    await page.getByText(fixture.utility, { exact: true }).waitFor({ state: 'visible' });
    record('reload-verification', 'passed');

    await mkdir(outputRoot, { recursive: true });
    await page.screenshot({ path: path.join(outputRoot, 'profile-populated.png'), fullPage: true });
} catch (error) {
    report.failure = String(error?.message || error).slice(0, 800);
} finally {
    await browser?.close().catch(() => {});
    const resolved = path.resolve(profileDir);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('codici-password-qa-profile-')) {
        await rm(resolved, { recursive: true, force: true });
    }
}

const appCheckUrl = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
const sharingUrl = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
report.consoleErrors = report.consoleErrors.filter(error => !error.resource.includes(appCheckUrl) && !error.resource.includes(sharingUrl));
report.consoleErrors = report.consoleErrors.filter(error => !(error.text.includes("Framing 'https://www.google.com/'")
    && error.text.includes('report-only Content Security Policy') && error.text.includes("frame-ancestors 'self'")));
report.networkErrors = report.networkErrors.filter(error => !((error.status === 403 && error.url.includes(appCheckUrl))
    || (error.status === 401 && error.url.includes(sharingUrl))));
report.completedAt = new Date().toISOString();
report.ok = report.actions.length >= 7 && !report.failure && !report.consoleErrors.length && !report.networkErrors.length;
await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'profile-fixture.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: report.ok, actions: report.actions, failure: report.failure || '',
    consoleErrors: report.consoleErrors, networkErrors: report.networkErrors,
    report: '.codex-tmp/qa-final/profile-fixture.json' }, null, 2));
if (!report.ok) process.exitCode = 1;
