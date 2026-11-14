import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

// Mappa visiva: il contrasto deve corrispondere al compositing del browser, senza falsi PASS
// e senza falsi allarmi sulle sfumature (colore calcolato nel punto del testo).
// Pagina sintetica in loopback, nessuno script dell'app, nessuna rete esterna.
const run = promisify(execFile);
const tool = fileURLToPath(new URL('../scripts/visual-map.mjs', import.meta.url));
const page = `<!doctype html><html lang="it"><head><meta charset="utf-8"></head><body style="background:#fff;margin:0">
  <p id="alpha" style="color:rgba(0,0,0,.3)">Testo con alpha 0,3</p>
  <div style="opacity:0"><p id="hidden" style="color:#000">Figlio di un gruppo invisibile</p></div>
  <div style="opacity:.3"><p id="faded" style="color:#000">Figlio di un gruppo attenuato</p></div>
  <div style="background:#000;opacity:.52"><span id="group" style="color:#fff;font-size:16px;font-weight:400">Gruppo con superficie propria</span></div>
  <p id="solid" style="color:#000">Testo pieno</p>
  <style>@keyframes vm-fade{from{opacity:.15}to{opacity:1}}</style>
  <p id="animated" style="color:#000;animation:vm-fade 60s linear">Testo con animazione di comparsa</p>
  <div style="height:1000px;position:relative;background:linear-gradient(to bottom,#fff,#000)">
    <p id="grad-top" style="position:absolute;top:0;margin:0;color:#fff">Bianco in alto, su fondo chiaro</p>
    <p id="grad-bottom" style="position:absolute;bottom:0;margin:0;color:#fff">Bianco in basso, su fondo scuro</p>
  </div>
  <!-- Revisione Codex #308: tappe senza posizione fra tappe esplicite (nero al 60%, non al 50%). -->
  <div style="position:relative;width:400px;height:100px;background:linear-gradient(to right,#fff 20%,#000,#fff 100%)">
    <span id="partial-stops" style="position:absolute;left:148px;top:40px;width:24px;height:20px;font:400 16px/20px sans-serif;color:#fff">Aa</span>
  </div>
  <!-- Direzione verso l'angolo: dipende dalla geometria del box, non è 135° fissi. -->
  <div style="position:relative;width:400px;height:100px;background:linear-gradient(to bottom right,#fff,#000)">
    <span id="corner" style="position:absolute;left:288px;top:15px;width:24px;height:20px;font:400 16px/20px sans-serif;color:#fff">Aa</span>
  </div>
  <!-- Alpha premoltiplicata: rosso trasparente → blu opaco, a metà circa 127/127/255 sul bianco. -->
  <div style="position:relative;width:400px;height:100px;background:linear-gradient(to right,rgba(255,0,0,0),#00f)">
    <span id="premul" style="position:absolute;left:188px;top:40px;width:24px;height:20px;font:400 16px/20px sans-serif;color:#fff">Aa</span>
  </div>
  <!-- Sintassi non supportata: «non misurato», mai un PASS presunto sul colore di fondo. -->
  <div style="background:radial-gradient(#000,#fff)"><p id="radial" style="color:#fff">Testo su sfumatura radiale</p></div>
  <!-- Solo lettori di schermo: ritagliato a 1 px, non visibile, non mappato. -->
  <span id="sronly" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);color:#fff">Solo lettore</span>
</body></html>`;

