import {validateProfileAccountCreateRequest} from './profile-account-create-contract.mjs';
import {profileLinkRevision} from './profile-link-contract.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';

export function createProfileAccountCreateSource({context, getUser, readProfile, source, models, hash, isEncryptedValue = () => false,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context?.user?.uid; let basis; let closed = false;
    const check = () => { if (closed || context.signal.aborted || getUser()?.uid !== uid) throw Error('VIEW_DISPOSED'); context.assertUnlocked(); };
    const dispose = () => { closed = true; basis = null; };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async () => { check(); const profile = await readProfile({uid, source, confirmed: true}); check();
        const contact = readProfileLinkContact(profile, source, models);
        if (contact.account) throw Error('PROFILE_LINK_UNCHANGED');
        return {revision: profileLinkRevision(profile), fingerprint: await hash(contact.fingerprintInput), contact: contact.contact}; };
    return Object.freeze({dispose, async load() { if (!isOnline()) throw Error('PROFILE_ACCOUNT_CREATE_OFFLINE'); basis = await read(); check();
            const legacy = typeof basis.contact.password === 'string' && basis.contact.password ? basis.contact.password :
                typeof basis.contact.passwordLegacy === 'string' && basis.contact.passwordLegacy ? basis.contact.passwordLegacy : '';
            const raw = basis.contact.address || basis.contact.number || basis.contact.value || '';
            const suggestedUsername = raw && !isEncryptedValue(raw) ? raw : '';
            return Object.freeze({canTransferLegacy: Boolean(legacy), suggestedUsername, legacy}); },
        async prepare({scope, name, username, password = '', transferLegacyPassword = false, operationId}) {
            check(); if (!basis || !isOnline()) throw Error('PROFILE_ACCOUNT_CREATE_OFFLINE');
            const current = await read(); check();
            if (current.revision !== basis.revision || current.fingerprint !== basis.fingerprint) throw Error('PROFILE_LINK_CHANGED');
            const encName = await context.encrypt(name), encUsername = username ? await context.encrypt(username) : '';
            const legacy = typeof current.contact.password === 'string' && current.contact.password ? current.contact.password :
                typeof current.contact.passwordLegacy === 'string' && current.contact.passwordLegacy ? current.contact.passwordLegacy : '';
            let encPassword = '';
            if (transferLegacyPassword) { if (!legacy) throw Error('PROFILE_LEGACY_PASSWORD_UNAVAILABLE'); encPassword = legacy; }
            else if (password) encPassword = await context.encrypt(password);
            check();
            return validateProfileAccountCreateRequest({source, scope, name: encName, username: encUsername, password: encPassword,
                transferLegacyPassword, expectedLegacyPassword: transferLegacyPassword ? legacy : '', expectedFingerprint: basis.fingerprint,
                expectedRevision: basis.revision, operationId, expectedOwnerUid: uid});
        }});
}
