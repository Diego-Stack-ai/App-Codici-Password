import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument, PDFName} from 'pdf-lib';
import {generateCompanySummaryPdf} from './company-summary-pdf.mjs';
const regularFont = await readFile(new URL('./assets/pdf/LiberationSans-Regular.ttf', import.meta.url));
const boldFont = await readFile(new URL('./assets/pdf/LiberationSans-Bold.ttf', import.meta.url));
const options = {regularFont, boldFont, assertActive() {}};
const model = () => ({title: 'Scheda aziendale', sections: [{title: 'Azienda', rows: [{label: 'Ragione sociale', value: 'Società Fittizia S.r.l.'}]}]});
test('PDF contains embedded fonts, correct title and no active actions', async () => {
    const bytes = await generateCompanySummaryPdf(model(), options), pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1); assert.equal(pdf.getTitle(), 'Scheda aziendale');
    assert.equal(pdf.catalog.has(PDFName.of('OpenAction')), false);
    assert.equal(pdf.catalog.has(PDFName.of('AA')), false);
    assert.ok(bytes.length > 1000); assert.ok(pdf.getPage(0).node.Resources());
});
test('long fields and words paginate without silently truncating the model', async () => {
    const value = model(); value.sections[0].rows[0].value = ('Indirizzo molto lungo con città e accenti. '.repeat(160)) + 'X'.repeat(1000);
    const pdf = await PDFDocument.load(await generateCompanySummaryPdf(value, options));
    assert.ok(pdf.getPageCount() > 1 && pdf.getPageCount() < 20);
});
test('unsupported glyphs and unexpected data cannot silently enter the PDF', async () => {
    for (const mutate of [value => {value.password = 'secret';}, value => {value.sections[0].rows[0].value = '😀';},
        value => {value.sections[0].rows[0].value = 'x'.repeat(20001);}]) {
        const value = model(); mutate(value); await assert.rejects(generateCompanySummaryPdf(value, options));
    }
});
test('revocation during asynchronous font embedding prevents PDF output', async () => {
    let checks = 0;
    await assert.rejects(generateCompanySummaryPdf(model(), {...options, assertActive() {if (++checks > 2) throw Error('LOCKED');}}), /LOCKED/);
});
