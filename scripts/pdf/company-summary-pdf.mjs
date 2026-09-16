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
    const width = 595.28, height = 841.89, margin = 44, available = width - 2 * margin;
    const ink = rgb(0.10, 0.17, 0.25), muted = rgb(0.36, 0.42, 0.49), blue = rgb(0.04, 0.37, 0.72), line = rgb(0.84, 0.89, 0.94);
    const wrap = (value, font, size) => {
        const output = [];
        for (const paragraph of value.split('\n')) {
            if (!paragraph.trim()) {output.push(''); continue;}
            let current = '';
            for (const word of paragraph.trim().split(/ +/)) {
                const candidate = current ? `${current} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= available) {current = candidate; continue;}
                if (current) {output.push(current); current = '';}
                for (const char of word) {
                    if (font.widthOfTextAtSize(current + char, size) > available) {output.push(current); current = '';}
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
        page.drawRectangle({x: 0, y: height - 8, width, height: 8, color: blue});
        text('CODICI & PASSWORD', margin, height - 44, bold, 9, blue);
        text('Scheda aziendale', margin, height - 83, bold, 26, ink);
        text('Riepilogo dei dati selezionati', margin, height - 104, regular, 10, muted);
        page.drawLine({start: {x: margin, y: height - 121}, end: {x: width - margin, y: height - 121}, thickness: 1, color: line});
        y = height - 151;
    };
    newPage();
    for (const section of sections) {
        const heading = continuation => {
            for (const value of wrap(section.title + (continuation ? ' (segue)' : ''), bold, 13)) {
                if (y < 95) newPage(); text(value, margin, y, bold, 13, blue); y -= 18;
            }
            y -= 6;
        };
        if (y < 145) newPage(); heading(false);
        for (const row of section.rows) {
            check(); if (y < 115) {newPage(); heading(true);}
            for (const label of wrap(row.label.toUpperCase(), bold, 9)) {
                if (y < 95) {newPage(); heading(true);} text(label, margin, y, bold, 9, muted); y -= 13;
            }
            for (const value of wrap(row.value, regular, 11)) {
                if (y < 68) {newPage(); heading(true);} text(value, margin, y, regular, 11, ink); y -= 15;
            }
            y -= 6;
        }
        y -= 8;
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
