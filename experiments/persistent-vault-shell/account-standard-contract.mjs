import {profileLinkAccount, assertProfileLinkAccount, profileLinkFingerprintInput} from './profile-link-contract.mjs';
import {profileTextId, profileTextHash, profileTextCipher} from './profile-text-contract.mjs';

export const ACCOUNT_STANDARD_FIELDS = Object.freeze(['nomeAccount', 'username', 'account', 'password', 'url']);
const encryptedFields = new Set(ACCOUNT_STANDARD_FIELDS.slice(0, 4));
const fail = code => { throw Error(code); };
const object = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const validUrl = value => typeof value === 'string' && value.length <= 4096 && (!value || (() => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } })());

export function accountStandardBasis(record, uid, selection) {
    assertProfileLinkAccount(record, uid, selection, {destination: true});
    for (const field of ['linkedProfileFields', 'linkedCompanyProfileFields']) if (Object.hasOwn(record, field) &&
        (!Array.isArray(record[field]) || record[field].some(link => !object(link) || typeof link.id !== 'string' || !link.id ||
            typeof link.type !== 'string' || !link.type || (field === 'linkedCompanyProfileFields' && (typeof link.companyId !== 'string' || !link.companyId)))))
        fail('ACCOUNT_STANDARD_RELATION_INVALID');
    const revision = Object.hasOwn(record, 'revision') ? record.revision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, 'schemaVersion') && record.schemaVersion !== 1)) fail('ACCOUNT_STANDARD_INVALID');
    const values = Object.fromEntries(ACCOUNT_STANDARD_FIELDS.map(field => [field, record[field] ?? '']));
    if (!ACCOUNT_STANDARD_FIELDS.slice(0, 4).every(field => profileTextCipher(values[field])) || !validUrl(values.url)) fail('ACCOUNT_STANDARD_INVALID');
    return Object.freeze({revision, fingerprintInput: profileLinkFingerprintInput(values), values: Object.freeze(values)});
}

export function validateAccountStandardRequest(value) {
    const keys = ['account', 'patch', 'expectedFingerprint', 'expectedRevision', 'operationId', 'expectedOwnerUid'];
    if (!exact(value, keys) || !profileTextId(value.operationId) || !profileTextId(value.expectedOwnerUid) ||
        !profileTextHash(value.expectedFingerprint) || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 ||
        value.expectedRevision >= Number.MAX_SAFE_INTEGER || !object(value.patch) || Object.keys(value.patch).length === 0 ||
        Object.keys(value.patch).some(field => !ACCOUNT_STANDARD_FIELDS.includes(field)) ||
        Object.entries(value.patch).some(([field, item]) => encryptedFields.has(field) ? !profileTextCipher(item) : !validUrl(item))) fail('ACCOUNT_STANDARD_REQUEST_INVALID');
    return Object.freeze({account: profileLinkAccount(value.account), patch: Object.freeze({...value.patch}), expectedFingerprint: value.expectedFingerprint,
        expectedRevision: value.expectedRevision, operationId: value.operationId, expectedOwnerUid: value.expectedOwnerUid});
}

export async function prepareAccountStandard({context, getUser, source, account, changes, operationId, hash}) {
    const uid = context.user?.uid, selection = profileLinkAccount(account);
    const check = () => { if (!uid || context.signal.aborted || getUser()?.uid !== uid) fail('VIEW_DISPOSED'); context.assertUnlocked(); };
    check(); const basis = accountStandardBasis(source, uid, selection);
    if (!object(changes) || Object.keys(changes).length === 0 || Object.keys(changes).some(field => !ACCOUNT_STANDARD_FIELDS.includes(field)) ||
        Object.values(changes).some(value => typeof value !== 'string') || Object.values(changes).some(value => value.length > 20000) ||
        (Object.hasOwn(changes, 'url') && !validUrl(changes.url))) fail('ACCOUNT_STANDARD_CHANGES_INVALID');
    const patch = {};
    for (const [field, value] of Object.entries({...changes})) {
        check(); patch[field] = encryptedFields.has(field) ? (value === '' ? '' : await context.encrypt(value)) : value; check();
        if (encryptedFields.has(field) && !profileTextCipher(patch[field])) fail('ACCOUNT_STANDARD_ENCRYPTION_FAILED');
    }
    return validateAccountStandardRequest({account: selection, patch, expectedFingerprint: await hash(basis.fingerprintInput),
        expectedRevision: basis.revision, operationId, expectedOwnerUid: uid});
}
