import {PDFDocument, rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Local byte generator. Only a checked projection enters here; no network,
// DOM, storage, automatic download or system sharing occurs in this module.
export async function generateCompanySummaryPdf(model, {regularFont, boldFont, assertActive}) {
    const check = () => assertActive(); check();
    const validKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
    if (!validKeys(model, ['title', 'logo', 'sections']) || model.title !== 'Scheda aziendale' ||
        !Array.isArray(model.sections) || !model.sections.length || model.sections.length > 100) throw Error('PDF_MODEL_INVALID');
    let total = 0, rows = 0;
    const cleanText = value => {
        if (typeof value !== 'string' || !value.trim() || value.length > 20000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('PDF_TEXT_INVALID');
        total += value.length; if (total > 110000) throw Error('PDF_SIZE_LIMIT');
        return value.normalize('NFC').replace(/\r\n|\r/g, '\n').replace(/\t/g, ' ');
    };
    const sections = model.sections.map(section => {
        if (!validKeys(section, ['title', 'rows']) || !Array.isArray(section.rows) || !section.rows.length) throw Error('PDF_MODEL_INVALID');
        return {title: cleanText(section.title), rows: section.rows.map(row => {
            if (!validKeys(row, ['label', 'value']) || ++rows > 500) throw Error('PDF_MODEL_INVALID');
            return {label: cleanText(row.label), value: cleanText(row.value)};
        })};
    });
    const parseLogo = value => {
        if (value == null || value === '') return null;
        if (typeof value !== 'string' || value.length > 1500000) throw Error('PDF_LOGO_INVALID');
        const match = value.match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/i);
        if (!match || match[2].length > 1400000) throw Error('PDF_LOGO_INVALID');
        let binary;
        try {binary = globalThis.atob(match[2]);} catch {throw Error('PDF_LOGO_INVALID');}
        if (!binary.length || binary.length > 1000000) throw Error('PDF_LOGO_INVALID');
        return {type: match[1].toLowerCase() === 'png' ? 'png' : 'jpg', bytes: Uint8Array.from(binary, char => char.charCodeAt(0))};
    };
    const logo = parseLogo(model.logo);
    const document = await PDFDocument.create(); check(); document.registerFontkit(fontkit);
    const regular = await document.embedFont(regularFont, {subset: true}); check();
    const bold = await document.embedFont(boldFont, {subset: true}); check();
    let logoImage = null;
    if (logo) {logoImage = logo.type === 'png' ? await document.embedPng(logo.bytes) : await document.embedJpg(logo.bytes); check();}
    const supported = new Set(regular.getCharacterSet()), boldSupported = new Set(bold.getCharacterSet());
    const validateGlyphs = (value, set) => {for (const char of value) if (char !== '\n' && !set.has(char.codePointAt(0))) throw Error('PDF_UNSUPPORTED_CHARACTER');};
    for (const section of sections) {
        validateGlyphs(section.title, boldSupported);
        for (const row of section.rows) {validateGlyphs(row.label.toUpperCase(), boldSupported); validateGlyphs(row.value, supported);}
    }
    const companyName = sections.flatMap(section => section.rows).find(row => row.label.toLowerCase() === 'ragione sociale')?.value || 'Scheda aziendale';
    validateGlyphs(companyName, boldSupported);
    const sectionByTitle = title => sections.find(section => section.title.toLowerCase() === title)?.rows || [];
    const field = (source, label) => source.find(row => row.label.toLowerCase() === label)?.value || '';
    const legal = sectionByTitle('sede legale'), fiscal = sectionByTitle('dati fiscali'), contacts = sectionByTitle('contatti');
    const legalAddress = [field(legal, 'indirizzo'), field(legal, 'civico')].filter(Boolean).join(', ');
    const legalCity = [field(legal, 'cap'), field(legal, 'città'), field(legal, 'provincia') ? `(${field(legal, 'provincia')})` : ''].filter(Boolean).join(' ');
    const headerLines = [
        [legalAddress, legalCity].filter(Boolean).join(' - '),
        [field(fiscal, 'partita iva') ? `P.IVA ${field(fiscal, 'partita iva')}` : '', field(fiscal, 'codice sdi') ? `SDI ${field(fiscal, 'codice sdi')}` : ''].filter(Boolean).join(' - '),
        [field(contacts, 'telefono') ? `Tel. ${field(contacts, 'telefono')}` : '', field(contacts, 'pec')].filter(Boolean).join(' - ')
    ].filter(Boolean);
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
    const drawText = (value, x, at, font, size, color, options = {}) => {if (value) page.drawText(value, {x, y: at, font, size, color, ...options});};
    const drawHeader = continuation => {
        check(); if (document.getPageCount() >= 40) throw Error('PDF_PAGE_LIMIT');
        page = document.addPage([width, height]);
        const top = height - 38;
        if (logoImage) {
            const scale = Math.min(150 / logoImage.width, 54 / logoImage.height, 1);
            page.drawImage(logoImage, {x: margin, y: top - logoImage.height * scale, width: logoImage.width * scale, height: logoImage.height * scale});
        } else {
            page.drawRectangle({x: margin, y: top - 46, width: 46, height: 46, color: blue});
            const initials = companyName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || 'AZ';
            const initialsWidth = bold.widthOfTextAtSize(initials, 15);
            drawText(initials, margin + (46 - initialsWidth) / 2, top - 29, bold, 15, white);
        }
        const nameLines = wrap(companyName, bold, 12, 290).slice(0, 2);
        let nameY = top - 4;
        for (const value of nameLines) {drawText(value, width - margin - bold.widthOfTextAtSize(value, 12), nameY, bold, 12, ink); nameY -= 15;}
        for (const lineValue of headerLines.flatMap(value => wrap(value, regular, 7.5, 290)).slice(0, 4)) {
            drawText(lineValue, width - margin - regular.widthOfTextAtSize(lineValue, 7.5), nameY, regular, 7.5, muted); nameY -= 10;
        }
        page.drawLine({start: {x: margin, y: height - 105}, end: {x: width - margin, y: height - 105}, thickness: 1.2, color: blue});
        const title = continuation ? 'SCHEDA AZIENDALE - CONTINUA' : 'SCHEDA AZIENDALE';
        drawText(title, (width - bold.widthOfTextAtSize(title, 13)) / 2, height - 126, bold, 13, ink);
        y = height - 142;
    };
    const ensureSpace = required => {
        if (y - required >= 48) return false;
        drawHeader(true); return true;
    };
    const drawSectionTitle = (title, continuation = false) => {
        page.drawRectangle({x: margin, y: y - 15, width: available, height: 15, color: blue});
        drawText(`${title.toUpperCase()}${continuation ? ' - SEGUE' : ''}`, margin + 8, y - 11, bold, 7.7, white);
        y -= 15;
    };
    drawHeader(false);
    for (const section of sections) {
        ensureSpace(35); drawSectionTitle(section.title);
        for (const row of section.rows) {
            check();
            const labels = wrap(row.label.toUpperCase(), bold, 7.2, labelWidth - 16);
            const values = wrap(row.value, regular, 8.8, valueWidth - 16);
            let offset = 0, firstSegment = true;
            while (offset < values.length) {
                const segmentLabels = firstSegment ? labels : wrap(`${row.label.toUpperCase()} - SEGUE`, bold, 7.2, labelWidth - 16);
                const labelHeight = segmentLabels.length * 9;
                const capacity = Math.max(1, Math.floor((y - 48 - 7) / 10));
                const segmentValues = values.slice(offset, offset + capacity);
                const rowHeight = Math.max(18, 7 + Math.max(labelHeight, segmentValues.length * 10));
                if (ensureSpace(rowHeight)) drawSectionTitle(section.title, true);
                page.drawRectangle({x: margin, y: y - rowHeight, width: labelWidth, height: rowHeight, color: pale, borderColor: line, borderWidth: 0.4});
                page.drawRectangle({x: margin + labelWidth, y: y - rowHeight, width: valueWidth, height: rowHeight, color: white, borderColor: line, borderWidth: 0.4});
                let labelY = y - 12;
                for (const value of segmentLabels) {drawText(value, margin + 8, labelY, bold, 7.2, muted); labelY -= 9;}
                let valueY = y - 12;
                for (const value of segmentValues) {drawText(value, margin + labelWidth + 8, valueY, regular, 8.8, ink); valueY -= 10;}
                y -= rowHeight; offset += segmentValues.length; firstSegment = false;
                if (offset < values.length) {drawHeader(true); drawSectionTitle(section.title, true);}
            }
        }
        y -= 4;
    }
    const pages = document.getPages();
    pages.forEach((item, index) => {
        item.drawLine({start: {x: margin, y: 39}, end: {x: width - margin, y: 39}, thickness: 0.45, color: line});
        item.drawText('Documento generato da Codici & Password', {x: margin, y: 25, font: regular, size: 7.5, color: muted});
        const number = `${index + 1} / ${pages.length}`;
        item.drawText(number, {x: width - margin - regular.widthOfTextAtSize(number, 7.5), y: 25, font: regular, size: 7.5, color: muted});
    });
    document.setTitle('Scheda aziendale'); document.setCreator('Codici & Password'); document.setProducer('Codici & Password');
    check(); const bytes = await document.save(); check(); return bytes;
}
