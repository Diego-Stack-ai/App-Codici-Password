import { CreateMLCEngine } from './web-llm.js';

const MODEL_ID = 'codex-qwen2.5-0.5b-instruct-q4f16-1';

export async function createGenerativeRuntime({ packageBaseUrl, onProgress = () => {} }) {
    const appConfig = {
        model_list: [{
            model: packageBaseUrl,
            model_id: MODEL_ID,
            model_lib: `${packageBaseUrl}lib/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
            vram_required_MB: 944.62,
            low_resource_required: true
        }]
    };
    const engine = await CreateMLCEngine(MODEL_ID, { appConfig, initProgressCallback: onProgress });
    return Object.freeze({
        level: 'A2',
        async complete(messages, options = {}) {
            return engine.chat.completions.create({
                messages,
                temperature: options.temperature ?? 0.1,
                max_tokens: options.maxTokens ?? 256
            });
        },
        async dispose() { await engine.unload?.(); }
    });
}
