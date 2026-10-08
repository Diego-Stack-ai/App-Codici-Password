import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {withIntegratedAccountCandidateRules, unionCandidateDenyLists} from './integrated-account-candidate-rules.mjs';
import {withQrSelectionCandidateRules} from './qr-selection-candidate-rules.mjs';
import {withDocumentAttachmentCandidateRules} from './profile-document-attachment-candidate-rules.mjs';
import {withCompanyQrSelectionCandidateRules as company} from './company-qr-selection-candidate-rules.mjs';
import {withDocumentAttachmentStorageRules as storage} from './profile-document-attachment-storage-rules.mjs';
import {withPrivateDocumentsCandidateRules} from './private-documents-candidate-rules.mjs';
import {withCompanyAddressesCandidateRules} from './company-addresses-candidate-rules.mjs';
import {withAccountStandardCandidateRules} from './account-standard-candidate-rules.mjs';

const firestoreBase = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
const storageBase = await readFile(new URL('../../storage.rules', import.meta.url), 'utf8');

test('browser loader actually composes standard Account protections, not only notes', async () => {
    const loader = await readFile(new URL('./emulator-browser.mjs', import.meta.url), 'utf8');
    assert.match(loader, /import \{withIntegratedAccountCandidateRules\} from '\.\/integrated-account-candidate-rules\.mjs';/);
    const expression = loader.match(/rules: (withDocumentAttachmentCandidateRules\([^\n]+)\},/);
    assert.ok(expression, 'actual Firestore loader expression must remain identifiable');
    const shipped = await runInNewContext(`(async () => ${expression[1]})()`, {
        withDocumentAttachmentCandidateRules, withIntegratedAccountCandidateRules,
        withQrSelectionCandidateRules, base: '/synthetic',
        readFile: async path => {assert.equal(path, '/synthetic/../../firestore.rules'); return firestoreBase;}
    });
    const lists = [...shipped.matchAll(/hasAny\((\["[^\n]+?\])\)/g)].map(match => JSON.parse(match[1]));
    assert.equal(lists.filter(fields => ['nomeAccount', 'username', 'account', 'password', 'url', 'note', 'revision'].every(field => fields.includes(field))).length, 4);
    assert.match(shipped, /profileDocumentAttachments/);
    for (const field of ['_profileDocumentsRevision', '_profileUtilitiesRevision', '_companyAddressesRevision', '_companyContactsRevision'])
        assert.equal(lists.filter(fields => fields.includes(field)).length, 2);
});

test('union fails closed on structural changes and non-negative lists', () => {
    const rules = withIntegratedAccountCandidateRules(firestoreBase);
    assert.equal(unionCandidateDenyLists([rules, rules]), rules);
    assert.throws(() => unionCandidateDenyLists([rules, rules + '\nallow write: if true;']), /RULES_UNION_STRUCTURE/);
    assert.throws(() => unionCandidateDenyLists([rules, rules.replace('!request.resource.data.keys()', 'request.resource.data.keys()')]), /RULES_UNION_CONTEXT/);
    const doubleNegated = rules.replaceAll('!request.resource.data.keys()', '!!request.resource.data.keys()');
    assert.throws(() => unionCandidateDenyLists([doubleNegated, doubleNegated]), /RULES_UNION_CONTEXT/);
    assert.throws(() => unionCandidateDenyLists([rules, rules.replace('"nomeAccount"', '"bad-field"')]), /RULES_UNION_FIELDS/);
    const allowLine = rules.split('\n').find(line => line.includes('allow create:') && line.includes('hasAny(["'));
    assert.ok(allowLine);
    for (const changed of [
        rules.replace(allowLine, allowLine.replace(';', ' || true;')),
        rules.replace(allowLine, '// ' + allowLine),
        rules.replace(allowLine, allowLine.replace('isOwner(userId) &&', 'true ||'))
    ]) assert.throws(() => unionCandidateDenyLists([changed, changed]), /RULES_UNION_CONTEXT/);
    assert.throws(() => unionCandidateDenyLists([rules, rules + '\n' + allowLine + '\n']), /RULES_UNION_COUNT/);
    assert.throws(() => unionCandidateDenyLists([rules, rules + '__CANDIDATE_DENY_0__']), /RULES_UNION_INPUT/);
});

test('each merged position retains every field from each actual branch', () => {
    const base = withQrSelectionCandidateRules(firestoreBase);
    const branches = [withPrivateDocumentsCandidateRules(base), withCompanyAddressesCandidateRules(base), withAccountStandardCandidateRules(base)];
    const extract = rules => [...rules.matchAll(/hasAny\((\["[^\n]+?\])\)/g)].map(match => JSON.parse(match[1]));
    const merged = extract(withIntegratedAccountCandidateRules(base));
    assert.equal(merged.length, 8);
    for (const branch of branches) {
        const fields = extract(branch);
        assert.equal(fields.length, merged.length);
        fields.forEach((list, index) => list.forEach(field => assert.ok(merged[index].includes(field), `${index}:${field}`)));
    }
});
test('company composition replaces the overlapping grant and preserves the hard-delete ban', () => {
    const candidate = company(firestoreBase);
    assert.equal(candidate.split('match /users/{userId}/aziende/{companyId} {').length, 2);
    assert.equal(candidate.split("collection != 'aziende' &&").length, 2);
    assert.doesNotMatch(candidate, /childCollection/);
    assert.match(candidate, /aziende\/\{companyId\} \{\s*allow read: if isOwner\(userId\);\s*allow delete: if false;/);
    assert.throws(() => company(candidate), /RULES_BASE_CHANGED/);
    assert.throws(() => company(firestoreBase.replace('allow read, create, update: if isOwner(userId);', 'allow write: if true;')), /RULES_BASE_CHANGED/);
    assert.throws(() => company(firestoreBase.replace("collection != 'aziende' &&", '')), /RULES_BASE_CHANGED/);
    assert.equal(company(firestoreBase.replaceAll('\r\n', '\n')), candidate);
});
test('Storage composition retains the restore reservation and rejects unexpected base grants', () => {
    const candidate = storage(storageBase);
    assert.match(candidate, /allow read: if isOwner\(userId\) && namespace != 'restoreObjects';/);
    assert.match(candidate, /allow delete: if isOwner\(userId\) && namespace != 'restoreObjects' && namespace != 'profile-documents';/);
    assert.match(candidate, /allow create, update: if isOwner\(userId\) && namespace != 'restoreObjects' && namespace != 'profile-documents' && isAllowedUpload\(\);/);
    assert.throws(() => storage(candidate), /RULES_ALREADY_PATCHED/);
    assert.throws(() => storage(storageBase.replaceAll(" && namespace != 'restoreObjects'", '')), /RULES_BASE_CHANGED/);
    assert.equal(storage(storageBase.replaceAll('\r\n', '\n')), candidate);
});
