import { getLocalAiPackageCandidate, LOCAL_AI_RUNTIME_PROVENANCE } from './local-ai-package-catalog.js';

const FACTORIES = Object.freeze({ A1:'createSemanticRuntime', A2:'createGenerativeRuntime' });
const DIAGNOSTIC_CODE = /^LOCAL_AI_[A-Z0-9_]+$/;
const DIAGNOSTIC_STAGE = /^[a-z][a-z0-9-]{0,47}$/;
const CAUSE_CODES = Object.freeze({
    WebGPUNotAvailableError:'LOCAL_AI_WEBGPU_UNAVAILABLE',
    WebGPUNotFoundError:'LOCAL_AI_WEBGPU_UNAVAILABLE',
    ShaderF16SupportError:'LOCAL_AI_GPU_FEATURE_UNSUPPORTED',
    DeviceLostError:'LOCAL_AI_GPU_DEVICE_LOST',
    CompileError:'LOCAL_AI_WASM_COMPILE_FAILED',
    OperationError:'LOCAL_AI_GPU_OPERATION_FAILED'
});

export const LOCAL_AI_RUNTIME_STAGES = Object.freeze({
    PREFLIGHT:'preflight',
    PACKAGE:'package-check',
    CAPABILITY:'capability-check',
    IMPORT:'runtime-import',
    INITIALIZATION:'runtime-initialization',
    SMOKE_TEST:'smoke-test',
    VERIFICATION:'verification-save'
});

function fallbackCode(stage) {
    return `LOCAL_AI_${String(stage || LOCAL_AI_RUNTIME_STAGES.PREFLIGHT).replace(/-/g, '_').toUpperCase()}_FAILED`;
}

function classifyCause(error, stage) {
    const direct = String(error?.code || error?.message || '');
    if (DIAGNOSTIC_CODE.test(direct)) return direct;
    const named = CAUSE_CODES[String(error?.causeName || error?.name || '')];
    if (named) return named;
    const message = String(error?.message || '');
    if (/maxBufferSize|maxStorageBufferBindingSize/i.test(message)) return 'LOCAL_AI_GPU_LIMIT_UNSUPPORTED';
    if (/device lost|out of memory|\bOOM\b/i.test(message)) return 'LOCAL_AI_GPU_DEVICE_LOST';
    if (/failed to fetch|networkerror/i.test(message)) return 'LOCAL_AI_MODEL_FETCH_FAILED';
    if (/mlc-chat-config|JSON/i.test(message)) return 'LOCAL_AI_MODEL_CONFIG_INVALID';
    if (/quota/i.test(message)) return 'LOCAL_AI_STORAGE_QUOTA_EXCEEDED';
    if (/abort/i.test(message)) return 'LOCAL_AI_OPERATION_ABORTED';
    if (/WebGPU|GPU adapter/i.test(message)) return 'LOCAL_AI_WEBGPU_UNAVAILABLE';
    if (/WebAssembly|wasm/i.test(message)) return 'LOCAL_AI_WASM_RUNTIME_FAILED';
    if (/tensor|tokenizer/i.test(message)) return 'LOCAL_AI_MODEL_ARTIFACT_INVALID';
    return fallbackCode(stage);
}

export function readLocalAiRuntimeDiagnostic(error, fallbackStage = LOCAL_AI_RUNTIME_STAGES.PREFLIGHT) {
    const stage = DIAGNOSTIC_STAGE.test(String(error?.stage || '')) ? String(error.stage) : fallbackStage;
    const code = classifyCause(error, stage);
    const errorName = /^[A-Za-z][A-Za-z0-9]{0,47}$/.test(String(error?.causeName || error?.name || ''))
        ? String(error?.causeName || error?.name)
        : 'Error';
    return Object.freeze({ code, stage, errorName });
}

function runtimeError(code, stage, cause) {
    const diagnostic = readLocalAiRuntimeDiagnostic({ code, stage, causeName:cause?.name }, stage);
    const error = new Error(diagnostic.code);
    error.name = 'LocalAiRuntimeError';
    error.code = diagnostic.code;
    error.stage = diagnostic.stage;
    error.causeName = diagnostic.errorName;
    return error;
}

async function runStage(stage, task) {
    try {
        return await task();
    } catch (error) {
        const diagnostic = readLocalAiRuntimeDiagnostic(error, stage);
        throw runtimeError(diagnostic.code, stage, error);
    }
}

