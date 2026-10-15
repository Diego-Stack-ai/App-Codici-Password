import { validateLocalAiPackageManifest } from './advanced-local-ai-contract.js';

const MIB = 1024 * 1024;
const file = (path, bytes, sha256) => Object.freeze({ path, bytes, sha256 });

const A2_MANIFEST = validateLocalAiPackageManifest({
    schemaVersion:1, level:'A2', packageId:'granite-embedding-97m-multilingual-r2-onnx-int8', version:'0.1.0',
    runtime:'transformers-js-onnx',
    model:{ provider:'yuiseki / IBM Granite', modelId:'yuiseki/granite-embedding-97m-multilingual-r2-ONNX', revision:'9639449beea46c2d70bc73c31458f71ad7eed838', license:'Apache-2.0' },
    approxDownloadBytes:123314242, maxResidentBytes:512*MIB,
    locales:['it-IT','en-US','es-ES','fr-FR','de-DE','zh-CN','hi-IN','pt-PT'],
    files:[
        file('config.json',1434,'158faef5a1c800f6b3a17ed203b19afa1333f1c9feb4c6fd119ed54b5230a8af'),
        file('special_tokens_map.json',915,'5da6758d4a4d592669c66160a0b843715c37e6ed17800be46739a5e33535195a'),
        file('tokenizer_config.json',13411,'e4b6be9f10f25a65484c887d91d460a96690c98cb6a342c9f6f73dd7a0d84481'),
        file('tokenizer.json',25301671,'51947676cae1f991fa51c6b9a24e14ee5460e5f0b9f692f13bb3159829d1592a'),
        file('onnx/model_quantized.onnx',97996811,'07ed833d6e9f5701ae56e3a6d1984f6e945fd21a7ef1fc7563fd3ae8d6f24098')
    ]
});

const A3_MANIFEST = validateLocalAiPackageManifest({
    schemaVersion:1, level:'A3', packageId:'qwen2.5-0.5b-instruct-q4f16-1-mlc', version:'0.1.0', runtime:'webllm-webgpu',
    model:{ provider:'MLC AI / Qwen', modelId:'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC', revision:'32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad', license:'Apache-2.0' },
    approxDownloadBytes:295598663, maxResidentBytes:Math.ceil(944.62*MIB),
    locales:['it-IT','en-US','es-ES','fr-FR','de-DE','zh-CN','pt-PT'],
    files:[
        file('merges.txt',1823226,'0de0bc38a29ea38eef099b677fa1ff52edd181e573529af26c4cd2136e233777'),
        file('mlc-chat-config.json',2124,'16a8905c488f41e75aa11b69fdb399d2a42ba81dc45ea301c5ea26f892256ae1'),
        file('ndarray-cache.json',105367,'4169968f8a491550fbeb02a9e33f6b098af66bbb77e9d772d0a16ccaffbddca9'),
        file('params_shard_0.bin',68067328,'9f309954d310dc63adfaf3ef6aa987c681b8aa6d1b9686aa2525b454b0d058d5'),
        file('params_shard_1.bin',33234176,'6d174758dd299d9ef4222b1ad4283be832ebd43853951da25b50501ab1b75ba7'),
        file('params_shard_2.bin',33505280,'83e0b530bf5c44cbead1a6c220af81040a975f7c81fb708977a02e3ac8d7ffa7'),
        file('params_shard_3.bin',33053696,'5ff16197c197d8783d398d0c35fa9641e606e6e2dc1d53b9f26a0c9c17a97921'),
        file('params_shard_4.bin',33020928,'a7a3d2b02aa9258154f250a714d1743672e423c5c7c8e5c5eefcb9bf337aa0fd'),
        file('params_shard_5.bin',29211648,'19dfd7a3064b84082915575c0e5a57fc1cd7108828e1ce9fbbbaf9db4b63b9af'),
        file('params_shard_6.bin',33297408,'192576d43956aa977ec60848b8a7fc8483b5fe38ca9669aa9a3ca2ba795a7a33'),
        file('params_shard_7.bin',14605824,'1ee25c2a41dad6833e000b7e3ec13a5a1761c32ffbed0ad8a98a6ad313338dc0'),
        file('tokenizer_config.json',7515,'3802064e7bf0f6b9352589bad4563d0e4c92a5830db636c2bc09e7d1de55c592'),
        file('tokenizer.json',7334926,'47ec9be242d3ef39b9c97ac0a3f06c1752f061b234e295bc0a2842067a3fe4f9'),
        file('vocab.json',2776833,'ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910'),
        file('lib/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm',5552384,'a618074b30f7d022ab7886d0cf57be2aefdac342901d43bee4e19110e1b4b739')
    ]
});

export const LOCAL_AI_RUNTIME_PROVENANCE = Object.freeze({
    A2:Object.freeze({ package:'@huggingface/transformers', version:'3.8.1', gitRevision:'2ec882e739e4cb461f8d440d4d7394cbf5372429', license:'Apache-2.0', licenseSha256:'3ddf9be5c28fe27dad143a5dc76eea25222ad1dd68934a047064e56ed2fa40c5', upstreamRevision:'835ad14087e140460703cf0fae09f97d469d65c2', npmIntegrity:'sha512-tsTk4zVjImqdqjS8/AOZg2yNLd1z9S5v+7oUPpXaasDRwEDhB+xnglK1k5cad26lL5/ZIaeREgWWy0bs9y9pPA==' }),
    A3:Object.freeze({ package:'@mlc-ai/web-llm', version:'0.2.86', gitRevision:'c42c36670cfc426c75e53ee297443882f1ae8d84', license:'Apache-2.0', licenseSha256:'2924cf70d9e0ee3786cea316851ac9f4fe49e56de5c3124f6b69cccfdb248187', npmIntegrity:'sha512-plciXBCYtY7iTKHzEcsqOfSO+s5u8NqMYFPnHmRbsN8CEdKcolgXIoGLPbzO6FtJHV43m7YP00x6qQ6Kb8CJJw==', modelLibraryRevision:'00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0', upstreamRevision:'7ae557604adf67be50417f59c2c2f167def9a775', upstreamLicenseSha256:'832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e' })
});

export const LOCAL_AI_PACKAGE_CATALOG = Object.freeze({
    A2:Object.freeze({ level:'A2', status:'blocked', blockReason:'same-origin-artifacts-not-hosted', manifest:A2_MANIFEST, source:'https://huggingface.co/yuiseki/granite-embedding-97m-multilingual-r2-ONNX' }),
    A3:Object.freeze({ level:'A3', status:'blocked', blockReason:'same-origin-artifacts-not-hosted', manifest:A3_MANIFEST, source:'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC' })
});

export function getLocalAiPackageCandidate(level) { return LOCAL_AI_PACKAGE_CATALOG[level] || null; }
