import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Profilo Documenti espone allegati, fotocamera e selettore PDF', async () => {
    const [cards, controller, page] = await Promise.all([
        read('Frontend/public/assets/js/modules/privato/profilo-addresses-docs.js'),
        read('Frontend/public/assets/js/modules/privato/profile-document-attachments.js'),
        read('Frontend/public/profilo_privato.html')
    ]);
    assert.match(cards, /data-action[^\n]+document-attachments|action: 'document-attachments'/);
    assert.match(controller, /capture: 'environment'/);
    assert.match(controller, /application\/pdf/);
    assert.match(controller, /uploadProfileDocumentAttachment/);
    assert.match(controller, /removeProfileDocumentAttachment/);
    assert.match(page, /profile-document-attachments\.css/);
});

test('regole integrate rendono metadati e oggetti server-only', async () => {
    const [firestore, storage, functions] = await Promise.all([
        read('firestore.rules'), read('storage.rules'), read('functions/index.js')
    ]);
    assert.match(firestore, /match \/users\/\{userId\}\/profileDocumentAttachments\/\{attachmentId\}[\s\S]+?allow write: if false;/);
    assert.match(storage, /match \/users\/\{userId\}\/profile-documents\/\{documentId\}\/attachments\/\{attachmentId\}[\s\S]+?allow write: if false;/);
    assert.match(functions, /exports\.uploadProfileDocumentAttachment = onCall/);
    assert.match(functions, /exports\.removeProfileDocumentAttachment = onCall/);
});
