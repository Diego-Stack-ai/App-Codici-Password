import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateProfileLinkRequest, profileLinkFingerprintInput} from './profile-link-contract.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';
import {createProfileLinkHandler} from './profile-link-handler.mjs';
const models = {};
for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
    Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
}
const hash = value => createHash('sha256').update(value).digest('hex'), deleted = '__synthetic_delete__';
function fixture(company = false) {
    const source = company ? {domain: 'company', companyId: 'origin', type: 'email', id: 'pec'} : {domain: 'private', type: 'phone', id: 'mobile'};
    const sourcePath = company ? 'users/owner/aziende/origin' : 'users/owner';
    const old = {linkedAccountId: 'old', linkedAccountCompanyId: ''};
    const profile = company ? {emails: {pec: {email: 'enc:email', password: 'enc:legacy', ...old}}}
        : {contactPhones: [{id: 'mobile', number: 'enc:mobile', ...old}, {id: 'fixed', number: 'enc:fixed', ...old}]};
    const records = new Map([[sourcePath, profile], ['users/owner/accounts/old', {password: 'enc:OLD',
        ...(company ? {linkedCompanyProfileFields: [{companyId: 'origin', type: 'email', id: 'pec'}, {companyId: 'other', type: 'email', id: 'pec'}]}
            : {linkedProfileFields: [{type: 'phone', id: 'mobile'}, {type: 'phone', id: 'fixed'}]})}],
        ['users/owner/aziende/destination', {ownerId: 'owner'}], ['users/owner/aziende/destination/accounts/next', {ownerId: 'owner', type: 'account', password: 'enc:NEXT'}]]);
    const db = {doc: path => path, async runTransaction(run) {
        const staged = new Map();
        const result = await run({get: async path => ({exists: records.has(path), data: () => structuredClone(records.get(path))}),
            update(path, patch) {assert.ok(records.has(path)); const value = {...structuredClone(records.get(path)), ...structuredClone(patch)};
                for (const key of Object.keys(value)) if (value[key] === deleted) delete value[key]; staged.set(path, value);},
            create(path, value) {assert.ok(!records.has(path)); staged.set(path, structuredClone(value));}});
        for (const [path, value] of staged) records.set(path, value); return result;
    }};
    const request = () => ({source, account: {domain: 'company', companyId: 'destination', id: 'next'}, expectedAccount: {domain: 'private', id: 'old'},
        expectedRevision: 0, expectedFingerprint: hash(readProfileLinkContact(records.get(sourcePath), source, models).fingerprintInput), operationId: 'op'});
    return {source, sourcePath, records, request, trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        run: createProfileLinkHandler({db, hash, models, timestamp: () => 123, deleteField: () => deleted})};
}
for (const company of [false, true]) test(`${company ? 'company' : 'private'} link replacement preserves credentials and unrelated inverse references atomically`, async () => {
    const f = fixture(company), request = f.request();
    assert.deepEqual(await f.run(request, f.trusted), {status: 'confirmed', revision: 1});
    const profile = f.records.get(f.sourcePath), old = f.records.get('users/owner/accounts/old'), next = f.records.get('users/owner/aziende/destination/accounts/next');
    assert.equal(readProfileLinkContact(profile, f.source, models).account.id, 'next');
    assert.equal(old.password, 'enc:OLD'); assert.equal(next.password, 'enc:NEXT');
    const key = company ? 'linkedCompanyProfileFields' : 'linkedProfileFields';
    assert.equal(old[key].length, 1); assert.equal(next[key].length, 1);
    assert.equal(company ? old[key][0].companyId : old[key][0].id, company ? 'other' : 'fixed');
    assert.equal(old._profileLinkRevision, 1); assert.equal(next._profileLinkRevision, 1);
    if (company) assert.equal(profile.emails.pec.password, 'enc:legacy');
    const after = structuredClone([...f.records]); await f.run(request, f.trusted); assert.deepEqual([...f.records], after);
});
test('unlink removes only one source and inverse link, even when the old account is missing', async () => {
    for (const missing of [false, true]) {
        const f = fixture(); if (missing) f.records.delete('users/owner/accounts/old');
        await f.run({...f.request(), account: null}, f.trusted);
        const rows = f.records.get(f.sourcePath).contactPhones;
        assert.equal(rows[0].linkedAccountId, ''); assert.equal(rows[1].linkedAccountId, 'old'); assert.equal(rows[0].number, 'enc:mobile');
    }
});
test('an account already used by another phone remains selectable for the first link', async () => {
    const f = fixture(); const rows = f.records.get(f.sourcePath).contactPhones;
    rows[0].linkedAccountId = ''; rows[0].linkedAccountCompanyId = '';
    const request = {...f.request(), expectedAccount: null, account: {domain: 'private', id: 'old'}};
    await f.run(request, f.trusted);
    assert.equal(f.records.get('users/owner/accounts/old').linkedProfileFields.length, 2);
});
test('changed contact content, relation or revision fail without partial writes or receipts', async () => {
    for (const mutate of [f => {f.records.get(f.sourcePath).contactPhones[0].number = 'changed';},
        f => {f.records.get(f.sourcePath).contactPhones[0].linkedAccountId = 'other';},
        f => {f.records.get(f.sourcePath)._profileLinkRevision = 1;}]) {
        const f = fixture(), request = f.request(); mutate(f); const before = structuredClone([...f.records]);
        await assert.rejects(f.run(request, f.trusted), /LINK_CONFLICT/); assert.deepEqual([...f.records], before);
    }
});
test('shared, archived, memo, foreign and aliased destinations are rejected without changing the source', async () => {
    for (const patch of [{isArchived: true}, {sharedWithUids: ['guest']}, {type: 'memo'}, {ownerId: 'other'}, {id: 'alias'}]) {
        const f = fixture(); Object.assign(f.records.get('users/owner/aziende/destination/accounts/next'), patch);
        const before = structuredClone([...f.records]); await assert.rejects(f.run(f.request(), f.trusted)); assert.deepEqual([...f.records], before);
    }
});
test('duplicate stored identities, missing utility parents and legacy company indexes are not invented', () => {
    const f = fixture(); f.records.get(f.sourcePath).contactPhones.push({...f.records.get(f.sourcePath).contactPhones[0]});
    assert.throws(() => f.request());
    assert.throws(() => readProfileLinkContact({userAddresses: [{id: 'a', utilities: [{id: 'u'}]}, {id: 'a'}]},
        {domain: 'private', type: 'utility', id: 'u', parentAddressId: 'a'}, models));
    assert.throws(() => validateProfileLinkRequest({...fixture(true).request(), source: {domain: 'company', companyId: 'origin', type: 'email', id: 'extra-0'}}));
    assert.throws(() => readProfileLinkContact({emails: {extra: [{id: 'pec', email: 'wrong-slot'}]}},
        {domain: 'company', companyId: 'origin', type: 'email', id: 'pec'}, models));
    assert.throws(() => readProfileLinkContact({telefonoAzienda: 'phone', phoneAccountLinks: {telefonoAzienda: {number: 'override'}}},
        {domain: 'company', companyId: 'origin', type: 'phone', id: 'telefonoAzienda'}, models));
});
test('utility identity includes its parent address and preserves the other address', async () => {
    const f = fixture(); f.source.type = 'utility'; f.source.id = 'utility'; f.source.parentAddressId = 'address';
    f.records.get(f.sourcePath).userAddresses = [{id: 'address', utilities: [{id: 'utility', value: 'enc:POD', linkedAccountId: 'old'}]},
        {id: 'other', utilities: [{id: 'utility', value: 'enc:OTHER', linkedAccountId: 'old'}]}];
    const old = f.records.get('users/owner/accounts/old'); delete old.linkedProfileFields;
    await f.run(f.request(), f.trusted);
    assert.equal(f.records.get(f.sourcePath).userAddresses[1].utilities[0].linkedAccountId, 'old');
    assert.ok(f.records.get('users/owner/accounts/old').linkedProfileFields.some(item => item.parentAddressId === 'other'));
});
test('malformed backlinks and untrusted requests fail closed; hashing is key-order independent', async () => {
    const f = fixture(); f.records.get('users/owner/accounts/old').linkedProfileField = {type: 'phone', id: 'mobile', unknown: true};
    const before = structuredClone([...f.records]); await assert.rejects(f.run(f.request(), f.trusted)); assert.deepEqual([...f.records], before);
    const g = fixture(); await assert.rejects(g.run(g.request(), {}));
    assert.throws(() => validateProfileLinkRequest({...g.request(), uid: 'other'}));
    assert.equal(profileLinkFingerprintInput({a: 1, b: 2}), profileLinkFingerprintInput({b: 2, a: 1}));
    assert.throws(() => profileLinkFingerprintInput({updatedAt: new Date()}));
});
test('unlink can clean an archived old account without changing archive state or its credentials', async () => {
    const f = fixture(); const old = f.records.get('users/owner/accounts/old'); old.isArchived = true;
    await f.run({...f.request(), account: null}, f.trusted);
    const saved = f.records.get('users/owner/accounts/old'); assert.equal(saved.isArchived, true);
    assert.equal(saved.password, 'enc:OLD'); assert.equal(saved.linkedProfileFields[0].id, 'fixed');
});
test('operation receipts cannot be reused for a different destination or unlink command', async () => {
    const f = fixture(), request = f.request(); await f.run(request, f.trusted);
    const after = structuredClone([...f.records]);
    await assert.rejects(f.run({...request, account: null}, f.trusted), /OPERATION_CONFLICT/);
    assert.deepEqual([...f.records], after);
});
