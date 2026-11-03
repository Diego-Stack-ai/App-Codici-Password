export const NATIVE_AI2_INSTALLATION_PLAN = Object.freeze({
    schemaVersion:1,
    status:'prototype',
    supportedPlatform:'windows-x64',
    minimum:Object.freeze({ ramGiB:32, hardwareConcurrency:8, storageBytes:8 * 1024 ** 3 }),
    host:Object.freeze({
        productName:'Motore locale AI.2',
        version:'0.1.0',
        runtime:'llama.cpp',
        endpoint:'http://127.0.0.1:32145',
        distribution:'Firebase Hosting',
        installerReady:false
    }),
    model:Object.freeze({
        family:'Qwen3',
        modelId:'Qwen/Qwen3-4B-GGUF',
        fileName:'qwen3-4b-q4_k_m.gguf',
        quantization:'Q4_K_M',
        license:'Apache-2.0',
        source:'https://huggingface.co/Qwen/Qwen3-4B-GGUF',
        distribution:'Firebase Hosting',
        approximateDownloadBytes:2_500_000_000,
        releaseReady:false
    })
});

export function nativeAi2InstallSummary(plan = NATIVE_AI2_INSTALLATION_PLAN) {
    return Object.freeze({
        title:'Installa Codex AI.2 sul PC',
        body:[
            'Prima verifichiamo memoria, processore e spazio disponibile.',
            'Se il PC è compatibile, Windows installerà il Motore locale AI.2 e scaricherà il modello approvato dai server dell’app.',
            'Domande e risposte verranno elaborate soltanto su questo PC; la Ricerca continuerà a funzionare anche senza AI.2.',
            'AI.2 potrà essere rimossa in qualsiasi momento senza eliminare i dati dell’app.'
        ].join('\n'),
        requirements:`Almeno ${plan.minimum.ramGiB} GB di RAM, ${plan.minimum.hardwareConcurrency} processori logici e 8 GB liberi.`,
        ready:plan.host.installerReady && plan.model.releaseReady
    });
}
