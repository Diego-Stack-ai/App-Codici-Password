import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createProfileAccountCreateSource} from './prepare-profile-account-create.mjs';
import {createProfileAccountCreateHandler} from './profile-account-create-handler.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';
const models = {};
for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) Object.assign(models,
    await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
const sha = value => createHash('sha256').update(value).digest('hex');
const cipher = value => Buffer.from(`synthetic-ciphertext-fixture:${value}`).toString('base64');
const deleted = Symbol('deleted');
const clean = value => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== deleted).map(([key, child]) => [key, clean(child)]));
    return value;
};
function fixture({type = 'email', company = false} = {}) {
    const source = company ? {domain: 'company', companyId: 'origin', type: 'email', id: 'pec'} :
        type === 'utility' ? {domain: 'private', type, id: 'utility', parentAddressId: 'address'} : {domain: 'private', type, id: `${type}-id`};
    const item = type === 'email' ? {id: 'email-id', address: cipher('mail@example.invalid'), password: cipher('legacy'), extra: 'keep'} :
        type === 'phone' ? {id: 'phone-id', number: cipher('333'), extra: 'keep'} :
        type === 'document' ? {id: 'document-id', type: 'Patente', nome: 'Patente', extra: 'keep'} :
        {id: 'utility', type: 'Energia', value: cipher('POD'), passwordLegacy: cipher('legacy'), extra: 'keep'};
    const profile = company ? {ownerId: 'owner', id: 'origin', emails: {pec: {email: cipher('pec@example.invalid'), password: cipher('legacy'), extra: 'keep'}}} :
        type === 'utility' ? {ownerId: 'owner', userAddresses: [{id: 'address', label: 'Casa', utilities: [item]}]} :
        {ownerId: 'owner', [type === 'email' ? 'contactEmails' : type === 'phone' ? 'contactPhones' : 'documenti']: [item]};
    const sourcePath = company ? 'users/owner/aziende/origin' : 'users/owner';
    const records = new Map([[sourcePath, profile], ['users/owner/aziende/firm', {ownerId: 'owner', id: 'firm'}]]);
    const db = {doc: path => path, async runTransaction(run) { const staged = new Map();
        const tx = {get: async path => ({exists: records.has(path), data: () => structuredClone(records.get(path))}),
            create(path, value) { if (records.has(path) || staged.has(path)) throw Error('exists'); staged.set(path, clean(structuredClone(value))); },
            update(path, patch) { staged.set(path, clean({...structuredClone(records.get(path)), ...patch})); }};
        const result = await run(tx); for (const [path, value] of staged) records.set(path, value); return result; }};
    const request = ({scope = {domain: 'private'}, transfer = false, operationId = 'operation'} = {}) => ({source, scope,
        name: cipher('Nuovo Account'), username: cipher('username'), password: transfer ? cipher('legacy') : '', transferLegacyPassword: transfer,
        expectedLegacyPassword: transfer ? cipher('legacy') : '', expectedFingerprint: sha(readProfileLinkContact(profile, source, models).fingerprintInput),
        expectedRevision: 0, operationId, expectedOwnerUid: 'owner'});
    const run = createProfileAccountCreateHandler({db, hash: sha, timestamp: () => 123, deleteField: () => deleted, models});
    return {source, sourcePath, records, request, run, trusted: {auth: {uid: 'owner'}, app: {appId: 'app'}}};
}

for (const type of ['email', 'phone', 'document', 'utility']) test(`creates and atomically links a private Account from ${type}`, async () => {
    const f = fixture({type}), result = await f.run(f.request(), f.trusted);
    assert.equal(result.status, 'confirmed'); assert.equal(result.account.domain, 'private');
    const account = f.records.get(`users/owner/accounts/${result.account.id}`); assert.equal(account.ownerId, 'owner');
    assert.equal(account.linkedProfileFields[0].type, type); assert.equal(account.nomeAccount, cipher('Nuovo Account'));
    assert.equal(readProfileLinkContact(f.records.get(f.sourcePath), f.source, models).account.id, result.account.id);
    const after = structuredClone([...f.records]); await f.run(f.request(), f.trusted); assert.deepEqual([...f.records], after);
});

