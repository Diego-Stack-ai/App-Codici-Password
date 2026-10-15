import { env, pipeline } from './transformers.bundle.js';

export async function createSemanticRuntime({ packageBaseUrl, onProgress = () => {} }) {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = packageBaseUrl;
    env.backends.onnx.wasm.wasmPaths = `${packageBaseUrl}runtime/`;
    const extractor = await pipeline('feature-extraction', 'model', {
        device: 'wasm',
        dtype: 'q8',
        local_files_only: true,
        progress_callback: onProgress
    });
    return Object.freeze({
        level: 'A2',
        async embed(text) {
            const output = await extractor(String(text || ''), { pooling: 'mean', normalize: true });
            return Array.from(output.data || []);
        },
        async dispose() { await extractor.dispose?.(); }
    });
}
