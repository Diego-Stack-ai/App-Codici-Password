import { BrowserQRCodeReader } from '@zxing/browser';
import { createWorker } from 'tesseract.js';
import { classifyCode, parseBusinessCard, parseGenericCard, parsePaymentCard } from './card-parser.mjs';

const byId = id => document.getElementById(id);
const input = byId('image-input');
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
    selection = null;
    cropButton.disabled = true;
    showQuality();
}

function loadSelectedFile() {
    const file = input.files?.[0];
    if (!file) return;
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
byId('reset').addEventListener('click', loadSelectedFile);

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
    context.restore();
}

preview.addEventListener('pointerdown', event => {
    dragStart = pointerPosition(event);
    preview.setPointerCapture(event.pointerId);
});
preview.addEventListener('pointermove', event => {
    if (!dragStart) return;
    const end = pointerPosition(event);
    selection = {
        x: Math.min(dragStart.x, end.x), y: Math.min(dragStart.y, end.y),
        width: Math.abs(end.x - dragStart.x), height: Math.abs(end.y - dragStart.y)
    };
    paintSelection();
    cropButton.disabled = selection.width < 80 || selection.height < 80;
});
preview.addEventListener('pointerup', () => { dragStart = null; });

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
    const worker = await createWorker('ita', 1, { logger: progress => {
        if (progress.status === 'recognizing text') status.textContent = `OCR ${Math.round((progress.progress || 0) * 100)}%`;
    } });
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
        status.textContent = 'Immagine non riconosciuta. Prova a ruotare, ritagliare o usare più luce.';
    } finally { analyze.disabled = false; }
});
