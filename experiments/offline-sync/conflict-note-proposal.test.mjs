import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createConflictNoteProposal} from './conflict-note-proposal.mjs';
const {validatePrivateAccountMutation} = createRequire(import.meta.url)('../../functions/private-account-mutation-service.js');
const cipher = value => Buffer.from(`synthetic-encrypted-note-fixture:${value}`).toString('base64');
function fixture() {
    const page = new AbortController(), encrypted = [];
    const source = {id: 'account', ownerId: 'owner', schemaVersion: 1, revision: 4,
        type: 'account', visibility: 'private', _encrypted: true, nomeAccount: 'Latest title', url: '',
        username: cipher('latest-user'), account: '', password: cipher('latest-password'), note: cipher('online')};
    const operation = {schemaVersion: 1, uid: 'owner', recordId: 'account', operationId: 'old-command', expectedRevision: 2,
        record: {...source, note: cipher('local')}};
    const context = {user: {uid: 'owner'}, signal: page.signal, unlocked: true,
        read: async ({ciphertext}) => ciphertext === cipher('local') ? 'Local note' : 'Online note',
        encrypt: async value => { encrypted.push(value); return cipher(value); }};
    const args = {context, operation, noteOnly: true, deviceId: 'device', newOperationId: () => 'new-command',
        readLatest: async () => ({source, hasProfileLink: false})};
    return {page, source, encrypted, args};
}
test('explicit confirmation prepares only local note against compared revision and preserves latest other fields', async () => {
    const f = fixture(), proposal = await createConflictNoteProposal(f.args);
    assert.deepEqual(proposal.comparison, {localNote: 'Local note', onlineNote: 'Online note', onlineRevision: 4});
    assert.equal(f.encrypted.length, 0);
    await assert.rejects(proposal.prepareReplacement(), /CONFIRMATION_REQUIRED/);
    const result = await proposal.prepareReplacement({confirmed: true});
    assert.equal(result.expectedRevision, 4); assert.equal(result.operationId, 'new-command');
    assert.equal(result.record.note, cipher('Local note')); assert.equal(result.record.password, f.source.password);
    assert.equal(result.record.nomeAccount, 'Latest title'); validatePrivateAccountMutation(result);
    assert.equal(await proposal.prepareReplacement({confirmed: true}), result);
    assert.equal(f.encrypted.length, 1); proposal.close();
});
test('latest snapshot cannot change after the comparison', async () => {
    const f = fixture(), proposal = await createConflictNoteProposal(f.args);
    f.source.password = cipher('later-password'); f.source.revision = 5;
    const result = await proposal.prepareReplacement({confirmed: true});
    assert.equal(result.record.password, cipher('latest-password')); assert.equal(result.expectedRevision, 4);
    proposal.close();
});
test('scope evidence, review markers and empty note cannot bypass full editor', async () => {
    for (const change of [{noteOnly: false}, {noteOnly: undefined}, {readLatest: async () => ({hasProfileLink: true})}]) {
        const f = fixture(); await assert.rejects(createConflictNoteProposal({...f.args, ...change}));
        assert.equal(f.encrypted.length, 0);
    }
    const f = fixture(); f.args.operation._queueState = 'reconciliation-required';
    await assert.rejects(createConflictNoteProposal(f.args), /SCOPE/);
    delete f.args.operation._queueState; f.args.operation.record.note = '';
    await assert.rejects(createConflictNoteProposal(f.args), /EMPTY_UNSUPPORTED/);
});
test('same operation ID is refused and closure disables comparison and preparation', async () => {
    const f = fixture(); f.args.newOperationId = () => 'old-command';
    const proposal = await createConflictNoteProposal(f.args);
    await assert.rejects(proposal.prepareReplacement({confirmed: true}), /ID_INVALID/);
    f.page.abort(); assert.throws(() => proposal.comparison, /INACTIVE/);
    await assert.rejects(proposal.prepareReplacement({confirmed: true}), /INACTIVE/);
});
test('abort during encryption prevents release of the prepared operation', async () => {
    const f = fixture(); f.args.context.encrypt = async value => { f.page.abort(); return cipher(value); };
    const proposal = await createConflictNoteProposal(f.args);
    await assert.rejects(proposal.prepareReplacement({confirmed: true}));
});
