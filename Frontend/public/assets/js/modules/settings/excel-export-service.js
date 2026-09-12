import {collectOwnerBackup} from './backup-export-service.js';
import {decryptIfPossible, isEncryptedValue} from '../core/crypto-utils.js';
import {ensureVaultKeyMaterial} from '../core/security-manager.js';
import {createVaultXlsx} from './xlsx-workbook.js';

const MASK = '••••••••';
const SENSITIVE_KEY = /(password|passwd|passphrase|pin|ccv|cvv|secret|token|recovery|credential|private.?key|vault.?key)/i;
const SCOPE_LABELS = Object.freeze({
    profile: 'Profilo',
    'private-account': 'Account privati',
    'company-account': 'Account aziendali',
    company: 'Aziende',
    contact: 'Contatti',
    deadline: 'Scadenze',
    'profile-widget': 'Dati profilo',
    'private-account-widget': 'Campi account',
    'company-account-widget': 'Campi account',
    'private-account-attachment': 'Allegati',
    'company-account-attachment': 'Allegati',
    'shared-vault-data': 'Dati condivisi',
    'shared-vault-data-link': 'Collegamenti',
    settings: 'Impostazioni'
});

function displayValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Sì' : 'No';
    if (typeof value === 'object' && value.$type === 'timestamp') {
        return new Date((Number(value.seconds) || 0) * 1000).toISOString();
    }
    if (typeof value === 'object' && value.$type === 'date') return value.value || '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

async function openValue(value, fieldPath, vaultKeyMaterial, includeSecrets) {
    if (SENSITIVE_KEY.test(fieldPath) && !includeSecrets) return value ? MASK : '';
    if (Array.isArray(value)) {
        const opened = await Promise.all(value.map((item, index) => openValue(item, `${fieldPath}.${index}`, vaultKeyMaterial, includeSecrets)));
        return opened;
    }
    if (value && typeof value === 'object') {
        if (value.$type) return value;
        const entries = await Promise.all(Object.entries(value).map(async ([key, child]) => [
            key, await openValue(child, `${fieldPath}.${key}`, vaultKeyMaterial, includeSecrets)
        ]));
        return Object.fromEntries(entries);
    }
    if (typeof value !== 'string' || !value) return value;
    const opened = await decryptIfPossible(value, vaultKeyMaterial, value);
    return opened === value && isEncryptedValue(value) ? '[Dato protetto non disponibile]' : opened;
}

function flatten(value, prefix = '', rows = []) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => flatten(item, `${prefix}[${index + 1}]`, rows));
        if (!value.length) rows.push([prefix, '']);
        return rows;
    }
    if (value && typeof value === 'object' && !value.$type) {
        Object.entries(value).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, rows));
        return rows;
    }
    rows.push([prefix, displayValue(value)]);
    return rows;
}

function accountTitle(record) {
    const data = record.data || {};
    return data.nomeAccount || data.nome || data.denominazione || data.ragioneSociale || 'Senza nome';
}

export async function buildExcelWorkbook(uid, {includeSecrets = false} = {}) {
    const vaultKeyMaterial = await ensureVaultKeyMaterial();
    if (!vaultKeyMaterial) throw new Error('VAULT_LOCKED');
    const {records} = await collectOwnerBackup(uid);
    const opened = await Promise.all(records.map(async record => ({
        ...record, data: await openValue(record.data, record.scope, vaultKeyMaterial, includeSecrets)
    })));

    const accountRecords = opened.filter(record => record.scope === 'private-account' || record.scope === 'company-account');
    const companyNames = new Map(opened.filter(record => record.scope === 'company')
        .map(record => [record.id, accountTitle(record)]));
    const accountRows = accountRecords.map(record => {
        const data = record.data || {};
        const type = record.companyId ? 'Azienda' : 'Privato';
        const companyName = record.companyId ? (companyNames.get(record.companyId) || 'Azienda') : '';
        const title = accountTitle(record);
        const key = `${type} — ${companyName ? `${companyName} — ` : ''}${title} [${record.id.slice(0, 8)}]`;
        return [record.id, type, record.companyId || '', companyName, title, data.username || '', data.account || data.codice || '', data.password || '', data.url || data.sitoWeb || '', data.visibility || '', key];
    });
    const accountWidgetRecords = opened.filter(record => record.scope === 'private-account-widget' || record.scope === 'company-account-widget');
    const detailRows = accountRecords.flatMap(record => flatten(record.data).map(([field, value]) => [
        record.id, record.companyId || '', accountTitle(record), field, value
    ])).concat(accountWidgetRecords.flatMap(record => flatten(record.data).map(([field, value]) => [
        record.accountId || '', record.companyId || '', 'Campo personalizzato', field, value
    ])));

    const scopeSheets = new Map();
    opened.filter(record => ![
        'private-account', 'company-account', 'private-account-widget', 'company-account-widget'
    ].includes(record.scope)).forEach(record => {
        const sheetName = SCOPE_LABELS[record.scope] || record.scope;
        if (!scopeSheets.has(sheetName)) scopeSheets.set(sheetName, []);
        flatten(record.data).forEach(([field, value]) => scopeSheets.get(sheetName).push([
            record.id, record.companyId || '', record.accountId || '', field, value
        ]));
    });

    const workbook = createVaultXlsx({
        accountRows,
        detailRows,
        otherSheets: [...scopeSheets.entries()],
        companies: [...companyNames.values()].sort((left, right) => left.localeCompare(right, 'it')),
        includeSecrets
    });
    return {workbook, recordCount: records.length, accountCount: accountRecords.length};
}

export async function exportOwnerExcel(uid, options = {}) {
    const result = await buildExcelWorkbook(uid, options);
    const url = URL.createObjectURL(new Blob([result.workbook], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const link = document.createElement('a');
    link.href = url;
    const suffix = options.includeSecrets ? 'completa' : 'protetta';
    link.download = `codici-password-esportazione-${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return result;
}
