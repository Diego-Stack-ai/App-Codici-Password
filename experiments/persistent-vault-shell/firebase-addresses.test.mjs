import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField} from 'firebase/firestore';
import {withPrivateAddressesCandidateRules} from './private-addresses-candidate-rules.mjs';
import {withCompanyAddressesCandidateRules} from './company-addresses-candidate-rules.mjs';
import {preparePrivateAddresses} from './prepare-private-addresses.mjs';
import {createPrivateAddressesHandler} from './private-addresses-handler.mjs';
import {prepareCompanyAddresses} from './prepare-company-addresses.mjs';
import {createCompanyAddressesHandler} from './company-addresses-handler.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');
const context = uid => ({user: {uid}, signal: new AbortController().signal, assertUnlocked() {}});
const firestoreRules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
async function environment(name, patch) {
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell',
        firestore: {host: '127.0.0.1', port: 8085, rules: patch(firestoreRules)}});
    const app = initializeApp({projectId: 'demo-vault-shell'}, name), db = getFirestore(app);
    return {env, db, dispose: async () => {await db.terminate(); await deleteApp(app); await env.cleanup();}};
}
test('private addresses candidate rules and transactions on synthetic emulator records', async t => {
    const {env, db, dispose} = await environment('private-addresses-test', withPrivateAddressesCandidateRules);
    t.after(dispose);
    const uid = 'addresses-owner', path = `users/${uid}`, selectionPath = `users/${uid}/settings/qrCodeInclusions`;
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    const run = createPrivateAddressesHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const snapshot = record => new Map((record.userAddresses ?? []).filter(item => typeof item.id === 'string')
        .map(item => [item.id, {fields: {type: item.type, address: item.address, civic: item.civic, cap: item.cap,
            city: item.city, province: item.province, isPrimary: item.isPrimary === true}}]));
    const prepare = async (draft, operationId) => {
        const record = (await db.doc(path).get()).data();
        return preparePrivateAddresses({context: context(uid), getUser: () => ({uid}), record,
            snapshot: snapshot(record), draft, operationId, hash});
    };
    await db.doc(path).set({ownerId: uid, nome: 'Nome fittizio', unrelated: 'keep', _profileAddressesRevision: 1,
        userAddresses: [
            {id: 'address-home', type: 'Residenza', address: 'Via fittizia 1', isPrimary: true, campoIgnoto: 'da conservare',
                utilities: [{id: 'utility-gas', type: 'Contatore Metano', value: 'cipher:POD'}]},
            {id: 'address-office', type: 'Ufficio', address: 'Via ufficio 2', utilities: [{id: 'utility-light', value: 'cipher:POD2',
                linkedAccountId: 'synthetic', linkedAccountCompanyId: 'company'}]},
            {id: 'address-free', type: 'Altro', address: 'Via libera 5'},
            {id: 'address-legacy-1a2b', type: 'Altro', address: 'Via legacy 3'}]});
    await db.doc(selectionPath).set({nome: true, emails: [], phones: [], addresses: ['address-free']});
    await assertSucceeds(getDoc(doc(owner, path))); await assertFails(getDoc(doc(other, path)));
    await assertFails(updateDoc(doc(owner, path), {userAddresses: []}));
    await assertFails(updateDoc(doc(owner, path), {userAddresses: deleteField()}));
    await assertFails(updateDoc(doc(owner, path), {_profileAddressesRevision: 99}));
    await assertFails(updateDoc(doc(owner, path), {_profileAddressesUpdatedAt: 1}));
    await assertFails(deleteDoc(doc(owner, path)));
    await assertSucceeds(updateDoc(doc(owner, path), {unrelated: 'changed'}));
    const request = await prepare({creates: [{id: 'address-new', fields: {type: 'Ufficio', address: 'Via nuova 9', isPrimary: true}}],
        updates: [{id: 'address-home', fields: {city: 'Roma'}}]}, 'primo');
    assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
    const saved = (await db.doc(path).get()).data();
    assert.equal(saved._profileAddressesRevision, 2);
    assert.equal(saved.unrelated, 'changed');
    assert.ok(saved._profileAddressesUpdatedAt.toMillis() > 0);
    assert.equal(saved.userAddresses[0].isPrimary, false, 'the new primary address clears the previous one');
    assert.deepEqual(saved.userAddresses[0].utilities, [{id: 'utility-gas', type: 'Contatore Metano', value: 'cipher:POD'}],
        'the nested utilities survive byte for byte');
    assert.equal(saved.userAddresses[0].campoIgnoto, 'da conservare');
    assert.equal(saved.userAddresses.find(item => item.id === 'address-new').isPrimary, true);
    await assertFails(setDoc(doc(owner, `mutationResults/${uid}/operations/profile-addresses-primo`), {revision: 100}));
    const reused = await prepare({updates: [{id: 'address-office', fields: {city: 'Monza'}}]}, 'primo');
    await assert.rejects(run(reused, trusted), /OPERATION_CONFLICT/);
    await assert.rejects(run(await prepare({deletes: [{id: 'address-free'}]}, 'selected'), trusted), /PROFILE_ADDRESS_QR_SELECTED/);
    await assert.rejects(() => prepare({deletes: [{id: 'address-office'}]}, 'linked'), /PROFILE_ADDRESS_UTILITIES_PRESENT/);
    await assert.rejects(() => prepare({deletes: [{id: 'address-legacy-1a2b'}]}, 'derived'), /PROFILE_ADDRESSES_INVALID|ADDRESS_ID_DERIVED/);
    const stale = await prepare({updates: [{id: 'address-office', fields: {city: 'Torino'}}]}, 'stale');
    const current = (await db.doc(path).get()).data();
    await db.doc(path).update({userAddresses: current.userAddresses.map(item => item.id === 'address-office'
        ? {...item, address: 'cambiata'} : item)});
    await assert.rejects(run(stale, trusted), /ADDRESSES_CONFLICT/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/profile-addresses-stale`).get()).exists, false);
    const race = await Promise.all([
        prepare({updates: [{id: 'address-home', fields: {city: 'Uno'}}]}, 'race-a'),
        prepare({updates: [{id: 'address-home', fields: {city: 'Due'}}]}, 'race-b')]);
    const results = await Promise.allSettled(race.map(value => run(value, trusted)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.doc(path).get()).data()._profileAddressesRevision, 3);
    // An unverifiable selection refuses the deletion without touching anything.
    await db.doc(selectionPath).set({addresses: 'address-free'});
    const before = (await db.doc(path).get()).data();
    await assert.rejects(run(await prepare({deletes: [{id: 'address-free'}]}, 'unverifiable'), trusted), /ADDRESSES_QR_UNVERIFIABLE/);
    assert.deepEqual((await db.doc(path).get()).data(), before);
});
test('company addresses candidate rules and transactions on synthetic emulator records', async t => {
    const {env, db, dispose} = await environment('company-addresses-test', withCompanyAddressesCandidateRules);
    t.after(dispose);
    const uid = 'company-addresses-owner', path = `users/${uid}/aziende/company`;
    const owner = env.authenticatedContext(uid).firestore(), other = env.authenticatedContext('other').firestore();
    const run = createCompanyAddressesHandler({db, hash, timestamp: () => FieldValue.serverTimestamp()});
    const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
    const source = {domain: 'company', companyId: 'company', async read() {return (await db.doc(path).get()).data();}};
    const snapshot = record => new Map((record.altreSedi ?? []).filter(item => typeof item.id === 'string')
        .map(item => [item.id, {fields: {tipo: item.tipo, indirizzo: item.indirizzo, civico: item.civico, cap: item.cap,
            citta: item.citta, provincia: item.provincia, qr: item.qr === true}}]));
    const prepare = async (draft, operationId) => {
        const record = (await db.doc(path).get()).data();
        return prepareCompanyAddresses({context: context(uid), getUser: () => ({uid}), source, record,
            snapshot: snapshot(record), draft, operationId, hash});
    };
    await db.doc(path).set({ownerId: uid, id: 'company', ragioneSociale: 'Azienda fittizia', unrelated: 'keep',
        tipoSedeLegale: 'Sede Legale', indirizzoSede: 'Via sede 1', civicoSede: '1', capSede: '00100', cittaSede: 'Roma',
        provinciaSede: 'RM', emails: {pec: {email: 'pec@example.invalid'}}, qrConfig: {qrLegale: true},
        altreSedi: [{id: 'sede-filiale', tipo: 'Filiale', indirizzo: 'Via filiale 2', qr: false, campoIgnotoRiga: 'da conservare'},
            {id: 'sede-deposito', tipo: 'Deposito', indirizzo: 'Via deposito 7', qr: false},
            {id: 'sede-pubblicata', tipo: 'Showroom', indirizzo: 'Via vetrina 5', qr: true},
            {id: 'sede-2', tipo: 'Magazzino', indirizzo: 'Via indice 3'}],
        _companyAddressesRevision: 1});
    await assertSucceeds(getDoc(doc(owner, path))); await assertFails(getDoc(doc(other, path)));
    await assertFails(updateDoc(doc(owner, path), {altreSedi: []}));
    await assertFails(updateDoc(doc(owner, path), {indirizzoSede: 'forged'}));
    await assertFails(updateDoc(doc(owner, path), {cittaSede: 'forged'}));
    await assertFails(updateDoc(doc(owner, path), {_companyAddressesRevision: 99}));
    await assertFails(deleteDoc(doc(owner, path)));
    await assertSucceeds(updateDoc(doc(owner, path), {unrelated: 'changed'}));
    const request = await prepare({seat: {fields: {indirizzoSede: 'Via sede 1 bis'}},
        creates: [{id: 'sede-nuova', fields: {tipo: 'Deposito', indirizzo: 'Via deposito 6', qr: true}}],
        updates: [{id: 'sede-filiale', fields: {citta: 'Monza'}}],
        deletes: [{id: 'sede-deposito'}]}, 'primo');
    assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
    assert.deepEqual(await run(request, trusted), {status: 'confirmed', revision: 2});
    const saved = (await db.doc(path).get()).data();
    assert.equal(saved._companyAddressesRevision, 2);
    assert.equal(saved.unrelated, 'changed');
    assert.equal(saved.indirizzoSede, 'Via sede 1 bis');
    assert.equal(saved.civicoSede, '1', 'the untouched seat fields stay');
    assert.deepEqual(saved.emails, {pec: {email: 'pec@example.invalid'}}, 'the company contacts are untouched');
    assert.deepEqual(saved.qrConfig, {qrLegale: true});
    assert.equal(saved.altreSedi.find(item => item.id === 'sede-filiale').campoIgnotoRiga, 'da conservare');
    assert.equal(saved.altreSedi.find(item => item.id === 'sede-nuova').qr, true);
    assert.equal(saved.altreSedi.some(item => item.id === 'sede-deposito'), false);
    await assertFails(setDoc(doc(owner, `mutationResults/${uid}/operations/company-addresses-primo`), {revision: 100}));
    await assert.rejects(run(await prepare({updates: [{id: 'sede-filiale', fields: {citta: 'Pisa'}}]}, 'primo'), trusted), /OPERATION_CONFLICT/);
    await assert.rejects(() => prepare({deletes: [{id: 'sede-pubblicata'}]}, 'published'), /COMPANY_ADDRESS_QR_SELECTED/);
    await assert.rejects(() => prepare({deletes: [{id: 'sede-2'}]}, 'derived'), /COMPANY_ADDRESS_ID_DERIVED|COMPANY_ADDRESSES_INVALID/);
    const stale = await prepare({updates: [{id: 'sede-filiale', fields: {citta: 'Bari'}}]}, 'stale');
    const current = (await db.doc(path).get()).data();
    await db.doc(path).update({altreSedi: current.altreSedi.map(item => item.id === 'sede-filiale' ? {...item, indirizzo: 'cambiata'} : item)});
    await assert.rejects(run(stale, trusted), /COMPANY_ADDRESSES_CONFLICT/);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/company-addresses-stale`).get()).exists, false);
    const race = await Promise.all([
        prepare({seat: {fields: {cittaSede: 'Uno'}}}, 'race-a'),
        prepare({seat: {fields: {cittaSede: 'Due'}}}, 'race-b')]);
    const results = await Promise.allSettled(race.map(value => run(value, trusted)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await db.doc(path).get()).data()._companyAddressesRevision, 3);
    await db.doc(path).update({qrConfig: {qrLegale: 'si'}});
    const before = (await db.doc(path).get()).data();
    // The company preparation resolves the card selection from the same document,
    // so it refuses the deletion before a request exists; the private one resolves it
    // from a separate settings document in the source and the service is the authority.
    await assert.rejects(() => prepare({deletes: [{id: 'sede-filiale'}]}, 'unverifiable'), /COMPANY_ADDRESSES_QR_UNVERIFIABLE/);
    assert.deepEqual((await db.doc(path).get()).data(), before);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/company-addresses-unverifiable`).get()).exists, false);
});
