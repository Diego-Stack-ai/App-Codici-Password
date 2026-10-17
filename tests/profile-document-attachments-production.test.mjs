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
    assert.match(controller, /import \{createAttachmentSourceGrid\} from '\.\.\/shared\/attachment-source-picker\.js'/);
    assert.match(privateAccount, /import \{[^}]*selectAttachmentSource[^}]*\} from '\.\.\/shared\/attachment-source-picker\.js'/);
    assert.match(companyAccount, /import \{[^}]*selectAttachmentSource[^}]*\} from '\.\.\/shared\/attachment-source-picker\.js'/);
    assert.match(picker, /Seleziona sorgente/);
    assert.match(picker, /Scansiona tessera\/carta/);
    assert.match(picker, /label: 'Camera'/);
    assert.match(picker, /label: 'Galleria'/);
    assert.match(picker, /label: 'Documento'/);
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
    assert.match(controller, /btn-delete-attachment/);
    assert.match(controller, /profile-document-inline-delete/);
    assert.match(controller, /removeProfileDocumentAttachment/);
    assert.match(controller, /renderProfileDocumentAttachmentPreviews\(renderOptions\)/);
    assert.doesNotMatch(controller, /profile-document-attachments-list/);
    assert.match(controller, /attachment\.readyAt \|\| attachment\.createdAt/);
    assert.doesNotMatch(controller, /Aggiungi allegato/);
    assert.match(picker, /export function createAttachmentSourceGrid/);
    for (const html of [
        await read('Frontend/public/dettaglio_account_privato.html'),
        await read('Frontend/public/dettaglio_account_azienda.html')
    ]) {
        assert.doesNotMatch(html, /source-selector-modal|btn-card-camera/);
    }
});

test('ogni documento mostra dati, allegati e azioni nello stesso blocco e in questo ordine', async () => {
    const cards = await read('Frontend/public/assets/js/modules/privato/profilo-addresses-docs.js');
    const documentRenderer = cards.slice(cards.indexOf('function renderDocumentiView'));
    const dataPosition = documentRenderer.indexOf('document-date-list');
    const attachmentsPosition = documentRenderer.indexOf("className: 'profile-document-inline-attachments'");
    const actionsPosition = documentRenderer.indexOf("className: 'profile-document-actions'");

    assert.ok(dataPosition >= 0, 'il blocco dati del documento deve esistere');
    assert.ok(attachmentsPosition > dataPosition, 'gli allegati devono seguire i dati del documento');
    assert.ok(actionsPosition > attachmentsPosition, 'le azioni devono seguire gli allegati');
    assert.match(documentRenderer.slice(actionsPosition), /Collega o crea Account/);
    assert.doesNotMatch(documentRenderer.slice(actionsPosition), /profile_deadline_card_open_previous/);
    assert.match(documentRenderer.slice(actionsPosition), /profile_deadline_card_configure/);
});

test('il costruttore della Scadenza conserva gli allegati nella bozza senza duplicare il file', async () => {
    const [linkage, deadline] = await Promise.all([
        read('Frontend/public/assets/js/modules/privato/profile-document-deadline-link.js'),
        read('Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js')
    ]);
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

test('Hosting consente fotocamera e microfono solo alle pagine della stessa origine', async () => {
    const hosting = JSON.parse(await read('firebase.json'));
    const globalHeaders = hosting.hosting.headers.find(entry => entry.source === '**')?.headers || [];
    const permissionsPolicy = globalHeaders.find(header => header.key === 'Permissions-Policy')?.value;
    assert.equal(permissionsPolicy, 'camera=(self), microphone=(self), geolocation=()');
});
