import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {companyContactBasis, companyContactCipher, companyContactsRevision, companyContactsView,
    validateCompanyContactsRequest} from './company-contacts-contract.mjs';
import {prepareCompanyContacts} from './prepare-company-contacts.mjs';
import {createCompanyContactsHandler} from './company-contacts-handler.mjs';
import {createCompanyContactsEditorSource} from './company-contacts-editor-source.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
const isCipher = value => typeof value === 'string' && value !== '' && value.length >= 60 && value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value);
const COMPANY = 'users/owner/aziende/company';
// The real company schema: fixed e-mail slots (one with a legacy password, one
// linked to an Account), a repeatable list with and without a stable id, plain
// telephone strings, a link map, a card selection, unknown fields, a legacy
// top-level password and the legacy `aziendaEmail` fallback.
const records = () => ({
    ownerId: 'owner',
    id: 'company',
    ragioneSociale: 'Azienda fittizia',
    aziendaEmail: 'legacy@example.invalid',
    aziendaEmailPassword: cipher('legacy'),
    emails: {
        pec: {email: 'pec@example.invalid', tipo: 'PEC', password: cipher('pec-pass'), note: 'nota pec',
            linkedAccountId: 'account-pec', linkedAccountCompanyId: 'company'},
        amministrazione: {email: 'amm@example.invalid', tipo: 'Amministrazione', campoIgnoto: {a: 1}},
        personale: {tipo: '', password: cipher('segreta')},
        extra: [
            {id: 'company-email-1', email: 'extra1@example.invalid', tipo: 'Ufficio', password: cipher('extra-pass'), qr: false},
            {id: 'company-email-2', email: 'extra2@example.invalid', tipo: 'Magazzino', qr: true},
            {id: 'company-email-3', email: 'extra3@example.invalid', tipo: 'Logistica', qr: false},
            {email: 'senza-id@example.invalid', tipo: 'Senza identità'}
        ],
        altro: 'da conservare'
    },
    telefonoAzienda: '0110000000',
    faxAzienda: '0110000001',
    referenteCellulare: '3330000000',
    phoneAccountLinks: {referenteCellulare: {linkedAccountId: 'account-ref'}},
    qrConfig: {aziendaEmail: true, adminEmail: true, persEmail: false, telefonoAzienda: false,
        referenteCellulare: true, qrLegale: true, _qrRevision: 1, _qrSchemaVersion: 1},
    note: cipher('nota azienda'),
    _companyContactsRevision: 1,
    campoIgnotoTop: 'da conservare'
});
// The editor snapshot as the real source builds it: the displayed value plus the
// form already stored for that field.
const snapshots = record => {
    const snapshot = new Map();
    const add = (key, item, keys) => {
        const fields = {}, forms = {};
        for (const field of keys) {
            const raw = item?.[field];
            const encrypted = isCipher(raw);
            forms[field] = field === 'qr' ? 'boolean' : (encrypted ? 'cipher' : 'plain');
            fields[field] = field === 'qr' ? raw === true : (encrypted ? `plain:${raw.slice(0, 8)}` : (raw ?? ''));
        }
        snapshot.set(key, {fields, forms});
    };
    for (const slot of ['pec', 'amministrazione', 'personale']) add(`email-slot:${slot}`, record.emails?.[slot],
        ['tipo', 'email', 'note', 'password']);
    for (const item of record.emails?.extra ?? []) {
        if (typeof item.id === 'string') add(`email-extra:${item.id}`, item, ['tipo', 'email', 'note', 'password', 'qr']);
    }
    return snapshot;
};
function fixture(record = records(), {companyId = 'company'} = {}) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false, encrypted: [], reads: 0};
    const path = `users/owner/aziende/${companyId}`, stored = new Map([[path, structuredClone(record)]]);
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
    const source = {domain: 'company', companyId, async read(requested, confirmed) {
        state.reads += 1;
        assert.equal(requested, 'owner');
        if (!stored.has(path)) throw Error('COMPANY_UNAVAILABLE');
        return structuredClone(stored.get(path));
    }};
    return {path, stored, context, abort, state, source, trusted: {auth: {uid: 'owner'}, app: {appId: 'synthetic'}},
        handler: createCompanyContactsHandler({db, hash, timestamp: () => 123}),
        prepare: draft => prepareCompanyContacts({context, getUser: () => ({uid: state.uid}), source,
            record: structuredClone(stored.get(path)), snapshot: snapshots(stored.get(path)), draft, operationId: 'operation', hash}),
        editor: () => createCompanyContactsEditorSource({context, getUser: () => ({uid: state.uid}), source,
            isEncryptedValue: isCipher, hash, createId: prefix => `${prefix}-9`,
            isOnline: () => state.uid === 'owner' && !state.offline})};
}
test('company slots, telephones and repeatable rows are written by one frozen request', async () => {
    const f = fixture(), before = structuredClone(f.stored.get(f.path));
    const request = await f.prepare({
        slots: [{kind: 'email-slot', id: 'amministrazione', fields: {email: 'nuova@example.invalid', password: 'nuova segreta'}},
            {kind: 'phone-slot', id: 'telefonoAzienda', value: '0111111111'}],
        creates: [{id: 'company-email-9', fields: {tipo: 'Nuova', email: 'n@example.invalid', password: 'segreta', qr: true}}],
        updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}],
        deletes: [{id: 'company-email-3'}]});
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.operations));
    assert.deepEqual(request.operations.map(operation => operation.kind),
        ['email-slot', 'phone-slot', 'email-extra-create', 'email-extra-update', 'email-extra-delete']);
    assert.equal(request.operations[0].fields.password, cipher('nuova segreta'));
    assert.equal(request.operations[2].fields.password, cipher('segreta'));
    assert.equal(request.operations[4].basis, hash(companyContactBasis(before.emails.extra[2])));
    assert.deepEqual(f.state.encrypted, ['nuova segreta', 'segreta'], 'only the cipher fields are encrypted');
    assert.deepEqual(f.stored.get(f.path), before, 'preparation never writes');
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const saved = f.stored.get(f.path);
    assert.equal(saved.emails.amministrazione.email, 'nuova@example.invalid');
    assert.equal(saved.emails.amministrazione.tipo, 'Amministrazione');
    assert.deepEqual(saved.emails.amministrazione.campoIgnoto, {a: 1});
    assert.equal(saved.emails.amministrazione.password, cipher('nuova segreta'));
    assert.equal(saved.telefonoAzienda, '0111111111');
    assert.equal(saved.emails.extra.length, 4, 'one row created, one deleted');
    assert.equal(saved.emails.extra[0].tipo, 'Ufficio nuovo');
    assert.equal(saved.emails.extra[0].email, 'extra1@example.invalid', 'untouched fields of the row survive');
    assert.equal(saved.emails.extra[1].id, 'company-email-2');
    assert.equal(saved.emails.extra[3].id, 'company-email-9');
    assert.equal(saved.emails.extra[3].qr, true);
    assert.equal(saved.emails.extra[3].tipo, 'Nuova');
    assert.equal(saved.emails.altro, 'da conservare', 'the unknown key inside emails survives');
    assert.equal(saved.campoIgnotoTop, 'da conservare');
    assert.equal(saved.aziendaEmail, 'legacy@example.invalid', 'the legacy fallback is never rewritten');
    assert.equal(saved.aziendaEmailPassword, before.aziendaEmailPassword);
    assert.equal(saved.note, before.note);
    assert.deepEqual(saved.qrConfig, before.qrConfig, 'the card selection is never touched');
    assert.equal(saved._companyContactsRevision, 2);
    assert.equal(saved._companyContactsSchemaVersion, 1);
    assert.equal(saved._companyContactsUpdatedAt, 123);
    const allowed = new Set([...Object.keys(before), '_companyContactsSchemaVersion', '_companyContactsUpdatedAt']);
    assert.ok(Object.keys(saved).every(key => allowed.has(key)), 'no unrelated field is added');
});
test('a fixed slot is emptied, never deleted, and keeps every field it carried', async () => {
    const f = fixture();
    // `personale` carries no address yet, so only its stored password changes; the
    // address slot is emptied on a company whose card does not publish it.
    f.stored.get(f.path).qrConfig = {};
    const request = await f.prepare({slots: [{kind: 'email-slot', id: 'personale', fields: {email: '', password: ''}},
        {kind: 'email-slot', id: 'amministrazione', fields: {email: ''}},
        {kind: 'phone-slot', id: 'telefonoAzienda', value: ''}]});
    assert.deepEqual(f.state.encrypted, [], 'an explicit clear is not re-encrypted');
    assert.deepEqual(request.operations.map(operation => operation.kind), ['email-slot', 'email-slot', 'phone-slot']);
    await f.handler(request, f.trusted);
    const saved = f.stored.get(f.path);
    assert.equal(saved.emails.personale.password, '', 'an explicit clear writes an empty value');
    assert.equal(Object.hasOwn(saved.emails, 'personale'), true, 'the slot itself is not removed');
    assert.equal(saved.emails.amministrazione.email, '', 'the slot is emptied');
    assert.equal(saved.emails.amministrazione.tipo, 'Amministrazione', 'the label survives');
    assert.deepEqual(saved.emails.amministrazione.campoIgnoto, {a: 1}, 'an unknown field survives');
    assert.equal(saved.telefonoAzienda, '', 'the telephone slot is emptied as a string');
    assert.equal(Object.keys(saved).some(key => /^\d+$/.test(key)), false, 'no positional key is invented');
    assert.equal(saved.faxAzienda, '0110000001', 'an unrelated slot is untouched');
    assert.equal(saved.referenteCellulare, '3330000000');
    assert.equal(saved.emails.pec.linkedAccountId, 'account-pec');
    assert.equal(saved.emails.pec.email, 'pec@example.invalid');
    // Emptying a slot whose value is already absent is a no-op, not a rewrite.
    await assert.rejects(f.prepare({slots: [{kind: 'email-slot', id: 'personale', fields: {email: ''}}]}),
        /COMPANY_CONTACTS_UNCHANGED/);
});
test('a legacy ciphertext keeps its stored form and the label the schema already carries wins', async () => {
    const f = fixture();
    const request = await f.prepare({slots: [{kind: 'email-slot', id: 'pec', fields: {tipo: 'Email principale'}}]});
    assert.deepEqual(request.operations[0].fields, {tipo: 'Email principale'});
    assert.deepEqual(f.state.encrypted, [], 'an unchanged cipher field is not re-encrypted');
    await f.handler(request, f.trusted);
    const saved = f.stored.get(f.path);
    assert.equal(saved.emails.pec.tipo, 'Email principale');
    assert.equal(saved.emails.pec.password, cipher('pec-pass'), 'the legacy password survives untouched');
    assert.equal(saved.emails.pec.note, 'nota pec');
});
test('an extra row without a stable id is consulted but never edited, deleted or invented', async () => {
    const f = fixture();
    const editor = f.editor();
    const model = await editor.load();
    const rows = model.rows.filter(row => row.kind === 'email-extra');
    assert.equal(rows[0].editable, true); assert.equal(rows[0].removable, true);
    assert.equal(rows[1].removable, false, 'a row published on the digital card cannot be deleted');
    assert.equal(rows[1].deleteRefusal, 'COMPANY_CONTACTS_QR_SELECTED');
    assert.equal(rows[2].removable, true);
    const orphan = rows[3];
    assert.equal(orphan.id, null); assert.equal(orphan.editable, false); assert.equal(orphan.removable, false);
    assert.equal(orphan.deleteRefusal, 'COMPANY_CONTACT_ID_MISSING');
    assert.equal(orphan.fields.find(field => field.key === 'tipo').value, 'Senza identità',
        'the row stays consultable');
    editor.dispose();
    // The index-derived identity the legacy interface synthesizes is refused as well.
    const g = fixture({...records(), emails: {...records().emails, extra: [{id: 'extra-2', qr: false}]}});
    await assert.rejects(g.prepare({deletes: [{id: 'extra-2'}]}), /COMPANY_CONTACT_ID_DERIVED/);
    await assert.rejects(g.prepare({updates: [{id: 'extra-2', fields: {tipo: 'x'}}]}), /COMPANY_CONTACTS_INVALID/);
    const h = fixture({...records(), emails: {...records().emails, extra: [{email: 'senza@example.invalid'}]}});
    await assert.rejects(h.prepare({deletes: [{id: 'senza'}]}), /COMPANY_CHANGED/);
});
test('a linked or published contact cannot be emptied and a legacy fallback cannot be hidden', async () => {
    const f = fixture();
    await assert.rejects(f.prepare({slots: [{kind: 'email-slot', id: 'pec', fields: {email: ''}}]}), /COMPANY_CONTACTS_LINKED/);
    await assert.rejects(f.prepare({slots: [{kind: 'phone-slot', id: 'referenteCellulare', value: ''}]}), /COMPANY_CONTACTS_LINKED/);
    const published = fixture();
    published.stored.get(published.path).phoneAccountLinks = {};
    delete published.stored.get(published.path).emails.pec.linkedAccountId;
    delete published.stored.get(published.path).emails.pec.linkedAccountCompanyId;
    await assert.rejects(published.prepare({slots: [{kind: 'email-slot', id: 'pec', fields: {email: ''}}]}),
        /COMPANY_CONTACTS_QR_SELECTED/, 'the card publishes the PEC slot');
    await assert.rejects(published.prepare({slots: [{kind: 'phone-slot', id: 'referenteCellulare', value: ''}]}),
        /COMPANY_CONTACTS_QR_SELECTED/, 'the card publishes the referent mobile number');
    // A plain edit is not an emptying and stays available.
    const edited = await published.prepare({slots: [{kind: 'email-slot', id: 'pec', fields: {email: 'altra@example.invalid'}}]});
    assert.deepEqual(edited.operations.map(operation => operation.kind), ['email-slot']);
    // The legacy fallback would simply reappear, so the service refuses that
    // emptying even when a client sends it directly: the visible value is not in
    // the slot, and hiding it would need a separate, explicit migration.
    const legacy = fixture({...records(), emails: {pec: {tipo: 'PEC'}, amministrazione: {}, personale: {}, extra: []}});
    legacy.stored.get(legacy.path).qrConfig = {aziendaEmail: false};
    const direct = {target: {domain: 'company', companyId: 'company'}, expectedRevision: 1, operationId: 'operation',
        operations: [{kind: 'email-slot', id: 'pec', fields: {email: ''},
            basis: hash(companyContactBasis(legacy.stored.get(legacy.path).emails.pec))}]};
    await assert.rejects(legacy.handler(direct, legacy.trusted), /COMPANY_CONTACTS_LEGACY_FALLBACK/);
    assert.equal(legacy.stored.has('mutationResults/owner/operations/company-contacts-operation'), false);
    // A repeatable row is deleted, not emptied.
    await assert.rejects(f.prepare({slots: [{kind: 'email-slot', id: 'company-email-1', fields: {email: ''}}]}),
        /COMPANY_CONTACTS_INVALID/);
});
test('an unverifiable card configuration blocks emptying and deletion but not consultation', async () => {
    for (const qrConfig of [{sconosciuto: true}, {aziendaEmail: 'si'}, 'non-un-oggetto', {_qrSchemaVersion: 2}]) {
        const f = fixture();
        f.stored.get(f.path).qrConfig = qrConfig;
        await assert.rejects(f.prepare({deletes: [{id: 'company-email-3'}]}), /COMPANY_CONTACTS_QR_UNVERIFIABLE/);
        await assert.rejects(f.prepare({slots: [{kind: 'email-slot', id: 'amministrazione', fields: {email: ''}}]}),
            /COMPANY_CONTACTS_QR_UNVERIFIABLE/);
        const request = await f.prepare({updates: [{id: 'company-email-3', fields: {tipo: 'Logistica nuova'}}]});
        assert.deepEqual(request.operations.map(operation => operation.kind), ['email-extra-update'],
            'a plain edit does not depend on the card selection');
        const model = await f.editor().load();
        assert.equal(model.qrState, 'unverified');
        assert.equal(model.rows.find(row => row.id === 'company-email-3').deleteRefusal, 'COMPANY_CONTACTS_QR_UNVERIFIABLE');
        assert.equal(model.rows.find(row => row.id === 'company-email-3').editable, true);
    }
    const ambiguous = fixture();
    ambiguous.stored.get(ambiguous.path).emails.extra[0].qr = 'si';
    await assert.rejects(ambiguous.prepare({deletes: [{id: 'company-email-3'}]}), /COMPANY_CONTACTS_QR_UNVERIFIABLE/,
        'an ambiguous per-row flag blocks every deletion, not only that row');
});
test('a linked or published row is refused by the service even if the editor asks', async () => {
    const f = fixture();
    const linked = await f.prepare({deletes: [{id: 'company-email-3'}]});
    f.stored.get(f.path).emails.extra[2].linkedAccountId = 'account';
    await assert.rejects(f.handler(linked, f.trusted), /COMPANY_CONTACTS_CONFLICT|COMPANY_CONTACTS_LINKED/);
    assert.equal(f.stored.has('mutationResults/owner/operations/company-contacts-operation'), false);
    const g = fixture();
    const published = await g.prepare({deletes: [{id: 'company-email-3'}]});
    g.stored.get(g.path).emails.extra[2].qr = true;
    await assert.rejects(g.handler(published, g.trusted), /COMPANY_CONTACTS_CONFLICT|COMPANY_CONTACTS_QR_SELECTED/);
    assert.equal(g.stored.has('mutationResults/owner/operations/company-contacts-operation'), false);
    const h = fixture();
    h.stored.get(h.path).qrConfig = {adminEmail: false};
    const emptied = await h.prepare({slots: [{kind: 'email-slot', id: 'amministrazione', fields: {email: ''}}]});
    h.stored.get(h.path).qrConfig = {adminEmail: true};
    await assert.rejects(h.handler(emptied, h.trusted), /COMPANY_CONTACTS_QR_SELECTED/,
        'the service re-evaluates the card selection on committed state');
    assert.equal(h.stored.has('mutationResults/owner/operations/company-contacts-operation'), false);
});
test('revision, fingerprint, missing and duplicated rows are refused without a receipt', async () => {
    const update = {updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}]};
    const f = fixture(), request = await f.prepare(update);
    f.stored.get(f.path)._companyContactsRevision = 4;
    await assert.rejects(f.handler(request, f.trusted), /REVISION_CONFLICT/);
    const g = fixture(), stale = await g.prepare(update);
    g.stored.get(g.path).emails.extra[0].email = 'cambiata@example.invalid';
    await assert.rejects(g.handler(stale, g.trusted), /COMPANY_CONTACTS_CONFLICT/);
    assert.equal(g.stored.has('mutationResults/owner/operations/company-contacts-operation'), false);
    const h = fixture(), gone = await h.prepare(update);
    h.stored.get(h.path).emails.extra = h.stored.get(h.path).emails.extra.filter(item => item.id !== 'company-email-1');
    await assert.rejects(h.handler(gone, h.trusted), /COMPANY_CONTACTS_MISSING/);
    const i = fixture(), ambiguous = await i.prepare(update);
    i.stored.get(i.path).emails.extra.push({id: 'company-email-1', email: 'doppia@example.invalid'});
    await assert.rejects(i.handler(ambiguous, i.trusted), /COMPANY_CONTACTS_AMBIGUOUS/);
    const l = fixture(), created = await l.prepare({creates: [{id: 'company-email-9', fields: {email: 'n@example.invalid'}}]});
    l.stored.get(l.path).emails.extra.push({id: 'company-email-9', email: 'n@example.invalid'});
    await assert.rejects(l.handler(created, l.trusted), /COMPANY_CONTACTS_EXISTS/);
    const m = fixture(), phone = await m.prepare({slots: [{kind: 'phone-slot', id: 'faxAzienda', value: '0119999999'}]});
    m.stored.get(m.path).faxAzienda = 'cambiato nel frattempo';
    await assert.rejects(m.handler(phone, m.trusted), /COMPANY_CONTACTS_CONFLICT/);
    const n = fixture(), slot = await n.prepare({slots: [{kind: 'email-slot', id: 'personale', fields: {tipo: 'Personale'}}]});
    n.stored.get(n.path).emails.personale.password = cipher('cambiata');
    await assert.rejects(n.handler(slot, n.trusted), /COMPANY_CONTACTS_CONFLICT/,
        'a concurrent change to any field of the slot is detected');
});
test('the same operation retries idempotently and cannot be reused for another request', async () => {
    const f = fixture(), request = await f.prepare({deletes: [{id: 'company-email-3'}]});
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    const after = structuredClone([...f.stored]);
    assert.deepEqual(await f.handler(request, f.trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual([...f.stored], after);
    const reused = {...request, operations: [{...request.operations[0], id: 'company-email-1',
        basis: hash(companyContactBasis(records().emails.extra[0]))}]};
    await assert.rejects(f.handler(reused, f.trusted), /OPERATION_CONFLICT/);
    assert.deepEqual([...f.stored], after);
});
test('one failing operation leaves the whole document and the receipt untouched', async () => {
    const f = fixture();
    const request = await f.prepare({creates: [{id: 'company-email-9', fields: {email: 'n@example.invalid'}}],
        updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}]});
    f.stored.get(f.path).emails.extra[0].tipo = 'cambiato nel frattempo';
    const before = structuredClone([...f.stored]);
    await assert.rejects(f.handler(request, f.trusted), /COMPANY_CONTACTS_CONFLICT/);
    assert.deepEqual([...f.stored], before);
});
test('concurrent requests against the same revision cannot both commit', async () => {
    const f = fixture();
    const first = await f.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'Uno'}}]});
    const second = await f.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'Due'}}]});
    const results = await Promise.allSettled([f.handler({...first, operationId: 'a'}, f.trusted),
        f.handler({...second, operationId: 'b'}, f.trusted)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(f.stored.get(f.path)._companyContactsRevision, 2);
});
test('untrusted context, foreign or archived companies and a foreign shape never write', async () => {
    for (const trusted of [{}, {auth: {uid: 'owner'}}, {auth: {uid: '../owner'}, app: {appId: 'x'}}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}]});
        await assert.rejects(f.handler(request, trusted));
        assert.equal(f.stored.get(f.path)._companyContactsRevision, 1);
    }
    for (const mutate of [record => {record.ownerId = 'other';}, record => {record.isArchived = true;},
        record => {record.id = 'other';}, record => {record._companyContactsSchemaVersion = 2;},
        record => {record.emails = 'non-un-oggetto';}, record => {delete record.emails;},
        record => {record.telefonoAzienda = {number: 'oggetto'}; record.emails.extra[0].qr = 'si';}]) {
        const f = fixture(), request = await f.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}]});
        mutate(f.stored.get(f.path));
        const before = structuredClone([...f.stored]);
        await assert.rejects(f.handler(request, f.trusted));
        assert.deepEqual([...f.stored], before);
    }
    const f = fixture();
    await assert.rejects(f.prepare({}), /COMPANY_CONTACTS_UNCHANGED/);
    await assert.rejects(f.prepare({creates: [{id: 'extra-0', fields: {email: 'x'}}]}), /COMPANY_CONTACTS_INVALID/);
    await assert.rejects(f.prepare({deletes: [{id: 'senza-id'}]}), /COMPANY_CHANGED/);
    await assert.rejects(f.prepare({slots: [{kind: 'email-slot', id: 'mobile', fields: {email: 'x'}}]}), /COMPANY_CONTACTS_INVALID/);
});
test('the validated company request survives its own allowlist and rejects foreign patches', async () => {
    const f = fixture(), request = await f.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}]});
    assert.deepEqual(validateCompanyContactsRequest(request), request);
    for (const patch of [{target: {domain: 'private'}}, {target: {domain: 'company', companyId: '../x'}},
        {operationId: 'x/y'}, {expectedRevision: -1}, {operations: []}]) {
        assert.throws(() => validateCompanyContactsRequest({...request, ...patch}), /COMPANY_CONTACTS_INVALID/);
    }
});
test('the editor source decrypts only what is stored encrypted and never rewrites the fallback', async () => {
    const f = fixture(), editor = f.editor();
    const model = await editor.load();
    assert.equal(model.canSave, true);
    assert.equal(model.qrState, 'verified');
    assert.equal(model.revision, 1);
    const labels = model.rows.map(row => [row.kind, row.id, row.label]);
    assert.deepEqual(labels.slice(0, 3), [['email-slot', 'pec', 'PEC'], ['email-slot', 'amministrazione', 'Amministrazione'],
        ['email-slot', 'personale', 'Email personale']], 'the better company label wins when the schema has none');
    assert.deepEqual(labels.slice(-3), [['phone-slot', 'telefonoAzienda', 'Telefono azienda'],
        ['phone-slot', 'faxAzienda', 'Fax'], ['phone-slot', 'referenteCellulare', 'Cellulare referente']]);
    const pec = model.rows[0];
    assert.equal(pec.fields.find(field => field.key === 'email').value, 'pec@example.invalid');
    assert.equal(pec.fields.find(field => field.key === 'password').value, `plain:${cipher('pec-pass').slice(0, 8)}`,
        'the stored ciphertext is decrypted for display only');
    assert.equal(pec.emptyRefusal, 'COMPANY_CONTACTS_LINKED');
    assert.equal(pec.fields.find(field => field.key === 'email').type, 'text');
    const extra = model.rows.find(row => row.id === 'company-email-1');
    assert.equal(extra.fields.find(field => field.key === 'qr').type, 'boolean');
    assert.equal(extra.fields.find(field => field.key === 'qr').value, false);
    assert.equal(model.templates.emailExtra.find(field => field.key === 'qr').value, false);
    assert.equal(editor.createId(), 'company-email-9');
    const request = await editor.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'Ufficio nuovo'}}]}, 'operation');
    assert.equal(request.operations[0].fields.tipo, 'Ufficio nuovo');
    assert.equal(request.target.companyId, 'company');
    editor.dispose();
    await assert.rejects(editor.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'x'}}]}, 'operation'), /VIEW_DISPOSED/);
});
test('the editor refuses to save offline or after a concurrent change, and revokes during decryption', async () => {
    const offline = fixture();
    offline.state.offline = true;
    const editor = offline.editor();
    const model = await editor.load();
    assert.equal(model.canSave, false);
    await assert.rejects(editor.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'x'}}]}, 'operation'),
        /COMPANY_CONTACTS_SAVE_UNAVAILABLE/);
    editor.dispose();
    const changed = fixture(), other = changed.editor();
    await other.load();
    changed.stored.get(changed.path).emails.extra[0].tipo = 'cambiato';
    await assert.rejects(other.prepare({updates: [{id: 'company-email-1', fields: {tipo: 'x'}}]}, 'operation'), /COMPANY_CHANGED/);
    other.dispose();
    for (const boundary of ['uid', 'locked', 'abort']) {
        const f = fixture(), item = f.editor();
        let release;
        f.context.read = () => new Promise(resolve => {release = () => resolve('plain');});
        const pending = item.load();
        await new Promise(setImmediate);
        if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
        release();
        await assert.rejects(pending);
        item.dispose();
    }
});
test('the editor refuses a company source whose schema changed the case, and consultable rows stay visible', async () => {
    const f = fixture(), editor = f.editor();
    await editor.load();
    editor.dispose();
    const rows = companyContactsView(records());
    assert.equal(rows.filter(row => row.kind === 'email-extra').length, 4);
    assert.equal(rows.find(row => row.id === 'company-email-2').removable, true,
        'the read-only contract reports the row as removable; the editor adds the card protection');
});
