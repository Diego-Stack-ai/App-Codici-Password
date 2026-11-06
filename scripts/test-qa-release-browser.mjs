import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadQaCredentialBundle } from './lib/qa-credentials.mjs';

const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
if (origin !== 'https://appcodici-password.web.app' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}
const credentials = await loadQaCredentialBundle();
const profile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-browser-'));
let browser;
const report = { ok: false, origin, login: false, vaultUnlock: false, home: false, logout: false, consoleErrors: [], networkErrors: [], warnings: [] };

function safeUrl(value) {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch { return 'invalid-url'; }
}

try {
    browser = await chromium.launchPersistentContext(profile, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check'],
        viewport: { width: 1280, height: 900 },
        acceptDownloads: false
    });
    const page = browser.pages()[0] || await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({
            text: message.text().slice(0, 300), source: safeUrl(message.location()?.url || '')
        });
    });
    page.on('pageerror', error => report.consoleErrors.push(String(error?.message || error).slice(0, 300)));
    page.on('response', response => {
        if (response.status() >= 400) report.networkErrors.push({ status: response.status(), resource: safeUrl(response.url()) });
    });

    await page.goto(`${origin}/login.html`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    const languageDialog = page.locator('#initial-language-dialog');
    if (await languageDialog.isVisible().catch(() => false)) {
        await languageDialog.locator('button[data-code="it"]').click();
        await languageDialog.locator('.first-configuration-primary').click();
        await page.waitForLoadState('networkidle', { timeout: 45_000 });
        await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.accountPassword);
    await page.locator('#login-submit-btn').click();
    await page.waitForURL(/\/home_page\.html(?:[?#]|$)/, { timeout: 45_000 });
    report.login = true;

    const masterInput = page.locator('#protocol-input-modal-input');
    await masterInput.waitFor({ state: 'visible', timeout: 30_000 });
    await masterInput.fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(async () => (await import('/assets/js/modules/core/security-manager.js')).isVaultUnlocked(), null, { timeout: 45_000 });
    report.vaultUnlock = true;
    await page.locator('main').waitFor({ state: 'visible', timeout: 15_000 });
    assert.equal(await page.locator('#email-verification-panel').count(), 0);
    report.home = true;

    if (process.env.QA_VERIFY_RAM_NAVIGATION === '1') {
        report.navigation = [];
        for (const route of ['area_privata.html', 'account_privati.html', 'impostazioni.html', 'home_page.html']) {
            // Firestore listeners can keep the network active indefinitely.
            // Wait for the actual unlock UI/state instead of network silence.
            await page.goto(`${origin}/${route}`, {waitUntil:'domcontentloaded',timeout:45_000});
            const input = page.locator('#protocol-input-modal-input');
            await input.waitFor({state:'visible',timeout:30_000});
            assert.equal(await page.evaluate(async () => (await import('/assets/js/modules/core/security-manager.js')).isVaultUnlocked()), false);
            await input.fill(credentials.masterPassword);
            await page.locator('#modal-confirm-btn').click();
            await page.waitForFunction(async () => (await import('/assets/js/modules/core/security-manager.js')).isVaultUnlocked(), null, {timeout:45_000});
            report.navigation.push({route, freshUnlock:true});
        }
    }

    await page.locator('#header-logout-btn').click();
    await page.locator('#btn-confirm-logout').click();
    await page.waitForURL(/\/login\.html(?:[?#]|$)/, { timeout: 30_000 });
    report.logout = true;
    const fresh = await browser.newPage();
    await fresh.goto(`${origin}/home_page.html`, {waitUntil:'domcontentloaded',timeout:45_000});
    await fresh.waitForURL(/\/login\.html(?:[?#]|$)/, {timeout:30_000});
    report.freshTabDenied = true;
    await fresh.close();
    report.ok = true;
} finally {
    await browser?.close().catch(() => {});
    const target = path.resolve(profile);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('codici-password-qa-browser-')) {
        await rm(target, { recursive: true, force: true });
    }
}

const appCheckProbe = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
const expectedConsole = report.consoleErrors.filter(error => typeof error === 'object' && error.source.includes(appCheckProbe));
const expectedNetwork = report.networkErrors.filter(error => error.status === 403 && error.resource.includes(appCheckProbe));
if (expectedConsole.length || expectedNetwork.length) {
    report.warnings.push('APP_CHECK_RECAPTCHA_HEADLESS_REJECTED');
    report.consoleErrors = report.consoleErrors.filter(error => !expectedConsole.includes(error));
    report.networkErrors = report.networkErrors.filter(error => !expectedNetwork.includes(error));
}
if (report.warnings.includes('APP_CHECK_RECAPTCHA_HEADLESS_REJECTED')) {
    const sharingPath = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
    const expectedSharingConsole = report.consoleErrors.filter(error => typeof error === 'object' && error.source.includes(sharingPath));
    const expectedSharingNetwork = report.networkErrors.filter(error => error.status === 401 && error.resource.includes(sharingPath));
    if (expectedSharingConsole.length || expectedSharingNetwork.length) {
        report.warnings.push('SHARING_IDENTITY_APP_CHECK_BLOCKED');
        report.consoleErrors = report.consoleErrors.filter(error => !expectedSharingConsole.includes(error));
        report.networkErrors = report.networkErrors.filter(error => !expectedSharingNetwork.includes(error));
    }
}
console.log(JSON.stringify(report, null, 2));
if (!report.ok || report.consoleErrors.length || report.networkErrors.length) process.exitCode = 1;
