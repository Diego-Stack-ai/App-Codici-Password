const encoder = new TextEncoder();
const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

function bytesToBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function xmlEscape(value) {
    return String(value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '\uFFFD')
        .replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
        })[character]);
}

function sanitizeFilename(value, fallback) {
    const normalized = String(value || fallback)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return normalized || fallback;
}

function flattenValue(value, prefix, target) {
    if (value === null || value === undefined) {
        if (prefix) target[prefix] = '';
        return;
    }
    if (Array.isArray(value)) {
        target[prefix] = JSON.stringify(value);
        return;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (!entries.length && prefix) target[prefix] = '{}';
        for (const [key, child] of entries) flattenValue(child, prefix ? `${prefix}.${key}` : key, target);
        return;
    }
    target[prefix] = String(value);
}

export function buildProjectionTables(records = []) {
    const grouped = new Map();
    for (const record of records) {
        const row = {
            key: record.key || '', scope: record.scope || '', id: record.id || '',
            companyId: record.companyId || '', accountId: record.accountId || '', title: record.title || ''
        };
        flattenValue(record.data || {}, 'data', row);
        const scope = record.scope || 'record';
        if (!grouped.has(scope)) grouped.set(scope, []);
        grouped.get(scope).push(row);
    }
    if (!grouped.size) grouped.set('riepilogo', []);
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([scope, rows]) => {
        const dynamic = new Set();
        for (const row of rows) for (const key of Object.keys(row)) dynamic.add(key);
        const fixed = ['key', 'scope', 'id', 'companyId', 'accountId', 'title'];
        const columns = [...fixed.filter(key => dynamic.has(key) || key === 'key' || key === 'scope'),
            ...[...dynamic].filter(key => !fixed.includes(key)).sort()];
        return {scope, columns, rows};
    });
}

function safeTabularValue(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
    const text = safeTabularValue(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvEntry(table) {
    const lines = [table.columns.map(csvCell).join(',')];
    for (const row of table.rows) lines.push(table.columns.map(column => csvCell(row[column])).join(','));
    const bytes = encoder.encode(`\uFEFF${lines.join('\r\n')}\r\n`);
    return {scope: table.scope, filename: `${sanitizeFilename(table.scope, 'dati')}.csv`,
        type: 'text/csv;charset=utf-8', size: bytes.byteLength, bytes};
}

export function buildCsvFiles(tables) {
    return tables.map(table => {
        const entry = csvEntry(table);
        const content = bytesToBase64(entry.bytes);
        entry.bytes.fill(0);
        return {scope: entry.scope, filename: entry.filename, type: entry.type, size: entry.size, content};
    });
}

let crcTable;
function crc32(bytes) {
    if (!crcTable) {
        crcTable = new Uint32Array(256);
        for (let index = 0; index < 256; index += 1) {
            let value = index;
            for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
            crcTable[index] = value >>> 0;
        }
    }
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function uint16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
}

function uint32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
}

function concatBytes(parts) {
    const size = parts.reduce((total, part) => total + part.byteLength, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }
    return output;
}

function createStoredZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const entry of entries) {
        const name = encoder.encode(entry.name);
        const data = entry.data instanceof Uint8Array ? entry.data : encoder.encode(entry.data);
        const checksum = crc32(data);
        const local = concatBytes([
            uint32(0x04034B50), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0x0021),
            uint32(checksum), uint32(data.byteLength), uint32(data.byteLength), uint16(name.byteLength), uint16(0), name, data
        ]);
        localParts.push(local);
        centralParts.push(concatBytes([
            uint32(0x02014B50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0x0021),
            uint32(checksum), uint32(data.byteLength), uint32(data.byteLength), uint16(name.byteLength), uint16(0),
            uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), name
        ]));
        offset += local.byteLength;
    }
    const central = concatBytes(centralParts);
    const end = concatBytes([
        uint32(0x06054B50), uint16(0), uint16(0), uint16(entries.length), uint16(entries.length),
        uint32(central.byteLength), uint32(offset), uint16(0)
    ]);
    return concatBytes([...localParts, central, end]);
}

