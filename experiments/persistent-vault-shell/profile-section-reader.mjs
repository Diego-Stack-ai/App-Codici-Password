import {profileAccountLink} from './profile-linked-account.mjs';
// Explicit projection. Linked credentials stay behind a separate live reader.
const fields = {
    personal: [['nome', 'Nome'], ['cognome', 'Cognome'], ['birth_place', 'Luogo di nascita'], ['birth_date', 'Data di nascita']],
    emails: [['address', 'Email']], phones: [['number', 'Telefono']],
    addresses: [['address', 'Indirizzo'], ['civic', 'Numero civico'], ['city', 'Città'], ['cap', 'CAP'], ['province', 'Provincia']],
    documents: [['num_serie', 'Numero documento'], ['cf_value', 'Codice fiscale'], ['id_number', 'Identificativo'],
        ['license_number', 'Numero patente'], ['cf', 'Codice fiscale'], ['rilasciato_da', 'Rilasciato da'],
        ['luogo_rilascio', 'Luogo di rilascio'], ['expiry_date', 'Scadenza']]
};
export const PROFILE_SECTIONS = Object.freeze({personal: 'Anagrafica', contacts: 'Contatti', addresses: 'Indirizzi', documents: 'Documenti'});

export function createProfileSectionReader({context, getUser, repository, isEncryptedValue}) {
    const uid = context.user?.uid;
    const check = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    return async section => {
        check();
        if (!Object.hasOwn(PROFILE_SECTIONS, section)) throw new Error('PROFILE_SECTION_INVALID');
        const record = await repository.getUserProfile(uid);
        check();
        if (!record) throw new Error('PROFILE_NOT_FOUND');
        if (Object.hasOwn(record, 'ownerId') && record.ownerId !== uid) throw new Error('OWNER_MISMATCH');
        const rows = [];
        async function project(item, shape, group, collection) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('PROFILE_SHAPE_INVALID');
            const link = profileAccountLink(item, collection, uid);
            let first = true;
            for (const [field, label] of fields[shape]) {
                check();
                const value = item[field];
                if (value === undefined || value === null || value === '') continue;
                if (typeof value !== 'string') throw new Error('PROFILE_VALUE_INVALID');
                // Legacy plaintext is supported only for this fixed projection,
                // after live Vault authorization, never as a decryption fallback.
                const decoded = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value;
                check();
                if (typeof decoded !== 'string') throw new Error('PROFILE_VALUE_INVALID');
                rows.push(Object.freeze({group, label, value: decoded, ...(first && link ? {link} : {})}));
                first = false;
            }
            if (first && link) rows.push(Object.freeze({group, label: 'Account', value: 'Account collegato', link}));
        }
        async function list(name, shape, label) {
            const items = record[name] ?? [];
            if (!Array.isArray(items)) throw new Error('PROFILE_SHAPE_INVALID');
            for (let i = 0; i < items.length; i++) await project(items[i], shape, `${label} ${i + 1}`, name);
        }
        if (section === 'personal') await project(record, 'personal', 'Anagrafica');
        if (section === 'contacts') { await list('contactEmails', 'emails', 'Email'); await list('contactPhones', 'phones', 'Telefono'); }
        if (section === 'addresses') await list('userAddresses', 'addresses', 'Indirizzo');
        if (section === 'documents') await list('documenti', 'documents', 'Documento');
        check(); return rows;
    };
}
