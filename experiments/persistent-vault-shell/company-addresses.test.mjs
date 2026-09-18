import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {companyAddressBasis, companyAddressesRevision, companySeatValue,
    validateCompanyAddressesRequest} from './company-addresses-contract.mjs';
import {prepareCompanyAddresses} from './prepare-company-addresses.mjs';
import {createCompanyAddressesHandler} from './company-addresses-handler.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const COMPANY = 'users/owner/aziende/company';
// The real company schema: the legal seat as top-level strings, repeatable
// `altreSedi` rows with and without a stable id, an index-derived id written by the
// legacy form, a row published on the digital card, and company fields that must
// survive untouched.
const records = () => ({
    ownerId: 'owner', id: 'company', ragioneSociale: 'Azienda fittizia', campoIgnoto: 'da conservare',
    tipoSedeLegale: 'Sede Legale', indirizzoSede: 'Via sede 1', civicoSede: '1', capSede: '00100', cittaSede: 'Roma',
    provinciaSede: 'RM',
    emails: {pec: {email: 'pec@example.invalid'}, extra: []},
    altreSedi: [
        {id: 'sede-filiale', tipo: 'Filiale', indirizzo: 'Via filiale 2', civico: '2', cap: '20100', citta: 'Milano',
            provincia: 'MI', qr: false, campoIgnotoRiga: 'da conservare'},
        {id: 'sede-deposito', tipo: 'Deposito', indirizzo: 'Via deposito 7', qr: false},
        {id: 'sede-2', tipo: 'Magazzino', indirizzo: 'Via indice 3', qr: false},
        {tipo: 'Senza identità', indirizzo: 'Via senza id 4'},
        {id: 'sede-pubblicata', tipo: 'Showroom', indirizzo: 'Via vetrina 5', qr: true}
    ],
    qrConfig: {qrLegale: true, aziendaEmail: true, adminEmail: false, persEmail: false, telefonoAzienda: false,
        referenteCellulare: true},
    _companyAddressesRevision: 1
});
const snapshots = record => {
    const map = new Map();
    const keys = ['tipo', 'indirizzo', 'civico', 'cap', 'citta', 'provincia', 'qr'];
    for (const item of record.altreSedi ?? []) {
        if (typeof item.id !== 'string') continue;
        const fields = {};
        for (const key of keys) if (Object.hasOwn(item, key)) fields[key] = item[key];
        map.set(item.id, {fields});
    }
    return map;
};
function fixture(record = records()) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false};
    const stored = new Map([[COMPANY, structuredClone(record)]]);
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
    const source = {domain: 'company', companyId: 'company', async read() {return structuredClone(stored.get(COMPANY));}};
    return {stored, context, abort, state, source,
        trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        handler: createCompanyAddressesHandler({db, hash, timestamp: () => 123}),
        prepare: draft => prepareCompanyAddresses({context, getUser: () => ({uid: state.uid}), source,
            record: structuredClone(stored.get(COMPANY)), snapshot: snapshots(stored.get(COMPANY)), draft,
            operationId: 'operation', hash})};
}
test('company addresses: seat, creation, update and deletion in one request', async () => {
    const f = fixture(), before = structuredClone(f.stored.get(COMPANY));
    const request = await f.prepare({
        seat: {fields: {tipoSedeLegale: 'Sede Legale', indirizzoSede: 'Via sede 1 bis', cittaSede: 'Roma',
            provinciaSede: 'RM', capSede: '00100', civicoSede: '1'}},
        creates: [{id: 'sede-nuova', fields: {tipo: 'Deposito', indirizzo: 'Via deposito 6', citta: 'Torino', qr: true}}],
        updates: [{id: 'sede-filiale', fields: {citta: 'Monza'}}],
        deletes: [{id: 'sede-deposito'}]});
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.operations));
    assert.deepEqual(request.operations.map(operation => operation.kind),
        ['seat', 'address-create', 'address-update', 'address-delete']);
    assert.equal(request.operations[0].basis, hash(companyAddressBasis(companySeatValue(before))));
    assert.deepEqual(f.stored.get(COMPANY), before, 'preparation never writes');
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const saved = f.stored.get(COMPANY);
    assert.equal(saved.indirizzoSede, 'Via sede 1 bis', 'only the changed seat field is rewritten');
    assert.equal(saved.civicoSede, '1');
    assert.equal(saved.tipoSedeLegale, 'Sede Legale');
    const created = saved.altreSedi.find(item => item.id === 'sede-nuova');
    assert.equal(created.indirizzo, 'Via deposito 6');
    assert.equal(created.qr, true);
    assert.equal(saved.altreSedi.find(item => item.id === 'sede-filiale').citta, 'Monza');
    assert.equal(saved.altreSedi.find(item => item.id === 'sede-filiale').campoIgnotoRiga, 'da conservare',
        'an unknown key of the edited row survives');
    assert.equal(saved.altreSedi.some(item => item.id === 'sede-deposito'), false, 'the persisted row was deleted');
    assert.equal(saved.ragioneSociale, before.ragioneSociale);
    assert.equal(saved.campoIgnoto, 'da conservare');
    assert.deepEqual(saved.emails, before.emails, 'the company contacts are untouched');
    assert.deepEqual(saved.qrConfig, before.qrConfig, 'the card selection is never rewritten');
    assert.equal(saved._companyAddressesRevision, 2);
    assert.equal(saved._companyAddressesSchemaVersion, 1);
    assert.equal(saved._companyAddressesUpdatedAt, 123);
    assert.ok(f.stored.has('mutationResults/owner/operations/company-addresses-operation'));
});
test('an index-derived, missing or published address is never deleted', async () => {
    const f = fixture();
    await assert.rejects(f.prepare({deletes: [{id: 'sede-2'}]}), /COMPANY_ADDRESS_ID_DERIVED/);
    await assert.rejects(f.prepare({deletes: [{id: 'sede-pubblicata'}]}), /COMPANY_ADDRESS_QR_SELECTED/);
    await assert.rejects(f.prepare({updates: [{id: 'sede-2', fields: {citta: 'X'}}]}), /COMPANY_CHANGED|COMPANY_ADDRESSES_INVALID/);
    await assert.rejects(f.prepare({updates: [{id: 'sede-mancante', fields: {citta: 'X'}}]}), /COMPANY_CHANGED/);
    assert.equal(f.stored.get(COMPANY)._companyAddressesRevision, 1);
    // Even a hand-made request cannot target a derived identity.
    assert.throws(() => validateCompanyAddressesRequest({target: {domain: 'company', companyId: 'company'},
        expectedRevision: 1, operationId: 'operation', operations: [{kind: 'address-delete', id: 'sede-2',
            basis: hash(companyAddressBasis(records().altreSedi[1]))}]}), /COMPANY_ADDRESSES_INVALID/);
    assert.throws(() => validateCompanyAddressesRequest({target: {domain: 'company', companyId: 'company'},
        expectedRevision: 1, operationId: 'operation', operations: [{kind: 'address-create', id: 'sede-3',
            fields: {indirizzo: 'x'}}]}), /COMPANY_ADDRESSES_INVALID/);
    // A plain edit of a published row stays available.
    const request = await f.prepare({updates: [{id: 'sede-pubblicata', fields: {citta: 'Bologna'}}]});
    await f.handler(request, f.trusted);
    assert.equal(f.stored.get(COMPANY).altreSedi.find(item => item.id === 'sede-pubblicata').citta, 'Bologna');
});
test('an unverifiable card configuration blocks deletion but not harmless editing', async () => {
    for (const qrConfig of [{qrLegale: 'si'}, {sconosciuto: true}, 'non-un-oggetto', {_qrSchemaVersion: 2}]) {
        const f = fixture();
        f.stored.get(COMPANY).qrConfig = qrConfig;
        await assert.rejects(f.prepare({deletes: [{id: 'sede-filiale'}]}), /COMPANY_ADDRESSES_QR_UNVERIFIABLE/);
        const request = await f.prepare({updates: [{id: 'sede-filiale', fields: {citta: 'Monza'}}]});
        assert.deepEqual(request.operations.map(operation => operation.kind), ['address-update']);
    }
    const ambiguous = fixture();
    ambiguous.stored.get(COMPANY).altreSedi[0].qr = 'si';
    await assert.rejects(ambiguous.prepare({deletes: [{id: 'sede-pubblicata'}]}), /COMPANY_ADDRESSES_QR_UNVERIFIABLE/,
        'an ambiguous per-row flag blocks every deletion, not only that row');
});
test('revision, fingerprint, missing and duplicated rows are refused without a receipt', async () => {
    const update = {updates: [{id: 'sede-filiale', fields: {citta: 'Monza'}}]};
    const f = fixture(), request = await f.prepare(update);
    f.stored.get(COMPANY)._companyAddressesRevision = 4;
    await assert.rejects(f.handler(request, f.trusted), /REVISION_CONFLICT/);
    const g = fixture(), stale = await g.prepare(update);
    g.stored.get(COMPANY).altreSedi[0].indirizzo = 'cambiato@example.invalid';
    await assert.rejects(g.handler(stale, g.trusted), /COMPANY_ADDRESSES_CONFLICT/);
    assert.equal(g.stored.has('mutationResults/owner/operations/company-addresses-operation'), false);
    const h = fixture(), gone = await h.prepare(update);
    h.stored.get(COMPANY).altreSedi = h.stored.get(COMPANY).altreSedi.filter(item => item.id !== 'sede-filiale');
    await assert.rejects(h.handler(gone, h.trusted), /COMPANY_ADDRESSES_MISSING/);
    const i = fixture(), ambiguous = await i.prepare(update);
    i.stored.get(COMPANY).altreSedi.push({id: 'sede-filiale', indirizzo: 'Doppione'});
    await assert.rejects(i.handler(ambiguous, i.trusted), /COMPANY_ADDRESSES_AMBIGUOUS/);
    const l = fixture(), created = await l.prepare({creates: [{id: 'sede-nuova', fields: {indirizzo: 'Via nuova'}}]});
    l.stored.get(COMPANY).altreSedi.push({id: 'sede-nuova', indirizzo: 'Via nuova'});
    await assert.rejects(l.handler(created, l.trusted), /COMPANY_ADDRESSES_EXISTS/);
    const m = fixture(), seat = await m.prepare({seat: {fields: {indirizzoSede: 'Via diversa'}}});
    m.stored.get(COMPANY).provinciaSede = 'MI';
    await assert.rejects(m.handler(seat, m.trusted), /COMPANY_ADDRESSES_CONFLICT/,
        'a concurrent change to any seat field is detected');
    assert.equal(m.stored.has('mutationResults/owner/operations/company-addresses-operation'), false);
});
test('the same operation retries idempotently and concurrent requests cannot both commit', async () => {
    const f = fixture(), request = await f.prepare({deletes: [{id: 'sede-filiale'}]});
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const after = structuredClone([...f.stored]);
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual([...f.stored], after);
    const reused = {...request, operations: [{...request.operations[0], id: 'sede-pubblicata',
        basis: hash(companyAddressBasis(records().altreSedi[2]))}]};
    await assert.rejects(f.handler(reused, f.trusted), /OPERATION_CONFLICT/);
    const g = fixture();
    const first = await g.prepare({seat: {fields: {indirizzoSede: 'Uno'}}});
    const second = await g.prepare({seat: {fields: {indirizzoSede: 'Due'}}});
    const results = await Promise.allSettled([g.handler({...first, operationId: 'a'}, g.trusted),
        g.handler({...second, operationId: 'b'}, g.trusted)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(g.stored.get(COMPANY)._companyAddressesRevision, 2);
});
test('untrusted context, foreign or archived companies and a foreign shape never write', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'sede-filiale', fields: {citta: 'Monza'}}]});
        await assert.rejects(f.handler(request, trusted));
        assert.equal(f.stored.get(COMPANY)._companyAddressesRevision, 1);
    }
    for (const mutate of [record => {record.ownerId = 'other';}, record => {record.isArchived = true;},
        record => {record._companyAddressesSchemaVersion = 2;}, record => {record.altreSedi = 'non-una-lista';},
        record => {record.indirizzoSede = 7;}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'sede-filiale', fields: {citta: 'Monza'}}]});
        mutate(f.stored.get(COMPANY));
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(request, f.trusted));
        assert.deepEqual([...f.stored], before);
    }
    const f = fixture();
    assert.throws(() => companyAddressesRevision({isArchived: true}), /COMPANY_ADDRESSES_SHAPE_INVALID/);
    assert.throws(() => companyAddressesRevision({_companyAddressesSchemaVersion: 2}), /COMPANY_ADDRESSES_SHAPE_INVALID/);
    await assert.rejects(f.prepare({}), /COMPANY_ADDRESSES_UNCHANGED/);
    await assert.rejects(f.prepare({seat: {fields: {indirizzoSede: 'Via sede 1'}}}), /COMPANY_ADDRESSES_UNCHANGED/);
    assert.throws(() => validateCompanyAddressesRequest({target: {domain: 'private'}, expectedRevision: 1,
        operationId: 'operation', operations: [{kind: 'seat', basis: 'a'.repeat(64), fields: {indirizzoSede: 'x'}}]}),
        /COMPANY_ADDRESSES_INVALID/);
});
