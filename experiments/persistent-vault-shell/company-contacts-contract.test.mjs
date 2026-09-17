import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_CONTACT_REFUSALS, companyContactId, companyContactRemovable, companyContactsView,
    emptyCompanyContactSlot} from './company-contacts-contract.mjs';

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
