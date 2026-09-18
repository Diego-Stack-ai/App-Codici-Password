import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore';
import {withCompanyContactsCandidateRules} from './company-contacts-candidate-rules.mjs';
import {companyContactBasis} from './company-contacts-contract.mjs';
import {prepareCompanyContacts} from './prepare-company-contacts.mjs';
import {createCompanyContactsHandler} from './company-contacts-handler.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
const display = value => value.startsWith('cipher:') ? `plain:${value.slice(0, 8)}` : value;
const context = uid => ({user: {uid}, signal: new AbortController().signal, assertUnlocked() {},
    async encrypt(value) {return cipher(value);}, async read({ciphertext}) {return display(ciphertext);}});
const snapshots = record => {
    const map = new Map();
    const add = (key, item, keys) => {
        const fields = {}, forms = {};
        for (const field of keys) {
            const raw = item?.[field];
            forms[field] = field === 'qr' ? 'boolean' : (raw !== undefined && String(raw).startsWith('cipher:') ? 'cipher' : 'plain');
            fields[field] = field === 'qr' ? raw === true : display(raw ?? '');
        }
        map.set(key, {fields, forms});
    };
    for (const slot of ['pec', 'amministrazione', 'personale']) add(`email-slot:${slot}`, record.emails?.[slot], ['tipo', 'email', 'note', 'password']);
    for (const item of record.emails?.extra ?? []) {
        if (typeof item.id === 'string') add(`email-extra:${item.id}`, item, ['tipo', 'email', 'note', 'password', 'qr']);
    }
    return map;
};
async function environment(name) {
    const rules = withCompanyContactsCandidateRules(await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'));
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085, rules}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, name), db = getFirestore(app);
    return {env, app, db, dispose: async () => {await db.terminate(); await deleteApp(app); await env.cleanup();}};
}
test('company contacts candidate writes, guards and receipts on synthetic emulator records', async t => {
    const {env, db, dispose} = await environment('company-contacts-test');
    t.after(dispose);
    const uid = 'company-owner', path = `users/${uid}/aziende/company`;
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    const run = createCompanyContactsHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const scoped = context(uid);
    const prepare = async (draft, operationId) => {
        const record = (await db.doc(path).get()).data();
        return prepareCompanyContacts({context: scoped, getUser: () => ({uid}),
            source: {domain: 'company', companyId: 'company'}, record, snapshot: snapshots(record), draft, operationId, hash});
    };
    await db.doc(path).set({ownerId: uid, id: 'company', ragioneSociale: 'Azienda fittizia', unrelated: 'keep',
        aziendaEmail: 'legacy@example.invalid', aziendaEmailPassword: 'cipher:LEGACY',
        emails: {
            pec: {email: 'pec@example.invalid', tipo: 'PEC', password: 'cipher:PEC', linkedAccountId: 'synthetic'},
            amministrazione: {email: 'amm@example.invalid', tipo: 'Amministrazione'},
            personale: {tipo: '', campoIgnoto: {a: 1}},
            extra: [
                {id: 'company-email-free', email: 'free@example.invalid', tipo: 'Libera', password: 'cipher:FREE', qr: false},
                {id: 'company-email-selected', email: 'selected@example.invalid', tipo: 'Selezionata', qr: true},
                {email: 'senza-id@example.invalid', tipo: 'Senza identità'}],
            altro: 'da conservare'},
        telefonoAzienda: '0110000000', faxAzienda: '0110000001', referenteCellulare: '3330000000',
        phoneAccountLinks: {referenteCellulare: {linkedAccountId: 'synthetic'}},
        qrConfig: {aziendaEmail: true, adminEmail: true, persEmail: false, telefonoAzienda: false, referenteCellulare: true, qrLegale: true},
        _companyContactsRevision: 1});
    await assertSucceeds(getDoc(doc(owner, path))); await assertFails(getDoc(doc(other, path)));
    await assertFails(updateDoc(doc(owner, path), {emails: {}}));
    await assertFails(updateDoc(doc(owner, path), {telefonoAzienda: 'forged'}));
    await assertFails(updateDoc(doc(owner, path), {faxAzienda: 'forged'}));
    await assertFails(updateDoc(doc(owner, path), {referenteCellulare: 'forged'}));
    await assertFails(updateDoc(doc(owner, path), {phoneAccountLinks: {}}));
    await assertFails(updateDoc(doc(owner, path), {aziendaEmail: 'forged@example.invalid'}));
    await assertFails(updateDoc(doc(owner, path), {aziendaEmailPassword: 'cipher:FORGED'}));
    await assertFails(updateDoc(doc(owner, path), {_companyContactsRevision: 99}));
    await assertFails(updateDoc(doc(owner, path), {_companyContactsSchemaVersion: 1}));
    await assertFails(updateDoc(doc(owner, path), {_companyContactsUpdatedAt: 1}));
    await assertFails(deleteDoc(doc(owner, path)));
    await assertSucceeds(updateDoc(doc(owner, path), {unrelated: 'changed'}));
    const request = await prepare({slots: [{kind: 'email-slot', id: 'personale', fields: {tipo: 'Email personale'}},
        {kind: 'phone-slot', id: 'faxAzienda', value: '0119999999'}],
        creates: [{id: 'company-email-new', fields: {email: 'n@example.invalid', tipo: 'Nuova', password: 'segreta', qr: false}}],
        updates: [{id: 'company-email-free', fields: {tipo: 'Ufficio'}}],
        deletes: [{id: 'company-email-free'}]}, 'primo').then(() => null, error => error);
    assert.match(String(request), /COMPANY_CONTACTS_INVALID/, 'one row, one operation: update and delete cannot share an id');
    const valid = await prepare({slots: [{kind: 'email-slot', id: 'personale', fields: {tipo: 'Email personale'}},
        {kind: 'phone-slot', id: 'faxAzienda', value: '0119999999'}],
        creates: [{id: 'company-email-new', fields: {email: 'n@example.invalid', tipo: 'Nuova', password: 'segreta', qr: false}}],
        updates: [{id: 'company-email-free', fields: {tipo: 'Ufficio'}}]}, 'primo');
    assert.deepEqual(await run(valid, trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual(await run(valid, trusted), {status: 'confirmed', revision: 2});
    const saved = (await db.doc(path).get()).data();
    assert.equal(saved._companyContactsRevision, 2);
    assert.equal(saved.unrelated, 'changed');
    assert.ok(saved._companyContactsUpdatedAt.toMillis() > 0);
    assert.equal(saved.personale, undefined);
    assert.equal(saved.emails.personale.tipo, 'Email personale');
    assert.deepEqual(saved.emails.personale.campoIgnoto, {a: 1}, 'an unknown field of the slot survives');
    assert.equal(saved.emails.pec.email, 'pec@example.invalid');
    assert.equal(saved.emails.pec.password, 'cipher:PEC', 'a legacy password is never re-encrypted');
    assert.equal(saved.emails.pec.linkedAccountId, 'synthetic');
    assert.equal(saved.emails.altro, 'da conservare', 'an unknown key inside the e-mail map survives');
    assert.deepEqual(saved.emails.extra.map(item => item.id ?? null),
        ['company-email-free', 'company-email-selected', null, 'company-email-new']);
    assert.equal(saved.emails.extra[0].tipo, 'Ufficio');
    assert.equal(saved.emails.extra[0].email, 'free@example.invalid');
    assert.equal(saved.emails.extra[3].qr, false, 'a new row starts unpublished');
    assert.equal(saved.telefonoAzienda, '0110000000');
    assert.equal(saved.faxAzienda, '0119999999', 'a telephone slot is written as a string');
    assert.equal(saved.aziendaEmail, 'legacy@example.invalid', 'the legacy fallback is never rewritten');
    assert.equal(saved.aziendaEmailPassword, 'cipher:LEGACY');
    assert.deepEqual(saved.phoneAccountLinks, {referenteCellulare: {linkedAccountId: 'synthetic'}});
    await assertFails(setDoc(doc(owner, `mutationResults/${uid}/operations/company-contacts-primo`), {revision: 100}));
    const reused = await prepare({updates: [{id: 'company-email-selected', fields: {tipo: 'Altra'}}]}, 'primo');
    await assert.rejects(run(reused, trusted), /OPERATION_CONFLICT/);
    // The editor refuses a blocked operation before any request exists…
    await assert.rejects(() => prepare({deletes: [{id: 'company-email-selected'}]}, 'selected'), /COMPANY_CONTACTS_QR_SELECTED/);
    await assert.rejects(() => prepare({slots: [{kind: 'email-slot', id: 'pec', fields: {email: ''}}]}, 'linked'), /COMPANY_CONTACTS_LINKED/);
    await assert.rejects(() => prepare({slots: [{kind: 'phone-slot', id: 'referenteCellulare', value: ''}]}, 'linked-phone'),
        /COMPANY_CONTACTS_LINKED/);
    // …and the service refuses it again when a client sends the operation directly.
    const direct = async (operation, operationId, before) => ({target: {domain: 'company', companyId: 'company'},
        expectedRevision: (await db.doc(path).get()).data()._companyContactsRevision, operationId, operations: [operation]});
    const current = (await db.doc(path).get()).data();
    await assert.rejects(run(await direct({kind: 'email-extra-delete', id: 'company-email-selected',
        basis: hash(companyContactBasis(current.emails.extra[1]))}, 'direct-selected'), trusted), /COMPANY_CONTACTS_QR_SELECTED/);
    await assert.rejects(run(await direct({kind: 'email-slot', id: 'pec', fields: {email: ''},
        basis: hash(companyContactBasis(current.emails.pec))}, 'direct-linked'), trusted), /COMPANY_CONTACTS_LINKED/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/company-contacts-direct-selected`).get()).exists, false);
    const stale = await prepare({updates: [{id: 'company-email-free', fields: {tipo: 'Stantia'}}]}, 'stale');
    const modified = (await db.doc(path).get()).data();
    await db.doc(path).update({emails: {...modified.emails, extra: modified.emails.extra.map(item =>
        item.id === 'company-email-free' ? {...item, email: 'cambiata@example.invalid'} : item)}});
    await assert.rejects(run(stale, trusted), /COMPANY_CONTACTS_CONFLICT/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/company-contacts-stale`).get()).exists, false);
    const race = await Promise.all([
        prepare({creates: [{id: 'company-email-race-a', fields: {email: 'a@example.invalid'}}]}, 'race-a'),
        prepare({creates: [{id: 'company-email-race-b', fields: {email: 'b@example.invalid'}}]}, 'race-b')]);
    const results = await Promise.allSettled(race.map(value => run(value, trusted)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.doc(path).get()).data()._companyContactsRevision, 3);
});
test('an unverifiable card configuration refuses every company emptying and deletion without touching the record', async t => {
    const {db, dispose} = await environment('company-contacts-rules-test');
    t.after(dispose);
    const uid = 'company-qr-owner', path = `users/${uid}/aziende/company`;
    const run = createCompanyContactsHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const scoped = context(uid);
    const prepare = async (draft, operationId) => {
        const record = (await db.doc(path).get()).data();
        return prepareCompanyContacts({context: scoped, getUser: () => ({uid}),
            source: {domain: 'company', companyId: 'company'}, record, snapshot: snapshots(record), draft, operationId, hash});
    };
    await db.doc(path).set({ownerId: uid, id: 'company', _companyContactsRevision: 1,
        aziendaEmail: 'legacy@example.invalid',
        emails: {pec: {email: 'pec@example.invalid', tipo: 'PEC'}, amministrazione: {email: 'amm@example.invalid'},
            personale: {email: 'pers@example.invalid'}, extra: [{id: 'company-email-a', email: 'a@example.invalid', qr: false}]},
        telefonoAzienda: '0110000000', faxAzienda: '', referenteCellulare: '3330000000'});
    const cases = [
        ['a configuration that is not an object', 'non-un-oggetto'],
        ['an unknown flag', {sconosciuto: true}],
        ['a flag with the wrong type', {aziendaEmail: 'si'}],
        ['an unsupported schema version', {_qrSchemaVersion: 2}],
        ['an ambiguous per-row flag', {aziendaEmail: false}]
    ];
    for (const [index, [name, qrConfig]] of cases.entries()) {
        if (name.includes('per-row')) await db.doc(path).update({qrConfig, 'emails.extra': [{id: 'company-email-a', email: 'a@example.invalid', qr: 'si'}]});
        else await db.doc(path).update({qrConfig, 'emails.extra': [{id: 'company-email-a', email: 'a@example.invalid', qr: false}]});
        const before = (await db.doc(path).get()).data();
        const operationId = `qr-${index}`;
        await assert.rejects(prepare({deletes: [{id: 'company-email-a'}]}, operationId), /COMPANY_CONTACTS_QR_UNVERIFIABLE/, name);
        await assert.rejects(prepare({slots: [{kind: 'email-slot', id: 'amministrazione', fields: {email: ''}}]}, `${operationId}-slot`),
            /COMPANY_CONTACTS_QR_UNVERIFIABLE/, name);
        assert.deepEqual((await db.doc(path).get()).data(), before, name);
        assert.equal((await db.doc(`mutationResults/${uid}/operations/company-contacts-${operationId}`).get()).exists, false, name);
    }
    // A verified selection refuses a published row and allows an unselected one.
    await db.doc(path).update({qrConfig: {aziendaEmail: true, adminEmail: false}, 'emails.extra': [{id: 'company-email-a', email: 'a@example.invalid', qr: true}]});
    await assert.rejects(() => prepare({deletes: [{id: 'company-email-a'}]}, 'qr-selected'), /COMPANY_CONTACTS_QR_SELECTED/);
    assert.deepEqual(await run(await prepare({slots: [{kind: 'email-slot', id: 'amministrazione', fields: {email: ''}}]}, 'qr-slot'), trusted),
        {status: 'confirmed', revision: 2}, 'a selection that does not publish the administration address allows the emptying');
    assert.equal((await db.doc(path).get()).data().emails.amministrazione.email, '');
    // The same selection publishes the PEC, so it cannot be emptied.
    const beforePec = (await db.doc(path).get()).data();
    await assert.rejects(() => prepare({slots: [{kind: 'email-slot', id: 'pec', fields: {email: ''}}]}, 'qr-pec'),
        /COMPANY_CONTACTS_QR_SELECTED/);
    assert.deepEqual((await db.doc(path).get()).data(), beforePec);
    await db.doc(path).update({qrConfig: {aziendaEmail: false, adminEmail: false},
        'emails.extra': [{id: 'company-email-a', email: 'a@example.invalid', qr: false}]});
    assert.deepEqual(await run(await prepare({deletes: [{id: 'company-email-a'}]}, 'qr-free'), trusted), {status: 'confirmed', revision: 3});
    assert.equal((await db.doc(path).get()).data().emails.extra.length, 0);
    // The empty PEC slot shows the legacy `aziendaEmail` fallback, which would
    // simply reappear: the service refuses the emptying with a dedicated code.
    await db.doc(path).update({emails: {pec: {tipo: 'PEC'}, amministrazione: {}, personale: {}, extra: []}});
    const legacy = (await db.doc(path).get()).data();
    const direct = {target: {domain: 'company', companyId: 'company'}, expectedRevision: legacy._companyContactsRevision,
        operationId: 'legacy-fallback', operations: [{kind: 'email-slot', id: 'pec', fields: {email: ''},
            basis: hash(companyContactBasis(legacy.emails.pec))}]};
    await assert.rejects(run(direct, trusted), /COMPANY_CONTACTS_LEGACY_FALLBACK/);
    assert.deepEqual((await db.doc(path).get()).data(), legacy);
});
