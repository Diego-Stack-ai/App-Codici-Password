import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLocalAiPackageManager } from '../Frontend/public/assets/js/modules/assistant/local-ai-package-manager.js';

class MemoryCache {
    constructor() { this.entries = new Map(); }
    async put(request, response) { this.entries.set(request.url, response.clone()); }
    async match(request) { return this.entries.get(request.url)?.clone(); }
    async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}

class MemoryCaches {
    constructor() { this.caches = new Map(); }
    async open(name) { if (!this.caches.has(name)) this.caches.set(name, new MemoryCache()); return this.caches.get(name); }
    async delete(name) { return this.caches.delete(name); }
    async keys() { return [...this.caches.keys()]; }
}

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

async function digest(text) {
    const bytes = new TextEncoder().encode(text);
    return [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes))]
        .map(value => value.toString(16).padStart(2, '0')).join('');
}

async function fixture(overrides = {}) {
    const body = overrides.body ?? 'modello sintetico';
    const bytes = new TextEncoder().encode(body).byteLength;
    return {
        body,
        manifest: {
            schemaVersion: 1, level: 'A1', packageId: 'synthetic-semantic-model', version: '0.0.1',
            runtime: 'transformers-js-onnx',
            model: { provider: 'Fixture locale', modelId: 'synthetic/fixture', revision: 'test-only', license: 'Test fixture' },
            approxDownloadBytes: bytes, maxResidentBytes: bytes * 2, locales: ['it-IT'],
            files: [{ path: 'model.bin', bytes, sha256: await digest(body) }]
        }
    };
}

function manager(fetchFn, { available = 10_000 } = {}) {
    const cacheStorage = new MemoryCaches();
    const storage = memoryStorage();
    return { cacheStorage, storage, instance: createLocalAiPackageManager({
        cacheStorage, storage, fetchFn, cryptoApi: webcrypto,
        storageManager: { estimate: async () => ({ quota: available, usage: 0 }) },
        origin: 'https://app.example'
    }) };
}

test('la stima include il doppio spazio temporaneo necessario alla promozione atomica', async () => {
    const { body, manifest } = await fixture();
    const state = manager(async () => new Response(body));
    const estimate = await state.instance.estimate(manifest);
    assert.ok(estimate.temporaryRequiredBytes >= manifest.approxDownloadBytes * 2);
});

test('installa soltanto file con dimensione e SHA-256 corretti, poi rimuove ogni cache del livello', async () => {
    const { body, manifest } = await fixture();
    const state = manager(async () => new Response(body));
    const progress = [];
    const result = await state.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/', onProgress: value => progress.push(value) });
    assert.equal(result.completedBytes, manifest.approxDownloadBytes);
    assert.equal((await state.instance.status('A1')).installed, true);
    assert.equal(progress.at(-1).completedBytes, manifest.approxDownloadBytes);
    await state.instance.remove('A1');
    assert.equal((await state.instance.status('A1')).installed, false);
    assert.deepEqual(await state.cacheStorage.keys(), []);
});

