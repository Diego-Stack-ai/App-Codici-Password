const MAX_RECORDS = 400;
const MAX_CHUNK_BYTES = 7 * 1024 * 1024;

export function validateRestoreStoragePath(storagePath, uid) {
    const prefix = `users/${String(uid || '').trim()}/`;
    if (!uid || typeof storagePath !== 'string' || !storagePath.startsWith(prefix) ||
        storagePath.includes('..') || storagePath.length > 1024) {
        throw new Error('BACKUP_STORAGE_PATH_INVALID');
    }
    return storagePath;
}

export function chunkRestoreRecords(records) {
    if (!Array.isArray(records)) throw new Error('BACKUP_RECORDS_INVALID');
    const chunks = [];
    let current = [];
    let currentBytes = 0;
    for (const record of records) {
        const bytes = new TextEncoder().encode(JSON.stringify(record.data)).byteLength;
        if (bytes > 800 * 1024) throw new Error('BACKUP_RECORD_TOO_LARGE');
        if (current.length && (current.length >= MAX_RECORDS || currentBytes + bytes > MAX_CHUNK_BYTES)) {
            chunks.push(current); current = []; currentBytes = 0;
        }
        current.push(record); currentBytes += bytes;
    }
    if (current.length) chunks.push(current);
    return chunks;
}

export function validateBackupFooter(footer, counts) {
    if (footer?.kind !== 'footer' || footer.entryCount !== counts.entries ||
        footer.recordCount !== counts.records || footer.attachmentCount !== counts.attachments) {
        throw new Error('BACKUP_FOOTER_INVALID');
    }
    return true;
}

function restoreRecordKey(record = {}) {
    return [
        record.scope, record.id, record.companyId || '', record.accountId || '', record.sharedDataId || ''
    ].join(':');
}

function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function safeLabel(value, fallback) {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    return normalized ? normalized.slice(0, 120) : fallback;
}

function recordName(record, fallback) {
    const data = record?.data || {};
    const fields = {
        'private-account': ['nomeAccount', 'nome'],
        'company-account': ['nomeAccount', 'nome'],
        company: ['ragioneSociale', 'denominazione', 'nome'],
        deadline: ['titolo', 'nome', 'tipoScadenza', 'tipo'],
        contact: ['nomeCompleto', 'nome', 'email'],
        'profile-widget': ['title', 'titolo', 'label'],
        'private-account-attachment': ['originalName', 'fileName', 'nomeFile', 'name'],
        'company-account-attachment': ['originalName', 'fileName', 'nomeFile', 'name'],
        'private-account-widget': ['title', 'titolo', 'label'],
        'company-account-widget': ['title', 'titolo', 'label'],
        'shared-vault-data': ['title', 'titolo', 'label'],
        'shared-vault-data-link': ['label', 'title']
    }[record?.scope] || [];
    return safeLabel(fields.map(field => data[field]).find(value => typeof value === 'string' && value.trim()), fallback);
}

export function describeRestoreRecords(records) {
    if (!Array.isArray(records)) throw new Error('BACKUP_RECORDS_INVALID');
    const companies = new Map();
    const privateAccounts = new Map();
    const companyAccounts = new Map();
    records.forEach(record => {
        if (record.scope === 'company') companies.set(record.id, recordName(record, 'Azienda senza nome'));
        if (record.scope === 'private-account') privateAccounts.set(record.id, recordName(record, 'Account senza nome'));
        if (record.scope === 'company-account') {
            companyAccounts.set(`${record.companyId}:${record.id}`, recordName(record, 'Account senza nome'));
        }
    });
    return records.map(record => {
        if (record.scope === 'profile') return 'Profilo utente';
        if (record.scope === 'settings') return safeLabel(record.id, 'Impostazioni applicazione');
        if (record.scope === 'private-account') return recordName(record, 'Account senza nome');
        if (record.scope === 'company') return recordName(record, 'Azienda senza nome');
        if (record.scope === 'company-account') {
            const account = recordName(record, 'Account senza nome');
            const company = companies.get(record.companyId);
            return company ? `${account} — ${company}` : account;
        }
        if (record.scope === 'private-account-attachment') {
            const file = recordName(record, 'Allegato');
            const account = privateAccounts.get(record.accountId);
            return account ? `${file} — ${account}` : file;
        }
        if (record.scope === 'company-account-attachment') {
            const file = recordName(record, 'Allegato');
            const account = companyAccounts.get(`${record.companyId}:${record.accountId}`);
            return account ? `${file} — ${account}` : file;
        }
        if (record.scope === 'private-account-widget') {
            const widget = recordName(record, 'Widget');
            const account = privateAccounts.get(record.accountId);
            return account ? `${widget} — ${account}` : widget;
        }
        if (record.scope === 'company-account-widget') {
            const widget = recordName(record, 'Widget');
            const account = companyAccounts.get(`${record.companyId}:${record.accountId}`);
            return account ? `${widget} — ${account}` : widget;
        }
        if (record.scope === 'shared-vault-data') {
            return recordName(record, 'Credenziale comune');
        }
        if (record.scope === 'shared-vault-data-link') {
            return recordName(record, 'Collegamento Credenziale comune');
        }
        return recordName(record, 'Elemento senza nome');
    });
}

export function compareRestoreRecords(backupRecords, currentRecords) {
    if (!Array.isArray(backupRecords) || !Array.isArray(currentRecords)) throw new Error('BACKUP_COMPARISON_INVALID');
    const currentByKey = new Map(currentRecords.map(record => [restoreRecordKey(record), record]));
    const descriptions = describeRestoreRecords(backupRecords);
    const entries = backupRecords.map((record, index) => {
        const current = currentByKey.get(restoreRecordKey(record));
        const status = !current ? 'missing' : canonicalJson(current.data) === canonicalJson(record.data) ? 'unchanged' : 'changed';
        return {index, scope: record.scope, id: record.id, status, description: descriptions[index]};
    });
    const counts = {missing: 0, unchanged: 0, changed: 0};
    entries.forEach(entry => { counts[entry.status] += 1; });
    return {entries, counts};
}
