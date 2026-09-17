import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contactBasis, contactRevision, profileContactsCipher, validateProfileContactsRequest} from './profile-contacts-contract.mjs';
import {prepareProfileContacts} from './prepare-profile-contacts.mjs';
import {createProfileContactsHandler} from './profile-contacts-handler.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
const records = () => ({
    ownerId: 'owner',
    contactEmails: [
        {id: 'email-home', label: 'Casa', address: 'a@example.invalid', note: cipher('nota'), password: cipher('segreta'),
            isPrimary: true, legacyFlag: 'keep', linkedAccountId: 'account'},
        {id: 'email-work', label: 'Lavoro', address: 'b@example.invalid', extra: {nested: true}}
    ],
    contactPhones: [{id: 'phone-mobile', label: 'Cellulare', number: '3330000000'}],
    _profileContactsRevision: 1
});
// The editor snapshot as the real source builds it: displayed value plus the form
// already stored for that field.
const snapshots = record => {
    const snapshot = new Map();
    for (const [collection, items] of [['contactEmails', record.contactEmails ?? []], ['contactPhones', record.contactPhones ?? []]]) {
        for (const item of items) {
            if (typeof item.id !== 'string') continue;
            const fields = {}, forms = {};
            for (const [key, value] of Object.entries(item)) {
                if (typeof value !== 'string' || key === 'id') continue;
                forms[key] = profileContactsCipher(value) ? 'cipher' : 'plain';
                fields[key] = forms[key] === 'cipher' ? `plain:${value.slice(0, 8)}` : value;
            }
            snapshot.set(`${collection}:${item.id}`, {fields, forms});
        }
    }
    return snapshot;
};
function fixture(record = records()) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false, encrypted: []};
    const path = 'users/owner', stored = new Map([[path, structuredClone(record)]]);
    // Transactions are serialized so a concurrent request reads the committed state.
    let chain = Promise.resolve();
    const db = {doc: value => value, runTransaction(run) {
        const next = chain.then(async () => {
            const staged = new Map();
            const result = await run({
                async get(ref) {return {exists: stored.has(ref), data: () => structuredClone(stored.get(ref))};},
                update(ref, patch) {staged.set(ref, {...structuredClone(stored.get(ref)), ...structuredClone(patch)});},
                create(ref, value) {assert.equal(stored.has(ref), false, 'receipt already exists'); staged.set(ref, structuredClone(value));}
            });
            for (const [key, value] of staged) stored.set(key, value);
            return result;
        });
        chain = next.then(() => {}, () => {});
        return next;
    }};
    const context = {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        async encrypt(value) {state.encrypted.push(value); return cipher(value);},
        async read({ciphertext}) {return `plain:${ciphertext.slice(0, 8)}`;}};
    return {path, stored, context, abort, state, trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        handler: createProfileContactsHandler({db, hash, timestamp: () => 123}),
        prepare: draft => prepareProfileContacts({context, getUser: () => ({uid: state.uid}), record: structuredClone(stored.get(path)),
            snapshot: snapshots(stored.get(path)), draft, operationId: 'operation', hash})};
}
test('emails and telephones are created, updated and deleted through one frozen request', async () => {
    const f = fixture(), before = structuredClone(f.stored.get(f.path));
    const request = await f.prepare({
        creates: [{collection: 'contactEmails', id: 'email-new', fields: {label: 'Nuova', address: 'n@example.invalid', note: 'nota nuova', password: 'segreta nuova'}}],
        updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {number: '3331111111'}}],
        deletes: [{collection: 'contactEmails', id: 'email-work'}]});
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.operations));
    assert.deepEqual(request.operations.map(operation => operation.kind), ['create', 'update', 'delete']);
    assert.equal(request.operations[0].fields.note, cipher('nota nuova'));
    assert.equal(request.operations[0].fields.address, 'n@example.invalid');
    assert.equal(request.operations[1].fields.number, '3331111111');
    assert.equal(request.operations[2].basis, hash(contactBasis(before.contactEmails[1])));
    assert.deepEqual(f.state.encrypted, ['nota nuova', 'segreta nuova']);
    assert.deepEqual(f.stored.get(f.path), before, 'preparation never writes');
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const saved = f.stored.get(f.path);
    assert.deepEqual(saved.contactEmails[0], before.contactEmails[0]);
    assert.equal(saved.contactEmails[1].id, 'email-new');
    assert.equal(saved.contactEmails[1].isPrimary, false);
    assert.equal(saved.contactPhones[0].number, '3331111111');
    assert.equal(saved.contactPhones[0].label, 'Cellulare');
    assert.equal(saved._profileContactsRevision, 2);
    assert.equal(saved._profileContactsSchemaVersion, 1);
    assert.equal(saved._profileContactsUpdatedAt, 123);
    const allowed = new Set([...Object.keys(before), '_profileContactsSchemaVersion', '_profileContactsUpdatedAt']);
    assert.ok(Object.keys(saved).every(key => allowed.has(key)), 'no unrelated field is added');
});
test('editing preserves unknown, legacy and link fields and never reroutes an id', async () => {
    const f = fixture();
    const request = await f.prepare({updates: [{collection: 'contactEmails', id: 'email-home', fields: {label: 'Casa nuova'}}]});
    assert.deepEqual(request.operations[0].fields, {label: 'Casa nuova'});
    assert.deepEqual(f.state.encrypted, [], 'an unchanged cipher field is not re-encrypted');
    await f.handler(request, f.trusted);
    const row = f.stored.get(f.path).contactEmails[0];
    assert.equal(row.id, 'email-home'); assert.equal(row.label, 'Casa nuova');
    assert.equal(row.legacyFlag, 'keep'); assert.equal(row.isPrimary, true); assert.equal(row.linkedAccountId, 'account');
    assert.equal(row.note, cipher('nota')); assert.equal(row.password, cipher('segreta'));
    assert.deepEqual(f.stored.get(f.path).contactEmails[1].extra, {nested: true});
});
test('a legacy ciphertext keeps its stored form when the value changes', async () => {
    const f = fixture({ownerId: 'owner', contactEmails: [{id: 'email-legacy', address: cipher('vecchio'), legacyOnly: 7}]});
    const request = await f.prepare({updates: [{collection: 'contactEmails', id: 'email-legacy', fields: {address: 'nuovo@example.invalid'}}]});
    assert.equal(request.operations[0].fields.address, cipher('nuovo@example.invalid'));
    assert.deepEqual(f.state.encrypted, ['nuovo@example.invalid']);
    await f.handler(request, f.trusted);
    const row = f.stored.get(f.path).contactEmails[0];
    assert.equal(row.address, cipher('nuovo@example.invalid')); assert.equal(row.legacyOnly, 7);
});
test('explicit clearing writes an empty value and keeps every other field', async () => {
    const f = fixture();
    const request = await f.prepare({updates: [{collection: 'contactEmails', id: 'email-home', fields: {address: '', note: '', password: ''}}]});
    assert.deepEqual(request.operations[0].fields, {address: '', note: '', password: ''});
    assert.deepEqual(f.state.encrypted, []);
    await f.handler(request, f.trusted);
    const row = f.stored.get(f.path).contactEmails[0];
    assert.equal(row.address, ''); assert.equal(row.note, ''); assert.equal(row.password, '');
    assert.equal(row.label, 'Casa'); assert.equal(row.linkedAccountId, 'account');
});
test('an encryption failure aborts before any request is built', async () => {
    const f = fixture();
    f.context.encrypt = async () => 'not-a-cipher';
    await assert.rejects(f.prepare({updates: [{collection: 'contactEmails', id: 'email-home', fields: {note: 'nuova'}}]}), /ENCRYPTION_FAILED/);
    assert.equal(f.stored.get(f.path)._profileContactsRevision, 1);
});
test('unprepared or malformed drafts are rejected without encryption', async () => {
    for (const draft of [null, {}, {creates: [{collection: 'contactPhones', id: 'email-x', fields: {number: '1'}}]},
        {creates: [{collection: 'contactEmails', id: 'email-1', fields: {address: 'x'.repeat(321)}}]},
        {creates: [{collection: 'contactEmails', id: 'email-1', fields: {ownerId: 'x'}}]},
        {deletes: [{collection: 'userAddresses', id: 'address-1'}]},
        {updates: [{collection: 'contactEmails', id: 'email-home', fields: {}}]}]) {
        const f = fixture();
        await assert.rejects(f.prepare(draft));
        assert.deepEqual(f.state.encrypted, []);
    }
    const f = fixture();
    await assert.rejects(f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {number: '3330000000'}}]}),
        /PROFILE_CONTACTS_UNCHANGED/);
});
test('accepted requests are validated against the allowlist, the prefix rule and the revision', async () => {
    const f = fixture(), request = await f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]});
    assert.deepEqual(validateProfileContactsRequest(request), request);
    for (const patch of [{target: {domain: 'company', companyId: 'company'}}, {expectedRevision: -1}, {operationId: ''},
        {operations: [{kind: 'create', collection: 'contactEmails', id: 'extra-0', fields: {address: 'x'}}]},
        {operations: [{kind: 'delete', collection: 'contactPhones', id: 'phone-mobile'}]},
        {operations: [{kind: 'update', collection: 'contactPhones', id: 'phone-mobile', basis: 'short', fields: {label: 'x'}}]},
        {operations: [...request.operations, ...request.operations]}, {operations: []}]) {
        assert.throws(() => validateProfileContactsRequest({...request, ...patch}), /PROFILE_CONTACTS_INVALID/);
    }
    assert.equal(contactRevision({_profileContactsSchemaVersion: 1}), 0);
    assert.throws(() => contactRevision({_profileContactsSchemaVersion: 2}), /PROFILE_CONTACTS_INVALID/);
    assert.throws(() => contactRevision({isArchived: true}), /PROFILE_CONTACTS_INVALID/);
});
test('a changed, missing or duplicated row is refused before the transaction commits', async () => {
    const update = {updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]};
    for (const mutate of [record => {record.contactPhones = [];}, record => {record.contactPhones.push({id: 'phone-mobile', number: '111'});}]) {
        const f = fixture(); mutate(f.stored.get(f.path));
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.prepare(update), /PROFILE_CHANGED/);
        assert.deepEqual([...f.stored], before);
    }
    const f = fixture(), request = await f.prepare(update);
    f.stored.get(f.path).contactPhones.push({id: 'phone-mobile', number: '111'});
    await assert.rejects(f.handler(request, f.trusted), /CONTACTS_AMBIGUOUS/);
    f.stored.get(f.path).contactPhones = [];
    await assert.rejects(f.handler(request, f.trusted), /CONTACTS_MISSING/);
    assert.equal(f.stored.has('mutationResults/owner/operations/profile-contacts-operation'), false);
});
test('revision and fingerprint conflicts are refused without a receipt', async () => {
    const f = fixture(), request = await f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]});
    f.stored.get(f.path)._profileContactsRevision = 4;
    await assert.rejects(f.handler(request, f.trusted), /REVISION_CONFLICT/);
    assert.equal(f.stored.has('mutationResults/owner/operations/profile-contacts-operation'), false);
    const g = fixture(), stale = await g.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]});
    g.stored.get(g.path).contactPhones[0].number = '3339999999';
    await assert.rejects(g.handler(stale, g.trusted), /CONTACTS_CONFLICT/);
    assert.equal(g.stored.has('mutationResults/owner/operations/profile-contacts-operation'), false);
});
test('a linked row cannot be deleted and keeps its link when edited', async () => {
    const f = fixture();
    const remove = await f.prepare({deletes: [{collection: 'contactEmails', id: 'email-home'}]});
    await assert.rejects(f.handler(remove, f.trusted), /CONTACTS_LINKED/);
    assert.equal(f.stored.get(f.path).contactEmails.length, 2);
    const edit = await f.prepare({updates: [{collection: 'contactEmails', id: 'email-home', fields: {address: 'nuova@example.invalid'}}]});
    await f.handler(edit, f.trusted);
    const row = f.stored.get(f.path).contactEmails[0];
    assert.equal(row.address, 'nuova@example.invalid'); assert.equal(row.linkedAccountId, 'account');
});
const qrPath = 'users/owner/settings/qrCodeInclusions';
const remove = async (f, target) => f.handler(await f.prepare({deletes: [target]}), f.trusted);
test('a selected row is refused, by stored id or by a resolvable legacy position', async () => {
    for (const [selection, target] of [
        [{emails: ['email-work'], phones: []}, {collection: 'contactEmails', id: 'email-work'}],
        [{emails: [], phones: [0]}, {collection: 'contactPhones', id: 'phone-mobile'}],
        [{emails: [], phones: ['phone-mobile']}, {collection: 'contactPhones', id: 'phone-mobile'}]]) {
        const f = fixture();
        f.stored.set(qrPath, selection);
        const before = structuredClone([...f.stored]);
        await assert.rejects(remove(f, target), /CONTACTS_QR_SELECTED/);
        assert.deepEqual([...f.stored], before);
    }
});
test('a legacy positional reference that the deletion would shift blocks the operation', async () => {
    const record = {ownerId: 'owner', contactEmails: [{id: 'email-a', address: 'a@example.invalid'},
        {id: 'email-b', address: 'b@example.invalid'}], contactPhones: [], _profileContactsRevision: 1};
    const f = fixture(record);
    f.stored.set(qrPath, {emails: [1], phones: []});
    const before = structuredClone([...f.stored]);
    await assert.rejects(remove(f, {collection: 'contactEmails', id: 'email-a'}), /CONTACTS_QR_INDEXED/);
    assert.deepEqual([...f.stored], before);
    await assert.rejects(remove(f, {collection: 'contactEmails', id: 'email-b'}), /CONTACTS_QR_SELECTED/);
    assert.deepEqual([...f.stored], before);
});
for (const [name, selection] of [
    ['emails with the wrong type', {emails: 'email-work', phones: []}],
    ['phones with the wrong type', {emails: [], phones: {}}],
    ['a reference to a non-existent id', {emails: ['email-missing'], phones: []}],
    ['duplicate references', {emails: ['email-home', 'email-home'], phones: []}],
    ['an unresolvable legacy index', {emails: [], phones: [7]}],
    ['a negative legacy index', {emails: [], phones: [-1]}],
    ['a reference into a missing section', {emails: [], phones: [], addresses: ['address-missing']}],
    ['a scalar with the wrong type', {emails: [], phones: [], nome: 'si'}],
    ['an unsupported schema version', {emails: [], phones: [], _qrSchemaVersion: 2}],
    ['a foreign transport id', {emails: [], phones: [], id: 'otherSetting'}],
    ['a configuration that is not an object', 'not-an-object']]) {
    test(`an unverifiable QR configuration refuses the deletion: ${name}`, async () => {
        const f = fixture();
        f.stored.set(qrPath, selection);
        const before = structuredClone([...f.stored]);
        // The unrelated target proves that the whole configuration is validated.
        await assert.rejects(remove(f, {collection: 'contactPhones', id: 'phone-mobile'}), /CONTACTS_QR_UNVERIFIABLE/);
        assert.deepEqual([...f.stored], before);
        assert.equal(f.stored.has('mutationResults/owner/operations/profile-contacts-operation'), false);
    });
}
test('a missing document and a verified unselected contact still allow the deletion', async () => {
    const absent = fixture();
    await remove(absent, {collection: 'contactPhones', id: 'phone-mobile'});
    assert.equal(absent.stored.get(absent.path).contactPhones.length, 0);
    assert.equal(absent.stored.has(qrPath), false);
    for (const selection of [{emails: [], phones: []}, {nome: true, emails: ['email-work'], phones: [], addresses: []}]) {
        const f = fixture();
        f.stored.set(qrPath, selection);
        await remove(f, {collection: 'contactPhones', id: 'phone-mobile'});
        assert.equal(f.stored.get(f.path).contactPhones.length, 0);
        assert.equal(f.stored.get(f.path).contactEmails.length, 2, 'an unrelated collection is untouched');
        assert.deepEqual(f.stored.get(qrPath), selection, 'the selection is never modified');
    }
});
test('the same operation retries idempotently and cannot be reused for another request', async () => {
    const f = fixture(), request = await f.prepare({deletes: [{collection: 'contactEmails', id: 'email-work'}]});
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const after = structuredClone([...f.stored]);
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual([...f.stored], after);
    const reused = {...request, operations: [{...request.operations[0], id: 'email-home', basis: hash(contactBasis(records().contactEmails[0]))}]};
    await assert.rejects(f.handler(reused, f.trusted), /OPERATION_CONFLICT/);
    assert.deepEqual([...f.stored], after);
});
test('one failing operation leaves the whole document and the receipt untouched', async () => {
    const f = fixture();
    const request = await f.prepare({creates: [{collection: 'contactPhones', id: 'phone-new', fields: {number: '3332222222'}}],
        updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]});
    f.stored.get(f.path).contactPhones[0].number = 'cambiato nel frattempo';
    const before = structuredClone([...f.stored]);
    await assert.rejects(f.handler(request, f.trusted), /CONTACTS_CONFLICT/);
    assert.deepEqual([...f.stored], before);
});
test('concurrent requests against the same revision cannot both commit', async () => {
    const f = fixture();
    const first = await f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Uno'}}]});
    const second = await f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Due'}}]});
    const results = await Promise.allSettled([f.handler({...first, operationId: 'a'}, f.trusted), f.handler({...second, operationId: 'b'}, f.trusted)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(f.stored.get(f.path)._profileContactsRevision, 2);
});
test('untrusted context, foreign owners and archived profiles never write', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(), request = await f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]});
        await assert.rejects(f.handler(request, trusted));
        assert.equal(f.stored.get(f.path)._profileContactsRevision, 1);
    }
    for (const mutate of [record => {record.ownerId = 'other';}, record => {record.isArchived = true;}, record => {record._profileContactsSchemaVersion = 2;}]) {
        const f = fixture(), request = await f.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio'}}]});
        mutate(f.stored.get(f.path));
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(request, f.trusted));
        assert.deepEqual([...f.stored], before);
    }
});
for (const boundary of ['uid', 'locked', 'abort']) test(`preparation is revoked during encryption after ${boundary}`, async () => {
    const f = fixture();
    let release;
    f.context.encrypt = value => new Promise(resolve => {release = () => resolve(cipher(value));});
    const pending = f.prepare({updates: [{collection: 'contactEmails', id: 'email-home', fields: {note: 'nuova'}}]});
    await new Promise(setImmediate);
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    release();
    await assert.rejects(pending);
});
