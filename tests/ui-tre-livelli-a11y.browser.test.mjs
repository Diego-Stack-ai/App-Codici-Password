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

// Registro verificabile, separato dalla mappa strutturale Graphify (che non indicizza i CSS).
// Ogni pagina mantiene i propri fogli nell'ordine HTML; la Ricerca è aggiunta come foglio lazy.
const colorContract = JSON.parse(await readFile(new URL('../scripts/ui-color-contract.json', import.meta.url), 'utf8'));
assert.ok(colorContract.components.length > 0, 'color registry is not empty');
assert.equal(new Set(colorContract.components.map(item => item.id)).size, colorContract.components.length, 'color case identifiers are unique');
test('color registry preserves the reviewed matrix and minimum coverage', () => {
  assert.equal(colorContract.schemaVersion, 1);
  assert.deepEqual(colorContract.palettes, ['', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose']);
  assert.deepEqual(colorContract.themes, ['light', 'dark']);
  assert.deepEqual(colorContract.pages, ['impostazioni.html', 'profilo_privato.html', 'dati_azienda.html']);
  for (const [id, minimum] of Object.entries({'settings-secondary': 4.5, 'settings-popup-secondary': 4.5, 'settings-icon': 3,
    'company-purple': 4.5, 'company-blue': 4.5, 'manage-pressed': 4.5, 'search-panel': 4.5, 'search-user-bubble': 4.5, 'search-microphone': 4.5})) {
    assert.ok(colorContract.components.some(item => item.id === id && item.minContrast >= minimum), `reviewed coverage cannot disappear or weaken: ${id}`);
  }
  for (const item of colorContract.components) {
    assert.ok(item.selector && item.markup && item.foregroundRole && item.backgroundRole, `${item.id}: complete color pair`);
    assert.ok(Number.isFinite(item.minContrast) && item.minContrast >= 3, `${item.id}: numeric minimum`);
    if (item.pages) assert.ok(item.pages.length > 0 && item.pages.every(file => colorContract.pages.includes(file)), `${item.id}: valid page subset`);
  }
});
const pageSources = new Map(await Promise.all(colorContract.pages.map(async file => [file, await readFile(path.join(publicRoot, file), 'utf8')])));
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
function colorFixture(file, theme, palette) {
  const source = pageSources.get(file);
  const links = [...source.matchAll(/<link\b[^>]*>/gi)].map(match => attributes(match[0])).filter(attr => attr.rel === 'stylesheet');
  assert.ok(links.length > 0, `${file}: real stylesheet stack exists`);
  const sheets = [...links.map(attr => attr.href), ...colorContract.lazyStylesheets];
  const body = attributes(source.match(/<body\b[^>]*>/i)[0]);
  const components = colorContract.components.filter(item => !item.pages || item.pages.includes(file));
  assert.ok(components.length > 0, `${file}: registered cases exist`);
  return `<!doctype html><html lang="it" class="${theme === 'dark' ? 'dark' : ''}" data-color-theme="${palette}"><head><meta charset="utf-8">${sheets.map(href => `<link rel="stylesheet" href="/${href}">`).join('')}</head>
    <body class="${body.class}" data-ui-model="${body['data-ui-model']}" data-ui-revision="tre-livelli">${components.map(item => `<section data-color-case="${item.id}">${item.markup}</section>`).join('')}</body></html>`;
}
async function openColorFixture(file, theme, palette) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.route(`${base}/colors.html`, route => route.fulfill({contentType: 'text/html', body: colorFixture(file, theme, palette)}));
  await page.goto(`${base}/colors.html`);
  return page;
}
async function readColorCases(page, file) {
  return page.evaluate(components => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const rgba = value => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const result = [...context.getImageData(0, 0, 1, 1).data];
      return [...result.slice(0, 3), result[3] / 255];
    };
    const roleColor = (element, role) => {
      if (role.startsWith('--') && !getComputedStyle(element).getPropertyValue(role).trim()) throw Error(`Missing color role: ${role}`);
      const probe = document.createElement('span');
      probe.style.color = role.startsWith('--') ? `var(${role})` : role;
      element.append(probe);
      const result = rgba(getComputedStyle(probe).color);
      probe.remove();
      return result;
    };
    return components.map(item => {
      const element = document.querySelector(`[data-color-case="${item.id}"] ${item.selector}`);
      if (!element) throw Error(`Missing color fixture: ${item.id}`);
      const style = getComputedStyle(element);
      let surface = element;
      while (surface && getComputedStyle(surface).backgroundImage === 'none' && rgba(getComputedStyle(surface).backgroundColor)[3] === 0) surface = surface.parentElement;
      if (!surface) throw Error(`Missing opaque surface: ${item.id}`);
      const paint = getComputedStyle(surface);
      // Registered gradients are opaque two-stop fills with white foreground. Both ends
      // are measured: selecting just the first stop would miss a reversed bright gradient.
      const stops = paint.backgroundImage === 'none' ? [rgba(paint.backgroundColor)]
        : [...paint.backgroundImage.matchAll(/(?:rgba?|color)\([^)]*\)/g)].map(match => rgba(match[0]));
      const ancestorsOpaque = [...(function* () { for (let node = element.parentElement; node; node = node.parentElement) yield node; })()].every(node => Number(getComputedStyle(node).opacity) === 1);
      return {id: item.id, foreground: rgba(style.color), stops, image: paint.backgroundImage,
        opacity: Number(style.opacity), ancestorsOpaque, foregroundRole: roleColor(element, item.foregroundRole), backgroundRole: roleColor(element, item.backgroundRole)};
    });
  }, colorContract.components.filter(item => !item.pages || item.pages.includes(file)));
}
const near = (a, b) => a.slice(0, 3).every((value, index) => Math.abs(value - b[index]) <= 1);
function verifyColorCases(values, label) {
  for (const value of values) {
    const item = colorContract.components.find(component => component.id === value.id);
    const name = `${label} ${item.id}`;
    assert.ok(value.ancestorsOpaque, `${name}: grouped ancestor opacity needs an explicit fixture`);
    assert.ok(value.stops.length > 0 && value.stops.every(stop => stop[3] === 1), `${name}: never treat transparent as black`);
    assert.ok(near(value.foreground, value.foregroundRole), `${name}: foreground uses ${item.foregroundRole}`);
    assert.ok(value.stops.some(stop => near(stop, value.backgroundRole)), `${name}: background uses ${item.backgroundRole}`);
    if (item.backgroundImage) assert.equal(value.image, item.backgroundImage, `${name}: no fixed legacy gradient`);
    if (value.image !== 'none') {
      assert.ok(value.image.startsWith('linear-gradient(') && value.stops.length === 2 && near(value.foreground, [255, 255, 255]), `${name}: unsupported gradient must not pass silently`);
    }
    const ratios = value.stops.map(bg => {
      const alpha = value.opacity * value.foreground[3];
      const fg = value.foreground.slice(0, 3).map((channel, index) => channel * alpha + bg[index] * (1 - alpha));
      return contrast(`rgb(${fg.join(',')})`, `rgb(${bg.slice(0, 3).join(',')})`);
    });
    assert.ok(Math.min(...ratios) >= item.minContrast, `${name}: effective contrast ${Math.min(...ratios).toFixed(3)} < ${item.minContrast}`);
  }
}
for (const theme of colorContract.themes) {
  test(`registered color pairs keep their roles and contrast on each real page stack in ${theme}`, {timeout: 120000}, async () => {
    for (const file of colorContract.pages) for (const palette of colorContract.palettes) {
      const page = await openColorFixture(file, theme, palette);
      try {
        const values = await readColorCases(page, file);
        assert.equal(values.length, colorContract.components.filter(item => !item.pages || item.pages.includes(file)).length, `${file}: no missing color samples`);
        verifyColorCases(values, `${file}/${palette || 'default'}/${theme}`);
      }
      finally { await page.close(); }
    }
  });
}
// Browser negatives reproduce the faults that motivated the contract. No app JS,
// accounts, external requests or production origin participate in these local checks.
for (const [name, file, brokenCss, expected] of [
  ['white on a bright accent', 'impostazioni.html', 'html body[data-ui-revision] .vault-assistant-bubble.user{background:var(--accent)!important}', /search-user-bubble/],
  ['extra secondary opacity', 'impostazioni.html', 'html body[data-ui-revision] .settings-desc{opacity:.7!important}', /settings-secondary.*effective contrast/],
  ['bright second gradient stop', 'dati_azienda.html', 'html body[data-ui-revision].company-profile-page .icon-purple{background:linear-gradient(135deg,var(--rev-fill),var(--accent))!important}', /company-purple.*effective contrast/],
  ['legacy search panel gradient', 'impostazioni.html', 'html body[data-ui-revision] .vault-assistant-panel{background-image:linear-gradient(white,white)!important}', /search-panel/],
]) {
  test(`color contract detects ${name}`, {timeout: 30000}, async () => {
    const page = await openColorFixture(file, 'dark', 'petrol');
    try {
      await page.addStyleTag({content: brokenCss});
      const values = await readColorCases(page, file);
      assert.throws(() => verifyColorCases(values, `${file}/petrol/dark`), expected);
    } finally { await page.close(); }
  });
}
