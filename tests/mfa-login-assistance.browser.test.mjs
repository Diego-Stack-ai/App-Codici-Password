import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

// The candidate login HTML, login module, modal, DOM helpers and access catalog
// run in a real browser. Authentication/configuration imports are synthetic.
const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const loginHtml = await readFile(path.join(publicRoot, 'login.html'), 'utf8');
const externalRequests = [], moduleErrors = [];
const origin = 'http://127.0.0.1:41729';
let browser;

const boot = String.raw`
const trace = JSON.parse(sessionStorage.getItem('__mfaUiTrace') || '[]');
const state = window.__mfaUi = {
  trace, reads: [], writes: [], forbiddenInputs: [], forbidAllInputReads: false,
  loginMode: new URLSearchParams(location.search).get('scenario') || 'success',
  ready: false, remoteCalls: 0
};
window.__recordMfaUi = (name, args = []) => {
  state.trace.push({name, args});
  sessionStorage.setItem('__mfaUiTrace', JSON.stringify(state.trace));
};
const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
state.peekValue = id => inputValue.get.call(document.getElementById(id));
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  configurable: true,
  get() {
    state.reads.push(this.id);
    if (state.forbidAllInputReads || state.forbiddenInputs.includes(this.id)) {
      throw new Error('UNEXPECTED_INPUT_READ:' + this.id);
    }
    return inputValue.get.call(this);
  },
  set(value) { state.writes.push(this.id); return inputValue.set.call(this, value); }
});
const remote = () => { state.remoteCalls++; throw new Error('UNEXPECTED_REMOTE_CALL'); };
window.fetch = remote;
window.XMLHttpRequest = class { constructor() { remote(); } };
window.WebSocket = class { constructor() { remote(); } };
window.EventSource = class { constructor() { remote(); } };
window.httpsCallable = remote;
`;

const modules = new Map([
  ['/assets/js/auth.js', String.raw`
    const record = (...args) => window.__recordMfaUi(...args);
    export async function login(...args) {
      record('login', args);
      return window.__mfaUi.loginMode === 'mfa' ? {mfaRequired: true}
        : {user: {uid: 'synthetic-user'}, profileData: {language: 'en'}};
    }
    export async function completeTotpLogin(...args) {
      record('completeTotpLogin', args);
      return {user: {uid: 'synthetic-user'}, profileData: {language: 'en'}};
    }
    export function checkAuthState() { record('checkAuthState'); }
    export async function logout() { record('logout'); }
    export async function resendVerificationEmail() { record('resendVerificationEmail'); }
    export async function refreshEmailVerification() { record('refreshEmailVerification'); return false; }
  `],
  ['/assets/js/components-v129.js', 'export function initComponents() {}'],
  ['/assets/js/translations.js', String.raw`
    import {accessCatalogs} from './translations/access.js';
    const base = {close: 'Close', auth_button: 'Sign in', success_auth: 'Signed in'};
    export const t = key => accessCatalogs.en[key] || base[key] || key;
    export const supportedLanguages = [];
    export function applyGlobalTranslations() {
      for (const el of document.querySelectorAll('[data-t]')) {
        if (accessCatalogs.en[el.dataset.t] || base[el.dataset.t]) el.textContent = t(el.dataset.t);
      }
    }
  `],
  ['/assets/js/ui-core-v129.js', String.raw`
    import {showAlertModal as realAlert, showToast as realToast} from './__real-ui.js';
    export function showAlertModal(...args) { window.__recordMfaUi('alert', args); return realAlert(...args); }
    export function showToast(...args) { window.__recordMfaUi('toast', args); return realToast(...args); }
  `],
  ['/assets/js/modules/settings/first-configuration.js', String.raw`
    export async function openInitialLanguageDialog() {}
    export function rememberUserLanguage(...args) { window.__recordMfaUi('rememberUserLanguage', args); }
    export function setLanguagePreference() {}
  `],
  ['/assets/js/app-env.js', String.raw`
    export const COMPLETE_RECOVERY_ENABLED = false;
    export const COMPLETE_RECOVERY_LOGIN_PATH = '/login.html?recovery=complete';
    export const COMPLETE_RECOVERY_PATH = 'recupero_completo.html';
    export const hasCompleteRecoveryIntent = location => new URLSearchParams(location.search).get('recovery') === 'complete';
  `],
]);

