import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {functionsEmulatorTargets} from './functions-emulator-targets.mjs';
import {accountNoteBasis} from '../experiments/persistent-vault-shell/account-note-contract.mjs';
import {accountStandardBasis} from '../experiments/persistent-vault-shell/account-standard-contract.mjs';
import {profileLinkFingerprintInput} from '../experiments/persistent-vault-shell/profile-link-contract.mjs';
import {profileTextBasis} from '../experiments/persistent-vault-shell/profile-text-contract.mjs';
import {readCompanyQrSelection} from '../experiments/persistent-vault-shell/company-qr-selection-contract.mjs';
import {privateDocumentBasis} from '../experiments/persistent-vault-shell/private-documents-contract.mjs';
import {privateUtilityBasis} from '../experiments/persistent-vault-shell/private-utilities-contract.mjs';
import {companyAddressBasis} from '../experiments/persistent-vault-shell/company-addresses-contract.mjs';
import {companyContactBasis} from '../experiments/persistent-vault-shell/company-contacts-contract.mjs';

const {project, authBase, functionsBase} = functionsEmulatorTargets(process.env);
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const app = initializeApp({projectId: project}, 'vault-account-http-probe'), db = getFirestore(app);
const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = n => Buffer.alloc(48, n).toString('base64');
// Accepted by the local Functions emulator only. This is NOT real App Check.
const attestation = [Buffer.from('{"alg":"none"}').toString('base64url'),
  Buffer.from(JSON.stringify({sub: project})).toString('base64url'), ''].join('.');
