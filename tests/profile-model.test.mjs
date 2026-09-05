import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profile-model.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const qrSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/qr_code_utils-v2.js', import.meta.url), 'utf8');
const qr = await import(`data:text/javascript;base64,${Buffer.from(qrSource).toString('base64')}`);

test('normalizza i dati legacy con ID stabili senza mutare la sorgente', () => {
    const sourceProfile = { contactPhones: [{ number: '123' }], contactEmails: [{ address: 'a@example.test' }] };
    const first = model.normalizeLegacyProfile(sourceProfile);
    const second = model.normalizeLegacyProfile(sourceProfile);
    assert.equal(first.contactPhones[0].id, second.contactPhones[0].id);
    assert.equal(sourceProfile.contactPhones[0].id, undefined);
});

test('converte le selezioni QR legacy da indici a ID', () => {
    const profile = model.normalizeLegacyProfile({ contactPhones: [{ number: '123' }], contactEmails: [], userAddresses: [] });
    const migrated = model.migrateQrIndexesToIds({ phones: [0], emails: [], addresses: [] }, profile);
    assert.equal(migrated.phones[0], profile.contactPhones[0].id);
    assert.equal(migrated.schemaVersion, 2);
});

test('la panoramica sceglie i dati principali e le scadenze entro 90 giorni', () => {
    const profile = model.normalizeLegacyProfile({
        nome: 'Mario', cognome: 'Rossi',
        contactEmails: [{ address: 'a@example.test' }, { address: 'main@example.test', isPrimary: true }],
        documenti: [{ type: 'Patente', expiry_date: '2026-10-01' }, { type: 'Passaporto', expiry_date: '2027-10-01' }]
    });
    const overview = model.buildProfileOverview(profile, new Date('2026-09-05T00:00:00'));
    assert.equal(overview.primaryEmail.address, 'main@example.test');
    assert.equal(overview.expiringDocuments.length, 1);
});

test('vieta segreti e limita i campi dei widget', () => {
    assert.equal(model.isQrEligibleField({ type: 'password', includeInQr: true }), false);
    assert.equal(model.isQrEligibleField({ type: 'text', includeInQr: true }), true);
    const fields = Array.from({ length: 31 }, (_, id) => ({ id }));
    assert.deepEqual(model.validateProfileWidget({ title: 'Test', tab: 'personal', size: 'medium', fields }).errors, ['field-limit']);
    assert.deepEqual(model.validateProfileWidget({
        title: 'Test', tab: 'personal', size: 'medium', fields: [{ type: 'password', includeInQr: true }]
    }).errors, ['unsafe-qr-field']);
});

test('la vCard usa ID stabili, include cognome e CF dai documenti ed esclude segreti', () => {
    const profile = model.normalizeLegacyProfile({
        nome: 'Mario', cognome: 'Rossi',
        documenti: [{ type: 'Codice Fiscale', cf_value: 'RSSMRA' }],
        contactPhones: [{ number: '123' }]
    });
    const vcard = qr.buildVCard(profile, {
        nome: true, cf: true, nascita: false, phones: [profile.contactPhones[0].id], emails: [], addresses: []
    }, {
        contactPhones: profile.contactPhones,
        customFields: [
            { label: 'Qualifica', type: 'text', value: 'Tecnico', includeInQr: true },
            { label: 'PIN', type: 'sensitive', value: '1234', includeInQr: true, encrypted: true }
        ]
    });
    assert.match(vcard, /FN:Mario Rossi/);
    assert.match(vcard, /X-CF:RSSMRA/);
    assert.match(vcard, /TEL:123/);
    assert.match(vcard, /NOTE:Qualifica: Tecnico/);
    assert.doesNotMatch(vcard, /1234/);
});
