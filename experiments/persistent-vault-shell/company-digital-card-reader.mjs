// Read only the existing company selection, preserving canonical legacy defaults
// inside a saved qrConfig. Never pass whole records or linked credentials to QR.
export function createCompanyDigitalCardReader({context, getUser, source, isEncryptedValue, buildVCard,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const fail = () => {throw new Error('DIGITAL_CARD_UNAVAILABLE');};
    const check = () => {
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const owned = value => {
        if (!value || typeof value !== 'object' || Array.isArray(value) || value.isArchived ||
            (Object.hasOwn(value, 'ownerId') && value.ownerId !== uid)) fail();
        return value;
    };
    const load = async () => {
        check(); if (source?.domain !== 'company' || !source.companyId) fail();
        const record = owned(await source.read(uid, isOnline())); check(); return record;
    };
    const decode = async value => {
        check(); if (value == null || value === '') return '';
        if (typeof value !== 'string' || value.length > 100000) fail();
        const result = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value;
        check(); if (typeof result !== 'string' || result.length > 100000 || result === '--ERRORE--' || (isEncryptedValue(value) && result === value)) fail();
        return result;
    };
    const project = async (record, fields) => {
        const result = {}; for (const field of fields) result[field] = await decode(record[field]); return result;
    };
    const selectedRows = value => {
        if (!Array.isArray(value ?? []) || (value?.length ?? 0) > 10000) fail();
        return (value ?? []).map(owned).filter(item => {
            if (item.qr !== undefined && typeof item.qr !== 'boolean') fail();
            return item.qr !== false;
        });
    };
    return async () => {
        const record = await load(), fingerprint = JSON.stringify(record), saved = owned(record.qrConfig);
        const qrConfig = {}, result = {qrConfig, emails: {extra: []}, altreSedi: []};
        const scalars = ['ragioneSociale', 'partitaIva', 'codiceSDI', 'numeroCCIAA', 'dataIscrizione',
            'referenteNome', 'referenteCognome', 'referenteTitolo', 'referenteCellulare', 'telefonoAzienda'];
        for (const key of [...scalars, 'aziendaEmail', 'adminEmail', 'persEmail', 'qrLegale']) {
            if (saved[key] !== undefined && typeof saved[key] !== 'boolean') fail();
            qrConfig[key] = saved[key] ?? !['adminEmail', 'persEmail', 'telefonoAzienda'].includes(key);
        }
        for (const key of scalars) if (qrConfig[key]) result[key] = await decode(record[key]);
        const emails = record.emails == null ? {} : owned(record.emails);
        for (const [flag, slot] of [['aziendaEmail', 'pec'], ['adminEmail', 'amministrazione'], ['persEmail', 'personale']]) {
            if (!qrConfig[flag]) continue;
            const item = emails[slot] == null ? {} : owned(emails[slot]);
            result.emails[slot] = {email: await decode(item.email || (slot === 'pec' ? record.aziendaEmail : ''))};
        }
        for (const item of selectedRows(emails.extra)) result.emails.extra.push({...await project(item, ['email']), qr: true});
        if (qrConfig.qrLegale) Object.assign(result, await project(record, ['indirizzoSede', 'civicoSede', 'cittaSede', 'provinciaSede', 'capSede']));
        for (const item of selectedRows(record.altreSedi)) result.altreSedi.push({...await project(item, ['tipo', 'indirizzo', 'civico', 'citta', 'provincia', 'cap']), qr: true});
        check(); const card = buildVCard(result);
        if (typeof card !== 'string' || new TextEncoder().encode(card).length > 65536) fail();
        const current = await load(); check();
        if (JSON.stringify(current) !== fingerprint) throw new Error('DIGITAL_CARD_CHANGED');
        return card;
    };
}
