#!/usr/bin/env node
// Mappa visiva (13/11/2026): apre ogni pagina statica dell'app in locale, nei 7 colori ×
// chiaro/scuro, legge i valori CALCOLATI dal browser (colori, sfondi, bordi, caratteri) e segnala:
//  - elementi con un colore cromatico identico in tutte le palette → non seguono il tema
//    (rosso/arancio/ambra/verde fissi sono elencati a parte come probabili colori di stato);
//  - testi sotto il contrasto minimo (4,5:1; 3:1 per testo grande);
//  - dimensioni del carattere fuori dalla scala --fs-*.
// Solo loopback, nessuno script dell'app eseguito, nessuna rete esterna, nessun dato reale.
// Limite: le pagine che costruiscono i contenuti via JS dopo il login risultano parziali.
// Uso: node scripts/visual-map.mjs [cartella-uscita] [pagine separate da virgola]
import {createServer} from 'node:http';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';

// VISUAL_MAP_ROOT permette di provare lo strumento su pagine sintetiche, fuori dall'app.
const root = process.env.VISUAL_MAP_ROOT ? path.resolve(process.env.VISUAL_MAP_ROOT) + path.sep
  : fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const outDir = path.resolve(process.argv[2] || 'visual-map-out');
const palettes = ['', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'];
const paletteName = {'': 'Blu', green: 'Verde', red: 'Rosso', sand: 'Sabbia', petrol: 'Petrolio', lavender: 'Lavanda', 'dusty-rose': 'Rosa antico'};
const themes = ['light', 'dark'];
const types = {'.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json'};

const pages = process.argv[3] ? process.argv[3].split(',')
  : (await readdir(root)).filter(file => file.endsWith('.html')).sort();

function prepare(html, theme, palette) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?refresh[^>]*>/gi, '')
    .replace(/<body([^>]*)>/i, (match, attrs) => `<body${attrs.replace(/\s(hidden|inert)(?=[\s>])/g, '')}>`)
    .replace(/<html([^>]*)>/i, (match, attrs) => {
      // Conserva le classi della pagina (es. protocol-forced-dark), sostituisce solo il tema;
      // data-i18n="ready" perché senza script la pagina resterebbe nello stato di caricamento.
      const kept = (attrs.match(/\sclass="([^"]*)"/)?.[1] || '').split(/\s+/).filter(name => name && name !== 'dark');
      const rest = attrs.replace(/\s(class|data-i18n|data-color-theme)="[^"]*"/g, '');
      const classes = [...kept, ...(theme === 'dark' ? ['dark'] : [])].join(' ');
      return `<html${rest} class="${classes}" data-i18n="ready"${palette ? ` data-color-theme="${palette}"` : ''}>`;
    });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local.invalid');
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) throw Error('outside');
    let body = await readFile(file);
    const ext = path.extname(file);
    if (ext === '.html') body = prepare(body.toString(), url.searchParams.get('theme'), url.searchParams.get('palette') || '');
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless: true,
  ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH}
    : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});

