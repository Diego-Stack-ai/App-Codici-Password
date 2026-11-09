import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

// Browser regression: real candidate HTML, full settings module, DOM helpers and
// eight settings catalogs; only unrelated startup and service boundaries stubbed.
// The appended export exposes the existing settings setup functions to the test.
// No Firebase account, callable, HTTP server, socket or external network is used.
const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const settingsPath = '/assets/js/modules/settings/impostazioni.js';
const settingsSource = await readFile(path.join(publicRoot, settingsPath), 'utf8');
const settingsHtml = await readFile(path.join(publicRoot, 'impostazioni.html'), 'utf8');
const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
const origin = 'http://127.0.0.1:41739';
const externalRequests = [], moduleErrors = [];
let browser;

const boot = String.raw`
  const options = new URLSearchParams(location.search);
  window.__settingsMfa = {
    ready: false, language: options.get('language') || 'en',
    enrolled: options.get('enrolled') === 'true',
    enrolls: 0, unenrolls: 0, recoveryCalls: 0, remoteCalls: 0,
    confirms: 0, toasts: [], errors: [],
    forbiddenCodes: ['SYNTHETIC-RECOVERY-0001', 'SYNTHETIC-RECOVERY-0002']
  };
`;

const modules = new Map();
for (const match of settingsSource.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm)) {
  const url = new URL(match[2], origin + settingsPath);
  const names = match[1].split(',').map(value => value.trim());
  const exports = names.map(name => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw Error(`Unsupported test import: ${name}`);
    return `export function ${name}() { throw Error('UNEXPECTED_SERVICE_${name}'); }`;
  });
  modules.set(url.pathname, exports.join('\n'));
}
modules.set('/assets/js/firebase-config.js', 'export const auth={currentUser:{uid:"synthetic"}}, db={};');
modules.set('/assets/js/vendor/firebase-runtime.js', String.raw`
  export function signOut() { throw Error('UNEXPECTED_SIGN_OUT'); }
  export function onAuthStateChanged() { return () => {}; }
  export function doc() { throw Error('UNEXPECTED_FIRESTORE'); }
  export function updateDoc() { throw Error('UNEXPECTED_FIRESTORE'); }
  export function httpsCallable() {
    return async () => { window.__settingsMfa.remoteCalls++; throw Error('UNEXPECTED_CALLABLE'); };
  }
`);
modules.set('/assets/js/modules/core/mfa-manager.js', String.raw`
  export function getTotpEnrollment() { return window.__settingsMfa.enrolled ? {uid:'synthetic-factor'} : null; }
  export async function enrollTotp() { const s=window.__settingsMfa; s.enrolls++; s.enrolled=true; return true; }
  export async function unenrollTotp() { const s=window.__settingsMfa; s.unenrolls++; s.enrolled=false; return true; }
  export async function createRecoveryCodes() {
    const s=window.__settingsMfa; s.recoveryCalls++; s.remoteCalls++; return s.forbiddenCodes;
  }
  export async function revokeAllSessions() { throw Error('UNEXPECTED_SESSION_REVOCATION'); }
`);
modules.set('/assets/js/modules/core/security-manager.js', String.raw`
  export function isBiometricUnlockConfigured() { return false; }
  export function decrypt() { throw Error('UNEXPECTED_VAULT'); }
  export function ensureVaultKeyMaterial() { throw Error('UNEXPECTED_VAULT'); }
  export function clearSession() { throw Error('UNEXPECTED_VAULT'); }
  export function resetVault() { throw Error('UNEXPECTED_VAULT'); }
  export function changeMasterPassword() { throw Error('UNEXPECTED_VAULT'); }
`);
modules.set('/assets/js/modules/core/webauthn-manager.js', 'export async function isWebAuthnSupported(){return false;}');
modules.set('/assets/js/modules/settings/portable-archive-service.js', 'export const privateTestOnly=true;');
modules.set('/assets/js/ui-core-v129.js', String.raw`
  export function showToast(...args) { window.__settingsMfa.toasts.push(args); }
  export async function showConfirmModal() { window.__settingsMfa.confirms++; return true; }
  export async function showInputModal() { throw Error('UNEXPECTED_INPUT_DIALOG'); }
`);
modules.set('/assets/js/translations.js', String.raw`
  import {settingsCatalogs} from './translations/settings.js';
  export const getCurrentLanguage = () => window.__settingsMfa.language;
  export const t = key => settingsCatalogs[getCurrentLanguage()][key] || key;
  export const tf = (key, values) => t(key).replace(/\{([^}]+)\}/g, (_, name) => values[name] || '');
  export function applySettingsTranslations() {
    for (const el of document.querySelectorAll('[data-t]')) {
      if (settingsCatalogs[getCurrentLanguage()][el.dataset.t]) el.textContent = t(el.dataset.t);
    }
    window.__settingsMfa.expectedHelp = t('settings_recovery_codes_help');
  }
`);
// Keep the actual DOM helpers. All other generated stubs fail on accidental use.
modules.delete('/assets/js/dom-utils.js');

