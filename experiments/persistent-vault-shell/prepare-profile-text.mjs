import {PROFILE_TEXT_FIELDS, profileTextTarget, profileTextRevision, profileTextBasis, profileTextObject,
    profileTextCipher, profileTextInvalid, validateProfileTextRequest} from './profile-text-contract.mjs';

// The existing session crypto performs encryption. No keys, SDK or persistence
// here. Existing legacy plaintext is hashed locally, never put in the request.
export async function prepareProfileText({context, getUser, source, target: requestedTarget, changes, operationId, hash}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    check(); const target = profileTextTarget(requestedTarget), revision = profileTextRevision(source);
    if ((source.ownerId !== undefined && source.ownerId !== uid) || !profileTextObject(changes)) profileTextInvalid();
    const entries = Object.entries(changes), snapshots = [];
    if (!entries.length || entries.length > PROFILE_TEXT_FIELDS[target.domain].length) profileTextInvalid();
    for (const [field, value] of entries) {
        if (!PROFILE_TEXT_FIELDS[target.domain].includes(field) || typeof value !== 'string' ||
            value.length > (field === 'note' ? 20000 : 1000)) profileTextInvalid();
        snapshots.push({field, value, basis: profileTextBasis(source, field)});
    }
    const encrypted = {}, expected = {};
    for (const {field, value, basis} of snapshots) {
        check(); expected[field] = await hash(basis); check();
        // Explicit clearing is an empty field, not record deletion. The existing
        // crypto intentionally returns empty text unchanged.
        const ciphertext = value === '' ? '' : await context.encrypt(value); check();
        if (!profileTextCipher(ciphertext) || (value !== '' && ciphertext === value)) throw Error('ENCRYPTION_FAILED');
        encrypted[field] = ciphertext;
    }
    check(); return validateProfileTextRequest({target, changes: encrypted, expected, expectedRevision: revision, operationId});
}
