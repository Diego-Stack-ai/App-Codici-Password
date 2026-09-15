import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../Frontend/public/assets/js/offline-sync.js', import.meta.url), 'utf8');
const messageSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/read-error-message.js', import.meta.url), 'utf8');
const { readErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(messageSource).toString('base64')}`);

function harness({ previous = null, profileFails = false, profileExists = true, online = true } = {}) {
    const calls = [];
    const storage = new Map(previous ? [['codex_offline_ready_test', JSON.stringify(previous)]] : []);
    const context = vm.createContext({
        navigator: { onLine: online }, db: {}, Date, Promise,
        localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        window: { requestIdleCallback: callback => callback(), dispatchEvent() {} },
        CustomEvent: class {}, startMetric() {}, endMetric() {},
        collection: (_, ...parts) => parts.join('/'), doc: (_, ...parts) => parts.join('/'),
        getDocFromServer: async path => {
            calls.push(path);
            if (profileFails) throw Object.assign(new Error('offline'), { code: 'unavailable' });
            return { exists: () => profileExists };
        },
        getDocsFromServer: async path => { calls.push(path); return { size: 0, docs: [] }; }
    });
    vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
    return { calls, run: () => vm.runInContext("prepareOfflineData({uid: 'test'}, 'home')", context) };
}

test('Home prepares the profile even without visiting its page; old complete markers are refreshed', async () => {
    const fixture = harness({ previous: { complete: true, syncedAt: Date.now() } });
    const result = await fixture.run();
    assert.ok(fixture.calls.includes('users/test'));
    assert.ok(fixture.calls.includes('users/test/settings'));
    assert.equal(result.complete, true);
    assert.equal(result.profileIncluded, true);
});

for (const options of [{ profileFails: true }, { profileExists: false }]) {
    test(`profile unavailable does not certify readiness: ${JSON.stringify(options)}`, async () => {
        const result = await harness(options).run();
        assert.equal(result.complete, false);
        assert.equal(result.profileIncluded, false);
        assert.ok(result.failedCollections.includes('profile'));
    });
}

test('fresh readiness including profile avoids repeating preparation', async () => {
    const fixture = harness({ previous: { complete: true, profileIncluded: true, syncedAt: Date.now() } });
    await fixture.run();
    assert.equal(fixture.calls.length, 0);
});

test('offline preparation never requests the server', async () => {
    const fixture = harness({ online: false });
    await fixture.run();
    assert.equal(fixture.calls.length, 0);
});

test('offline connectivity error has a useful message; permission and crypto failures are not disguised', () => {
    assert.match(readErrorMessage({ code: 'unavailable' }, 'fallback', false), /non sono disponibili offline/);
    assert.match(readErrorMessage({ code: 'firestore/unavailable' }, 'fallback', false), /Connettiti/);
    for (const code of ['permission-denied', 'unauthenticated', 'data-loss', undefined]) {
        assert.equal(readErrorMessage({ code }, 'fallback', false), 'fallback');
    }
    assert.equal(readErrorMessage({ code: 'unavailable' }, 'fallback', true), 'fallback');
});
