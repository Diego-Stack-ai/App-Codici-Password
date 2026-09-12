import {strToU8, zipSync} from '/assets/js/vendor/fflate.js';

const escapeXml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function columnName(index) {
    let value = index + 1;
    let name = '';
    while (value) {
        value -= 1;
        name = String.fromCharCode(65 + (value % 26)) + name;
        value = Math.floor(value / 26);
    }
    return name;
}

function cellXml(cell, rowIndex, columnIndex) {
    const address = `${columnName(columnIndex)}${rowIndex}`;
    const data = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : {value: cell};
    const style = Number.isInteger(data.style) ? ` s="${data.style}"` : '';
    if (data.formula) return `<c r="${address}" t="str"${style}><f>${escapeXml(data.formula)}</f><v>${escapeXml(data.cached || '')}</v></c>`;
    if (typeof data.value === 'number') return `<c r="${address}"${style}><v>${data.value}</v></c>`;
    if (typeof data.value === 'boolean') return `<c r="${address}" t="b"${style}><v>${data.value ? 1 : 0}</v></c>`;
    return `<c r="${address}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(data.value)}</t></is></c>`;
}

function sheetXml(rows, {widths = [], freezeRows = 0, autoFilter = '', validations = [], merges = []} = {}) {
    const maxColumns = Math.max(1, ...rows.map(row => row.length));
    const dimension = `A1:${columnName(maxColumns - 1)}${Math.max(1, rows.length)}`;
    const cols = widths.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` : '';
    const pane = freezeRows ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const body = rows.map((row, rowOffset) => `<row r="${rowOffset + 1}">${row.map((cell, columnIndex) => cellXml(cell, rowOffset + 1, columnIndex)).join('')}</row>`).join('');
    const validationXml = validations.length ? `<dataValidations count="${validations.length}">${validations.map(item => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${item.range}"><formula1>${escapeXml(item.formula)}</formula1></dataValidation>`).join('')}</dataValidations>` : '';
    const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/>${pane}<sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${body}</sheetData>${autoFilter ? `<autoFilter ref="${autoFilter}"/>` : ''}${mergeXml}${validationXml}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="10"/><name val="Aptos"/></font><font><b/><sz val="15"/><color rgb="FF0F172A"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="10"/><color rgb="FF334155"/><name val="Aptos"/></font><font><u/><sz val="10"/><color rgb="FF0563C1"/><name val="Aptos"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF16324F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE4E6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function lookupFormula(column, accountEndRow) {
    return `IFERROR(INDEX(Account!$${column}$2:$${column}$${accountEndRow},MATCH($B$5,Account!$K$2:$K$${accountEndRow},0)),"")`;
}

export function createVaultXlsx({accountRows, detailRows, otherSheets, companies, includeSecrets}) {
    const accountEndRow = Math.max(2, accountRows.length + 1);
    const companyEndRow = Math.max(2, companies.length + 1);
    const accountKeys = accountRows.map(row => row[10]);
    const listEndRow = Math.max(2, accountKeys.length + 1);
    const defaultAccount = accountKeys[0] || '';
    const defaultRow = accountRows[0] || [];
    const consultation = [
        [{value: 'Consultazione archivio Codici & Password', style: 1}],
        [{
            value: includeSecrets
                ? 'ATTENZIONE: il file contiene credenziali e segreti in chiaro.'
                : 'Copia protetta: password, PIN e segreti sono mascherati.',
            style: includeSecrets ? 6 : 0
        }],
        [{value: 'Area', style: 3}, {value: 'Privato', style: 4}],
        [{value: 'Azienda', style: 3}, {value: companies[0] || '', style: 4}],
        [{value: 'Account', style: 3}, {value: defaultAccount, style: 4}],
        [],
        [{value: 'Campo', style: 2}, {value: 'Valore', style: 2}],
        [{value: 'Nome', style: 3}, {formula: lookupFormula('E', accountEndRow), cached: defaultRow[4], style: 5}],
        [{value: 'Contesto', style: 3}, {formula: lookupFormula('B', accountEndRow), cached: defaultRow[1], style: 5}],
        [{value: 'Azienda', style: 3}, {formula: lookupFormula('D', accountEndRow), cached: defaultRow[3], style: 5}],
        [{value: 'Username', style: 3}, {formula: lookupFormula('F', accountEndRow), cached: defaultRow[5], style: 5}],
        [{value: 'Account / Codice', style: 3}, {formula: lookupFormula('G', accountEndRow), cached: defaultRow[6], style: 5}],
        [{value: 'Password', style: 3}, {formula: lookupFormula('H', accountEndRow), cached: defaultRow[7], style: 5}],
        [{value: 'Sito', style: 3}, {formula: lookupFormula('I', accountEndRow), cached: defaultRow[8], style: 5}],
        [{value: 'Visibilità', style: 3}, {formula: lookupFormula('J', accountEndRow), cached: defaultRow[9], style: 5}],
        [],
        [{value: 'Apri dati modificabili', style: 3}, {formula: `IFERROR(HYPERLINK("#Account!A"&(MATCH($B$5,Account!$K$2:$K$${accountEndRow},0)+1),"Vai alla riga Account"),"")`, cached: defaultAccount ? 'Vai alla riga Account' : '', style: 7}],
        [{value: 'Campi aggiuntivi', style: 3}, {formula: `IFERROR(HYPERLINK("#'Campi account'!A"&MATCH(INDEX(Account!$A$2:$A$${accountEndRow},MATCH($B$5,Account!$K$2:$K$${accountEndRow},0)),'Campi account'!$A$2:$A$${Math.max(2, detailRows.length + 1)},0)+1,"Vai ai campi dell'Account"),"Nessun campo aggiuntivo")`, cached: defaultAccount ? "Vai ai campi dell'Account" : 'Nessun campo aggiuntivo', style: 7}],
        [],
        [{value: 'Per modificare un valore, usa il collegamento e modifica la cella nella tabella. Tornando qui, la maschera si aggiorna.', style: 0}]
    ];
    const accountSheetRows = [[
        ...['ID', 'Tipo', 'ID azienda', 'Azienda', 'Nome', 'Username', 'Account / Codice', 'Password', 'Sito', 'Visibilità', 'Chiave selezione'].map(value => ({value, style: 2}))
    ], ...accountRows.map(row => row.map(value => ({value, style: 5})))];
    const detailSheetRows = [[
        ...['ID account', 'ID azienda', 'Account', 'Campo', 'Valore'].map(value => ({value, style: 2}))
    ], ...detailRows.map(row => row.map(value => ({value, style: 5})))];
    const listRows = [['Aree', 'Aziende', 'Account']];
    const listLength = Math.max(3, companies.length + 1, accountKeys.length + 1);
    for (let index = 0; index < listLength; index += 1) listRows.push([
        ['Profilo', 'Privato', 'Azienda'][index] || '', companies[index] || '', accountKeys[index] || ''
    ]);

    const sheets = [
        {name: 'Consultazione', xml: sheetXml(consultation, {
            widths: [27, 65], merges: ['A1:B1', 'A2:B2', 'A20:B20'],
            validations: [
                {range: 'B3', formula: "'_Liste'!$A$2:$A$4"},
                {range: 'B4', formula: `'_Liste'!$B$2:$B$${companyEndRow}`},
                {range: 'B5', formula: `'_Liste'!$C$2:$C$${listEndRow}`}
            ]
        })},
        {name: 'Account', xml: sheetXml(accountSheetRows, {widths: [18, 13, 18, 25, 30, 30, 28, 28, 34, 16, 55], freezeRows: 1, autoFilter: `A1:K${accountEndRow}`})},
        {name: 'Campi account', xml: sheetXml(detailSheetRows, {widths: [18, 18, 30, 32, 55], freezeRows: 1, autoFilter: `A1:E${Math.max(2, detailRows.length + 1)}`})}
    ];
    for (const [name, rows] of otherSheets) {
        const values = [[...['ID record', 'ID azienda', 'ID account', 'Campo', 'Valore'].map(value => ({value, style: 2}))],
            ...rows.map(row => row.map(value => ({value, style: 5})))];
        sheets.push({name, xml: sheetXml(values, {widths: [18, 18, 18, 32, 55], freezeRows: 1, autoFilter: `A1:E${Math.max(2, values.length)}`})});
    }
    sheets.push({name: '_Liste', hidden: true, xml: sheetXml(listRows, {widths: [15, 35, 60]})});

    const sheetEntries = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" state="${sheet.hidden ? 'hidden' : 'visible'}" r:id="rId${index + 1}"/>`).join('');
    const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
    const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const files = {
        '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`),
        '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
        'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetEntries}</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`),
        'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
        'xl/styles.xml': strToU8(stylesXml)
    };
    sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheet.xml); });
    return zipSync(files, {level: 6});
}
