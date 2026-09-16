import {readFile} from 'node:fs/promises';
const cache = new Map();
export async function loadPdfModule(name) {
    if (!cache.has(name)) cache.set(name, (async () => {
        let source = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/pdf/' + name + '.js', import.meta.url), 'utf8');
        for (const dependency of ['company-summary-reader', 'company-summary-view', 'company-summary-browser']) {
            if (source.includes(`'./${dependency}.js'`)) source = source.replaceAll(`'./${dependency}.js'`, JSON.stringify(await moduleUrl(dependency)));
        }
        return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
    })());
    return import(await cache.get(name));
}
async function moduleUrl(name) {
    await loadPdfModule(name); return cache.get(name);
}
