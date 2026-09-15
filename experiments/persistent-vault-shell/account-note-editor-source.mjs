import {profileLinkAccount} from './profile-link-contract.mjs';
import {accountNoteBasis, prepareAccountNote} from './account-note-contract.mjs';

export function createAccountNoteEditorSource({context, getUser, repository, account, hash, isEncryptedValue,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid, selection = profileLinkAccount(account);
    if (!uid || !selection) throw Error('ACCOUNT_NOTE_CONFIG');
    let closed = false, basis = null, generation = 0;
    const dispose = () => {closed = true; basis = null; generation++; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (closed || context.signal.aborted || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');}
        try {context.assertUnlocked();} catch (error) {dispose(); throw error;}
    };
    const read = async confirmed => {
        check(); const suffix = confirmed ? 'Confirmed' : '';
        if (selection.domain === 'company') {
            const parent = await repository['getCompany' + suffix](uid, selection.companyId); check();
            if (!parent || parent.isArchived || (parent.ownerId !== undefined && parent.ownerId !== uid) ||
                (parent.id !== undefined && parent.id !== selection.companyId)) throw Error('COMPANY_UNAVAILABLE');
        }
        const record = selection.domain === 'private' ? await repository['getPrivateAccount' + suffix](uid, selection.id)
            : await repository['getCompanyAccount' + suffix](uid, selection.companyId, selection.id); check();
        const current = accountNoteBasis(record, uid, selection);
        // New note-only contract: validate the full record before projecting.
        // No use of this projection with the old M6 full-record writer.
        const projected = {ownerId: uid, id: selection.id, revision: current.revision, schemaVersion: 1};
        if (Object.hasOwn(record, 'note')) projected.note = record.note;
        return Object.freeze(projected);
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    return Object.freeze({dispose,
        async load() {
            check(); basis = null; const ticket = ++generation, initial = await read(isOnline());
            const raw = initial.note ?? '', encrypted = isEncryptedValue(raw);
            const value = encrypted ? await context.read({ownerId: uid, ciphertext: raw}) : raw; check();
            if (typeof value !== 'string' || value.length > 20000 || value === '--ERRORE--' || (encrypted && value === raw)) throw Error('NOTE_VALUE_INVALID');
            const current = await read(isOnline()); check();
            if (ticket !== generation || JSON.stringify(current) !== JSON.stringify(initial)) throw Error('NOTE_CHANGED');
            basis = initial;
            return Object.freeze({canSave: isOnline(), fields: Object.freeze([Object.freeze({key: 'note', label: 'Nota', value, multiline: true, maxLength: 20000})])});
        },
        async prepare(note, operationId) {
            check(); if (!basis || !isOnline()) throw Error('NOTE_SAVE_UNAVAILABLE');
            const expected = basis, ticket = generation, current = await read(true); check();
            if (!isOnline()) throw Error('NOTE_SAVE_UNAVAILABLE');
            if (ticket !== generation || basis !== expected || JSON.stringify(current) !== JSON.stringify(expected)) throw Error('NOTE_CHANGED');
            const request = await prepareAccountNote({context, getUser, source: current, account: selection, note, operationId, hash}); check();
            if (!isOnline()) throw Error('NOTE_SAVE_UNAVAILABLE');
            if (ticket !== generation || basis !== expected) throw Error('NOTE_CHANGED');
            return request;
        }
    });
}
