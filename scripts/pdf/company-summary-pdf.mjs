import {PDFDocument, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Local byte generator. Only a checked projection enters here; no network,
// DOM, storage, automatic download or system sharing occurs in this module.
export async function generateCompanySummaryPdf(model, {regularFont, boldFont, assertActive}) {
    const check = () => assertActive(); check();
    const validKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
    if (!validKeys(model, ['title', 'sections']) || model.title !== 'Scheda aziendale' || !Array.isArray(model.sections) || !model.sections.length || model.sections.length > 100) throw Error('PDF_MODEL_INVALID');
    let total = 0, rows = 0;
    const sections = model.sections.map(section => {
        if (!validKeys(section, ['title', 'rows']) || !Array.isArray(section.rows) || !section.rows.length) throw Error('PDF_MODEL_INVALID');
        const text = value => {
            if (typeof value !== 'string' || !value.trim() || value.length > 20000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('PDF_TEXT_INVALID');
            total += value.length; if (total > 110000) throw Error('PDF_SIZE_LIMIT');
            return value.normalize('NFC').replace(/\r\n|\r/g, '\n').replace(/\t/g, ' ');
        };
        return {title: text(section.title), rows: section.rows.map(row => {
            if (!validKeys(row, ['label', 'value']) || ++rows > 500) throw Error('PDF_MODEL_INVALID');
            return {label: text(row.label), value: text(row.value)};
        })};
    });
    const document = await PDFDocument.create(); check(); document.registerFontkit(fontkit);
    const regular = await document.embedFont(regularFont, {subset: true}); check();
    const bold = await document.embedFont(boldFont, {subset: true}); check();
    const supported = new Set(regular.getCharacterSet()), boldSupported = new Set(bold.getCharacterSet());
    const validateGlyphs = (value, set) => {for (const char of value) if (char !== '\n' && !set.has(char.codePointAt(0))) throw Error('PDF_UNSUPPORTED_CHARACTER');};
    for (const section of sections) {
        validateGlyphs(section.title, boldSupported);
        for (const row of section.rows) {validateGlyphs(row.label.toUpperCase(), boldSupported); validateGlyphs(row.value, supported);}
    }
    const width = 595.28, height = 841.89, margin = 40, available = width - 2 * margin;
    const gap = 12, columnWidth = (available - gap) / 2;
    const ink = rgb(0.10, 0.17, 0.25), muted = rgb(0.36, 0.42, 0.49), blue = rgb(0.04, 0.37, 0.72);
    const line = rgb(0.84, 0.89, 0.94), panel = rgb(0.96, 0.98, 1), white = rgb(1, 1, 1);
    const wrap = (value, font, size, maxWidth = available) => {
        const output = [];
        for (const paragraph of value.split('\n')) {
            if (!paragraph.trim()) {output.push(''); continue;}
            let current = '';
            for (const word of paragraph.trim().split(/ +/)) {
                const candidate = current ? `${current} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {current = candidate; continue;}
                if (current) {output.push(current); current = '';}
                for (const char of word) {
                    if (font.widthOfTextAtSize(current + char, size) > maxWidth) {output.push(current); current = '';}
                    current += char;
                }
            }
            output.push(current);
        }
        return output;
    };
    let page, y;
    const text = (value, x, at, font, size, color) => {if (value) page.drawText(value, {x, y: at, font, size, color});};
    const newPage = () => {
        check(); if (document.getPageCount() >= 40) throw Error('PDF_PAGE_LIMIT');
        page = document.addPage([width, height]);
        page.drawRectangle({x: 0, y: height - 116, width, height: 116, color: blue});
        text('CODICI & PASSWORD', margin, height - 38, bold, 9, white);
        text('Scheda aziendale', margin, height - 75, bold, 25, white);
        text('Riepilogo ordinato dei dati selezionati', margin, height - 96, regular, 10, white);
        y = height - 142;
    };
    newPage();
    for (const section of sections) {
        const heading = continuation => {
            for (const value of wrap(section.title + (continuation ? ' (segue)' : ''), bold, 13)) {
                if (y < 92) newPage(); text(value, margin, y, bold, 13, blue); y -= 18;
            }
            y -= 4;
        };
        if (y < 145) newPage(); heading(false);
        for (let index = 0; index < section.rows.length;) {
            check();
            const first = section.rows[index];
            const firstWide = first.value.includes('\n') || first.value.length > 72;
            const second = !firstWide ? section.rows[index + 1] : null;
            const secondWide = second && (second.value.includes('\n') || second.value.length > 72);
            const pair = second && !secondWide ? [first, second] : [first];
            const cellWidth = pair.length === 2 ? columnWidth : available;
            const innerWidth = cellWidth - 22;
            const prepared = pair.map(row => ({
                labels: wrap(row.label.toUpperCase(), bold, 8, innerWidth),
                values: wrap(row.value, regular, 10.5, innerWidth)
            }));
            const blockHeight = Math.max(...prepared.map(cell => 18 + cell.labels.length * 11 + cell.values.length * 14)) + 12;
            if (pair.length === 1 && blockHeight > y - 58) {
                const cell = prepared[0];
                let offset = 0;
                while (offset < cell.values.length) {
                    const labelLines = cell.labels.length;
                    const capacity = Math.max(1, Math.floor((y - 70 - labelLines * 11) / 14));
                    if (capacity < 2) {newPage(); heading(true); continue;}
                    const values = cell.values.slice(offset, offset + capacity);
                    const segmentHeight = 30 + labelLines * 11 + values.length * 14;
                    page.drawRectangle({x: margin, y: y - segmentHeight, width: available, height: segmentHeight,
                        color: panel, borderColor: line, borderWidth: 0.6});
                    let cursor = y - 15;
                    for (const label of cell.labels) {text(label, margin + 11, cursor, bold, 8, muted); cursor -= 11;}
                    cursor -= 2;
                    for (const value of values) {text(value, margin + 11, cursor, regular, 10.5, ink); cursor -= 14;}
                    offset += values.length;
                    y -= segmentHeight + 9;
                    if (offset < cell.values.length) {newPage(); heading(true);}
                }
                index += 1;
                continue;
            }
            if (y - blockHeight < 58) {newPage(); heading(true);}
            pair.forEach((row, cellIndex) => {
                const x = margin + cellIndex * (columnWidth + gap);
                page.drawRectangle({x, y: y - blockHeight, width: cellWidth, height: blockHeight,
                    color: panel, borderColor: line, borderWidth: 0.6});
                let cursor = y - 15;
                for (const label of prepared[cellIndex].labels) {text(label, x + 11, cursor, bold, 8, muted); cursor -= 11;}
                cursor -= 2;
                for (const value of prepared[cellIndex].values) {text(value, x + 11, cursor, regular, 10.5, ink); cursor -= 14;}
            });
            y -= blockHeight + 9;
            index += pair.length;
        }
        y -= 10;
    }
    const pages = document.getPages();
    pages.forEach((item, index) => {
        item.drawLine({start: {x: margin, y: 43}, end: {x: width - margin, y: 43}, thickness: 0.5, color: line});
        item.drawText('Scheda aziendale', {x: margin, y: 28, font: regular, size: 8, color: muted});
        const number = `${index + 1} / ${pages.length}`;
        item.drawText(number, {x: width - margin - regular.widthOfTextAtSize(number, 8), y: 28, font: regular, size: 8, color: muted});
    });
    document.setTitle('Scheda aziendale'); document.setCreator('Codici & Password'); document.setProducer('Codici & Password');
    check(); const bytes = await document.save(); check(); return bytes;
}
