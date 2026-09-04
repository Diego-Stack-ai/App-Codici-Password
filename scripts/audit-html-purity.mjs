import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const publicDir = new URL('../Frontend/public/', import.meta.url);
const htmlFiles = (await readdir(publicDir)).filter((name) => name.endsWith('.html')).sort();
const violations = [];
let inlineStyles = 0;
let inlineEvents = 0;
let inlineScripts = 0;
let inlineStyleBlocks = 0;
let duplicateIds = 0;

for (const name of htmlFiles) {
    const html = await readFile(new URL(name, publicDir), 'utf8');
    const lines = html.split(/\r?\n/);
    const recordMatches = (pattern, type) => {
        lines.forEach((line, index) => {
            if (pattern.test(line)) violations.push(`${name}:${index + 1} ${type}`);
            pattern.lastIndex = 0;
        });
    };

    const styleMatches = html.match(/\sstyle\s*=/gi) ?? [];
    const eventMatches = html.match(/\son[a-z]+\s*=/gi) ?? [];
    const scriptMatches = html.match(/<script(?![^>]*\bsrc\s*=)[^>]*>/gi) ?? [];
    const styleBlockMatches = html.match(/<style\b[^>]*>/gi) ?? [];
    inlineStyles += styleMatches.length;
    inlineEvents += eventMatches.length;
    inlineScripts += scriptMatches.length;
    inlineStyleBlocks += styleBlockMatches.length;

    recordMatches(/\sstyle\s*=/gi, 'stile inline');
    recordMatches(/\son[a-z]+\s*=/gi, 'evento inline');
    recordMatches(/<script(?![^>]*\bsrc\s*=)[^>]*>/gi, 'script incorporato');
    recordMatches(/<style\b[^>]*>/gi, 'blocco style incorporato');

    const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
    const seen = new Set();
    for (const id of ids) {
        if (seen.has(id)) {
            duplicateIds += 1;
            violations.push(`${name}: id duplicato "${id}"`);
        }
        seen.add(id);
    }
}

console.table({
    htmlFiles: htmlFiles.length,
    inlineStyles,
    inlineEvents,
    inlineScripts,
    inlineStyleBlocks,
    duplicateIds
});

assert.equal(violations.length, 0, `Violazioni purezza HTML:\n${violations.join('\n')}`);
console.log('HTML puro: struttura separata da stile e comportamento inline.');
