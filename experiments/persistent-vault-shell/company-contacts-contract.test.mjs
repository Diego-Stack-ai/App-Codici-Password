import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_CONTACT_MUTATION_REFUSALS, COMPANY_CONTACT_REFUSALS, companyContactBasis, companyContactEmptyRefusal,
    companyContactExtraDeleteRefusal, companyContactId, companyContactQrState, companyContactRemovable, companyContactsRevision,
    companyContactsView, emptyCompanyContactSlot, validateCompanyContactsRequest} from './company-contacts-contract.mjs';

// Fixture of the real company schema: fixed slots (one empty), repeatable extra
// rows (one with a stable id, one without), phones, an Account link, a QR flag,
// an unknown field and a legacy password that must survive untouched.
const fixture = () => ({
    ragioneSociale: 'Azienda fittizia',
    aziendaEmail: 'legacy@example.invalid',
    emails: {
        pec: {email: 'pec@example.invalid', tipo: 'PEC', linkedAccountId: 'account-pec', linkedAccountCompanyId: 'company'},
        amministrazione: {tipo: 'Amministrazione'},
        personale: {email: 'personale@example.invalid', tipo: '', passwordLegacy: 'SEGRETO-LEGACY', campoIgnoto: {a: 1}},
        extra: [
            {id: 'email-extra-1', email: 'extra1@example.invalid', tipo: 'Ufficio'},
            {email: 'extra2@example.invalid', tipo: 'Magazzino'},
            {id: 'extra-7', email: 'sintetica@example.invalid'}
        ]
    },
    telefonoAzienda: {label: 'Centralino', number: '0110000000'},
    faxAzienda: {label: 'Fax', number: ''},
    referenteCellulare: {label: 'Referente', number: '3330000000'},
    phoneAccountLinks: {referenteCellulare: {linkedAccountId: 'account-referente'}},
    qrConfig: {persEmail: true},
    campoIgnotoTop: 'da conservare'
});
test('the company view separates fixed slots from repeatable rows and keeps the legacy label', () => {
    const rows = companyContactsView(fixture());
    const emailSlots = rows.filter(row => row.kind === 'email-slot');
    assert.deepEqual(emailSlots.map(row => row.id), ['pec', 'amministrazione', 'personale']);
    assert.equal(emailSlots[0].label, 'PEC', 'the label the schema already carries wins');
    assert.equal(emailSlots[1].label, 'Amministrazione', 'the label the schema already carries wins');
    assert.equal(emailSlots[2].label, 'personale', 'an empty label falls back to the slot name');
    assert.equal(emailSlots.every(row => row.removable === false), true, 'a fixed slot is emptied, never removed');
    assert.equal(emailSlots[1].value, '', 'an empty slot stays visible and empty');
    const phones = rows.filter(row => row.kind === 'phone-slot');
    assert.deepEqual(phones.map(row => row.id), ['telefonoAzienda', 'faxAzienda', 'referenteCellulare']);
    assert.equal(phones.every(row => row.removable === false), true);
    assert.equal(phones[2].link.linkedAccountId, 'account-referente', 'the phone link comes from phoneAccountLinks');
});
test('the legacy fallback of the pec slot is shown but never rewritten', () => {
    const record = fixture();
    const rows = companyContactsView(record);
    const pec = rows.find(row => row.id === 'pec');
    assert.equal(pec.value, 'pec@example.invalid');
    const legacy = companyContactsView({emails: {pec: {tipo: 'PEC'}}, aziendaEmail: 'vecchia@example.invalid'});
    const legacyPec = legacy.find(row => row.id === 'pec');
    assert.equal(legacyPec.value, 'vecchia@example.invalid');
    assert.equal(legacyPec.legacyFallback, true);
    assert.equal(legacyPec.editable, true, 'the row stays editable through its own slot');
});
test('an extra row without a stable id is consulted but never edited or removed', () => {
    const rows = companyContactsView(fixture()).filter(row => row.kind === 'email-extra');
    const [stable, missing, derived] = rows;
    assert.equal(stable.id, 'email-extra-1');
    assert.equal(stable.editable, true);
    assert.equal(stable.removable, true);
    assert.equal(missing.id, null);
    assert.equal(missing.editable, false);
    assert.equal(missing.removable, false);
    assert.equal(missing.blocked, COMPANY_CONTACT_REFUSALS.ID_MISSING);
    assert.equal(missing.sourceIndex, 1, 'the position is reported, never used as identity');
    assert.equal(derived.id, null, 'an id derived from the index is not an identity');
    assert.equal(derived.blocked, COMPANY_CONTACT_REFUSALS.ID_DERIVED);
});
test('an Account link or a QR inclusion blocks the removal, not the consultation', () => {
    const rows = companyContactsView(fixture());
    const linked = rows.find(row => row.id === 'pec');
    assert.equal(companyContactRemovable(linked, {qrIncluded: false}), false, 'a fixed slot is never removable');
    const extra = {...rows.find(row => row.id === 'email-extra-1'), link: {linkedAccountId: 'account'}};
    assert.equal(companyContactRemovable(extra), false);
    assert.equal(companyContactRemovable(rows.find(row => row.id === 'email-extra-1'), {qrIncluded: true}), false);
    assert.equal(companyContactRemovable(rows.find(row => row.id === 'email-extra-1')), true);
});
test('emptying a fixed slot preserves every other field of the record', () => {
    const record = fixture();
    const emptied = emptyCompanyContactSlot(record, {kind: 'email-slot', id: 'personale'});
    assert.equal(emptied.emails.personale.email, '');
    assert.equal(emptied.emails.personale.passwordLegacy, 'SEGRETO-LEGACY', 'a legacy password survives emptying');
    assert.deepEqual(emptied.emails.personale.campoIgnoto, {a: 1});
    assert.equal(emptied.campoIgnotoTop, 'da conservare');
    assert.equal(emptied.emails.pec.linkedAccountId, 'account-pec');
    assert.equal(record.emails.personale.email, 'personale@example.invalid', 'the source record is never mutated');
    const phone = emptyCompanyContactSlot(record, {kind: 'phone-slot', id: 'referenteCellulare'});
    assert.equal(phone.referenteCellulare.number, '');
    assert.equal(phone.referenteCellulare.label, 'Referente');
    assert.equal(phone.phoneAccountLinks.referenteCellulare.linkedAccountId, 'account-referente');
    assert.throws(() => emptyCompanyContactSlot(record, {kind: 'email-extra', id: 'email-extra-1'}),
        /COMPANY_CONTACTS_SHAPE_INVALID/, 'a repeatable row is deleted, not emptied');
});
test('the company schema refuses a foreign shape instead of normalizing it', () => {
    for (const record of [null, [], {emails: 'pec@example.invalid'}, {emails: {pec: 'pec@example.invalid'}},
        {emails: {extra: {email: 'x'}}}, {allegati: ['solo-nome']}]) {
        assert.throws(() => companyContactsView(record), /COMPANY_CONTACTS_SHAPE_INVALID/);
    }
    assert.equal(companyContactId('email-extra-1'), 'email-extra-1');
    assert.equal(companyContactId('extra-2'), null);
    assert.equal(companyContactId('con:duepunti'), null);
    assert.equal(companyContactId(''), null);
});

