import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountDetailReader} from './account-detail-reader.mjs';

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
};
function setup(record = {ownerId: 'A', nomeAccount: {encrypted: 'title'}, password: {encrypted: 'secret'}}) {
    const controller = new AbortController(), calls = [], reads = [];
    let user = {uid: 'A'}, fetch = async () => record, decrypt = async record => {
        if (!record.ciphertext?.encrypted) throw new Error('CIPHERTEXT_REQUIRED');
        return record.ciphertext.encrypted;
    };
    const context = {user, signal: controller.signal, unlocked: true, async read(value) { reads.push(value); return decrypt(value); }};
    const repository = Object.fromEntries(['getPrivateAccount', 'getCompanyAccount'].map(name => [name, async (...args) => {
        calls.push([name, ...args]); return fetch();
    }]));
    return {open: createAccountDetailReader({context, getUser: () => user, repository}), controller, context, calls, reads,
        user: value => { user = value; }, fetch: value => { fetch = value; }, decrypt: value => { decrypt = value; }};
}
const privateSelection = {domain: 'private', id: 'record'};

test('own private/company paths use captured UID, expose only frozen lazy readers', async () => {
    const env = setup();
    const detail = await env.open(privateSelection);
    assert.deepEqual(Object.keys(detail).sort(), ['has', 'read']); assert.ok(Object.isFrozen(detail));
    assert.equal(detail.has('password'), true); assert.equal(env.reads.length, 0);
    assert.equal(await detail.read('nomeAccount'), 'title'); assert.equal(env.reads.length, 1);
    await env.open({domain: 'company', companyId: 'company', id: 'record'});
    assert.deepEqual(env.calls, [['getPrivateAccount', 'A', 'record'], ['getCompanyAccount', 'A', 'company', 'record']]);
});

test('invalid domain and identifiers never reach repository', async () => {
    const env = setup();
    for (const selection of [null, {}, {domain: 'shared', id: 'x'}, {...privateSelection, companyId: 'x'},
        ...['', ' ', '.', '..', 'a/b', null, 1].map(id => ({...privateSelection, id})),
        ...['', '../x', undefined].map(companyId => ({domain: 'company', id: 'x', companyId}))]) {
        await assert.rejects(env.open(selection), /INVALID_/);
    }
    assert.equal(env.calls.length, 0);
});

test('missing record and every explicit conflicting owner are rejected', async () => {
    await assert.rejects(setup(null).open(privateSelection), /RECORD_NOT_FOUND/);
    for (const ownerId of ['B', '', false, 0, null, undefined]) {
        await assert.rejects(setup({ownerId}).open(privateSelection), /OWNER_MISMATCH/);
    }
    assert.ok(await setup({}).open(privateSelection));
});

test('optional absent fields are empty, unsupported and plaintext fields fail closed', async () => {
    const env = setup({username: '', account: null, password: 'PLAIN'}), detail = await env.open(privateSelection);
    for (const field of ['nomeAccount', 'username', 'account']) {
        assert.equal(detail.has(field), false); assert.equal(await detail.read(field), '');
    }
    assert.equal(env.reads.length, 0);
    assert.throws(() => detail.has('note'), /FIELD_NOT_ALLOWED/);
    await assert.rejects(detail.read('ownerId'), /FIELD_NOT_ALLOWED/);
    await assert.rejects(detail.read('password'), /CIPHERTEXT_REQUIRED/);
});

test('snapshot isolates ciphertext from repository and decryptor mutation, ignores stored id', async () => {
    const record = {id: 'foreign', password: {encrypted: 'original'}, ignored: 'not exposed'};
    const env = setup(record), detail = await env.open(privateSelection);
    record.password.encrypted = 'mutated';
    env.decrypt(async value => { const result = value.ciphertext.encrypted; value.ciphertext.encrypted = 'decrypted mutation'; return result; });
    assert.equal(await detail.read('password'), 'original');
    assert.equal(await detail.read('password'), 'original');
});

test('locked, anonymous, changed and aborted contexts cannot fetch or inspect fields', async () => {
    for (const invalidate of [env => { env.context.unlocked = false; }, env => env.user(null),
        env => env.user({uid: 'B'}), env => env.controller.abort()]) {
        const env = setup(), detail = await env.open(privateSelection);
        invalidate(env);
        assert.throws(() => detail.has('password'), /VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
        await assert.rejects(detail.read('password'), /VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
        await assert.rejects(env.open(privateSelection), /VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
        assert.equal(env.calls.length, 1); assert.equal(env.reads.length, 0);
    }
});

test('identity change or route abort during fetch suppresses detail delivery', async () => {
    for (const invalidate of [env => env.user({uid: 'B'}), env => env.controller.abort()]) {
        const env = setup(), gate = deferred(); env.fetch(() => gate.promise);
        const result = env.open(privateSelection); invalidate(env); gate.resolve({password: {encrypted: 'secret'}});
        await assert.rejects(result, /AUTH_CHANGED|VIEW_DISPOSED/); assert.equal(env.reads.length, 0);
    }
});

test('identity change, lock or abort during decrypt suppresses plaintext delivery', async () => {
    for (const invalidate of [env => env.user({uid: 'B'}), env => { env.context.unlocked = false; }, env => env.controller.abort()]) {
        const env = setup(), detail = await env.open(privateSelection), gate = deferred(); env.decrypt(() => gate.promise);
        const result = detail.read('password'); invalidate(env); gate.resolve('secret');
        await assert.rejects(result, /AUTH_CHANGED|VAULT_LOCKED|VIEW_DISPOSED/);
    }
});
