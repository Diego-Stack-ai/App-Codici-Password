import { getLocalAiPackageCandidate, LOCAL_AI_RUNTIME_PROVENANCE } from './local-ai-package-catalog.js';

const FACTORIES = Object.freeze({ A1:'createSemanticRuntime', A2:'createGenerativeRuntime' });

export function createLocalAiRuntimeLoader({ packageManager, importModule = url => import(url), origin = location.origin } = {}) {
    if (!packageManager) throw new TypeError('LOCAL_AI_PACKAGE_MANAGER_REQUIRED');
    return Object.freeze({
        async load(level, { assessment, tier = 'light', runtimeUrl, onProgress = () => {} } = {}) {
            const candidate = getLocalAiPackageCandidate(level, { tier });
            if (!candidate) throw new Error('LOCAL_AI_LEVEL_UNKNOWN');
            if (candidate.status !== 'available') throw new Error(`LOCAL_AI_BLOCKED_${candidate.blockReason}`);
            const installed = await packageManager.status(level, {
                manifest:candidate.manifest,
                baseUrl:candidate.baseUrl,
                legacyLevel:candidate.legacyLevel
            });
            if (!installed.installed) throw new Error('LOCAL_AI_PACKAGE_NOT_INSTALLED');
            if (assessment?.[level]?.status !== 'candidate') {
                throw new Error(`LOCAL_AI_CAPABILITY_${assessment?.[level]?.reasons?.join('_') || 'UNAVAILABLE'}`);
            }
            if (level === 'A2' && !assessment.A2.allowedTiers?.includes(tier)) throw new Error('LOCAL_AI_TIER_NOT_ALLOWED');
            const resolved = new URL(runtimeUrl || candidate.runtimeUrl, origin);
            if (resolved.origin !== origin) throw new Error('LOCAL_AI_RUNTIME_NOT_SAME_ORIGIN');
            const module = await importModule(resolved.href);
            const factoryName = FACTORIES[level];
            if (typeof module[factoryName] !== 'function') throw new Error('LOCAL_AI_RUNTIME_FACTORY_MISSING');
            const runtime = await module[factoryName]({
                manifest: candidate.manifest,
                activePackage: installed.active,
                provenance: LOCAL_AI_RUNTIME_PROVENANCE[level],
                packageBaseUrl: new URL(candidate.baseUrl, origin).href,
                onProgress
            });
            if (level === 'A1') {
                const vector = await runtime.embed('verifica locale');
                if (!Array.isArray(vector) || vector.length < 8 || vector.some(value => !Number.isFinite(value))) {
                    await runtime.dispose?.();
                    throw new Error('LOCAL_AI_RUNTIME_SMOKE_TEST_FAILED');
                }
            } else {
                const result = await runtime.complete([
                    { role:'system', content:'Rispondi soltanto con {"ok":true}.' },
                    { role:'user', content:'Verifica locale.' }
                ], { maxTokens:16, temperature:0 });
                if (typeof result?.choices?.[0]?.message?.content !== 'string') {
                    await runtime.dispose?.();
                    throw new Error('LOCAL_AI_RUNTIME_SMOKE_TEST_FAILED');
                }
            }
            packageManager.markVerified(level, candidate.manifest);
            return runtime;
        }
    });
}
