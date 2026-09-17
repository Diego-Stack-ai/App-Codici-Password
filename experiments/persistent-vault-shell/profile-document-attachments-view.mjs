import {documentAttachmentIdentity} from './profile-document-attachments-contract.mjs';

// Laboratory only: the Allegato surface of a private digital document. It sits
// next to the existing Modifica and Cestino actions, and it never touches the
// profile, the Rules or the cache: it renders what the source projects and calls
// it back. A document without a unique persisted identifier stays consultable and
// simply cannot own images, with a message that says so.
const text = (node, value) => {node.textContent = value; return node;};
const button = (host, label, action) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.dataset.documentAttachmentAction = action;
    node.append(text(document.createElement('span'), label));
    host.append(node);
    return node;
};
const message = (host, key) => {
    const node = document.createElement('p');
    node.dataset[key] = 'true';
    host.append(node);
    return node;
};
export function mountProfileDocumentAttachments(root, {source, documents = [], isOnline = () => true,
    confirm = async () => true, canEdit = () => true}) {
    const controls = new AbortController();
    const status = message(root, 'documentAttachmentStatus');
    const rowsHost = document.createElement('div');
    const panel = document.createElement('section');
    root.append(rowsHost, panel);
    const rows = [], galleryHost = document.createElement('div');
    let activeDocumentId = null, busy = false;
    const model = () => ({documents: documents.map(entry => ({...entry,
        identity: documentAttachmentIdentity(documents, entry.id)}))});
    function render(projection = null) {
        const online = isOnline();
        panel.replaceChildren();
        const file = document.createElement('input');
        file.type = 'file';
        file.multiple = true;
        file.dataset.documentAttachmentAction = 'input';
        file.disabled = busy || !online || !projection?.canWrite;
        file.addEventListener('change', async () => {
            if (busy || !online) return;
            busy = true;
            try {
                const outcome = await source.upload(file.files ?? []);
                const failed = outcome.results.filter(result => result.status !== 'confirmed');
                text(status, failed.length
                    ? `${failed.length} allegati non caricati (${failed.map(result => result.code).join(', ')})`
                    : `${outcome.results.length} allegati caricati`);
            } catch (error) {
                text(status, `Caricamento non riuscito: ${error.message}`);
            } finally {
                busy = false;
                await refresh();
            }
        }, {signal: controls.signal});
        panel.append(file);
        if (!activeDocumentId) return;
        galleryHost.replaceChildren();
        for (const attachment of projection?.attachments ?? []) {
            const item = document.createElement('div');
            item.dataset.documentAttachmentItem = 'true';
            item.dataset.attachmentId = attachment.attachmentId;
            item.append(text(document.createElement('span'), `${attachment.mimeType} · ${attachment.size} byte`));
            const open = button(item, 'Apri', 'open');
            open.disabled = busy || !online || !attachment.available;
            open.addEventListener('click', async () => {
                try {
                    const opened = await source.open(attachment.attachmentId);
                    show(opened);
                } catch (error) {
                    text(status, `Apertura non riuscita: ${error.message}`);
                }
            }, {signal: controls.signal});
            const remove = button(item, 'Cancella', 'delete');
            remove.disabled = busy || !online || attachment.status !== 'ready';
            remove.addEventListener('click', async () => {
                if (!await confirm()) return;
                try {
                    const outcome = await source.remove(attachment.attachmentId);
                    text(status, outcome.status === 'confirmed' ? 'Allegato cancellato'
                        : `Cancellazione non completata (${outcome.code})`);
                } catch (error) {
                    text(status, `Cancellazione non riuscita: ${error.message}`);
                } finally {
                    await refresh();
                }
            }, {signal: controls.signal});
            galleryHost.append(item);
        }
        panel.append(galleryHost);
        if (!projection?.invalid?.length) return;
        const invalid = message(panel, 'documentAttachmentInvalid');
        text(invalid, `${projection.invalid.length} allegati non verificabili`);
    }
    function show(opened) {
        const preview = document.createElement('figure');
        preview.dataset.documentAttachmentPreview = 'true';
        const image = document.createElement('img');
        image.src = opened.url;
        image.alt = 'Anteprima allegato';
        const close = button(preview, 'Chiudi', 'close');
        close.addEventListener('click', () => {source.close(); preview.remove();}, {signal: controls.signal});
        preview.append(image, close);
        panel.append(preview);
    }
    async function refresh() {
        try {
            const projection = activeDocumentId ? await source.load(activeDocumentId) : null;
            render(projection);
            if (projection && !projection.canWrite) {
                text(status, projection.online ? 'Consultazione: allegati non modificabili' : 'Offline: sola consultazione degli allegati');
            }
        } catch (error) {
            text(status, `Allegati non disponibili: ${error.message}`);
        }
    }
    for (const document_ of model().documents) {
        const row = document.createElement('div');
        row.dataset.documentAttachmentRow = 'true';
        row.dataset.documentId = document_.id ?? '';
        row.append(text(document.createElement('span'), document_.type ?? document_.id ?? 'Documento'));
        const actions = document.createElement('div');
        const edit = button(actions, 'Modifica', 'edit');
        edit.disabled = !canEdit(document_) || !document_.identity.allowed;
        const trash = button(actions, 'Cestino', 'trash');
        trash.disabled = !canEdit(document_) || !document_.identity.allowed;
        const attach = button(actions, 'Allegato', 'attach');
        attach.disabled = !document_.identity.allowed;
        if (!document_.identity.allowed) {
            const legacy = message(row, 'documentAttachmentLegacy');
            text(legacy, 'Documento senza ID persistito univoco: gli allegati non sono disponibili.');
        } else {
            attach.addEventListener('click', async () => {
                activeDocumentId = document_.id;
                text(status, 'Allegati del documento');
                await refresh();
            }, {signal: controls.signal});
        }
        row.append(actions);
        rowsHost.append(row);
        rows.push(row);
    }
    void refresh();
    return Object.freeze({
        rows: Object.freeze(rows),
        dispose() {controls.abort(); source.revoke(); panel.replaceChildren();}
    });
}
