import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {privateAddressBasis, privateAddressesRevision, validatePrivateAddressesRequest} from './private-addresses-contract.mjs';
import {preparePrivateAddresses} from './prepare-private-addresses.mjs';
import {createPrivateAddressesHandler} from './private-addresses-handler.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
// The real private schema: address fields in clear, only the nested utility value
// encrypted, Account references inside the utilities, a legacy id derived from the
// row content and its position, one primary address and a freely deletable one.
const records = () => ({
    ownerId: 'owner', nome: 'Nome fittizio', _profileAddressesRevision: 1,
    userAddresses: [
        {id: 'address-home', type: 'Residenza', address: 'Via fittizia 1', civic: '1', cap: '00100', city: 'Roma',
            province: 'RM', isPrimary: true, campoIgnoto: 'da conservare',
            utilities: [{id: 'utility-gas', type: 'Contatore Metano', value: cipher('POD-FITTIZIO')}]},
        {id: 'address-office', type: 'Ufficio', address: 'Via ufficio 2', civic: '2', cap: '20100', city: 'Milano',
            province: 'MI', isPrimary: false, utilities: [{id: 'utility-light', type: 'Codice POD', value: cipher('POD-2'),
                linkedAccountId: 'account', linkedAccountCompanyId: 'company'}]},
        {id: 'address-free', type: 'Altro', address: 'Via libera 5', isPrimary: false, campoIgnotoDue: 7},
        {id: 'address-legacy-1a2b', type: 'Altro', address: 'Via legacy 3', isPrimary: false},
        {type: 'Domicilio', address: 'Via senza id 4', isPrimary: false}
    ]
});
const snapshots = record => {
    const map = new Map();
    const keys = ['type', 'address', 'civic', 'cap', 'city', 'province', 'isPrimary'];
    for (const item of record.userAddresses ?? []) {
        if (typeof item.id !== 'string') continue;
        const fields = {};
        for (const key of keys) if (Object.hasOwn(item, key)) fields[key] = item[key];
        map.set(item.id, {fields});
    }
    return map;
};
function fixture(record = records()) {
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
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}};
    return {path, selectionPath, stored, context, abort, state,
        trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        handler: createPrivateAddressesHandler({db, hash, timestamp: () => 123}),
        prepare: draft => preparePrivateAddresses({context, getUser: () => ({uid: state.uid}),
            record: structuredClone(stored.get(path)), snapshot: snapshots(stored.get(path)), draft, operationId: 'operation', hash})};
}
test('private addresses are created, updated and deleted through one frozen request', async () => {
    const f = fixture(), before = structuredClone(f.stored.get(f.path));
    const request = await f.prepare({
        creates: [{id: 'address-new', fields: {type: 'Ufficio', address: 'Via nuova 9', civic: '9', cap: '10100',
            city: 'Torino', province: 'TO', isPrimary: true}}],
        updates: [{id: 'address-home', fields: {address: 'Via fittizia 1 bis'}}],
        deletes: [{id: 'address-free'}]});
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.operations));
    assert.deepEqual(request.operations.map(operation => operation.kind), ['create', 'update', 'delete']);
    assert.equal(request.operations[1].basis, hash(privateAddressBasis(before.userAddresses[0])));
    assert.deepEqual(f.stored.get(f.path), before, 'preparation never writes');
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const saved = f.stored.get(f.path);
    assert.equal(saved.userAddresses.length, 5, 'one created, one deleted');
    assert.equal(saved.userAddresses[0].address, 'Via fittizia 1 bis');
    assert.equal(saved.userAddresses[0].isPrimary, false, 'the new primary address clears the previous one');
    assert.deepEqual(saved.userAddresses[0].utilities, before.userAddresses[0].utilities, 'nested utilities survive');
    assert.equal(saved.userAddresses[0].campoIgnoto, 'da conservare');
    assert.equal(saved.nome, 'Nome fittizio', 'unrelated profile fields survive');
    const created = saved.userAddresses.find(item => item.id === 'address-new');
    assert.equal(created.isPrimary, true);
    assert.deepEqual(created.utilities, [], 'a new address starts without utilities');
    assert.equal(saved.userAddresses.some(item => item.id === 'address-free'), false);
    assert.equal(saved._profileAddressesRevision, 2);
    assert.equal(saved._profileAddressesSchemaVersion, 1);
    assert.equal(saved._profileAddressesUpdatedAt, 123);
    assert.ok(f.stored.has('mutationResults/owner/operations/profile-addresses-operation'));
});
test('an address with utilities, an Account link or a derived identity is never deleted', async () => {
    const f = fixture();
    for (const id of ['address-home', 'address-office', 'address-legacy-1a2b', 'address-missing-id']) {
        await assert.rejects(f.prepare({deletes: [{id}]}));
    }
    assert.equal(f.stored.get(f.path)._profileAddressesRevision, 1);
    assert.equal(f.stored.has('mutationResults/owner/operations/profile-addresses-operation'), false);
    // A row whose identity was derived from its content and position is refused by
    // the validator too, so it can never be targeted even by a hand-made request.
    const derived = {target: {domain: 'private'}, expectedRevision: 1, operationId: 'operation',
        operations: [{kind: 'delete', id: 'address-legacy-1a2b', basis: hash(privateAddressBasis(records().userAddresses[3]))}]};
    assert.throws(() => validatePrivateAddressesRequest(derived), /PROFILE_ADDRESSES_INVALID/);
    // A plain edit of a linked address is allowed and preserves the utilities.
    const request = await f.prepare({updates: [{id: 'address-office', fields: {city: 'Monza'}}]});
    assert.deepEqual(request.operations[0].fields, {city: 'Monza'});
    await f.handler(request, f.trusted);
    const office = f.stored.get(f.path).userAddresses[1];
    assert.equal(office.city, 'Monza');
    assert.deepEqual(office.utilities, records().userAddresses[1].utilities, 'utilities are byte for byte intact');
});
test('revision, fingerprint, missing and duplicated rows are refused without a receipt', async () => {
    const update = {updates: [{id: 'address-home', fields: {city: 'Napoli'}}]};
    const f = fixture(), request = await f.prepare(update);
    f.stored.get(f.path)._profileAddressesRevision = 4;
    await assert.rejects(f.handler(request, f.trusted), /REVISION_CONFLICT/);
    const g = fixture(), stale = await g.prepare(update);
    g.stored.get(g.path).userAddresses[0].utilities[0].value = cipher('CAMBIATA');
    await assert.rejects(g.handler(stale, g.trusted), /ADDRESSES_CONFLICT/,
        'a concurrent change to a nested utility is detected by the row fingerprint');
    assert.equal(g.stored.has('mutationResults/owner/operations/profile-addresses-operation'), false);
    const h = fixture(), gone = await h.prepare(update);
    h.stored.get(h.path).userAddresses = h.stored.get(h.path).userAddresses.filter(item => item.id !== 'address-home');
    await assert.rejects(h.handler(gone, h.trusted), /ADDRESSES_MISSING/);
    const i = fixture(), ambiguous = await i.prepare(update);
    i.stored.get(i.path).userAddresses.push({id: 'address-home', address: 'Doppione'});
    await assert.rejects(i.handler(ambiguous, i.trusted), /ADDRESSES_AMBIGUOUS/);
    const l = fixture(), created = await l.prepare({creates: [{id: 'address-new', fields: {address: 'Via nuova'}}]});
    l.stored.get(l.path).userAddresses.push({id: 'address-new', address: 'Via nuova'});
    await assert.rejects(l.handler(created, l.trusted), /ADDRESSES_EXISTS/);
    assert.equal(l.stored.has('mutationResults/owner/operations/profile-addresses-operation'), false);
});
test('the same operation retries idempotently and cannot be reused for another request', async () => {
    const f = fixture(), request = await f.prepare({deletes: [{id: 'address-free'}]});
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const after = structuredClone([...f.stored]);
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual([...f.stored], after);
    const reused = {...request, operations: [{...request.operations[0], id: 'address-office',
        basis: hash(privateAddressBasis(records().userAddresses[1]))}]};
    await assert.rejects(f.handler(reused, f.trusted), /OPERATION_CONFLICT/);
    assert.deepEqual([...f.stored], after);
});
test('concurrent requests against the same revision cannot both commit', async () => {
    const f = fixture();
    const first = await f.prepare({updates: [{id: 'address-home', fields: {city: 'Uno'}}]});
    const second = await f.prepare({updates: [{id: 'address-home', fields: {city: 'Due'}}]});
    const results = await Promise.allSettled([f.handler({...first, operationId: 'a'}, f.trusted),
        f.handler({...second, operationId: 'b'}, f.trusted)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(f.stored.get(f.path)._profileAddressesRevision, 2);
});
test('the QR selection decides the deletion: selected, unverifiable and absent', async () => {
    const selected = fixture();
    selected.stored.set(selected.selectionPath, {nome: true, emails: [], phones: [], addresses: ['address-free']});
    const request = await selected.prepare({deletes: [{id: 'address-free'}]});
    await assert.rejects(selected.handler(request, selected.trusted), /PROFILE_ADDRESS_QR_SELECTED/);
    assert.equal(selected.stored.get(selected.path).userAddresses.length, 5);
    for (const selection of [{addresses: 'address-free'}, {addresses: ['address-missing']}, {addresses: ['address-free', 'address-free']},
        {addresses: [9]}, {addresses: [], emails: [], phones: [], addresses_extra: 1}, 'non-un-oggetto']) {
        const f = fixture();
        f.stored.set(f.selectionPath, selection);
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(await f.prepare({deletes: [{id: 'address-free'}]}), f.trusted), /ADDRESSES_QR_UNVERIFIABLE/,
            JSON.stringify(selection));
        assert.deepEqual([...f.stored], before);
        assert.equal(f.stored.has('mutationResults/owner/operations/profile-addresses-operation'), false);
    }
    const absent = fixture();
    assert.deepEqual(await absent.handler(await absent.prepare({deletes: [{id: 'address-free'}]}), absent.trusted),
        {status: 'confirmed', revision: 2});
    assert.equal(absent.stored.has(absent.selectionPath), false, 'a deletion never recreates the selection');
    const unselected = fixture();
    unselected.stored.set(unselected.selectionPath, {nome: true, emails: [], phones: [], addresses: []});
    assert.deepEqual(await unselected.handler(await unselected.prepare({deletes: [{id: 'address-free'}]}), unselected.trusted),
        {status: 'confirmed', revision: 2});
    assert.deepEqual(unselected.stored.get(unselected.selectionPath), {nome: true, emails: [], phones: [], addresses: []},
        'a confirmed deletion never rewrites the selection');
});
test('the request allowlist keeps the private slice separate and rejects foreign shapes', async () => {
    const f = fixture(), request = await f.prepare({updates: [{id: 'address-home', fields: {cap: '00101'}}]});
    assert.deepEqual(validatePrivateAddressesRequest(request), request);
    for (const patch of [{target: {domain: 'company', companyId: 'company'}}, {target: {domain: 'private', companyId: 'x'}},
        {expectedRevision: -1}, {operationId: 'x/y'}, {operations: []},
        {operations: [{kind: 'delete', id: 'address-home'}]},
        {operations: [{kind: 'update', id: 'address-home', basis: 'short', fields: {cap: '1'}}]},
        {operations: [{kind: 'create', id: 'address-legacy-1a2b', fields: {address: 'x'}}]},
        {operations: [{kind: 'update', id: 'address-home', basis: 'a'.repeat(64), fields: {utilities: []}}]},
        {operations: [{kind: 'update', id: 'address-home', basis: 'a'.repeat(64), fields: {isPrimary: 'si'}}]},
        {operations: [{kind: 'update', id: 'address-home', basis: 'a'.repeat(64), fields: {cap: 'x'.repeat(11)}}]}]) {
        assert.throws(() => validatePrivateAddressesRequest({...request, ...patch}), /PROFILE_ADDRESSES_INVALID/);
    }
    assert.equal(privateAddressesRevision({_profileAddressesSchemaVersion: 1}), 0);
    assert.throws(() => privateAddressesRevision({isArchived: true}), /PROFILE_ADDRESSES_SHAPE_INVALID/);
    assert.throws(() => privateAddressesRevision({_profileAddressesSchemaVersion: 2}), /PROFILE_ADDRESSES_SHAPE_INVALID/);
});
test('untrusted context, archived profiles and revoked views never write', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'address-home', fields: {city: 'Napoli'}}]});
        await assert.rejects(f.handler(request, trusted));
        assert.equal(f.stored.get(f.path)._profileAddressesRevision, 1);
    }
    for (const mutate of [record => {record.ownerId = 'other';}, record => {record.isArchived = true;},
        record => {record._profileAddressesSchemaVersion = 2;}, record => {record.userAddresses = 'non-una-lista';},
        record => {record.userAddresses = [{id: 'address-x', utilities: 'non-una-lista'}];}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'address-home', fields: {city: 'Napoli'}}]});
        mutate(f.stored.get(f.path));
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(request, f.trusted));
        assert.deepEqual([...f.stored], before);
    }
    const f = fixture();
    await assert.rejects(f.prepare({}), /PROFILE_ADDRESSES_UNCHANGED/);
    await assert.rejects(f.prepare({updates: [{id: 'address-home', fields: {city: 'Roma'}}]}), /PROFILE_ADDRESSES_UNCHANGED/);
    f.state.locked = true;
    await assert.rejects(f.prepare({updates: [{id: 'address-home', fields: {city: 'Napoli'}}]}));
    f.abort.abort();
    await assert.rejects(f.prepare({updates: [{id: 'address-home', fields: {city: 'Napoli'}}]}), /VIEW_DISPOSED/);
});
