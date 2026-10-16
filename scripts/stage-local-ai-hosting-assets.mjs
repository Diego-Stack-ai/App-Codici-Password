import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicRoot = join(root, 'Frontend', 'public');
const runtimeSource = join(publicRoot, 'assets', 'local-ai', 'a3',
    'qwen2.5-0.5b-instruct-q4f16-1-mlc', '0.1.0', 'runtime', 'web-llm.js');
const targetRoot = join(publicRoot, 'assets', 'local-ai-packages', 'a2');
const modelLibPrefix = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_86/base/';

const specs = {
    medium:{
        packageId:'qwen2.5-1.5b-instruct-q4f16-1-mlc',
        repo:'mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
        revision:'9bd564b064631febf14deadcac492efb761d60c3',
        upstream:'Qwen/Qwen2.5-1.5B-Instruct',
        upstreamRevision:'main', modelId:'codex-qwen2.5-1.5b-instruct-q4f16-1',
        library:'Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm', vramMiB:1629.75
    },
    power:{
        packageId:'smollm2-1.7b-instruct-q4f16-1-mlc',
        repo:'mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC',
        revision:'84f57f8580a9d8d623266b600ad4273bb9fd84c1',
        upstream:'HuggingFaceTB/SmolLM2-1.7B-Instruct',
        upstreamRevision:'main', modelId:'codex-smollm2-1.7b-instruct-q4f16-1',
        library:'SmolLM2-1.7B-Instruct-q4f16_1_cs1k-webgpu.wasm', vramMiB:1774.19
    }
};

const selected = process.argv.slice(2).filter(value => Object.hasOwn(specs, value));
if (!selected.length) throw new Error('Uso: node scripts/stage-local-ai-hosting-assets.mjs medium [power]');

async function sha256(path) {
    const hash = createHash('sha256');
    await new Promise((ok, fail) => createReadStream(path).on('data', chunk => hash.update(chunk))
        .on('error', fail).on('end', ok));
    return hash.digest('hex');
}

async function download(url, destination, expectedBytes = null) {
    await mkdir(dirname(destination), { recursive:true });
    const partial = `${destination}.partial`;
    let offset = existsSync(partial) ? (await stat(partial)).size : 0;
    if (existsSync(destination) && (expectedBytes === null || (await stat(destination)).size === expectedBytes)) return;
    const headers = offset ? { Range:`bytes=${offset}-` } : {};
    let response = await fetch(url, { headers, redirect:'follow' });
    if (offset && response.status !== 206) {
        await rm(partial, { force:true });
        offset = 0;
        response = await fetch(url, { redirect:'follow' });
    }
    if (!response.ok || !response.body) throw new Error(`Download ${response.status}: ${url}`);
    const output = createWriteStream(partial, { flags:offset ? 'a' : 'w' });
    await response.body.pipeTo(new WritableStream({
        write(chunk) { return new Promise((ok, fail) => output.write(Buffer.from(chunk), error => error ? fail(error) : ok())); },
        close() { return new Promise((ok, fail) => output.end(error => error ? fail(error) : ok())); },
        abort(reason) { output.destroy(reason); }
    }));
    const bytes = (await stat(partial)).size;
    if (expectedBytes !== null && bytes !== expectedBytes) throw new Error(`Dimensione inattesa ${destination}: ${bytes}/${expectedBytes}`);
    await rename(partial, destination);
}

function selectedModelFile(name) {
    return /^params_shard_\d+\.bin$/.test(name)
        || ['mlc-chat-config.json', 'ndarray-cache.json', 'tokenizer.json', 'tokenizer_config.json',
            'special_tokens_map.json', 'added_tokens.json', 'merges.txt', 'vocab.json'].includes(name);
}

