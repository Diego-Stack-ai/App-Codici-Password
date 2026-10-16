import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { LOCAL_AI_PACKAGE_CATALOG } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-catalog.js';
import { readFileSync } from 'node:fs';

const publicRoot = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const digest = path => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', reject)
        .on('end', () => resolve(hash.digest('hex')));
});

for (const level of ['A1', 'A2']) {
    test(`artefatti Hosting ${level}: presenza, dimensione e SHA-256`, async () => {
        const candidate = LOCAL_AI_PACKAGE_CATALOG[level];
        const packageRoot = resolve(publicRoot, candidate.baseUrl.replace(/^\//, ''));
        assert.ok(packageRoot.startsWith(publicRoot));
        let total = 0;
        for (const file of candidate.manifest.files) {
            const absolute = join(packageRoot, file.path);
            assert.ok(existsSync(absolute), file.path);
            assert.equal(statSync(absolute).size, file.bytes, file.path);
            assert.equal(await digest(absolute), file.sha256, file.path);
            total += file.bytes;
        }
        assert.equal(total, candidate.manifest.approxDownloadBytes);
    });
}

test('i pacchetti avanzati sono same-origin, immutabili e fuori dalla shell PWA', () => {
    const firebase = JSON.parse(readFileSync(fileURLToPath(new URL('../firebase.json', import.meta.url)), 'utf8'));
    const immutable = firebase.hosting.headers.find(rule => rule.source === '/assets/local-ai-packages/**');
    assert.equal(immutable.headers.find(header => header.key === 'Cache-Control').value,
        'public, max-age=31536000, immutable');
    const offlineAssets = readFileSync(fileURLToPath(new URL('../Frontend/public/offline-assets.js', import.meta.url)), 'utf8');
    assert.doesNotMatch(offlineAssets, /assets\/local-ai-packages\//);
    const worker = readFileSync(fileURLToPath(new URL('../Frontend/public/sw.js', import.meta.url)), 'utf8');
    assert.match(worker, /url\.pathname\.startsWith\('\/assets\/local-ai-packages\/'\)/);
    assert.match(worker, /!name\.startsWith\('codex-local-ai-'\)/);
});
