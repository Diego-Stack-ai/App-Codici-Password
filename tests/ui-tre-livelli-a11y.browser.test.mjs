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

const css = ['core.css', 'core_fonts.css', 'core_fascie.css', 'core_ui.css', 'core_pagine.css', 'profile-layout.css', 'ui-tre-livelli.css', 'ui-tre-livelli-moduli.css']
  .map(file => `<link rel="stylesheet" href="/assets/css/${file}">`).join('');
const fixture = (theme, color) => `<!doctype html><html lang="it" class="${theme === 'dark' ? 'dark' : ''}"${color ? ` data-color-theme="${color}"` : ''}><head>${css}
  <style>body[data-ui-revision="tre-livelli"]{--page-symbol:'event'}</style></head>
  <body data-ui-revision="tre-livelli" data-ui-model="hub">
    <header class="base-header"><h1 class="header-title" id="title">Scadenze</h1></header>
    <div class="page-container">
      <section data-manage="off"><div class="field-header"><input type="checkbox" class="qr-checkbox" id="qr" checked><label class="qr-mini-label" id="qr-label" for="qr">QR</label></div></section>
      <button type="button" class="profile-account-primary" id="link">Apri Account collegato</button>
      <button type="button" class="profile-deadline-link" id="deadline">Vai alla scadenza</button>
      <a class="matrix-card card-orange area-scadenze"><span class="badge-count" id="warn">2</span></a>
      <a class="matrix-card card-red area-urgenze"><span class="badge-count" id="err">1</span></a>
      <div class="settings-item" id="card"><div class="settings-icon-box icon-purple" id="icon">x</div><span class="settings-desc" id="desc">Descrizione</span></div>
      <div class="modal-box" id="popup"><span class="settings-desc" id="popup-desc">Testo</span></div>
    </div>
  </body></html>`;

let browser, server, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://fixture.invalid');
      if (url.pathname === '/fixture.html') { res.writeHead(200, {'Content-Type': 'text/html'}); res.end(fixture(url.searchParams.get('theme'), url.searchParams.get('color'))); return; }
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

async function open(theme = 'light', color = '') {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(`${base}/fixture.html?theme=${theme}&color=${color}`);
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
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('qr-label'), '::before').content !== 'none'), true, 'QR indicator icon rendered in consultation');
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
  // color-mix() può essere serializzato come color(srgb r g b) con canali 0–1.
  const channels = value => { const n = value.match(/\d*\.?\d+(e-?\d+)?/g).map(Number); return value.startsWith('color(') ? n.slice(0, 3) : n.slice(0, 3).map(v => v / 255); };
  const lum = rgb => { const c = channels(rgb).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
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

// Ventaglio tonale (13/11/2026): per ognuno dei 7 colori, in chiaro e in scuro, con i fogli REALI
// di Impostazioni, Profilo azienda e Ricerca. Il secondario compone l'opacità effettiva; i
// riempimenti pieni con testo bianco (bolla utente, microfono, pastiglie azienda, Modifica premuto)
// restano ≥ 4,5:1; il pannello Ricerca segue il colore anche in scuro.
const realCss = ['core.css', 'core_fonts.css', 'core_fascie.css', 'core_ui.css', 'impostazioni.css', 'dati_azienda.css',
  'ui-tre-livelli.css', 'ui-tre-livelli-moduli.css', 'vault-assistant.css']
  .map(file => `<link rel="stylesheet" href="/assets/css/${file}">`).join('');
const fanFixture = (theme, color) => `<!doctype html><html lang="it" class="${theme === 'dark' ? 'dark' : ''}"${color ? ` data-color-theme="${color}"` : ''}><head>${realCss}</head>
  <body class="company-profile-page" data-ui-revision="tre-livelli">
    <div class="settings-item" id="card"><div class="settings-icon-box icon-purple" id="icon">x</div><span class="settings-desc" id="desc">Descrizione</span></div>
    <div class="modal-box" id="popup"><span class="settings-desc" id="popup-desc">Testo</span></div>
    <div class="settings-icon-box icon-purple" id="company-purple">x</div><div class="settings-icon-box icon-blue" id="company-blue">x</div>
    <button type="button" class="manage-toggle" aria-pressed="true" id="toggle">Fine</button>
    <div class="vault-assistant-panel" id="panel"><div class="vault-assistant-bubble user" id="bubble">Domanda</div>
      <button type="button" class="vault-assistant-microphone" id="mic">m</button></div>
  </body></html>`;
const blend = (fg, bg, alpha) => {
  const parse = value => { const n = value.match(/\d*\.?\d+(e-?\d+)?/g).map(Number); return value.startsWith('color(') ? n.slice(0, 3).map(v => v * 255) : n.slice(0, 3); };
  const [f, b] = [parse(fg), parse(bg)];
  return `rgb(${f.map((v, i) => v * alpha + b[i] * (1 - alpha)).join(', ')})`;
};
const palettes = ['', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'];
for (const theme of ['light', 'dark']) {
  test(`tonal fan keeps real cards, popups, fills and icons readable for every palette in ${theme} theme`, {timeout: 90000}, async () => {
    for (const color of palettes) {
      const page = await browser.newPage();
      await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      await page.route(`${base}/fan.html`, route => route.fulfill({contentType: 'text/html', body: fanFixture(theme, color)}));
      await page.goto(`${base}/fan.html`);
      try {
        const read = await page.evaluate(() => {
          const st = id => getComputedStyle(document.getElementById(id));
          const pick = id => ({fg: st(id).color, bg: st(id).backgroundColor, image: st(id).backgroundImage, opacity: Number(st(id).opacity)});
          return {card: st('card').backgroundColor, desc: pick('desc'), popup: st('popup').backgroundColor, popupDesc: pick('popup-desc'),
            icon: pick('icon'), purple: pick('company-purple'), blue: pick('company-blue'), toggle: pick('toggle'),
            bubble: pick('bubble'), mic: pick('mic'), panel: pick('panel')};
        });
        const label = `${color || 'default'} ${theme}`;
        // Il gradiente usa due tappe di --rev-fill: la più chiara è il primo colore del gradiente.
        const fill = item => item.image !== 'none' ? item.image.match(/(rgb|color)\([^)]*\)/)[0] : item.bg;
        assert.notEqual(read.card, 'rgb(255, 255, 255)', `${label}: card tinted, not plain white`);
        assert.ok(contrast(blend(read.desc.fg, read.card, read.desc.opacity), read.card) >= 4.5, `${label}: secondary text (with opacity) on card`);
        assert.ok(contrast(blend(read.popupDesc.fg, read.popup, read.popupDesc.opacity), read.popup) >= 4.5, `${label}: secondary text on popup`);
        assert.ok(contrast(read.icon.fg, read.icon.bg) >= 3, `${label}: icon on its chip ${contrast(read.icon.fg, read.icon.bg).toFixed(2)}`);
        for (const key of ['purple', 'blue', 'toggle', 'bubble', 'mic']) {
          const ratio = contrast(read[key].fg, fill(read[key]));
          assert.ok(ratio >= 4.5, `${label}: white on ${key} fill ${ratio.toFixed(2)}`);
        }
        assert.equal(read.panel.image, 'none', `${label}: Ricerca panel no longer keeps the fixed blue gradient`);
      } finally { await page.close(); }
    }
  });
}
