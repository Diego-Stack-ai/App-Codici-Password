import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Profilo Documenti usa selettore e fallback Carta condivisi con gli account', async () => {
    const [cards, controller, picker, capture, privateAccount, companyAccount, companyDetail, page] = await Promise.all([
        read('Frontend/public/assets/js/modules/privato/profilo-addresses-docs.js'),
        read('Frontend/public/assets/js/modules/privato/profile-document-attachments.js'),
        read('Frontend/public/assets/js/modules/shared/attachment-source-picker.js'),
        read('Frontend/public/assets/js/modules/shared/card-attachment-capture.js'),
        read('Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js'),
        read('Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js'),
        read('Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js'),
        read('Frontend/public/profilo_privato.html')
    ]);
    assert.match(cards, /data-action[^\n]+document-attachments|action: 'document-attachments'/);
    assert.match(controller, /capture: 'environment'/);
    assert.match(controller, /import \{selectAttachmentSource\} from '\.\.\/shared\/attachment-source-picker\.js'/);
    assert.match(privateAccount, /import \{[^}]*selectAttachmentSource[^}]*\} from '\.\.\/shared\/attachment-source-picker\.js'/);
    assert.match(companyAccount, /import \{[^}]*selectAttachmentSource[^}]*\} from '\.\.\/shared\/attachment-source-picker\.js'/);
    assert.match(picker, /Seleziona sorgente/);
    assert.match(picker, /Scansiona tessera\/carta/);
    assert.match(picker, />Camera</);
    assert.match(picker, />Galleria</);
    assert.match(picker, />Documento</);
    assert.match(controller, /accept: 'image\/\*,video\/\*'/);
    assert.match(controller, /accept: '\.pdf,\.doc,\.docx,\.xls,\.xlsx,\.txt'/);
    assert.match(capture, /import\('\.\/card-camera-capture\.js'\)/);
    assert.match(controller, /captureCardAttachment/);
    assert.match(privateAccount, /captureCardAttachment/);
    assert.match(companyAccount, /captureGuidedCard/);
    assert.match(controller, /skipImageEditor: true/);
    assert.match(capture, /Usa fotocamera nativa/);
    assert.match(capture, /formato carta/);
    assert.match(capture, /fallbackInput\.click\(\)/);
    assert.match(controller, /cardFallbackInput\.files[\s\S]+consumeAttachmentInitialMode/);
    assert.match(privateAccount, /consumeAttachmentInitialMode/);
    assert.match(companyDetail, /consumeAttachmentInitialMode/);
    assert.match(controller, /application\/pdf/);
    assert.match(controller, /uploadProfileDocumentAttachment/);
    assert.match(controller, /removeProfileDocumentAttachment/);
    assert.match(page, /profile-document-attachments\.css/);
    assert.match(cards, /profile-document-inline-attachments/);
    assert.match(controller, /renderProfileDocumentAttachmentPreviews/);
    assert.match(controller, /profile-document-inline-image/);
});

test('gli allegati del documento sono collegati alla bozza Scadenza senza duplicare il file', async () => {
    const [links, linkage, deadline] = await Promise.all([
        read('Frontend/public/assets/js/modules/privato/profilo-links.js'),
        read('Frontend/public/assets/js/modules/privato/profile-document-deadline-link.js'),
        read('Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js')
    ]);
    assert.match(links, /profile-document-deadline-link\.js/);
    assert.match(linkage, /listProfileDocumentAttachments/);
    assert.match(linkage, /linkedSource: \{type: 'profileDocumentAttachment', id: item\.id\}/);
    assert.match(linkage, /storagePath: item\.storagePath/);
    assert.match(deadline, /setExistingAttachments\(linkedDraftAttachments\)/);
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

test('Hosting consente la fotocamera solo alle pagine della stessa origine', async () => {
    const hosting = JSON.parse(await read('firebase.json'));
    const globalHeaders = hosting.hosting.headers.find(entry => entry.source === '**')?.headers || [];
    const permissionsPolicy = globalHeaders.find(header => header.key === 'Permissions-Policy')?.value;
    assert.equal(permissionsPolicy, 'camera=(self), microphone=(), geolocation=()');
});
