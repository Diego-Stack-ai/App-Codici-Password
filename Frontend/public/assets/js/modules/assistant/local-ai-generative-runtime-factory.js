// La revisione nella query evita che il service worker riusi una vecchia copia
// del runtime presente nelle cache dei pacchetti AI gia installati. I pesi del
// modello restano invece nelle cache dedicate e non vengono riscaricati.
import { CreateMLCEngine, deleteChatConfigInCache } from '../../../local-ai/a3/qwen2.5-0.5b-instruct-q4f16-1-mlc/0.1.0/runtime/web-llm.js?codex-runtime=2';

const MODEL_SPECS = Object.freeze({
    'qwen2.5-0.5b-instruct-q4f16-1-mlc': Object.freeze({
        modelId:'codex-qwen2.5-0.5b-instruct-q4f16-1',
        library:'Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
        vramMiB:944.62
    }),
    'qwen2.5-1.5b-instruct-q4f16-1-mlc': Object.freeze({
        modelId:'codex-qwen2.5-1.5b-instruct-q4f16-1',
        library:'Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',
        vramMiB:1629.75
    }),
    'smollm2-1.7b-instruct-q4f16-1-mlc': Object.freeze({
        modelId:'codex-smollm2-1.7b-instruct-q4f16-1',
        library:'SmolLM2-1.7B-Instruct-q4f16_1_cs1k-webgpu.wasm',
        vramMiB:1774.19
    })
});

export async function createGenerativeRuntime({ manifest, packageBaseUrl, onProgress = () => {} }) {
    const spec = MODEL_SPECS[manifest?.packageId];
    if (!spec) throw new Error('LOCAL_AI_MODEL_UNSUPPORTED');
    const appConfig = {
        model_list: [{
            model:packageBaseUrl,
            model_id:spec.modelId,
            model_lib:`${packageBaseUrl}lib/${spec.library}`,
            vram_required_MB:spec.vramMiB,
            low_resource_required:true
        }]
    };
    let engine;
    try {
        engine = await CreateMLCEngine(spec.modelId, { appConfig, initProgressCallback:onProgress });
    } catch (error) {
        // Le prime pubblicazioni dei pacchetti AI.2 potevano lasciare nella cache
        // WebLLM il fallback HTML di Hosting al posto di mlc-chat-config.json.
        // Il pacchetto installato e verificato non va riscaricato: eliminiamo solo
        // la configurazione WebLLM obsoleta e ripetiamo una volta il caricamento.
        if (String(error?.name || '') !== 'SyntaxError') throw error;
        await deleteChatConfigInCache(spec.modelId, appConfig);
        engine = await CreateMLCEngine(spec.modelId, { appConfig, initProgressCallback:onProgress });
    }
    return Object.freeze({
        level:'A2',
        async complete(messages, options = {}) {
            return engine.chat.completions.create({
                messages,
                temperature:options.temperature ?? 0.1,
                max_tokens:options.maxTokens ?? 256
            });
        },
        async dispose() { await engine.unload?.(); }
    });
}
