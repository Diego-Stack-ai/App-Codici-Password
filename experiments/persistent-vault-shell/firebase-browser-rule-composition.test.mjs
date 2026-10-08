import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {createHash, randomUUID} from 'node:crypto';
import {createAccountStandardHandler} from './account-standard-handler.mjs';
import {prepareAccountStandard} from './account-standard-contract.mjs';
import {prepareProfileText} from './prepare-profile-text.mjs';
import {createProfileTextHandler} from './profile-text-handler.mjs';
import {createAccountNoteHandler} from './account-note-handler.mjs';
import {accountNoteBasis} from './account-note-contract.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';
import {createProfileLinkHandler} from './profile-link-handler.mjs';
import {createProfileAccountCreateHandler} from './profile-account-create-handler.mjs';
import {preparePrivateDocuments} from './prepare-private-documents.mjs';
import {createPrivateDocumentsHandler} from './private-documents-handler.mjs';
import {preparePrivateAddresses} from './prepare-private-addresses.mjs';
import {createPrivateAddressesHandler} from './private-addresses-handler.mjs';
import {preparePrivateUtilities} from './prepare-private-utilities.mjs';
import {createPrivateUtilitiesHandler} from './private-utilities-handler.mjs';
import {prepareCompanyAddresses} from './prepare-company-addresses.mjs';
import {createCompanyAddressesHandler} from './company-addresses-handler.mjs';
import {prepareProfileContacts} from './prepare-profile-contacts.mjs';
import {createProfileContactsHandler} from './profile-contacts-handler.mjs';
import {prepareCompanyContacts} from './prepare-company-contacts.mjs';
import {createCompanyContactsHandler} from './company-contacts-handler.mjs';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';
import {createCompanyQrSelectionHandler} from './company-qr-selection-handler.mjs';
import {readCompanyQrSelection} from './company-qr-selection-contract.mjs';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, setDoc, updateDoc, getDoc, deleteDoc, deleteField, writeBatch} from 'firebase/firestore';
import {withIntegratedAccountCandidateRules} from './integrated-account-candidate-rules.mjs';
import {withQrSelectionCandidateRules} from './qr-selection-candidate-rules.mjs';
import {withDocumentAttachmentCandidateRules} from './profile-document-attachment-candidate-rules.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
test('actual browser composition denies standard Account writes in both domains', async t => {
    const source = await readFile(new URL('./emulator-browser.mjs', import.meta.url), 'utf8');
    const original = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
    const expression = source.match(/rules: (withDocumentAttachmentCandidateRules\([^\n]+)\},/);
    assert.ok(expression);
    const rules = await runInNewContext(`(async () => ${expression[1]})()`, {
        withIntegratedAccountCandidateRules, withQrSelectionCandidateRules, withDocumentAttachmentCandidateRules,
        base: '/synthetic', readFile: async path => {assert.equal(path, '/synthetic/../../firestore.rules'); return original;}
    });
    // Dedicated demo namespace: do not replace the running browser laboratory's rules.
    const env = await initializeTestEnvironment({projectId: 'demo-browser-rules-check',
        firestore: {host: '127.0.0.1', port: 8085, rules}});
    t.after(() => env.cleanup());
    const app = initializeApp({projectId: 'demo-browser-rules-check'}, 'browser-rules-handler-check');
    const db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app);});
    const uid = `synthetic-${randomUUID()}`, owner = env.authenticatedContext(uid).firestore();
    const originalCipher = Buffer.alloc(48, 42).toString('base64');
    const outsider = env.authenticatedContext('synthetic-other').firestore();
    const roots = [`users/${uid}/accounts`, `users/${uid}/aziende/synthetic-company/accounts`];
    await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), `users/${uid}`), {syntheticUnprotected: true});
        await setDoc(doc(context.firestore(), `users/${uid}/aziende/synthetic-company`), {syntheticUnprotected: true});
        for (const root of roots) await setDoc(doc(context.firestore(), `${root}/existing`), {ownerId: uid, nomeAccount: originalCipher});
    });
    await t.test('private and company branch-specific fields are protected together', async () => {
        for (const [path, fields] of [
            [`users/${uid}`, ['_profileDocumentsRevision', '_profileUtilitiesRevision', '_profileAddressesRevision', '_profileContactsRevision']],
            [`users/${uid}/aziende/synthetic-company`, ['_companyAddressesRevision', '_companyContactsRevision', 'indirizzoSede', 'telefonoAzienda']]
        ]) {
            await assertSucceeds(updateDoc(doc(owner, path), {syntheticUnprotected: false}));
            for (const field of fields) await assertFails(updateDoc(doc(owner, path), {[field]: 'synthetic-change'}));
        }
    });
    await t.test('profile text service preserves unrelated data and rejects stale edits', async () => {
        const hash = value => createHash('sha256').update(value).digest('hex');
        const run = createProfileTextHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}, encrypt: async () => originalCipher};
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        for (const domain of ['private', 'company']) {
            const target = domain === 'private' ? {domain} : {domain, companyId: 'synthetic-company'};
            const path = domain === 'private' ? `users/${uid}` : `users/${uid}/aziende/synthetic-company`;
            const before = (await db.doc(path).get()).data();
            await assertFails(updateDoc(doc(owner, path), {note: 'synthetic-direct'}));
            const prepare = operationId => prepareProfileText({context, getUser: () => ({uid}),
                source: before, target, changes: {note: 'synthetic-note'}, operationId, hash});
            const first = await prepare(`integrated-text-${domain}`);
            assert.deepEqual(await run(first, trusted), {status: 'confirmed', revision: 1});
            assert.deepEqual(await run(first, trusted), {status: 'confirmed', revision: 1});
            await assert.rejects(run(await prepare(`integrated-text-stale-${domain}`), trusted), /REVISION_CONFLICT/);
            const saved = (await getDoc(doc(owner, path))).data();
            assert.equal(saved.note, originalCipher);
            assert.equal(saved.syntheticUnprotected, before.syntheticUnprotected);
            assert.equal(saved._profileTextRevision, 1);
            await assertFails(updateDoc(doc(owner, path), {note: deleteField()}));
            await assertFails(setDoc(doc(owner, path), {syntheticUnprotected: true}));
        }
    });
    for (const root of roots) await t.test(root.includes('/aziende/') ? 'company' : 'private', async () => {
        await assertSucceeds(getDoc(doc(owner, `${root}/existing`)));
        await assertFails(getDoc(doc(outsider, `${root}/existing`)));
        await assertSucceeds(setDoc(doc(owner, `${root}/control`), {ownerId: uid, syntheticUnprotected: true}));
        await assertSucceeds(updateDoc(doc(owner, `${root}/existing`), {syntheticUnprotected: true}));
        for (const field of ['nomeAccount', 'username', 'account', 'password', 'url']) {
            await assertFails(setDoc(doc(owner, `${root}/create-${field}`), {[field]: 'synthetic-new'}));
            await assertFails(updateDoc(doc(owner, `${root}/existing`), {[field]: 'synthetic-change'}));
        }
        assert.equal((await getDoc(doc(owner, `${root}/existing`))).data().nomeAccount, originalCipher);
        const hash = value => createHash('sha256').update(value).digest('hex');
        const account = root.includes('/aziende/')
            ? {domain: 'company', companyId: 'synthetic-company', id: 'existing'}
            : {domain: 'private', id: 'existing'};
        const source = (await db.doc(`${root}/existing`).get()).data();
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
        const request = await prepareAccountStandard({context, getUser: () => ({uid}), source, account,
            changes: {url: 'https://synthetic.invalid'}, operationId: `browser-rules-${account.domain}`, hash});
        const run = createAccountStandardHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        await assert.rejects(run(request, {auth: {uid}}), /APP_CHECK_REQUIRED/);
        const result = await run(request, trusted);
        assert.equal(result.status, 'confirmed');
        assert.deepEqual(await run(request, trusted), result);
        const saved = (await getDoc(doc(owner, `${root}/existing`))).data();
        assert.equal(saved.url, 'https://synthetic.invalid');
        assert.equal(saved.nomeAccount, originalCipher);
        assert.equal(saved.revision, result.revision);
        await assertFails(setDoc(doc(owner, `${root}/existing`), {ownerId: uid}));
        await assertFails(updateDoc(doc(owner, `${root}/existing`), {nomeAccount: deleteField()}));
        await assertFails(deleteDoc(doc(owner, `${root}/existing`)));
        const batch = writeBatch(owner);
        batch.update(doc(owner, `${root}/control`), {syntheticUnprotected: 'must-not-commit'});
        batch.update(doc(owner, `${root}/existing`), {url: 'https://forbidden.invalid'});
        await assertFails(batch.commit());
        assert.deepEqual((await getDoc(doc(owner, `${root}/existing`))).data(), saved);
        assert.equal((await getDoc(doc(owner, `${root}/control`))).data().syntheticUnprotected, true);
        const noteBasis = accountNoteBasis(saved, uid, account);
        const noteRequest = {account, note: originalCipher, expectedFingerprint: hash(noteBasis.value),
            expectedRevision: noteBasis.revision, operationId: `integrated-note-${account.domain}`, expectedOwnerUid: uid};
        const noteRun = createAccountNoteHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const standardStale = await prepareAccountStandard({context, getUser: () => ({uid}), source: saved, account,
            changes: {url: 'https://stale.invalid'}, operationId: `integrated-stale-standard-${account.domain}`, hash});
        const noteResult = await noteRun(noteRequest, trusted);
        assert.deepEqual(await noteRun(noteRequest, trusted), noteResult);
        await assert.rejects(run(standardStale, trusted), /REVISION_CONFLICT/);
        const withNote = (await getDoc(doc(owner, `${root}/existing`))).data();
        assert.equal(withNote.note, originalCipher);
        assert.equal(withNote.url, saved.url);
        assert.equal(withNote.nomeAccount, saved.nomeAccount);
        assert.equal(withNote.revision, saved.revision + 1);
        await assertFails(updateDoc(doc(owner, `${root}/existing`), {note: ''}));
    });
    await t.test('address and utility services preserve each other in the common profile', async () => {
        const path = `users/${uid}`, hash = value => createHash('sha256').update(value).digest('hex');
        await db.doc(path).set({userAddresses: [{id: 'address-home', type: 'Residenza', address: 'Via sintetica',
            unknown: 'keep', utilities: [{id: 'utility-one', type: 'Energia', value: originalCipher, password: 'synthetic-legacy'}]}]}, {merge: true});
        const before = (await db.doc(path).get()).data();
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {},
            encrypt: async value => Buffer.concat([Buffer.alloc(48, 42), Buffer.from(value)]).toString('base64')};
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        const addressRun = createPrivateAddressesHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const addressRequest = await preparePrivateAddresses({context, getUser: () => ({uid}), record: before,
            snapshot: new Map([['address-home', {fields: {type: 'Residenza', address: 'Via sintetica'}}]]),
            draft: {updates: [{id: 'address-home', fields: {city: 'Citta sintetica'}}]}, operationId: 'integrated-address', hash});
        const result = await addressRun(addressRequest, trusted);
        assert.equal(result.status, 'confirmed');
        assert.deepEqual(await addressRun(addressRequest, trusted), result);
        const addressed = (await getDoc(doc(owner, path))).data();
        assert.deepEqual(addressed.userAddresses[0].utilities, before.userAddresses[0].utilities);
        const utilityRun = createPrivateUtilitiesHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const utilityRequest = await preparePrivateUtilities({context, getUser: () => ({uid}), record: addressed,
            parentAddressId: 'address-home', snapshot: new Map([['utility-one', {fields: {type: 'Energia', value: 'OLD'}, forms: {type: 'plain', value: 'cipher'}}]]),
            draft: {updates: [{id: 'utility-one', fields: {value: 'NEW'}}]}, operationId: 'integrated-utility', hash});
        const utilityResult = await utilityRun(utilityRequest, trusted);
        assert.equal(utilityResult.status, 'confirmed');
        assert.deepEqual(await utilityRun(utilityRequest, trusted), utilityResult);
        const saved = (await getDoc(doc(owner, path))).data();
        assert.equal(saved.note, before.note);
        assert.equal(saved.userAddresses[0].city, 'Citta sintetica');
        assert.equal(saved.userAddresses[0].unknown, 'keep');
        assert.equal(saved.userAddresses[0].utilities[0].password, 'synthetic-legacy');
        assert.notEqual(saved.userAddresses[0].utilities[0].value, originalCipher);
        await assertFails(updateDoc(doc(owner, path), {userAddresses: []}));
    });
    await t.test('company addresses preserve contacts and reject stale seat edits', async () => {
        const path = `users/${uid}/aziende/synthetic-company`, hash = value => createHash('sha256').update(value).digest('hex');
        await db.doc(path).set({indirizzoSede: 'Via sintetica', civicoSede: '1',
            emails: {pec: {email: originalCipher}}, qrConfig: {qrLegale: true},
            altreSedi: [{id: 'sede-filiale', tipo: 'Filiale', indirizzo: 'Via filiale', qr: false, unknown: 'keep'}]}, {merge: true});
        const before = (await db.doc(path).get()).data();
        const source = {domain: 'company', companyId: 'synthetic-company', async read() {return (await db.doc(path).get()).data();}};
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
        const snapshot = new Map([['sede-filiale', {fields: {tipo: 'Filiale', indirizzo: 'Via filiale', qr: false}}]]);
        const prepare = operationId => prepareCompanyAddresses({context, getUser: () => ({uid}), source, record: before,
            snapshot, draft: {seat: {fields: {indirizzoSede: 'Via nuova sintetica'}}, updates: [{id: 'sede-filiale', fields: {citta: 'Citta sintetica'}}]}, operationId, hash});
        const request = await prepare('integrated-company-address'), stale = await prepare('integrated-company-address-stale');
        const run = createCompanyAddressesHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        const result = await run(request, trusted);
        assert.equal(result.status, 'confirmed');
        assert.deepEqual(await run(request, trusted), result);
        await assert.rejects(run(stale, trusted), /REVISION_CONFLICT/);
        const saved = (await getDoc(doc(owner, path))).data();
        assert.equal(saved.indirizzoSede, 'Via nuova sintetica');
        assert.equal(saved.civicoSede, '1');
        assert.equal(saved.altreSedi[0].citta, 'Citta sintetica');
        assert.equal(saved.altreSedi[0].unknown, 'keep');
        assert.deepEqual(saved.emails, before.emails);
        assert.deepEqual(saved.qrConfig, before.qrConfig);
        assert.equal(saved.note, before.note);
        await assertFails(updateDoc(doc(owner, path), {altreSedi: []}));
        await assertFails(updateDoc(doc(owner, path), {indirizzoSede: 'forbidden'}));
    });
    await t.test('private and company contacts preserve addresses in the shared composition', async () => {
        const hash = value => createHash('sha256').update(value).digest('hex');
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {},
            encrypt: async value => Buffer.concat([Buffer.alloc(48, 42), Buffer.from(value)]).toString('base64')};
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        for (const domain of ['private', 'company']) {
            const path = domain === 'private' ? `users/${uid}` : `users/${uid}/aziende/synthetic-company`;
            const before = (await db.doc(path).get()).data();
            const common = {context, getUser: () => ({uid}), record: before, snapshot: new Map(), operationId: `integrated-contacts-${domain}`, hash};
            const request = domain === 'private'
                ? await prepareProfileContacts({...common, draft: {creates: [{collection: 'contactEmails', id: 'email-new', fields: {label: 'Sintetica', address: 'test@example.invalid'}}]}})
                : await prepareCompanyContacts({...common, source: {domain, companyId: 'synthetic-company'},
                    draft: {creates: [{id: 'company-email-new', fields: {tipo: 'Sintetica', email: 'test@example.invalid', qr: false}}]}});
            const run = (domain === 'private' ? createProfileContactsHandler : createCompanyContactsHandler)({db, hash, timestamp: () => FieldValue.serverTimestamp()});
            const result = await run(request, trusted);
            assert.equal(result.status, 'confirmed');
            assert.deepEqual(await run(request, trusted), result);
            const saved = (await getDoc(doc(owner, path))).data();
            assert.equal(saved.note, before.note);
            if (domain === 'private') {
                assert.deepEqual(saved.userAddresses, before.userAddresses);
                assert.ok(saved.contactEmails.some(item => item.id === 'email-new'));
                await assertFails(updateDoc(doc(owner, path), {contactEmails: []}));
            } else {
                assert.deepEqual(saved.altreSedi, before.altreSedi);
                assert.equal(saved.indirizzoSede, before.indirizzoSede);
                assert.deepEqual(saved.emails.pec, before.emails.pec);
                assert.ok(saved.emails.extra.some(item => item.id === 'company-email-new'));
                await assertFails(updateDoc(doc(owner, path), {emails: {}}));
            }
        }
    });
    await t.test('both QR services save without changing profile and contact data', async () => {
        const hash = value => createHash('sha256').update(value).digest('hex');
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        const profilePath = `users/${uid}`, settingPath = `${profilePath}/settings/qrCodeInclusions`;
        const before = (await getDoc(doc(owner, profilePath))).data();
        const run = createPrivateQrSelectionHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const request = {operationId: 'integrated-qr-private', expectedRevision: 0, expectedOwnerUid: uid,
            selection: {nome: true, cognome: false, cf: false, nascita: false, photo: false, phones: [], emails: ['email-new'], addresses: ['address-home']}};
        const result = await run(request, trusted);
        assert.equal(result.status, 'confirmed');
        assert.deepEqual(await run(request, trusted), result);
        assert.deepEqual((await getDoc(doc(owner, profilePath))).data(), before);
        assert.deepEqual((await getDoc(doc(owner, settingPath))).data().emails, ['email-new']);
        await assertFails(updateDoc(doc(owner, settingPath), {emails: []}));
        const path = `${profilePath}/aziende/synthetic-company`, companyBefore = (await db.doc(path).get()).data();
        const companyRun = createCompanyQrSelectionHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const companyRequest = {companyId: 'synthetic-company', operationId: 'integrated-qr-company', expectedOwnerUid: uid,
            expectedConfig: companyBefore.qrConfig, selection: {...readCompanyQrSelection(companyBefore).selection, ragioneSociale: true}};
        const companyResult = await companyRun(companyRequest, trusted);
        assert.equal(companyResult.status, 'confirmed');
        assert.deepEqual(await companyRun(companyRequest, trusted), companyResult);
        const saved = (await getDoc(doc(owner, path))).data();
        assert.equal(saved.qrConfig.ragioneSociale, true);
        for (const field of ['emails', 'altreSedi', 'note', 'indirizzoSede']) assert.deepEqual(saved[field], companyBefore[field]);
        await assertFails(updateDoc(doc(owner, path), {qrConfig: {}}));
    });
    await t.test('documents service preserves profile data and refuses deletion with attachments', async () => {
        const path = `users/${uid}`, hash = value => createHash('sha256').update(value).digest('hex');
        await db.doc(path).set({documenti: [{id: 'synthetic-document', type: 'Passaporto', num_serie: originalCipher, unknown: 'keep'}]}, {merge: true});
        const before = (await db.doc(path).get()).data();
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {},
            encrypt: async value => Buffer.concat([Buffer.alloc(48, 42), Buffer.from(value)]).toString('base64')};
        const snapshot = new Map([['synthetic-document', {fields: {type: 'Passaporto', num_serie: 'AA'}, forms: {type: 'plain', num_serie: 'cipher'}}]]);
        const run = createPrivateDocumentsHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        const request = await preparePrivateDocuments({context, getUser: () => ({uid}), record: before, snapshot,
            draft: {updates: [{id: 'synthetic-document', fields: {num_serie: 'BB'}}]}, operationId: 'integrated-document-update', hash});
        const result = await run(request, trusted);
        assert.equal(result.status, 'confirmed');
        assert.deepEqual(await run(request, trusted), result);
        const saved = (await getDoc(doc(owner, path))).data();
        assert.equal(saved.note, before.note);
        assert.equal(saved.documenti[0].unknown, 'keep');
        assert.notEqual(saved.documenti[0].num_serie, originalCipher);
        await assertFails(updateDoc(doc(owner, path), {documenti: []}));
        await db.doc(`${path}/profileDocumentAttachments/synthetic-attachment`).set({documentId: 'synthetic-document'});
        const deletion = await preparePrivateDocuments({context, getUser: () => ({uid}), record: saved, snapshot,
            draft: {deletes: [{id: 'synthetic-document'}]}, operationId: 'integrated-document-delete', hash});
        await assert.rejects(run(deletion, trusted), /HAS_ATTACHMENTS/);
        assert.deepEqual((await getDoc(doc(owner, path))).data(), saved);
        assert.equal((await db.doc(`mutationResults/${uid}/operations/profile-documents-integrated-document-delete`).get()).exists, false);
    });
    await t.test('profile links update both sides under the integrated composition', async () => {
        const models = {};
        for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js'])
            Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(
                new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
        const hash = value => createHash('sha256').update(value).digest('hex');
        const run = createProfileLinkHandler({db, models, hash, timestamp: () => FieldValue.serverTimestamp(), deleteField: () => FieldValue.delete()});
        const trusted = {auth: {uid}, app: {appId: 'synthetic-handler-context-not-real-app-check'}};
        const account = {domain: 'company', companyId: 'synthetic-company', id: 'existing'};
        const accountPath = `${roots[1]}/existing`, before = (await db.doc(accountPath).get()).data();
        for (const domain of ['private', 'company']) {
            const path = domain === 'private' ? `users/${uid}` : `users/${uid}/aziende/synthetic-company`;
            const source = domain === 'private' ? {domain, type: 'phone', id: 'mobile'}
                : {domain, companyId: 'synthetic-company', type: 'phone', id: 'telefonoAzienda'};
            await db.doc(path).set(domain === 'private' ? {contactPhones: [{id: 'mobile', number: originalCipher}]}
                : {telefonoAzienda: originalCipher, phoneAccountLinks: {}}, {merge: true});
            const record = (await db.doc(path).get()).data(), selected = readProfileLinkContact(record, source, models);
            const request = {source, account, expectedAccount: selected.account,
                expectedFingerprint: hash(selected.fingerprintInput), expectedRevision: record._profileLinkRevision || 0,
                operationId: `integrated-link-${domain}`, expectedOwnerUid: uid};
            const result = await run(request, trusted);
            assert.equal(result.status, 'confirmed');
            assert.deepEqual(await run(request, trusted), result);
            const linked = readProfileLinkContact((await getDoc(doc(owner, path))).data(), source, models);
            assert.deepEqual(linked.account, account);
        }
        const saved = (await getDoc(doc(owner, accountPath))).data();
        assert.ok(saved.linkedProfileFields.some(item => item.id === 'mobile'));
        assert.ok(saved.linkedCompanyProfileFields.some(item => item.companyId === 'synthetic-company' && item.id === 'telefonoAzienda'));
        for (const field of ['nomeAccount', 'url', 'note']) assert.equal(saved[field], before[field]);
        await assertFails(updateDoc(doc(owner, accountPath), {linkedProfileFields: []}));
        await assertFails(updateDoc(doc(owner, accountPath), {linkedCompanyProfileFields: []}));
        const create = createProfileAccountCreateHandler({db, models, hash, timestamp: () => FieldValue.serverTimestamp(), deleteField: () => FieldValue.delete()});
        for (const domain of ['private', 'company']) {
            const path = domain === 'private' ? `users/${uid}` : `users/${uid}/aziende/synthetic-company`;
            const source = domain === 'private' ? {domain, type: 'email', id: 'email'}
                : {domain, companyId: 'synthetic-company', type: 'email', id: 'pec'};
            await db.doc(path).set(domain === 'private'
                ? {contactEmails: [{id: 'email', address: originalCipher, password: originalCipher}]}
                : {emails: {pec: {email: originalCipher, password: originalCipher}}}, {merge: true});
            const profile = (await db.doc(path).get()).data(), contact = readProfileLinkContact(profile, source, models);
            const request = {source, scope: domain === 'private' ? {domain} : {domain, companyId: 'synthetic-company'},
                name: originalCipher, username: '', password: '', transferLegacyPassword: false, expectedLegacyPassword: '',
                expectedFingerprint: hash(contact.fingerprintInput), expectedRevision: profile._profileLinkRevision || 0,
                operationId: `integrated-create-${domain}`, expectedOwnerUid: uid};
            const result = await create(request, trusted);
            assert.equal(result.status, 'confirmed');
            assert.deepEqual(await create(request, trusted), result);
            const createdPath = `${domain === 'private' ? roots[0] : roots[1]}/${result.account.id}`;
            const created = (await getDoc(doc(owner, createdPath))).data();
            const linked = readProfileLinkContact((await getDoc(doc(owner, path))).data(), source, models);
            assert.deepEqual(linked.account, result.account);
            assert.equal(linked.contact.password || linked.contact.passwordLegacy, originalCipher);
            assert.equal(created.nomeAccount, originalCipher);
            assert.equal(created._profileLinkRevision, 1);
            const backlinks = domain === 'private' ? created.linkedProfileFields : created.linkedCompanyProfileFields;
            assert.ok(backlinks.some(item => item.id === source.id));
            await assertFails(updateDoc(doc(owner, createdPath), {nomeAccount: 'forbidden'}));
        }
    });
});
