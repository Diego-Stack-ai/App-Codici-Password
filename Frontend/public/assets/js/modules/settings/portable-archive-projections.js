const encoder = new TextEncoder();
const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function timestampDate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const seconds = Number(value.seconds ?? value._seconds);
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
    if (!Number.isSafeInteger(seconds) || !Number.isFinite(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1e9) {
        return null;
    }
    const date = new Date((seconds * 1000) + Math.floor(nanoseconds / 1e6));
    return Number.isNaN(date.getTime()) ? null : date;
}

function readableDate(value) {
    return new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC'
    }).format(value) + ' UTC';
}

function looksLikeDatePath(path) {
    return /(?:^|\.)(?:date|data|.*Date|.*At|timestamp)$/i.test(String(path || ''));
}

function readableScalar(value, path) {
    if (typeof value === 'string' && looksLikeDatePath(path)) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return readableDate(parsed);
    }
    return value;
}

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
        target[prefix] = JSON.stringify(value, (_key, child) => {
            const date = timestampDate(child);
            return date ? readableDate(date) : child;
        });
        return;
    }
    if (typeof value === 'object') {
        const date = timestampDate(value);
        if (date) {
            target[prefix] = readableDate(date);
            return;
        }
        const entries = Object.entries(value);
        if (!entries.length && prefix) target[prefix] = '{}';
        for (const [key, child] of entries) flattenValue(child, prefix ? `${prefix}.${key}` : key, target);
        return;
    }
    target[prefix] = String(readableScalar(value, prefix));
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

function columnName(index) {
    let value = index + 1;
    let output = '';
    while (value > 0) {
        value -= 1;
        output = String.fromCharCode(65 + (value % 26)) + output;
        value = Math.floor(value / 26);
    }
    return output;
}

function xlsxCell(reference, value, styleIndex = 2) {
    return `<c r="${reference}" s="${styleIndex}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(safeTabularValue(value))}</t></is></c>`;
}

function xlsxColumnWidth(table, column) {
    let width = Math.max(10, String(column).length + 2);
    for (const row of table.rows.slice(0, 500)) width = Math.max(width, String(row[column] ?? '').length + 2);
    return Math.min(60, width);
}

export function buildXlsxBytes(tables, {createdAt = new Date().toISOString()} = {}) {
    const names = uniqueSheetNames(tables);
    const worksheets = tables.map((table, sheetIndex) => {
        const header = table.columns.map((column, columnIndex) => xlsxCell(`${columnName(columnIndex)}1`, column, 1)).join('');
        const rows = table.rows.map((row, rowIndex) => {
            const cells = table.columns.map((column, columnIndex) =>
                xlsxCell(`${columnName(columnIndex)}${rowIndex + 2}`, row[column])
            ).join('');
            return `<row r="${rowIndex + 2}">${cells}</row>`;
        }).join('');
        const columns = table.columns.map((column, columnIndex) =>
            `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${xlsxColumnWidth(table, column)}" customWidth="1"/>`
        ).join('');
        const lastColumn = columnName(Math.max(0, table.columns.length - 1));
        const lastRow = Math.max(1, table.rows.length + 1);
        const filter = table.columns.length ? `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` : '';
        const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData><row r="1">${header}</row>${rows}</sheetData>${filter}</worksheet>`;
        return {name: `xl/worksheets/sheet${sheetIndex + 1}.xml`, data: xml};
    });
    const sheets = names.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
    const workbookRelationships = names.map((_name, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
    const contentTypes = worksheets.map((_sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1377D4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return createStoredZip([
        {name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${contentTypes}</Types>`},
        {name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`},
        {name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Codici &amp; Password</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(createdAt)}</dcterms:created></cp:coreProperties>`},
        {name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Codici &amp; Password</Application></Properties>`},
        {name: 'xl/workbook.xml', data: workbook},
        {name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
        {name: 'xl/styles.xml', data: styles},
        ...worksheets
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
    const xlsxBytes = buildXlsxBytes(tables, {createdAt});
    const xlsx = {filename: 'archivio-portabile.xlsx', type: XLSX_MIME, size: xlsxBytes.byteLength, content: bytesToBase64(xlsxBytes)};
    for (const file of [json, ...csv, ods, xlsx]) file.sha256 = await sha256Base64(Uint8Array.from(atob(file.content), character => character.charCodeAt(0)), cryptoApi);
    return {version: 1, json, csv, ods, xlsx};
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
    yield {kind: 'xlsx', filename: 'archivio-portabile.xlsx', type: XLSX_MIME, bytes: buildXlsxBytes(tables, {createdAt})};
}

export const PORTABLE_PROJECTION_FORMAT = Object.freeze({version: 1, odsMime: ODS_MIME, xlsxMime: XLSX_MIME});