test('company scope validates ownership and creates the backlink without inventing source fields', async () => {
    const f = fixture({company: true}); const result = await f.run(f.request({scope: {domain: 'company', companyId: 'firm'}}), f.trusted);
    const account = f.records.get(`users/owner/aziende/firm/accounts/${result.account.id}`);
    assert.deepEqual(account.linkedCompanyProfileFields, [{companyId: 'origin', type: 'email', id: 'pec'}]);
    assert.equal(f.records.get(f.sourcePath).emails.pec.extra, 'keep');
});

test('legacy transfer is explicit, preserves it when declined and removes only after successful commit', async () => {
    const kept = fixture(); const a = await kept.run(kept.request(), kept.trusted);
    assert.equal(kept.records.get(kept.sourcePath).contactEmails[0].password, cipher('legacy'));
    assert.equal(kept.records.get(`users/owner/accounts/${a.account.id}`).password, '');
    const moved = fixture(); const b = await moved.run(moved.request({transfer: true}), moved.trusted);
    assert.equal(Object.hasOwn(moved.records.get(moved.sourcePath).contactEmails[0], 'password'), false);
    assert.equal(moved.records.get(`users/owner/accounts/${b.account.id}`).password, cipher('legacy'));
    const conflict = fixture(); const request = conflict.request({transfer: true}); conflict.records.get(conflict.sourcePath).contactEmails[0].password = cipher('changed');
    await assert.rejects(conflict.run(request, conflict.trusted), /LINK_CONFLICT|LEGACY_PASSWORD_CHANGED/);
    assert.equal([...conflict.records.keys()].some(path => path.includes('/accounts/')), false);
});

test('concurrency, foreign company and receipt reuse fail closed without orphan Accounts', async () => {
    const f = fixture(), request = f.request(); f.records.get(f.sourcePath)._profileLinkRevision = 1;
    await assert.rejects(f.run(request, f.trusted), /LINK_CONFLICT/); assert.equal([...f.records.keys()].some(path => path.includes('/accounts/')), false);
    const g = fixture(); g.records.get('users/owner/aziende/firm').ownerId = 'other';
    await assert.rejects(g.run(g.request({scope: {domain: 'company', companyId: 'firm'}}), g.trusted), /COMPANY_UNAVAILABLE/);
    const h = fixture(); await h.run(h.request(), h.trusted);
    await assert.rejects(h.run(h.request({scope: {domain: 'company', companyId: 'firm'}}), h.trusted), /OPERATION_CONFLICT/);
});

test('client preparation proposes the origin, encrypts form values and transfers legacy only by choice', async () => {
    const f = fixture(), abort = new AbortController(), encrypted = [];
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {}, encrypt: async value => { encrypted.push(value); return cipher(value); }};
    const source = createProfileAccountCreateSource({context, getUser: () => ({uid: 'owner'}), readProfile: async () => structuredClone(f.records.get(f.sourcePath)),
        source: f.source, models, hash: sha, isOnline: () => true});
    const model = await source.load(); assert.equal(model.canTransferLegacy, true); assert.equal(model.suggestedUsername, cipher('mail@example.invalid'));
    const request = await source.prepare({scope: {domain: 'private'}, name: 'Posta', username: 'mail@example.invalid', transferLegacyPassword: true, operationId: 'op'});
    assert.deepEqual(encrypted, ['Posta', 'mail@example.invalid']); assert.equal(request.password, cipher('legacy'));
    abort.abort(); await assert.rejects(source.prepare({scope: {domain: 'private'}, name: 'x', username: '', operationId: 'later'}), /VIEW_DISPOSED/);
});