test('un hash errato elimina lo staging e non attiva il pacchetto', async () => {
    const { manifest } = await fixture();
    const state = manager(async () => new Response('contenuto alterato'));
    await assert.rejects(state.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/' }), /SIZE_MISMATCH|HASH_MISMATCH/);
    assert.equal((await state.instance.status('A1')).installed, false);
    assert.deepEqual(await state.cacheStorage.keys(), []);
});

test('blocca quota insufficiente e URL che esce dal perimetro del pacchetto', async () => {
    const { body, manifest } = await fixture();
    const low = manager(async () => new Response(body), { available: 1 });
    await assert.rejects(low.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/' }), /QUOTA_INSUFFICIENT/);
    const scoped = manager(async () => new Response(body));
    await assert.rejects(scoped.instance.install(manifest, { baseUrl: 'https://models.invalid/a2/' }), /URL_SCOPE/);
});

test('abort interrompe un download senza promuovere un pacchetto parziale', async () => {
    const { manifest } = await fixture();
    const state = manager((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')), { once: true });
    }));
    const controller = new AbortController();
    const pending = state.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/', signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /abort/i);
    assert.equal((await state.instance.status('A1')).installed, false);
    assert.equal((await state.instance.status('A1')).installed, false);
});

test('un nuovo tentativo riusa i file completi e verificati rimasti nello staging', async () => {
    const first = 'primo file';
    const second = 'secondo file';
    const firstBytes = new TextEncoder().encode(first).byteLength;
    const secondBytes = new TextEncoder().encode(second).byteLength;
    const manifest = {
        schemaVersion:1, level:'A1', packageId:'synthetic-resume-model', version:'0.0.1',
        runtime:'transformers-js-onnx',
        model:{ provider:'Fixture locale', modelId:'synthetic/resume', revision:'test-only', license:'Test fixture' },
        approxDownloadBytes:firstBytes + secondBytes, maxResidentBytes:(firstBytes + secondBytes) * 2,
        locales:['it-IT'], files:[
            { path:'first.bin', bytes:firstBytes, sha256:await digest(first) },
            { path:'second.bin', bytes:secondBytes, sha256:await digest(second) }
        ]
    };
    let firstFetches = 0;
    let failSecond = true;
    const state = manager(async url => {
        if (String(url).endsWith('/first.bin')) { firstFetches += 1; return new Response(first); }
        if (failSecond) throw new TypeError('rete interrotta');
        return new Response(second);
    });
    await assert.rejects(state.instance.install(manifest, { baseUrl:'/ai/resume/0.0.1/' }), /rete interrotta/);
    failSecond = false;
    const progress = [];
    await state.instance.install(manifest, { baseUrl:'/ai/resume/0.0.1/', onProgress:value => progress.push(value) });
    assert.equal(firstFetches, 1);
    assert.equal(progress.some(value => value.path === 'first.bin' && value.resumed === true), true);
    assert.equal((await state.instance.status('A1')).installed, true);
});

test('riconosce dalla cache verificata un pacchetto installato anche se il marcatore locale manca', async () => {
    const { body, manifest } = await fixture();
    const state = manager(async () => new Response(body));
    await state.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/' });
    state.storage.removeItem('codex.local-ai.active.v1');
    const status = await state.instance.status('A1', { manifest, baseUrl: '/ai/a2/0.0.1/' });
    assert.equal(status.installed, true);
    assert.equal(JSON.parse(state.storage.getItem('codex.local-ai.active.v1')).A1.version, manifest.version);
});

test('non dichiara installato un pacchetto il cui marcatore punta a una cache assente', async () => {
    const { body, manifest } = await fixture();
    const state = manager(async () => new Response(body));
    await state.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/' });
    for (const name of await state.cacheStorage.keys()) await state.cacheStorage.delete(name);
    const status = await state.instance.status('A1', { manifest, baseUrl: '/ai/a2/0.0.1/' });
    assert.equal(status.installed, false);
    assert.equal(JSON.parse(state.storage.getItem('codex.local-ai.active.v1')).A1, undefined);
});

test('installato e verificato sono stati distinti', async () => {
    const { body, manifest } = await fixture();
    const state = manager(async () => new Response(body));
    await state.instance.install(manifest, { baseUrl: '/ai/a2/0.0.1/' });
    assert.equal((await state.instance.status('A1', { manifest, baseUrl:'/ai/a2/0.0.1/' })).verified, false);
    state.instance.markVerified('A1', manifest);
    assert.equal((await state.instance.status('A1', { manifest, baseUrl:'/ai/a2/0.0.1/' })).verified, true);
});

test('la nuova AI.1 riconosce la cache della vecchia AI.2 senza riscaricarla', async () => {
    const { body, manifest } = await fixture();
    const state = manager(async () => new Response(body));
    const oldName = `codex-local-ai-a2-${manifest.packageId}-${manifest.version}-ready`;
    const oldCache = await state.cacheStorage.open(oldName);
    await oldCache.put(new Request('https://app.example/ai/a2/0.0.1/model.bin'), new Response(body));
    const status = await state.instance.status('A1', { manifest, baseUrl:'/ai/a2/0.0.1/', legacyLevel:'A2' });
    assert.equal(status.installed, true);
    assert.match(status.active.cacheName, /local-ai-a2-/);
});
