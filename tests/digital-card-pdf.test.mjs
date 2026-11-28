import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument, PDFName} from 'pdf-lib';
import {extractPdfText} from './pdf-text.mjs';
import {generateDigitalCardPdf} from '../scripts/pdf/company-summary-pdf.mjs';

// Tessera digitale in PDF (issue #379) con dati esclusivamente sintetici.
const read = file => readFile(new URL('../Frontend/public/' + file, import.meta.url), 'utf8');
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const {buildVCard} = await import(asModule(await read('assets/js/modules/shared/qr_code_utils-v2.js')));
const model = await import(asModule(await read('assets/js/modules/privato/digital-card-pdf-model.js')));
const regularFont = await readFile(new URL('../Frontend/public/assets/pdf/LiberationSans-Regular.ttf', import.meta.url));
const boldFont = await readFile(new URL('../Frontend/public/assets/pdf/LiberationSans-Bold.ttf', import.meta.url));
const fonts = {regularFont, boldFont, assertActive() {}};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PHOTO_URL = 'https://firebasestorage.googleapis.com/v0/b/appcodici-password.firebasestorage.app/o/users%2Fsynthetic%2Favatar_1?alt=media';

const user = () => ({
    nome: 'Mario', cognome: 'Rossi', birth_date: '01/02/1980', birth_place: 'Padova', photoURL: PHOTO_URL,
    documenti: [{type: 'Codice Fiscale', cf_value: 'RSSMRA80B01G224X'}, {type: 'Passaporto', num_serie: 'PASS-NON-SELEZIONABILE'}],
    contactPhones: [{number: '+39 049 000 0001', shareQr: true}, {number: '+39 049 000 0002', shareQr: false}],
    contactEmails: [{address: 'legacy@example.invalid', shareQr: true}, {address: 'nascosta@example.invalid', shareQr: false}]
});
const options = () => ({
    contactPhones: [{id: 'p1', number: '+39 333 000 0001', label: 'Cellulare'}, {id: 'p2', number: '+39 333 000 0002'}],
    contactEmails: [{id: 'e1', address: 'mario@example.invalid', label: 'Lavoro'}, {id: 'e2', address: 'esclusa@example.invalid'}],
    userAddresses: [{id: 'a1', type: 'Residenza', address: 'Via Roma', civic: '1', cap: '35100', city: 'Padova'}, {id: 'a2', address: 'Via Esclusa', civic: '9', city: 'Verona'}],
    customFields: [
        {label: 'Sito', type: 'url', value: 'https://example.invalid', includeInQr: true, qrOrder: 2},
        {label: 'Tessera club', qrLabel: 'Club', type: 'identifier', value: 'CLUB-42', includeInQr: true, qrOrder: 1},
        {label: 'PIN', type: 'text', value: 'SEGRETO-PIN', includeInQr: true, sensitivity: 'secret'},
        {label: 'Cifrato', type: 'text', value: 'SEGRETO-CIFRATO', includeInQr: true, encrypted: true},
        {label: 'Busta', type: 'text', value: 'SEGRETO-BUSTA', valueEnc: 'CPFE2:xyz', includeInQr: true},
        {label: 'Password', type: 'password', value: 'SEGRETO-PASSWORD', includeInQr: true},
        {label: 'Non scelto', type: 'text', value: 'NON-SCELTO', includeInQr: false}
    ]
});
const full = {photo: true, nome: true, cf: true, nascita: true, phones: ['p1'], emails: ['e1'], addresses: ['a1'], contactPhones: true, contactEmails: true};
const secrets = ['SEGRETO-PIN', 'SEGRETO-CIFRATO', 'SEGRETO-BUSTA', 'SEGRETO-PASSWORD', 'NON-SCELTO', 'PASS-NON-SELEZIONABILE',
    'esclusa@example.invalid', 'Via Esclusa', '+39 333 000 0002', 'nascosta@example.invalid', '+39 049 000 0002'];
// Confronto per parole: l'ADR del vCard ordina via;città;;CAP, il PDF «via, CAP città».
const normalize = value => String(value).split(/\s+/).filter(Boolean).sort().join(' ');
const vcardValues = vcard => vcard.split('\n').filter(line => !/^(BEGIN|VERSION|END|N|PHOTO)[:;]/.test(line))
    .map(line => line.slice(line.indexOf(':') + 1).replace(/^NOTE:/, '').replace(/\\([,;\\])/g, '$1'))
    .flatMap(value => value.startsWith(';;') ? [value.split(';').filter(Boolean).join(' ')] : [value]);
const pdfText = extractPdfText;
const hasImage = pdf => pdf.context.enumerateIndirectObjects().some(([, object]) => object?.dict?.get?.(PDFName.of('Subtype')) === PDFName.of('Image'));

test('the PDF model carries exactly the values that the digital card vCard shares', () => {
    for (const inclusions of [full, {nome: true}, {cognome: true, cf: true}, {nascita: true, phones: [0], emails: ['e1']},
        {addresses: ['a1', 'a2'], contactPhones: true}, {contactEmails: true, phones: ['p2']}, {}]) {
        const vcard = buildVCard(user(), inclusions, options());
        let rows = [];
        try {rows = model.buildDigitalCardPdfModel(user(), inclusions, options(), null).rows;} catch (error) {assert.equal(error.message, 'CARD_PDF_EMPTY');}
        const fromPdf = rows.map(row => normalize(row.value.replace(/, /g, ' '))).sort();
        const fromCard = vcardValues(vcard).map(value => normalize(value.replace(/^Club: /, ''))).sort();
        // FN e N portano lo stesso nome: il PDF lo mostra una volta sola.
        assert.deepEqual(fromPdf, fromCard, JSON.stringify(inclusions));
    }
});