async function responseFor(url) {
  if (url.pathname === '/favicon.ico') return {status: 204, body: ''};
  if (url.pathname === '/impostazioni.html') {
    const html = settingsHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<body[^>]*>/, '<body>')
      .replace('</head>', '<style>.hidden{display:none!important}</style></head>')
      .replace('</body>', `<script>${boot}</script><script type="module">
        import {__testSetupMfa} from '${settingsPath}';
        import {applySettingsTranslations} from '/assets/js/translations.js';
        applySettingsTranslations(); __testSetupMfa(); window.__settingsMfa.ready=true;
      </script></body>`);
    return {contentType: 'text/html', body: html};
  }
  if (url.pathname === settingsPath) return {contentType: 'text/javascript', body: settingsSource + '\nexport function __testSetupMfa(){initSettingsEvents({uid:"synthetic"});setupSecurityToggles({});}\n'};
  if (modules.has(url.pathname)) return {contentType: 'text/javascript', body: modules.get(url.pathname)};
  const file = path.resolve(publicRoot, `.${url.pathname}`);
  if (!file.startsWith(publicRoot + path.sep)) throw Error('OUTSIDE_PUBLIC_ROOT');
  return {contentType: 'text/javascript', body: await readFile(file)};
}

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--no-first-run', '--no-default-browser-check']
  });
});
after(async () => {
  try {
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(moduleErrors, []);
  } finally { await browser?.close(); }
});

async function fixture(enrolled, language = 'en') {
  const context = await browser.newContext();
  const errors = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { externalRequests.push(url.origin + url.pathname); return route.abort(); }
    try { return route.fulfill(await responseFor(url)); }
    catch (error) { moduleErrors.push(String(error.message)); return route.abort(); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error.message)));
  await page.goto(`${origin}/impostazioni.html?enrolled=${enrolled}&language=${language}`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.__settingsMfa?.ready);
  return {page, context, async close() {
    try { assert.deepEqual(errors, []); }
    finally { await context.close(); }
  }};
}

async function assertUnavailable(page) {
  const button = page.locator('#btn-regenerate-recovery-codes');
  assert.equal(await button.getAttribute('type'), 'button');
  assert.equal(await button.isVisible(), true);
  assert.equal(await button.isDisabled(), true);
  const descriptionIds = (await button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  assert.ok(descriptionIds.length, 'Disabled control must have an accessible explanation');
  const expected = await page.evaluate(() => window.__settingsMfa.expectedHelp);
  assert.notEqual(expected, 'settings_recovery_codes_help');
  const descriptions = [];
  for (const id of descriptionIds) {
    const description = page.locator(`[id="${id}"]`);
    assert.equal(await description.isVisible(), true);
    descriptions.push(await description.innerText());
  }
  assert.ok(descriptions.includes(expected));
  assert.equal(await page.locator('.recovery-code-grid').count(), 0);
  const state = await page.evaluate(() => ({...window.__settingsMfa, body:document.body.innerText}));
  assert.equal(state.recoveryCalls, 0);
  assert.equal(state.remoteCalls, 0);
  assert.equal(state.confirms, 0);
  for (const code of state.forbiddenCodes) assert.equal(state.body.includes(code), false);
}

for (const enrolled of [false, true]) {
  test(`settings code generation stays unavailable with TOTP ${enrolled ? 'on' : 'off'}`, async () => {
    const f = await fixture(enrolled);
    try {
      await assertUnavailable(f.page);
      await f.page.evaluate(() => {
        const button = document.getElementById('btn-regenerate-recovery-codes');
        button.click();
        // dispatchEvent bypasses the disabled control's native click suppression.
        button.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
      });
      await f.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
      await assertUnavailable(f.page);
      assert.equal(await f.page.evaluate(() => window.__settingsMfa.enrolled), enrolled);
    } finally { await f.close(); }
  });
}

test('successful TOTP enrollment and removal never generate recovery codes', async () => {
  const f = await fixture(false);
  try {
    await f.page.locator('[id="2fa-toggle"]').check();
    await f.page.waitForFunction(() => window.__settingsMfa.enrolls===1 && !document.getElementById('2fa-toggle').disabled);
    assert.equal(await f.page.locator('[id="2fa-toggle"]').isChecked(), true);
    await assertUnavailable(f.page);
    await f.page.locator('[id="2fa-toggle"]').uncheck();
    await f.page.waitForFunction(() => window.__settingsMfa.unenrolls===1 && !document.getElementById('2fa-toggle').disabled);
    assert.equal(await f.page.locator('[id="2fa-toggle"]').isChecked(), false);
    await assertUnavailable(f.page);
    assert.equal(await f.page.evaluate(() => window.__settingsMfa.toasts.length), 2);
  } finally { await f.close(); }
});

for (const language of languages) {
  test(`settings assistance is available in ${language}`, async () => {
    const f = await fixture(true, language);
    try { await assertUnavailable(f.page); }
    finally { await f.close(); }
  });
}
