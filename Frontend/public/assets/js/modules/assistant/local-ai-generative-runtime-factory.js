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
    const runtimeUrl = new URL('runtime/web-llm.js', packageBaseUrl).href;
    const { CreateWebWorkerMLCEngine, deleteModelAllInfoInCache } = await import(runtimeUrl);
    const appConfig = {
        cacheBackend:'cache',
        model_list: [{
            model:packageBaseUrl,
            model_id:spec.modelId,
            model_lib:`${packageBaseUrl}lib/${spec.library}`,
            vram_required_MB:spec.vramMiB,
            low_resource_required:true
        }]
    };
    const createWorker = () => new Worker(
        new URL(`./local-ai-generative-worker.js?runtime=${encodeURIComponent(runtimeUrl)}`, import.meta.url),
        { type:'module', name:'codici-password-ai2' }
    );
    const initialize = async () => {
        const worker = createWorker();
        try {
            const engine = await CreateWebWorkerMLCEngine(worker, spec.modelId, {
                appConfig,
                initProgressCallback:onProgress
            });
            return { engine, worker };
        } catch (error) {
            worker.terminate();
            throw error;
        }
    };
    let active;
    try {
        active = await initialize();
    } catch (error) {
        // Un SyntaxError dopo l'accesso a WebGPU indica normalmente un artefatto
        // derivato WebLLM obsoleto o incompleto. La cache applicativa verificata
        // resta intatta; config, tokenizer, tensori e WASM derivati vengono invece
        // eliminati insieme, evitando riparazioni parziali e nuovi stati ibridi.
        if (String(error?.name || '') !== 'SyntaxError') throw error;
        await deleteModelAllInfoInCache(spec.modelId, appConfig);
        active = await initialize();
    }
    return Object.freeze({
        level:'A2',
        async complete(messages, options = {}) {
            return active.engine.chat.completions.create({
                messages,
                temperature:options.temperature ?? 0.1,
                max_tokens:options.maxTokens ?? 256,
                ...(options.responseFormat ? { response_format:options.responseFormat } : {})
            });
        },
        async interrupt() { await active.engine.interruptGenerate?.(); },
        async dispose() {
            try { await active.engine.unload?.(); }
            finally { active.worker.terminate(); }
        }
    });
}
