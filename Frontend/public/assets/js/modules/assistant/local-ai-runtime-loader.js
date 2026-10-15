import { assessLocalAiCapabilities } from './advanced-local-ai-contract.js';
import { getLocalAiPackageCandidate, LOCAL_AI_RUNTIME_PROVENANCE } from './local-ai-package-catalog.js';

const FACTORIES = Object.freeze({ A2:'createSemanticRuntime', A3:'createGenerativeRuntime' });

export function createLocalAiRuntimeLoader({ packageManager, importModule = url => import(url), origin = location.origin } = {}) {
    if (!packageManager) throw new TypeError('LOCAL_AI_PACKAGE_MANAGER_REQUIRED');
    return Object.freeze({
        async load(level, { capabilities, runtimeUrl } = {}) {
            const candidate = getLocalAiPackageCandidate(level);
            if (!candidate) throw new Error('LOCAL_AI_LEVEL_UNKNOWN');
            if (candidate.status !== 'available') throw new Error(`LOCAL_AI_BLOCKED_${candidate.blockReason}`);
            const installed = await packageManager.status(level);
            if (!installed.installed) throw new Error('LOCAL_AI_PACKAGE_NOT_INSTALLED');
            const assessed = assessLocalAiCapabilities(capabilities);
            if (assessed[level].status !== 'candidate') throw new Error(`LOCAL_AI_CAPABILITY_${assessed[level].reasons.join('_')}`);
            const resolved = new URL(runtimeUrl, origin);
            if (resolved.origin !== origin) throw new Error('LOCAL_AI_RUNTIME_NOT_SAME_ORIGIN');
            const module = await importModule(resolved.href);
            const factoryName = FACTORIES[level];
            if (typeof module[factoryName] !== 'function') throw new Error('LOCAL_AI_RUNTIME_FACTORY_MISSING');
            return module[factoryName]({
                manifest: candidate.manifest,
                activePackage: installed.active,
                provenance: LOCAL_AI_RUNTIME_PROVENANCE[level]
            });
        }
    });
}
