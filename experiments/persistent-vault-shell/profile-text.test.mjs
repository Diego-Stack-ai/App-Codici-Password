import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {prepareProfileText} from './prepare-profile-text.mjs';
import {createProfileTextHandler} from './profile-text-handler.mjs';
import {validateProfileTextRequest, profileTextBasis} from './profile-text-contract.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const ciphertext = Buffer.alloc(48, 42).toString('base64');
function fixture(domain = 'private') {
    const abort = new AbortController(), state = {uid: 'owner', locked: false, encrypted: []};
    const target = domain === 'private' ? {domain} : {domain, companyId: 'company'};
    const source = {ownerId: 'owner', note: 'old legacy text', contactEmails: [{linkedAccountId: 'account'}]};
    const options = {context: {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}, async encrypt(value) {state.encrypted.push(value); return ciphertext;}},
        getUser: () => ({uid: state.uid}), source, target, changes: {note: 'new private note'}, operationId: 'operation', hash};
    const path = domain === 'private' ? 'users/owner' : 'users/owner/aziende/company';
    const records = new Map([[path, structuredClone(source)]]);
    const db = {doc: path => path, async runTransaction(run) {
        const staged = new Map();
        const result = await run({get: async path => ({exists: records.has(path), data: () => structuredClone(records.get(path))}),
            update(path, patch) {staged.set(path, {...structuredClone(records.get(path)), ...structuredClone(patch)});},
            create(path, value) {assert.ok(!records.has(path)); staged.set(path, structuredClone(value));}});
        for (const [path, value] of staged) records.set(path, value);
        return result;
    }};
    return {options, abort, state, records, path, trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        run: createProfileTextHandler({db, hash, timestamp: () => 123})};
}
test('profile preparation encrypts locally and excludes both old and new plaintext from its request', async () => {
    const f = fixture(), before = structuredClone(f.options.source), request = await prepareProfileText(f.options);
    assert.equal(request.changes.note, ciphertext); assert.equal(request.expected.note, hash(profileTextBasis(before, 'note')));
    assert.doesNotMatch(JSON.stringify(request), /old legacy text|new private note|linkedAccountId/);
    assert.deepEqual(f.options.source, before); assert.ok(Object.isFrozen(request) && Object.isFrozen(request.changes));
});
test('prepared text uses the existing application cipher and round-trips accented content', async () => {
    const source = await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url), 'utf8');
    const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const f = fixture(); f.options.changes.note = 'Nota sintetica: società, più informazioni.';
    f.options.context.encrypt = value => cryptoApi.encrypt(value, 'synthetic-vault-password');
    const request = await prepareProfileText(f.options);
    assert.equal(await cryptoApi.decrypt(request.changes.note, 'synthetic-vault-password'), f.options.changes.note);
    assert.notEqual(request.changes.note, f.options.changes.note);
});
test('explicit empty note clears a field without encryption or deleting the profile', async () => {
    const f = fixture(); f.options.changes.note = '';
    const request = await prepareProfileText(f.options); assert.equal(request.changes.note, ''); assert.deepEqual(f.state.encrypted, []);
    await f.run(request, f.trusted); assert.equal(f.records.get(f.path).note, ''); assert.ok(f.records.get(f.path).contactEmails);
});
test('contacts, links, fields from the other domain, plaintext wire values and oversized notes are rejected', async () => {
    for (const changes of [{contactEmails: 'x'}, {ownerId: 'x'}, {ragioneSociale: 'x'}, {note: 'x'.repeat(20001)}, {}]) {
        const f = fixture(); await assert.rejects(prepareProfileText({...f.options, changes})); assert.equal(f.state.encrypted.length, 0);
    }
    const request = await prepareProfileText(fixture().options);
    for (const patch of [{uid: 'other'}, {target: {domain: 'private', companyId: 'x'}}, {expectedRevision: -1},
        {changes: {note: 'PLAINTEXT'}}, {expected: {note: 'bad-hash'}}, {changes: {note: ciphertext, password: ciphertext}}]) {
        assert.throws(() => validateProfileTextRequest({...request, ...patch}));
    }
});
for (const boundary of ['uid', 'locked', 'abort']) test(`profile preparation is revoked during encryption after ${boundary}`, async () => {
    const f = fixture(); let release;
    f.options.context.encrypt = () => new Promise(resolve => {release = resolve;});
    const pending = prepareProfileText(f.options); await new Promise(setImmediate);
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    release(ciphertext); await assert.rejects(pending);
});
test('input changes during hashing cannot alter the prepared plaintext or prior-value fingerprint', async () => {
    const f = fixture(); let release; f.options.hash = value => new Promise(resolve => {release = () => resolve(hash(value));});
    const pending = prepareProfileText(f.options); f.options.changes.note = 'injected'; f.options.source.note = 'injected';
    release(); const request = await pending;
    assert.deepEqual(f.state.encrypted, ['new private note']); assert.equal(request.expected.note, hash(JSON.stringify([true, 'old legacy text'])));
});
for (const domain of ['private', 'company']) test(`${domain} profile patch preserves other fields and retries without another revision`, async () => {
    const f = fixture(domain), request = await prepareProfileText(f.options);
    assert.deepEqual(await f.run(request, f.trusted), {status: 'confirmed', revision: 1});
    const after = structuredClone([...f.records]); assert.deepEqual(await f.run(request, f.trusted), {status: 'confirmed', revision: 1});
    assert.deepEqual([...f.records], after); assert.deepEqual(f.records.get(f.path).contactEmails, f.options.source.contactEmails);
    assert.equal(f.records.get(f.path)._profileTextUpdatedAt, 123);
    assert.doesNotMatch(JSON.stringify(f.records.get('mutationResults/owner/operations/profile-text-operation')), /old legacy text|new private note|"changes"/);
});
test('legacy edits without a revision and stale source revisions cannot overwrite newer profile text', async () => {
    const f = fixture(), request = await prepareProfileText(f.options);
    f.records.get(f.path).note = 'legacy changed'; await assert.rejects(f.run(request, f.trusted), /FIELD_CONFLICT/);
    assert.equal(f.records.size, 1); f.records.get(f.path).note = f.options.source.note;
    await f.run(request, f.trusted);
    await assert.rejects(f.run({...request, operationId: 'new'}, f.trusted), /REVISION_CONFLICT/);
    await assert.rejects(f.run({...request, target: {domain: 'company', companyId: 'other'}}, f.trusted), /OPERATION_CONFLICT/);
});
test('untrusted context and missing, archived or foreign-owned profiles never create a receipt', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(), request = await prepareProfileText(f.options); await assert.rejects(f.run(request, trusted)); assert.equal(f.records.size, 1);
    }
    for (const mutate of [f => f.records.delete(f.path), f => {f.records.get(f.path).isArchived = true;},
        f => {f.records.get(f.path).ownerId = 'other';}, f => {f.records.get(f.path)._profileTextSchemaVersion = 2;}]) {
        const f = fixture(), request = await prepareProfileText(f.options); mutate(f); const before = structuredClone([...f.records]);
        await assert.rejects(f.run(request, f.trusted)); assert.deepEqual([...f.records], before);
    }
});
