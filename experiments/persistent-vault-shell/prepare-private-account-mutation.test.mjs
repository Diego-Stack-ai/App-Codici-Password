import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preparePrivateAccountMutation} from './prepare-private-account-mutation.mjs';
const require = createRequire(import.meta.url);
const {validatePrivateAccountMutation} = require('../../functions/private-account-mutation-service.js');
const cipher = value => Buffer.from(`synthetic-ciphertext-fixture:${value}`).toString('base64');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function fixture() {
    const controller = new AbortController(), encrypted = [];
    const source = {id: 'fixture', ownerId: 'fixture-user', schemaVersion: 1, revision: 3,
        type: 'account', visibility: 'private', _encrypted: true,
        nomeAccount: 'Existing title', url: 'https://example.invalid',
        username: cipher('user'), account: cipher('code'), password: cipher('password'), note: cipher('note'),
        isBanking: false, banking: [], sharedWith: {}, sharedWithUids: [], acceptedCount: 0,
        createdAt: {seconds: 123, nanoseconds: 456}};
    const context = {user: {uid: 'fixture-user'}, signal: controller.signal, unlocked: true,
        encrypt: async value => { encrypted.push(value); return cipher(value); }};
    const args = {context, source, changes: {note: 'Updated note'}, domain: 'private', uid: 'fixture-user',
        recordId: 'fixture', expectedRevision: 3, operationId: 'device:operation', deviceId: 'device', hasProfileLink: false};
    return {args, controller, encrypted, prepare: options => preparePrivateAccountMutation({...args, ...options})};
}

test('prepared envelope passes the real M6 validator and preserves every unchanged payload field', async () => {
    const f = fixture(), before = structuredClone(f.args.source);
    const operation = await f.prepare();
    assert.deepEqual(validatePrivateAccountMutation(operation), operation);
    assert.equal(operation.record.note, cipher('Updated note'));
    for (const [field, value] of Object.entries(before)) {
        if (!['id', 'ownerId', 'schemaVersion', 'revision', 'note'].includes(field)) assert.deepEqual(operation.record[field], value);
    }
    assert.deepEqual(f.args.source, before); assert.equal(operation.operationId, 'device:operation');
    assert.equal(operation.expectedRevision, 3); assert.equal(operation.record.id, undefined);
    assert.equal(Object.isFrozen(operation.record.createdAt), true);
    assert.equal(Object.isFrozen(operation.record.banking), true);
    assert.deepEqual(await f.prepare(), operation); // Caller-provided operation identity is stable.
});

test('requires explicit private domain, UID, IDs, revision and external profile-link evidence', async () => {
    const f = fixture();
    for (const options of [{domain: undefined}, {domain: 'company'}, {uid: undefined}, {uid: 'other'},
        {recordId: undefined}, {recordId: 'wrong'}, {recordId: 'bad/id'}, {expectedRevision: 2},
        {expectedRevision: -1}, {expectedRevision: 1.5}, {expectedRevision: Number.MAX_SAFE_INTEGER},
        {operationId: undefined}, {operationId: ''}, {deviceId: ''}, {hasProfileLink: undefined}, {hasProfileLink: true}]) {
        await assert.rejects(f.prepare(options), /PREPARATION_INVALID|AUTH_CHANGED/);
    }
    assert.deepEqual(f.encrypted, []);
});

test('rejects incomplete, legacy-incompatible and nonisolated sources without dropping unknown fields', async () => {
    const f = fixture();
    for (const change of [
        {schemaVersion: undefined}, {username: undefined}, {url: undefined}, {nomeAccount: 'x'.repeat(241)},
        {note: 'plaintext legacy note'}, {unknown: 'do not drop'}, {views: 2}, {linkedProfileField: {id: 'phone'}},
        {ownerId: null}, {ownerId: 'other'}, {visibility: 'shared'}, {isBanking: true}, {banking: [{}]},
        {sharedWith: {recipient: {}}}, {sharedWithUids: ['recipient']}, {type: 'memo'}
    ]) await assert.rejects(f.prepare({source: {...f.args.source, ...change}}));
    assert.deepEqual(f.encrypted, []);
});

