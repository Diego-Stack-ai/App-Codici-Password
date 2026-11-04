import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../Frontend/public/assets/js/app-diagnostics.js', import.meta.url), 'utf8'))
    .replace("import { APP_VERSION } from './env-v126.js';", "const APP_VERSION = 'v-test';");
const { getEnginePolicyReport, runAppDiagnostics } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function storageFixture() {
    const values = new Map();
    return { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), values };
}

test('diagnostica esegue solo sonde locali e same-origin senza contenuti Vault', async () => {
    const storage = storageFixture();
    const requests = [];
    const report = await runAppDiagnostics({
        online: true,
        authenticated: true,
        storage,
        session: storageFixture(),
        fetcher: async (url, options) => { requests.push({ url, options }); return { ok: true, status: 200 }; },
        cryptoApi: { subtle: {} },
        indexedDb: {},
        serviceWorker: { controller: {} }
    });
    assert.equal(report.overall, 'pass');
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /^\/assets\/js\/env-v126\.js\?diagnostic=/);
    assert.equal(requests[0].options.credentials, 'same-origin');
    assert.equal(storage.values.size, 0);
    assert.doesNotMatch(JSON.stringify(report), /password|ciphertext|email/i);
});

test('offline produce un avviso senza richieste remote', async () => {
    let requests = 0;
    const report = await runAppDiagnostics({
        online: false,
        authenticated: true,
        storage: storageFixture(),
        session: storageFixture(),
        fetcher: async () => { requests += 1; },
        cryptoApi: { subtle: {} }, indexedDb: {}, serviceWorker: { controller: {} }
    });
    assert.equal(report.overall, 'warn');
    assert.equal(requests, 0);
});

test('segnala senza dati sensibili un precedente timeout del gate', async () => {
    const session = storageFixture();
    session.setItem('codex_auth_gate_last_failure_v1', JSON.stringify({
        reason: 'timeout', elapsedMs: 45000, page: 'profilo_privato.html', at: '2026-11-04T00:00:00.000Z'
    }));
    const report = await runAppDiagnostics({
        online: true,
        authenticated: true,
        storage: storageFixture(),
        session,
        fetcher: async () => ({ok: true, status: 200}),
        cryptoApi: {subtle: {}}, indexedDb: {}, serviceWorker: {controller: {}}
    });
    const check = report.checks.find(item => item.id === 'auth-gate-history');
    assert.equal(check.status, 'warn');
    assert.match(check.detail, /timeout dopo 45 s/);
    assert.equal(report.overall, 'warn');
});

test('stato motori distingue motori attivi e disabilitati', () => {
    const engines = getEnginePolicyReport();
    assert.equal(engines.find(item => item.id === 'm7-purge').state, 'active');
    assert.equal(engines.find(item => item.id === 'm8-restore').state, 'active');
    assert.equal(engines.find(item => item.id === 'm8-resumable').state, 'off');
    assert.equal(engines.find(item => item.id === 'cpfe2-write').state, 'active');
    assert.equal(engines.find(item => item.id === 'mfa-recovery').state, 'off');
});