function uniqueSheetNames(tables) {
    const used = new Set();
    return tables.map(table => {
        const base = String(table.scope || 'Dati').replace(/[\\/:?*\[\]]/g, ' ').trim().slice(0, 31) || 'Dati';
        let name = base;
        let suffix = 2;
        while (used.has(name.toLocaleLowerCase('it'))) {
            const marker = ` ${suffix++}`;
            name = `${base.slice(0, 31 - marker.length)}${marker}`;
        }
        used.add(name.toLocaleLowerCase('it'));
        return name;
    });
}

export function buildOdsBytes(tables, {createdAt = new Date().toISOString()} = {}) {
    const sheetNames = uniqueSheetNames(tables);
    const cell = value => `<table:table-cell office:value-type="string"><text:p>${xmlEscape(safeTabularValue(value))}</text:p></table:table-cell>`;
    const sheets = tables.map((table, index) => {
        const header = `<table:table-row>${table.columns.map(cell).join('')}</table:table-row>`;
        const rows = table.rows.map(row => `<table:table-row>${table.columns.map(column => cell(row[column])).join('')}</table:table-row>`).join('');
        return `<table:table table:name="${xmlEscape(sheetNames[index])}">${header}${rows}</table:table>`;
    }).join('');
    const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:spreadsheet>${sheets}</office:spreadsheet></office:body></office:document-content>`;
    const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"><office:styles/></office:document-styles>`;
    const meta = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2"><office:meta><meta:generator>Codici &amp; Password</meta:generator><meta:creation-date>${xmlEscape(createdAt)}</meta:creation-date></office:meta></office:document-meta>`;
    const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ODS_MIME}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
    return createStoredZip([
        {name: 'mimetype', data: ODS_MIME}, {name: 'content.xml', data: content},
        {name: 'styles.xml', data: styles}, {name: 'meta.xml', data: meta},
        {name: 'META-INF/manifest.xml', data: manifest}
    ]);
}

export async function sha256Base64(bytes, cryptoApi = crypto) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return bytesToBase64(await cryptoApi.subtle.digest('SHA-256', data));
}

export async function buildPortableProjections(records, {createdAt = new Date().toISOString(), cryptoApi = crypto} = {}) {
    const tables = buildProjectionTables(records);
    const jsonBytes = encoder.encode(JSON.stringify({format: 'codici-password-portable-data', version: 1, records}, null, 2));
    const json = {
        filename: 'dati-completi.json', type: 'application/json;charset=utf-8',
        size: jsonBytes.byteLength, content: bytesToBase64(jsonBytes)
    };
    const csv = buildCsvFiles(tables);
    const odsBytes = buildOdsBytes(tables, {createdAt});
    const ods = {filename: 'archivio-portabile.ods', type: ODS_MIME, size: odsBytes.byteLength, content: bytesToBase64(odsBytes)};
    for (const file of [json, ...csv, ods]) file.sha256 = await sha256Base64(Uint8Array.from(atob(file.content), character => character.charCodeAt(0)), cryptoApi);
    return {version: 1, json, csv, ods};
}

export async function *iteratePortableProjectionEntries(records, {createdAt = new Date().toISOString()} = {}) {
    const tables = buildProjectionTables(records);
    yield {
        kind: 'json', filename: 'dati-completi.json', type: 'application/json;charset=utf-8',
        bytes: encoder.encode(JSON.stringify({format: 'codici-password-portable-data', version: 2, schemaVersion: 1, records}, null, 2))
    };
    for (const table of tables) {
        const entry = csvEntry(table);
        yield {kind: 'csv', filename: entry.filename, type: entry.type, bytes: entry.bytes};
    }
    yield {kind: 'ods', filename: 'archivio-portabile.ods', type: ODS_MIME, bytes: buildOdsBytes(tables, {createdAt})};
}

export const PORTABLE_PROJECTION_FORMAT = Object.freeze({version: 1, odsMime: ODS_MIME});
