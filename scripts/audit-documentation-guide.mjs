import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateGuideCatalog } from '../Frontend/public/assets/js/modules/assistant/documentation-guide.js';
import { DOCUMENTATION_UI_LABELS } from '../Frontend/public/assets/js/modules/assistant/documentation-ui-labels.js';

const publicRoot = new URL('../Frontend/public/', import.meta.url);
const catalogUrl = new URL('assets/js/modules/assistant/documentation-catalog.json', publicRoot);

export async function auditDocumentationGuide() {
    const source = await readFile(catalogUrl, 'utf8');
    const catalog = JSON.parse(source);
    validateGuideCatalog(catalog);
    const release = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(catalog.reviewedAppVersion, release.version, 'Riesaminare il catalogo quando cambia la base applicativa');
    assert.ok(Buffer.byteLength(source) <= 96 * 1024, 'Il catalogo D0 supera il budget di 96 KiB');
    const canonical = (await readdir(publicRoot)).filter(name => name.endsWith('.html') && name !== 'prova.html').sort();
    assert.equal(canonical.length, 30, 'Il registro corrente deve essere rivalutato quando cambia il numero di pagine');
    assert.deepEqual(catalog.pages.map(page => page.route.slice(1)).sort(), canonical,
        'Ogni pagina canonica deve avere esattamente una guida, senza pagine di laboratorio');
    const guide = await readFile(new URL('../docs/utente/GUIDA.md', import.meta.url), 'utf8');
    let targets = 0;
    for (const page of catalog.pages) {
        const html = await readFile(new URL(page.route.slice(1), publicRoot), 'utf8');
        assert.ok(guide.includes(`| \`${page.pageId}\` |`), `Manca la riga canonica nella matrice: ${page.pageId}`);
        for (const step of page.steps) {
            if (step.target === null) continue;
            const id = step.target.slice(1);
            const matches = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].filter(match => match[1] === id);
            assert.equal(matches.length, 1, `Target statico assente o ambiguo: ${page.pageId} ${step.target}`);
            targets++;
        }
    }
    const resolverSource = await readFile(new URL('assets/js/modules/assistant/documentation-guide.js', publicRoot), 'utf8');
    assert.ok(!/^\s*import\s/m.test(resolverSource), 'Il nucleo D0 deve restare privo di dipendenze runtime');
    assert.ok(!/\b(?:fetch|eval|Function|setTimeout|setInterval|querySelector|localStorage|sessionStorage|indexedDB)\s*[.(]/.test(resolverSource),
        'Il nucleo D0 non deve leggere DOM/dati, eseguire codice o usare rete/persistenza');
    assert.ok(Object.entries(DOCUMENTATION_UI_LABELS).every(([key, value]) => /^guide\.ui\./.test(key) && typeof value === 'string' && value.length > 0),
        'Tutti i nuovi comandi visibili devono avere chiavi linguistiche');
    for (const file of ['guide.js', 'modules/assistant/documentation-view.js']) {
        const source = await readFile(new URL(`assets/js/${file}`, publicRoot), 'utf8');
        assert.doesNotMatch(source, /firebase|security-manager|vault-data-loader|ensureVaultKeyMaterial|signOut|onAuthStateChanged/, `Guida D0 accoppiata ai dati: ${file}`);
        assert.doesNotMatch(source, /innerHTML|\.click\(|window\.location\s*=|location\.href\s*=/, `Azioni o HTML interpretato nella guida: ${file}`);
    }
    const mount = 'mountDocumentationHelp(getDocumentationPageContext(window.location.pathname))';
    const privateBootstrap = await readFile(new URL('assets/js/main-v129.js', publicRoot), 'utf8');
    assert.ok(!privateBootstrap.includes("import('./guide.js')"),
        'La guida privata non deve montare un secondo ? transitorio prima del modulo pagina');
    for (const file of ['login-entry.js', 'contact-card-receiver.js']) {
        const source = await readFile(new URL(`assets/js/${file}`, publicRoot), 'utf8');
        const guideImport = source.match(/import\('\.\/guide\.js'\)\.then\(\(\{\s*init\s*\}\)\s*=>\s*init\(\),\s*LOG\)/);
        const mountedAt = source.includes(mount) ? source.indexOf(mount) : (guideImport?.index ?? -1);
        assert.ok(mountedAt >= 0, `Guida non collegata al bootstrap ${file}`);
        if (source.includes('await loadLanguage')) assert.ok(mountedAt < source.indexOf('await loadLanguage'), `Guida D0 bloccata da inizializzazione in ${file}`);
    }
    const offlineSource = await readFile(new URL('offline-assets.js', publicRoot), 'utf8');
    const offlineAssets = JSON.parse(offlineSource.match(/=\s*(\[[\s\S]*\]);?\s*$/)[1]);
    for (const asset of ['assets/js/guide.js', 'assets/js/modules/assistant/documentation-guide.js',
        'assets/js/modules/assistant/documentation-view.js', 'assets/js/modules/assistant/documentation-ui-labels.js',
        'assets/js/modules/assistant/documentation-catalog.json', 'assets/css/documentation-guide.css']) {
        assert.ok(offlineAssets.includes(asset), `Guida assente dalla shell offline: ${asset}`);
    }
    return { pages: catalog.pages.length, steps: catalog.pages.reduce((count, page) => count + page.steps.length, 0), targets,
        bytes: Buffer.byteLength(source), contentVersion: catalog.contentVersion };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const result = await auditDocumentationGuide();
    console.log(`Guida D0: ${result.pages} pagine, ${result.steps} istruzioni, ${result.targets} target univoci, ${result.bytes} byte; route, chiavi e matrice coerenti.`);
}
