import {profileLinkAccount} from './profile-link-contract.mjs';
import {ACCOUNT_STANDARD_FIELDS, accountStandardBasis, prepareAccountStandard} from './account-standard-contract.mjs';

export function createAccountStandardEditorSource({context, getUser, repository, account, hash, isEncryptedValue,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid, selection = profileLinkAccount(account); if (!uid || !selection) throw Error('ACCOUNT_STANDARD_CONFIG');
    let closed = false, basis = null, generation = 0;
    const dispose = () => {closed = true; basis = null; generation++; context.signal.removeEventListener('abort', dispose);};
    const check = () => {if (closed || context.signal.aborted || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');} context.assertUnlocked();};
    const read = async confirmed => {
        check(); const suffix = confirmed ? 'Confirmed' : '';
        if (selection.domain === 'company') {
            const company = await repository['getCompany' + suffix](uid, selection.companyId); check();
            if (!company || company.isArchived || (company.ownerId !== undefined && company.ownerId !== uid)) throw Error('COMPANY_UNAVAILABLE');
        }
        const record = selection.domain === 'private' ? await repository['getPrivateAccount' + suffix](uid, selection.id)
            : await repository['getCompanyAccount' + suffix](uid, selection.companyId, selection.id); check();
        accountStandardBasis(record, uid, selection); return record;
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    return Object.freeze({dispose, async load() {
        check(); basis = null; const ticket = ++generation, source = await read(isOnline()), model = {};
        for (const field of ACCOUNT_STANDARD_FIELDS) {
            const raw = source[field] ?? '';
            model[field] = field === 'url' || raw === '' ? raw : await context.read({ownerId: uid, ciphertext: raw}); check();
            if (typeof model[field] !== 'string' || (field !== 'url' && raw && (!isEncryptedValue(raw) || model[field] === raw))) throw Error('ACCOUNT_STANDARD_VALUE_INVALID');
        }
        const current = await read(isOnline()); check();
        const now = accountStandardBasis(current, uid, selection), was = accountStandardBasis(source, uid, selection);
        if (ticket !== generation || now.revision !== was.revision || now.fingerprintInput !== was.fingerprintInput) throw Error('ACCOUNT_STANDARD_CHANGED');
        basis = source; return Object.freeze({canSave: isOnline(), values: Object.freeze(model)});
    }, async prepare(changes, operationId) {
        check(); if (!basis || !isOnline()) throw Error('ACCOUNT_STANDARD_SAVE_UNAVAILABLE');
        const expected = basis, ticket = generation, current = await read(true); check();
        const now = accountStandardBasis(current, uid, selection), was = accountStandardBasis(expected, uid, selection);
        if (ticket !== generation || basis !== expected || now.revision !== was.revision || now.fingerprintInput !== was.fingerprintInput) throw Error('ACCOUNT_STANDARD_CHANGED');
        const request = await prepareAccountStandard({context, getUser, source: current, account: selection, changes, operationId, hash}); check();
        if (!isOnline() || ticket !== generation || basis !== expected) throw Error('ACCOUNT_STANDARD_CHANGED'); return request;
    }});
}
