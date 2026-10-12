import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const loadEditor = async () => {
    const source = await read('Frontend/public/assets/js/modules/shared/image-crop-editor.js');
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};

test('editor immagini offre quattro angoli liberi, prospettiva e formato tessera senza OCR', async () => {
    const source = await read('Frontend/public/assets/js/modules/shared/image-crop-editor.js');
    assert.match(source, /pointerdown/);
    assert.match(source, /Ruota 90°/);
    assert.match(source, /MAX_SIDE = 2048/);
    assert.match(source, /Tessera \/ carta/);
    assert.match(source, /Allega originale/);
    assert.match(source, /close\(file\)/);
    assert.match(source, /Salva ritaglio/);
    assert.match(source, /perspectiveCanvas/);
    assert.match(source, /image-editor-magnifier/);
    assert.match(source, /detectCardBoundary/);
    assert.doesNotMatch(source, /Rileva tessera/);
    assert.doesNotMatch(source, /tesseract|ocr|card-parser/i);
});

test('acquisizione tessera usa guida ID-1 e conferma dedicata con pan e zoom limitato', async () => {
    const camera = await read('Frontend/public/assets/js/modules/shared/card-camera-capture.js');
    assert.match(camera, /getUserMedia/);
    assert.match(camera, /facingMode/);
    assert.match(camera, /CARD_RATIO = 1012 \/ 638/);
    assert.match(camera, /card-camera-frame/);
    assert.match(camera, /MIN_ZOOM = \.93/);
    assert.match(camera, /MAX_ZOOM = 1\.15/);
    assert.match(camera, /pointermove/);
    assert.match(camera, /Ripeti foto/);
    assert.match(camera, /Usa foto/);
    for (const path of ['Frontend/public/dettaglio_account_privato.html', 'Frontend/public/dettaglio_account_azienda.html']) {
        const html = await read(path);
        assert.match(html, /id="btn-card-camera"/);
        assert.match(html, /Scansiona tessera\/carta/);
    }
    const privateModule = await read('Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js');
    const companyModule = await read('Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js');
    assert.match(privateModule, /captureCardPhoto/);
    assert.match(privateModule, /skipImageEditor: true/);
    assert.match(companyModule, /captureCardPhoto/);
    assert.match(companyModule, /skipImageEditor: true/);
});

test('regolazione tessera limita zoom e spostamento senza creare aree vuote', async () => {
    const source = await read('Frontend/public/assets/js/modules/shared/card-camera-capture.js');
    const pureSource = source.slice(0, source.indexOf('export async function captureCardPhoto'));
    const module = await import(`data:text/javascript;base64,${Buffer.from(pureSource).toString('base64')}`);
    const minimum = module.clampCardAdjustment({zoom: 0, x: -9999, y: 9999}, 1080, 681);
    const maximum = module.clampCardAdjustment({zoom: 4, x: 9999, y: -9999}, 1080, 681);
    assert.equal(minimum.zoom, .93);
    assert.equal(maximum.zoom, 1.15);
    assert.ok(Math.abs(minimum.x) <= (1080 - minimum.cropWidth) / 2);
    assert.ok(Math.abs(maximum.y) <= (681 - maximum.cropHeight) / 2);
});

test('riquadro tessera preimpostato conserva il rapporto ID-1', async () => {
    const {cardFrame} = await loadEditor();
    const points = cardFrame(1000, 800);
    const width = points[1].x - points[0].x, height = points[3].y - points[0].y;
    assert.ok(Math.abs(width / height - 1012 / 638) < 1e-9);
    assert.ok(points.every(point => point.x >= 0 && point.x <= 1000 && point.y >= 0 && point.y <= 800));
});

test('motore locale rileva una tessera chiara su sfondo scuro senza OCR', async () => {
    const {detectCardBoundaryFromImageData} = await loadEditor();
    const width = 240, height = 180, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const inside = x >= 35 && x <= 210 && y >= 36 && y <= 146;
        const offset = (y * width + x) * 4, value = inside ? 230 : 18;
        data[offset] = value; data[offset + 1] = value; data[offset + 2] = value; data[offset + 3] = 255;
    }
    const points = detectCardBoundaryFromImageData(data, width, height);
    assert.ok(points);
    assert.ok(Math.abs(points[0].x - 35) < 5 && Math.abs(points[0].y - 36) < 5);
    assert.ok(Math.abs(points[2].x - 210) < 5 && Math.abs(points[2].y - 146) < 5);
});

test('motore locale ignora rumore separato e usa il contorno continuo della tessera', async () => {
    const {detectCardBoundaryFromImageData} = await loadEditor();
    const width = 260, height = 200, data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const card = x >= 46 && x <= 222 && y >= 42 && y <= 153;
        const noise = (x < 18 && y > 65 && y < 72) || (x > 242 && y > 175 && y < 181);
        const offset = (y * width + x) * 4, value = card || noise ? 232 : 16;
        data[offset] = value; data[offset + 1] = value; data[offset + 2] = value; data[offset + 3] = 255;
    }
    const points = detectCardBoundaryFromImageData(data, width, height);
    assert.ok(points);
    assert.ok(points[0].x > 40 && points[0].y > 36);
    assert.ok(points[2].x < 228 && points[2].y < 160);
});

test('la conferma di eliminazione resta sopra galleria allegati ed editor immagine', async () => {
    const css = await read('Frontend/public/assets/css/core_ui.css');
    assert.match(css, /#protocol-confirm-modal\s*\{\s*z-index:\s*13000/);
});

test('contratto geometrico rifiuta angoli incrociati e conserva quadrilateri convessi', async () => {
    const {isValidQuadrilateral} = await loadEditor();
    assert.equal(isValidQuadrilateral([{x: 0, y: 0}, {x: 200, y: 10}, {x: 190, y: 110}, {x: 5, y: 100}]), true);
    assert.equal(isValidQuadrilateral([{x: 0, y: 0}, {x: 200, y: 100}, {x: 0, y: 100}, {x: 200, y: 0}]), false);
});

test('formato tessera usa ID-1 1012x638 e foto libera segue i lati', async () => {
    const {outputSize} = await loadEditor();
    const points = [{x: 0, y: 0}, {x: 400, y: 0}, {x: 400, y: 200}, {x: 0, y: 200}];
    assert.deepEqual(outputSize(points, 'card'), {width: 1012, height: 638});
    assert.deepEqual(outputSize(points, 'free'), {width: 400, height: 200});
});

test('omografia porta i quattro angoli di destinazione sui punti sorgente', async () => {
    const {perspectiveTransform, transformPoint} = await loadEditor();
    const from = [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 50}, {x: 0, y: 50}];
    const to = [{x: 8, y: 4}, {x: 94, y: 11}, {x: 88, y: 47}, {x: 3, y: 42}];
    const transform = perspectiveTransform(from, to);
    from.forEach((point, index) => {
        const actual = transformPoint(transform, point);
        assert.ok(Math.abs(actual.x - to[index].x) < 1e-6);
        assert.ok(Math.abs(actual.y - to[index].y) < 1e-6);
    });
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

test('i dettagli privato e azienda mostrano le immagini allegate senza usare il comando di aggiunta', async () => {
    const paths = [
        'Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js',
        'Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js'
    ];
    for (const path of paths) {
        const source = await read(path);
        assert.match(source, /loadVisibleImagePreview/);
        assert.match(source, /attachment-preview-image/);
        assert.match(source, /URL\.createObjectURL\(new Blob/);
        assert.match(source, /URL\.revokeObjectURL/);
    }
});