test('title and URL cannot change and empty deletion is outside this increment', async () => {
    const f = fixture();
    for (const changes of [{nomeAccount: 'New title'}, {url: 'New URL'}, {note: ''}, {}, {password: 123}]) {
        await assert.rejects(f.prepare({changes}));
    }
    assert.deepEqual(f.encrypted, []);
});

test('snapshots source nested metadata and changes before encryption yields', async () => {
    const f = fixture(), pending = deferred(), encrypted = [];
    f.args.changes = {note: 'Initial note', password: 'Initial password'};
    f.args.context.encrypt = value => { encrypted.push(value); return encrypted.length === 1 ? pending.promise : Promise.resolve(cipher(value)); };
    const preparing = f.prepare();
    f.args.source.nomeAccount = 'Mutated title'; f.args.source.createdAt.seconds = 999;
    f.args.source.banking.push({mustNotBeIncluded: true}); f.args.changes.password = 'Mutated password';
    pending.resolve(cipher('Initial note'));
    const operation = await preparing;
    assert.deepEqual(encrypted, ['Initial note', 'Initial password']);
    assert.equal(operation.record.nomeAccount, 'Existing title'); assert.equal(operation.record.createdAt.seconds, 123);
    assert.deepEqual(operation.record.banking, []);
    assert.deepEqual(validatePrivateAccountMutation(operation), operation);
});

test('abort while encrypting returns no operation and prevents subsequent encryption', async () => {
    const f = fixture(), pending = deferred(); let calls = 0;
    f.args.context.encrypt = () => { calls++; return pending.promise; };
    const preparing = f.prepare({changes: {note: 'Note', password: 'Password'}});
    f.controller.abort(); pending.resolve(cipher('Note'));
    await assert.rejects(preparing, /VIEW_DISPOSED/); assert.equal(calls, 1);
});

test('provider errors and invalid timestamp serialization never expose source messages', async () => {
    const f = fixture();
    f.args.context.encrypt = async () => { throw new Error('provider-secret'); };
    await assert.rejects(f.prepare(), error => error.message === 'PRIVATE_ACCOUNT_ENCRYPT_FAILED' && error.cause === undefined);
    f.args.source.createdAt = {toJSON() { throw new Error('timestamp-secret'); }};
    await assert.rejects(f.prepare(), error => error.message === 'PRIVATE_ACCOUNT_MUTATION_PREPARATION_INVALID' && error.cause === undefined);
});

test('oversized merged payload is rejected without returning an envelope', async () => {
    const f = fixture();
    await assert.rejects(f.prepare({changes: {note: 'x'.repeat(300000)}}), /PRIVATE_ACCOUNT_MUTATION_PREPARATION_INVALID/);
});

test('typed createdAt and custom serializers are rejected without invoking conversion', async () => {
    const f = fixture(); let conversions = 0;
    class Timestamp { toJSON() { conversions++; return {seconds: 123}; } }
    const nestedAccessor = {}; Object.defineProperty(nestedAccessor, 'seconds', {enumerable: true, get() { conversions++; return 123; }});
    for (const createdAt of [new Timestamp(), new Date(0), {toJSON() { conversions++; return 'changed'; }}, nestedAccessor]) {
        await assert.rejects(f.prepare({source: {...f.args.source, createdAt}}), /PRIVATE_ACCOUNT_MUTATION_PREPARATION_INVALID/);
    }
    assert.equal(conversions, 0); assert.deepEqual(f.encrypted, []);
    const iso = '2026-09-12T00:00:00.000Z';
    assert.equal((await f.prepare({source: {...f.args.source, createdAt: iso}})).record.createdAt, iso);
});

test('backend updatedAt Timestamp stays untouched and is explicitly excluded from the payload', async () => {
    const f = fixture(); let conversions = 0;
    class Timestamp { seconds = 123; toJSON() { conversions++; throw new Error('MUST_NOT_SERIALIZE'); } }
    const updatedAt = new Timestamp(); f.args.source.updatedAt = updatedAt;
    const operation = await f.prepare();
    assert.equal(f.args.source.updatedAt, updatedAt); assert.equal(updatedAt.seconds, 123);
    assert.equal(conversions, 0); assert.equal(Object.hasOwn(operation.record, 'updatedAt'), false);
    assert.deepEqual(validatePrivateAccountMutation(operation), operation);
});
