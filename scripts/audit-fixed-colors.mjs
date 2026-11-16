#!/usr/bin/env node
// Censimento alla fonte (incarico #313, 15/11/2026): ogni dichiarazione CSS con un colore
// cromatico fisso, qualunque sia il selettore — anche viste generate dopo un clic, che la
// mappa statica non apre. Un colore fisso è ammesso solo se il selettore rientra nelle
// eccezioni decise da Diego: comandi che cancellano o fanno uscire, scorrimento predefinito,
// campioni delle palette, esiti ed errori.
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const cssRoot = fileURLToPath(new URL('../Frontend/public/assets/css/', import.meta.url));
export const allowed = [
  {id: 'comandi che cancellano o fanno uscire', pattern: /remove|delete|danger|logout|unlink|\.icon-red|btn-icon-cancel/},
  {id: 'scorrimento predefinito degli elenchi', pattern: /^\.account-card$|^\.deadline-card$|bg-restore|bg-delete/},
  {id: 'campioni delle sette palette', pattern: /swatch-/},
  {id: 'esiti ed errori', pattern: /is-error|is-success|is-valid|diagnostics-|backup-preview|credential-health|self-healing|image-editor-warning|portable-archive-status/},
  {id: 'scadenza scaduta (valutazione a vista di Diego)', pattern: /deadline-card-expired/}
];
const named = {red: [255, 0, 0], blue: [0, 0, 255], green: [0, 128, 0], orange: [255, 165, 0], yellow: [255, 255, 0], purple: [128, 0, 128]};
const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
const isPaletteDefinition = (selector, prop) => prop.startsWith('--') && /^(:root|html|\.dark)/.test(selector);

export async function auditFixedColors(root = cssRoot) {
  const found = [];
  for (const file of (await readdir(root)).filter(name => name.endsWith('.css')).sort()) {
    const text = (await readFile(path.join(root, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
    const rule = /([^{}]+)\{([^{}]*)\}/g; let match;
    while ((match = rule.exec(text))) {
      const selector = match[1].trim().replace(/\s+/g, ' ');
      const line = text.slice(0, match.index + match[1].length).split('\n').length;
      for (const declaration of match[2].split(';')) {
        const split = declaration.indexOf(':'); if (split < 0) continue;
        const prop = declaration.slice(0, split).trim(), value = declaration.slice(split + 1).trim();
        if (isPaletteDefinition(selector, prop)) continue;
        const colors = [];
        for (const hex of value.matchAll(/#([0-9a-f]{3,8})\b/gi)) { let digits = hex[1]; if (digits.length <= 4) digits = [...digits].map(c => c + c).join(''); colors.push([0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16))); }
        for (const rgb of value.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) colors.push([+rgb[1], +rgb[2], +rgb[3]]);
        for (const [name, rgb] of Object.entries(named)) if (new RegExp(`(^|[\\s,(])${name}([\\s,;)]|$)`).test(value)) colors.push(rgb);
        if (!colors.some(color => chroma(color) >= 40)) continue;
        const exception = allowed.find(item => item.pattern.test(selector));
        found.push({file, line, selector, prop, value, exception: exception?.id || null});
      }
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = await auditFixedColors();
  const open = found.filter(item => !item.exception);
  const byException = {};
  for (const item of found) byException[item.exception || 'NON AMMESSO'] = (byException[item.exception || 'NON AMMESSO'] || 0) + 1;
  console.log(`Colori fissi nelle regole CSS: ${found.length}`); console.table(byException);
  for (const item of open) console.log(`NON AMMESSO ${item.file}:${item.line} ${item.selector} { ${item.prop}: ${item.value} }`);
  process.exitCode = open.length ? 1 : 0;
}
