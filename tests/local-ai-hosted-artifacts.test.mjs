import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { LOCAL_AI_PACKAGE_CATALOG } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-catalog.js';

const publicRoot = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const digest = path => new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', reject)
        .on('end', () => resolve(hash.digest('hex')));
});

for (const level of ['A2', 'A3']) {
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
