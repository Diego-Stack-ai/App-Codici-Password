import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('editor immagini offre ritaglio tattile, rotazione e ridimensionamento senza OCR', async () => {
    const source = await read('Frontend/public/assets/js/modules/shared/image-crop-editor.js');
    assert.match(source, /pointerdown/);
    assert.match(source, /Ruota 90°/);
    assert.match(source, /MAX_SIDE = 2048/);
    assert.match(source, /Salva ritaglio/);
    assert.doesNotMatch(source, /tesseract|ocr|card-parser/i);
});

test('editor immagini è collegato a documenti, account e scadenze', async () => {
    const paths = [
        'Frontend/public/assets/js/modules/privato/profile-document-attachments.js',
        'Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js',
        'Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js',
        'Frontend/public/assets/js/modules/scadenze/deadline-attachment-controller.js'
    ];
    for (const path of paths) assert.match(await read(path), /editImageBeforeUpload/);
});
