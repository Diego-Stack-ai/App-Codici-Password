import {parseAccountDestination} from './account-route.mjs';

// Bootstrap-owned adapter: normalizes canonical company data, never secrets.
export function createCompanyProfileSource({uid, companyId, repository, normalizeContacts}) {
    parseAccountDestination(`dettaglio_account_azienda.html?id=validation&aziendaId=${encodeURIComponent(companyId)}`, {uid, companyId});
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    function normalize(record) {
        if (!object(record)) throw new Error('PROFILE_SHAPE_INVALID');
        if (record.isArchived) throw new Error('PROFILE_NOT_FOUND');
        if (record.emails != null && !object(record.emails)) throw new Error('PROFILE_SHAPE_INVALID');
        for (const slot of ['pec', 'amministrazione', 'personale']) {
            if (record.emails?.[slot] != null && !object(record.emails[slot])) throw new Error('PROFILE_SHAPE_INVALID');
        }
        for (const list of [record.emails?.extra, record.altreSedi, record.allegati]) {
            if (list != null && (!Array.isArray(list) || list.some(item => !object(item)))) throw new Error('PROFILE_SHAPE_INVALID');
        }
        const {emails, phones} = normalizeContacts(record);
        const address = item => ({address: item.indirizzo, civic: item.civico, city: item.citta, cap: item.cap, province: item.prov || item.provincia});
        return {...record, contactEmails: emails, contactPhones: phones,
            userAddresses: [address({indirizzo: record.indirizzoSede, civico: record.civicoSede, citta: record.cittaSede, cap: record.capSede, provincia: record.provinciaSede}), ...(record.altreSedi || []).map(address)],
            documenti: (record.allegati || []).map(item => ({name: item.name || item.nome}))};
    }
    return Object.freeze({
        domain: 'company', companyId,
        async read(requestedUid, confirmed = false) {
            if (requestedUid !== uid) throw new Error('AUTH_CHANGED');
            return repository[confirmed ? 'getCompanyConfirmed' : 'getCompany'](uid, companyId);
        }, normalize
    });
}
