import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, deleteField} from 'firebase/firestore';
import {withQrSelectionCandidateRules} from './qr-selection-candidate-rules.mjs';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';
import {createQrSelectionEditorSource} from './qr-selection-editor-source.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {withCompanyQrSelectionCandidateRules} from './company-qr-selection-candidate-rules.mjs';
import {createCompanyQrSelectionHandler} from './company-qr-selection-handler.mjs';
import {readCompanyQrSelection} from './company-qr-selection-contract.mjs';

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
    const rules = withCompanyQrSelectionCandidateRules(withQrSelectionCandidateRules(original));
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
    // Client reader/controller use Rules-protected reads; the test adapter calls
    // the candidate service directly, never impersonating HTTP attestation.
    const abort = new AbortController(), context = {user: {uid}, signal: abort.signal, assertUnlocked() {},
        read() {throw Error('UNEXPECTED_DECRYPT');}};
    const repository = {getUserProfileConfirmed: async requested => {
        assert.equal(requested, uid); return (await getDoc(doc(owner, `users/${uid}`))).data();
    }, getUserSettingConfirmed: async requested => {
        assert.equal(requested, uid); return (await getDoc(doc(owner, settingPath))).data();
    }};
    const source = createQrSelectionEditorSource({context, getUser: () => ({uid}), repository, isEncryptedValue: () => false, isOnline: () => true});
    const loaded = await source.load(); let firstResponse = true;
    const controller = createQrSelectionSaveController({context, getUser: () => ({uid}), prepare: value => source.prepare(value),
        createOperationId: () => 'editor-save', submit: async request => {
            const result = await run(request, trusted);
            if (firstResponse) {firstResponse = false; throw Error('SYNTHETIC_RESPONSE_LOST');}
            return result;
        }});
    assert.equal((await controller.save({...loaded.selection, phones: []})).status, 'unknown');
    assert.equal((await controller.retry()).status, 'saved');
    const refreshed = await source.load(); assert.deepEqual(refreshed.selection.phones, []);
    assert.equal((await db.doc(settingPath).get()).data()._qrRevision, 3);
    controller.dispose(); source.dispose(); abort.abort();
    await db.doc(`users/${uid}`).update({contactPhones: []});
    await assert.rejects(run({...data, operationId: 'deleted', expectedRevision: 3}, trusted));
    assert.equal((await db.doc(`mutationResults/${uid}/operations/qr-private-deleted`).get()).exists, false);

    await t.test('company fixed QR selection: Rules, legacy conflict, receipt retry and concurrent saves', async () => {
        const companyId = 'company-fixture', companyPath = `users/${uid}/aziende/${companyId}`;
        const originalCompany = {ownerId: uid, ragioneSociale: 'enc:SYNTHETIC',
            emails: {extra: [{qr: false, password: 'enc:SYNTHETIC'}]}, altreSedi: [{qr: true}]};
        await db.doc(companyPath).set(originalCompany);
        await assertSucceeds(getDoc(doc(owner, companyPath)));
        await assertFails(getDoc(doc(other, companyPath)));
        await assertFails(updateDoc(doc(owner, companyPath), {qrConfig: {telefonoAzienda: true}}));
        await assertFails(setDoc(doc(owner, `users/${uid}/aziende/new-with-qr`), {qrConfig: {}}));
        await assertSucceeds(setDoc(doc(owner, `users/${uid}/aziende/new-without-qr`), {ragioneSociale: 'synthetic'}));
        await assertSucceeds(updateDoc(doc(owner, companyPath), {ragioneSociale: 'enc:CHANGED'}));
        await assertFails(updateDoc(doc(other, companyPath), {ragioneSociale: 'enc:OTHER'}));
        const companyRun = createCompanyQrSelectionHandler({db, hash: value => createHash('sha256').update(value).digest('hex'),
            timestamp: () => FieldValue.serverTimestamp()});
        const companyData = {companyId, operationId: 'company-first', expectedConfig: null,
            selection: {...readCompanyQrSelection({}).selection, ragioneSociale: true}};
        assert.deepEqual(await companyRun(companyData, trusted), {status: 'confirmed', revision: 1});
        assert.deepEqual(await companyRun(companyData, trusted), {status: 'confirmed', revision: 1});
        const savedCompany = (await db.doc(companyPath).get()).data();
        assert.deepEqual(savedCompany.emails, originalCompany.emails); assert.deepEqual(savedCompany.altreSedi, originalCompany.altreSedi);
        assert.equal(savedCompany.ragioneSociale, 'enc:CHANGED');
        await assertFails(updateDoc(doc(owner, companyPath), {'qrConfig.telefonoAzienda': true}));
        await assertFails(updateDoc(doc(owner, companyPath), {qrConfig: deleteField()}));
        await assertFails(setDoc(doc(owner, companyPath), originalCompany));
        await assertFails(setDoc(doc(owner, `mutationResults/${uid}/operations/qr-company-company-first`), {revision: 99}));
        const expectedConfig = savedCompany.qrConfig;
        const race = await Promise.allSettled([false, true].map((telefonoAzienda, index) => companyRun({...companyData,
            operationId: `company-race-${index}`, expectedConfig, selection: {...companyData.selection, telefonoAzienda}}, trusted)));
        assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(race.filter(result => result.status === 'rejected').length, 1);
        assert.equal((await db.doc(companyPath).get()).data().qrConfig._qrRevision, 2);
        await db.doc(companyPath).update({qrConfig: {ragioneSociale: false}});
        await assert.rejects(companyRun({...companyData, operationId: 'company-legacy', expectedConfig: {ragioneSociale: true}}, trusted), /REVISION_CONFLICT/);
        assert.equal((await db.doc(`mutationResults/${uid}/operations/qr-company-company-legacy`).get()).exists, false);
    });
});
