import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';
function fixture() {
    const records = new Map([['users/owner', {ownerId: 'owner', contactPhones: [{id: 'phone'}]}]]);
    const db = {doc: path => path, async runTransaction(run) {
        const staged = new Map();
        const result = await run({get: async ref => ({exists: records.has(ref), data: () => structuredClone(records.get(ref))}),
            set(ref, value) {staged.set(ref, structuredClone(value));},
            create(ref, value) {assert.ok(!records.has(ref)); staged.set(ref, structuredClone(value));}});
        for (const [key, value] of staged) records.set(key, value);
        return result;
    }};
    const data = {operationId: 'operation', expectedRevision: 0,
        selection: {nome: true, cognome: false, cf: false, nascita: false, photo: false, phones: ['phone'], emails: [], addresses: []}};
    return {records, data, trusted: {auth: {uid: 'owner'}, app: {appId: 'trusted-app'}},
        run: createPrivateQrSelectionHandler({db, hash: value => createHash('sha256').update(value).digest('hex'), timestamp: () => 123})};
}
test('selection and bound receipt commit together; retry does not advance revision', async () => {
    const f = fixture(); const result = await f.run(f.data, f.trusted);
    assert.deepEqual(result, {status: 'confirmed', revision: 1});
    const stored = structuredClone([...f.records]);
    assert.deepEqual(await f.run(f.data, f.trusted), result); assert.deepEqual([...f.records], stored);
    assert.equal(f.records.get('users/owner/settings/qrCodeInclusions')._qrRevision, 1);
    assert.doesNotMatch(JSON.stringify(f.records.get('mutationResults/owner/operations/qr-private-operation')), /phone|"selection":/);
});
test('untrusted context and client-supplied identity are rejected without writes', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../other'}, app: {appId: 'x'}}]) {
        const f = fixture(); await assert.rejects(f.run(f.data, trusted)); assert.equal(f.records.size, 1);
    }
    const f = fixture(); f.data.uid = 'other'; await assert.rejects(f.run(f.data, f.trusted)); assert.equal(f.records.size, 1);
});
test('changed retry payload and stale revision cannot overwrite a confirmed selection', async () => {
    const f = fixture(); await f.run(f.data, f.trusted); const stored = structuredClone([...f.records]);
    f.data.selection.photo = true; await assert.rejects(f.run(f.data, f.trusted), /OPERATION_CONFLICT/);
    f.data.operationId = 'second'; await assert.rejects(f.run(f.data, f.trusted), /REVISION_CONFLICT/);
    assert.deepEqual([...f.records], stored);
});
test('deleted/ambiguous contacts, indexes and unsupported settings fail without receipts', async () => {
    for (const mutate of [f => {f.records.get('users/owner').contactPhones = [];},
        f => {f.records.get('users/owner').contactPhones.push({id: 'phone'});}, f => {f.data.selection.phones = [0];},
        f => {f.records.set('users/owner/settings/qrCodeInclusions', {unknown: true});}]) {
        const f = fixture(); mutate(f); const before = structuredClone([...f.records]);
        await assert.rejects(f.run(f.data, f.trusted)); assert.deepEqual([...f.records], before);
    }
});
