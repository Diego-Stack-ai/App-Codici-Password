import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = (await readFile(new URL('../Frontend/public/assets/js/modules/shared/card-attachment-capture.js', import.meta.url), 'utf8'))
    .replace("await import('./card-camera-capture.js')", "await Promise.reject(new Error('CAMERA_NOT_SUPPORTED'))");
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const {captureCardAttachment, consumeAttachmentInitialMode, describeCardCameraError} = module;

test('gli errori camera mostrano una causa utile senza esporre dettagli tecnici', () => {
    assert.match(describeCardCameraError({name: 'NotAllowedError'}), /non ha concesso/);
    assert.match(describeCardCameraError({name: 'NotFoundError'}), /Non è stata trovata/);
    assert.match(describeCardCameraError({name: 'NotReadableError'}), /occupata/);
    assert.match(describeCardCameraError({message: 'CAMERA_NOT_SUPPORTED'}), /non supporta/);
});

test('la modalità Carta del fallback viene consumata una sola volta', () => {
    const input = {dataset: {attachmentInitialMode: 'card'}};
    assert.equal(consumeAttachmentInitialMode(input), 'card');
    assert.equal(consumeAttachmentInitialMode(input), 'free');
});

test('se la camera integrata non parte il fallback nativo conserva la modalità Carta', async () => {
    const input = {dataset: {}, clicks: 0, click() { this.clicks += 1; }};
    const result = await captureCardAttachment({
        fallbackInput: input,
        confirmFallback: async (title, message) => {
            assert.equal(title, 'Usa fotocamera nativa');
            assert.match(message, /formato carta/);
            return true;
        }
    });
    assert.equal(result, null);
    assert.equal(input.clicks, 1);
    assert.equal(consumeAttachmentInitialMode(input), 'card');
});
