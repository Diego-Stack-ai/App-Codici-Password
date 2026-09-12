import {collectOwnerBackup} from './backup-export-service.js';
import {decryptIfPossible, isEncryptedValue} from '../core/crypto-utils.js';
import {ensureVaultKeyMaterial} from '../core/security-manager.js';

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

const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');

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

function cell(input, style = 'Body') {
    const value = input && typeof input === 'object' && 'value' in input ? input.value : input;
    const href = input && typeof input === 'object' && input.href ? ` ss:HRef="${xml(input.href)}"` : '';
    const effectiveStyle = href ? 'Link' : style;
    return `<Cell ss:StyleID="${effectiveStyle}"${href}><Data ss:Type="String">${xml(value)}</Data></Cell>`;
}

function row(values, style = 'Body') {
    return `<Row>${values.map(value => cell(value, style)).join('')}</Row>`;
}

function worksheet(name, headers, rows, widths = []) {
    const columns = widths.map(width => `<Column ss:Width="${width}"/>`).join('');
    return `<Worksheet ss:Name="${xml(name.slice(0, 31))}"><Table>${columns}${row(headers, 'Header')}${rows.map(item => row(item)).join('')}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
}

function accountTitle(record) {
    const data = record.data || {};
    return data.nomeAccount || data.nome || data.denominazione || data.ragioneSociale || 'Senza nome';
}

export async function buildExcelXml(uid, {includeSecrets = false} = {}) {
    const vaultKeyMaterial = await ensureVaultKeyMaterial();
    if (!vaultKeyMaterial) throw new Error('VAULT_LOCKED');
    const {records} = await collectOwnerBackup(uid);
    const opened = await Promise.all(records.map(async record => ({
        ...record, data: await openValue(record.data, record.scope, vaultKeyMaterial, includeSecrets)
    })));

    const accountRecords = opened.filter(record => record.scope === 'private-account' || record.scope === 'company-account');
    const companyNames = new Map(opened.filter(record => record.scope === 'company')
        .map(record => [record.id, accountTitle(record)]));
    const summaryCounts = new Map();
    opened.forEach(record => summaryCounts.set(record.scope, (summaryCounts.get(record.scope) || 0) + 1));
    const summaryRows = [
        ['Esportazione', new Date().toLocaleString('it-IT')],
        ['Protezione', includeSecrets ? 'ESPORTAZIONE COMPLETA: contiene segreti in chiaro' : 'Password, PIN, token e segreti mascherati'],
        ['', ''],
        ['Categoria', 'Elementi'],
        ...[...summaryCounts.entries()].map(([scope, count]) => [SCOPE_LABELS[scope] || scope, String(count)]),
        ['', ''],
        ['Account', 'Contesto', 'Apri'],
        ...accountRecords.map((record, index) => [
            accountTitle(record),
            record.companyId ? (companyNames.get(record.companyId) || 'Azienda') : 'Privato',
            {value: 'Vai alla riga Account', href: `#Account!R${index + 2}C1`}
        ])
    ];

    const accountRows = accountRecords.map(record => {
        const data = record.data || {};
        return [record.id, record.companyId || '', accountTitle(record), data.username || '', data.account || data.codice || '', data.password || '', data.url || data.sitoWeb || '', data.visibility || ''];
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

    const sheets = [
        worksheet('Consultazione', ['Voce', 'Valore', 'Collegamento'], summaryRows, [190, 330, 150]),
        worksheet('Account', ['ID', 'ID azienda', 'Nome', 'Username', 'Codice account', 'Password', 'Sito', 'Visibilità'], accountRows, [150, 130, 210, 190, 180, 90, 220, 100]),
        worksheet('Campi account', ['ID account', 'ID azienda', 'Account', 'Campo', 'Valore'], detailRows, [150, 130, 210, 210, 360])
    ];
    for (const [name, rows] of scopeSheets) {
        sheets.push(worksheet(name, ['ID record', 'ID azienda', 'ID account', 'Campo', 'Valore'], rows, [150, 130, 150, 220, 360]));
    }

    const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10"/></Style><Style ss:ID="Body"><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="Link"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Color="#0563C1" ss:Underline="Single"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Aptos" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16324F" ss:Pattern="Solid"/></Style></Styles>${sheets.join('')}</Workbook>`;
    return {workbook, recordCount: records.length, accountCount: accountRecords.length};
}

export async function exportOwnerExcel(uid, options = {}) {
    const result = await buildExcelXml(uid, options);
    const url = URL.createObjectURL(new Blob([result.workbook], {type: 'application/vnd.ms-excel;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    const suffix = options.includeSecrets ? 'completa' : 'protetta';
    link.download = `codici-password-esportazione-${suffix}-${new Date().toISOString().slice(0, 10)}.xml`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return result;
}