let checks = 0;
async function signup(suffix) {
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({email: `vault-${Date.now()}-${suffix}@example.test`, password: 'Synthetic-Only!2026', returnSecureToken: true})});
  assert.equal(response.status, 200);
  return response.json();
}
async function call(name, data, token, appCheck = attestation) {
  const response = await fetch(`${functionsBase}/${name}`, {method: 'POST', headers: {
    'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {}),
    ...(appCheck ? {'x-firebase-appcheck': appCheck} : {})}, body: JSON.stringify({data})});
  return response.json();
}
function status(value, expected) {
  assert.equal(value.result?.status || value.error?.status, expected, value.error?.details?.reason); checks++;
}
try {
  const owner = await signup('owner'), other = await signup('other'), uid = owner.localId;
  const base = {ownerId: uid, revision: 0, schemaVersion: 1, note: cipher(1), nomeAccount: cipher(2),
    username: cipher(3), account: cipher(4), password: cipher(5), url: '', unknown: {preserved: true},
    linkedProfileFields: [{id: 'phone', type: 'phone'}]};
  await db.doc(`users/${uid}/aziende/firm`).set({ownerId: uid});
  for (const domain of ['private', 'company']) {
    const account = domain === 'private' ? {domain, id: 'same'} : {domain, id: 'same', companyId: 'firm'};
    const path = `users/${uid}/${domain === 'private' ? '' : 'aziende/firm/'}accounts/same`, ref = db.doc(path);
    await ref.set(base);
    const basis = accountNoteBasis(base, uid, account);
    const note = {account, expectedOwnerUid: uid, operationId: `${domain}-note`, expectedRevision: 0,
      expectedFingerprint: hash(basis.value), note: cipher(6)};
    status(await call('applyAccountNoteMutation', note), 'UNAUTHENTICATED');
    assert.ok((await call('applyAccountNoteMutation', note, owner.idToken, null)).error); checks++;
    status(await call('applyAccountNoteMutation', note, other.idToken), 'FAILED_PRECONDITION');
    status(await call('applyAccountNoteMutation', {...note, trusted: {auth: {uid}}}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call('applyAccountNoteMutation', note, owner.idToken), 'confirmed');
    status(await call('applyAccountNoteMutation', note, owner.idToken), 'confirmed');
    status(await call('applyAccountNoteMutation', {...note, note: ''}, owner.idToken), 'FAILED_PRECONDITION');
    const saved = (await ref.get()).data();
    assert.equal(saved.revision, 1); assert.equal(saved.password, base.password);
    assert.deepEqual(saved.linkedProfileFields, base.linkedProfileFields); assert.deepEqual(saved.unknown, base.unknown);
    const standard = {account, expectedOwnerUid: uid, operationId: `${domain}-standard`, expectedRevision: 1,
      expectedFingerprint: hash(accountStandardBasis(saved, uid, account).fingerprintInput), patch: {password: cipher(7)}};
    const rival = {...standard, operationId: `${domain}-rival`, patch: {password: cipher(8)}};
    const results = await Promise.all([standard, rival].map(data => call('applyAccountStandardMutation', data, owner.idToken)));
    assert.equal(results.filter(result => result.result?.status === 'confirmed').length, 1); checks++;
    assert.equal(results.filter(result => result.error?.status === 'FAILED_PRECONDITION').length, 1); checks++;
    const winner = results[0].result ? standard : rival;
    status(await call('applyAccountStandardMutation', winner, owner.idToken), 'confirmed');
    status(await call('applyAccountStandardMutation', {...standard, operationId: `${domain}-stale`}, owner.idToken), 'FAILED_PRECONDITION');
    const latest = (await ref.get()).data();
    assert.equal(latest.revision, 2); assert.equal(latest.password, winner.patch.password);
    assert.equal(latest.note, note.note); assert.deepEqual(latest.unknown, base.unknown);
    await ref.update({isArchived: true});
    status(await call('applyAccountNoteMutation', {...note, operationId: `${domain}-archived`, expectedRevision: 2,
      expectedFingerprint: hash(accountNoteBasis({...latest, isArchived: false}, uid, account).value)}, owner.idToken), 'FAILED_PRECONDITION');
  }
  for (const sourceDomain of ['private', 'company']) {
    const source = sourceDomain === 'private' ? {domain: 'private', type: 'phone', id: 'phone'} :
      {domain: 'company', companyId: 'origin', type: 'phone', id: 'telefonoAzienda'};
    const profileRef = db.doc(sourceDomain === 'private' ? `users/${uid}` : `users/${uid}/aziende/origin`);
    const contact = sourceDomain === 'private' ? {id: 'phone', number: cipher(9)} :
      {id: 'telefonoAzienda', label: 'Telefono azienda', number: cipher(9)};
    await profileRef.set(sourceDomain === 'private' ? {ownerId: uid, contactPhones: [contact], unknown: 'keep'} :
      {ownerId: uid, id: 'origin', telefonoAzienda: contact.number, unknown: 'keep'});
    const target = {domain: 'company', companyId: 'firm', id: `link-${sourceDomain}`};
    const targetRef = db.doc(`users/${uid}/aziende/firm/accounts/${target.id}`);
    await targetRef.set({...base, id: target.id, linkedProfileFields: []});
    const request = {source, account: target, expectedAccount: null, expectedOwnerUid: uid,
      expectedRevision: 0, expectedFingerprint: hash(profileLinkFingerprintInput(contact)), operationId: `link-${sourceDomain}`};
    status(await call('applyProfileLinkMutation', request), 'UNAUTHENTICATED');
    assert.ok((await call('applyProfileLinkMutation', request, owner.idToken, null)).error); checks++;
    status(await call('applyProfileLinkMutation', request, other.idToken), 'FAILED_PRECONDITION');
    status(await call('applyProfileLinkMutation', request, owner.idToken), 'confirmed');
    status(await call('applyProfileLinkMutation', request, owner.idToken), 'confirmed');
    const linked = (await profileRef.get()).data(), linkedTarget = (await targetRef.get()).data();
    assert.equal(linked.unknown, 'keep'); assert.equal(linked._profileLinkRevision, 1);
    assert.equal(linkedTarget.password, base.password);
    const backrefs = sourceDomain === 'private' ? linkedTarget.linkedProfileFields : linkedTarget.linkedCompanyProfileFields;
    assert.deepEqual(backrefs, [{...(sourceDomain === 'company' ? {companyId: 'origin'} : {}), type: 'phone', id: source.id}]);
    const linkedContact = sourceDomain === 'private' ? linked.contactPhones[0] : {...contact, ...linked.phoneAccountLinks.telefonoAzienda};
    const unlink = {...request, account: null, expectedAccount: target, expectedRevision: 1,
      expectedFingerprint: hash(profileLinkFingerprintInput(linkedContact)), operationId: `unlink-${sourceDomain}`};
    status(await call('applyProfileLinkMutation', {...unlink, operationId: request.operationId}, owner.idToken), 'FAILED_PRECONDITION');
    const rivals = await Promise.all([unlink, {...unlink, operationId: `${unlink.operationId}-rival`}]
      .map(data => call('applyProfileLinkMutation', data, owner.idToken)));
    assert.equal(rivals.filter(result => result.result?.status === 'confirmed').length, 1); checks++;
    assert.equal(rivals.filter(result => result.error?.status === 'FAILED_PRECONDITION').length, 1); checks++;
    const after = (await targetRef.get()).data();
    assert.deepEqual(sourceDomain === 'private' ? after.linkedProfileFields : after.linkedCompanyProfileFields, []);
    assert.equal(Object.hasOwn(after, sourceDomain === 'private' ? 'linkedProfileField' : 'linkedCompanyProfileField'), false);
    assert.equal(after.password, base.password);
    assert.equal((await profileRef.get()).data()._profileLinkRevision, 2);
  }
  for (const variant of ['email', 'utility', 'company-slot', 'company-fallback']) {
    const company = variant.startsWith('company'), utility = variant === 'utility';
    const source = company ? {domain: 'company', companyId: 'origin', type: 'email', id: 'pec'} :
      {domain: 'private', type: variant, id: 'contact', ...(utility ? {parentAddressId: 'address'} : {})};
    const raw = utility ? {id: 'contact', value: cipher(10), passwordLegacy: cipher(11), extra: 'keep'} :
      {id: 'contact', address: cipher(10), password: cipher(11), extra: 'keep'};
    const companyProfile = variant === 'company-fallback' ? {aziendaEmail: cipher(10), aziendaEmailPassword: cipher(11)} :
      {emails: {pec: {email: cipher(10), password: cipher(11), extra: 'keep'}}};
    const profile = company ? {ownerId: uid, id: 'origin', ...companyProfile} :
      {ownerId: uid, ...(utility ? {userAddresses: [{id: 'address', utilities: [raw]}]} : {contactEmails: [raw]})};
    const contact = company ? {...(profile.emails?.pec || {}), id: 'pec', label: 'pec', address: cipher(10),
      password: cipher(11), sourceSlot: 'pec'} : raw;
    const ref = db.doc(company ? `users/${uid}/aziende/origin` : `users/${uid}`);
    await ref.set(profile);
    const request = {source, scope: company ? {domain: 'company', companyId: 'firm'} : {domain: 'private'},
      name: cipher(12), username: cipher(13), password: cipher(11), transferLegacyPassword: true,
      expectedLegacyPassword: cipher(11), expectedFingerprint: hash(profileLinkFingerprintInput(contact)),
      expectedRevision: 0, expectedOwnerUid: uid, operationId: `create-${variant}`};
    status(await call('applyProfileAccountCreate', request), 'UNAUTHENTICATED');
    assert.ok((await call('applyProfileAccountCreate', request, owner.idToken, null)).error); checks++;
    status(await call('applyProfileAccountCreate', request, other.idToken), 'FAILED_PRECONDITION');
    status(await call('applyProfileAccountCreate', {...request, name: 'plaintext'}, owner.idToken), 'FAILED_PRECONDITION');
    const created = await call('applyProfileAccountCreate', request, owner.idToken);
    status(created, 'confirmed');
    status(await call('applyProfileAccountCreate', request, owner.idToken), 'confirmed');
    status(await call('applyProfileAccountCreate', {...request, operationId: `${request.operationId}-rival`}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call('applyProfileAccountCreate', {...request, username: cipher(14)}, owner.idToken), 'FAILED_PRECONDITION');
    const account = created.result.account, after = (await ref.get()).data();
    const stored = (await db.doc(`users/${uid}/${company ? 'aziende/firm/' : ''}accounts/${account.id}`).get()).data();
    assert.equal(stored.password, cipher(11)); assert.equal(stored.ownerId, uid);
    const linked = company ? after.emails.pec : utility ? after.userAddresses[0].utilities[0] : after.contactEmails[0];
    assert.equal(linked.linkedAccountId, account.id);
    assert.equal(Object.hasOwn(linked, utility ? 'passwordLegacy' : 'password'), false);
    if (variant === 'company-fallback') assert.equal(Object.hasOwn(after, 'aziendaEmailPassword'), false);
    else assert.equal(linked.extra, 'keep');
    const receipt = (await db.doc(`mutationResults/${uid}/operations/profile-account-create-${request.operationId}`).get()).data();
    assert.equal(JSON.stringify(receipt).includes(cipher(11)), false);
  }
  for (const domain of ['private', 'company']) {
    const target = domain === 'private' ? {domain} : {domain, companyId: 'text-company'};
    const suffix = domain === 'private' ? '' : '/aziende/text-company';
    const ref = db.doc(`users/${uid}${suffix}`), foreign = db.doc(`users/${other.localId}${suffix}`);
    const profile = {note: cipher(15), unknown: 'keep'};
    await ref.set({...profile, ownerId: uid}); await foreign.set({...profile, ownerId: other.localId});
    const request = {target, changes: {note: cipher(16)}, expected: {note: hash(profileTextBasis(profile, 'note'))},
      expectedOwnerUid: uid, expectedRevision: 0, operationId: `text-${domain}`};
    status(await call('applyProfileTextMutation', request), 'UNAUTHENTICATED');
    assert.ok((await call('applyProfileTextMutation', request, owner.idToken, null)).error); checks++;
    status(await call('applyProfileTextMutation', request, other.idToken), 'FAILED_PRECONDITION');
    assert.equal((await foreign.get()).data().note, profile.note);
    status(await call('applyProfileTextMutation', {...request, changes: {note: 'plaintext'}}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call('applyProfileTextMutation', request, owner.idToken), 'confirmed');
    status(await call('applyProfileTextMutation', request, owner.idToken), 'confirmed');
    status(await call('applyProfileTextMutation', {...request, operationId: `${request.operationId}-stale`}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call('applyProfileTextMutation', {...request, changes: {note: cipher(17)}}, owner.idToken), 'FAILED_PRECONDITION');
    const after = (await ref.get()).data();
    assert.equal(after.note, cipher(16)); assert.equal(after.unknown, 'keep'); assert.equal(after._profileTextRevision, 1);
    if (domain === 'company') {
      await ref.update({id: 'wrong-company'});
      status(await call('applyProfileTextMutation', {...request, expectedRevision: 1, operationId: 'text-alias',
        expected: {note: hash(profileTextBasis(after, 'note'))}}, owner.idToken), 'FAILED_PRECONDITION');
    }
  }
  for (const company of [false, true]) {
    const name = company ? 'applyCompanyQrSelection' : 'applyPrivateQrSelection';
    const ref = db.doc(company ? `users/${uid}/aziende/qr-company` : `users/${uid}`);
    await ref.set({ownerId: uid, unknown: 'keep'});
    const settingRef = company ? ref : db.doc(`users/${uid}/settings/qrCodeInclusions`);
    const selection = company ? {...readCompanyQrSelection({}).selection, ragioneSociale: true} :
      {nome: true, cognome: false, cf: false, nascita: false, photo: false, phones: [], emails: [], addresses: []};
    const request = {operationId: company ? 'qr-company' : 'qr-private', expectedOwnerUid: uid, selection,
      ...(company ? {companyId: 'qr-company', expectedConfig: null} : {expectedRevision: 0})};
    status(await call(name, request), 'UNAUTHENTICATED');
    assert.ok((await call(name, request, owner.idToken, null)).error); checks++;
    status(await call(name, request, other.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, uid: other.localId}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, {...request, operationId: `${request.operationId}-stale`}, owner.idToken), 'FAILED_PRECONDITION');
    const changed = {...selection, [company ? 'ragioneSociale' : 'nome']: false};
    status(await call(name, {...request, selection: changed}, owner.idToken), 'FAILED_PRECONDITION');
    const saved = (await settingRef.get()).data();
    const basis = company ? {expectedConfig: saved.qrConfig} : {expectedRevision: saved._qrRevision};
    const results = await Promise.all(['a', 'b'].map(id => call(name, {...request, ...basis,
      selection: changed, operationId: `${request.operationId}-${id}`}, owner.idToken)));
    assert.equal(results.filter(result => result.result?.status === 'confirmed').length, 1); checks++;
    assert.equal(results.filter(result => result.error?.status === 'FAILED_PRECONDITION').length, 1); checks++;
    assert.equal((await ref.get()).data().unknown, 'keep');
    const after = (await settingRef.get()).data();
    assert.equal(company ? after.qrConfig._qrRevision : after._qrRevision, 2);
  }
  {
    const name = 'applyPrivateDocumentsMutation', ref = db.doc(`users/${uid}`);
    const original = {id: 'document-linked', type: 'Tessera', linkedAccountId: 'same', extra: 'keep'};
    await ref.set({ownerId: uid, documenti: [original], unknown: 'keep'});
    const request = {target: {domain: 'private'}, expectedOwnerUid: uid, expectedRevision: 0, operationId: 'documents-create',
      operations: [{kind: 'create', id: 'document-new', fields: {type: 'Passaporto', num_serie: cipher(18)}}]};
    status(await call(name, request), 'UNAUTHENTICATED');
    assert.ok((await call(name, request, owner.idToken, null)).error); checks++;
    status(await call(name, request, other.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, operations: [...request.operations, ...request.operations]}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, operations: [{...request.operations[0], extra: true}]}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, request, owner.idToken), 'confirmed');
    const after = (await ref.get()).data();
    assert.deepEqual(after.documenti[0], original); assert.equal(after.unknown, 'keep');
    const remove = {...request, expectedRevision: 1, operationId: 'documents-linked-delete',
      operations: [{kind: 'delete', id: original.id, basis: hash(privateDocumentBasis(original))}]};
    status(await call(name, remove, owner.idToken), 'FAILED_PRECONDITION');
    const created = after.documenti.find(item => item.id === 'document-new');
    const attachmentRef = db.doc(`users/${uid}/profileDocumentAttachments/synthetic`);
    await attachmentRef.set({documentId: created.id});
    const deleteNew = {...remove, operationId: 'documents-delete-new',
      operations: [{kind: 'delete', id: created.id, basis: hash(privateDocumentBasis(created))}]};
    status(await call(name, deleteNew, owner.idToken), 'FAILED_PRECONDITION');
    assert.equal((await ref.get()).data().documenti.length, 2);
    await attachmentRef.delete();
    status(await call(name, deleteNew, owner.idToken), 'confirmed');
    status(await call(name, deleteNew, owner.idToken), 'confirmed');
    assert.deepEqual((await ref.get()).data().documenti, [original]);
  }
  {
    const name = 'applyPrivateUtilitiesMutation', ref = db.doc(`users/${uid}`);
    const utility = {id: 'utility-edit', type: 'Energia', value: cipher(19), extra: 'keep'};
    const linked = {id: 'utility-linked', type: 'Gas', value: cipher(20), linkedAccountId: 'same'};
    const otherAddress = {id: 'other-address', label: 'keep', utilities: [{...utility, value: cipher(21)}]};
    await ref.set({ownerId: uid, unknown: 'keep', userAddresses: [
      {id: 'address', label: 'Casa', unknown: 'keep', utilities: [utility, linked]}, otherAddress]});
    const request = {target: {domain: 'private'}, parentAddressId: 'address', expectedOwnerUid: uid,
      expectedRevision: 0, operationId: 'utilities-update', operations: [
        {kind: 'update', id: utility.id, basis: hash(privateUtilityBasis(utility)), fields: {value: cipher(22)}}]};
    status(await call(name, request), 'UNAUTHENTICATED');
    assert.ok((await call(name, request, owner.idToken, null)).error); checks++;
    status(await call(name, request, other.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, parentAddressId: ''}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, parentAddressId: 'missing'}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, {...request, operationId: 'utilities-stale'}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, expectedRevision: 1, operationId: 'utilities-linked-delete',
      operations: [{kind: 'delete', id: linked.id, basis: hash(privateUtilityBasis(linked))}]}, owner.idToken), 'FAILED_PRECONDITION');
    const saved = (await ref.get()).data();
    assert.equal(saved._profileUtilitiesRevision, 1); assert.equal(saved.unknown, 'keep');
    assert.deepEqual(saved.userAddresses[1], otherAddress);
    assert.deepEqual(saved.userAddresses[0], {id: 'address', label: 'Casa', unknown: 'keep',
      utilities: [{...utility, value: cipher(22)}, linked]});
  }
  {
    const name = 'applyProfileContactsMutation', ref = db.doc(`users/${uid}`);
    const original = {id: 'email-existing', address: 'synthetic@example.invalid', extra: 'keep'};
    await ref.set({ownerId: uid, contactEmails: [original], unknown: 'keep'});
    const request = {target: {domain: 'private'}, expectedOwnerUid: uid, expectedRevision: 0,
      operationId: 'contacts-create', operations: [{kind: 'create', collection: 'contactPhones',
        id: 'phone-new', fields: {label: 'Prova', number: '123'}}]};
    status(await call(name, request), 'UNAUTHENTICATED');
    assert.ok((await call(name, request, owner.idToken, null)).error); checks++;
    status(await call(name, request, other.idToken), 'FAILED_PRECONDITION');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, {...request, operationId: 'contacts-stale'}, owner.idToken), 'FAILED_PRECONDITION');
    const saved = (await ref.get()).data();
    assert.deepEqual(saved.contactEmails, [original]); assert.equal(saved.unknown, 'keep');
    assert.deepEqual(saved.contactPhones, [{id: 'phone-new', label: 'Prova', number: '123', isPrimary: false}]);
    assert.equal(saved._profileContactsRevision, 1);
  }
  for (const [name, target, operation, field, revisionField] of [
    ['applyPrivateAddressesMutation', {domain: 'private'},
      {kind: 'create', id: 'address-new', fields: {city: 'Prova'}}, 'userAddresses', '_profileAddressesRevision'],
    ['applyCompanyAddressesMutation', {domain: 'company', companyId: 'address-company'},
      {kind: 'address-create', id: 'sede-new', fields: {citta: 'Prova'}}, 'altreSedi', '_companyAddressesRevision'],
    ['applyCompanyContactsMutation', {domain: 'company', companyId: 'contacts-company'},
      {kind: 'email-extra-create', id: 'company-email-new', fields: {email: 'test@example.invalid'}}, 'emails', '_companyContactsRevision']
  ]) {
    const suffix = target.domain === 'private' ? '' : `/aziende/${target.companyId}`;
    const ref = db.doc(`users/${uid}${suffix}`), otherRef = db.doc(`users/${other.localId}${suffix}`);
    await ref.set({ownerId: uid, unknown: 'keep'});
    await otherRef.set({ownerId: other.localId, unknown: 'other-keep'});
    const request = {target, expectedOwnerUid: uid, expectedRevision: 0,
      operationId: `test-${name}`, operations: [operation]};
    status(await call(name, request), 'UNAUTHENTICATED');
    assert.ok((await call(name, request, owner.idToken, null)).error); checks++;
    status(await call(name, request, other.idToken), 'FAILED_PRECONDITION');
    status(await call(name, {...request, expectedOwnerUid: undefined}, owner.idToken), 'FAILED_PRECONDITION');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, request, owner.idToken), 'confirmed');
    status(await call(name, {...request, operationId: `${request.operationId}-stale`}, owner.idToken), 'FAILED_PRECONDITION');
    const saved = (await ref.get()).data();
    assert.equal(saved.unknown, 'keep'); assert.equal(saved[revisionField], 1);
    const rows = field === 'emails' ? saved.emails.extra : saved[field];
    assert.equal(rows.length, 1); assert.equal(rows[0].id, operation.id);
    assert.deepEqual((await otherRef.get()).data(), {ownerId: other.localId, unknown: 'other-keep'});
  }
  for (const [name, kind, basis, prefix] of [
    ['applyCompanyAddressesMutation', 'address-delete', companyAddressBasis, 'sede'],
    ['applyCompanyContactsMutation', 'email-extra-delete', companyContactBasis, 'company-email']
  ]) {
    const rows = [{id: `${prefix}-first`, qr: false}, {id: `${prefix}-protected`, qr: true}];
    const record = {ownerId: uid, ...(prefix === 'sede' ? {altreSedi: rows} : {emails: {extra: rows}})};
    const ref = db.doc(`users/${uid}/aziende/multi-delete`);
    await ref.set(record);
    const request = {target: {domain: 'company', companyId: 'multi-delete'}, expectedOwnerUid: uid,
      expectedRevision: 0, operationId: `multi-${prefix}`, operations: rows.map(item => ({kind, id: item.id, basis: hash(basis(item))}))};
    status(await call(name, request, owner.idToken), 'FAILED_PRECONDITION');
    assert.deepEqual((await ref.get()).data(), record);
  }
  console.log(`Vault Account e profilo: ${checks} controlli HTTP superati con Auth/Firestore/Functions locali; App Check reale non attestato.`);
} finally { await db.terminate(); await deleteApp(app); }
