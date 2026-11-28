import {inflateSync} from 'node:zlib';
import {PDFDocument, PDFName, PDFRawStream, PDFDict, PDFRef} from 'pdf-lib';

// Estrazione del testo dai PDF prodotti con pdf-lib e font incorporati (glifi esadecimali
// mappati con la CMap ToUnicode). Solo per i test: nessuno strumento di sistema richiesto.
const decode = stream => {
    const filter = stream.dict.get(PDFName.of('Filter'));
    return Buffer.from(filter === PDFName.of('FlateDecode') ? inflateSync(stream.contents) : stream.contents).toString('latin1');
};
const lookup = (pdf, value) => value instanceof PDFRef ? pdf.context.lookup(value) : value;
function unicodeMap(pdf, font) {
    const map = new Map(), toUnicode = lookup(pdf, font.get(PDFName.of('ToUnicode')));
    if (!(toUnicode instanceof PDFRawStream)) return map;
    const cmap = decode(toUnicode), hex = value => String.fromCodePoint(...(value.match(/.{4}/g) || []).map(part => parseInt(part, 16)));
    for (const [, block] of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
        for (const [, code, text] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(code.toUpperCase(), hex(text.toUpperCase()));
    }
    for (const [, block] of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
        for (const [, start, end, text] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
            for (let code = parseInt(start, 16), offset = 0; code <= parseInt(end, 16); code++, offset++) {
                map.set(code.toString(16).toUpperCase().padStart(start.length, '0'), String.fromCodePoint(parseInt(text, 16) + offset));
            }
        }
    }
    return map;
}
export async function extractPdfText(bytes) {
    const pdf = await PDFDocument.load(bytes), lines = [];
    for (const page of pdf.getPages()) {
        const fonts = lookup(pdf, page.node.Resources()?.get(PDFName.of('Font')));
        const maps = new Map();
        if (fonts instanceof PDFDict) for (const [name, ref] of fonts.entries()) maps.set(name.asString().slice(1), unicodeMap(pdf, lookup(pdf, ref)));
        const contents = lookup(pdf, page.node.get(PDFName.of('Contents')));
        const streams = Array.isArray(contents?.array) ? contents.array.map(ref => lookup(pdf, ref)) : [contents];
        let map = new Map();
        for (const stream of streams.filter(item => item instanceof PDFRawStream)) {
            for (const [, font, glyphs] of decode(stream).matchAll(/\/(\S+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]*)>\s*Tj/g)) {
                if (font) {map = maps.get(font) || new Map(); continue;}
                lines.push((glyphs.match(/.{4}/g) || []).map(code => map.get(code.toUpperCase()) ?? '').join(''));
            }
        }
    }
    return lines.join('\n');
}
