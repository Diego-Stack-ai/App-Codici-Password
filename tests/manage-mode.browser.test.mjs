import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

// Pilota UI a tre livelli (PR #283): consultazione senza comandi di gestione,
// gestione solo dopo «Modifica», reset su blocco Vault e cambio linguetta.
const publicRoot = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const launchBrowser = () => chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});

const card = (qrChecked, linked) => `
  <div class="form-card profile-data-card profile-contact-card">
    <div class="card-header-row">
      <span class="card-title-accent">Cellulare</span>
      <div class="card-actions-row">
        <button class="btn-edit-section" data-probe="edit">E</button>
        <button class="btn-edit-section btn-delete" data-probe="delete">D</button>
      </div>
    </div>
    <div class="field-header">
      <input type="checkbox" class="qr-checkbox" id="qr-${qrChecked ? 'on' : 'off'}" data-probe="qr-box" ${qrChecked ? 'checked' : ''}>
      <label class="qr-mini-label" for="qr-${qrChecked ? 'on' : 'off'}" data-probe="qr-label">QR</label>
      <span class="data-label">Numero</span>
    </div>
    <div class="field-value-row"><span class="data-value" data-probe="value">333 123 4567</span><button class="btn-action-mini" data-probe="copy">C</button></div>
    <div class="${linked ? 'profile-account-actions' : ''}">
      <button class="btn-upload-trigger ${linked ? 'profile-account-primary' : 'profile-account-connect'}" data-probe="${linked ? 'open' : 'connect'}">A</button>
      ${linked ? '<button class="btn-upload-trigger profile-account-manage" data-probe="unlink">U</button>' : ''}
    </div>
  </div>`;

const fixture = async () => {
  const html = await readFile(path.join(publicRoot, 'profilo_privato.html'), 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('\n');
  return `<!doctype html><html lang="it"><head>${links}</head>
  <body data-ui-revision="tre-livelli">
    <nav><button role="tab" data-probe="tab">Contatti</button>
      <button role="tab" aria-selected="true" data-probe="key-tab-a">A</button><button role="tab" aria-selected="false" tabindex="-1" data-probe="key-tab-b">B</button></nav>
    <div class="form-section" data-manageable id="full">
      <div class="form-section-header collapsible-header collapsed" data-section="full">
        <h3 class="form-section-title">Contatti Telefonici</h3><span class="expand-icon">v</span>
      </div>
      <div id="full-view-container" class="guide-content-wrapper collapsed">
        <button class="btn-upload-trigger profile-add-trigger" data-probe="add-full">+</button>
        ${card(true, true)}${card(false, false)}
      </div>
    </div>
    <div class="form-section" data-manageable id="empty">
      <div class="form-section-header"><h3 class="form-section-title">Email</h3></div>
      <div class="guide-content-wrapper"><button class="btn-upload-trigger profile-add-trigger" data-probe="add-empty">+</button></div>
    </div>
    <script type="module">
      import {installManageMode} from '/assets/js/modules/shared/manage-mode.js';
      document.querySelector('.collapsible-header').addEventListener('click', event => {
        event.currentTarget.classList.toggle('collapsed');
        document.getElementById('full-view-container').classList.toggle('collapsed');
      });
      // Controller da tastiera come profilo-dashboard.js: cambia linguetta senza click.
      const keyTabs = [...document.querySelectorAll('[data-probe^="key-tab"]')];
      keyTabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = keyTabs[(index + 1) % keyTabs.length];
        keyTabs.forEach(item => item.setAttribute('aria-selected', String(item === next)));
        next.focus();
      }));
      window.qrSaves = 0;
      document.querySelectorAll('.qr-checkbox').forEach(box => box.addEventListener('change', () => window.qrSaves++));
      installManageMode(document);
      window.manageReady = true;
    </script>
  </body></html>`;
};

let browser, server, base;
test.before(async () => {
  const page = await fixture();
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://fixture.invalid').pathname;
      if (pathname === '/fixture.html') { res.writeHead(200, {'Content-Type': 'text/html'}); res.end(page); return; }
      const file = path.join(publicRoot, decodeURIComponent(pathname));
      if (!file.startsWith(publicRoot)) throw Error('outside');
      const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/javascript';
      res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'}); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser();
});
test.after(async () => { await browser?.close(); await new Promise(done => server?.close(done)); });

async function open() {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(`${base}/fixture.html`);
  await page.waitForFunction(() => window.manageReady === true);
  return page;
}
const visible = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .map(element => getComputedStyle(element).display !== 'none'), selector);