// ─── A1b mutation contract ────────────────────────────────────────────────────
// Regressione dimostrata: lo schema aziendale reale memorizza i telefoni come
// stringhe (`ma_save.js`), quindi diffondere il valore avrebbe trasformato
// "0110000000" in {0:'0',1:'1',…} distruggendo il record.
const stringPhones = () => ({
    ragioneSociale: 'Azienda fittizia',
    emails: {pec: {email: 'pec@example.invalid', tipo: 'PEC'}},
    telefonoAzienda: '0110000000',
    faxAzienda: '0110000001',
    referenteCellulare: '3330000000',
    campoIgnotoTop: 'da conservare'
});
test('a telephone slot stored as a string is emptied as a string, not spread into an object', () => {
    const record = stringPhones();
    const emptied = emptyCompanyContactSlot(record, {kind: 'phone-slot', id: 'telefonoAzienda'});
    assert.equal(emptied.telefonoAzienda, '', 'the phone slot stays a string');
    assert.equal(Object.keys(emptied).some(key => /^\d+$/.test(key)), false, 'no positional key is invented');
    assert.equal(emptied.faxAzienda, '0110000001');
    assert.equal(emptied.referenteCellulare, '3330000000');
    assert.equal(emptied.emails.pec.email, 'pec@example.invalid');
    assert.equal(emptied.campoIgnotoTop, 'da conservare');
    assert.equal(record.telefonoAzienda, '0110000000', 'the source record is never mutated');
    const objectSlot = emptyCompanyContactSlot({referenteCellulare: {label: 'Referente', number: '333'}},
        {kind: 'phone-slot', id: 'referenteCellulare'});
    assert.deepEqual(objectSlot.referenteCellulare, {label: 'Referente', number: ''},
        'a legacy object-shaped slot keeps its label');
});
test('the company revision is separate from the private one and refuses a foreign schema', () => {
    assert.equal(companyContactsRevision({_companyContactsSchemaVersion: 1}), 0);
    assert.equal(companyContactsRevision({_companyContactsRevision: 4, _profileContactsRevision: 9}), 4);
    for (const record of [{_companyContactsSchemaVersion: 2}, {_companyContactsRevision: -1}, {isArchived: true}, null]) {
        assert.throws(() => companyContactsRevision(record), /COMPANY_CONTACTS_SHAPE_INVALID/);
    }
    const basis = companyContactBasis({a: 1, b: null, c: [1, 'x'], d: {z: true}});
    assert.equal(basis, companyContactBasis({d: {z: true}, c: [1, 'x'], b: null, a: 1}), 'key order is irrelevant');
    assert.throws(() => companyContactBasis(undefined), /COMPANY_CONTACTS_INVALID/);
});
test('the QR state reproduces the digital-card defaults and fails closed when it cannot be read', () => {
    const absent = companyContactQrState({emails: {}});
    assert.equal(absent.state, 'absent');
    assert.equal(absent.slots.pec, true, 'the card publishes the PEC unless it is switched off');
    assert.equal(absent.slots.referenteCellulare, true);
    assert.equal(absent.slots.amministrazione, false, 'new fields need an explicit opt-in');
    assert.equal(absent.slots.personale, false);
    assert.equal(absent.slots.telefonoAzienda, false);
    assert.equal(absent.slots.faxAzienda, false, 'the fax has no card flag');
    const configured = companyContactQrState({qrConfig: {aziendaEmail: false, persEmail: true, _qrRevision: 2, _qrSchemaVersion: 1}});
    assert.equal(configured.state, 'verified');
    assert.equal(configured.slots.pec, false);
    assert.equal(configured.slots.personale, true);
    assert.equal(configured.slots.referenteCellulare, true, 'a key missing from a saved configuration keeps the card default');
    const extras = companyContactQrState({emails: {extra: [{id: 'a'}, {id: 'b', qr: false}, {id: 'c', qr: true}]}});
    assert.deepEqual(extras.extras, [true, false, true], 'a row is published unless its flag is explicitly false');
    for (const record of [{qrConfig: 'not-an-object'}, {qrConfig: {sconosciuto: true}}, {qrConfig: {_qrSchemaVersion: 2}},
        {qrConfig: {telefonoAzienda: 'si'}}, {emails: {extra: [{qr: 'si'}]}}, null]) {
        assert.equal(companyContactQrState(record).state, 'unverified', JSON.stringify(record));
        assert.equal(companyContactQrState(record).slots, null);
    }
});
test('empty and delete guards refuse a linked, published or legacy row and nothing else', () => {
    const record = {emails: {pec: {tipo: 'PEC'}, personale: {email: 'p@example.invalid'},
        extra: [{id: 'company-email-1', email: 'a@example.invalid'}]},
        telefonoAzienda: '0110', referenteCellulare: '333', aziendaEmail: 'vecchia@example.invalid',
        phoneAccountLinks: {telefonoAzienda: {linkedAccountId: 'account'}}};
    assert.equal(companyContactEmptyRefusal(record, {kind: 'phone-slot', id: 'telefonoAzienda'}), 'COMPANY_CONTACTS_LINKED');
    assert.equal(companyContactEmptyRefusal(record, {kind: 'email-slot', id: 'personale', qrIncluded: true}),
        'COMPANY_CONTACTS_QR_SELECTED');
    assert.equal(companyContactEmptyRefusal(record, {kind: 'phone-slot', id: 'referenteCellulare', qrIncluded: true}),
        'COMPANY_CONTACTS_QR_SELECTED');
    assert.equal(companyContactEmptyRefusal(record, {kind: 'email-slot', id: 'pec'}), 'COMPANY_CONTACTS_LEGACY_FALLBACK',
        'the legacy aziendaEmail fallback would simply reappear');
    assert.equal(companyContactEmptyRefusal({...record, aziendaEmail: ''}, {kind: 'email-slot', id: 'pec'}), null);
    assert.equal(companyContactEmptyRefusal({emails: {pec: {email: 'x'}}, aziendaEmail: 'vecchia@example.invalid'},
        {kind: 'email-slot', id: 'pec'}), null, 'a stored slot value shadows the fallback');
    assert.equal(companyContactEmptyRefusal(record, {kind: 'email-extra', id: 'company-email-1'}),
        COMPANY_CONTACT_MUTATION_REFUSALS.INVALID, 'a repeatable row is deleted, not emptied');
    assert.equal(companyContactExtraDeleteRefusal(record.emails.extra[0], {qrIncluded: false}), null);
    assert.equal(companyContactExtraDeleteRefusal(record.emails.extra[0], {qrIncluded: true}), 'COMPANY_CONTACTS_QR_SELECTED');
    assert.equal(companyContactExtraDeleteRefusal({email: 'x'}, {qrIncluded: false}), COMPANY_CONTACT_REFUSALS.ID_MISSING);
    assert.equal(companyContactExtraDeleteRefusal({id: 'extra-3'}, {qrIncluded: false}), COMPANY_CONTACT_REFUSALS.ID_DERIVED);
    assert.equal(companyContactExtraDeleteRefusal({id: 'company-email-1', linkedAccountId: 'account'}, {qrIncluded: false}),
        'COMPANY_CONTACTS_LINKED');
    assert.equal(companyContactExtraDeleteRefusal({id: 'company-email-1', linkedAccountCompanyId: 'other'}, {qrIncluded: false}),
        'COMPANY_CONTACTS_LINKED', 'a company-only link still protects the row');
    assert.equal(companyContactExtraDeleteRefusal({id: 'extra-3', qr: false}, {qrIncluded: true}),
        COMPANY_CONTACT_REFUSALS.ID_DERIVED, 'identity is decided before the card selection');
});
test('the company request allowlist keeps the company schema apart from the private one', () => {
    const request = {target: {domain: 'company', companyId: 'company'}, expectedRevision: 1, operationId: 'operation',
        operations: [{kind: 'email-slot', id: 'pec', basis: 'a'.repeat(64), fields: {email: 'nuova@example.invalid'}},
            {kind: 'phone-slot', id: 'telefonoAzienda', basis: 'b'.repeat(64), value: '0110000000'},
            {kind: 'email-extra-create', id: 'company-email-1', fields: {email: 'x@example.invalid', qr: true}},
            {kind: 'email-extra-update', id: 'email-extra-9', basis: 'c'.repeat(64), fields: {tipo: 'Ufficio'}},
            {kind: 'email-extra-delete', id: 'email-extra-8', basis: 'd'.repeat(64)}]};
    const validated = validateCompanyContactsRequest(request);
    assert.ok(Object.isFrozen(validated) && Object.isFrozen(validated.operations));
    assert.deepEqual(validated.operations.map(operation => operation.kind),
        ['email-slot', 'phone-slot', 'email-extra-create', 'email-extra-update', 'email-extra-delete']);
    assert.deepEqual(validated.target, {domain: 'company', companyId: 'company'});
    const patch = change => ({...request, operations: [change]});
    for (const operations of [
        [{kind: 'create', collection: 'contactEmails', id: 'email-1', fields: {address: 'x'}}],
        [{kind: 'email-slot', id: 'mobile', basis: 'a'.repeat(64), fields: {email: 'x'}}],
        [{kind: 'email-slot', id: 'pec', basis: 'a'.repeat(64), fields: {address: 'x'}}],
        [{kind: 'email-slot', id: 'pec', basis: 'a'.repeat(64), fields: {nome: 'x'}}],
        [{kind: 'email-slot', id: 'pec', basis: 'short', fields: {email: 'x'}}],
        [{kind: 'email-slot', id: 'pec', fields: {email: 'x'}}],
        [{kind: 'phone-slot', id: 'faxAzienda', basis: 'a'.repeat(64), value: 'x'.repeat(121)}],
        [{kind: 'phone-slot', id: 'faxAzienda', basis: 'a'.repeat(64), fields: {number: 'x'}}],
        [{kind: 'email-extra-create', id: 'extra-0', fields: {email: 'x'}}],
        [{kind: 'email-extra-create', id: 'email-1', fields: {email: 'x'}}],
        [{kind: 'email-extra-create', id: 'company-email-1', fields: {qr: 'si'}}],
        [{kind: 'email-extra-create', id: 'company-email-1', fields: {}}],
        [{kind: 'email-extra-delete', id: 'extra-3', basis: 'a'.repeat(64)}],
        [{kind: 'email-extra-update', id: 'company-email-1', basis: 'a'.repeat(64), fields: {tipo: 'x'.repeat(121)}}],
        [{kind: 'email-extra-delete', id: 'company-email-1', basis: 'a'.repeat(64)},
            {kind: 'email-extra-update', id: 'company-email-1', basis: 'b'.repeat(64), fields: {tipo: 'x'}}],
        []
    ]) {
        assert.throws(() => validateCompanyContactsRequest(patch(operations)), /COMPANY_CONTACTS_INVALID/, JSON.stringify(operations));
    }
    for (const value of [{...request, target: {domain: 'private'}}, {...request, target: {domain: 'company', companyId: '../x'}},
        {...request, target: {domain: 'company', companyId: 'company', extra: 1}}, {...request, expectedRevision: -1},
        {...request, operationId: 'x/y'}, {...request, operations: 'x'}, {...request, extra: true}]) {
        assert.throws(() => validateCompanyContactsRequest(value), /COMPANY_CONTACTS_INVALID/);
    }
    const many = Array.from({length: 51}, (_, index) => ({kind: 'email-extra-delete', id: `email-${index}`, basis: 'a'.repeat(64)}));
    assert.throws(() => validateCompanyContactsRequest({...request, operations: many}), /COMPANY_CONTACTS_INVALID/);
});
