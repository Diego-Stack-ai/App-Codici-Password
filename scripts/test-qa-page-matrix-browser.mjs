import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadQaCredentialBundle } from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
const localOrigin = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
if (origin !== 'https://appcodici-password.web.app' && !localOrigin) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}
const supportedLanguages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
const languages = [...new Set(String(process.env.QA_LANGUAGES || 'it').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))];
if (!languages.length || languages.some(language => !supportedLanguages.includes(language))) {
    throw new Error('QA_LANGUAGES_INVALID');
}
if (!localOrigin && languages.some(language => language !== 'it')) {
    throw new Error('QA_LANGUAGE_MATRIX_REQUIRES_LOCAL_ORIGIN');
}
const localQaLanguageKey = 'codex_qa_language_override_v1';
const allowContextRedirects = process.env.QA_ALLOW_CONTEXT_REDIRECTS === '1';
const interactiveScreenshots = process.env.QA_INTERACTIVE_SCREENSHOTS === '1';
function optionalFixtureId(name) {
    const value = String(process.env[name] || '').trim();
    if (value && !/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw new Error(`${name}_INVALID`);
    return value;
}
const fixtureContext = {
    privateAccountId: optionalFixtureId('CODEX_QA_PRIVATE_ACCOUNT_ID'),
    companyId: optionalFixtureId('CODEX_QA_COMPANY_ID'),
    companyAccountId: optionalFixtureId('CODEX_QA_COMPANY_ACCOUNT_ID'),
    deadlineId: optionalFixtureId('CODEX_QA_DEADLINE_ID')
};

function contextualRoute(pageId, route) {
    const params = new URLSearchParams();
    if (pageId === 'dettaglio_account_privato' && fixtureContext.privateAccountId) params.set('id', fixtureContext.privateAccountId);
    if (['dati_azienda', 'account_azienda', 'modifica_azienda'].includes(pageId) && fixtureContext.companyId) params.set('id', fixtureContext.companyId);
    if (pageId === 'form_account_azienda' && fixtureContext.companyId) params.set('aziendaId', fixtureContext.companyId);
    if (pageId === 'dettaglio_account_azienda' && fixtureContext.companyId && fixtureContext.companyAccountId) {
        params.set('id', fixtureContext.companyAccountId);
        params.set('aziendaId', fixtureContext.companyId);
    }
    if (pageId === 'dettaglio_scadenza' && fixtureContext.deadlineId) params.set('id', fixtureContext.deadlineId);
    return params.size ? `${route}?${params}` : route;
}

const credentials = await loadQaCredentialBundle();
const catalog = JSON.parse(await readFile(path.join(root, 'Frontend', 'public', 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json'), 'utf8'));
const internalPages = catalog.pages.filter(page => page.family === 'internal').map(page => ({
    pageId: path.basename(page.route, '.html'),
    route: page.route
}));
const knownPageIds = new Set(internalPages.map(page => page.pageId));
const requestedPageIds = [...new Set(String(process.env.QA_PAGE_IDS || '').split(',').map(value => value.trim()).filter(Boolean))];
if (requestedPageIds.some(pageId => !knownPageIds.has(pageId))) throw new Error('QA_PAGE_IDS_INVALID');
const pages = requestedPageIds.length ? internalPages.filter(page => requestedPageIds.includes(page.pageId)) : internalPages;
const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const screenshotRoot = path.join(outputRoot, 'screenshots');
const screenshotPages = new Set(['home_page', 'profilo_privato', 'form_account_privato', 'aggiungi_scadenza', 'impostazioni', 'modifica_azienda', 'gestione_destinatari', ...(interactiveScreenshots ? ['dati_azienda'] : [])]);
const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 393, height: 852 }
];
const profile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-matrix-'));
const report = {
    schemaVersion: 2,
    origin,
    languages,
    pageIds: pages.map(page => page.pageId),
    allowContextRedirects,
    interactiveScreenshots,
    contextFixtures: Object.fromEntries(Object.entries(fixtureContext).map(([key, value]) => [key, Boolean(value)])),
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

async function waitForUrlStability(page, { stableMs = 750, timeoutMs = 6_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let previous = page.url();
    let stableSince = Date.now();
    while (Date.now() < deadline) {
        await page.waitForTimeout(125);
        const current = page.url();
        if (current !== previous) {
            previous = current;
            stableSince = Date.now();
        } else if (Date.now() - stableSince >= stableMs) {
            return current;
        }
    }
    return page.url();
}

async function gotoAfterSettled(page, url) {
    await waitForUrlStability(page, { stableMs: 500, timeoutMs: 4_000 });
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } catch (error) {
        if (!/ERR_ABORTED|interrupted by another navigation/i.test(String(error?.message || error))) throw error;
    }
    await waitForUrlStability(page);
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
    let currentRoute = 'login';
    let currentLanguage = 'it';
    page.on('console', message => {
        if (message.type() !== 'error') return;
        report.consoleErrors.push({ page: currentRoute, language: currentLanguage, text: message.text().slice(0, 300), resource: safeResource(message.location()?.url || '') });
    });
    page.on('pageerror', error => report.consoleErrors.push({ page: currentRoute, language: currentLanguage, text: String(error?.message || error).slice(0, 300), resource: 'page' }));
    page.on('response', response => {
        if (response.status() < 400) return;
        report.networkErrors.push({ page: currentRoute, language: currentLanguage, status: response.status(), resource: safeResource(response.url()) });
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
    const masterInput = page.locator('#protocol-input-modal-input');
    await masterInput.waitFor({ state: 'visible', timeout: 30_000 });
    await masterInput.fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(async () => (await import('/assets/js/modules/core/security-manager.js')).isVaultUnlocked(), null, { timeout: 45_000 });

    const unlockVaultIfRequested = async () => {
        const input = page.locator('#protocol-input-modal-input');
        if (!await input.isVisible().catch(() => false)) return false;
        await input.fill(credentials.masterPassword);
        await page.locator('#modal-confirm-btn').click();
        await page.waitForFunction(async () => (await import('/assets/js/modules/core/security-manager.js')).isVaultUnlocked(), null, { timeout: 45_000 });
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
                    && status && status !== 'first_config_status_pending' && status !== 'first_config_status_complete');
            }, null, { timeout: 10_000 });
            await page.waitForTimeout(250);
            return;
        }
        if (pageId === 'profilo_privato') {
            await page.waitForFunction(() => Boolean(document.querySelector('#profile-overview .profile-overview-heading')), null, { timeout: 10_000 });
            return;
        }
        if (pageId === 'dati_azienda') {
            await page.waitForFunction(() => Boolean(document.querySelector('#company-overview .profile-overview-heading')), null, { timeout: 10_000 });
            return;
        }
        if (pageId === 'gestione_destinatari') {
            await page.waitForFunction(() => Boolean(document.querySelector('.recipient-card') && document.querySelector('.recipient-company-option')), null, { timeout: 10_000 });
            return;
        }
        await page.waitForTimeout(750);
    };

    const captureInteractiveProfileStates = async (pageId, language, viewport, entry) => {
        if (!interactiveScreenshots || !['profilo_privato', 'dati_azienda'].includes(pageId)) return;
        const states = pageId === 'profilo_privato'
            ? [
                { name: 'contacts', tab: '[data-profile-tab-target="contacts"]', panel: '[data-profile-tab="contacts"]:not(.hidden)' },
                { name: 'digital-card', tab: '[data-profile-tab-target="digital-card"]', panel: '#profile-digital-card:not(.hidden) .digital-card-layout' }
            ]
            : [
                { name: 'contacts', tab: '[data-company-tab="contacts"]', panel: '[data-company-panel="contacts"]:not(.hidden)' },
                { name: 'digital-card', tab: '[data-company-tab="digital-card"]', panel: '#company-digital-card:not(.hidden) .digital-card-layout' }
            ];
        entry.interactiveStates = [];
        for (const state of states) {
            await page.locator(state.tab).click();
            await page.locator(state.panel).first().waitFor({ state: 'visible', timeout: 10_000 });
            await page.waitForTimeout(250);
            const result = await page.evaluate(async () => {
                const module = await import('/assets/js/translations.js');
                return {
                    missingTranslationKeys: module.getMissingTranslationKeys(),
                    i18nFallback: document.documentElement.dataset.i18nFallback === 'true',
                    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
                };
            });
            entry.interactiveStates.push({ name: state.name, ...result });
            if (result.i18nFallback || result.missingTranslationKeys.length) throw new Error(`INTERACTIVE_I18N_FALLBACK:${pageId}:${state.name}`);
            if (result.horizontalOverflow) throw new Error(`INTERACTIVE_HORIZONTAL_OVERFLOW:${pageId}:${state.name}`);
            await page.screenshot({ path: path.join(screenshotRoot, `${language}-${viewport.name}-${pageId}-${state.name}.png`), fullPage: true });
        }
    };

    const captureInteractiveRecipientStates = async (pageId, language, viewport, entry) => {
        if (!interactiveScreenshots || pageId !== 'gestione_destinatari') return;
        entry.interactiveStates = [];
        const inspectState = async (name, expected) => {
            const result = await page.evaluate(async ({ expected }) => {
                const module = await import('/assets/js/translations.js');
                const actual = Object.fromEntries(Object.entries(expected).map(([selector, key]) => [selector, {
                    actual: document.querySelector(selector)?.textContent?.trim() || '',
                    expected: module.t(key)
                }]));
                return {
                    missingTranslationKeys: module.getMissingTranslationKeys(),
                    i18nFallback: document.documentElement.dataset.i18nFallback === 'true',
                    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
                    translated: Object.values(actual).every(item => item.actual === item.expected),
                    actual
                };
            }, { expected });
            entry.interactiveStates.push({ name, ...result });
            if (result.i18nFallback || result.missingTranslationKeys.length) throw new Error(`INTERACTIVE_I18N_FALLBACK:${pageId}:${name}`);
            if (result.horizontalOverflow) throw new Error(`INTERACTIVE_HORIZONTAL_OVERFLOW:${pageId}:${name}`);
            if (!result.translated) throw new Error(`INTERACTIVE_TRANSLATION_MISMATCH:${pageId}:${name}`);
            await page.screenshot({ path: path.join(screenshotRoot, `${language}-${viewport.name}-${pageId}-${name}.png`), fullPage: true });
        };

        await page.locator('.recipient-card .recipient-icon-button').first().click();
        await page.locator('#recipient-cancel').waitFor({ state: 'visible', timeout: 10_000 });
        const contactName = await page.locator('#recipient-first-name').inputValue();
        await inspectState('edit', {
            '#recipient-form-title': 'recipient_edit_title',
            '#recipient-save': 'recipient_update_action',
            '#recipient-cancel': 'cancel'
        });

        await page.locator('#recipient-cancel').click();
        await page.locator('#recipient-save').click();
        await page.locator('#toast.active .toast-content span:last-child').waitFor({ state: 'visible', timeout: 5_000 });
        await inspectState('validation', {
            '#recipient-form-title': 'recipient_new_title',
            '#recipient-save': 'recipient_save_action',
            '#toast.active .toast-content span:last-child': 'recipient_name_required'
        });
        await page.evaluate(() => document.getElementById('toast')?.classList.remove('active'));

        await page.locator('.recipient-card .action-delete').first().click();
        await page.locator('#protocol-confirm-modal.active').waitFor({ state: 'visible', timeout: 5_000 });
        await page.waitForTimeout(350);
        const deleteResult = await page.evaluate(async ({ contactName }) => {
            const module = await import('/assets/js/translations.js');
            const expectedMessage = module.t('recipient_delete_message').replaceAll('{name}', String(contactName || '').trim());
            return {
                missingTranslationKeys: module.getMissingTranslationKeys(),
                i18nFallback: document.documentElement.dataset.i18nFallback === 'true',
                horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
                translated: document.querySelector('#protocol-confirm-modal .modal-title')?.textContent?.trim() === module.t('recipient_delete_title')
                    && document.querySelector('#protocol-confirm-modal .modal-text')?.textContent?.trim() === expectedMessage
                    && document.querySelector('#confirm-cancel-btn')?.textContent?.trim() === module.t('cancel')
                    && document.querySelector('#confirm-ok-btn')?.textContent?.trim() === module.t('confirm')
            };
        }, { contactName });
        entry.interactiveStates.push({ name: 'delete-confirmation', ...deleteResult });
        if (deleteResult.i18nFallback || deleteResult.missingTranslationKeys.length) throw new Error(`INTERACTIVE_I18N_FALLBACK:${pageId}:delete-confirmation`);
        if (deleteResult.horizontalOverflow) throw new Error(`INTERACTIVE_HORIZONTAL_OVERFLOW:${pageId}:delete-confirmation`);
        if (!deleteResult.translated) throw new Error(`INTERACTIVE_TRANSLATION_MISMATCH:${pageId}:delete-confirmation`);
        await page.screenshot({ path: path.join(screenshotRoot, `${language}-${viewport.name}-${pageId}-delete-confirmation.png`), fullPage: true });
        await page.locator('#confirm-cancel-btn').click();
        await page.locator('#protocol-confirm-modal').waitFor({ state: 'detached', timeout: 5_000 });
    };

    for (const language of languages) {
        currentLanguage = language;
        await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: localQaLanguageKey, value: language });
        for (const viewport of viewports) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            for (const { pageId, route } of pages) {
                currentRoute = pageId;
                const requestedRoute = contextualRoute(currentRoute, route);
                const expectedUrl = `${origin}${requestedRoute}`;
                const entry = { pageId: currentRoute, route, requestedRoute, language, viewport: viewport.name, status: 'UNKNOWN', finalPageId: '', title: '', mainVisible: false,
                    htmlLanguage: '', missingTranslationKeys: [], i18nFallback: false, horizontalOverflow: false };
                try {
                    await gotoAfterSettled(page, expectedUrl);
                    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 25_000 }).catch(() => {});
                    await page.waitForTimeout(250);
                    await unlockVaultIfRequested();
                    await waitForPrivateShell().catch(() => {});
                    entry.finalPageId = pageIdFromUrl(page.url());
                    entry.title = await page.title();
                    entry.mainVisible = await page.locator('main').first().isVisible().catch(() => false);
                    const i18nState = await page.evaluate(async () => {
                        const module = await import('/assets/js/translations.js');
                        return {
                            htmlLanguage: document.documentElement.lang,
                            missingTranslationKeys: module.getMissingTranslationKeys(),
                            i18nFallback: document.documentElement.dataset.i18nFallback === 'true',
                            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
                        };
                    });
                    Object.assign(entry, i18nState);
                    if (entry.finalPageId !== currentRoute) entry.status = 'NEEDS_FIXTURE_OR_CONTEXT';
                    else if (entry.htmlLanguage !== language) entry.status = 'LANGUAGE_MISMATCH';
                    else if (entry.i18nFallback || entry.missingTranslationKeys.length) entry.status = 'I18N_FALLBACK';
                    else if (!entry.mainVisible) entry.status = 'SHELL_NOT_VISIBLE';
                    else entry.status = 'SHELL_OK';
                    if (screenshotPages.has(currentRoute) && entry.status === 'SHELL_OK') {
                        await waitForRepresentativeContent(currentRoute).catch(error => {
                            report.warnings.push(`DYNAMIC_CONTENT_TIMEOUT:${language}:${viewport.name}:${currentRoute}`);
                            throw error;
                        });
                        await page.screenshot({ path: path.join(screenshotRoot, `${language}-${viewport.name}-${currentRoute}.png`), fullPage: true });
                        await captureInteractiveProfileStates(currentRoute, language, viewport, entry);
                        await captureInteractiveRecipientStates(currentRoute, language, viewport, entry);
                    }
                } catch (error) {
                    entry.status = 'ERROR';
                    entry.error = String(error?.message || error).split('\n')[0].slice(0, 300);
                }
                report.routes.push(entry);
            }
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
    assert.equal(report.routes.length, pages.length * viewports.length * languages.length);
} finally {
    await browser?.close().catch(() => {});
    const target = path.resolve(profile);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('codici-password-qa-matrix-')) {
        await rm(target, { recursive: true, force: true });
    }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'page-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const hasRouteFailure = report.routes.some(entry => entry.status !== 'SHELL_OK'
    && !(allowContextRedirects && entry.status === 'NEEDS_FIXTURE_OR_CONTEXT'));
console.log(JSON.stringify({ ok: !report.consoleErrors.length && !report.networkErrors.length && !hasRouteFailure,
    summary: report.summary, consoleErrors: report.consoleErrors.length, networkErrors: report.networkErrors.length,
    warnings: report.warnings, report: path.relative(root, path.join(outputRoot, 'page-matrix.json')) }, null, 2));
if (report.consoleErrors.length || report.networkErrors.length || hasRouteFailure) process.exitCode = 1;
