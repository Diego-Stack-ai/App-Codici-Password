// Generato da scripts/generate-local-ai-hosting-catalog.mjs. Non modificare a mano.
export const HOSTED_ADVANCED_AI_CATALOG = Object.freeze({
  "medium": {
    "tier": "medium",
    "level": "A2",
    "status": "available",
    "blockReason": null,
    "baseUrl": "/assets/local-ai-packages/a2/qwen2.5-1.5b-instruct-q4f16-1-mlc/0.1.0/",
    "runtimeUrl": "/assets/js/modules/assistant/local-ai-generative-runtime-factory.js",
    "source": "https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    "manifest": {
      "schemaVersion": 1,
      "level": "A2",
      "packageId": "qwen2.5-1.5b-instruct-q4f16-1-mlc",
      "version": "0.1.0",
      "runtime": "webllm-webgpu",
      "model": {
        "provider": "MLC AI / Qwen",
        "modelId": "mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
        "revision": "9bd564b064631febf14deadcac492efb761d60c3",
        "license": "Apache-2.0"
      },
      "approxDownloadBytes": 893034433,
      "maxResidentBytes": 1708916736,
      "locales": [
        "it-IT",
        "en-US",
        "es-ES",
        "fr-FR",
        "de-DE",
        "zh-CN",
        "pt-PT"
      ],
      "files": [
        {
          "path": "lib/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
          "bytes": 6031744,
          "sha256": "436462adad407e0914d2350fd452a5a3d983e0031d77c940c43ea351c8cd3000"
        },
        {
          "path": "LICENSE-model.txt",
          "bytes": 11343,
          "sha256": "832dd9e00a68dd83b3c3fb9f5588dad7dcf337a0db50f7d9483f310cd292e92e"
        },
        {
          "path": "LICENSE-runtime.txt",
          "bytes": 11726,
          "sha256": "87935f332472db09253871326ef23d5d6a45f4fd2e6c96772f72052866dfab0d"
        },
        {
          "path": "merges.txt",
          "bytes": 1671839,
          "sha256": "599bab54075088774b1733fde865d5bd747cbcc7a547c5bc12610e874e26f5e3"
        },
        {
          "path": "mlc-chat-config.json",
          "bytes": 2043,
          "sha256": "7da4954212d3f21a91cc3e693d179f63213fd57356796847f65d7f95478a1f9e"
        },
        {
          "path": "ndarray-cache.json",
          "bytes": 124489,
          "sha256": "6d16a8936b1c9f372305064c4688eae17a609b62693f6782454d4fa2055c6e94"
        },
        {
          "path": "params_shard_0.bin",
          "bytes": 116686848,
          "sha256": "29e46841454786b2c36cbcfd1d9a0777f8cb2bb55fb7cdf9ebd3df6ea6aa61f6"
        },
        {
          "path": "params_shard_1.bin",
          "bytes": 22330368,
          "sha256": "a99a03870f60127bdc3891f0bdc13a0f6e25efa984e9a5d6b188b5aae6f4fbae"
        },
        {
          "path": "params_shard_10.bin",
          "bytes": 26331136,
          "sha256": "cbe9fa5eaff5463502bf9cc766b39081482e7df30ffc250d8f3e83c45d1700d1"
        },
        {
          "path": "params_shard_11.bin",
          "bytes": 26331136,
          "sha256": "f99e7bfc14e17d88d905360dd1f0ecbaab98d5778acdd762e397254c293a2b42"
        },
        {
          "path": "params_shard_12.bin",
          "bytes": 26331136,
          "sha256": "3ec7ea81f305fc10b5ed9958ae279486d113d2621029f5f4a4cb820bc803c2ca"
        },
        {
          "path": "params_shard_13.bin",
          "bytes": 26331136,
          "sha256": "6eb032a6d30b5d2bbf4b0d16ecdfaf6fa295dffa676e828917d5f8fe4d4d7ef2"
        },
        {
          "path": "params_shard_14.bin",
          "bytes": 26331136,
          "sha256": "e1a10d9e18641e9eab280e7c9cb4c7ee05b6dc3ab35b244ffe559da00b1fc950"
        },
        {
          "path": "params_shard_15.bin",
          "bytes": 26331136,
          "sha256": "fe24b3ddc07e311556e6968bb62506ae8980ca1ec55393f12ae41de468d93067"
        },
        {
          "path": "params_shard_16.bin",
          "bytes": 26331136,
          "sha256": "f86a010144bfae8748ac0abdd705d3d9c54bcb864bc51a4b7d3da8dab7d6c379"
        },
        {
          "path": "params_shard_17.bin",
          "bytes": 26331136,
          "sha256": "b473e5c8b5c226c751a393d666066cb6e8b1bf7e61604691a31fea2f82abef66"
        },
        {
          "path": "params_shard_18.bin",
          "bytes": 26331136,
          "sha256": "e36912a08ea82dfdcad4ebc288a6541d2112038e987d98f7f2f5cd8f8957cf2d"
        },
        {
          "path": "params_shard_19.bin",
          "bytes": 26331136,
          "sha256": "795125e8c8eb20e28733df956ab32bb57ea2376ec99cd84b4d36f8f6f32b1f42"
        },
        {
          "path": "params_shard_2.bin",
          "bytes": 26331136,
          "sha256": "c67f6aff8524441396efaa09488ea4536437e35389e0843d87fda796be9d3412"
        },
        {
          "path": "params_shard_20.bin",
          "bytes": 26331136,
          "sha256": "ea919f0b2a79aa359eab6cc8003dfce9cf7c742fe254651211793eb56bfb3122"
        },
        {
          "path": "params_shard_21.bin",
          "bytes": 26331136,
          "sha256": "221e4cef4c28ac298fd44678378e506188a537f2752e0aba2f45066fdee27a85"
        },
        {
          "path": "params_shard_22.bin",
          "bytes": 26331136,
          "sha256": "13c31268f630b52a72c158f2b7d97a672d128e760540b318566cfd70fe5e62ee"
        },
        {
          "path": "params_shard_23.bin",
          "bytes": 26331136,
          "sha256": "498c729548a5afbf07735b0183534867cad01dc57132ae1e8802041f193f6f23"
        },
        {
          "path": "params_shard_24.bin",
          "bytes": 26331136,
          "sha256": "103fdc607fcb3dc31d0861999f1f692768a3e2edfa81ef2f53eefc6713caf8ae"
        },
        {
          "path": "params_shard_25.bin",
          "bytes": 26331136,
          "sha256": "d60dffdf3c88f4990e04a18c343a0ce479b8f98960afb75154a1a835f29f6ea4"
        },
        {
          "path": "params_shard_26.bin",
          "bytes": 26331136,
          "sha256": "086adb852f72e13c69f0cd06628375f4d5810d8fb8e00450fb1e1c964b510f77"
        },
        {
          "path": "params_shard_27.bin",
          "bytes": 26331136,
          "sha256": "473be20481f3a4dcdb7128827edfe16e92c6d1b3019c330ff4dd05156a1f9a43"
        },
        {
          "path": "params_shard_28.bin",
          "bytes": 26331136,
          "sha256": "a7f2c9235da81fce6230b160007449d8f000a1f8c57a68313dce91ca080f088f"
        },
        {
          "path": "params_shard_29.bin",
          "bytes": 18589696,
          "sha256": "59a8497760bc9da56ce4619e082490c607b3f107bad7ec312fb33ce1a0d3dc71"
        },
        {
          "path": "params_shard_3.bin",
          "bytes": 26331136,
          "sha256": "b14d44d720b45dbedd9c7786f1f9db1ce79392fcda0ecc8cbd6deddef6ca3ebd"
        },
        {
          "path": "params_shard_4.bin",
          "bytes": 26331136,
          "sha256": "e96c7b30a24f581df1ee5758e1697a214187a89e9e9bc93529950e2f16beecbf"
        },
        {
          "path": "params_shard_5.bin",
          "bytes": 26331136,
          "sha256": "8370ade73f96fe5cdb4a816da39703032ca5610699e9714790e6e9c49be5086e"
        },
        {
          "path": "params_shard_6.bin",
          "bytes": 26331136,
          "sha256": "48e651ada394e162b0bb016d8b3e340a8d29b0b67e06121ecdc6c368eec1b96d"
        },
        {
          "path": "params_shard_7.bin",
          "bytes": 26331136,
          "sha256": "9eb581bc89582d23c43f66197a63ca2e80291c32eefd66695f6b6eaedf3e24ab"
        },
        {
          "path": "params_shard_8.bin",
          "bytes": 26331136,
          "sha256": "f8d5dfd8eaf86d361d20310d1d9aa7ba661156112d8524874aae78410cb3b663"
        },
        {
          "path": "params_shard_9.bin",
          "bytes": 26331136,
          "sha256": "ace7a4a00e819481571e08ead14f031e3b014f6f8cef665142b6b6463045b493"
        },
        {
          "path": "runtime/factory.js",
          "bytes": 819,
          "sha256": "9c0a436bce85591da508fc9cf3836e77494d28736d497bd58fc3aae8441a136e"
        },
        {
          "path": "runtime/web-llm.js",
          "bytes": 6817060,
          "sha256": "ec4bb3ee4de76747bc05a7ca1e29e97d3828315f3ede1d09ed279ab1c3bf6641"
        },
        {
          "path": "tokenizer_config.json",
          "bytes": 7308,
          "sha256": "5214600ee45ca2f887ce2eede8910378a0111ea99d657428bcbce94778e65a92"
        },
        {
          "path": "tokenizer.json",
          "bytes": 7031645,
          "sha256": "c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539"
        },
        {
          "path": "vocab.json",
          "bytes": 2776833,
          "sha256": "ca10d7e9fb3ed18575dd1e277a2579c16d108e32f27439684afa0e10b1440910"
        }
      ]
    }
  },
  "power": {
    "tier": "power",
    "level": "A2",
    "status": "available",
    "blockReason": null,
    "baseUrl": "/assets/local-ai-packages/a2/smollm2-1.7b-instruct-q4f16-1-mlc/0.1.0/",
    "runtimeUrl": "/assets/js/modules/assistant/local-ai-generative-runtime-factory.js",
    "source": "https://huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    "manifest": {
      "schemaVersion": 1,
      "level": "A2",
      "packageId": "smollm2-1.7b-instruct-q4f16-1-mlc",
      "version": "0.1.0",
      "runtime": "webllm-webgpu",
      "model": {
        "provider": "MLC AI / Hugging Face",
        "modelId": "mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC",
        "revision": "84f57f8580a9d8d623266b600ad4273bb9fd84c1",
        "license": "Apache-2.0"
      },
      "approxDownloadBytes": 979573255,
      "maxResidentBytes": 1860373054,
      "locales": [
        "it-IT",
        "en-US",
        "es-ES",
        "fr-FR",
        "de-DE",
        "zh-CN",
        "pt-PT"
      ],
      "files": [
        {
          "path": "lib/SmolLM2-1.7B-Instruct-q4f16_1_cs1k-webgpu.wasm",
          "bytes": 6460459,
          "sha256": "60ba2472d38d66fa4d8ed02821c1fbd7c448ddcde8c948571ace6ac6d996cba4"
        },
        {
          "path": "LICENSE-model.txt",
          "bytes": 11358,
          "sha256": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30"
        },
        {
          "path": "LICENSE-runtime.txt",
          "bytes": 11726,
          "sha256": "87935f332472db09253871326ef23d5d6a45f4fd2e6c96772f72052866dfab0d"
        },
        {
          "path": "merges.txt",
          "bytes": 466391,
          "sha256": "0b54e8aa4e53d5383e2e4bc635a56b43f9647f7b13832d5d9ecd8f82dac4f510"
        },
        {
          "path": "mlc-chat-config.json",
          "bytes": 2023,
          "sha256": "b246a0cdcbdc65d546b320c960555f505c4f061af919df9ac7d793895f3d48e5"
        },
        {
          "path": "ndarray-cache.json",
          "bytes": 100963,
          "sha256": "401785d0f2954180a35ecde35c23955afd132872e47e1047519a028262bfd7f0"
        },
        {
          "path": "params_shard_0.bin",
          "bytes": 50331648,
          "sha256": "669337a7863daaa8461386d37c6a6fc93f32432a507063874a54f1e652864b50"
        },
        {
          "path": "params_shard_1.bin",
          "bytes": 32509952,
          "sha256": "3b06106f13524cf711cd9adbbe991faf41219f8815cac6d492b1973f4a51a056"
        },
        {
          "path": "params_shard_10.bin",
          "bytes": 28315648,
          "sha256": "dc6a1862de635042a53e39c68e70feabac6d9b5888caea15b2abe72da5ad5bc7"
        },
        {
          "path": "params_shard_11.bin",
          "bytes": 16777216,
          "sha256": "374e196842dc01032478b29e46d7f7ac85af0125cb1fc767c28980e5d32cdd90"
        },
        {
          "path": "params_shard_12.bin",
          "bytes": 30420992,
          "sha256": "3baf0c943fcff63aba50d0949acc8e45a65fa74e5181964e5f4bf0d001c79c9c"
        },
        {
          "path": "params_shard_13.bin",
          "bytes": 28315648,
          "sha256": "12b9152eb50a534e7ff2a2e5004a2b03fc05e1f2528b013f9bb8977e523a56cf"
        },
        {
          "path": "params_shard_14.bin",
          "bytes": 16777216,
          "sha256": "bbdd552b53ffd29687ab1357f05a9aff133489f44daea0f3bed49b59a94d99d0"
        },
        {
          "path": "params_shard_15.bin",
          "bytes": 30420992,
          "sha256": "bd1746861c89cdb79afb74dda4499d39c3dc1c18d38b7c9d7b79d2ac95abf132"
        },
        {
          "path": "params_shard_16.bin",
          "bytes": 28315648,
          "sha256": "d48924646b7c11f658ad92b1a532b9c51b614950656ce43787622e64071ec805"
        },
        {
          "path": "params_shard_17.bin",
          "bytes": 16777216,
          "sha256": "49086928548444f9b7fb8cac54f2560cf80aeb8caedc711c5d4b4452ff420c82"
        },
        {
          "path": "params_shard_18.bin",
          "bytes": 30420992,
          "sha256": "91bea1e3348d426ac9951b972a79cf942a67443e74d993ecfc7c685cfb8df35f"
        },
        {
          "path": "params_shard_19.bin",
          "bytes": 28315648,
          "sha256": "c5abaa24e0c782ab866e8294e3689383743cfc61f1eba940465f4ea3a0af6352"
        },
        {
          "path": "params_shard_2.bin",
          "bytes": 16777216,
          "sha256": "0a3d8fb171aada94a73c3c7326e3a80ffffeef64a1df7ff225112a4b3f1c0dac"
        },
        {
          "path": "params_shard_20.bin",
          "bytes": 16777216,
          "sha256": "3863eee9b38531002df9cad67c4aae695efdac84673b4051727e5d66dc670458"
        },
        {
          "path": "params_shard_21.bin",
          "bytes": 30420992,
          "sha256": "269f85ea4c93255c9e44b096ceae7163f35496c97ca446bd779f19656f682d63"
        },
        {
          "path": "params_shard_22.bin",
          "bytes": 28315648,
          "sha256": "946b4ec4c31f343a0ccaa90845a2c2bf2bc4af0947b392857361233d40853d47"
        },
        {
          "path": "params_shard_23.bin",
          "bytes": 16777216,
          "sha256": "f73d79db598fbba7620729ee579ed26af15ae008f7c1a1d411050fc07b60af47"
        },
        {
          "path": "params_shard_24.bin",
          "bytes": 30420992,
          "sha256": "8d71924c6d5cc461b549dce61bc5eed15a0859b4a451c4085dffaba56c761eff"
        },
        {
          "path": "params_shard_25.bin",
          "bytes": 28315648,
          "sha256": "a59e7b9cfcccbc9d560b9d91505ce10771865a80ba909264dcb1f5229e115fde"
        },
        {
          "path": "params_shard_26.bin",
          "bytes": 16777216,
          "sha256": "ada169dcb95b6e0561e7ae6a2e5fbf3414c6080a7963c96dae29c37eb2f941ba"
        },
        {
          "path": "params_shard_27.bin",
          "bytes": 30420992,
          "sha256": "f11613319a9a0dbb0369e24153c88f3f89fbfef449af6bd6d332680de8ae9240"
        },
        {
          "path": "params_shard_28.bin",
          "bytes": 28315648,
          "sha256": "d9da814961c6569a028eecb390f9815ad25312c55ff80000ea3ac56421770133"
        },
        {
          "path": "params_shard_29.bin",
          "bytes": 16777216,
          "sha256": "02424ed87af5f69d1d2b600bb44f5a4320778df3199fe0073edfe4d8dbf52127"
        },
        {
          "path": "params_shard_3.bin",
          "bytes": 32522240,
          "sha256": "1db95b8c07655b444fc14b3ec108cdf2ad1e4f3b08ca40b0554386a005090b0a"
        },
        {
          "path": "params_shard_30.bin",
          "bytes": 30420992,
          "sha256": "3f6a2c8aa692d070a176f32df8d78f31b537af6199e7d8787ccfd86b78b60907"
        },
        {
          "path": "params_shard_31.bin",
          "bytes": 28315648,
          "sha256": "7a4373d8e1b78bf2c633ff8655a2546f478ccf9d2e94424e1e347cc56cdb1dbf"
        },
        {
          "path": "params_shard_32.bin",
          "bytes": 16777216,
          "sha256": "557133b873d92c9f7ee02c721c9241257cc6741bd1f57a2c232a47df2793184c"
        },
        {
          "path": "params_shard_33.bin",
          "bytes": 30420992,
          "sha256": "6c85b99eb0d1cf798f39fa891f03195ccdcf8547b97e6dbec96c9e57072c6c1a"
        },
        {
          "path": "params_shard_34.bin",
          "bytes": 28315648,
          "sha256": "57d8bff6cf6505f31f334c510db9587ae4f46382fab11ac5017348f01d680c7b"
        },
        {
          "path": "params_shard_35.bin",
          "bytes": 16777216,
          "sha256": "1a18e8d1c8384685212b3221b64d24a00e83e7b8cbaacd8b7a39548e12165a9f"
        },
        {
          "path": "params_shard_36.bin",
          "bytes": 30420992,
          "sha256": "2782bf1884547d4fcc2257a5923298deb6eda885990ae69c184db1c02b24c27f"
        },
        {
          "path": "params_shard_4.bin",
          "bytes": 28315648,
          "sha256": "990d61768f7287802cafefca8cb7c714e7d90333eef47a9234f92216a080ed15"
        },
        {
          "path": "params_shard_5.bin",
          "bytes": 16777216,
          "sha256": "70b337f4a1e3fc0fdcc26e4ddc1428945e7b2d14495667678cf22db9d13dbfad"
        },
        {
          "path": "params_shard_6.bin",
          "bytes": 30420992,
          "sha256": "5a0816a9e5d17ec3c233ae0a1c1586bbfbd7aecdc8614debf87f46ef48b0e3ad"
        },
        {
          "path": "params_shard_7.bin",
          "bytes": 28315648,
          "sha256": "be743b234e9a4b09ff49e86f325d241a646199b820e9819969d9bf0f1c01fad0"
        },
        {
          "path": "params_shard_8.bin",
          "bytes": 16777216,
          "sha256": "8e054bc56e904fd16efa8e736d2ae1d7d675d828d586aa835d04add78271c19d"
        },
        {
          "path": "params_shard_9.bin",
          "bytes": 30420992,
          "sha256": "e3866cca4f5179828284e402340dc0e1c3f05cd73fbf7cdf7aa46ff63463f7cf"
        },
        {
          "path": "runtime/factory.js",
          "bytes": 821,
          "sha256": "bf115937b0d4c954546c7701e8bde49adebc8b581f68a8a0239e724c0b4988e5"
        },
        {
          "path": "runtime/web-llm.js",
          "bytes": 6817060,
          "sha256": "ec4bb3ee4de76747bc05a7ca1e29e97d3828315f3ede1d09ed279ab1c3bf6641"
        },
        {
          "path": "tokenizer_config.json",
          "bytes": 3764,
          "sha256": "a27f638bd2831f5c3dea654a75838930f2b11fbe550c4d4e1d5d7bd07157b2ee"
        },
        {
          "path": "tokenizer.json",
          "bytes": 2104556,
          "sha256": "9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c"
        },
        {
          "path": "vocab.json",
          "bytes": 800662,
          "sha256": "82b84012e3add4d01d12ba14442026e49b8cbbaead1f79ecf3d919784f82dc79"
        }
      ]
    }
  }
});