async function responseFor(url) {
      if (url.pathname === '/favicon.ico') return {status: 204, body: ''};
      if (url.pathname === '/login.html') {
        // Keep the actual form and modal implementation; avoid theme/startup
        // scripts, manifests, third-party fonts and unrelated application boot.
        const html = loginHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<link\b[^>]*>/gi, '')
          .replace('</head>', '<style>.hidden{display:none!important}.modal-overlay{position:fixed;inset:0;background:white;z-index:9999;padding:20px}.modal-box{max-width:600px}</style></head>')
          .replace('</body>', `<script>${boot}</script><script type="module">
            import {initLogin} from '/assets/js/modules/auth/login.js';
            import {applyGlobalTranslations} from '/assets/js/translations.js';
            await initLogin(); applyGlobalTranslations(); window.__mfaUi.ready = true;
          </script></body>`);
        return {contentType: 'text/html', body: html};
      }
      if (['/home_page.html', '/imposta_nuova_password.html', '/impostazioni.html', '/recupero_completo.html'].includes(url.pathname)) {
        return {contentType: 'text/html', body: '<!doctype html><html><body>Synthetic destination</body></html>'};
      }
      if (modules.has(url.pathname)) {
        return {contentType: 'text/javascript', body: modules.get(url.pathname)};
      }
      const requestedPath = url.pathname === '/assets/js/__real-ui.js' ? '/assets/js/ui-core-v129.js' : url.pathname;
      const file = path.resolve(publicRoot, `.${requestedPath}`);
      if (!file.startsWith(publicRoot + path.sep)) throw new Error('OUTSIDE_PUBLIC_ROOT');
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
    assert.deepEqual(externalRequests, [], 'The synthetic browser must remain on loopback');
    assert.deepEqual(moduleErrors, [], 'Every module must resolve from the candidate or explicit stub');
  } finally {
    await browser?.close();
  }
});

