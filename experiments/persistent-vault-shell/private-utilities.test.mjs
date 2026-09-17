import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {privateUtilityBasis, privateUtilitiesRevision, validatePrivateUtilitiesRequest} from './private-utilities-contract.mjs';
import {preparePrivateUtilities} from './prepare-private-utilities.mjs';
import {createPrivateUtilitiesHandler} from './private-utilities-handler.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
// The real nested schema: utilities inside their address, `value` encrypted and
// everything else in clear, an Account link on the row, an unknown field, a legacy
// password and an identity derived from the parent address and the position.
const records = () => ({
    ownerId: 'owner', nome: 'Nome fittizio', _profileUtilitiesRevision: 1,
    userAddresses: [
        {id: 'address-home', type: 'Residenza', address: 'Via fittizia 1', campoIgnoto: 'da conservare', utilities: [
            {id: 'utility-gas', type: 'Contatore Metano', value: cipher('POD-FITTIZIO'), campoIgnotoRiga: 'da conservare',
                passwordLegacy: cipher('SEGRETA')},
            {id: 'utility-free', type: 'Fibra', value: cipher('FIBRA-1')},
            {id: 'utility-linked', type: 'Codice POD', value: cipher('POD-2'), linkedAccountId: 'account',
                linkedAccountCompanyId: 'company'},
            {id: 'utility-address-home-legacy-1a2b', type: 'Altro', value: cipher('LEGACY')}]},
        {id: 'address-office', type: 'Ufficio', address: 'Via ufficio 2', utilities: [{id: 'utility-office', type: 'Altro', value: cipher('UFF')}]}]
});
const snapshots = (record, parentAddressId) => {
    const map = new Map();
    const parent = (record.userAddresses ?? []).find(item => item.id === parentAddressId);
    for (const item of parent?.utilities ?? []) {
        if (typeof item.id !== 'string') continue;
        map.set(item.id, {fields: {type: item.type ?? '', value: item.value ?? ''}});
    }
    return map;
};
function fixture(record = records(), parentAddressId = 'address-home') {
    const abort = new AbortController(), state = {uid: 'owner', locked: false};
    const path = 'users/owner', selectionPath = 'users/owner/settings/qrCodeInclusions';
    const stored = new Map([[path, structuredClone(record)]]);
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
        async encrypt(value) {return cipher(value);}};
    const utilitiesOf = (source, id) => (source.userAddresses.find(item => item.id === id)?.utilities ?? []);
    return {path, selectionPath, stored, context, abort, state,
        trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        handler: createPrivateUtilitiesHandler({db, hash, timestamp: () => 123}),
        utilities: () => utilitiesOf(stored.get(path), parentAddressId),
        prepare: draft => preparePrivateUtilities({context, getUser: () => ({uid: state.uid}),
            record: structuredClone(stored.get(path)), parentAddressId, snapshot: snapshots(stored.get(path), parentAddressId),
            draft, operationId: 'operation', hash})};
}
test('nested utilities are created, updated and deleted through one frozen request', async () => {
    const f = fixture(), before = structuredClone(f.stored.get(f.path));
    const request = await f.prepare({
        creates: [{id: 'utility-new', fields: {type: 'Fibra', value: 'NUOVO'}}],
        updates: [{id: 'utility-gas', fields: {value: 'MODIFICATO'}}],
        deletes: [{id: 'utility-free'}]});
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.operations));
    assert.equal(request.parentAddressId, 'address-home');
    assert.deepEqual(request.operations.map(operation => operation.kind), ['create', 'update', 'delete']);
    assert.equal(request.operations[0].fields.value, cipher('NUOVO'), 'the stored form of the row is cipher');
    assert.equal(request.operations[1].fields.value, cipher('MODIFICATO'));
    assert.equal(request.operations[2].basis, hash(privateUtilityBasis(before.userAddresses[0].utilities[1])));
    assert.deepEqual(f.stored.get(f.path), before, 'preparation never writes');
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const saved = f.stored.get(f.path);
    assert.deepEqual(saved.userAddresses[0].utilities.map(item => item.id), ['utility-gas', 'utility-linked',
        'utility-address-home-legacy-1a2b', 'utility-new']);
    assert.equal(saved.userAddresses[0].utilities[0].value, cipher('MODIFICATO'));
    assert.equal(saved.userAddresses[0].utilities[0].campoIgnotoRiga, 'da conservare', 'an unknown field of the row survives');
    assert.equal(saved.userAddresses[0].utilities[0].passwordLegacy, cipher('SEGRETA'), 'a legacy password survives');
    assert.deepEqual(saved.userAddresses[0].utilities[1], before.userAddresses[0].utilities[2], 'the linked row is untouched');
    assert.equal(saved.userAddresses[0].campoIgnoto, 'da conservare', 'the parent address is not rewritten');
    assert.equal(saved.userAddresses[0].address, 'Via fittizia 1');
    assert.deepEqual(saved.userAddresses[1], before.userAddresses[1], 'the other address is untouched');
    assert.equal(saved.nome, 'Nome fittizio');
    assert.equal(saved._profileUtilitiesRevision, 2);
    assert.equal(saved._profileUtilitiesSchemaVersion, 1);
    assert.equal(saved._profileUtilitiesUpdatedAt, 123);
    assert.ok(f.stored.has('mutationResults/owner/operations/profile-utilities-operation'));
});
test('a linked utility, a derived identity and a QR-included parent are never deleted', async () => {
    const f = fixture();
    await assert.rejects(() => f.prepare({deletes: [{id: 'utility-linked'}]}), /PROFILE_UTILITY_LINKED/);
    await assert.rejects(() => f.prepare({deletes: [{id: 'utility-address-home-legacy-1a2b'}]}), /UTILITY_ID_DERIVED/);
    await assert.rejects(() => f.prepare({updates: [{id: 'utility-address-home-legacy-1a2b', fields: {value: 'x'}}]}),
        /UTILITY_ID_DERIVED/);
    await assert.rejects(() => f.prepare({deletes: [{id: 'utility-office'}]}), /PROFILE_CHANGED/,
        'a utility of another address is never reachable through this parent');
    assert.equal(f.stored.get(f.path)._profileUtilitiesRevision, 1);
    // A derived identity is refused by the validator too.
    assert.throws(() => validatePrivateUtilitiesRequest({target: {domain: 'private'}, parentAddressId: 'address-home',
        expectedRevision: 1, operationId: 'operation', operations: [{kind: 'delete', id: 'utility-address-home-legacy-1a2b',
            basis: 'a'.repeat(64)}]}), /PROFILE_UTILITIES_INVALID/);
    assert.throws(() => validatePrivateUtilitiesRequest({target: {domain: 'private'}, parentAddressId: 'address-legacy-9',
        expectedRevision: 1, operationId: 'operation', operations: [{kind: 'delete', id: 'utility-free', basis: 'a'.repeat(64)}]}),
        /PROFILE_UTILITIES_INVALID/, 'a legacy parent address is not an addressable parent');
    // The parent address decides: if the card publishes it, its utilities go with it.
    const published = fixture();
    published.stored.set(published.selectionPath, {nome: true, emails: [], phones: [], addresses: ['address-home']});
    const request = await published.prepare({deletes: [{id: 'utility-free'}]});
    await assert.rejects(published.handler(request, published.trusted), /PROFILE_UTILITY_QR_SELECTED/);
    assert.equal(published.utilities().length, 4);
    // A non-destructive edit stays available on the same row.
    const edited = await published.prepare({updates: [{id: 'utility-free', fields: {type: 'Altro'}}]});
    assert.deepEqual(edited.operations[0].fields, {type: 'Altro'});
});
test('revision, fingerprint, parent and row conflicts are refused without a receipt', async () => {
    const update = {updates: [{id: 'utility-free', fields: {type: 'Altro'}}]};
    const f = fixture(), request = await f.prepare(update);
    f.stored.get(f.path)._profileUtilitiesRevision = 4;
    await assert.rejects(f.handler(request, f.trusted), /REVISION_CONFLICT/);
    const g = fixture(), stale = await g.prepare(update);
    g.stored.get(g.path).userAddresses[0].utilities[1].value = cipher('CAMBIATA');
    await assert.rejects(g.handler(stale, g.trusted), /UTILITIES_CONFLICT/);
    assert.equal(g.stored.has('mutationResults/owner/operations/profile-utilities-operation'), false);
    const h = fixture(), gone = await h.prepare(update);
    h.stored.get(h.path).userAddresses[0].utilities = h.stored.get(h.path).userAddresses[0].utilities.filter(item => item.id !== 'utility-free');
    await assert.rejects(h.handler(gone, h.trusted), /UTILITIES_MISSING/);
    const i = fixture(), ambiguous = await i.prepare(update);
    i.stored.get(i.path).userAddresses[0].utilities.push({id: 'utility-free', type: 'Doppione'});
    await assert.rejects(i.handler(ambiguous, i.trusted), /UTILITIES_AMBIGUOUS/);
    const l = fixture(), created = await l.prepare({creates: [{id: 'utility-new', fields: {value: 'x'}}]});
    l.stored.get(l.path).userAddresses[0].utilities.push({id: 'utility-new', value: cipher('x')});
    await assert.rejects(l.handler(created, l.trusted), /UTILITIES_EXISTS/);
    const m = fixture(), parentGone = await m.prepare(update);
    m.stored.get(m.path).userAddresses = m.stored.get(m.path).userAddresses.filter(item => item.id !== 'address-home');
    await assert.rejects(m.handler(parentGone, m.trusted), /UTILITY_PARENT_MISSING/);
    assert.equal(m.stored.has('mutationResults/owner/operations/profile-utilities-operation'), false);
    const n = fixture(), parentTwice = await n.prepare(update);
    n.stored.get(n.path).userAddresses.push({id: 'address-home', utilities: []});
    await assert.rejects(n.handler(parentTwice, n.trusted), /UTILITY_PARENT_AMBIGUOUS/);
    const o = fixture(), malformed = await o.prepare(update);
    o.stored.get(o.path).userAddresses[0].utilities = 'non-una-lista';
    await assert.rejects(o.handler(malformed, o.trusted), /PROFILE_UTILITIES_SHAPE_INVALID/);
});
test('the same operation retries idempotently and concurrent requests cannot both commit', async () => {
    const f = fixture(), request = await f.prepare({deletes: [{id: 'utility-free'}]});
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const after = structuredClone([...f.stored]);
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual([...f.stored], after);
    const reused = {...request, operations: [{...request.operations[0], id: 'utility-linked',
        basis: hash(privateUtilityBasis(records().userAddresses[0].utilities[2]))}]};
    await assert.rejects(f.handler(reused, f.trusted), /OPERATION_CONFLICT/);
    const g = fixture();
    const first = await g.prepare({updates: [{id: 'utility-free', fields: {type: 'Uno'}}]});
    const second = await g.prepare({updates: [{id: 'utility-free', fields: {type: 'Due'}}]});
    const results = await Promise.allSettled([g.handler({...first, operationId: 'a'}, g.trusted),
        g.handler({...second, operationId: 'b'}, g.trusted)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(g.stored.get(g.path)._profileUtilitiesRevision, 2);
});
test('the QR configuration decides the deletion and is never rewritten', async () => {
    for (const selection of [{addresses: 'address-home'}, {addresses: ['address-missing']}, {addresses: [3]},
        {addresses: ['address-home', 'address-home']}, 'non-un-oggetto']) {
        const f = fixture();
        f.stored.set(f.selectionPath, selection);
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(await f.prepare({deletes: [{id: 'utility-free'}]}), f.trusted), /UTILITIES_QR_UNVERIFIABLE/,
            JSON.stringify(selection));
        assert.deepEqual([...f.stored], before);
    }
    const absent = fixture();
    assert.deepEqual(await absent.handler(await absent.prepare({deletes: [{id: 'utility-free'}]}), absent.trusted),
        {status: 'confirmed', revision: 2});
    assert.equal(absent.stored.has(absent.selectionPath), false, 'a deletion never recreates the selection');
    const other = fixture();
    other.stored.set(other.selectionPath, {nome: true, emails: [], phones: [], addresses: ['address-office']});
    assert.deepEqual(await other.handler(await other.prepare({deletes: [{id: 'utility-free'}]}), other.trusted),
        {status: 'confirmed', revision: 2});
    assert.deepEqual(other.stored.get(other.selectionPath), {nome: true, emails: [], phones: [], addresses: ['address-office']});
});
test('untrusted context, archived profiles and a revoked view never write', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'utility-free', fields: {type: 'Altro'}}]});
        await assert.rejects(f.handler(request, trusted));
        assert.equal(f.stored.get(f.path)._profileUtilitiesRevision, 1);
    }
    for (const mutate of [record => {record.ownerId = 'other';}, record => {record.isArchived = true;},
        record => {record._profileUtilitiesSchemaVersion = 2;}, record => {record.userAddresses = 'non-una-lista';}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'utility-free', fields: {type: 'Altro'}}]});
        mutate(f.stored.get(f.path));
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(request, f.trusted));
        assert.deepEqual([...f.stored], before);
    }
    const f = fixture();
    await assert.rejects(f.prepare({}), /PROFILE_UTILITIES_UNCHANGED/);
    await assert.rejects(f.prepare({updates: [{id: 'utility-free', fields: {type: 'Fibra'}}]}), /PROFILE_UTILITIES_UNCHANGED/);
    await assert.rejects(f.prepare({updates: [{id: 'utility-free', fields: {id: 'x'}}]}), /PROFILE_UTILITIES_INVALID/);
    f.state.locked = true;
    await assert.rejects(f.prepare({updates: [{id: 'utility-free', fields: {type: 'Altro'}}]}));
    f.abort.abort();
    await assert.rejects(f.prepare({updates: [{id: 'utility-free', fields: {type: 'Altro'}}]}), /VIEW_DISPOSED/);
    assert.equal(privateUtilitiesRevision({_profileUtilitiesSchemaVersion: 1}), 0);
    assert.throws(() => privateUtilitiesRevision({isArchived: true}), /PROFILE_UTILITIES_SHAPE_INVALID/);
});
