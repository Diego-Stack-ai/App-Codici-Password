import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
const catalog = JSON.parse(await readFile(path.join(root, 'Frontend', 'public', 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json'), 'utf8'));
const routes = catalog.pages.filter(page => page.family === 'internal').map(page => page.route);
const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const screenshotRoot = path.join(outputRoot, 'screenshots');
const screenshotPages = new Set(['home_page', 'profilo_privato', 'form_account_privato', 'aggiungi_scadenza', 'impostazioni', 'modifica_azienda']);
const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 393, height: 852 }
];
const profile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-matrix-'));
const report = {
    schemaVersion: 1,
    origin,
    startedAt: new Date().toISOString(),
    routes: [],
    consoleErrors: [],
    networkErrors: [],
    warnings: []
};

function safeResource(value) {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return 'invalid-url';
    }
}

function pageIdFromUrl(value) {
    try { return path.basename(new URL(value).pathname, '.html'); }
    catch { return 'invalid'; }
}

let browser;
try {
    await mkdir(screenshotRoot, { recursive: true });
    browser = await chromium.launchPersistentContext(profile, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check'],
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: false
    });
    const page = browser.pages()[0] || await browser.newPage();
    let currentRoute = 'login-v115';
    page.on('console', message => {
        if (message.type() !== 'error') return;
        report.consoleErrors.push({ page: currentRoute, text: message.text().slice(0, 300), resource: safeResource(message.location()?.url || '') });
    });
    page.on('pageerror', error => report.consoleErrors.push({ page: currentRoute, text: String(error?.message || error).slice(0, 300), resource: 'page' }));
    page.on('response', response => {
        if (response.status() < 400) return;
        report.networkErrors.push({ page: currentRoute, status: response.status(), resource: safeResource(response.url()) });
    });

    await page.goto(`${origin}/login-v115.html`, { waitUntil: 'networkidle', timeout: 45_000 });
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
    const masterInput = page.locator('#protocol-input-modal-input');
    await masterInput.waitFor({ state: 'visible', timeout: 30_000 });
    await masterInput.fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, { timeout: 45_000 });

    const unlockVaultIfRequested = async () => {
        const input = page.locator('#protocol-input-modal-input');
        if (!await input.isVisible().catch(() => false)) return false;
        await input.fill(credentials.masterPassword);
        await page.locator('#modal-confirm-btn').click();
        await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, { timeout: 45_000 });
        return true;
    };

    const waitForPrivateShell = async () => {
        await page.waitForFunction(() => {
            const body = document.body;
            const main = document.querySelector('main');
            if (!body || !main || body.hidden || body.hasAttribute('inert')) return false;
            const style = getComputedStyle(main);
            return style.display !== 'none' && style.visibility !== 'hidden' && main.getBoundingClientRect().height > 0;
        }, null, { timeout: 15_000 });
    };

    const waitForRepresentativeContent = async pageId => {
        if (pageId === 'home_page') {
            await page.waitForFunction(() => {
                const value = document.getElementById('home-user-name')?.textContent?.trim();
                return Boolean(value && value !== '...' && document.querySelector('#footer-center-actions .fab-group'));
            }, null, { timeout: 10_000 });
            await page.waitForTimeout(1_100);
            return;
        }
        if (pageId === 'impostazioni') {
            await page.waitForFunction(() => {
                const value = document.getElementById('user-name-settings')?.textContent?.trim();
                const status = document.getElementById('first-configuration-status')?.textContent?.trim();
                return Boolean(value && value !== 'Caricamento...' && value !== 'Loading...'
                    && status && !/completare|pending/i.test(status));
            }, null, { timeout: 10_000 });
            return;
        }
        await page.waitForTimeout(750);
    };

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const route of routes) {
            currentRoute = route.slice(1, -5);
            const expectedUrl = `${origin}${route}`;
            const entry = { pageId: currentRoute, route, viewport: viewport.name, status: 'UNKNOWN', finalPageId: '', title: '', mainVisible: false };
            try {
                await page.goto(expectedUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
                await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 25_000 }).catch(() => {});
                await page.waitForTimeout(250);
                await unlockVaultIfRequested();
                await waitForPrivateShell().catch(() => {});
                entry.finalPageId = pageIdFromUrl(page.url());
                entry.title = await page.title();
                entry.mainVisible = await page.locator('main').first().isVisible().catch(() => false);
                if (entry.finalPageId !== currentRoute) entry.status = 'NEEDS_FIXTURE_OR_CONTEXT';
                else if (!entry.mainVisible) entry.status = 'SHELL_NOT_VISIBLE';
                else entry.status = 'SHELL_OK';
                if (screenshotPages.has(currentRoute) && entry.status === 'SHELL_OK') {
                    await waitForRepresentativeContent(currentRoute).catch(() => {
                        report.warnings.push(`DYNAMIC_CONTENT_TIMEOUT:${viewport.name}:${currentRoute}`);
                    });
                    await page.screenshot({ path: path.join(screenshotRoot, `${viewport.name}-${currentRoute}.png`), fullPage: true });
                }
            } catch (error) {
                entry.status = 'ERROR';
                entry.error = String(error?.message || error).split('\n')[0].slice(0, 300);
            }
            report.routes.push(entry);
        }
    }

    const appCheck = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
    const sharing = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
    const expectedConsole = report.consoleErrors.filter(error => error.resource.includes(appCheck) || error.resource.includes(sharing));
    const expectedNetwork = report.networkErrors.filter(error => (error.status === 403 && error.resource.includes(appCheck))
        || (error.status === 401 && error.resource.includes(sharing)));
    const recaptchaReportOnly = report.consoleErrors.filter(error => error.text.includes("Framing 'https://www.google.com/'")
        && error.text.includes('report-only Content Security Policy')
        && error.text.includes("frame-ancestors 'self'"));
    if (expectedConsole.length || expectedNetwork.length) report.warnings.push('APP_CHECK_HEADLESS_LIMITATION');
    if (recaptchaReportOnly.length) report.warnings.push('GOOGLE_RECAPTCHA_FRAME_REPORT_ONLY');
    report.consoleErrors = report.consoleErrors.filter(error => !expectedConsole.includes(error) && !recaptchaReportOnly.includes(error));
    report.networkErrors = report.networkErrors.filter(error => !expectedNetwork.includes(error));
    report.completedAt = new Date().toISOString();
    report.summary = Object.fromEntries([...new Set(report.routes.map(entry => entry.status))]
        .map(status => [status, report.routes.filter(entry => entry.status === status).length]));
    assert.equal(report.routes.length, routes.length * viewports.length);
} finally {
    await browser?.close().catch(() => {});
    const target = path.resolve(profile);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('codici-password-qa-matrix-')) {
        await rm(target, { recursive: true, force: true });
    }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'page-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const hasRouteFailure = report.routes.some(entry => entry.status !== 'SHELL_OK');
console.log(JSON.stringify({ ok: !report.consoleErrors.length && !report.networkErrors.length && !hasRouteFailure,
    summary: report.summary, consoleErrors: report.consoleErrors.length, networkErrors: report.networkErrors.length,
    warnings: report.warnings, report: path.relative(root, path.join(outputRoot, 'page-matrix.json')) }, null, 2));
if (report.consoleErrors.length || report.networkErrors.length || hasRouteFailure) process.exitCode = 1;
