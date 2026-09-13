import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/settings/credential-health-service.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const gate = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
function fixture() {
    const auth = {currentUser: {uid: 'A'}}, events = new EventTarget(), observers = new Set();
    const records = [{id: 'same', password: 'encrypted', nomeAccount: 'Private'}];
    const context = vm.createContext({auth, navigator: {onLine: false}, setTimeout, clearTimeout,
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        ensureVaultKeyMaterial: async () => 'synthetic-key', decrypt: async () => 'synthetic-clear',
        listPrivateAccounts: async () => records, listCompanies: async () => [],
        listCompanyAccounts: async () => records, accountModeFromRecord: () => 'account',
        ACCOUNT_MODES: {MEMO_PRIVATE: 'memo', MEMO_SHARED: 'shared-memo'},
        analyzeCredentialHealth: async values => values.map(record => ({recordId: record.id, flags: [], strength: 'strong'}))
    });
    vm.runInContext(source, context);
    return {context, observers, records, run: () => context.inspectOwnerCredentialHealth('A'),
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        change: () => { auth.currentUser = {uid: 'B'}; for (const callback of observers) callback(auth.currentUser); }};
}

test('lock or identity change during every health await prevents a late report', async () => {
    for (const phase of ['ensureVaultKeyMaterial', 'listPrivateAccounts', 'decrypt', 'analyzeCredentialHealth']) {
        for (const action of ['lock', 'change']) {
            const f = fixture(), entered = gate(), leave = gate(); const original = f.context[phase];
            f.context[phase] = async (...args) => { const value = await original(...args); entered.resolve(); await leave.promise; return value; };
            const pending = f.run(); const rejected = assert.rejects(pending, /SESSION_CHANGED/);
            await entered.promise; f[action](); leave.resolve(); await rejected;
            assert.equal(f.observers.size, 0);
        }
    }
});

test('analysis error clears retained plaintext and same IDs from different companies stay distinct', async () => {
    const f = fixture(); let retained;
    f.context.listCompanies = async () => [{id: 'one', nome: 'One'}, {id: 'two', nome: 'Two'}];
    f.context.listCompanyAccounts = async (_uid, company) => [{id: 'same', password: 'cipher', nomeAccount: company}];
    const report = await f.run();
    assert.equal(new Set(report.results.map(item => item.recordId)).size, 3);
    assert.deepEqual(Array.from(report.results, item => item.title), ['Private', 'one', 'two']);
    f.context.analyzeCredentialHealth = async records => { retained = [...records]; throw new Error('synthetic failure'); };
    await assert.rejects(f.run(), /synthetic failure/);
    assert.equal(retained.every(record => record.password === ''), true); assert.equal(f.observers.size, 0);
});
