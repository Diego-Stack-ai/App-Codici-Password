import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField} from 'firebase/firestore';
import {withProfileContactsCandidateRules} from './profile-contacts-candidate-rules.mjs';
import {prepareProfileContacts} from './prepare-profile-contacts.mjs';
import {createProfileContactsHandler} from './profile-contacts-handler.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
test('private contacts candidate writes, guards and receipts on synthetic emulator records', async t => {
    const rules = withProfileContactsCandidateRules(await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'));
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085, rules}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'profile-contacts-test'), db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app); await env.cleanup();});
    const uid = 'contacts-owner', path = `users/${uid}`, selectionPath = `users/${uid}/settings/qrCodeInclusions`;
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    const run = createProfileContactsHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const display = value => value.startsWith('cipher:') ? `plain:${value.slice(0, 8)}` : value;
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {},
        async encrypt(value) {return cipher(value);}, async read({ciphertext}) {return display(ciphertext);}};
    const snapshots = record => {
        const map = new Map();
        for (const [collection, items] of [['contactEmails', record.contactEmails ?? []], ['contactPhones', record.contactPhones ?? []]]) {
            for (const item of items) {
                const fields = {}, forms = {};
                for (const [key, value] of Object.entries(item)) {
                    if (typeof value !== 'string' || key === 'id') continue;
                    forms[key] = value.startsWith('cipher:') ? 'cipher' : 'plain';
                    fields[key] = display(value);
                }
                map.set(`${collection}:${item.id}`, {fields, forms});
            }
        }
        return map;
    };
    const prepare = async (draft, operationId) => {
        const record = (await db.doc(path).get()).data();
        return prepareProfileContacts({context, getUser: () => ({uid}), record, snapshot: snapshots(record), draft, operationId, hash});
    };
    await db.doc(path).set({ownerId: uid, unrelated: 'keep', _profileContactsRevision: 1,
        contactEmails: [
            {id: 'email-home', label: 'Casa', address: 'cipher:A', note: 'cipher:NOTE', password: 'cipher:PW', linkedAccountId: 'synthetic', legacyFlag: 'keep'},
            {id: 'email-selected', label: 'Lavoro', address: 'cipher:B'},
            {id: 'email-free', label: 'Libera', address: 'cipher:D'}],
        contactPhones: [
            {id: 'phone-other', label: 'Altro', number: 'cipher:C'},
            {label: 'Senza id', number: 'cipher:E'}]});
    await db.doc(selectionPath).set({nome: true, emails: ['email-selected'], phones: [], addresses: []});
    await assertSucceeds(getDoc(doc(owner, path))); await assertFails(getDoc(doc(other, path)));
    await assertFails(updateDoc(doc(owner, path), {contactEmails: []}));
    await assertFails(updateDoc(doc(owner, path), {contactPhones: deleteField()}));
    await assertFails(updateDoc(doc(owner, path), {_profileContactsRevision: 99}));
    await assertFails(updateDoc(doc(owner, path), {contactEmails: [{id: 'email-x', linkedAccountId: 'forged'}]}));
    await assertFails(deleteDoc(doc(owner, path)));
    await assertSucceeds(updateDoc(doc(owner, path), {unrelated: 'changed'}));
    const request = await prepare({creates: [{collection: 'contactEmails', id: 'email-new', fields: {label: 'Nuova', address: 'n@example.invalid', note: 'nota nuova'}}],
        updates: [{collection: 'contactPhones', id: 'phone-other', fields: {label: 'Ufficio'}}],
        deletes: [{collection: 'contactEmails', id: 'email-free'}]}, 'primo');
    assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
    const saved = (await db.doc(path).get()).data();
    assert.equal(saved._profileContactsRevision, 2); assert.equal(saved.unrelated, 'changed');
    assert.ok(saved._profileContactsUpdatedAt.toMillis() > 0);
    assert.deepEqual(saved.contactEmails.map(item => item.id), ['email-home', 'email-selected', 'email-new']);
    assert.equal(saved.contactEmails[2].isPrimary, false);
    assert.equal(saved.contactEmails[0].legacyFlag, 'keep'); assert.equal(saved.contactEmails[0].note, 'cipher:NOTE');
    assert.equal(saved.contactEmails[1].address, 'cipher:B');
    assert.equal(saved.contactPhones.length, 2); assert.equal(saved.contactPhones[0].label, 'Ufficio');
    assert.equal(saved.contactPhones[1].label, 'Senza id');
    await assertFails(setDoc(doc(owner, `mutationResults/${uid}/operations/profile-contacts-primo`), {revision: 100}));
    const reused = await prepare({updates: [{collection: 'contactPhones', id: 'phone-other', fields: {label: 'Altra'}}]}, 'primo');
    await assert.rejects(run(reused, trusted), /OPERATION_CONFLICT/);
    await assert.rejects(run(await prepare({deletes: [{collection: 'contactEmails', id: 'email-home'}]}, 'linked'), trusted), /CONTACTS_LINKED/);
    await assert.rejects(run(await prepare({deletes: [{collection: 'contactEmails', id: 'email-selected'}]}, 'selected'), trusted), /CONTACTS_QR_SELECTED/);
    const stale = await prepare({updates: [{collection: 'contactEmails', id: 'email-selected', fields: {label: 'Cambiata'}}]}, 'stale');
    const currentEmails = (await db.doc(path).get()).data().contactEmails;
    await db.doc(path).update({contactEmails: currentEmails.map(item => item.id === 'email-selected' ? {...item, address: 'cipher:MODIFICATO'} : item)});
    await assert.rejects(run(stale, trusted), /CONTACTS_CONFLICT/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/profile-contacts-stale`).get()).exists, false);
    const partial = await prepare({creates: [{collection: 'contactPhones', id: 'phone-new', fields: {number: '3332222222'}}],
        updates: [{collection: 'contactPhones', id: 'phone-other', fields: {label: 'Altra'}}]}, 'partial');
    const before = (await db.doc(path).get()).data();
    await db.doc(path).update({contactPhones: [{id: 'phone-other', label: 'Altro', number: 'cipher:MODIFICATO'}]});
    await assert.rejects(run(partial, trusted), /CONTACTS_CONFLICT/);
    const after = (await db.doc(path).get()).data();
    assert.equal(after.contactPhones.length, 1); assert.equal(after._profileContactsRevision, before._profileContactsRevision);
    const race = await Promise.all([
        prepare({creates: [{collection: 'contactEmails', id: 'email-race-a', fields: {address: 'a@example.invalid'}}]}, 'race-a'),
        prepare({creates: [{collection: 'contactEmails', id: 'email-race-b', fields: {address: 'b@example.invalid'}}]}, 'race-b')]);
    const results = await Promise.allSettled(race.map(value => run(value, trusted)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.doc(path).get()).data()._profileContactsRevision, 3);
});
test('unverifiable QR configurations refuse every deletion without touching profile, selection or receipts', async t => {
    const rules = withProfileContactsCandidateRules(await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'));
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085, rules}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'profile-contacts-qr-test'), db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app); await env.cleanup();});
    const uid = 'contacts-qr-owner', path = `users/${uid}`, selectionPath = `users/${uid}/settings/qrCodeInclusions`;
    const run = createProfileContactsHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {},
        async encrypt(value) {return cipher(value);}, async read({ciphertext}) {return ciphertext;}};
    const snapshots = record => {
        const map = new Map();
        for (const [collection, items] of [['contactEmails', record.contactEmails ?? []], ['contactPhones', record.contactPhones ?? []]]) {
            for (const item of items) {
                const fields = {}, forms = {};
                for (const [key, value] of Object.entries(item)) {
                    if (typeof value !== 'string' || key === 'id') continue;
                    forms[key] = 'plain';
                    fields[key] = value;
                }
                map.set(`${collection}:${item.id}`, {fields, forms});
            }
        }
        return map;
    };
    const remove = async (id, operationId) => {
        const record = (await db.doc(path).get()).data();
        const request = await prepareProfileContacts({context, getUser: () => ({uid}), record, snapshot: snapshots(record),
            draft: {deletes: [{collection: 'contactPhones', id}]}, operationId, hash});
        return run(request, trusted);
    };
    await db.doc(path).set({ownerId: uid, _profileContactsRevision: 1,
        contactEmails: [{id: 'email-home', address: 'home@example.invalid'}],
        contactPhones: [{id: 'phone-mobile', label: 'Cellulare', number: '3330000000'},
            {id: 'phone-other', label: 'Altro', number: '3331111111'}]});
    const cases = [
        ['emails with the wrong type', {emails: 'email-home', phones: [], addresses: []}],
        ['phones with the wrong type', {emails: [], phones: {}, addresses: []}],
        ['a reference to a non-existent id', {emails: [], phones: ['phone-missing'], addresses: []}],
        ['duplicate references', {emails: [], phones: ['phone-other', 'phone-other'], addresses: []}],
        ['an unresolvable legacy index', {emails: [], phones: [9], addresses: []}],
        ['a negative legacy index', {emails: [], phones: [-1], addresses: []}],
        ['a reference into a missing section', {emails: [], phones: [], addresses: ['address-missing']}],
        ['a scalar with the wrong type', {emails: [], phones: [], addresses: [], nome: 'si'}],
        ['an unsupported schema version', {emails: [], phones: [], addresses: [], _qrSchemaVersion: 2}],
        ['a foreign transport id', {emails: [], phones: [], addresses: [], id: 'otherSetting'}]
    ];
    for (const [index, [name, selection]] of cases.entries()) {
        await db.doc(selectionPath).set(selection);
        const beforeProfile = (await db.doc(path).get()).data(), beforeSelection = (await db.doc(selectionPath).get()).data();
        const operationId = `qr-${index}`;
        await assert.rejects(remove('phone-mobile', operationId), /CONTACTS_QR_UNVERIFIABLE/, name);
        assert.deepEqual((await db.doc(path).get()).data(), beforeProfile, name);
        assert.deepEqual((await db.doc(selectionPath).get()).data(), beforeSelection, name);
        assert.equal((await db.doc(`mutationResults/${uid}/operations/profile-contacts-${operationId}`).get()).exists, false, name);
    }
    // A verified selection allows an unselected contact and refuses a selected one.
    await db.doc(selectionPath).set({nome: true, emails: ['email-home'], phones: ['phone-other'], addresses: []});
    assert.deepEqual(await remove('phone-mobile', 'qr-unselected'), {status: 'confirmed', revision: 2});
    assert.deepEqual((await db.doc(selectionPath).get()).data(),
        {nome: true, emails: ['email-home'], phones: ['phone-other'], addresses: []}, 'a confirmed deletion never rewrites the selection');
    await assert.rejects(remove('phone-other', 'qr-selected'), /CONTACTS_QR_SELECTED/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/profile-contacts-qr-selected`).get()).exists, false);
    // A genuinely absent document is a verified empty selection.
    await db.doc(selectionPath).delete();
    assert.deepEqual(await remove('phone-other', 'qr-absent'), {status: 'confirmed', revision: 3});
    assert.equal((await db.doc(selectionPath).get()).exists, false, 'the deletion never recreates the selection');
});
