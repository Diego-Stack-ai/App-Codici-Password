import {profileLinkAccount, assertProfileLinkAccount} from './profile-link-contract.mjs';
const invalid = () => {throw Error('PROFILE_PICKER_INVALID');};
const list = (value, limit) => {if (!Array.isArray(value) || value.length > limit) invalid(); return value;};
const identity = value => JSON.stringify([value.domain, value.companyId || '', value.id]);

// Read only display names. Account credentials and reverse references are not
// projected or decrypted. An already-linked Account remains eligible.
export function createProfileAccountPickerReader({context, getUser, repository, isEncryptedValue,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const check = () => {
        if (context.signal.aborted) throw Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    const owner = record => {
        if (!record || typeof record !== 'object' || Array.isArray(record) ||
            (record.ownerId !== undefined && record.ownerId !== uid)) throw Error('OWNER_MISMATCH');
    };
    const text = value => {if (typeof value !== 'string' || value.length > 100000) invalid(); return value;};
    const read = async () => {
        check(); const suffix = isOnline() ? 'Confirmed' : '';
        const call = async (method, ...args) => {check(); const result = await repository[method + suffix](uid, ...args); check(); return result;};
        const rows = [], seen = new Set(), companies = new Set();
        const add = (records, companyId = '', companyName = '') => {
            for (const record of list(records, 10000)) {
                owner(record);
                const selection = profileLinkAccount(companyId ? {domain: 'company', companyId, id: record.id} : {domain: 'private', id: record.id});
                const key = identity(selection);
                if (seen.has(key)) invalid(); seen.add(key);
                if (seen.size > 10000) invalid();
                try {assertProfileLinkAccount(record, uid, selection, {destination: true});} catch {continue;}
                rows.push({selection, name: text(record.nomeAccount ?? ''), companyId, companyName});
            }
        };
        add(await call('listPrivateAccounts'));
        for (const company of list(await call('listCompanies'), 1000)) {
            owner(company);
            const companyId = profileLinkAccount({domain: 'company', companyId: company.id, id: 'validation'}).companyId;
            if (companies.has(companyId)) invalid(); companies.add(companyId);
            if (company.isArchived) continue;
            const companyName = text(company.ragioneSociale ?? '');
            add(await call('listCompanyAccounts', companyId), companyId, companyName);
        }
        return rows.sort((a, b) => identity(a.selection).localeCompare(identity(b.selection)));
    };
    const decode = async raw => {
        check(); const encrypted = isEncryptedValue(raw), value = encrypted ? await context.read({ownerId: uid, ciphertext: raw}) : raw; check();
        if (typeof value !== 'string' || value.length > 1000 || value === '--ERRORE--' || (encrypted && value === raw)) invalid();
        return value;
    };
    return async () => {
        const initial = await read(), rows = [], companyNames = new Map();
        for (const row of initial) {
            if (row.companyId && !companyNames.has(row.companyId)) companyNames.set(row.companyId, await decode(row.companyName) || 'Azienda senza nome');
            rows.push(Object.freeze({selection: row.selection, name: await decode(row.name) || 'Account senza nome',
                companyId: row.companyId, companyName: companyNames.get(row.companyId) || ''}));
        }
        // Detect renamed, removed, archived or newly ineligible destinations
        // while decryption was pending. Backend still validates at commit time.
        const current = await read(); check();
        if (JSON.stringify(current) !== JSON.stringify(initial)) throw Error('PROFILE_PICKER_CHANGED');
        return Object.freeze(rows);
    };
}
