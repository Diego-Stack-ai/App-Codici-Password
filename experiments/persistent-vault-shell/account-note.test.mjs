import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareAccountNote, validateAccountNoteRequest} from './account-note-contract.mjs';
import {createAccountNoteHandler} from './account-note-handler.mjs';
const hash = value => createHash('sha256').update(value).digest('hex'), cipher = Buffer.alloc(48, 42).toString('base64');
function fixture(company = false) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false};
    const account = company ? {domain: 'company', companyId: 'firm', id: 'account'} : {domain: 'private', id: 'account'};
    const parent = company ? 'users/owner/aziende/firm' : 'users/owner', path = parent + '/accounts/account';
    const source = {id: 'account', ownerId: 'owner', note: 'legacy note', password: 'secret untouched', revision: 4, schemaVersion: 1,
        _profileLinkRevision: 2, _profileLinkSchemaVersion: 1, _profileLinkUpdatedAt: new Date(0),
        linkedProfileFields: [{type: 'phone', id: 'mobile'}], linkedCompanyProfileFields: [{companyId: 'firm', type: 'email', id: 'pec'}],
        banking: [{id: 'bank', iban: 'cipher-iban'}], isBanking: true, extraMetadata: {keep: true}};
    const records = new Map([[path, structuredClone(source)], [parent, {ownerId: 'owner'}]]);
    const db = {doc: path => path, async runTransaction(run) {
        const staged = new Map();
        const result = await run({get: async path => ({exists: records.has(path), data: () => structuredClone(records.get(path))}),
            update(path, patch) {staged.set(path, {...structuredClone(records.get(path)), ...structuredClone(patch)});},
            create(path, record) {assert.ok(!records.has(path)); staged.set(path, structuredClone(record));}});
        for (const [path, value] of staged) records.set(path, value); return result;
    }};
    const options = {context: {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');}, encrypt: async () => cipher},
        getUser: () => ({uid: state.uid}), source, account, note: 'new note', operationId: 'op', hash};
    return {options, source, records, path, parent, abort, state, trusted: {auth: {uid: 'owner'}, app: {appId: 'fixture'}},
        run: createAccountNoteHandler({db, hash, timestamp: () => 123})};
}
for (const company of [false, true]) test(`note-only patch preserves all ${company ? 'company' : 'private'} relation metadata and banking fields`, async () => {
    const f = fixture(company), request = await prepareAccountNote(f.options), before = structuredClone(f.source);
    assert.deepEqual(Object.keys(request).sort(), ['account', 'expectedFingerprint', 'expectedOwnerUid', 'expectedRevision', 'note', 'operationId']);
    assert.doesNotMatch(JSON.stringify(request), /legacy note|new note|secret untouched|cipher-iban/);
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.account));
    assert.deepEqual(await f.run(request, f.trusted), {status: 'confirmed', revision: 5});
    assert.deepEqual(f.records.get(f.path), {...before, note: cipher, revision: 5, updatedAt: 123});
    await f.run(request, f.trusted); assert.equal(f.records.get(f.path).revision, 5);
    await assert.rejects(f.run({...request, note: ''}, f.trusted), /OPERATION_CONFLICT/);
});
test('clearing a note preserves empty inverse arrays and metadata after unlink', async () => {
    const f = fixture(); f.source.linkedProfileFields = []; f.source.linkedCompanyProfileFields = [];
    f.records.set(f.path, structuredClone(f.source)); f.options.note = ''; f.options.context.encrypt = () => {throw Error('not needed');};
    const request = await prepareAccountNote(f.options); await f.run(request, f.trusted);
    assert.equal(f.records.get(f.path).note, ''); assert.equal(f.records.get(f.path)._profileLinkRevision, 2);
    assert.deepEqual(f.records.get(f.path).linkedProfileFields, []);
});
test('revision or legacy note change conflicts without a receipt or partial update', async () => {
    for (const patch of [{revision: 5}, {note: 'changed by legacy writer'}]) {
        const f = fixture(), request = await prepareAccountNote(f.options); Object.assign(f.records.get(f.path), patch);
        const before = structuredClone([...f.records]); await assert.rejects(f.run(request, f.trusted), /CONFLICT/);
        assert.deepEqual([...f.records], before);
    }
});
test('linked references changed concurrently are preserved rather than copied from the editor', async () => {
    const f = fixture(), request = await prepareAccountNote(f.options);
    f.records.get(f.path).linkedProfileFields = [{type: 'phone', id: 'second'}]; f.records.get(f.path)._profileLinkRevision = 3;
    await f.run(request, f.trusted); assert.deepEqual(f.records.get(f.path).linkedProfileFields, [{type: 'phone', id: 'second'}]);
    assert.equal(f.records.get(f.path)._profileLinkRevision, 3);
});
test('foreign, archived, shared, memo, aliased and unknown schema Accounts cannot be patched', async () => {
    for (const patch of [{ownerId: 'other'}, {isArchived: true}, {sharedWithUids: ['other']}, {isExplicitMemo: true}, {id: 'alias'}, {schemaVersion: 2}]) {
        const f = fixture(), request = await prepareAccountNote(f.options); Object.assign(f.records.get(f.path), patch);
        await assert.rejects(f.run(request, f.trusted)); assert.equal(f.records.size, 2);
    }
    for (const patch of [{ownerId: 'other'}, {isArchived: true}, {id: 'alias'}]) {
        const f = fixture(true), request = await prepareAccountNote(f.options); Object.assign(f.records.get(f.parent), patch);
        await assert.rejects(f.run(request, f.trusted), /COMPANY_UNAVAILABLE/);
    }
});
test('wire rejects plaintext, overlarge values, unknown fields and absent trust', async () => {
    const f = fixture(), request = await prepareAccountNote(f.options);
    for (const patch of [{note: 'plaintext'}, {password: cipher}, {expectedRevision: -1}, {account: null}]) assert.throws(() => validateAccountNoteRequest({...request, ...patch}));
    for (const trusted of [{}, {auth: {uid: 'owner'}}]) await assert.rejects(f.run(request, trusted));
    await assert.rejects(f.run(request, {auth: {uid: 'other'}, app: {appId: 'fixture'}}), /OWNER_MISMATCH/);
    f.options.note = 'x'.repeat(20001); await assert.rejects(prepareAccountNote(f.options));
    f.options.note = 'nonempty'; f.options.context.encrypt = async () => ''; await assert.rejects(prepareAccountNote(f.options), /ENCRYPTION_FAILED/);
    assert.equal(f.records.size, 2);
});
test('preparation snapshots basis before awaiting and revokes late ciphertext', async () => {
    const f = fixture(); f.options.hash = async value => {f.source.note = 'mutated'; return hash(value);};
    assert.equal((await prepareAccountNote(f.options)).expectedFingerprint, hash(JSON.stringify([true, 'legacy note'])));
    for (const revoke of [f => f.abort.abort(), f => {f.state.uid = 'other';}, f => {f.state.locked = true;}]) {
        const g = fixture(); g.options.context.encrypt = async () => {revoke(g); return cipher;};
        await assert.rejects(prepareAccountNote(g.options), /VIEW_DISPOSED|LOCKED/);
    }
});
