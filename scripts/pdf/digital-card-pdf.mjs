import {PDFDocument, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Generatore locale del PDF della Tessera digitale. Riceve soltanto la proiezione
// già filtrata dei campi selezionati: nessuna rete, DOM, storage, download o
// condivisione in questo modulo.
export async function generateDigitalCardPdf(model, {regularFont, boldFont, assertActive}) {
    const check = () => assertActive(); check();
    const validKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
    if (!validKeys(model, ['title', 'photo', 'rows']) || model.title !== 'Tessera digitale' ||
        !Array.isArray(model.rows) || !model.rows.length || model.rows.length > 200) throw Error('PDF_MODEL_INVALID');
    let total = 0;
    const cleanText = value => {
        if (typeof value !== 'string' || !value.trim() || value.length > 5000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('PDF_TEXT_INVALID');
        total += value.length; if (total > 40000) throw Error('PDF_SIZE_LIMIT');
        return value.normalize('NFC').replace(/\r\n|\r/g, '\n').replace(/\t/g, ' ');
    };
    const rows = model.rows.map(row => {
        if (!validKeys(row, ['label', 'value'])) throw Error('PDF_MODEL_INVALID');
        return {label: cleanText(row.label), value: cleanText(row.value)};
    });
    const parsePhoto = value => {
        if (value == null || value === '') return null;
        if (typeof value !== 'string' || value.length > 1500000) throw Error('PDF_PHOTO_INVALID');
        const match = value.match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/i);
        if (!match) throw Error('PDF_PHOTO_INVALID');
        let binary;
        try {binary = globalThis.atob(match[2]);} catch {throw Error('PDF_PHOTO_INVALID');}
        if (!binary.length || binary.length > 1000000) throw Error('PDF_PHOTO_INVALID');
        return {type: match[1].toLowerCase() === 'png' ? 'png' : 'jpg', bytes: Uint8Array.from(binary, char => char.charCodeAt(0))};
    };
    const photo = parsePhoto(model.photo);
    const document = await PDFDocument.create(); check(); document.registerFontkit(fontkit);
    const regular = await document.embedFont(regularFont, {subset: true}); check();
    const bold = await document.embedFont(boldFont, {subset: true}); check();
    let photoImage = null;
    if (photo) {photoImage = photo.type === 'png' ? await document.embedPng(photo.bytes) : await document.embedJpg(photo.bytes); check();}
    const supported = new Set(regular.getCharacterSet()), boldSupported = new Set(bold.getCharacterSet());
    const validateGlyphs = (value, set) => {for (const char of value) if (char !== '\n' && !set.has(char.codePointAt(0))) throw Error('PDF_UNSUPPORTED_CHARACTER');};
    for (const row of rows) {validateGlyphs(row.label.toUpperCase(), boldSupported); validateGlyphs(row.value, supported);}
    const holder = rows.find(row => row.label.toLowerCase() === 'nome e cognome')?.value || '';
    validateGlyphs(holder, boldSupported);

    const width = 595.28, height = 841.89, margin = 42, available = width - 2 * margin;
    const labelWidth = 168, valueWidth = available - labelWidth;
    const ink = rgb(0.10, 0.14, 0.20), muted = rgb(0.35, 0.39, 0.44), blue = rgb(0.04, 0.37, 0.72);
    const line = rgb(0.76, 0.79, 0.83), pale = rgb(0.96, 0.97, 0.98), white = rgb(1, 1, 1);
    const wrap = (value, font, size, maxWidth) => {
        const output = [];
        for (const paragraph of value.split('\n')) {
            if (!paragraph.trim()) {output.push(''); continue;}
            let current = '';
            for (const word of paragraph.trim().split(/ +/)) {
                const candidate = current ? `${current} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {current = candidate; continue;}
                if (current) {output.push(current); current = '';}
                for (const char of word) {
                    if (current && font.widthOfTextAtSize(current + char, size) > maxWidth) {output.push(current); current = '';}
                    current += char;
                }
            }
            if (current || !output.length) output.push(current);
        }
        return output;
    };
    let page, y;
    const drawText = (value, x, at, font, size, color) => {if (value) page.drawText(value, {x, y: at, font, size, color});};
    const drawHeader = continuation => {
        check(); if (document.getPageCount() >= 10) throw Error('PDF_PAGE_LIMIT');
        page = document.addPage([width, height]);
        const top = height - 38, box = 96;
        if (photoImage && !continuation) {
            const scale = Math.min(box / photoImage.width, box / photoImage.height);
            const w = photoImage.width * scale, h = photoImage.height * scale;
            page.drawRectangle({x: margin - 1, y: top - box - 1, width: box + 2, height: box + 2, color: white, borderColor: line, borderWidth: 0.6});
            page.drawImage(photoImage, {x: margin + (box - w) / 2, y: top - box + (box - h) / 2, width: w, height: h});
        }
        const textX = photoImage && !continuation ? margin + box + 18 : margin;
        drawText(continuation ? 'TESSERA DIGITALE - CONTINUA' : 'TESSERA DIGITALE', textX, top - 14, bold, 13, blue);
        let nameY = top - 36;
        for (const value of wrap(holder, bold, 16, width - margin - textX).slice(0, 2)) {drawText(value, textX, nameY, bold, 16, ink); nameY -= 20;}
        const headerBottom = photoImage && !continuation ? top - box - 14 : Math.min(top - 50, nameY + 4);
        page.drawLine({start: {x: margin, y: headerBottom}, end: {x: width - margin, y: headerBottom}, thickness: 1.2, color: blue});
        y = headerBottom - 16;
    };
    const ensureSpace = required => {if (y - required >= 48) return false; drawHeader(true); return true;};
    drawHeader(false);
    for (const row of rows) {
        check();
        const labels = wrap(row.label.toUpperCase(), bold, 7.2, labelWidth - 16);
        const values = wrap(row.value, regular, 9.5, valueWidth - 16);
        const rowHeight = Math.max(20, 8 + Math.max(labels.length * 9, values.length * 11));
        if (rowHeight > height - 200) throw Error('PDF_ROW_TOO_LONG');
        ensureSpace(rowHeight);
        page.drawRectangle({x: margin, y: y - rowHeight, width: labelWidth, height: rowHeight, color: pale, borderColor: line, borderWidth: 0.4});
        page.drawRectangle({x: margin + labelWidth, y: y - rowHeight, width: valueWidth, height: rowHeight, color: white, borderColor: line, borderWidth: 0.4});
        let labelY = y - 13;
        for (const value of labels) {drawText(value, margin + 8, labelY, bold, 7.2, muted); labelY -= 9;}
        let valueY = y - 13;
        for (const value of values) {drawText(value, margin + labelWidth + 8, valueY, regular, 9.5, ink); valueY -= 11;}
        y -= rowHeight;
    }
    const pages = document.getPages();
    pages.forEach((item, index) => {
        item.drawLine({start: {x: margin, y: 39}, end: {x: width - margin, y: 39}, thickness: 0.45, color: line});
        item.drawText('Documento generato da Codici & Password', {x: margin, y: 25, font: regular, size: 7.5, color: muted});
        const number = `${index + 1} / ${pages.length}`;
        item.drawText(number, {x: width - margin - regular.widthOfTextAtSize(number, 7.5), y: 25, font: regular, size: 7.5, color: muted});
    });
    document.setTitle('Tessera digitale'); document.setCreator('Codici & Password'); document.setProducer('Codici & Password');
    check(); const bytes = await document.save(); check(); return bytes;
}
