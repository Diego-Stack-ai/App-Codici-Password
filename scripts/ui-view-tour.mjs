#!/usr/bin/env node
// Giro a schermo delle viste (#313). Per ogni pagina privata: stato iniziale, poi ogni comando
// premuto da solo (livello 1) e, dentro la vista che si apre, ogni nuovo comando (livello 2).
// In ogni stato i colori calcolati sono letti nelle 28 combinazioni (Nuova/Classica × 7 palette
// × chiaro/scuro) cambiando solo gli attributi di tema sul documento già aperto.
// Uso: node scripts/ui-view-tour.mjs [cartella-uscita] [pagine,separate,da,virgola] [--depth=1|2]
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createTourHarness, pages} from './lib/view-tour-harness.mjs';
import {allowed} from './audit-fixed-colors.mjs';

const outDir = path.resolve(process.argv[2] || 'view-tour-out');
const only = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3].split(',') : Object.keys(pages);
const depth = Number((process.argv.find(arg => arg.startsWith('--depth=')) || '--depth=2').slice(8));
const CLICKABLE = 'button, [role="button"], summary, .collapsible-header, [data-action], select, .custom-select-trigger, input[type="checkbox"], input[type="date"], a:not([href]), a[href^="#"]';

// Eseguita nella pagina: elenco dei comandi visibili.
const listClickables = selector => [...document.querySelectorAll(selector)].map((element, index) => {
  const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
  const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('[hidden], [inert]');
  const name = (element.getAttribute('aria-label') || element.title || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  return {index, visible, disabled: element.disabled === true, key: `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${[...element.classList].slice(0, 3).map(c => '.' + c).join('')}`, name};
});

// Eseguita nella pagina: colori di tutti gli elementi visibili nelle 28 combinazioni.
const capture = () => {
  const palettes = ['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'];
  const html = document.documentElement, body = document.body, hadRevision = body.hasAttribute('data-ui-revision');
  const original = {dark: html.classList.contains('dark'), palette: html.dataset.colorTheme, revision: body.getAttribute('data-ui-revision')};
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d', {willReadFrequently: true});
  const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const elements = [...body.querySelectorAll('*')].filter(element => {
    if (element.closest('script, style, canvas, svg, #qrcode-header, #qr-enlarged')) return false;
    const rect = element.getBoundingClientRect(); if (!rect.width || !rect.height) return false;
    for (let node = element; node; node = node.parentElement) { const s = getComputedStyle(node); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
    return true;
  });
  const label = element => `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${[...element.classList].slice(0, 8).map(c => '.' + c).join('')}`;
  const meta = elements.map(element => ({label: label(element), chain: (() => { const parts = []; for (let n = element; n && n !== body && parts.length < 8; n = n.parentElement) parts.push(label(n)); return parts.reverse().join(' > '); })(),
    hasText: [...element.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()), swatch: !!element.closest('[class*="swatch"], .color-theme-btn, input[type="color"]')}));
  const runs = {};
  for (const revision of hadRevision ? ['tre-livelli', 'classica'] : ['unica']) for (const theme of ['light', 'dark']) {
    if (hadRevision) body.setAttribute('data-ui-revision', revision);
    html.classList.toggle('dark', theme === 'dark');
    for (const palette of palettes) {
      html.dataset.colorTheme = palette;
      runs[`${revision}|${theme}|${palette}`] = elements.map(element => { const s = getComputedStyle(element);
        return [rgba(s.color), rgba(s.backgroundColor), parseFloat(s.borderTopWidth) > 0 ? rgba(s.borderTopColor) : null, s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 160) : null]; });
    }
  }
  html.classList.toggle('dark', original.dark); html.dataset.colorTheme = original.palette; if (hadRevision) body.setAttribute('data-ui-revision', original.revision);
  return {meta, runs};
};

const chroma = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
const hue = ([r, g, b]) => { const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min; if (!d) return 0;
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4; return (h * 60 + 360) % 360; };
const family = h => h < 15 || h >= 340 ? 'rosso' : h < 50 ? 'ambra' : h < 70 ? 'giallo' : h < 170 ? 'verde' : h < 255 ? 'blu' : 'viola';

// Colore cromatico identico in tutte e 7 le palette = non segue il tema.
function analyse({meta, runs}) {
  const flags = [];
  const groups = {};
  for (const key of Object.keys(runs)) { const [revision, theme] = key.split('|'); (groups[`${revision}|${theme}`] ??= []).push(runs[key]); }
  for (const [group, list] of Object.entries(groups)) {
    for (let i = 0; i < meta.length; i++) for (const [slot, prop] of [[0, 'color'], [1, 'background'], [2, 'border']]) {
      const values = list.map(run => run[i][slot]); if (values.some(v => !v) || values[0][3] < 0.15) continue;
      if (slot === 0 && !meta[i].hasText && !/material-symbols/.test(meta[i].label)) continue;
      if (chroma(values[0]) < 45 || meta[i].swatch) continue;
      if (!values.every(v => v.slice(0, 3).every((c, k) => Math.abs(c - values[0][k]) <= 2))) continue;
      const fam = family(hue(values[0]));
      const exception = allowed.find(item => item.pattern.test('.' + meta[i].chain.replace(/[#>\s]+/g, ' .'))) || null;
      flags.push({group, index: i, label: meta[i].label, chain: meta[i].chain, prop, family: fam, value: `rgb(${values[0].slice(0, 3).join(',')})`, exception: exception?.id || null});
    }
  }
  return flags;
}

await mkdir(outDir, {recursive: true});
const harness = await createTourHarness();
const report = [];
for (const file of only) {
  const entry = {page: file, states: [], links: [], notOpened: []};
  const visit = async (trail, level) => {
    const {page, context} = await harness.open(file);
    let navigated = null;
    page.on('framenavigated', frame => { if (frame === page.mainFrame() && !frame.url().includes('/' + file)) navigated = frame.url().split('/').pop().split('?')[0]; });
    try {
      let before = await page.evaluate(listClickables, CLICKABLE);
      let lastName = 'iniziale';
      for (const step of trail) {
        const target = before[step]; lastName = `${target.key} «${target.name}»`;
        const locator = page.locator(CLICKABLE).nth(step);
        try { await locator.click({timeout: 1500, force: false}); } catch { try { await locator.click({timeout: 1000, force: true}); } catch (error) { entry.notOpened.push({trail: lastName, reason: 'non cliccabile'}); return null; } }
        await page.waitForTimeout(350);
        if (navigated) { entry.links.push({from: lastName, to: navigated}); return null; }
        if (trail.indexOf(step) < trail.length - 1) before = await page.evaluate(listClickables, CLICKABLE);
      }
      const after = await page.evaluate(listClickables, CLICKABLE).catch(() => null);
      if (!after) { entry.links.push({from: lastName, to: navigated || 'documento cambiato'}); return null; }
      const data = await page.evaluate(capture);
      const flags = analyse(data);
      const errors = await page.evaluate(() => (window.__viewTour?.errors || []).slice(0, 3));
      const name = trail.length ? lastName : 'iniziale';
      const shot = `${file.replace('.html', '')}-${trail.join('_') || 'iniziale'}.png`;
      if (!trail.length || flags.some(flag => !flag.exception) || process.env.TOUR_ALL_SHOTS) await page.screenshot({path: path.join(outDir, shot)});
      entry.states.push({trail: [...trail], name, level, elements: data.meta.length, flags, errors, screenshot: shot});
      return {after, elements: data.meta.length, keys: new Set(data.meta.map(m => m.chain))};
    } finally { await context.close(); }
  };
  const initial = await visit([], 0);
  if (initial) {
    const first = initial.after.filter(c => c.visible && !c.disabled);
    for (const item of first) {
      const result = await visit([item.index], 1);
      if (!result || depth < 2) continue;
      // Livello 2: solo i comandi comparsi dopo il primo clic (dentro la vista aperta).
      const baseline = new Set(initial.after.filter(c => c.visible).map(c => c.key + '|' + c.name));
      const fresh = result.after.filter(c => c.visible && !c.disabled && !baseline.has(c.key + '|' + c.name)).slice(0, 10);
      for (const inner of fresh) await visit([item.index, inner.index], 2);
    }
  }
  const open = entry.states.flatMap(state => state.flags.filter(flag => !flag.exception));
  process.stdout.write(`${file}: stati ${entry.states.length}, collegamenti ${entry.links.length}, non aperti ${entry.notOpened.length}, colori fissi non ammessi ${new Set(open.map(f => f.chain + f.prop)).size}\n`);
  report.push(entry);
  await writeFile(path.join(outDir, 'view-tour.json'), JSON.stringify(report));
}
await harness.close();
const total = {states: 0, links: 0, notOpened: 0, open: new Set(), excepted: new Set()};
for (const entry of report) { total.states += entry.states.length; total.links += entry.links.length; total.notOpened += entry.notOpened.length;
  for (const state of entry.states) for (const flag of state.flags) (flag.exception ? total.excepted : total.open).add(`${entry.page}|${flag.chain}|${flag.prop}`); }
console.log(`Totale: ${report.length} pagine, ${total.states} stati × 28 combinazioni, ${total.links} collegamenti, ${total.notOpened} non aperti, colori fissi non ammessi ${total.open.size}, eccezioni ${total.excepted.size}`);