test('visual map composites text alpha, group opacity and gradients like the browser', {timeout: 120000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'visual-map-'));
  try {
    await writeFile(path.join(dir, 'casi.html'), page);
    await run(process.execPath, [tool, path.join(dir, 'out'), 'casi.html'], {env: {...process.env, VISUAL_MAP_ROOT: dir}});
    const [report] = JSON.parse(await readFile(path.join(dir, 'out', 'visual-map.json'), 'utf8'));
    const low = report.themes.light.lowContrast.filter(item => item.palette === 'Blu');
    const ratio = id => low.find(item => item.label.includes(`#${id}`))?.ratio;
    assert.ok(Math.abs(ratio('alpha') - 2.11) < 0.02, `alpha text ${ratio('alpha')}`);
    assert.equal(ratio('hidden'), undefined, 'children of an opacity:0 group are not mapped');
    assert.ok(Math.abs(ratio('faded') - 2.11) < 0.02, `faded group ${ratio('faded')}`);
    // Nero a opacità 0,52 sul bianco: sfondo 122,4 e testo bianco → 4,27:1, sotto 4,5 (era un falso PASS a 5,66).
    assert.ok(Math.abs(ratio('group') - 4.27) < 0.02, `group with own surface ${ratio('group')}`);
    assert.equal(ratio('solid'), undefined, 'readable solid text is not flagged');
    assert.equal(ratio('animated'), undefined, 'fade-in animations are measured at their final state');
    // Sfumatura misurata nel punto del testo, non sul solo primo colore.
    assert.ok(ratio('grad-top') < 1.5, `white text on the light end is flagged (${ratio('grad-top')})`);
    assert.equal(ratio('grad-bottom'), undefined, 'white text on the dark end is not a false alarm');
    // Rapporti attesi dal campionamento del browser riportato nella revisione Codex.
    assert.ok(Math.abs(ratio('partial-stops') - 4.06) < 0.1, `implicit stops between explicit ones ${ratio('partial-stops')}`);
    assert.ok(Math.abs(ratio('corner') - 4.00) < 0.1, `corner direction depends on the box ${ratio('corner')}`);
    // Premoltiplicata: sfondo ~127/127/255 → 3,29:1 (senza premoltiplica sarebbe ~191/127/191 → 3,0:1).
    assert.ok(Math.abs(ratio('premul') - 3.29) < 0.08, `premultiplied alpha interpolation ${ratio('premul')}`);
    assert.equal(ratio('radial'), undefined, 'unsupported paint is not given a contrast ratio');
    assert.ok(report.themes.light.unmeasured.some(item => item.label.includes('#radial')), 'unsupported paint is counted as unmeasured');
    assert.ok(!JSON.stringify(report).includes('#sronly'), 'screen-reader-only text is not mapped');
  } finally { await rm(dir, {recursive: true, force: true}); }
});

// Pagine protocollo sempre scure e asse Nuova/Classica (data-ui-revision tolto come in theme-init.js).
const forced = `<!doctype html><html lang="it" class="protocol-forced-dark"><head><meta charset="utf-8">
<style>body{background:#fff;margin:0}.dark body{background:#000}</style></head><body>
  <p id="forced" style="color:#fff">Bianco su protocollo scuro</p></body></html>`;
const revision = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<style>body{background:#fff;margin:0;color:#000}[data-ui-revision] #rev{color:#fff}</style></head>
<body data-ui-revision="tre-livelli"><p id="rev">Bianco solo in grafica Nuova</p></body></html>`;

test('visual map keeps forced-dark pages dark and measures Nuova and Classica separately', {timeout: 120000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'visual-map-'));
  try {
    await writeFile(path.join(dir, 'forzato.html'), forced);
    await writeFile(path.join(dir, 'revisione.html'), revision);
    await run(process.execPath, [tool, path.join(dir, 'out'), 'forzato.html,revisione.html'], {env: {...process.env, VISUAL_MAP_ROOT: dir}});
    const report = JSON.parse(await readFile(path.join(dir, 'out', 'visual-map.json'), 'utf8'));
    const flagged = (entry, theme, id) => entry.themes[theme].lowContrast.some(item => item.label.includes(`#${id}`));
    const forcedPage = report.find(entry => entry.page === 'forzato.html');
    assert.equal(forcedPage.mode, 'unica');
    assert.equal(flagged(forcedPage, 'light', 'forced'), false, 'forced-dark page is not measured on a light background');
    const nuova = report.find(entry => entry.page === 'revisione.html' && entry.mode === 'nuova');
    const classica = report.find(entry => entry.page === 'revisione.html' && entry.mode === 'classica');
    assert.ok(nuova && classica, 'migrated pages are mapped in both graphics');
    assert.equal(flagged(nuova, 'light', 'rev'), true, 'Nuova applies the revision rules');
    assert.equal(flagged(classica, 'light', 'rev'), false, 'Classica drops data-ui-revision like theme-init.js');
  } finally { await rm(dir, {recursive: true, force: true}); }
});
