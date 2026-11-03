import test from 'node:test';
import assert from 'node:assert/strict';
import {
    NATIVE_AI2_PAIRING_KEY,
    clearNativeAi2Pairing,
    createNativeAi2Client,
    queryLoopbackPermission,
    readNativeAi2Pairing
} from '../Frontend/public/assets/js/modules/assistant/native-ai2-client.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem:key => values.get(key) ?? null,
        setItem:(key, value) => values.set(key, String(value)),
        removeItem:key => values.delete(key)
    };
}

const pairing = Object.freeze({ schemaVersion:1, installId:'qa-install', token:'A'.repeat(48) });

test('il client accetta soltanto il servizio loopback e le origini ufficiali', () => {
    const fetchFn = async () => new Response('{}');
    assert.throws(() => createNativeAi2Client({ fetchFn, appOrigin:'https://evil.example' }), /LOCAL_AI_NATIVE_APP_ORIGIN_REJECTED/);
    assert.throws(() => createNativeAi2Client({ fetchFn, appOrigin:'https://appcodici-password.web.app', endpoint:'http://0.0.0.0:32145' }), /LOCAL_AI_NATIVE_ENDPOINT_REJECTED/);
    assert.throws(() => createNativeAi2Client({ fetchFn, appOrigin:'https://appcodici-password.web.app', endpoint:'http://127.0.0.1:9999' }), /LOCAL_AI_NATIVE_ENDPOINT_REJECTED/);
});

test('il permesso loopback usa il nome granulare e degrada a prompt sui browser precedenti', async () => {
    let queried = null;
    assert.equal(await queryLoopbackPermission({ permissions:{ query:async value => { queried = value; return { state:'granted' }; } } }), 'granted');
    assert.deepEqual(queried, { name:'loopback-network' });
    assert.equal(await queryLoopbackPermission({ permissions:{ query:async () => { throw new TypeError('unknown'); } } }), 'prompt');
});

test('salute e generazione dichiarano targetAddressSpace loopback e non inviano credenziali browser', async () => {
    const calls = [];
    const storage = memoryStorage({ [NATIVE_AI2_PAIRING_KEY]:JSON.stringify(pairing) });
    const fetchFn = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/v1/health')) return Response.json({ schemaVersion:1, status:'ok', version:'0.1.0', model:'Qwen' });
        return Response.json({ choices:[{ message:{ content:'Risposta locale' } }] });
    };
    const client = createNativeAi2Client({ fetchFn, storage, appOrigin:'https://appcodici-password.web.app' });
    assert.equal((await client.health()).status, 'ok');
    const answer = await client.complete([{ role:'user', content:'Come creo una scadenza?' }], { maxTokens:64 });
    assert.equal(answer.choices[0].message.content, 'Risposta locale');
    for (const call of calls) {
        assert.equal(call.options.targetAddressSpace, 'loopback');
        assert.equal(call.options.credentials, 'omit');
        assert.equal(call.options.redirect, 'error');
    }
    assert.equal(calls[0].options.headers.Authorization, `Bearer ${pairing.token}`);
    assert.equal(calls[1].options.headers.Authorization, `Bearer ${pairing.token}`);
    assert.doesNotMatch(calls[1].options.body, /"(?:masterPassword|vaultKey|password)"\s*:/i);
});

test('lo stato distingue Motore locale presente, modello installato e runtime pronto', async () => {
    const client = createNativeAi2Client({
        appOrigin:'https://appcodici-password.web.app',
        storage:memoryStorage(),
        fetchFn:async (url, options) => {
            assert.equal(url, 'http://127.0.0.1:32145/v1/status');
            assert.equal(options.targetAddressSpace, 'loopback');
            return new Response(JSON.stringify({
                schemaVersion:1, status:'available', version:'0.1.0', model:'Qwen3-4B-GGUF',
                installed:false, ready:false, ramGiB:64, freeStorageBytes:20_000_000_000
            }), { status:200, headers:{ 'content-type':'application/json' } });
        }
    });
    assert.deepEqual(await client.status(), {
        status:'available', version:'0.1.0', model:'Qwen3-4B-GGUF', installed:false, ready:false,
        ramGiB:64, freeStorageBytes:20_000_000_000
    });
});

test('associazione scaduta viene eliminata e non resta utilizzabile', async () => {
    const storage = memoryStorage({ [NATIVE_AI2_PAIRING_KEY]:JSON.stringify(pairing) });
    const client = createNativeAi2Client({
        storage,
        appOrigin:'https://appcodici-password.web.app',
        fetchFn:async () => new Response('{}', { status:401 })
    });
    await assert.rejects(client.complete([{ role:'user', content:'Test' }]), /LOCAL_AI_NATIVE_PAIRING_EXPIRED/);
    assert.equal(readNativeAi2Pairing({ storage }), null);
    clearNativeAi2Pairing({ storage });
});