// Raccolta nel browser: un record per elemento visibile, nell'ordine del DOM (stabile tra palette).
function collect() {
  const parse = value => {
    if (!value || value === 'transparent') return null;
    const n = value.match(/-?\d*\.?\d+(e-?\d+)?/g)?.map(Number);
    if (!n || n.length < 3) return null;
    const srgb = value.startsWith('color(');
    const rgb = (srgb ? n.slice(0, 3).map(v => v * 255) : n.slice(0, 3)).map(v => Math.round(v));
    const alpha = srgb ? (value.includes('/') ? n[3] : 1) : (n.length > 3 ? n[3] : 1);
    return {rgb, alpha};
  };
  const firstStop = image => { const m = image && image !== 'none' && image.match(/(rgba?|color)\([^)]*\)/); return m ? parse(m[0]) : null; };
  const over = (top, bottom) => top.rgb.map((v, i) => v * top.alpha + bottom[i] * (1 - top.alpha));
  // Compositing come il browser (sorgente-sopra), dalla radice al testo: ogni antenato
  // dipinge il proprio sfondo sopra ciò che ha dietro, poi il suo gruppo (sfondo + figli)
  // si mescola al retro con la sua opacità: o·contenuto + (1−o)·retro. Così un contenitore
  // semitrasparente con superficie propria attenua sia lo sfondo sia il testo (rilievo
  // Codex 14/11: nero a opacità 0,52 sul bianco → sfondo 122,4, testo bianco 4,27:1).
  const composite = (element, ink) => {
    const chain = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) chain.unshift(node);
    const paint = (i, backdrop) => {
      const style = getComputedStyle(chain[i]);
      const layer = firstStop(style.backgroundImage) || parse(style.backgroundColor);
      let inner = layer && layer.alpha > 0 ? over(layer, backdrop) : backdrop;
      inner = i === chain.length - 1 ? (ink ? over(ink, inner) : inner) : paint(i + 1, inner);
      const o = Number(style.opacity);
      return inner.map((v, c) => v * o + backdrop[c] * (1 - o));
    };
    return paint(0, [255, 255, 255]).map(v => Math.round(v * 10) / 10);
  };
  const probe = document.createElement('span');
  document.body.append(probe);
  const scale = ['micro', 'xs', 'sm', 'base', 'md', 'lg', 'xl'].map(name => {
    probe.style.fontSize = `var(--fs-${name})`; return Math.round(parseFloat(getComputedStyle(probe).fontSize) * 10) / 10;
  }).filter(Number.isFinite);
  probe.remove();
  const label = element => {
    const cls = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '') + (cls ? `.${cls}` : '');
  };
  const records = [];
  let index = 0;
  for (const element of document.body.querySelectorAll('*')) {
    const own = index++;
    if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'BR'].includes(element.tagName)) continue;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    // Opacità effettiva = prodotto delle opacità dell'elemento e degli antenati (rilievo Codex 14/11).
    let groupOpacity = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) groupOpacity *= Number(getComputedStyle(node).opacity);
    if (!rect.width || !rect.height || style.visibility !== 'visible' || style.display === 'none' || groupOpacity === 0) continue;
    const text = [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
    const bg = firstStop(style.backgroundImage) || parse(style.backgroundColor);
    const border = parseFloat(style.borderTopWidth) > 0 ? parse(style.borderTopColor) : null;
    if (!text && !(bg && bg.alpha > 0.05) && !(border && border.alpha > 0.05)) continue;
    records.push({index: own, label: label(element), text,
      color: text ? parse(style.color)?.rgb : null, colorAlpha: text ? (parse(style.color)?.alpha ?? 1) : 1, bg: bg && bg.alpha > 0.05 ? bg.rgb : null,
      border: border && border.alpha > 0.05 ? border.rgb : null,
      // Colori effettivi nel punto del testo: sfondo senza testo e testo sopra, entrambi composti.
      effectiveBg: text ? composite(element, null) : null, effectiveFg: text ? composite(element, parse(style.color)) : null,
      opacity: groupOpacity, fontSize: Math.round(parseFloat(style.fontSize) * 10) / 10,
      fontWeight: Number(style.fontWeight), fontFamily: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      icon: /material-symbols/.test(element.className || '')});
  }
  return {records, scale, title: document.title};
}

