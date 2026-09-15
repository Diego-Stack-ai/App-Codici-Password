import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore, FieldValue} = requireFunctions('firebase-admin/firestore');

test('candidate QR selection transaction and closed direct-write Rules on synthetic records', async t => {
    // Candidate overlay only: production rules and deployed Functions unchanged.
    const original = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
    assert.equal(original.split("collection != 'contacts' &&").length, 2);
    const rules = original.replace("collection != 'contacts' &&", "collection != 'settings' && collection != 'contacts' &&")
        .replace('    match /users/{userId} {', `    match /users/{userId}/settings/{settingId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) && settingId != 'qrCodeInclusions';
    }
    match /users/{userId} {`);
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085, rules}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'qr-selection-test'), db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app); await env.cleanup();});
    const uid = 'qr-owner', settingPath = `users/${uid}/settings/qrCodeInclusions`;
    await db.doc(`users/${uid}`).set({ownerId: uid, contactPhones: [{id: 'phone'}]});
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    await assertFails(setDoc(doc(owner, settingPath), {photo: true}));
    await assertFails(setDoc(doc(other, settingPath), {photo: true}));
    await assertSucceeds(setDoc(doc(owner, `users/${uid}/settings/unrelated`), {enabled: true}));
    const run = createPrivateQrSelectionHandler({db, hash: value => createHash('sha256').update(value).digest('hex'), timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-context-not-http-attestation'}};
    const data = {operationId: 'first', expectedRevision: 0, selection: {nome: true, cognome: false, cf: false, nascita: false, photo: false, phones: ['phone'], emails: [], addresses: []}};
    assert.deepEqual(await run(data, trusted), {status: 'confirmed', revision: 1});
    const saved = await assertSucceeds(getDoc(doc(owner, settingPath)));
    assert.deepEqual(saved.data().phones, ['phone']);
    await assertFails(getDoc(doc(other, settingPath)));
    await assertFails(setDoc(doc(owner, settingPath), {...saved.data(), photo: true}));
    const receiptPath = `mutationResults/${uid}/operations/qr-private-first`;
    await assertFails(setDoc(doc(owner, receiptPath), {revision: 99}));
    assert.deepEqual(await run(data, trusted), {status: 'confirmed', revision: 1});
    const requests = [false, true].map((photo, i) => run({...data, operationId: `race-${i}`, expectedRevision: 1,
        selection: {...data.selection, photo}}, trusted));
    const results = await Promise.allSettled(requests);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await db.doc(settingPath).get()).data()._qrRevision, 2);
    await db.doc(`users/${uid}`).update({contactPhones: []});
    await assert.rejects(run({...data, operationId: 'deleted', expectedRevision: 2}, trusted));
    assert.equal((await db.doc(`mutationResults/${uid}/operations/qr-private-deleted`).get()).exists, false);
});
