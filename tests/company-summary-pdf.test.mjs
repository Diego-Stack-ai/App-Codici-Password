import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument, PDFName} from 'pdf-lib';
import {generateCompanySummaryPdf} from '../scripts/pdf/company-summary-pdf.mjs';
const regularFont = await readFile(new URL('../Frontend/public/assets/pdf/LiberationSans-Regular.ttf', import.meta.url));
const boldFont = await readFile(new URL('../Frontend/public/assets/pdf/LiberationSans-Bold.ttf', import.meta.url));
const options = {regularFont, boldFont, assertActive() {}};
const model = () => ({title: 'Scheda aziendale', sections: [{title: 'Azienda', rows: [{label: 'Ragione sociale', value: 'Società Fittizia S.r.l.'}]}]});
test('PDF contains embedded fonts, correct title and no active actions', async () => {
    const bytes = await generateCompanySummaryPdf(model(), options), pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1); assert.equal(pdf.getTitle(), 'Scheda aziendale');
    assert.equal(pdf.catalog.has(PDFName.of('OpenAction')), false);
    assert.equal(pdf.catalog.has(PDFName.of('AA')), false);
    assert.ok(bytes.length > 1000); assert.ok(pdf.getPage(0).node.Resources());
});
test('a normal complete company sheet stays on one page and embeds its logo', async () => {
    const value = model();
    value.logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    value.sections.push(
        {title: 'Dati fiscali', rows: [['Partita IVA', '01234567890'], ['Codice SDI', 'ABC1234'], ['CCIAA', 'RM - 123456'], ['Data iscrizione', '10/07/2019']].map(([label, content]) => ({label, value: content}))},
        {title: 'Referente', rows: [['Nome', 'Diego'], ['Cognome', 'Boschetto'], ['Ruolo', 'Amministratore'], ['Cellulare', '3490000000']].map(([label, content]) => ({label, value: content}))},
        {title: 'Contatti', rows: [['Telefono', '0490000000'], ['Fax', '0490000001'], ['PEC', 'azienda@legalmail.it'], ['Email amministrazione', 'amministrazione@example.it']].map(([label, content]) => ({label, value: content}))},
        {title: 'Sede legale', rows: [['Indirizzo', 'Piazzale delle Medaglie d’Oro'], ['Civico', '7'], ['Città', 'Roma'], ['Provincia', 'RM'], ['CAP', '00136']].map(([label, content]) => ({label, value: content}))},
        {title: 'Altra sede 1', rows: [['Tipo', 'Sede operativa'], ['Indirizzo', 'Via A. Volta'], ['Civico', '23'], ['Città', 'Veggiano'], ['Provincia', 'PD'], ['CAP', '35030']].map(([label, content]) => ({label, value: content}))}
    );
    const pdf = await PDFDocument.load(await generateCompanySummaryPdf(value, options));
    assert.equal(pdf.getPageCount(), 1);
    assert.ok(pdf.getPage(0).node.Resources()?.lookup(PDFName.of('XObject')));
});
test('long fields and words paginate without silently truncating the model', async () => {
    const value = model(); value.sections[0].rows[0].value = ('Indirizzo molto lungo con città e accenti. '.repeat(160)) + 'X'.repeat(1000);
    const pdf = await PDFDocument.load(await generateCompanySummaryPdf(value, options));
    assert.ok(pdf.getPageCount() > 1 && pdf.getPageCount() < 20);
});
test('unsupported glyphs and unexpected data cannot silently enter the PDF', async () => {
    for (const mutate of [value => {value.password = 'secret';}, value => {value.sections[0].rows[0].value = '😀';},
        value => {value.sections[0].rows[0].value = 'x'.repeat(20001);}, value => {value.logo = 'data:image/svg+xml;base64,AAAA';}]) {
        const value = model(); mutate(value); await assert.rejects(generateCompanySummaryPdf(value, options));
    }
});
test('revocation during asynchronous font embedding prevents PDF output', async () => {
    let checks = 0;
    await assert.rejects(generateCompanySummaryPdf(model(), {...options, assertActive() {if (++checks > 2) throw Error('LOCKED');}}), /LOCKED/);
});
