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
const browserProfile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-profile-links-'));
const fixture = Object.freeze({
    email: 'profilo.qa@appcodici-password.invalid',
    documentNumber: 'QA-DOC-0001',
    accountName: 'QA Account Profilo',
    accountPassword: 'QA-ACCOUNT-PASSWORD-NON-REALE',
    accountNote: 'QA-SINTETICO · Account creato dal collegamento del Profilo.',
    deadlineNote: 'QA-SINTETICO · Scadenza collegata al Documento QA-DOC-0001.'
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
    const masterInput = page.locator('#protocol-input-modal-input');
    const sessionAlreadyOpen = await page.evaluate(() => Boolean(sessionStorage.getItem('vault_session_v1')));
    if (!sessionAlreadyOpen) {
        await masterInput.waitFor({ state: 'visible', timeout: 20_000 });
        await masterInput.fill(credentials.masterPassword);
        await page.locator('#modal-confirm-btn').click();
    }
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, { timeout: 45_000 });
    record('qa-login-and-vault', 'passed');
}

async function openProfile(page, tab) {
    await page.goto(`${origin}/profilo_privato.html?profileTab=${encodeURIComponent(tab)}`, {
        waitUntil: 'domcontentloaded', timeout: 45_000
    });
    await waitForTranslatedPage(page);
    await page.locator('#profile-tabs').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('#profile-overview')?.children.length > 0, null, {
        timeout: 20_000
    });
    const tabButton = page.locator(`[data-profile-tab-target="${tab}"]`);
    if (await tabButton.count()) await tabButton.click();
    await page.locator(`[data-profile-tab="${tab}"]`).first().waitFor({ state: 'visible', timeout: 20_000 });
}

async function expandSection(page, name) {
    const header = page.locator(`.collapsible-header[data-section="${name}"]`);
    const container = page.locator(`#${name}-view-container`);
    if (await header.evaluate(element => element.classList.contains('collapsed'))) await header.click();
    await container.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(section => !document.getElementById(`${section}-view-container`)?.classList.contains('collapsed'), name);
    return container;
}

async function confirmCurrentModal(page) {
    const modal = page.locator('#protocol-confirm-modal');
    await modal.waitFor({ state: 'visible', timeout: 20_000 });
    await modal.locator('#confirm-ok-btn').click();
    await modal.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
}

async function ensureEmailAccountLink(page) {
    await openProfile(page, 'contacts');
    await expandSection(page, 'email');
    let emailCard = page.locator('#email-view-container .profile-contact-card').filter({ hasText: fixture.email }).first();
    await emailCard.waitFor({ state: 'visible', timeout: 20_000 });
    const openButton = emailCard.getByRole('button', { name: 'Apri Account collegato', exact: true });
    if (await openButton.count()) {
        record('profile-email-account-link', 'already-linked');
    } else {
        await emailCard.getByRole('button', { name: 'Collega o crea Account', exact: true }).click();
        const picker = page.locator('#profile-account-picker');
        await picker.waitFor({ state: 'visible', timeout: 20_000 });
        await picker.locator('.profile-account-search').fill(fixture.accountName);
        const existing = picker.locator('.profile-account-result').filter({ hasText: fixture.accountName }).first();
        if (await existing.count()) {
            await existing.click();
            await picker.getByRole('button', { name: 'Continua', exact: true }).click();
            record('profile-email-account-selection', 'existing-synthetic-account');
        } else {
            await picker.locator('.profile-account-create').click();
            await page.waitForURL(/\/form_account_privato\.html\?.*profileContactId=/, { timeout: 45_000 });
            await waitForTranslatedPage(page);
            await page.locator('#account-name').waitFor({ state: 'visible', timeout: 20_000 });
            await page.waitForFunction(expected => document.getElementById('account-username')?.value === expected,
                fixture.email, { timeout: 20_000 });
            await page.locator('#account-name').fill(fixture.accountName);
            await page.locator('#account-password').fill(fixture.accountPassword);
            await page.locator('#account-note').fill(fixture.accountNote);
            const saveButton = page.locator('#btn-save-footer');
            await saveButton.waitFor({ state: 'visible', timeout: 20_000 });
            await page.waitForFunction(() => document.getElementById('btn-save-footer')?.disabled === false, null, {
                timeout: 20_000
            });
            await saveButton.click();
            await page.waitForURL(/\/(?:dettaglio_account_privato\.html\?id=|account_privati\.html\?type=standard)/, {
                timeout: 45_000
            });
            record('profile-email-account-selection', 'created-synthetic-account');
        }
        await openProfile(page, 'contacts');
        await expandSection(page, 'email');
        emailCard = page.locator('#email-view-container .profile-contact-card').filter({ hasText: fixture.email }).first();
        await emailCard.getByRole('button', { name: 'Apri Account collegato', exact: true })
            .waitFor({ state: 'visible', timeout: 20_000 });
        record('profile-email-account-link', 'saved-and-read');
    }
    assert.equal(await emailCard.getByText('Credenziali gestite nell’Account collegato', { exact: true }).count(), 1);
    await mkdir(outputRoot, { recursive: true });
    await page.screenshot({ path: path.join(outputRoot, 'profile-account-link.png'), fullPage: true });
    await emailCard.getByRole('button', { name: 'Apri Account collegato', exact: true }).click();
    await page.waitForURL(/\/dettaglio_account_privato\.html\?id=/, { timeout: 45_000 });
    await page.getByText(fixture.accountName, { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 });
    record('profile-linked-account-open', 'passed');
}