async function fixture(search = '') {
  const context = await browser.newContext();
  const errors = [];
  // Fulfill every resource directly from local files in Playwright. No server,
  // socket, DNS request or Firebase connection is needed, including loopback.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      externalRequests.push(url.origin + url.pathname); return route.abort();
    }
    try { return route.fulfill(await responseFor(url)); }
    catch (error) { moduleErrors.push(String(error.message)); return route.abort(); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error.message)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${origin}/login.html${search}`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.__mfaUi?.ready);
  return {context, page, async close() {
    try { assert.deepEqual(errors, [], 'The real login module must not swallow a failing UI action'); }
    finally { await context.close(); }
  }};
}

async function trace(page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('__mfaUiTrace') || '[]'));
}

async function assertHelp(page) {
  await page.locator('#btn-use-recovery-code').click();
  const modal = page.locator('#protocol-alert-modal');
  await modal.waitFor({state: 'visible'});
  assert.equal(await modal.locator('input,textarea,form').count(), 0, 'Assistance collects no credentials');
  assert.match(await modal.innerText(), /Automatic 2FA recovery is unavailable/);
  assert.match(await modal.innerText(), /No code is consumed and 2FA remains enabled/);
  assert.equal(await page.locator('#recovery-code,#recovery-form-group').count(), 0);
  assert.equal(await page.evaluate(() => window.__mfaUi.remoteCalls), 0);
  await page.locator('#alert-close-btn').click();
  await modal.waitFor({state: 'detached'});
}

for (const offline of [false, true]) {
  test(`assistance before login reads no input and makes no remote call (${offline ? 'offline' : 'online'})`, async () => {
    const f = await fixture();
    try {
      const help = f.page.locator('#btn-use-recovery-code');
      assert.equal(await help.getAttribute('type'), 'button');
      assert.equal(await help.isVisible(), true);
      assert.equal(await f.page.locator('#totp-form-group').isVisible(), false);
      assert.equal(await help.evaluate(el => !!el.closest('.hidden')), false);
      // Sentinel is deliberately synthetic. Reads of any input now fail;
      // clearing the password through its setter remains permitted.
      await f.page.evaluate(() => {
        document.getElementById('password').value = 'SYNTHETIC-UNSUBMITTED-PASSWORD';
        window.__mfaUi.reads = []; window.__mfaUi.forbidAllInputReads = true;
      });
      if (offline) await f.context.setOffline(true);
      const before = await trace(f.page);
      await assertHelp(f.page);
      assert.deepEqual(await f.page.evaluate(() => window.__mfaUi.reads), []);
      assert.equal(await f.page.evaluate(() => window.__mfaUi.peekValue('password')), '');
      const after = await trace(f.page);
      assert.deepEqual(after.slice(before.length).map(event => event.name), ['alert']);
      assert.equal(new URL(f.page.url()).pathname, '/login.html');
      assert.equal(await f.page.locator('#login-submit-btn').isDisabled(), false);
    } finally { await f.close(); }
  });
}

test('MFA pending clears the first-factor password; assistance preserves subsequent TOTP completion', async () => {
  const f = await fixture('?scenario=mfa');
  try {
    await f.page.locator('#email').fill('synthetic@example.invalid');
    await f.page.locator('#password').fill('SYNTHETIC-FIRST-FACTOR');
    await f.page.locator('#login-submit-btn').click();
    await f.page.waitForFunction(() => document.getElementById('password').disabled);
    assert.equal(await f.page.evaluate(() => window.__mfaUi.peekValue('password')), '');
    assert.equal(await f.page.locator('#totp-form-group').isVisible(), true);
    assert.equal(await f.page.locator('#remember-device-row').isVisible(), false);
    const firstFactor = (await trace(f.page)).filter(event => event.name === 'login');
    assert.deepEqual(firstFactor.map(event => event.args), [['synthetic@example.invalid', 'SYNTHETIC-FIRST-FACTOR', true]]);
    await f.page.evaluate(() => { window.__mfaUi.reads = []; window.__mfaUi.forbidAllInputReads = true; });
    const beforeHelp = await trace(f.page);
    await assertHelp(f.page);
    assert.deepEqual(await f.page.evaluate(() => window.__mfaUi.reads), []);
    assert.deepEqual((await trace(f.page)).slice(beforeHelp.length).map(event => event.name), ['alert']);
    assert.equal(await f.page.locator('#totp-form-group').isVisible(), true);
    assert.equal(await f.page.locator('#password').isDisabled(), true);
    assert.equal(await f.page.locator('#login-submit-btn').isDisabled(), false);
    await f.page.evaluate(() => {
      window.__mfaUi.forbidAllInputReads = false;
      window.__mfaUi.forbiddenInputs = ['password'];
      document.getElementById('totp-code').value = '123456';
    });
    await Promise.all([f.page.waitForURL(`${origin}/home_page.html`), f.page.locator('#login-submit-btn').click()]);
    const final = await trace(f.page);
    assert.equal(final.filter(event => event.name === 'login').length, 1);
    assert.deepEqual(final.filter(event => event.name === 'completeTotpLogin').map(event => event.args), [['123456', 'synthetic@example.invalid']]);
    assert.deepEqual(final.filter(event => event.name === 'rememberUserLanguage').map(event => event.args), [['synthetic-user', {language: 'en'}]]);
  } finally { await f.close(); }
});

for (const [search, destination] of [
  ['', '/home_page.html'],
  ['?reauth=password-change', '/imposta_nuova_password.html?reauthenticated=1'],
  ['?reauth=security-settings', '/impostazioni.html'],
  ['?recovery=complete', '/recupero_completo.html'],
]) {
  test(`ordinary first-factor login preserves navigation: ${destination}`, async () => {
    const f = await fixture(search);
    try {
      await f.page.locator('#email').fill('synthetic@example.invalid');
      await f.page.locator('#password').fill('SYNTHETIC-NORMAL-LOGIN');
      await f.page.locator('#remember-device').uncheck();
      await Promise.all([f.page.waitForURL(origin + destination), f.page.locator('#login-submit-btn').click()]);
      const final = await trace(f.page);
      assert.deepEqual(final.filter(event => event.name === 'login').map(event => event.args), [['synthetic@example.invalid', 'SYNTHETIC-NORMAL-LOGIN', false]]);
      assert.equal(final.filter(event => event.name === 'completeTotpLogin' || event.name === 'alert').length, 0);
      assert.deepEqual(final.filter(event => event.name === 'rememberUserLanguage').map(event => event.args), [['synthetic-user', {language: 'en'}]]);
    } finally { await f.close(); }
  });
}