test('sensitive, encrypted, unsupported and unselected fields never reach the model', () => {
    const value = model.buildDigitalCardPdfModel(user(), full, options(), PNG), serialized = JSON.stringify(value);
    for (const secret of secrets) assert.doesNotMatch(serialized, new RegExp(secret.replace(/[+.]/g, '\\$&')), secret);
    assert.deepEqual(value.rows.map(row => row.label), ['Nome e cognome', 'Codice fiscale', 'Data di nascita', 'Luogo di nascita',
        'Telefono (Cellulare)', 'Email (Lavoro)', 'Indirizzo (Residenza)', 'Telefono', 'Email', 'Club', 'Sito']);
    assert.equal(value.rows.find(row => row.label === 'Indirizzo (Residenza)').value, 'Via Roma 1, 35100 Padova');
});

test('the photo enters only when selected, from an https profile URL, as an image data URL', () => {
    assert.equal(model.buildDigitalCardPdfModel(user(), full, options(), PNG).photo, PNG);
    assert.equal(model.buildDigitalCardPdfModel(user(), {...full, photo: false}, options(), PNG).photo, null);
    assert.equal(model.buildDigitalCardPdfModel({...user(), photoURL: 'http://example.invalid/a.png'}, full, options(), PNG).photo, null);
    assert.equal(model.buildDigitalCardPdfModel(user(), full, options(), 'https://example.invalid/a.png').photo, null);
    assert.equal(model.isCardPhotoSelected(user(), {photo: true}), true);
    assert.equal(model.isCardPhotoSelected(user(), {photo: 'true'}), false);
});

// I campi personalizzati hanno una propria scelta (includeInQr), come nel QR della Tessera.
const withoutCustom = () => ({...options(), customFields: []});
test('an empty selection is refused instead of producing a blank PDF', () => {
    assert.throws(() => model.buildDigitalCardPdfModel(user(), {}, withoutCustom(), PNG), /CARD_PDF_EMPTY/);
    assert.throws(() => model.buildDigitalCardPdfModel(user(), {photo: true}, withoutCustom(), PNG), /CARD_PDF_EMPTY/);
    assert.equal(model.buildDigitalCardPdfModel(user(), {}, options(), PNG).rows.length, 2);
});

test('the generated PDF shows the selected fields, with the photo, and no active actions', async () => {
    const bytes = await generateDigitalCardPdf(model.buildDigitalCardPdfModel(user(), full, options(), PNG), fonts);
    const pdf = await PDFDocument.load(bytes), text = await pdfText(bytes);
    assert.equal(pdf.getPageCount(), 1); assert.equal(pdf.getTitle(), 'Tessera digitale'); assert.equal(hasImage(pdf), true);
    assert.equal(pdf.catalog.has(PDFName.of('OpenAction')), false); assert.equal(pdf.catalog.has(PDFName.of('AA')), false);
    for (const expected of ['TESSERA DIGITALE', 'Mario Rossi', 'RSSMRA80B01G224X', '+39 333 000 0001', 'mario@example.invalid',
        'Via Roma 1, 35100 Padova', 'CLUB-42', 'Documento generato da Codici & Password']) assert.match(text, new RegExp(expected.replace(/[+.&]/g, '\\$&')), expected);
    for (const secret of secrets) assert.doesNotMatch(text, new RegExp(secret.replace(/[+.]/g, '\\$&')), secret);
});

test('a reduced selection without photo yields only those fields and no image', async () => {
    const bytes = await generateDigitalCardPdf(model.buildDigitalCardPdfModel(user(), {nome: true, emails: ['e1']}, withoutCustom(), PNG), fonts);
    const pdf = await PDFDocument.load(bytes), text = await pdfText(bytes);
    assert.equal(hasImage(pdf), false);
    assert.match(text, /Mario Rossi/); assert.match(text, /mario@example\.invalid/);
    for (const absent of ['RSSMRA80B01G224X', '01/02/1980', '+39 333 000 0001', 'Via Roma', 'CLUB-42']) assert.doesNotMatch(text, new RegExp(absent.replace(/[+.]/g, '\\$&')), absent);
});

test('the generator rejects extra keys, wrong titles, bad photos and unsupported glyphs', async () => {
    const base = () => ({title: 'Tessera digitale', photo: null, rows: [{label: 'Nome e cognome', value: 'Mario Rossi'}]});
    for (const mutate of [value => {value.password = 'x';}, value => {value.title = 'Scheda aziendale';},
        value => {value.rows[0].extra = 'x';}, value => {value.rows = [];}, value => {value.photo = 'data:image/svg+xml;base64,AAAA';},
        value => {value.rows[0].value = '😀';}, value => {value.rows[0].value = 'x'.repeat(5001);}]) {
        const value = base(); mutate(value); await assert.rejects(generateDigitalCardPdf(value, fonts));
    }
    await assert.rejects(generateDigitalCardPdf({...base(), rows: [{label: 'Nome e cognome', value: '张伟'}]}, fonts), /PDF_UNSUPPORTED_CHARACTER/);
});

test('long cards paginate and revocation during generation prevents output', async () => {
    const rows = Array.from({length: 120}, (_, index) => ({label: 'Campo ' + index, value: 'Valore sintetico '.repeat(8)}));
    const pdf = await PDFDocument.load(await generateDigitalCardPdf({title: 'Tessera digitale', photo: PNG, rows}, fonts));
    assert.ok(pdf.getPageCount() > 1 && pdf.getPageCount() <= 10);
    let checks = 0;
    await assert.rejects(generateDigitalCardPdf({title: 'Tessera digitale', photo: null, rows}, {...fonts, assertActive() {if (++checks > 3) throw Error('LOCKED');}}), /LOCKED/);
});
