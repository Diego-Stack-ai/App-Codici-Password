import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePrivateAccountPatch} from './prepare-private-account-patch.mjs';

const source = () => ({id: 'fixture', ownerId: 'fixture-user', type: 'account', visibility: 'private', _encrypted: true, revision: 2});
const encoded = value => Buffer.from(`synthetic-ciphertext-for-test:${value}`).toString('base64');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function fixture() {
    const controller = new AbortController(), encrypted = [];
    const context = {user: {uid: 'fixture-user'}, signal: controller.signal, unlocked: true,
        encrypt: async value => { encrypted.push(value); return encoded(value); }};
    return {controller, encrypted, context,
        prepare: (changes, options = {}) => preparePrivateAccountPatch({context, source: source(), changes, hasProfileLink: false, ...options})};
}

test('prepares only requested ciphertext fields without changing source or input', async () => {
    const f = fixture(), original = source(); original.note = 'existing-ciphertext';
    const before = structuredClone(original), changes = Object.freeze({nomeAccount: 'Title', username: 'User', account: 'Code', password: 'Secret', note: 'Note', url: 'https://example.invalid'});
    const patch = await f.prepare(changes, {source: Object.freeze(original)});
    assert.deepEqual(Object.keys(patch), Object.keys(changes));
    assert.deepEqual(original, before); assert.equal(Object.isFrozen(patch), true);
    for (const [field, value] of Object.entries(changes)) assert.equal(patch[field], encoded(value));
    assert.equal(patch.revision, undefined); assert.equal(patch.ownerId, undefined);
});

test('rejects shared, banking, profile-linked and unsupported records before encryption', async () => {
    const f = fixture();
    for (const extra of [
        {type: 'memo'}, {visibility: 'shared'}, {_encrypted: false}, {ownerId: 'other'}, {ownerId: null}, {ownerId: ''},
        {isBanking: true}, {isBanking: 'false'}, {banking: [{}]}, {banking: {}},
        {sharedWith: {recipient: {}}}, {sharedWithUids: ['recipient']}, {acceptedCount: 1},
        {sharedWithEmails: ['fixture@example.invalid']}, {linkedProfileField: {id: 'phone'}},
        {linkedCompanyProfileField: {id: 'email'}}, {isExplicitMemo: true}, {unknown: 'value'},
        {revision: undefined}, {revision: -1}, {revision: 1.5}, {revision: Number.MAX_SAFE_INTEGER + 1}
    ]) await assert.rejects(f.prepare({note: 'Note'}, {source: {...source(), ...extra}}), /PRIVATE_ACCOUNT_NOT_ISOLATED/);
    for (const evidence of [undefined, null, true, 'false', 0]) {
        await assert.rejects(f.prepare({note: 'Note'}, {hasProfileLink: evidence}), /PRIVATE_ACCOUNT_NOT_ISOLATED/);
    }
    assert.deepEqual(f.encrypted, []);
});

test('allows explicit empty isolation metadata and missing legacy owner', async () => {
    const f = fixture(), original = {...source(), isBanking: false, banking: [], sharedWith: {}, sharedWithUids: [], acceptedCount: 0, isExplicitMemo: false};
    delete original.ownerId;
    assert.deepEqual(await f.prepare({note: 'Note'}, {source: original}), {note: encoded('Note')});
});

test('rejects unknown, empty and non-string changes before any encryption', async () => {
    const f = fixture();
    for (const changes of [{}, [], null, {note: ''}, {note: null}, {note: 4}, {note: {}}, {note: 'ok', ownerId: 'other'}]) {
        await assert.rejects(f.prepare(changes), /PRIVATE_ACCOUNT_PATCH_INVALID/);
    }
    const getter = {}; Object.defineProperty(getter, 'note', {enumerable: true, get() { throw new Error('secret-in-getter'); }});
    await assert.rejects(f.prepare(getter), /PRIVATE_ACCOUNT_PATCH_INVALID/);
    assert.deepEqual(f.encrypted, []);
});

test('snapshots all change values before the first await', async () => {
    const f = fixture(), pending = deferred(), reads = [], changes = {note: 'Initial note', url: 'Initial URL'};
    f.context.encrypt = value => { reads.push(value); return reads.length === 1 ? pending.promise : Promise.resolve(encoded(value)); };
    const preparing = f.prepare(changes);
    changes.url = 'Changed later'; changes.password = 'Added later';
    pending.resolve(encoded('Initial note'));
    const patch = await preparing;
    assert.deepEqual(reads, ['Initial note', 'Initial URL']);
    assert.deepEqual(patch, {note: encoded('Initial note'), url: encoded('Initial URL')});
});

test('abort during encryption returns no patch and never encrypts the next field', async () => {
    const f = fixture(), pending = deferred(); let calls = 0;
    f.context.encrypt = () => { calls++; return pending.promise; };
    const preparing = f.prepare({note: 'Note', url: 'URL'});
    f.controller.abort(); pending.resolve(encoded('Note'));
    await assert.rejects(preparing, /VIEW_DISPOSED/); assert.equal(calls, 1);
});

test('changed identity or lock after encryption invalidates the entire result', async () => {
    for (const invalidate of [context => { context.user.uid = 'other'; }, context => { context.unlocked = false; }]) {
        const f = fixture(), pending = deferred();
        f.context.encrypt = () => pending.promise;
        const preparing = f.prepare({note: 'Note'}); invalidate(f.context); pending.resolve(encoded('Note'));
        await assert.rejects(preparing, /AUTH_CHANGED|VAULT_LOCKED/);
    }
});

test('locked or aborted contexts never start encryption', async () => {
    const f = fixture(); f.context.unlocked = false;
    await assert.rejects(f.prepare({note: 'Note'}), /VAULT_LOCKED/);
    f.context.unlocked = true; f.controller.abort();
    await assert.rejects(f.prepare({note: 'Note'}), /VIEW_DISPOSED/);
    assert.deepEqual(f.encrypted, []);
});

test('provider errors are sanitized and invalid ciphertext output is never returned', async () => {
    const f = fixture();
    f.context.encrypt = async () => { throw new Error('secret-provider-message'); };
    await assert.rejects(f.prepare({note: 'Note'}), error => error.message === 'PRIVATE_ACCOUNT_ENCRYPT_FAILED' && error.cause === undefined);
    for (const output of ['', 'Note', {}, 'not base64 despite its very long text']) {
        f.context.encrypt = async () => output;
        await assert.rejects(f.prepare({note: 'Note'}), /PRIVATE_ACCOUNT_ENCRYPT_FAILED/);
    }
});
