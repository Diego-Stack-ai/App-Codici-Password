import {DOCUMENT_ATTACHMENT_STORAGE_CHANGED, DOCUMENT_IMAGE_MAX_PER_DOCUMENT}
    from './profile-document-attachments-contract.mjs';

// Real adapters for the candidate transport contract of DS-002A/DS-002B, used by
// the emulator suites and required by the future callable. They are deliberately
// thin: every decision stays in the candidate service, here we only translate the
// contract to the native SDKs, with the preconditions Firestore and Storage need.
const STORAGE_CONTENT_TYPE = 'application/octet-stream';
const GENERATION_REQUIRED = () => {
    const error = Error(DOCUMENT_ATTACHMENT_STORAGE_CHANGED);
    error.code = DOCUMENT_ATTACHMENT_STORAGE_CHANGED;
    return error;
};
const numericCode = error => {
    const code = Number(error?.code);
    return Number.isFinite(code) ? code : null;
};
export function createFirestoreDocumentAttachmentDb(db) {
    return {
        doc: path => db.doc(path),
        async get(ref) {
            const snapshot = await ref.get();
            return {exists: snapshot.exists, data: () => snapshot.data()};
        },
        async list(path) {
            const snapshot = await db.collection(path).get();
            return snapshot.docs.map(entry => ({...entry.data(), id: entry.id}));
        },
        attachmentsFor({uid, documentId}) {
            return db.collection(`users/${uid}/profileDocumentAttachments`)
                .where('documentId', '==', documentId).limit(DOCUMENT_IMAGE_MAX_PER_DOCUMENT + 1);
        },
        runTransaction(run) {
            return db.runTransaction(async transaction => run({
                async get(ref) {
                    const snapshot = await transaction.get(ref);
                    return {exists: snapshot.exists, data: () => snapshot.data()};
                },
                async listAttachments(query) {
                    const snapshot = await transaction.get(query);
                    return snapshot.docs.map(entry => ({...entry.data(), id: entry.id}));
                },
                create: (ref, value) => transaction.create(ref, value),
                update: (ref, patch) => transaction.update(ref, patch),
                delete: ref => transaction.delete(ref)
            }));
        }
    };
}
// Firebase Storage transport. `putIfAbsent` creates with ifGenerationMatch 0 and
// `probe` reports digest, stored size and native version. `remove` verifies the
// version itself and then passes the same version to Storage as a native
// precondition: the Storage emulator does not enforce generation preconditions
// (proved in the emulator suite), so the explicit comparison is the guard that
// holds in both environments, while the native precondition is the atomic one on
// real Cloud Storage.
export function createFirebaseDocumentAttachmentStorage({bucket, sha256}) {
    if (!bucket || typeof bucket.file !== 'function' || typeof sha256 !== 'function') throw Error('STORAGE_TRANSPORT_INVALID');
    const file = path => bucket.file(path);
    return {
        async probe(path) {
            const object = file(path);
            const [exists] = await object.exists();
            if (!exists) return {exists: false};
            const [metadata] = await object.getMetadata();
            const [bytes] = await object.download();
            return {exists: true, digest: await sha256(new Uint8Array(bytes)), size: Number(metadata.size),
                generation: metadata.generation === undefined ? null : String(metadata.generation)};
        },
        async putIfAbsent(path, bytes, options = {}) {
            const object = file(path);
            // The existence check keeps the outcome identical where the native
            // precondition is not enforced; the conditional write is what makes it
            // atomic on real Storage.
            if ((await object.exists())[0]) return 'exists';
            try {
                await object.save(Buffer.from(bytes), {resumable: false, contentType: STORAGE_CONTENT_TYPE,
                    metadata: {metadata: options.metadata}, preconditionOpts: {ifGenerationMatch: 0}});
                return 'created';
            } catch (error) {
                // 412: the object appeared between the check and the conditional write.
                if (numericCode(error) === 412) return 'exists';
                throw error;
            }
        },
        async remove(path, {generation} = {}) {
            const object = file(path);
            try {
                if (generation === undefined || generation === null) {
                    await object.delete();
                    return;
                }
                const [exists] = await object.exists();
                if (!exists) return;
                const [metadata] = await object.getMetadata();
                if (String(metadata.generation) !== String(generation)) throw GENERATION_REQUIRED();
                await object.delete({ifGenerationMatch: Number(generation)});
            } catch (error) {
                const code = numericCode(error);
                if (code === 412) throw GENERATION_REQUIRED();
                // 404: the object is already gone, which is the intended end state.
                if (code === 404) return;
                throw error;
            }
        }
    };
}
