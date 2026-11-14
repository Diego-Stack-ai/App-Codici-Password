import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

// Registro delle decisioni cromatiche (Codex, #308, 14/11/2026): ogni gruppo «Tema» segue il
// ruolo della palette in entrambe le grafiche, ogni gruppo «Funzione» conserva il colore di
// stato. Pagine reali con i loro CSS, script esclusi, solo loopback.
const publicRoot = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const registry = JSON.parse(await readFile(new URL('../scripts/ui-color-decisions.json', import.meta.url), 'utf8'));
const palettes = ['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'];
const launchBrowser = () => chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});

function prepare(html, {theme, palette, revision}) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<body([^>]*)>/i, (match, attrs) => `<body${attrs.replace(/\s(hidden|inert)(?=[\s>])/g, '').replace(/data-ui-revision="[^"]*"/, `data-ui-revision="${revision}"`)}>`)
    .replace(/<html([^>]*)>/i, (match, attrs) => `<html${attrs.replace(/\s(class|data-color-theme)="[^"]*"/g, '')} class="${theme === 'dark' ? 'dark' : ''}" data-color-theme="${palette}">`);
}

let browser, server, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://fixture.invalid');
      const file = path.join(publicRoot, decodeURIComponent(url.pathname));
      if (!file.startsWith(publicRoot)) throw Error('outside');
      let body = await readFile(file);
      if (file.endsWith('.html')) body = prepare(body.toString(), Object.fromEntries(url.searchParams));
      res.writeHead(200, {'Content-Type': file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream'});
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser();
});
test.after(async () => { await browser?.close(); await new Promise(done => server?.close(done)); });

async function open(page, options) {
  const tab = await browser.newPage();
  await tab.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await tab.goto(`${base}/${page}?${new URLSearchParams(options)}`, {waitUntil: 'load'});
  await tab.addStyleTag({content: '*,*::before,*::after{transition:none!important;animation:none!important}'});
  return tab;
}

// Valore della proprietà sugli elementi e del ruolo, calcolato nello stesso contesto.
const read = (tab, selector, property, role) => tab.evaluate(([selector, property, role]) =>
  [...document.querySelectorAll(selector)].map(element => {
    const probe = document.createElement('span');
    if (property === 'backgroundImage') probe.style.backgroundImage = role.startsWith('--') ? `var(${role})` : role;
    else probe.style.color = role ? (role.startsWith('--') ? `var(${role})` : role) : '';
    element.append(probe);
    const expected = getComputedStyle(probe)[property === 'backgroundImage' ? 'backgroundImage' : 'color'];
    probe.remove();
    return {actual: getComputedStyle(element)[property], expected};
  }), [selector, property, role]);

function verifyTheme(values, group, label) {
  assert.equal(values.length, group.count, `${label} ${group.id}: ${group.count} elements present`);
  for (const value of values) assert.equal(value.actual, value.expected, `${label} ${group.id}: ${group.property} follows ${group.role}`);
}

const hueOf = color => {
  const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueOk = (color, hue) => { const h = hueOf(color); return h !== null && (hue === 'red' ? (h <= 12 || h >= 345) : (h >= 20 && h <= 50)); };

test('ordinary actions and selections keep soft Classica shadows in both graphics', {timeout: 180000}, async () => {
  for (const revision of ['tre-livelli', 'classica']) for (const theme of ['light', 'dark']) for (const palette of palettes) {
    const tab = await open('impostazioni.html', {theme, palette, revision});
    try {
      await tab.evaluate(() => {
        document.querySelector('#theme-settings-disclosure').open = true;
        for (const selector of ['.theme-btn[data-theme="dark"]', '.ui-graphics-btn[data-ui-graphics="classic"]', '.color-theme-btn[data-color-theme="red"]'])
          document.querySelector(selector).classList.add('active');
        // The dynamically created Vault input uses these actual shared classes.
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = '<div class="modal-box"><h3 class="modal-title">Sblocco Vault</h3><button id="modal-confirm-btn" class="btn-modal btn-primary">Conferma</button><button class="btn-modal btn-danger">Elimina</button></div>';
        document.body.append(overlay);
      });
      const values = await tab.evaluate(() => ({
        shadows: [...document.querySelectorAll('.theme-btn.active, .ui-graphics-btn.active, .color-theme-btn.active, #modal-confirm-btn')].map(element => getComputedStyle(element).boxShadow),
        overlayBlur: getComputedStyle(document.querySelector('.modal-overlay')).backdropFilter,
        danger: getComputedStyle(document.querySelector('.btn-modal.btn-danger')).boxShadow
      }));
      assert.equal(values.shadows.length, 4);
      for (const shadow of values.shadows) {
        const colors = [...shadow.matchAll(/rgba?\(([^)]+)\)/g)];
        const lengths = shadow.replace(/rgba?\([^)]+\)/g, '').match(/-?[\d.]+px/g)?.map(Number.parseFloat);
        assert.ok(colors.length && lengths?.length === 4, 'one painted shadow, not none or stacked glows');
        assert.ok(Number(colors[0][1].split(',')[3] ?? 1) <= 0.12, 'decorative alpha at most 12%');
        assert.ok(lengths[2] <= 10, 'decorative blur at most 10px');
      }
      assert.equal(values.overlayBlur, 'blur(8px)', 'original modal backdrop remains');
      assert.match(values.danger, /0\.3\).*20px/, 'danger indication stays independent');
    } finally { await tab.close(); }
  }
});

