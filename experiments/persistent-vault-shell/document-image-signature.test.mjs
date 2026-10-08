import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertDocumentImageSignature as check} from './document-image-signature.mjs';
test('PNG application placeholder passes only its actual type', async () => {
    const bytes = new Uint8Array(await readFile(new URL('../../Frontend/public/assets/images/google-avatar.png', import.meta.url)));
    assert.doesNotThrow(() => check(bytes, 'image/png'));
    for (const type of ['image/jpeg', 'image/webp', 'image/heif', 'image/heic', 'text/html']) assert.throws(() => check(bytes, type));
});
test('fake image label and truncated headers are rejected', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']) {
        assert.throws(() => check(new TextEncoder().encode('<script>unsafe</script>'), type));
        assert.throws(() => check(new Uint8Array([137, 80, 78, 71]), type));
    }
});
test('JPEG and WebP headers are checked without pretending to decode', () => {
    assert.doesNotThrow(() => check(new Uint8Array([255, 216, 255, 224]), 'image/jpeg'));
    const bytes = new Uint8Array(16); bytes.set(new TextEncoder().encode('RIFF')); bytes[4] = 8;
    bytes.set(new TextEncoder().encode('WEBPVP8L'), 8);
    assert.doesNotThrow(() => check(bytes, 'image/webp'));
    bytes[4] = 9; assert.throws(() => check(bytes, 'image/webp'));
});
test('HEIF ftyp is bounded; AVIF and other containers cannot masquerade as HEIC', () => {
    const bytes = new Uint8Array(24); bytes[3] = 24;
    bytes.set(new TextEncoder().encode('ftypheic'), 4); bytes.set(new TextEncoder().encode('mif1heic'), 16);
    assert.doesNotThrow(() => check(bytes, 'image/heic'));
    assert.doesNotThrow(() => check(bytes, 'image/heif'));
    bytes.set(new TextEncoder().encode('avif'), 16); assert.throws(() => check(bytes, 'image/heic'));
    bytes[3] = 28; assert.throws(() => check(bytes, 'image/heif'));
});
