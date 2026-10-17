import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stageRoot = join(root, 'Frontend', 'public', 'assets', 'local-ai-packages', 'a2');
const requested = process.argv.slice(2);
if (!requested.length) throw new Error('Specificare almeno un manifest di staging');
const digest = path => new Promise((ok, fail) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', chunk => hash.update(chunk)).on('error', fail).on('end', () => ok(hash.digest('hex')));
});
for (const relative of requested) {
    const manifestPath = resolve(stageRoot, relative, 'hosting-manifest.json');
    if (!manifestPath.startsWith(stageRoot) || !existsSync(manifestPath)) throw new Error(`Manifest assente: ${relative}`);
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!manifest.immutableBaseUrl.startsWith('/assets/local-ai-packages/a2/') || manifest.immutableBaseUrl.includes('://')) {
        throw new Error(`URL non same-origin/immutabile: ${relative}`);
    }
    let total = 0;
    for (const file of manifest.files) {
        const absolute = join(dirname(manifestPath), file.path);
        if ((await stat(absolute)).size !== file.bytes || await digest(absolute) !== file.sha256) throw new Error(`Integrita fallita: ${file.path}`);
        total += file.bytes;
    }
    if (total !== manifest.approxDownloadBytes) throw new Error(`Totale fallito: ${relative}`);
    console.log(`${manifest.tier}: OK (${manifest.files.length} file, ${total} byte)`);
}