export function createLocalAiRuntimeLoader({ packageManager, importModule = url => import(url), origin = location.origin } = {}) {
    if (!packageManager) throw new TypeError('LOCAL_AI_PACKAGE_MANAGER_REQUIRED');
    return Object.freeze({
        async load(level, { assessment, tier = 'light', runtimeUrl, onProgress = () => {}, onStage = () => {} } = {}) {
            const notifyStage = stage => {
                try { onStage(stage); } catch { /* La diagnostica UI non deve interrompere il runtime. */ }
            };
            notifyStage(LOCAL_AI_RUNTIME_STAGES.PREFLIGHT);
            const candidate = getLocalAiPackageCandidate(level, { tier });
            if (!candidate) throw runtimeError('LOCAL_AI_LEVEL_UNKNOWN', LOCAL_AI_RUNTIME_STAGES.PREFLIGHT);
            if (candidate.status !== 'available') throw runtimeError(`LOCAL_AI_BLOCKED_${candidate.blockReason}`, LOCAL_AI_RUNTIME_STAGES.PREFLIGHT);
            notifyStage(LOCAL_AI_RUNTIME_STAGES.PACKAGE);
            const installed = await runStage(LOCAL_AI_RUNTIME_STAGES.PACKAGE, () => packageManager.status(level, {
                manifest:candidate.manifest,
                baseUrl:candidate.baseUrl,
                legacyLevel:candidate.legacyLevel
            }));
            if (!installed.installed) throw runtimeError('LOCAL_AI_PACKAGE_NOT_INSTALLED', LOCAL_AI_RUNTIME_STAGES.PACKAGE);
            notifyStage(LOCAL_AI_RUNTIME_STAGES.CAPABILITY);
            if (assessment?.[level]?.status !== 'candidate') {
                throw runtimeError(`LOCAL_AI_CAPABILITY_${assessment?.[level]?.reasons?.join('_') || 'UNAVAILABLE'}`, LOCAL_AI_RUNTIME_STAGES.CAPABILITY);
            }
            if (level === 'A2' && !assessment.A2.allowedTiers?.includes(tier)) {
                throw runtimeError('LOCAL_AI_TIER_NOT_ALLOWED', LOCAL_AI_RUNTIME_STAGES.CAPABILITY);
            }
            const resolved = new URL(runtimeUrl || candidate.runtimeUrl, origin);
            if (resolved.origin !== origin) throw runtimeError('LOCAL_AI_RUNTIME_NOT_SAME_ORIGIN', LOCAL_AI_RUNTIME_STAGES.IMPORT);
            notifyStage(LOCAL_AI_RUNTIME_STAGES.IMPORT);
            const module = await runStage(LOCAL_AI_RUNTIME_STAGES.IMPORT, () => importModule(resolved.href));
            const factoryName = FACTORIES[level];
            if (typeof module[factoryName] !== 'function') {
                throw runtimeError('LOCAL_AI_RUNTIME_FACTORY_MISSING', LOCAL_AI_RUNTIME_STAGES.IMPORT);
            }
            notifyStage(LOCAL_AI_RUNTIME_STAGES.INITIALIZATION);
            const runtime = await runStage(LOCAL_AI_RUNTIME_STAGES.INITIALIZATION, () => module[factoryName]({
                manifest: candidate.manifest,
                activePackage: installed.active,
                provenance: LOCAL_AI_RUNTIME_PROVENANCE[level],
                packageBaseUrl: new URL(candidate.baseUrl, origin).href,
                onProgress
            }));
            notifyStage(LOCAL_AI_RUNTIME_STAGES.SMOKE_TEST);
            try {
                if (level === 'A1') {
                    const vector = await runStage(LOCAL_AI_RUNTIME_STAGES.SMOKE_TEST, () => runtime.embed('verifica locale'));
                    if (!Array.isArray(vector) || vector.length < 8 || vector.some(value => !Number.isFinite(value))) {
                        throw runtimeError('LOCAL_AI_RUNTIME_SMOKE_TEST_FAILED', LOCAL_AI_RUNTIME_STAGES.SMOKE_TEST);
                    }
                } else {
                    const result = await runStage(LOCAL_AI_RUNTIME_STAGES.SMOKE_TEST, () => runtime.complete([
                        { role:'system', content:'Rispondi soltanto con {"ok":true}.' },
                        { role:'user', content:'Verifica locale.' }
                    ], { maxTokens:16, temperature:0 }));
                    if (typeof result?.choices?.[0]?.message?.content !== 'string') {
                        throw runtimeError('LOCAL_AI_RUNTIME_SMOKE_TEST_FAILED', LOCAL_AI_RUNTIME_STAGES.SMOKE_TEST);
                    }
                }
            } catch (error) {
                await runtime.dispose?.();
                throw error;
            }
            notifyStage(LOCAL_AI_RUNTIME_STAGES.VERIFICATION);
            await runStage(LOCAL_AI_RUNTIME_STAGES.VERIFICATION, () => packageManager.markVerified(level, candidate.manifest));
            return runtime;
        }
    });
}
