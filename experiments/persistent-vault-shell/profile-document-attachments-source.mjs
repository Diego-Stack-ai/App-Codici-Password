import {DOCUMENT_IMAGE_MAX_PER_DOCUMENT, documentAttachmentMetadata, documentAttachmentSize}
    from './profile-document-attachments-contract.mjs';

// Revocable gallery source for the images of one private digital document
// (DS-002B, laboratory). It owns the three things the view must not: the binary
// capability of the session, the plaintext of a preview and the Object URL that
// carries it. Plaintext buffers are cleared and every Object URL is revoked on
// close, on lock, on logout, on UID change and on dispose, including while an
// operation is in flight. The injected collaborators keep this module free of
// Firebase, DOM and clock concerns:
//   reader.read(documentId)                      -> projection of the reader
//   repository.read(uid, attachmentId)           -> canonical record
//   repository.download(uid, {storagePath})      -> sealed payload bytes
//   planner.upload/remove(options)               -> immutable plan or refusal
//   service.upload/remove(request, trusted)      -> candidate service outcome
//   objectUrl.create(bytes, mimeType)/revoke(url)-> browser Object URL lifecycle
export function createProfileDocumentAttachmentsSource({context, getUser, reader, repository, planner, service,
    capability, trusted, isOnline = () => globalThis.navigator?.onLine !== false, objectUrl, validateImageBytes,
    createOperationId = () => `operation-${globalThis.crypto.randomUUID()}`}) {
    const uid = context.user?.uid;
    let disposed = false, preview = null, loading = false, documentId = null;
    let selectedId = null, selectionRevision = 0, loadRevision = 0, previewRevision = 0;
    const fail = code => {throw Error(code);};
    function revoke() {
        previewRevision++;
        if (!preview) return;
        const current = preview;
        preview = null;
        try {objectUrl.revoke(current.url);} catch { /* a revoked URL is the intended end state */ }
        current.plaintext?.fill?.(0);
    }
    const dispose = () => {disposed = true; context.signal.removeEventListener('abort', dispose); revoke();};
    context.signal.addEventListener('abort', dispose, {once: true});
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); fail('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    const selection = () => {
        check();
        const ownerDocument = documentId, epoch = selectionRevision;
        if (!ownerDocument) fail('DOCUMENT_NOT_LOADED');
        return () => {
            check();
            if (epoch !== selectionRevision || ownerDocument !== documentId) fail('DOCUMENT_SELECTION_CHANGED');
        };
    };
    // The record is validated with the canonical contract before it is used: the
    // identity of the attachment is derived from the path, never read from a field
    // the contract does not allow, and a malformed record is refused here. The raw
    // value is kept for the planner, which re-validates it as a record.
    const record = async attachmentId => {
        check();
        if (!documentId) fail('DOCUMENT_NOT_LOADED');
        const value = await repository.read(uid, attachmentId);
        check();
        let metadata;
        try {metadata = documentAttachmentMetadata(value, {uid});} catch {return fail('ATTACHMENT_INVALID');}
        if (metadata.documentId !== documentId) fail('ATTACHMENT_MISSING');
        return {value, metadata};
    };
    return Object.freeze({
        dispose,
        revoke,
        // The projection stays the reader's job: this source never re-derives metadata.
        async load(requestedDocumentId) {
            check();
            const ticket = ++loadRevision;
            if (selectedId !== requestedDocumentId) {
                selectedId = requestedDocumentId; documentId = null; selectionRevision++; revoke();
            }
            const model = await reader.read(requestedDocumentId);
            check();
            if (ticket !== loadRevision) fail('DOCUMENT_SELECTION_CHANGED');
            if (model.documentId !== requestedDocumentId) fail('DOCUMENT_SELECTION_CHANGED');
            documentId = model.documentId;
            const online = isOnline();
            return Object.freeze({documentId: model.documentId, allowed: model.allowed, refusal: model.refusal, online,
                canWrite: online && model.allowed && !loading, busy: loading,
                maxPerDocument: DOCUMENT_IMAGE_MAX_PER_DOCUMENT, attachments: model.attachments, invalid: model.invalid,
                preview: preview ? Object.freeze({attachmentId: preview.attachmentId, url: preview.url}) : null});
        },
        // One file at a time, each with its own operation: a failure never hides the
        // outcome of the others, and nothing is written when the session is offline.
        // The original name of a picked file lives only in this transient result and
        // is never part of a command, a record or a receipt.
        async upload(files) {
            const checkSelection = selection();
            const uploadDocumentId = documentId;
            if (!isOnline()) fail('OFFLINE_NOT_ALLOWED');
            const list = Array.from(files ?? []);
            if (!list.length) return Object.freeze({status: 'empty', results: Object.freeze([])});
            const results = [];
            loading = true;
            try {
                for (const [index, file] of list.entries()) {
                    checkSelection();
                    const name = typeof file?.name === 'string' ? file.name : null;
                    let bytes;
                    try {
                        // Browser File exposes the size without allocating its
                        // contents. The planner still verifies the actual bytes.
                        if (file?.size !== undefined && !documentAttachmentSize(file.size)) throw Error('SIZE_NOT_ALLOWED');
                        bytes = new Uint8Array(await file.arrayBuffer());
                        checkSelection();
                        const mimeType = typeof file.type === 'string' && file.type ? file.type : 'application/octet-stream';
                        if (validateImageBytes) validateImageBytes(bytes, mimeType);
                        const plan = await planner.upload({context, getUser, capability, documentId: uploadDocumentId, bytes, mimeType,
                            operationId: createOperationId()});
                        checkSelection();
                        if (plan?.status === 'refused') {
                            bytes.fill(0);
                            results.push(Object.freeze({index, name, status: 'refused', code: plan.code}));
                            continue;
                        }
                        const outcome = await service.upload({command: plan.command, digest: plan.digest, payload: plan.payload}, trusted);
                        checkSelection();
                        results.push(Object.freeze({index, name, status: outcome.status, code: outcome.code ?? null,
                            attachmentId: outcome.attachmentId ?? plan.command.attachmentId}));
                    } catch (error) {
                        checkSelection();
                        results.push(Object.freeze({index, name, status: 'failed', code: error?.message ?? 'UPLOAD_FAILED'}));
                    } finally {bytes?.fill(0);}
                    checkSelection();
                }
            } finally {
                loading = false;
            }
            return Object.freeze({status: 'completed', results: Object.freeze(results)});
        },
        // A single preview at a time: the previous URL is revoked only after the new
        // one exists, so the view never shows a revoked URL, and the plaintext buffer
        // that carried it is cleared by `revoke()`.
        async open(attachmentId) {
            const checkSelection = selection(), ticket = ++previewRevision;
            const checkPreview = () => {checkSelection(); if (ticket !== previewRevision) fail('PREVIEW_CHANGED');};
            const {metadata} = await record(attachmentId);
            checkPreview();
            if (metadata.status !== 'ready') fail('ATTACHMENT_NOT_READY');
            if (!isOnline()) fail('OFFLINE_NOT_ALLOWED');
            checkPreview();
            const payload = await repository.download(uid, {storagePath: metadata.storagePath});
            checkPreview();
            const plaintext = await capability.openImage({payload, envelope: metadata.envelope,
                documentId: metadata.documentId, attachmentId: metadata.attachmentId});
            try {
                checkPreview();
                const url = objectUrl.create(plaintext, metadata.mimeType);
                revoke();
                preview = {attachmentId: metadata.attachmentId, url, plaintext};
                return Object.freeze({attachmentId: metadata.attachmentId, url, mimeType: metadata.mimeType});
            } catch (error) { plaintext?.fill?.(0); throw error; }
        },
        close() {
            if (disposed) return false;
            const had = Boolean(preview);
            revoke();
            return had;
        },
        async remove(attachmentId) {
            const checkSelection = selection();
            if (!isOnline()) fail('OFFLINE_NOT_ALLOWED');
            const {value} = await record(attachmentId);
            checkSelection();
            const plan = await planner.remove({context, getUser, documentId: value.documentId, attachment: value,
                operationId: createOperationId()});
            checkSelection();
            if (plan?.status === 'refused') return Object.freeze({status: 'refused', code: plan.code});
            const outcome = await service.remove({command: plan.command, digest: plan.digest}, trusted);
            checkSelection();
            if (preview?.attachmentId === attachmentId) revoke();
            return Object.freeze({status: outcome.status, code: outcome.code ?? null, attachmentId: outcome.attachmentId});
        },
        preview() {
            return preview ? Object.freeze({attachmentId: preview.attachmentId, url: preview.url}) : null;
        }
    });
}