const luminance = rgb => { const c = rgb.map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hue = ([r, g, b]) => {
  const [R, G, B] = [r / 255, g / 255, b / 255], max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  if (!d) return {h: 0, chroma: 0};
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return {h: (h * 60 + 360) % 360, chroma: d * 255};
};
// Rosso, arancio, ambra e verde fissi: probabili colori di stato (successo, avviso, errore).
const statusHue = h => h < 50 || h >= 340 || (h >= 85 && h < 170);
const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

const report = [];
await mkdir(outDir, {recursive: true});
for (const page of pages) {
  const perPage = {page, themes: {}};
  try {
  for (const theme of themes) {
    const runs = {};
    for (const palette of palettes) {
      const tab = await browser.newPage({viewport: {width: 390, height: 844}});
      await tab.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
      await tab.goto(`${base}/${page}?theme=${theme}&palette=${palette}`, {waitUntil: 'load'});
      await tab.evaluate(() => document.fonts?.ready);
      runs[palette] = await tab.evaluate(collect);
      if (palette === 'green') runs.__tab = tab; else await tab.close();
    }
    const byIndex = new Map();
    for (const palette of palettes) for (const record of runs[palette].records) {
      if (!byIndex.has(record.index)) byIndex.set(record.index, {});
      byIndex.get(record.index)[palette] = record;
    }
    const fixed = [], status = [], lowContrast = [], offScale = [];
    const scale = runs[''].scale;
    for (const [index, variants] of byIndex) {
      const ref = variants[''];
      if (!ref || Object.keys(variants).length !== palettes.length) continue;
      // I campioni del selettore colori mostrano di proposito ogni palette.
      const swatch = /swatch/.test(ref.label);
      for (const prop of ['bg', 'color', 'border']) {
        const values = palettes.map(p => variants[p][prop]);
        if (values.some(v => !v)) continue;
        const same = values.every(v => v.every((c, i) => Math.abs(c - values[0][i]) <= 2));
        const {h, chroma} = hue(values[0]);
        if (!same || chroma < 40 || swatch) continue;
        const item = {index, label: ref.label, prop, value: hex(values[0])};
        (statusHue(h) ? status : fixed).push(item);
      }
      for (const palette of palettes) {
        const record = variants[palette];
        if (!record.text || !record.effectiveFg || !record.effectiveBg) continue;
        // Testo grande e icone (Material Symbols) richiedono 3:1, il testo ordinario 4,5:1.
        const large = record.icon || record.fontSize >= 24 || (record.fontSize >= 18.6 && record.fontWeight >= 700);
        // Testo e sfondo sono già composti nel browser (alpha del testo e opacità di gruppo).
        const ratio = contrast(record.effectiveFg, record.effectiveBg);
        if (ratio < (large ? 3 : 4.5)) lowContrast.push({index, label: record.label, palette: paletteName[palette], ratio: Math.round(ratio * 100) / 100,
          color: hex(record.effectiveFg), bg: hex(record.effectiveBg)});
      }
      if (ref.text && !ref.icon && !scale.some(size => Math.abs(size - ref.fontSize) < 0.6)) offScale.push({index, label: ref.label, fontSize: ref.fontSize, fontFamily: ref.fontFamily});
    }
    // Schermata verde con evidenziati: magenta = non segue il tema, arancio = contrasto basso.
    const tab = runs.__tab;
    const mark = (indexes, colour) => tab.evaluate(({indexes, colour}) => {
      const all = document.body.querySelectorAll('*');
      for (const i of indexes) { const el = all[i]; if (el) el.style.outline = `3px solid ${colour}`; }
    }, {indexes, colour});
    await mark([...new Set(lowContrast.filter(item => item.palette === 'Verde').map(item => item.index))], '#ff8c00');
    await mark([...new Set(fixed.map(item => item.index))], '#ff00ff');
    const shot = `${page.replace('.html', '')}-${theme}-verde.png`;
    await tab.screenshot({path: path.join(outDir, shot), fullPage: true});
    await tab.close();
    const dedupe = list => [...new Map(list.map(item => [`${item.index}|${item.prop || ''}|${item.palette || ''}`, item])).values()];
    perPage.themes[theme] = {elements: byIndex.size, fixed: dedupe(fixed), status: dedupe(status), lowContrast: dedupe(lowContrast),
      offScale: dedupe(offScale), scale, screenshot: shot};
  }
  } catch (error) {
    // Pagina che cambia da sola (redirect) o non analizzabile senza script: la si segnala e si prosegue.
    process.stdout.write(`${page}: non analizzata (${String(error.message).split('\n')[0].slice(0, 80)})\n`);
    for (const open of browser.contexts().flatMap(context => context.pages())) await open.close().catch(() => {});
    continue;
  }
  report.push(perPage);
  process.stdout.write(`${page}: fissi ${perPage.themes.light.fixed.length}/${perPage.themes.dark.fixed.length}, ` +
    `contrasto ${perPage.themes.light.lowContrast.length}/${perPage.themes.dark.lowContrast.length}, ` +
    `caratteri ${perPage.themes.light.offScale.length}\n`);
}
await browser.close();
server.close();

await writeFile(path.join(outDir, 'visual-map.json'), JSON.stringify(report, null, 1));
const esc = value => String(value).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const swatch = value => `<span style="display:inline-block;width:12px;height:12px;border:1px solid #999;background:${value};vertical-align:middle"></span> ${value}`;
const rows = (list, cols) => list.length ? `<table><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr>${list.map(item =>
  `<tr>${cols.map(c => `<td>${c[1](item)}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="ok">Nessuno</p>';
// Unità esplicite (rilievo Codex): elementi unici, coppie elemento × tema, occorrenze × palette.
const totals = {fixedUnique: new Set(), fixedPairs: 0, lowUnique: new Set(), lowPairs: new Set(), lowOccurrences: 0, font: 0};
for (const p of report) {
  for (const t of themes) {
    for (const item of p.themes[t].fixed) { totals.fixedUnique.add(`${p.page}|${item.index}`); totals.fixedPairs++; }
    for (const item of p.themes[t].lowContrast) { totals.lowUnique.add(`${p.page}|${item.index}`); totals.lowPairs.add(`${p.page}|${t}|${item.index}`); totals.lowOccurrences++; }
  }
  totals.font += p.themes.light.offScale.length;
}
const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mappa visiva</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2430;--muted:#5b6474;--line:#d9dde4}
@media (prefers-color-scheme:dark){:root{--bg:#161a21;--fg:#e8ebf0;--muted:#a3abb8;--line:#333a46}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif;max-width:1100px}
h1{font-size:22px}h2{font-size:18px;margin-top:32px;border-top:1px solid var(--line);padding-top:16px}h3{font-size:15px}
table{border-collapse:collapse;width:100%;margin:6px 0 14px;font-size:13px}td,th{border:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.ok{color:var(--muted)}.legend{color:var(--muted)}img{max-width:200px;border:1px solid var(--line);margin-right:8px}
.scroll{overflow-x:auto}</style></head><body>
<h1>Mappa visiva — grafica Nuova</h1>
<p>${report.length} pagine × 7 colori × chiaro/scuro. <b>Non seguono il tema</b>: ${totals.fixedUnique.size} elementi unici (${totals.fixedPairs} proprietà × tema). <b>Contrasto basso</b>: ${totals.lowUnique.size} elementi unici, ${totals.lowPairs.size} coppie elemento × tema, ${totals.lowOccurrences} occorrenze contando le palette. <b>Fuori scala</b>: ${totals.font} testi.</p>
<p class="legend">Schermate nel colore Verde: <b style="color:#ff00ff">magenta</b> = colore fisso che non segue il tema; <b style="color:#ff8c00">arancio</b> = contrasto basso. I colori fissi rosso/arancio/ambra/verde sono elencati a parte come probabili colori di stato. Pagine con contenuti costruiti dopo il login: copertura parziale.</p>
<p class="legend"><b>Limiti</b>: solo viewport 390×844; pannelli, modali e dettagli chiusi non vengono aperti; niente stati hover/focus, pseudo-elementi, placeholder o SVG; sui gradienti si misura il primo colore; la tinta non stabilisce la funzione (un verde fisso può essere decorativo). I conteggi sono coppie elemento × tema × palette, non guasti confermati: confrontare i giri con la stessa unità.</p>
${report.map(p => `<h2>${esc(p.page)}</h2>
<p><img src="${p.themes.light.screenshot}" alt="${esc(p.page)} chiaro"><img src="${p.themes.dark.screenshot}" alt="${esc(p.page)} scuro"></p>
${themes.map(t => `<h3>${t === 'light' ? 'Chiaro' : 'Scuro'} — non seguono il tema (${p.themes[t].fixed.length})</h3><div class="scroll">${rows(p.themes[t].fixed, [['Elemento', i => esc(i.label)], ['Proprietà', i => i.prop], ['Colore fisso', i => swatch(i.value)]])}</div>
<h3>${t === 'light' ? 'Chiaro' : 'Scuro'} — contrasto basso (${p.themes[t].lowContrast.length})</h3><div class="scroll">${rows(p.themes[t].lowContrast.slice(0, 40), [['Elemento', i => esc(i.label)], ['Colore', i => i.palette], ['Rapporto', i => i.ratio], ['Testo', i => swatch(i.color)], ['Sfondo', i => swatch(i.bg)]])}</div>
<details><summary>${t === 'light' ? 'Chiaro' : 'Scuro'} — colori di stato fissi (${p.themes[t].status.length})</summary>${rows(p.themes[t].status, [['Elemento', i => esc(i.label)], ['Proprietà', i => i.prop], ['Colore', i => swatch(i.value)]])}</details>`).join('')}
<h3>Caratteri fuori scala (${p.themes.light.offScale.length}) — scala: ${p.themes.light.scale.join(' / ')} px</h3><div class="scroll">${rows(p.themes.light.offScale, [['Elemento', i => esc(i.label)], ['Dimensione', i => i.fontSize + ' px'], ['Famiglia', i => esc(i.fontFamily)]])}</div>`).join('')}
</body></html>`;
await writeFile(path.join(outDir, 'index.html'), html);
console.log(`Rapporto: ${path.join(outDir, 'index.html')}`);
