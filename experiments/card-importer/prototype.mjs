import { BrowserQRCodeReader } from '@zxing/browser';
import { createWorker } from 'tesseract.js';
import { classifyCode, parseBusinessCard, parseGenericCard, parsePaymentCard } from './card-parser.mjs';

const byId = id => document.getElementById(id);
const input = byId('image-input');
const cameraInput = byId('camera-input');
const editor = byId('editor');
const preview = byId('preview');
const analyze = byId('analyze');
const status = byId('status');
const qualityLabel = byId('quality');
const result = byId('result');
const fields = byId('fields');
const profile = byId('profile');
const cropButton = byId('crop');
let workingImage = null;
let selection = null;
let dragStart = null;
let resizeCorner = null;
let selectionAtStart = null;
let lastFile = null;

function copyCanvas(source) {
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext('2d').drawImage(source, 0, 0);
    return copy;
}

function setWorkingImage(source) {
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    const scale = Math.min(1, 1800 / Math.max(width, height));
    preview.width = Math.round(width * scale);
    preview.height = Math.round(height * scale);
    preview.getContext('2d').drawImage(source, 0, 0, preview.width, preview.height);
    workingImage = copyCanvas(preview);
    const inset = Math.max(12, Math.round(Math.min(preview.width, preview.height) * .035));
    selection = {
        x: inset,
        y: inset,
        width: preview.width - (inset * 2),
        height: preview.height - (inset * 2)
    };
    cropButton.disabled = false;
    paintSelection();
    showQuality();
}

function loadSelectedFile(event) {
    const file = event?.currentTarget?.files?.[0] || lastFile;
    if (!file) return;
    lastFile = file;
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
        setWorkingImage(image);
        URL.revokeObjectURL(url);
        editor.hidden = false;
        analyze.disabled = false;
        result.hidden = true;
        status.textContent = `${file.name} — ${(file.size / 1024).toFixed(0)} KB`;
    };
    image.onerror = () => { URL.revokeObjectURL(url); status.textContent = 'Immagine non leggibile.'; };
    image.src = url;
}
input.addEventListener('change', loadSelectedFile);
cameraInput.addEventListener('change', loadSelectedFile);
byId('reset').addEventListener('click', () => loadSelectedFile());

function pointerPosition(event) {
    const box = preview.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(preview.width, (event.clientX - box.left) * preview.width / box.width)),
        y: Math.max(0, Math.min(preview.height, (event.clientY - box.top) * preview.height / box.height))
    };
}

function paintSelection() {
    const context = preview.getContext('2d');
    context.drawImage(workingImage, 0, 0);
    if (!selection) return;
    context.save();
    context.fillStyle = 'rgb(0 0 0 / 45%)';
    context.fillRect(0, 0, preview.width, preview.height);
    context.clearRect(selection.x, selection.y, selection.width, selection.height);
    context.drawImage(workingImage, selection.x, selection.y, selection.width, selection.height,
        selection.x, selection.y, selection.width, selection.height);
    context.strokeStyle = '#4da3ff';
    context.lineWidth = Math.max(3, preview.width / 400);
    context.strokeRect(selection.x, selection.y, selection.width, selection.height);
    context.fillStyle = '#fff';
    context.strokeStyle = '#1768d5';
    for (const point of selectionCorners()) {
        context.beginPath();
        context.arc(point.x, point.y, Math.max(10, preview.width / 90), 0, Math.PI * 2);
        context.fill();
        context.stroke();
    }
    context.restore();
}

function selectionCorners() {
    if (!selection) return [];
    return [
        { name: 'nw', x: selection.x, y: selection.y },
        { name: 'ne', x: selection.x + selection.width, y: selection.y },
        { name: 'sw', x: selection.x, y: selection.y + selection.height },
        { name: 'se', x: selection.x + selection.width, y: selection.y + selection.height }
    ];
}

preview.addEventListener('pointerdown', event => {
    event.preventDefault();
    const point = pointerPosition(event);
    const hitRadius = Math.max(35, preview.width / 35);
    resizeCorner = selectionCorners().find(corner => Math.hypot(corner.x - point.x, corner.y - point.y) <= hitRadius)?.name || null;
    selectionAtStart = selection ? { ...selection } : null;
    dragStart = point;
    preview.setPointerCapture(event.pointerId);
});
preview.addEventListener('pointermove', event => {
    if (!dragStart) return;
    event.preventDefault();
    const end = pointerPosition(event);
    if (resizeCorner && selectionAtStart) {
        const opposite = {
            nw: { x: selectionAtStart.x + selectionAtStart.width, y: selectionAtStart.y + selectionAtStart.height },
            ne: { x: selectionAtStart.x, y: selectionAtStart.y + selectionAtStart.height },
            sw: { x: selectionAtStart.x + selectionAtStart.width, y: selectionAtStart.y },
            se: { x: selectionAtStart.x, y: selectionAtStart.y }
        }[resizeCorner];
        selection = { x: Math.min(opposite.x, end.x), y: Math.min(opposite.y, end.y),
            width: Math.abs(opposite.x - end.x), height: Math.abs(opposite.y - end.y) };
    } else {
        selection = { x: Math.min(dragStart.x, end.x), y: Math.min(dragStart.y, end.y),
            width: Math.abs(end.x - dragStart.x), height: Math.abs(end.y - dragStart.y) };
    }
    paintSelection();
    cropButton.disabled = selection.width < 80 || selection.height < 80;
});
function finishPointer() {
    dragStart = null;
    resizeCorner = null;
    selectionAtStart = null;
    cropButton.disabled = !selection || selection.width < 40 || selection.height < 40;
}
preview.addEventListener('pointerup', finishPointer);
preview.addEventListener('pointercancel', finishPointer);

