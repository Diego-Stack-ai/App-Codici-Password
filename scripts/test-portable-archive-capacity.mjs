import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import {
    createPortableArchiveWriter, createPortableHeader
} from '../Frontend/public/assets/js/modules/settings/portable-archive-stream.mjs';

const MIB = 1024 * 1024;
const attachmentMiB = 32;
const scenario = process.env.PORTABLE_ARCHIVE_MEMORY_PROBE_FILES;

if (!scenario) {
    const results = [1, 2, 8].map(fileCount => {
        const child = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url)], {
            env: {...process.env, PORTABLE_ARCHIVE_MEMORY_PROBE_FILES: String(fileCount)},
            encoding: 'utf8', maxBuffer: 1024 * 1024
        });
        if (child.status !== 0) throw new Error(child.stderr || child.stdout || `PORTABLE_CAPACITY_CHILD_${fileCount}`);
        return JSON.parse(child.stdout.trim());
    });
    for (const result of results) {
        assert.ok(result.maxRssMiB < 320, `picco RSS streaming eccessivo per ${result.fixture}: ${result.maxRssMiB} MiB`);
        assert.ok(result.maxWriteMiB < 1.5, `il sink ha ricevuto un blocco eccessivo: ${result.maxWriteMiB} MiB`);
        assert.ok(result.outputMiB < result.clearMiB * 1.45 + 2, 'overhead del contenitore streaming oltre il limite');
    }
    assert.ok(results[0].maxRssMiB < 627 * 0.6, '1x32 MiB non riduce abbastanza il picco rispetto ai 627 MiB monolitici');
    assert.ok(results[1].maxRssMiB < 1075 * 0.4, '2x32 MiB non riduce abbastanza il picco rispetto ai 1.075 MiB monolitici');
    console.log(JSON.stringify({format: 'chunk-stream-v2', previousMonolithicMaxRssMiB: {'1x32 MiB': 627, '2x32 MiB': 1075}, results}, null, 2));
    process.exit(0);
}

const fileCount = Number(scenario);
if (!Number.isSafeInteger(fileCount) || fileCount < 1 || fileCount > 8) throw new Error('PORTABLE_MEMORY_PROBE_FILE_COUNT_INVALID');
const startedAt = performance.now();
let outputBytes = 0, maxWriteBytes = 0, closed = false;
const sink = {
    async write(value) {
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        outputBytes += bytes.byteLength;
        maxWriteBytes = Math.max(maxWriteBytes, bytes.byteLength);
    },
    async close() { closed = true; },
    async abort() { throw new Error('PORTABLE_CAPACITY_UNEXPECTED_ABORT'); }
};
const writer = await createPortableArchiveWriter({
    sink, password: 'Fiume!Quarzo-83#Luna', cryptoApi: webcrypto,
    header: createPortableHeader({createdAt: '2026-10-15T00:00:00.000Z', cryptoApi: webcrypto})
});
for (let index = 0; index < fileCount; index += 1) {
    const clear = new Uint8Array(attachmentMiB * MIB);
    for (let offset = 0; offset < clear.length; offset += MIB) clear[offset] = (index + offset / MIB) % 251;
    await writer.addEntry({id: `fixture-${index + 1}`, kind: 'attachment', name: `fixture-${index + 1}.bin`}, clear);
    clear.fill(0); globalThis.gc?.();
}
await writer.close({counts: {records: 0, attachments: fileCount}});
const maxRssMiB = process.resourceUsage().maxRSS / 1024;
const elapsedMs = performance.now() - startedAt;
assert.equal(closed, true);
console.log(JSON.stringify({
    fixture: `${fileCount}x${attachmentMiB} MiB`,
    clearMiB: attachmentMiB * fileCount,
    outputMiB: Number((outputBytes / MIB).toFixed(1)),
    maxWriteMiB: Number((maxWriteBytes / MIB).toFixed(2)),
    maxRssMiB: Number(maxRssMiB.toFixed(1)),
    elapsedMs: Math.round(elapsedMs)
}));