test('consultation hides management commands and keeps data, quick actions and links', {timeout: 30000}, async () => {
  const page = await open();
  try {
    for (const probe of ['edit', 'delete', 'unlink', 'connect', 'add-full', 'qr-box']) {
      assert.deepEqual([...new Set(await visible(page, `#full [data-probe="${probe}"]`))], [false], probe);
    }
    for (const probe of ['value', 'copy', 'open']) {
      assert.deepEqual([...new Set(await visible(page, `#full [data-probe="${probe}"]`))], [true], probe);
    }
    assert.deepEqual(await visible(page, '#full [data-probe="qr-label"]'), [true, false], 'QR indicator only for included data');
    assert.deepEqual(await visible(page, '#empty [data-probe="add-empty"]'), [true], 'empty section keeps the add invitation');
  } finally { await page.close(); }
});

test('Modifica reveals management, expands a collapsed section and Fine restores consultation', {timeout: 30000}, async () => {
  const page = await open();
  try {
    const toggle = page.locator('#full .manage-toggle');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.match(await toggle.getAttribute('aria-label'), /Contatti Telefonici/);
    await toggle.click();
    assert.equal(await page.getAttribute('#full', 'data-manage'), 'on');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.querySelector('#full .collapsible-header').classList.contains('collapsed')), false);
    for (const probe of ['edit', 'delete', 'unlink', 'connect', 'add-full', 'qr-box']) {
      assert.ok((await visible(page, `#full [data-probe="${probe}"]`)).every(Boolean), probe);
    }
    assert.equal(await page.getAttribute('#empty', 'data-manage'), 'off', 'other sections stay in consultation');
    await toggle.click();
    assert.equal(await page.getAttribute('#full', 'data-manage'), 'off');
  } finally { await page.close(); }
});

test('Vault lock, auth block and tab change return every section to consultation', {timeout: 30000}, async () => {
  const page = await open();
  try {
    for (const trigger of ['vault-session-locked', 'private-auth-blocked', 'tab']) {
      await page.locator('#full .manage-toggle').click();
      await page.locator('#empty .manage-toggle').click();
      if (trigger === 'tab') await page.locator('[data-probe="tab"]').click();
      else await page.evaluate(name => window.dispatchEvent(new Event(name)), trigger);
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-manageable]')].map(section => section.dataset.manage)), ['off', 'off'], trigger);
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.manage-toggle')].map(button => button.getAttribute('aria-pressed'))), ['false', 'false'], trigger);
    }
  } finally { await page.close(); }
});

test('QR indicator is passive in consultation and the explicit toggle works in Modifica', {timeout: 30000}, async () => {
  const page = await open();
  try {
    // Apre la sezione senza entrare in Modifica (stesso handler della fixture).
    await page.evaluate(() => document.querySelector('#full .collapsible-header').click());
    assert.equal(await page.getAttribute('#full', 'data-manage'), 'off', 'opening the section is not Modifica');
    const indicator = page.locator('#qr-on + .qr-mini-label');
    assert.equal(await indicator.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    // Clic reale alle coordinate dell'indicatore, senza attese di actionability.
    const box = await indicator.evaluate(node => { node.scrollIntoView({block: 'center'}); const r = node.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width}; });
    assert.ok(box.w > 0, 'indicator rendered');
    await page.mouse.click(box.x, box.y);
    assert.equal(await page.evaluate(() => document.getElementById('qr-on').checked), true, 'label must not toggle the hidden checkbox');
    assert.equal(await page.evaluate(() => window.qrSaves), 0, 'no preference change in consultation');
    await page.evaluate(() => document.querySelector('#full .manage-toggle').click());
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('qr-on')).display !== 'none'), true, 'checkbox shown in Modifica');
    await page.evaluate(() => document.getElementById('qr-on').click());
    assert.equal(await page.evaluate(() => document.getElementById('qr-on').checked), false);
    assert.equal(await page.evaluate(() => window.qrSaves), 1, 'explicit toggle still saves in Modifica');
  } finally { await page.close(); }
});

test('keyboard tab change and dynamic language application are handled', {timeout: 30000}, async () => {
  const page = await open();
  try {
    await page.locator('#full .manage-toggle').click();
    assert.equal(await page.getAttribute('#full', 'data-manage'), 'on');
    await page.locator('[data-probe="key-tab-a"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getAttribute('[data-probe="key-tab-b"]', 'aria-selected'), 'true');
    await page.waitForFunction(() => document.getElementById('full').dataset.manage === 'off');
    await page.evaluate(() => {
      document.querySelector('#full .manage-toggle-label').textContent = 'stale';
      document.dispatchEvent(new CustomEvent('app-language-applied', {detail: {language: 'it'}}));
    });
    assert.notEqual(await page.textContent('#full .manage-toggle-label'), 'stale', 'label refreshed from the document event');
  } finally { await page.close(); }
});
