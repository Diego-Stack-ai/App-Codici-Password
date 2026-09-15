import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountWidgetReader} from './account-widget-reader.mjs';

function fixture({online = true, domain = 'private', companyId} = {}) {
    const abort = new AbortController(), calls = [];
    let uid = 'owner', locked = false;
    const state = {account: {ownerId: uid}, widgets: [
        {id: 'embedded', kind: 'embedded', context: domain, accountId: 'account', ...(companyId ? {companyId} : {}),
            title: 'SIM', fields: [{id: 'pin', label: 'PIN', encrypted: true, valueEnc: 'enc:2076'}, {id: 'note', label: 'Nota', encrypted: false, value: 'test'}]},
        {id: 'link', kind: 'shared-reference', context: domain, accountId: 'account', ...(companyId ? {companyId} : {}), sharedDataId: 'common'}
    ], shared: [{id: 'common', ownerId: uid, title: 'Credenziale comune', fields: [{id: 'password', label: 'Password', encrypted: true, valueEnc: 'enc:secret'}]}]};
    const repository = {};
    for (const suffix of ['', 'Confirmed']) {
        for (const name of ['getPrivateAccount', 'getCompanyAccount', 'listAccountWidgets', 'listSharedVaultData']) {
            repository[name + suffix] = async (...args) => {
                calls.push([name + suffix, ...args]);
                return name.startsWith('get') ? state.account : name === 'listAccountWidgets' ? state.widgets : state.shared;
            };
        }
    }
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {if (locked) throw Error('VAULT_LOCKED');},
        async read({ownerId, ciphertext}) {assert.equal(ownerId, 'owner'); return ciphertext.slice(4);}};
    const options = {context, repository, getUser: () => ({uid}), isOnline: () => online, selection: {domain, id: 'account', ...(companyId ? {companyId} : {})}};
    return {state, calls, context, repository, options, abort, reader: createAccountWidgetReader(options), lock() {locked = true;}, change() {uid = 'other';}};
}

for (const online of [true, false]) test(`Widget and common values use ${online ? 'confirmed' : 'cached'} reads without exposing ciphertext`, async () => {
    const f = fixture({online});
    const list = await f.reader.list();
    assert.equal(list.length, 2);
    assert.ok(!JSON.stringify(list).includes('enc:'));
    assert.ok(!JSON.stringify(list).includes('2076'));
    assert.equal(list[0].fields[0].copyable, false);
    assert.equal(await f.reader.read('embedded', 'pin'), '2076');
    assert.equal(await f.reader.read('embedded', 'note'), 'test');
    assert.equal(await f.reader.read('link', 'password'), 'secret');
    assert.ok(f.calls.every(([name, uid]) => name.endsWith('Confirmed') === online && uid === 'owner'));
});

test('same Account ID in another company or domain cannot supply widgets', async () => {
    const f = fixture({domain: 'company', companyId: 'one'});
    f.state.widgets.push({...f.state.widgets[0], id: 'foreign', companyId: 'two'}, {...f.state.widgets[0], id: 'private', context: 'private'});
    assert.equal((await f.reader.list()).length, 2);
    await assert.rejects(f.reader.read('foreign', 'pin'));
    assert.ok(f.calls.filter(([name]) => name.startsWith('get')).every(([, uid, company, account]) => uid === 'owner' && company === 'one' && account === 'account'));
});

for (const boundary of ['abort', 'lock', 'change']) test(`pending plaintext is discarded on ${boundary}`, async () => {
    const f = fixture(); let release;
    f.context.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.reader.read('link', 'password');
    const rejected = assert.rejects(pending, /VIEW_DISPOSED|VAULT_LOCKED|AUTH_CHANGED/);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    if (boundary === 'abort') f.abort.abort(); else f[boundary]();
    release('late'); await rejected;
});

for (const mutation of ['unlink', 'retarget', 'edit', 'archive', 'owner']) test(`read rejects ${mutation} during decryption`, async () => {
    const f = fixture();
    f.context.read = async () => {
        if (mutation === 'unlink') f.state.widgets.pop();
        if (mutation === 'retarget') f.state.widgets[1].sharedDataId = 'other';
        if (mutation === 'edit') f.state.shared[0].fields[0].valueEnc = 'enc:new';
        if (mutation === 'archive') f.state.account.isArchived = true;
        if (mutation === 'owner') f.state.shared[0].ownerId = 'other';
        return 'old';
    };
    await assert.rejects(f.reader.read('link', 'password'), /WIDGET_CHANGED|WIDGET_UNAVAILABLE/);
});

test('duplicate IDs, malformed fields and wrong owners fail closed', async () => {
    const mutations = [f => f.state.widgets.push(f.state.widgets[0]), f => f.state.shared.push(f.state.shared[0]),
        f => f.state.widgets[0].fields.push(f.state.widgets[0].fields[0]), f => {f.state.widgets[0].fields[0].encrypted = 'yes';},
        f => {f.state.widgets[0].ownerId = 'other';}, f => {f.state.widgets[0].fields[0].valueEnc = '';},
        f => {f.state.widgets[0].bankId = {};}, f => {f.state.shared = [];}];
    for (const mutate of mutations) {const f = fixture(); mutate(f); await assert.rejects(f.reader.list());}
});

test('online permission failure and decrypt failure have no fallback', async () => {
    const f = fixture(); f.repository.listAccountWidgetsConfirmed = async () => {throw Error('permission-denied');};
    await assert.rejects(f.reader.list(), /permission-denied/);
    assert.ok(f.calls.every(([name]) => name.endsWith('Confirmed')));
    for (const value of ['--ERRORE--', 'enc:2076', null]) {
        const g = fixture(); g.context.read = async () => value;
        await assert.rejects(g.reader.read('embedded', 'pin'));
    }
    const g = fixture(); g.context.read = async () => {throw Error('decrypt');};
    await assert.rejects(g.reader.read('embedded', 'pin'), /decrypt/);
});

test('invalid selection fails before repository access', () => {
    const f = fixture();
    for (const selection of [{domain: 'private'}, {domain: 'private', id: '../x'}, {domain: 'company', id: 'a'}, {domain: 'private', id: 'a', companyId: 'one'}]) {
        assert.throws(() => createAccountWidgetReader({...f.options, selection}));
    }
    assert.equal(f.calls.length, 0);
});

test('canonical unencrypted boolean and number fields remain readable without coercing objects', async () => {
    const f = fixture();
    for (const [value, expected] of [[false, 'false'], [0, '0'], [42, '42']]) {
        f.state.widgets[0].fields[1].value = value;
        assert.equal(await f.reader.read('embedded', 'note'), expected);
    }
    for (const value of [{}, [], NaN, Infinity]) {
        f.state.widgets[0].fields[1].value = value;
        await assert.rejects(f.reader.list());
    }
});

test('stale public-field UI cannot reveal or copy a field that became secret', async () => {
    const f = fixture(); await f.reader.list();
    Object.assign(f.state.widgets[0].fields[1], {encrypted: true, valueEnc: 'enc:secret'});
    await assert.rejects(f.reader.read('embedded', 'note', {expectedEncrypted: false}), /WIDGET_CHANGED/);
    await assert.rejects(f.reader.read('embedded', 'note', {copy: true}), /COPY_FORBIDDEN/);
    const g = fixture(); g.state.widgets[0].fields[1].copyable = false;
    await assert.rejects(g.reader.read('embedded', 'note', {expectedEncrypted: false, copy: true}), /COPY_FORBIDDEN/);
});
