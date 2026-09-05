import { BrowserQRCodeReader } from '@zxing/browser';
import { createWorker } from 'tesseract.js';
import { classifyCode, parseBusinessCard, parseGenericCard, parsePaymentCard } from './card-parser.mjs';

const input = document.querySelector('#image-input');
const preview = document.querySelector('#preview');
const analyze = document.querySelector('#analyze');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const fields = document.querySelector('#fields');
const profile = document.querySelector('#profile');
let objectUrl = '';

input.addEventListener('change', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const file = input.files?.[0];
    if (!file) return;
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.hidden = false;
    analyze.disabled = false;
    result.hidden = true;
    status.textContent = `${file.name} — ${(file.size / 1024).toFixed(0)} KB`;
});

async function decodeCode() {
    if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const found = await detector.detect(preview);
        if (found[0]?.rawValue) return found[0].rawValue;
    }
    const decoded = await new BrowserQRCodeReader().decodeFromImageElement(preview);
    return decoded.getText();
}

async function recognizeText() {
    const started = performance.now();
    const worker = await createWorker('ita', 1, {
        logger: progress => {
            if (progress.status === 'recognizing text') status.textContent = `OCR ${Math.round((progress.progress || 0) * 100)}%`;
        }
    });
    try {
        const output = await worker.recognize(preview);
        return { text: output.data.text, elapsedMs: Math.round(performance.now() - started) };
    } finally {
        await worker.terminate();
    }
}

analyze.addEventListener('click', async () => {
    analyze.disabled = true;
    result.hidden = true;
    try {
        if (profile.value === 'code') {
            status.textContent = 'Lettura QR in corso…';
            fields.value = JSON.stringify(classifyCode(await decodeCode()), null, 2);
        } else {
            status.textContent = 'Caricamento OCR su richiesta…';
            const recognized = await recognizeText();
            const parser = profile.value === 'payment' ? parsePaymentCard : profile.value === 'business' ? parseBusinessCard : parseGenericCard;
            fields.value = JSON.stringify({ ...parser(recognized.text), elapsedMs: recognized.elapsedMs, rawText: recognized.text }, null, 2);
        }
        result.hidden = false;
        status.textContent = 'Analisi terminata: controlla e correggi ogni campo.';
    } catch (error) {
        console.error(error);
        status.textContent = 'Immagine non riconosciuta. Prova con più luce e senza riflessi.';
    } finally {
        analyze.disabled = false;
    }
});

window.addEventListener('pagehide', () => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
