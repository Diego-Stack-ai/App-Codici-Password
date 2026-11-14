import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

// Mappa visiva: il contrasto deve corrispondere al compositing del browser, senza falsi PASS.
// Pagina sintetica in loopback, nessuno script dell'app, nessuna rete esterna.
const run = promisify(execFile);
const tool = fileURLToPath(new URL('../scripts/visual-map.mjs', import.meta.url));
const page = `<!doctype html><html lang="it"><head><meta charset="utf-8"></head><body style="background:#fff;margin:0">
  <p id="alpha" style="color:rgba(0,0,0,.3)">Testo con alpha 0,3</p>
  <div style="opacity:0"><p id="hidden" style="color:#000">Figlio di un gruppo invisibile</p></div>
  <div style="opacity:.3"><p id="faded" style="color:#000">Figlio di un gruppo attenuato</p></div>
  <div style="background:#000;opacity:.52"><span id="group" style="color:#fff;font-size:16px;font-weight:400">Gruppo con superficie propria</span></div>
  <p id="solid" style="color:#000">Testo pieno</p>
</body></html>`;

test('visual map composites text alpha and group opacity like the browser', {timeout: 120000}, async () => {
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
  } finally { await rm(dir, {recursive: true, force: true}); }
});
