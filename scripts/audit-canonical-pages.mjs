import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/', import.meta.url);
const redirects = ['home-v126.html', 'home-v127.html', 'home-v128.html', 'home-v129.html'];

for (const name of redirects) {
    const source = await readFile(new URL(name, root), 'utf8');
    assert.match(source, /http-equiv=["']refresh["'][^>]+home_page\.html/i, `${name} non inoltra alla Home canonica`);
    assert.ok(!/<script\b/i.test(source), `${name} contiene logica applicativa`);
    assert.ok(!/<link\b[^>]+stylesheet/i.test(source), `${name} carica stile applicativo`);
}

const baselineAudit = await readFile(new URL('../scripts/audit-page-performance.mjs', import.meta.url), 'utf8');
for (const name of redirects) assert.ok(baselineAudit.includes(`'${name}'`), `${name} non è escluso dalla baseline canonica`);

console.log('Registro pagine canoniche M3: redirect Home confinati.');
