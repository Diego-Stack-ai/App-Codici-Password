import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decideAttachmentContent, openAttachmentContent} from '../Frontend/public/assets/js/modules/shared/attachment-content-policy.mjs';

for (const type of ['', null, 'text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/xml',
    'application/xml', 'application/unknown', 'text/html;charset=utf-8', ' IMAGE / SVG+XML ; charset=UTF-8',
    'application/pdfx', 'constructor', '__proto__']) {
    test(`unsupported content downloads: ${String(type)}`, () => {
        const decision = decideAttachmentContent(type, '../document.pdf.exe');
        assert.equal(decision.action, 'download');
        assert.equal(decision.kind, null);
        assert.equal(decision.mimeType, 'application/octet-stream');
        assert.equal(decision.fileName, 'document_pdf.bin');
    });
}
for (const [type, kind, mime] of [
    [' Application / PDF ; version=1.7', 'pdf', 'application/pdf'],
    ['IMAGE/PNG', 'image', 'image/png'], ['image/jpeg', 'image', 'image/jpeg'],
    ['image/webp', 'image', 'image/webp'], ['image/gif', 'image', 'image/gif'],
    ['video/mp4', 'video', 'video/mp4'], ['video/webm', 'video', 'video/webm'],
    ['audio/mpeg', 'audio', 'audio/mpeg'], ['audio/mp4', 'audio', 'audio/mp4'],
    ['audio/ogg', 'audio', 'audio/ogg'], ['audio/wav', 'audio', 'audio/wav'],
    ['audio/webm', 'audio', 'audio/webm'], [' TEXT / PLAIN ; charset=iso-8859-1', 'text', 'text/plain;charset=utf-8']
]) {
    test(`supported content keeps a dedicated type: ${type}`, () => {
        const decision = decideAttachmentContent(type, 'normal.file');
        assert.equal(decision.action, 'preview');
        assert.equal(decision.kind, kind);
        assert.equal(decision.mimeType, mime);
    });
}
test('an explicit original MIME cannot fall through to another benign metadata field', () => {
    for (const originalType of ['', undefined, null, 'text/html']) {
        assert.equal(decideAttachmentContent({encryption: {originalType}, type: 'application/pdf'}).action, 'download');
    }
    assert.equal(decideAttachmentContent({mimeType: 'image/png', name: 'foto.png'}).fileName, 'foto.png');
});
test('safe filenames remove path, control/bidi characters, hidden extensions and device names', () => {
    for (const name of ['../../report.pdf.exe', 'C:\\tmp\\report.html', 'a\u202efdp\u0000.exe', '..', '', 'CON', 'nul.txt', 'a'.repeat(500)]) {
        const {fileName} = decideAttachmentContent('text/html', name);
        assert.match(fileName, /^[^./\\\u0000-\u001f\u007f\u202e]+\.bin$/u);
        assert.ok(fileName.length <= 104);
        assert.ok(!/^(con|nul)\./i.test(fileName));
    }
});
test('the serialized standalone viewer executes the identical pure policy', () => {
    const copy = Function(`return (${decideAttachmentContent.toString()})`)();
    for (const type of ['text/html', 'image/svg+xml', 'image/png', 'text/plain']) {
        assert.deepEqual(copy(type, 'file.any'), decideAttachmentContent(type, 'file.any'));
    }
});
test('opening dispatch never navigates unsupported content and always revokes object URLs', () => {
    const saved = new Map(['window', 'document', 'setTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    const blobs = [], downloads = [], opened = [], timers = [], revoked = [];
    URL.createObjectURL = blob => { blobs.push(blob); return `blob:fixture-${blobs.length}`; };
    URL.revokeObjectURL = url => revoked.push(url);
    globalThis.window = {open: (...args) => { opened.push(args); return {opener: 'prior'}; }};
    globalThis.document = {body: {append() {}}, createElement: () => ({click() { downloads.push(this.download); }, remove() {}})};
    globalThis.setTimeout = fn => { timers.push(fn); };
    try {
        for (const type of ['text/html', 'image/svg+xml', 'text/xml', '']) {
            assert.equal(openAttachmentContent('synthetic', {type, name: '../../report.pdf.html'}), 'download');
        }
        assert.equal(opened.length, 0);
        assert.equal(downloads.length, 4);
        assert.ok(blobs.every(blob => blob.type === 'application/octet-stream'));
        for (const type of ['application/pdf', 'image/png', 'text/plain']) openAttachmentContent('synthetic', {type});
        assert.equal(opened.length, 3);
        assert.equal(blobs.at(-1).type, 'text/plain;charset=utf-8');
        timers.forEach(fn => fn());
        assert.equal(revoked.length, 7);
    } finally {
        URL.createObjectURL = create; URL.revokeObjectURL = revoke;
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    }
});
test('all thumbnail readers use the shared exact policy rather than a default MIME', async () => {
    for (const path of ['privato/dettaglio-privato-attachments.js', 'azienda/dettaglio-azienda-attachments.js', 'privato/profile-document-attachments.js']) {
        const source = await readFile(new URL(`../Frontend/public/assets/js/modules/${path}`, import.meta.url), 'utf8');
        assert.match(source, /decideAttachmentContent/);
        assert.doesNotMatch(source, /originalType\s*\|\|.*image\/jpeg/);
    }
});
