import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const stageRoot = join(root, 'Frontend', 'public', 'assets', 'local-ai-packages', 'a2');
const output = join(root, 'Frontend', 'public', 'assets', 'js', 'modules', 'assistant',
    'local-ai-hosting-catalog.generated.js');
const advancedRuntimeUrl = '/assets/js/modules/assistant/local-ai-generative-runtime-factory.js';
const entries = [
    ['medium', 'qwen2.5-1.5b-instruct-q4f16-1-mlc', 'MLC AI / Qwen',
        'mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC'],
    ['power', 'smollm2-1.7b-instruct-q4f16-1-mlc', 'MLC AI / Hugging Face',
        'mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC']
];
const result = {};
for (const [tier, packageId, provider, modelId] of entries) {
    const hosted = JSON.parse(await readFile(join(stageRoot, packageId, '0.1.0', 'hosting-manifest.json'), 'utf8'));
    result[tier] = {
        tier, level:'A2', status:'available', blockReason:null,
        baseUrl:hosted.immutableBaseUrl,
        runtimeUrl:advancedRuntimeUrl,
        source:`https://huggingface.co/${hosted.source.repo}`,
        manifest:{ schemaVersion:1, level:'A2', packageId, version:'0.1.0', runtime:'webllm-webgpu',
            model:{ provider, modelId, revision:hosted.source.revision, license:hosted.source.license },
            approxDownloadBytes:hosted.approxDownloadBytes, maxResidentBytes:hosted.maxResidentBytes,
            locales:['it-IT','en-US','es-ES','fr-FR','de-DE','zh-CN','pt-PT'], files:hosted.files }
    };
}
const source = `// Generato da scripts/generate-local-ai-hosting-catalog.mjs. Non modificare a mano.\nexport const HOSTED_ADVANCED_AI_CATALOG = Object.freeze(${JSON.stringify(result, null, 2)});\n`;
await writeFile(output, source);
console.log(`Catalogo Hosting generato: ${output}`);
