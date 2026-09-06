import assert from 'node:assert/strict';
import {access, readFile, readdir} from 'node:fs/promises';

const root = new URL('../Frontend/public/', import.meta.url);
const archiveRoot = new URL('../archive/home-experiments/', import.meta.url);
const archivedPages = [
    'home_confronto.html',
    'home_nebbia.html',
    'home-v126.html',
    'home-v127.html',
    'home-v128.html',
    'home-v129.html'
];

for (const name of archivedPages) {
    await access(new URL(name, archiveRoot));
    await assert.rejects(access(new URL(name, root)), `${name} non deve essere pubblicato`);
}

const publicPages = (await readdir(root)).filter(name => name.endsWith('.html'));
assert.equal(publicPages.length, 29, `Attese 29 pagine pubbliche canoniche, trovate ${publicPages.length}`);

const homeBootstrap = await readFile(new URL('assets/js/home-bootstrap.js', root), 'utf8');
assert.ok(!homeBootstrap.includes('visualMode'), 'La Home canonica contiene ancora il selettore dei laboratori visuali');

console.log('Registro pagine canoniche M3: 29 pagine pubbliche, laboratori Home archiviati.');