async function ensureDocumentDeadlineLink(page) {
    await openProfile(page, 'documents');
    const documents = await expandSection(page, 'documenti');
    let documentCard = documents.locator('.form-card').filter({ hasText: fixture.documentNumber }).first();
    await documentCard.waitFor({ state: 'visible', timeout: 20_000 });
    const openDeadline = documentCard.getByRole('button', { name: 'Apri scadenza del documento', exact: true });
    if (await openDeadline.count()) {
        record('profile-document-deadline-link', 'already-linked');
        await openDeadline.click();
    } else {
        await documentCard.getByRole('button', { name: 'Configura scadenza', exact: true }).click();
        await confirmCurrentModal(page);
        await page.waitForURL(/\/aggiungi_scadenza\.html\?profileDocumentId=/, { timeout: 45_000 });
        await waitForTranslatedPage(page);
        await page.locator('#nome_cognome').waitFor({ state: 'visible', timeout: 20_000 });
        await page.waitForFunction(() => {
            const name = document.getElementById('nome_cognome')?.value?.trim();
            const dueDate = document.getElementById('dueDate')?.dataset?.isoValue
                || document.getElementById('dueDate')?.value;
            const rule = document.getElementById('deadline-rule-summary');
            const missingRule = document.body.textContent?.includes('Nessuna regola disponibile');
            return Boolean(name && dueDate && ((rule && !rule.classList.contains('hidden')) || missingRule));
        }, null, { timeout: 30_000 });
        assert.equal(await page.locator('#nome_cognome').inputValue(), 'Collaudo Sintetico');
        assert.equal(await page.locator('#dueDate').evaluate(element => element.dataset.isoValue || element.value), '2040-01-15');
        record('profile-document-deadline-prefill', 'passed');
        if (await page.getByText('Nessuna regola disponibile', { exact: true }).count()) {
            await page.screenshot({
                path: path.join(outputRoot, 'profile-deadline-link-deferred.png'), fullPage: true
            });
            record('profile-document-deadline-link', 'deferred-missing-deadline-rule');
            return;
        }
        await page.locator('#notes').fill(fixture.deadlineNote);
        assert.equal(await page.locator('#deadline-recipients-list [data-recipient-email]').count(), 0,
            'La Scadenza QA collegata non deve avere destinatari reali');
        await page.locator('#save-btn').click();
        await page.waitForURL(/\/dettaglio_scadenza\.html\?id=/, { timeout: 45_000 });
        record('profile-document-deadline-link', 'created-without-recipients');
    }
    await page.locator('body').waitFor({ state: 'visible' });
    record('profile-linked-deadline-open', 'passed');

    await openProfile(page, 'documents');
    const refreshedDocuments = await expandSection(page, 'documenti');
    documentCard = refreshedDocuments.locator('.form-card').filter({ hasText: fixture.documentNumber }).first();
    await documentCard.getByRole('button', { name: 'Apri scadenza del documento', exact: true })
        .waitFor({ state: 'visible', timeout: 20_000 });
    await page.screenshot({ path: path.join(outputRoot, 'profile-deadline-link.png'), fullPage: true });
    record('profile-document-links-reload', 'passed');
}

let browser;
let activePage;
try {
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
    await ensureEmailAccountLink(page);
    await ensureDocumentDeadlineLink(page);
} catch (error) {
    report.failure = String(error?.message || error).slice(0, 800);
    await mkdir(outputRoot, { recursive: true }).catch(() => {});
    await activePage?.screenshot({ path: path.join(outputRoot, 'profile-links-failure.png'), fullPage: true }).catch(() => {});
} finally {
    await browser?.close().catch(() => {});
    const resolved = path.resolve(browserProfile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir())
        && path.basename(resolved).startsWith('codici-password-qa-profile-links-')) {
        await rm(resolved, { recursive: true, force: true });
    }
}

const appCheckUrl = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
const sharingUrl = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
report.consoleErrors = report.consoleErrors.filter(error => !error.resource.includes(appCheckUrl)
    && !error.resource.includes(sharingUrl));
report.consoleErrors = report.consoleErrors.filter(error => !(error.text.includes("Framing 'https://www.google.com/'")
    && error.text.includes('report-only Content Security Policy') && error.text.includes("frame-ancestors 'self'")));
report.networkErrors = report.networkErrors.filter(error => !((error.status === 403 && error.url.includes(appCheckUrl))
    || (error.status === 401 && error.url.includes(sharingUrl))));
report.completedAt = new Date().toISOString();
report.complete = !report.actions.some(action => action.status.startsWith('deferred-'));
report.ok = report.actions.length >= 5 && !report.failure && !report.consoleErrors.length && !report.networkErrors.length;
await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'profile-links-fixture.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    ok: report.ok,
    actions: report.actions,
    complete: report.complete,
    failure: report.failure || '',
    consoleErrors: report.consoleErrors,
    networkErrors: report.networkErrors,
    report: '.codex-tmp/qa-final/profile-links-fixture.json'
}, null, 2));
if (!report.ok) process.exitCode = 1;
