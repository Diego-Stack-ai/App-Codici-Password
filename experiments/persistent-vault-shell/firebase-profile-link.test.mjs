import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, updateDoc, setDoc, deleteDoc} from 'firebase/firestore';
import {withQrSelectionCandidateRules} from './qr-selection-candidate-rules.mjs';
import {withProfileLinkCandidateRules} from './profile-link-candidate-rules.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';
import {createProfileLinkHandler} from './profile-link-handler.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex'), models = {};
for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
    Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
}
test('profile links and inverse references commit atomically in the demo emulator', async t => {
    const originalRules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
    const rules = withProfileLinkCandidateRules(withQrSelectionCandidateRules(originalRules));
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085, rules}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'profile-link-test'), db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app); await env.cleanup();});
    const uid = 'link-owner', root = `users/${uid}`, company = `${root}/aziende/origin`, destination = `${root}/aziende/destination`;
    const oldPath = `${root}/accounts/old`, nextPath = `${destination}/accounts/next`, oldLink = {linkedAccountId: 'old', linkedAccountCompanyId: ''};
    await db.doc(root).set({contactPhones: [{id: 'mobile', number: 'enc:MOBILE', ...oldLink}, {id: 'fixed', number: 'enc:FIXED', ...oldLink}]});
    await db.doc(company).set({telefonoAzienda: 'enc:COMPANY', phoneAccountLinks: {telefonoAzienda: oldLink}});
    await db.doc(destination).set({ownerId: uid});
    await db.doc(oldPath).set({password: 'enc:OLD', linkedProfileFields: [{type: 'phone', id: 'mobile'}, {type: 'phone', id: 'fixed'}],
        linkedCompanyProfileFields: [{companyId: 'origin', type: 'phone', id: 'telefonoAzienda'}]});
    await db.doc(nextPath).set({password: 'enc:NEXT', type: 'account'});
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    await assertSucceeds(getDoc(doc(owner, nextPath))); await assertFails(getDoc(doc(other, nextPath)));
    await assertFails(updateDoc(doc(owner, root), {contactPhones: []}));
    await assertFails(updateDoc(doc(owner, company), {'phoneAccountLinks.telefonoAzienda': {linkedAccountId: 'next'}}));
    for (const path of [oldPath, nextPath]) {
        await assertFails(updateDoc(doc(owner, path), {linkedProfileFields: []}));
        await assertFails(updateDoc(doc(owner, path), {_profileLinkRevision: 99}));
        await assertFails(deleteDoc(doc(owner, path)));
        await assertSucceeds(updateDoc(doc(owner, path), {note: 'unrelated synthetic'}));
    }
    const run = createProfileLinkHandler({db, models, hash, timestamp: () => FieldValue.serverTimestamp(), deleteField: () => FieldValue.delete()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const sourcePrivate = {domain: 'private', type: 'phone', id: 'mobile'}, sourceCompany = {domain: 'company', companyId: 'origin', type: 'phone', id: 'telefonoAzienda'};
    const prepare = async (source, operationId, account = {domain: 'company', companyId: 'destination', id: 'next'}) => {
        const record = (await db.doc(source.domain === 'private' ? root : company).get()).data();
        const selected = readProfileLinkContact(record, source, models);
        return {source, account, expectedAccount: selected.account, expectedFingerprint: hash(selected.fingerprintInput),
            expectedRevision: record._profileLinkRevision || 0, operationId};
    };
    const requests = await Promise.all([prepare(sourcePrivate, 'private'), prepare(sourceCompany, 'company')]);
    const results = await Promise.all(requests.map(request => run(request, trusted)));
    assert.ok(results.every(result => result.status === 'confirmed'));
    const next = (await db.doc(nextPath).get()).data(), old = (await db.doc(oldPath).get()).data();
    assert.equal(next._profileLinkRevision, 2); assert.equal(next.linkedProfileFields[0].id, 'mobile');
    assert.equal(next.linkedCompanyProfileFields[0].companyId, 'origin'); assert.equal(next.password, 'enc:NEXT');
    assert.equal(old.linkedProfileFields[0].id, 'fixed'); assert.deepEqual(old.linkedCompanyProfileFields, []);
    assert.equal(Object.hasOwn(old, 'linkedCompanyProfileField'), false); assert.equal(old.password, 'enc:OLD');
    await run(requests[0], trusted); assert.equal((await db.doc(nextPath).get()).data()._profileLinkRevision, 2);
    await assertFails(setDoc(doc(owner, `mutationResults/${uid}/operations/profile-link-private`), {revision: 99}));
    const fixed = {...sourcePrivate, id: 'fixed'};
    const race = await Promise.all([prepare(fixed, 'race-link'), prepare(fixed, 'race-unlink', null)]);
    const raced = await Promise.allSettled(race.map(request => run(request, trusted)));
    assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.doc(root).get()).data()._profileLinkRevision, 2);
    const stale = await prepare(sourceCompany, 'legacy-change', null);
    await db.doc(company).update({telefonoAzienda: 'enc:CHANGED'});
    await assert.rejects(run(stale, trusted), /LINK_CONFLICT/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/profile-link-legacy-change`).get()).exists, false);
});