async function stage(tier) {
    const spec = specs[tier];
    const destination = join(targetRoot, spec.packageId, '0.1.0');
    const api = `https://huggingface.co/api/models/${spec.repo}/revision/${spec.revision}`;
    const metadataResponse = await fetch(api);
    if (!metadataResponse.ok) throw new Error(`Metadata ${metadataResponse.status}: ${spec.repo}`);
    const metadata = await metadataResponse.json();
    const siblings = metadata.siblings.filter(item => selectedModelFile(item.rfilename));
    if (!siblings.some(item => /^params_shard_/.test(item.rfilename))) throw new Error(`Nessuno shard: ${spec.repo}`);
    for (const item of siblings) {
        const expected = Number.isSafeInteger(item.size) ? item.size : (Number.isSafeInteger(item.lfs?.size) ? item.lfs.size : null);
        await download(`https://huggingface.co/${spec.repo}/resolve/${spec.revision}/${item.rfilename}`,
            join(destination, item.rfilename), expected);
    }
    const upstreamLicenseUrl = `https://huggingface.co/${spec.upstream}/resolve/${spec.upstreamRevision}/LICENSE`;
    const licenseUrl = spec.upstream.startsWith('HuggingFaceTB/')
        ? 'https://www.apache.org/licenses/LICENSE-2.0.txt' : upstreamLicenseUrl;
    await download(licenseUrl, join(destination, 'LICENSE-model.txt'));
    const runtimeLicenseSource = join(publicRoot, 'assets', 'local-ai', 'a3',
        'qwen2.5-0.5b-instruct-q4f16-1-mlc', '0.1.0', 'LICENSE-runtime.txt');
    await writeFile(join(destination, 'LICENSE-runtime.txt'), await readFile(runtimeLicenseSource));
    await mkdir(join(destination, 'runtime'), { recursive:true });
    await writeFile(join(destination, 'runtime', 'web-llm.js'), await readFile(runtimeSource));
    await download(`${modelLibPrefix}${spec.library}`, join(destination, 'lib', spec.library));
    const factory = `import { CreateMLCEngine } from './web-llm.js';\n\nconst MODEL_ID = '${spec.modelId}';\n\nexport async function createGenerativeRuntime({ packageBaseUrl, onProgress = () => {} }) {\n    const appConfig = { model_list: [{ model:packageBaseUrl, model_id:MODEL_ID, model_lib:\`\${packageBaseUrl}lib/${spec.library}\`, vram_required_MB:${spec.vramMiB}, low_resource_required:true }] };\n    const engine = await CreateMLCEngine(MODEL_ID, { appConfig, initProgressCallback:onProgress });\n    return Object.freeze({ level:'A2', async complete(messages, options = {}) { return engine.chat.completions.create({ messages, temperature:options.temperature ?? 0.1, max_tokens:options.maxTokens ?? 256, response_format:{ type:'json_object' } }); }, async dispose() { await engine.unload?.(); } });\n}\n`;
    await writeFile(join(destination, 'runtime', 'factory.js'), factory);
    const files = [];
    async function inventory(folder, prefix = '') {
        const { readdir } = await import('node:fs/promises');
        for (const entry of await readdir(folder, { withFileTypes:true })) {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.name.endsWith('.partial') || entry.name === 'hosting-manifest.json') continue;
            if (entry.isDirectory()) await inventory(join(folder, entry.name), relative);
            else {
                const absolute = join(folder, entry.name);
                files.push({ path:relative, bytes:(await stat(absolute)).size, sha256:await sha256(absolute) });
            }
        }
    }
    await inventory(destination);
    files.sort((a, b) => a.path.localeCompare(b.path));
    const manifest = { schemaVersion:1, level:'A2', tier, packageId:spec.packageId, version:'0.1.0',
        immutableBaseUrl:`/assets/local-ai-packages/a2/${spec.packageId}/0.1.0/`,
        source:{ repo:spec.repo, revision:spec.revision, upstream:spec.upstream, license:'Apache-2.0' },
        approxDownloadBytes:files.reduce((sum, file) => sum + file.bytes, 0), maxResidentBytes:Math.ceil(spec.vramMiB * 1024 * 1024), files };
    await writeFile(join(destination, 'hosting-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`${tier}: ${manifest.approxDownloadBytes} byte, ${files.length} file`);
}

for (const tier of selected) await stage(tier);
