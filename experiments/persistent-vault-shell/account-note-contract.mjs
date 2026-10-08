import {profileLinkAccount, assertProfileLinkAccount} from './profile-link-contract.mjs';
import {profileTextObject, profileTextId, profileTextHash, profileTextCipher, profileTextBasis} from './profile-text-contract.mjs';
const fail = () => {throw Error('ACCOUNT_NOTE_INVALID');};
export function accountNoteRevision(record) {
    if (!profileTextObject(record)) fail();
    const revision = Object.hasOwn(record, 'revision') ? record.revision : 0;
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
        (Object.hasOwn(record, 'schemaVersion') && record.schemaVersion !== 1)) fail();
    return revision;
}
export function accountNoteBasis(record, uid, selection) {
    if (!selection) fail();
    assertProfileLinkAccount(record, uid, selection, {destination: true});
    return Object.freeze({revision: accountNoteRevision(record), value: profileTextBasis(record, 'note')});
}
export function validateAccountNoteRequest(value) {
    const fields = ['account', 'note', 'expectedFingerprint', 'expectedRevision', 'operationId', 'expectedOwnerUid'];
    if (!profileTextObject(value) || Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key)) ||
        !profileTextId(value.operationId) || !profileTextId(value.expectedOwnerUid) || !profileTextHash(value.expectedFingerprint) || !profileTextCipher(value.note) ||
        !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 || value.expectedRevision >= Number.MAX_SAFE_INTEGER) fail();
    const account = profileLinkAccount(value.account); if (!account) fail();
    return Object.freeze({account, note: value.note, expectedFingerprint: value.expectedFingerprint,
        expectedRevision: value.expectedRevision, operationId: value.operationId, expectedOwnerUid: value.expectedOwnerUid});
}

// A patch for one encrypted field, never a filtered full-record replacement.
// Unknown Account fields and relation metadata are not serialized or modified.
export async function prepareAccountNote({context, getUser, source, account, note, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || context.signal.aborted || getUser()?.uid !== uid) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check(); const selection = profileLinkAccount(account), basis = accountNoteBasis(source, uid, selection);
    if (typeof note !== 'string' || note.length > 20000) fail();
    const expectedFingerprint = await hash(basis.value); check();
    const ciphertext = note === '' ? '' : await context.encrypt(note); check();
    if (!profileTextCipher(ciphertext) || (note !== '' && (!ciphertext || ciphertext === note))) throw Error('ENCRYPTION_FAILED');
    return validateAccountNoteRequest({account: selection, note: ciphertext, expectedFingerprint,
        expectedRevision: basis.revision, operationId, expectedOwnerUid: uid});
}