for (const revision of ['tre-livelli', 'classica']) for (const theme of ['light', 'dark']) {
  test(`theme groups follow the palette roles (${revision}, ${theme})`, {timeout: 240000}, async () => {
    for (const palette of palettes) {
      const pages = [...new Set(registry.theme.map(group => group.page))];
      for (const page of pages) {
        const tab = await open(page, {theme, palette, revision});
        try {
          for (const group of registry.theme.filter(item => item.page === page))
            verifyTheme(await read(tab, group.selector, group.property, group.role), group, `${page}/${palette}/${theme}/${revision}`);
        } finally { await tab.close(); }
      }
    }
  });

  test(`function groups keep their semantic color in every palette (${revision}, ${theme})`, {timeout: 240000}, async () => {
    const seen = new Map();
    for (const palette of palettes) for (const page of [...new Set(registry.function.map(group => group.page))]) {
      const tab = await open(page, {theme, palette, revision});
      try {
        for (const group of registry.function.filter(item => item.page === page)) {
          const values = await read(tab, group.selector, group.property, '--rev-icon');
          assert.equal(values.length, group.count || 1, `${group.id}: element present`);
          // Ogni pittura dichiarata (selettore esatto, proprietà, tinta), discendenti compresi.
          for (const [paintIndex, paint] of group.paints.entries()) if (!paint.revisions || paint.revisions.includes(revision)) for (const property of paint.properties) {
            const css = {color: 'color', bg: 'backgroundColor', border: 'borderTopColor'}[property];
            const actual = await tab.evaluate(([selector, css]) => [...document.querySelectorAll(selector)].map(element => getComputedStyle(element)[css]), [paint.selector, css]);
            assert.ok(actual.length > 0, `${group.id}: declared paint ${paint.selector} present`);
            for (const [index, value] of actual.entries()) {
              assert.ok(hueOk(value, paint.hue), `${page}/${palette}/${theme}/${revision} ${group.id} ${paint.selector} ${property}: keeps ${paint.hue} (${value})`);
              const key = `${group.id}|${paintIndex}|${property}|${index}`;
              if (!seen.has(key)) seen.set(key, value);
              assert.equal(value, seen.get(key), `${group.id} ${paint.selector}: identical in every palette`);
            }
          }
          for (const value of values) assert.notEqual(value.actual, value.expected, `${group.id}: not replaced by the palette icon role`);
        }
      } finally { await tab.close(); }
    }
  });
}

test('legal topic icons follow the palette; legal text untouched', {timeout: 120000}, async () => {
  for (const page of registry.legal.pages) for (const theme of ['light', 'dark']) for (const palette of palettes) {
    const tab = await open(page, {theme, palette, revision: ''});
    try {
      const values = await read(tab, registry.legal.selector, 'color', registry.legal[theme]);
      assert.equal(values.length, registry.legal.counts[page], `${page}: all topic icons classified`);
      for (const value of values) assert.equal(value.actual, value.expected, `${page}/${palette}/${theme}: topic icon follows the palette`);
    } finally { await tab.close(); }
  }
  const source = await readFile(path.join(publicRoot, 'privacy.html'), 'utf8');
  assert.match(source, /In sviluppo|in sviluppo|in_development|dev_notice/i, 'the Privacy development notice is still present');
});

// Negativi: ripristinare il colore fisso storico deve far fallire il gruppo.
for (const group of registry.theme) {
  test(`decision registry detects a fixed color restored on ${group.id}`, {timeout: 60000}, async () => {
    const tab = await open(group.page, {theme: 'dark', palette: 'petrol', revision: 'classica'});
    try {
      const fixed = group.property === 'backgroundImage' ? 'background-image:linear-gradient(135deg,rgba(16,185,129,.6),rgba(6,95,70,.4))!important' : 'color:#f59e0b!important';
      await tab.addStyleTag({content: `${group.selector}{${fixed}}`});
      assert.throws(() => verifyTheme([], group, 'probe'), /present/);
      const values = await read(tab, group.selector, group.property, group.role);
      assert.throws(() => verifyTheme(values, group, `negative ${group.page}`), /follows/);
    } finally { await tab.close(); }
  });
}
