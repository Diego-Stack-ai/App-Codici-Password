import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCompanyQrSelectionHandler} from './company-qr-selection-handler.mjs';
import {readCompanyQrSelection} from './company-qr-selection-contract.mjs';
function fixture(hash = value => createHash('sha256').update(value).digest('hex')) {
    const path = 'users/owner/aziende/company';
    const records = new Map([[path, {ownerId: 'owner', ragioneSociale: 'enc:SECRET',
        emails: {pec: {password: 'enc:SECRET'}, extra: [{qr: false}]}, altreSedi: [{qr: true}]}]]);
    const db = {doc: path => path, async runTransaction(run) {
        const staged = new Map();
        const result = await run({get: async ref => ({exists: records.has(ref), data: () => structuredClone(records.get(ref))}),
            update(ref, value) {assert.ok(records.has(ref)); staged.set(ref, {...structuredClone(records.get(ref)), ...structuredClone(value)});},
            create(ref, value) {assert.ok(!records.has(ref)); staged.set(ref, structuredClone(value));}});
        for (const [key, value] of staged) records.set(key, value);
        return result;
    }};
    const data = {companyId: 'company', operationId: 'first', expectedConfig: null,
        selection: {...readCompanyQrSelection({}).selection, ragioneSociale: true}};
    return {records, path, data, trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        run: createCompanyQrSelectionHandler({db, hash, timestamp: () => 123})};
}
test('company QR update preserves every other field and commits an idempotent bound receipt', async () => {
    const f = fixture(), original = structuredClone(f.records.get(f.path));
    assert.deepEqual(await f.run(f.data, f.trusted), {status: 'confirmed', revision: 1});
    const {qrConfig, ...rest} = f.records.get(f.path); assert.deepEqual(rest, original);
    assert.equal(qrConfig.ragioneSociale, true); assert.equal(qrConfig.telefonoAzienda, false);
    const after = structuredClone([...f.records]);
    assert.deepEqual(await f.run(f.data, f.trusted), {status: 'confirmed', revision: 1}); assert.deepEqual([...f.records], after);
    assert.doesNotMatch(JSON.stringify(f.records.get('mutationResults/owner/operations/qr-company-first')), /SECRET|"selection"|password/);
});
test('legacy configuration edits without a revision are detected; key order alone is not a conflict', async () => {
    const f = fixture(); f.data.expectedConfig = {qrLegale: false, ragioneSociale: true};
    f.records.get(f.path).qrConfig = {ragioneSociale: true, qrLegale: true};
    await assert.rejects(f.run(f.data, f.trusted), /REVISION_CONFLICT/); assert.equal(f.records.size, 1);
    f.records.get(f.path).qrConfig.qrLegale = false;
    await f.run(f.data, f.trusted); assert.equal(f.records.get(f.path).qrConfig._qrRevision, 1);
});
test('reusing an operation for a different company or selection is rejected', async () => {
    const f = fixture(); await f.run(f.data, f.trusted);
    await assert.rejects(f.run({...f.data, companyId: 'other-company'}, f.trusted), /OPERATION_CONFLICT/);
    await assert.rejects(f.run({...f.data, selection: {...f.data.selection, telefonoAzienda: true}}, f.trusted), /OPERATION_CONFLICT/);
    await assert.rejects(f.run({...f.data, operationId: 'second'}, f.trusted), /REVISION_CONFLICT/);
});
test('missing, archived, foreign-owned and unsupported company records produce no receipt', async () => {
    for (const mutate of [f => f.records.delete(f.path), f => {f.records.get(f.path).isArchived = true;},
        f => {f.records.get(f.path).ownerId = 'other';}, f => {f.records.get(f.path).qrConfig = {future: true};}]) {
        const f = fixture(); mutate(f); const before = structuredClone([...f.records]);
        await assert.rejects(f.run(f.data, f.trusted)); assert.deepEqual([...f.records], before);
    }
});
test('untrusted contexts, injected fields and malformed identifiers are rejected before a write', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(); await assert.rejects(f.run(f.data, trusted)); assert.equal(f.records.size, 1);
    }
    for (const patch of [{uid: 'other'}, {companyId: '../company'}, {operationId: 'x/y'}, {expectedConfig: undefined}, {selection: {}}]) {
        const f = fixture(); await assert.rejects(f.run({...f.data, ...patch}, f.trusted)); assert.equal(f.records.size, 1);
    }
});
test('request mutation during hashing cannot retarget a company or change the prepared selection', async () => {
    let release; const f = fixture(() => new Promise(resolve => {release = resolve;}));
    const pending = f.run(f.data, f.trusted);
    f.data.companyId = 'other'; f.data.selection.telefonoAzienda = true; f.data.expectedConfig = {};
    release('synthetic-digest'); await pending;
    assert.equal(f.records.get(f.path).qrConfig.telefonoAzienda, false);
    assert.equal(f.records.has('users/owner/aziende/other'), false);
});
