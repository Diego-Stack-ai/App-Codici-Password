// Read-only summary. The canonical model selects primaries and document dates;
// the UI never receives the profile, ciphertext, attachment URLs or Vault key.
export function createProfileOverviewReader({context, getUser, repository, source, isEncryptedValue,
    buildProfileOverview, resolvePrimary, now = () => new Date(), isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const list = value => {
        const items = value ?? [];
        if (!Array.isArray(items) || items.length > 10000 || items.some(item => !object(item))) throw new Error('PROFILE_SHAPE_INVALID');
        return items;
    };
    const decode = async value => {
        check();
        if (value == null || value === '') return '';
        if (typeof value !== 'string' || value.length > 100000) throw new Error('PROFILE_VALUE_INVALID');
        const result = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value;
        check();
        if (typeof result !== 'string' || result.length > 100000 || result === '--ERRORE--') throw new Error('PROFILE_VALUE_INVALID');
        return result;
    };
    const project = async (item, fields) => {
        const result = {};
        for (const field of fields) result[field] = await decode(item?.[field]);
        return result;
    };
    return async () => {
        check();
        const raw = await (source ? source.read(uid, isOnline()) : repository[isOnline() ? 'getUserProfileConfirmed' : 'getUserProfile'](uid));
        check();
        if (!object(raw) || raw.isArchived) throw new Error('PROFILE_NOT_FOUND');
        if (Object.hasOwn(raw, 'ownerId') && raw.ownerId !== uid) throw new Error('OWNER_MISMATCH');
        const record = source ? source.normalize(raw) : raw;
        const company = source?.domain === 'company';
        const emails = list(record.contactEmails), phones = list(record.contactPhones), addresses = list(record.userAddresses), documents = list(record.documenti);
        const profile = await project(record, company ? ['ragioneSociale', 'partitaIva'] : ['nome', 'cognome']);
        // Decode only the chosen contact/address; unrelated entries and their
        // linked credentials are not needed for the summary.
        profile.contactEmails = [await project(resolvePrimary(emails), ['address'])];
        profile.contactPhones = [await project(resolvePrimary(phones), ['number'])];
        profile.userAddresses = [await project(resolvePrimary(addresses), ['address', 'civic', 'city'])];
        profile.documenti = [];
        if (!company) {
            for (const item of documents) profile.documenti.push(await project(item, ['type', 'expiry_date']));
            const fiscal = profile.documenti.findIndex(item => item.type.toLowerCase().includes('fiscale'));
            if (fiscal !== -1) Object.assign(profile.documenti[fiscal], await project(documents[fiscal], ['cf_value', 'num_serie', 'id_number', 'cf']));
        }
        check();
        const overview = buildProfileOverview(profile, now()), rows = [];
        const add = (label, value, target, group = 'Panoramica') => rows.push(Object.freeze({group, label, value: value || 'Non indicato', target}));
        add(company ? 'Ragione sociale' : 'Nome e cognome', company ? profile.ragioneSociale : overview.fullName, 'personal');
        add(company ? 'Partita IVA' : 'Codice fiscale', company ? profile.partitaIva : overview.fiscalCode, company ? 'personal' : 'documents');
        add('Email principale', overview.primaryEmail?.address, 'contacts');
        add('Telefono principale', overview.primaryPhone?.number, 'contacts');
        add(company ? 'Sede legale' : 'Indirizzo principale', ['address', 'civic', 'city'].map(key => overview.primaryAddress?.[key]).filter(Boolean).join(' '), 'addresses');
        if (company) add('Allegati', String(documents.length), 'documents', 'Documenti aziendali');
        else if (overview.expiringDocuments.length) for (const item of overview.expiringDocuments) add(item.type || 'Documento', item.expiry_date, 'documents', 'In scadenza entro 90 giorni');
        else add('Documenti', 'Nessun documento in scadenza nei prossimi 90 giorni.', 'documents', 'Scadenze');
        check(); return Object.freeze(rows);
    };
}
