// Explicit company PDF projection. Credentials, notes, bank data, attachment
// URLs and account links never enter the output or the decryption requests.
export const COMPANY_SUMMARY_GROUPS = Object.freeze(['identity', 'fiscal', 'contactPerson', 'contacts', 'addresses']);
export function createCompanySummaryReader({context, getUser, source, isEncryptedValue,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const fail = () => {throw Error('COMPANY_SUMMARY_UNAVAILABLE');};
    const check = () => {if (!uid || getUser()?.uid !== uid || context.signal.aborted) fail(); context.assertUnlocked();};
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const load = async () => {
        check(); if (source?.domain !== 'company' || !source.companyId) fail();
        const record = await source.read(uid, isOnline()); check();
        if (!object(record) || record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid)) fail();
        return record;
    };
    return async selection => {
        if (!object(selection) || Object.keys(selection).some(key => !COMPANY_SUMMARY_GROUPS.includes(key)) ||
            COMPANY_SUMMARY_GROUPS.some(key => typeof selection[key] !== 'boolean') || !Object.values(selection).some(Boolean)) fail();
        const included = {...selection}, record = await load(), fingerprint = JSON.stringify(record), sections = [];
        let size = 0, count = 0;
        const decode = async value => {
            check(); if (value == null || value === '') return '';
            if (typeof value !== 'string' || value.length > 100000) fail();
            const plain = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value; check();
            if (typeof plain !== 'string' || plain === '--ERRORE--' || plain.length > 20000 || (isEncryptedValue(value) && plain === value)) fail();
            return plain;
        };
        const section = title => {const item = {title, rows: []}; sections.push(item); return item;};
        const add = async (target, label, value) => {
            const plain = await decode(value); if (!plain.trim()) return;
            size += plain.length + label.length; count++; if (size > 100000 || count > 500) fail();
            target.rows.push(Object.freeze({label, value: plain}));
        };
        const scalar = async (group, title, fields) => {
            if (!included[group]) return; const target = section(title);
            for (const [key, label] of fields) await add(target, label, record[key]);
        };
        await scalar('identity', 'Azienda', [['ragioneSociale', 'Ragione sociale']]);
        await scalar('fiscal', 'Dati fiscali', [['partitaIva', 'Partita IVA'], ['codiceSDI', 'Codice SDI'], ['numeroCCIAA', 'CCIAA'], ['dataIscrizione', 'Data iscrizione']]);
        await scalar('contactPerson', 'Referente', [['referenteNome', 'Nome'], ['referenteCognome', 'Cognome'], ['referenteTitolo', 'Ruolo'], ['referenteCellulare', 'Cellulare']]);
        const list = value => {if (!Array.isArray(value ?? []) || (value?.length ?? 0) > 500 || (value ?? []).some(item => !object(item))) fail(); return value ?? [];};
        if (included.contacts) {
            const target = section('Contatti');
            await add(target, 'Telefono', record.telefonoAzienda); await add(target, 'Fax', record.faxAzienda);
            if (record.emails != null && !object(record.emails)) fail();
            for (const [slot, label] of [['pec', 'PEC'], ['amministrazione', 'Email amministrazione'], ['personale', 'Email personale']]) {
                const item = record.emails?.[slot]; if (item != null && !object(item)) fail();
                await add(target, label, item?.email || (slot === 'pec' ? record.aziendaEmail : ''));
            }
            for (const item of list(record.emails?.extra)) await add(target, 'Email aggiuntiva', item.email);
        }
        if (included.addresses) {
            const address = async (target, item, names) => {
                for (const [key, label] of names) await add(target, label, item[key]);
            };
            await address(section('Sede legale'), record, [['indirizzoSede', 'Indirizzo'], ['civicoSede', 'Civico'], ['cittaSede', 'Città'], ['provinciaSede', 'Provincia'], ['capSede', 'CAP']]);
            let index = 0;
            for (const item of list(record.altreSedi)) await address(section(`Altra sede ${++index}`), item, [['tipo', 'Tipo'], ['indirizzo', 'Indirizzo'], ['civico', 'Civico'], ['citta', 'Città'], ['provincia', 'Provincia'], ['cap', 'CAP']]);
        }
        const current = await load(); check(); if (JSON.stringify(current) !== fingerprint) fail();
        const nonempty = sections.filter(item => item.rows.length).map(item => Object.freeze({title: item.title, rows: Object.freeze(item.rows)}));
        if (!nonempty.length) fail();
        return Object.freeze({title: 'Scheda aziendale', sections: Object.freeze(nonempty)});
    };
}