byId('rotate-left').addEventListener('click', () => {
    const rotated = document.createElement('canvas');
    rotated.width = workingImage.height;
    rotated.height = workingImage.width;
    const context = rotated.getContext('2d');
    context.translate(0, rotated.height);
    context.rotate(-Math.PI / 2);
    context.drawImage(workingImage, 0, 0);
    setWorkingImage(rotated);
});

cropButton.addEventListener('click', () => {
    if (!selection) return;
    const cropped = document.createElement('canvas');
    cropped.width = Math.round(selection.width);
    cropped.height = Math.round(selection.height);
    cropped.getContext('2d').drawImage(workingImage, selection.x, selection.y, selection.width,
        selection.height, 0, 0, cropped.width, cropped.height);
    setWorkingImage(cropped);
});

function qualityMetrics(canvas) {
    const data = canvas.getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, canvas.width, canvas.height).data;
    const pixelStep = Math.max(1, Math.floor((canvas.width * canvas.height) / 80000));
    let glare = 0; let darkness = 0; let edges = 0; let count = 0; let previous = 0;
    for (let index = 0; index < data.length; index += 4 * pixelStep) {
        const gray = (data[index] * .299) + (data[index + 1] * .587) + (data[index + 2] * .114);
        if (gray > 247) glare += 1;
        if (gray < 28) darkness += 1;
        if (count) edges += Math.abs(gray - previous);
        previous = gray;
        count += 1;
    }
    const minSide = Math.min(canvas.width, canvas.height);
    const sharpness = edges / Math.max(1, count - 1);
    const glareRatio = glare / count;
    const darkRatio = darkness / count;
    const score = Math.max(0, Math.min(100,
        Math.round((minSide / 8) + (sharpness * 2) - (glareRatio * 80) - (darkRatio * 40))));
    return { score, sharpness: Math.round(sharpness), glarePercent: Math.round(glareRatio * 100), minSide };
}

function showQuality() {
    const quality = qualityMetrics(workingImage);
    const level = quality.score >= 70 ? 'buona' : quality.score >= 45 ? 'media' : 'insufficiente';
    qualityLabel.dataset.level = level;
    qualityLabel.textContent = `Qualità ${level} (${quality.score}/100) — lato breve ${quality.minSide}px, riflessi ${quality.glarePercent}%.`;
    return { ...quality, level };
}

function preprocessedCanvas() {
    const canvas = copyCanvas(workingImage);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
        const gray = (pixels.data[index] * .299) + (pixels.data[index + 1] * .587) + (pixels.data[index + 2] * .114);
        const value = Math.max(0, Math.min(255, ((gray - 128) * 1.35) + 128));
        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
}

async function decodeCode() {
    if ('BarcodeDetector' in window) {
        const found = await new BarcodeDetector({ formats: ['qr_code'] }).detect(workingImage);
        if (found[0]?.rawValue) return found[0].rawValue;
    }
    return (await new BrowserQRCodeReader().decodeFromCanvas(workingImage)).getText();
}

async function recognizeText() {
    const started = performance.now();
    const worker = await createWorker('ita', 1, {
        workerPath: './tesseract/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        logger: progress => {
        if (progress.status === 'recognizing text') status.textContent = `OCR ${Math.round((progress.progress || 0) * 100)}%`;
        }
    });
    try {
        const output = await worker.recognize(preprocessedCanvas());
        return {
            text: output.data.text,
            confidence: Math.round(output.data.confidence || 0),
            elapsedMs: Math.round(performance.now() - started)
        };
    } finally { await worker.terminate(); }
}

analyze.addEventListener('click', async () => {
    analyze.disabled = true;
    result.hidden = true;
    try {
        const quality = showQuality();
        if (profile.value === 'code') {
            status.textContent = 'Lettura QR in corso…';
            fields.value = JSON.stringify({ ...classifyCode(await decodeCode()), imageQuality: quality }, null, 2);
        } else {
            status.textContent = 'Caricamento OCR su richiesta…';
            const recognized = await recognizeText();
            const reliable = quality.score >= 45 && recognized.confidence >= 45;
            const parser = profile.value === 'payment' ? parsePaymentCard
                : profile.value === 'business' ? parseBusinessCard : parseGenericCard;
            fields.value = JSON.stringify(reliable
                ? { ...parser(recognized.text), confidence: recognized.confidence, imageQuality: quality,
                    elapsedMs: recognized.elapsedMs, rawText: recognized.text }
                : { type: profile.value, fieldsDetected: false, reason: 'Qualità o affidabilità insufficiente',
                    confidence: recognized.confidence, imageQuality: quality, elapsedMs: recognized.elapsedMs }, null, 2);
        }
        result.hidden = false;
        status.textContent = 'Analisi terminata: controlla e correggi ogni campo.';
    } catch (error) {
        console.error(error);
        const detail = String(error?.message || error?.name || 'errore sconosciuto').slice(0, 180);
        status.textContent = `Analisi non riuscita: ${detail}. Prova a ruotare o ritagliare; se persiste, comunica questo messaggio.`;
    } finally { analyze.disabled = false; }
});
