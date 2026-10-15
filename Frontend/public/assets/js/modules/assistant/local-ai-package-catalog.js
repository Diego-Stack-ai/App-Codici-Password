import { validateLocalAiPackageManifest } from './advanced-local-ai-contract.js';

const MIB = 1024 * 1024;
const file = (path, bytes, sha256) => Object.freeze({ path, bytes, sha256 });

const A2_MANIFEST = validateLocalAiPackageManifest({
    schemaVersion:1, level:'A2', packageId:'granite-embedding-97m-multilingual-r2-onnx-int8', version:'0.1.0',
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
        file('runtime/factory.js',824,'c4a9079773a6e2ac945329e898661f956a7ad312cba22475b6420d4c94315fc7'),
        file('runtime/ort-wasm-simd-threaded.jsep.mjs',44484,'08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9'),
        file('runtime/ort-wasm-simd-threaded.jsep.wasm',21596019,'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39'),
        file('runtime/transformers.bundle.js',893963,'3b025bd3419b4876c017008839f79972d55446c534b30df920824bb1d51190d9')
    ]
});

const A3_MANIFEST = validateLocalAiPackageManifest({
    schemaVersion:1, level:'A3', packageId:'qwen2.5-0.5b-instruct-q4f16-1-mlc', version:'0.1.0', runtime:'webllm-webgpu',
    model:{ provider:'MLC AI / Qwen', modelId:'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', revision:'32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad', license:'Apache-2.0' },
    approxDownloadBytes:301982152, maxResidentBytes:Math.ceil(944.62*MIB),
    locales:['it-IT','en-US','es-ES','fr-FR','de-DE','zh-CN','pt-PT'],
    files:[
        file('LICENSE-model.txt',11343,'832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e'),
        file('LICENSE-runtime.txt',11726,'87935f332472db09253871326ef23d5d6a45f4fd2e6c96772f72052866dfab0d'),
        file('merges.txt',1671839,'599bab54075088774b1733fde865d5bd747cbcc7a547c5bc12610e874e26f5e3'),
        file('mlc-chat-config.json',2041,'5439c03bdf4ee7cfe0f8a97a6588018b0144dc1280c71bbaea2853cdbab874b9'),
        file('ndarray-cache.json',102431,'23a54b5e9b271204561901b513c5b359498733429ee219ccc907eb1cd0790e3f'),
        file('params_shard_0.bin',68067328,'9f309954d310dc63adfaf3ef6aa987c681b8aa6d1b9686aa2525b454b0d058d5'),
        file('params_shard_1.bin',33234176,'6d174758dd299d9ef4222b1ad4283be832ebd43853951da25b50501ab1b75ba7'),
        file('params_shard_2.bin',33505280,'83e0b530bf5c44cbead1a6c220af81040a975f7c81fb708977a02e3ac8d7ffa7'),
        file('params_shard_3.bin',33053696,'5ff16197c197d8783d398d0c35fa9641e606e6e2dc1d53b9f26a0c9c17a97921'),
        file('params_shard_4.bin',33020928,'a7a3d2b02aa9258154f250a714d1743672e423c5c7c8e5c5eefcb9bf337aa0fd'),
        file('params_shard_5.bin',29211648,'19dfd7a3064b84082915575c0e5a57fc1cd7108828e1ce9fbbbaf9db4b63b9af'),
        file('params_shard_6.bin',33297408,'192576d43956aa977ec60848b8a7fc8483b5fe38ca9669aa9a3ca2ba795a7a33'),
        file('params_shard_7.bin',14605824,'1ee25c2a41dad6833e000b7e3ec13a5a1761c32ffbed0ad8a98a6ad313338dc0'),
        file('runtime/factory.js',975,'2611311e6642b11ac4fb8111ec361c77626fe452c93ec73306ce1cc5e935e4bb'),
        file('runtime/web-llm.js',6817339,'ae2642e73a4a9896c21efb3a067c4666446f8b49cbe2012f4b576f5d83d5f206'),
        file('tokenizer_config.json',7308,'5214600ee45ca2f887ce2eede8910378a0111ea99d657428bcbce94778e65a92'),
        file('tokenizer.json',7031645,'c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539'),
        file('vocab.json',2776833,'ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910'),
        file('lib/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',5552384,'a618074b30f7d022ab7886d0cf57be2aefdac342901d43bee4e19110e1b4b739')
    ]
});

export const LOCAL_AI_RUNTIME_PROVENANCE = Object.freeze({
    A2:Object.freeze({ package:'@huggingface/transformers', version:'3.8.1', gitRevision:'2ec882e739e4cb461f8d440d4d7394cbf5372429', license:'Apache-2.0', licenseSha256:'3ddf9be5c28fe27dad143a5dc76eea25222ad1dd68934a047064e56ed2fa40c5', upstreamRevision:'835ad14087e140460703cf0fae09f97d469d65c2', npmIntegrity:'sha512-tsTk4zVjImqdqjS8/AOZg2yNLd1z9S5v+7oUPpXaasDRwEDhB+xnglK1k5cad26lL5/ZIaeREgWWy0bs9y9pPA==' }),
    A3:Object.freeze({ package:'@mlc-ai/web-llm', version:'0.2.86', gitRevision:'c42c36670cfc426c75e53ee297443882f1ae8d84', license:'Apache-2.0', licenseSha256:'2924cf70d9e0ee3786cea316851ac9f4fe49e56de5c3124f6b69cccfdb248187', npmIntegrity:'sha512-plciXBCYtY7iTKHzEcsqOfSO+s5u8NqMYFPnHmRbsN8CEdKcolgXIoGLPbzO6FtJHV43m7YP00x6qQ6Kb8CJJw==', modelLibraryRevision:'00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0', upstreamRevision:'7ae557604adf67be50417f59c2c2f167def9a775', upstreamLicenseSha256:'832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e' })
});

export const LOCAL_AI_PACKAGE_CATALOG = Object.freeze({
    A2:Object.freeze({ level:'A2', status:'available', blockReason:null, manifest:A2_MANIFEST,
        baseUrl:'/assets/local-ai/a2/granite-embedding-97m-multilingual-r2-onnx-int8/0.1.0/',
        runtimeUrl:'/assets/local-ai/a2/granite-embedding-97m-multilingual-r2-onnx-int8/0.1.0/runtime/factory.js',
        source:'https://huggingface.co/yuiseki/granite-embedding-97m-multilingual-r2-ONNX' }),
    A3:Object.freeze({ level:'A3', status:'available', blockReason:null, manifest:A3_MANIFEST,
        baseUrl:'/assets/local-ai/a3/qwen2.5-0.5b-instruct-q4f16-1-mlc/0.1.0/',
        runtimeUrl:'/assets/local-ai/a3/qwen2.5-0.5b-instruct-q4f16-1-mlc/0.1.0/runtime/factory.js',
        source:'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC' })
});

export function getLocalAiPackageCandidate(level) { return LOCAL_AI_PACKAGE_CATALOG[level] || null; }
