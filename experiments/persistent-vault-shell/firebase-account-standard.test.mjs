import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, updateDoc} from 'firebase/firestore';
import {withQrSelectionCandidateRules} from './qr-selection-candidate-rules.mjs';
import {withAccountStandardCandidateRules} from './account-standard-candidate-rules.mjs';
import {createAccountStandardHandler} from './account-standard-handler.mjs';
import {prepareAccountStandard} from './account-standard-contract.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => Buffer.alloc(48, value.charCodeAt(0) || 42).toString('base64');

test('candidate Rules fence direct edits while the trusted transaction isolates equal Account ids', async t => {
    const originalRules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
    const rules = withAccountStandardCandidateRules(withQrSelectionCandidateRules(originalRules));
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {host: '127.0.0.1', port: 8085, rules}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'account-standard-test'), db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app); await env.cleanup();});
    const uid = 'account-standard-owner', root = `users/${uid}`, companyRoot = `${root}/aziende/firm`;
    await db.doc(companyRoot).set({id: 'firm', ownerId: uid});
    const base = {id: 'same', ownerId: uid, schemaVersion: 1, revision: 1, nomeAccount: cipher('N'), username: cipher('U'),
        account: cipher('C'), password: cipher('P'), url: '', note: cipher('Z'), allegati: [{id: 'file'}], banking: [{id: 'bank'}],
        linkedProfileFields: [{type: 'phone', id: 'mobile'}], linkedCompanyProfileFields: [{companyId: 'firm', type: 'email', id: 'pec'}], unknown: {keep: true}};
    const paths = [`${root}/accounts/same`, `${companyRoot}/accounts/same`];
    for (const path of paths) await db.doc(path).set(base);
    await db.doc(`${root}/accountWidgets/widget`).set({ownerId: uid, context: 'private', accountId: 'same'});
    await db.doc(`${root}/sharedVaultData/common`).set({ownerId: uid});
    await db.doc(`${root}/sharedVaultLinks/link`).set({ownerId: uid, accountId: 'same'});
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    for (const path of paths) {
        await assertSucceeds(getDoc(doc(owner, path))); await assertFails(getDoc(doc(other, path)));
        for (const field of ['nomeAccount', 'username', 'account', 'password', 'url'])
            await assertFails(updateDoc(doc(owner, path), {[field]: field === 'url' ? 'https://direct.invalid' : cipher('X')}));
    }
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}, encrypt: async value => cipher(value)};
    const run = createAccountStandardHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    for (const account of [{domain: 'private', id: 'same'}, {domain: 'company', companyId: 'firm', id: 'same'}]) {
        const path = account.domain === 'private' ? paths[0] : paths[1], before = (await db.doc(path).get()).data();
        const request = await prepareAccountStandard({context, getUser: () => ({uid}), source: before, account,
            changes: {nomeAccount: `Nuovo ${account.domain}`, username: '', account: 'Codice', password: '', url: 'https://example.invalid'},
            operationId: `operation-${account.domain}`, hash});
        assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
        assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
        const saved = (await db.doc(path).get()).data();
        for (const field of ['note', 'allegati', 'banking', 'linkedProfileFields', 'linkedCompanyProfileFields', 'unknown']) assert.deepEqual(saved[field], before[field]);
        assert.equal(saved.revision, 2);
    }
    assert.equal((await db.doc(`${root}/accountWidgets/widget`).get()).exists, true);
    assert.equal((await db.doc(`${root}/sharedVaultData/common`).get()).exists, true);
    assert.equal((await db.doc(`${root}/sharedVaultLinks/link`).get()).exists, true);
});
