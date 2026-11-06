import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function loadCatalog(relativePath, transform) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    const context = vm.createContext({catalog: null});
    vm.runInContext(transform(source), context);
    return context.catalog;
}

const baseItalian = await loadCatalog('../../Frontend/public/assets/js/translations/it.js', source =>
    source.replace(/^export default /u, 'globalThis.catalog = '));
const dynamicItalian = await loadCatalog('../../Frontend/public/assets/js/translations/dynamic-ui.js', source =>
    source.replace(/export const dynamicUiCatalogs\s*=\s*\{[^;]+\};/u, 'globalThis.catalog = it;'));
const italian = Object.freeze({...baseItalian, ...dynamicItalian});

export function testTranslate(key, replacements = {}) {
    const template = String(italian[key] ?? key);
    return template.replace(/\{([^{}]+)\}/gu, (match, name) =>
        Object.hasOwn(replacements, name) ? String(replacements[name]) : match);
}
