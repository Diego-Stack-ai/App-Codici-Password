import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

// Revisione UI a tre livelli: le icone decorative generate dal CSS non entrano nel nome
// accessibile (albero AX reale di Chromium via CDP) e i contatori di stato hanno contrasto ≥ 4,5:1.
const publicRoot = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const launchBrowser = () => chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});

const css = ['core.css', 'core_fonts.css', 'core_fascie.css', 'core_ui.css', 'core_pagine.css', 'profile-layout.css', 'ui-tre-livelli.css']
  .map(file => `<link rel="stylesheet" href="/assets/css/${file}">`).join('');
const fixture = theme => `<!doctype html><html lang="it" class="${theme === 'dark' ? 'dark' : ''}"><head>${css}
  <style>body[data-ui-revision="tre-livelli"]{--page-symbol:'event'}</style></head>
  <body data-ui-revision="tre-livelli" data-ui-model="hub">
    <header class="base-header"><h1 class="header-title" id="title">Scadenze</h1></header>
    <div class="page-container">
      <div class="field-header" data-manage="off"><input type="checkbox" class="qr-checkbox" id="qr" checked><label class="qr-mini-label" for="qr">QR</label></div>
      <button type="button" class="profile-account-primary" id="link">Apri Account collegato</button>
      <button type="button" class="profile-deadline-link" id="deadline">Vai alla scadenza</button>
      <a class="matrix-card card-orange area-scadenze"><span class="badge-count" id="warn">2</span></a>
      <a class="matrix-card card-red area-urgenze"><span class="badge-count" id="err">1</span></a>
    </div>
  </body></html>`;

let browser, server, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://fixture.invalid');
      if (url.pathname === '/fixture.html') { res.writeHead(200, {'Content-Type': 'text/html'}); res.end(fixture(url.searchParams.get('theme'))); return; }
      const file = path.join(publicRoot, decodeURIComponent(url.pathname));
      if (!file.startsWith(publicRoot)) throw Error('outside');
      res.writeHead(200, {'Content-Type': file.endsWith('.css') ? 'text/css' : 'application/octet-stream'}); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser();
});
test.after(async () => { await browser?.close(); await new Promise(done => server?.close(done)); });

async function open(theme = 'light') {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(`${base}/fixture.html?theme=${theme}`);
  return page;
}

async function axNames(page) {
  const cdp = await page.context().newCDPSession(page);
  const {nodes} = await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter(node => !node.ignored).map(node => ({role: node.role?.value, name: node.name?.value || ''}));
}

test('decorative CSS icons never enter accessible names (AX tree)', {timeout: 30000}, async () => {
  const page = await open();
  try {
    // Le icone sono davvero renderizzate (B/C, link, QR): la verifica non è vacua.
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('title'), '::before').content !== 'none'), true, 'symbol rendered next to the title');
    const nodes = await axNames(page);
    const heading = nodes.find(node => node.role === 'heading');
    assert.equal(heading?.name, 'Scadenze');
    assert.equal(nodes.find(node => node.role === 'button' && /Account/.test(node.name))?.name, 'Apri Account collegato');
    assert.equal(nodes.find(node => node.role === 'button' && /scadenza/.test(node.name))?.name, 'Vai alla scadenza');
    const ligatures = ['event', 'link', 'chevron_right', 'qr_code_2'];
    assert.deepEqual(nodes.filter(node => ligatures.some(word => node.name.includes(word))), [], 'no ligature text in the AX tree');
  } finally { await page.close(); }
});

const contrast = (fg, bg) => {
  const lum = rgb => { const c = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

for (const theme of ['light', 'dark']) {
  test(`status counters reach 4.5:1 in ${theme} theme`, {timeout: 30000}, async () => {
    const page = await open(theme);
    try {
      for (const id of ['warn', 'err']) {
        const {color, background} = await page.evaluate(target => { const style = getComputedStyle(document.getElementById(target)); return {color: style.color, background: style.backgroundColor}; }, id);
        assert.ok(contrast(color, background) >= 4.5, `${id} ${theme}: ${color} on ${background} = ${contrast(color, background).toFixed(2)}`);
      }
    } finally { await page.close(); }
  });
}
