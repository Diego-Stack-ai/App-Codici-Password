import { validateLocalAiPackageManifest } from './advanced-local-ai-contract.js';
import { HOSTED_ADVANCED_AI_CATALOG } from './local-ai-hosting-catalog.generated.js';

const MIB = 1024 * 1024;
const file = (path, bytes, sha256) => Object.freeze({ path, bytes, sha256 });
const ADVANCED_RUNTIME_URL = '/assets/js/modules/assistant/local-ai-generative-runtime-factory.js';

const A1_MANIFEST = validateLocalAiPackageManifest({
    schemaVersion:1, level:'A1', packageId:'granite-embedding-97m-multilingual-r2-onnx-int8', version:'0.1.0',
    runtime:'transformers-js-onnx',
    model:{ provider:'yuiseki / IBM Granite', modelId:'yuiseki/granite-embedding-97m-multilingual-r2-ONNX', revision:'9639449beea46c2d70bc73c31458f71ad7eed838', license:'Apache-2.0' },
    approxDownloadBytes:145871600, maxResidentBytes:512*MIB,
    locales:['it-IT','en-US','es-ES','fr-FR','de-DE','zh-CN','hi-IN','pt-PT'],
    files:[
        file('LICENSE-model.txt',11358,'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'),
        file('LICENSE-runtime.txt',11358,'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'),
        file('model/config.json',1385,'d34a0d3f2eb4e1e46afccfd8670d6a0bc161b64f2b10d12fb0fe74eea6fb775b'),
        file('model/onnx/model_quantized.onnx',97996811,'07ed833d6e9f5701ae56e3a6d1984f6e945fd21a7ef1fc7563fd3ae8d6f24098'),
        file('model/special_tokens_map.json',871,'013787ee251ff611722479197c00853b62113ad303cb0a36524231783c676c69'),
        file('model/tokenizer_config.json',12856,'9b628d2b366a8350b944fd0914f24f4e0b100bbf120d47b9c59e44dfb2a1b63f'),
        file('model/tokenizer.json',25301671,'51947676cae1f991fa51c6b9a24e14ee5460e5f0b9f692f13bb3159829d1592a'),
        file('runtime/factory.js',824,'15c3a51caa7dae2973d8c617e3ce69ebd30a63cf10933c5ca87d5f66cce27c0a'),
        file('runtime/ort-wasm-simd-threaded.jsep.mjs',44484,'08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9'),
        file('runtime/ort-wasm-simd-threaded.jsep.wasm',21596019,'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39'),
        file('runtime/transformers.bundle.js',893963,'3b025bd3419b4876c017008839f79972d55446c534b30df920824bb1d51190d9')
    ]
});

export const LOCAL_AI_RUNTIME_PROVENANCE = Object.freeze({
    A1:Object.freeze({ package:'@huggingface/transformers', version:'3.8.1', gitRevision:'2ec882e739e4cb461f8d440d4d7394cbf5372429', license:'Apache-2.0', licenseSha256:'3ddf9be5c28fe27dad143a5dc76eea25222ad1dd68934a047064e56ed2fa40c5', upstreamRevision:'835ad14087e140460703cf0fae09f97d469d65c2', npmIntegrity:'sha512-tsTk4zVjImqdqjS8/AOZg2yNLd1z9S5v+7oUPpXaasDRwEDhB+xnglK1k5cad26lL5/ZIaeREgWWy0bs9y9pPA==' }),
    A2:Object.freeze({ package:'@mlc-ai/web-llm', version:'0.2.86', gitRevision:'c42c36670cfc426c75e53ee297443882f1ae8d84', license:'Apache-2.0', licenseSha256:'2924cf70d9e0ee3786cea316851ac9f4fe49e56de5c3124f6b69cccfdb248187', npmIntegrity:'sha512-plciXBCYtY7iTKHzEcsqOfSO+s5u8NqMYFPnHmRbsN8CEdKcolgXIoGLPbzO6FtJHV43m7YP00x6qQ6Kb8CJJw==', modelLibraryRevision:'00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0', upstreamRevision:'aa8e72537993ba99e69dfaafa59ed015b17504d1', upstreamLicenseSha256:'ef52482bb785733093dc9a2e8edd8e764c77d12d8e9d8f10a80c9b547d32d0f9' })
});

export const LOCAL_AI_ADVANCED_TIERS = Object.freeze({
    desktop32:Object.freeze({ ...HOSTED_ADVANCED_AI_CATALOG.desktop32,
        manifest:validateLocalAiPackageManifest(HOSTED_ADVANCED_AI_CATALOG.desktop32.manifest),
        minimum:Object.freeze({ confirmedRamGiB:32, hardwareConcurrency:8, storageBytes:6*1024*1024*1024 }),
        artifactPlan:Object.freeze({ packageId:'qwen2.5-3b-instruct-q4f16-1-mlc', quantization:'q4f16_1',
            modelSource:'https://huggingface.co/mlc-ai/Qwen2.5-3B-Instruct-q4f16_1-MLC', revision:'7690aaaa46df36b1be0fe93b9c9abac0497eff6c',
            upstream:'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct', license:'Apache-2.0',
            approxDownloadBytes:HOSTED_ADVANCED_AI_CATALOG.desktop32.manifest.approxDownloadBytes, weightFiles:62,
            maxResidentBytes:HOSTED_ADVANCED_AI_CATALOG.desktop32.manifest.maxResidentBytes,
            runtimeLibrary:'Qwen2.5-3B-Instruct-q4f16_1_cs1k-webgpu.wasm', contextWindowSize:4096 }) })
});

export const LOCAL_AI_PACKAGE_CATALOG = Object.freeze({
    A1:Object.freeze({ level:'A1', legacyLevel:'A2', status:'available', blockReason:null, manifest:A1_MANIFEST,
        baseUrl:'/assets/local-ai/a2/granite-embedding-97m-multilingual-r2-onnx-int8/0.1.0/',
        runtimeUrl:'/assets/local-ai/a2/granite-embedding-97m-multilingual-r2-onnx-int8/0.1.0/runtime/factory.js',
        source:'https://huggingface.co/yuiseki/granite-embedding-97m-multilingual-r2-ONNX' }),
    A2:Object.freeze({ ...LOCAL_AI_ADVANCED_TIERS.desktop32, tiers:LOCAL_AI_ADVANCED_TIERS })
});

export function getLocalAiPackageCandidate(level, { tier = 'desktop32' } = {}) {
    if (level === 'A2') return LOCAL_AI_ADVANCED_TIERS[tier] || null;
    return LOCAL_AI_PACKAGE_CATALOG[level] || null;
}
