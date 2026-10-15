import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const PUBLIC_ROOT = path.resolve('Frontend/public');
const MATERIAL_CLASS = /\bmaterial-(?:symbols|icons)(?:-[\w-]+)?\b/i;

async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async entry => {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'vendor') return [];
            return sourceFiles(target);
        }
        return /\.(?:html|js)$/i.test(entry.name) ? [target] : [];
    }));
    return nested.flat();
}

test('le icone Material Symbols statiche e nei template non sono traducibili', async () => {
    const violations = [];
    for (const file of await sourceFiles(PUBLIC_ROOT)) {
        const source = await readFile(file, 'utf8');
        const relative = path.relative(process.cwd(), file);
        const tagPattern = /<([a-z][\w-]*)([^>]*\bclass\s*=\s*(["'])(.*?)\3[^>]*)>/gis;
        for (const match of source.matchAll(tagPattern)) {
            if (!MATERIAL_CLASS.test(match[4])) continue;
            if (!/\bnotranslate\b/i.test(match[4]) || !/\btranslate\s*=\s*(["'])no\1/i.test(match[2])) {
                violations.push(`${relative}: markup Material Symbols traducibile: ${match[0].slice(0, 140)}`);
            }
        }

        const classNamePattern = /className\s*(?::|=)\s*(["'])([^"']*\bmaterial-(?:symbols|icons)(?:-[\w-]+)?\b[^"']*)\1/g;
        for (const match of source.matchAll(classNamePattern)) {
            if (!/\bnotranslate\b/.test(match[2])) {
                violations.push(`${relative}: classe dinamica Material Symbols senza notranslate: ${match[0]}`);
            }
        }
    }
    assert.deepEqual(violations, []);
});

test('createElement applica translate=no alle icone Material Symbols dinamiche', async () => {
    const source = await readFile(path.join(PUBLIC_ROOT, 'assets/js/dom-utils.js'), 'utf8');
    assert.match(source, /material-\(\?:symbols-/);
    assert.match(source, /el\.className = `\$\{el\.className\} notranslate`/);
    assert.match(source, /setAttribute\('translate', 'no'\)/);
});
