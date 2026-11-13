import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

// Interruttore «Grafica: Nuova / Classica»: preferenza locale applicata da theme-init.js
// prima della visualizzazione; in Classica nessuna regola a tre livelli e nessun «Modifica».
const publicRoot = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const launchBrowser = () => chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});

const fixture = `<!doctype html><html lang="it"><head><script src="/assets/js/theme-init.js"></script></head>
  <body data-ui-revision="tre-livelli">
    <div class="form-section" data-manageable id="s"><div class="form-section-header"><h3 class="form-section-title">Contatti</h3></div></div>
    <script type="module">
      import {installManageMode} from '/assets/js/modules/shared/manage-mode.js';
      installManageMode(document); window.ready = true;
    </script>
  </body></html>`;

let browser, server, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://fixture.invalid').pathname;
      if (pathname === '/fixture.html') { res.writeHead(200, {'Content-Type': 'text/html'}); res.end(fixture); return; }
      const file = path.join(publicRoot, decodeURIComponent(pathname));
      if (!file.startsWith(publicRoot)) throw Error('outside');
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/javascript';
      res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'}); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser();
});
test.after(async () => { await browser?.close(); await new Promise(done => server?.close(done)); });

async function open(file, graphics) {
  const context = await browser.newContext({serviceWorkers: 'block'});
  await context.addInitScript(value => { if (value) localStorage.setItem('ui_graphics', value); }, graphics);
  const page = await context.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(`${base}/${file}`, {waitUntil: 'domcontentloaded'});
  return {page, context};
}

test('default «Nuova» keeps the three-level revision and installs Modifica', {timeout: 30000}, async () => {
  const {page, context} = await open('fixture.html', null);
  try {
    await page.waitForFunction(() => window.ready === true);
    assert.equal(await page.getAttribute('body', 'data-ui-revision'), 'tre-livelli');
    assert.equal(await page.locator('.manage-toggle').count(), 1);
  } finally { await context.close(); }
});

test('«Classica» removes the revision before display and installs no Modifica', {timeout: 30000}, async () => {
  const {page, context} = await open('fixture.html', 'classic');
  try {
    await page.waitForFunction(() => window.ready === true);
    assert.equal(await page.getAttribute('html', 'data-ui-graphics'), 'classic');
    assert.equal(await page.getAttribute('body', 'data-ui-revision'), null);
    assert.equal(await page.locator('.manage-toggle').count(), 0);
    assert.equal(await page.getAttribute('#s', 'data-manage'), null, 'no hidden management state');
  } finally { await context.close(); }
});

test('«Classica» applies to a real migrated page before any script reveals it', {timeout: 30000}, async () => {
  const {page, context} = await open('profilo_privato.html', 'classic');
  try {
    assert.equal(await page.evaluate(() => document.body.hasAttribute('data-ui-revision')), false);
    assert.equal(await page.evaluate(() => document.body.hidden), true, 'private page still hidden by the auth gate');
  } finally { await context.close(); }
});
