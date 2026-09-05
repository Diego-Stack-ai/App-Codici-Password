import { build } from 'esbuild';
import { mkdir, stat } from 'node:fs/promises';

const output = 'experiments/card-importer/dist/prototype.js';
await mkdir('experiments/card-importer/dist', { recursive: true });
await build({
    entryPoints: ['./experiments/card-importer/prototype.mjs'],
    outfile: output,
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: ['safari16', 'chrome110']
});
const details = await stat(output);
console.log(`Bundle sperimentale: ${(details.size / 1024).toFixed(1)} KB`);
