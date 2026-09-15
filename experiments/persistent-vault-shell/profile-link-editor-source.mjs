import {profileLinkSource, profileLinkAccount, profileLinkRevision, validateProfileLinkRequest} from './profile-link-contract.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';

// readProfile is an owner-bound raw repository adapter, not a UI projection.
// Retain only the source fingerprint and target identity; never decrypt a
// contact, password or Account while preparing a relationship mutation.
export function createProfileLinkEditorSource({context, getUser, source, readProfile, models, hash,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context?.user?.uid, origin = profileLinkSource(source);
    if (!uid || !context.signal || ![getUser, readProfile, hash, isOnline, context.assertUnlocked].every(fn => typeof fn === 'function')) throw Error('PROFILE_LINK_CONFIG');
    let closed = false, basis = null, generation = 0;
    const dispose = () => {closed = true; basis = null; generation++; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (closed || context.signal.aborted || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    const read = async confirmed => {
        check(); const record = await readProfile({uid, source: origin, confirmed}); check();
        if (!record || (record.ownerId !== undefined && record.ownerId !== uid) ||
            (origin.domain === 'company' && record.id !== undefined && record.id !== origin.companyId)) throw Error('OWNER_MISMATCH');
        const revision = profileLinkRevision(record), contact = readProfileLinkContact(record, origin, models);
        const fingerprint = await hash(contact.fingerprintInput); check();
        if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) throw Error('PROFILE_LINK_HASH');
        return Object.freeze({revision, fingerprint, account: contact.account});
    };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    context.signal.addEventListener('abort', dispose, {once: true});
    return Object.freeze({dispose,
        async load() {
            check(); basis = null; const ticket = ++generation;
            const initial = await read(isOnline()), current = await read(isOnline()); check();
            if (ticket !== generation || !same(initial, current)) throw Error('PROFILE_LINK_CHANGED');
            basis = initial;
            return Object.freeze({source: origin, account: initial.account, canSave: isOnline()});
        },
        async prepare(account, operationId) {
            check(); if (!basis || !isOnline()) throw Error('PROFILE_LINK_SAVE_UNAVAILABLE');
            const selection = profileLinkAccount(account), expected = basis, ticket = generation;
            const current = await read(true); check();
            if (!isOnline()) throw Error('PROFILE_LINK_SAVE_UNAVAILABLE');
            if (ticket !== generation || basis !== expected || !same(current, expected)) throw Error('PROFILE_LINK_CHANGED');
            // Destination eligibility and company ownership are checked inside
            // the atomic backend transaction, never trusted from picker labels.
            return validateProfileLinkRequest({source: origin, account: selection, expectedAccount: expected.account,
                expectedFingerprint: expected.fingerprint, expectedRevision: expected.revision, operationId});
        }
    });
}
