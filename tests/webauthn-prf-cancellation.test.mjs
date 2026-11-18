import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

const source = (await readFile(new URL('../Frontend/public/assets/js/modules/core/webauthn-manager.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
function fixture(get = async () => ({getClientExtensionResults: () => ({prf: {results: {first: new Uint8Array([1]).buffer}}})})) {
    const requests = [];
    const context = vm.createContext({crypto: webcrypto, atob, btoa,
        window: {location: {hostname: 'appcodici-password.web.app'}},
        console: {warn() {}, error() {}},
        navigator: {credentials: {get: options => {requests.push(options); return get(options);}}}});
    vm.runInContext(source, context);
    return {requests, context, legacyRequest: () => vm.runInContext("getPrfOutput('AQ==', 'Ag==', null)", context), request: (signal, rpId = null) => {
        context.fixtureSignal = signal; context.fixtureRpId = rpId;
        return vm.runInContext("getPrfOutput('AQ==', 'Ag==', fixtureRpId, {signal: fixtureSignal})", context);
    }};
}

test('actual PRF request requires user verification, a fresh challenge and the owner signal', async () => {
    const f = fixture(), signal = new AbortController().signal;
    await f.request(signal); await f.request(signal);
    assert.equal(f.requests.length, 2);
    for (const request of f.requests) {
        assert.equal(request.signal, signal);
        assert.equal(request.publicKey.userVerification, 'required');
        assert.equal(request.publicKey.rpId, 'appcodici-password.web.app');
        assert.equal(request.publicKey.allowCredentials[0].type, 'public-key');
        assert.equal(request.publicKey.extensions.prf.eval.first.byteLength, 1);
    }
    assert.notDeepEqual(Array.from(f.requests[0].publicKey.challenge), Array.from(f.requests[1].publicKey.challenge));
    await f.legacyRequest();
    assert.equal(Object.hasOwn(f.requests[2], 'signal'), false, 'existing requests stay compatible');
});

test('actual PRF request rejects an already aborted operation before the OS call', async () => {
    const f = fixture(), controller = new AbortController(); controller.abort();
    await assert.rejects(f.request(controller.signal), {name: 'AbortError'});
    assert.equal(f.requests.length, 0);
});

test('actual PRF request rejects a late OS response even when the adapter ignores abort', async () => {
    let complete;
    const f = fixture(() => new Promise(resolve => {complete = resolve;})), controller = new AbortController();
    const result = f.request(controller.signal), rejected = assert.rejects(result, {name: 'AbortError'});
    controller.abort();
    complete({getClientExtensionResults: () => {throw Error('late PRF output must never be read');}});
    await rejected;
});

test('actual PRF request rejects unsupported PRF and a mismatched RP without a secret', async () => {
    const f = fixture(async () => ({getClientExtensionResults: () => ({})}));
    await assert.rejects(f.request(), /PRF/);
    await assert.rejects(f.request(undefined, 'other.invalid'), /WEBAUTHN_RP_ID_MISMATCH/);
    assert.equal(f.requests.length, 1, 'RP mismatch never reaches the authenticator');
});
