import {DOCUMENT_IMAGE_MAX_PER_DOCUMENT, documentAttachmentObject}
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
    capability, trusted, isOnline = () => globalThis.navigator?.onLine !== false, objectUrl,
    createOperationId = () => `operation-${globalThis.crypto.randomUUID()}`}) {
    const uid = context.user?.uid;
    let disposed = false, preview = null, loading = false, documentId = null;
    const fail = code => {throw Error(code);};
    function revoke() {
        if (!preview) return;
        const current = preview;
        preview = null;
        try {objectUrl.revoke(current.url);} catch { /* a revoked URL is the intended end state */ }
        current.plaintext?.fill?.(0);
    }
    const dispose = () => {disposed = true; revoke();};
    context.signal.addEventListener('abort', dispose, {once: true});
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); fail('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    const record = async attachmentId => {
        check();
        if (!documentId) fail('DOCUMENT_NOT_LOADED');
        const current = await repository.read(uid, attachmentId);
        check();
        if (!documentAttachmentObject(current) || current.documentId !== documentId) fail('ATTACHMENT_MISSING');
        return current;
    };
    return Object.freeze({
        dispose,
        revoke,
        // The projection stays the reader's job: this source never re-derives metadata.
        async load(requestedDocumentId) {
            check();
            const model = await reader.read(requestedDocumentId);
            check();
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
            check();
            if (!documentId) fail('DOCUMENT_NOT_LOADED');
            if (!isOnline()) fail('OFFLINE_NOT_ALLOWED');
            const list = Array.from(files ?? []);
            if (!list.length) return Object.freeze({status: 'empty', results: Object.freeze([])});
            const results = [];
            loading = true;
            try {
                for (const [index, file] of list.entries()) {
                    const name = typeof file?.name === 'string' ? file.name : null;
                    try {
                        const bytes = new Uint8Array(await file.arrayBuffer());
                        const mimeType = typeof file.type === 'string' && file.type ? file.type : 'application/octet-stream';
                        const plan = await planner.upload({context, getUser, capability, documentId, bytes, mimeType,
                            operationId: createOperationId()});
                        if (plan?.status === 'refused') {
                            bytes.fill(0);
                            results.push(Object.freeze({index, name, status: 'refused', code: plan.code}));
                            continue;
                        }
                        const outcome = await service.upload({command: plan.command, digest: plan.digest, payload: plan.payload}, trusted);
                        results.push(Object.freeze({index, name, status: outcome.status, code: outcome.code ?? null,
                            attachmentId: outcome.attachmentId ?? plan.command.attachmentId}));
                    } catch (error) {
                        results.push(Object.freeze({index, name, status: 'failed', code: error?.message ?? 'UPLOAD_FAILED'}));
                    }
                    check();
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
            const current = await record(attachmentId);
            if (current.status !== 'ready') fail('ATTACHMENT_NOT_READY');
            if (!isOnline()) fail('OFFLINE_NOT_ALLOWED');
            check();
            const payload = await repository.download(uid, {storagePath: current.storagePath});
            check();
            const plaintext = await capability.openImage({payload, envelope: current.envelope,
                documentId: current.documentId, attachmentId: current.attachmentId});
            check();
            const url = objectUrl.create(plaintext, current.mimeType);
            revoke();
            preview = {attachmentId: current.attachmentId, url, plaintext};
            return Object.freeze({attachmentId: current.attachmentId, url, mimeType: current.mimeType});
        },
        close() {
            if (disposed) return false;
            const had = Boolean(preview);
            revoke();
            return had;
        },
        async remove(attachmentId) {
            check();
            if (!isOnline()) fail('OFFLINE_NOT_ALLOWED');
            const current = await record(attachmentId);
            const plan = await planner.remove({context, getUser, documentId: current.documentId, attachment: current,
                operationId: createOperationId()});
            if (plan?.status === 'refused') return Object.freeze({status: 'refused', code: plan.code});
            const outcome = await service.remove({command: plan.command, digest: plan.digest}, trusted);
            check();
            if (preview?.attachmentId === attachmentId) revoke();
            return Object.freeze({status: outcome.status, code: outcome.code ?? null, attachmentId: outcome.attachmentId});
        },
        preview() {
            return preview ? Object.freeze({attachmentId: preview.attachmentId, url: preview.url}) : null;
        }
    });
}
