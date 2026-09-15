import {preparePrivateQrSelection, PRIVATE_QR_SCALARS} from './qr-selection-contract.mjs';

export function createQrSelectionEditorSource({context, getUser, repository, isEncryptedValue,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid; let basis = null, disposed = false;
    const fail = () => {throw Error('QR_EDITOR_UNAVAILABLE');};
    const check = () => {if (disposed || !uid || getUser()?.uid !== uid || context.signal.aborted) {basis = null; fail();} context.assertUnlocked();};
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const dispose = () => {disposed = true; basis = null;};
    context.signal.addEventListener('abort', dispose, {once: true});
    const fields = {phones: ['contactPhones', ['number']], emails: ['contactEmails', ['address']],
        addresses: ['userAddresses', ['address', 'civic', 'city', 'cap']]};
    const read = async (confirmed = isOnline()) => {
        check(); const suffix = confirmed ? 'Confirmed' : '';
        const profile = await repository['getUserProfile' + suffix](uid); check();
        const setting = await repository['getUserSetting' + suffix](uid, 'qrCodeInclusions'); check();
        if (!object(profile) || profile.isArchived || (profile.ownerId !== undefined && profile.ownerId !== uid) ||
            (setting != null && !object(setting))) fail();
        const config = {...(setting ?? {})}, revision = Object.hasOwn(config, '_qrRevision') ? config._qrRevision : 0;
        // The canonical repository attaches the document ID to every read.
        // Validate this transport metadata, then exclude it from preferences.
        if (config.id !== undefined && config.id !== 'qrCodeInclusions') fail();
        delete config.id;
        if (!Number.isSafeInteger(revision) || revision < 0 || (config._qrSchemaVersion !== undefined && config._qrSchemaVersion !== 1)) fail();
        delete config._qrRevision; delete config._qrSchemaVersion;
        const projection = {};
        for (const [key, [collection, names]] of Object.entries(fields)) {
            const rows = profile[collection] ?? [];
            if (!Array.isArray(rows) || rows.length > 1000 || rows.some(row => !object(row))) fail();
            projection[collection] = rows.map(row => Object.fromEntries(['id', ...names].map(name => [name, row[name] ?? ''])));
        }
        // Validate every selectable ID, including currently unchecked contacts.
        preparePrivateQrSelection(Object.fromEntries(Object.entries(fields).map(([key, [collection]]) => [key, projection[collection].map(row => row.id)])), projection);
        const selection = preparePrivateQrSelection(config, projection);
        return {projection, selection, revision, fingerprint: JSON.stringify(projection)};
    };
    const decode = async value => {
        check(); if (typeof value !== 'string' || value.length > 100000) fail();
        const result = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value; check();
        if (typeof result !== 'string' || result.length > 100000 || result === '--ERRORE--' || (isEncryptedValue(value) && result === value)) fail();
        return result;
    };
    return Object.freeze({
        async load() {
            basis = null; const initial = await read();
            const labels = ['Nome e cognome', 'Cognome', 'Codice fiscale', 'Nascita', 'Foto'];
            const choices = PRIVATE_QR_SCALARS.map((key, index) => Object.freeze({key, label: labels[index]}));
            for (const [key, [collection, names]] of Object.entries(fields)) for (const row of initial.projection[collection]) {
                const values = []; for (const name of names) values.push(await decode(row[name]));
                choices.push(Object.freeze({key, id: row.id, label: values.filter(Boolean).join(' ') || 'Dato non compilato'}));
            }
            check(); const current = await read(); check();
            if (current.fingerprint !== initial.fingerprint || current.revision !== initial.revision || JSON.stringify(current.selection) !== JSON.stringify(initial.selection)) fail();
            basis = {fingerprint: initial.fingerprint, revision: initial.revision, savedSelection: JSON.stringify(initial.selection)};
            return Object.freeze({selection: initial.selection, choices: Object.freeze(choices)});
        },
        async prepare(selection) {
            check(); if (!basis || !isOnline()) fail(); const expected = basis;
            const current = await read(true); check();
            if (basis !== expected || current.fingerprint !== expected.fingerprint || current.revision !== expected.revision || JSON.stringify(current.selection) !== expected.savedSelection) fail();
            return Object.freeze({selection: preparePrivateQrSelection(selection, current.projection), expectedRevision: expected.revision});
        },
        dispose() {dispose(); context.signal.removeEventListener('abort', dispose);}
    });
}
