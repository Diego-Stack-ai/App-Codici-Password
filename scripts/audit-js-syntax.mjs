import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const root = new URL('../Frontend/public/assets/js/', import.meta.url);

async function listJavaScript(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
        if (entry.isDirectory()) files.push(...await listJavaScript(url));
        else if (entry.name.endsWith('.js')) files.push(url);
    }
    return files;
}

const failures = [];
const files = await listJavaScript(root);
for (const file of files) {
    try {
        parse(await readFile(file, 'utf8'), {
            sourceType: 'module',
            allowAwaitOutsideFunction: true
        });
    } catch (error) {
        failures.push(`${file.pathname}: ${error.message}`);
    }
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Sintassi JavaScript verificata in ${files.length} moduli: OK`);
}
