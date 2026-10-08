import {doc, collection, getDocFromServer, getDocFromCache, getDocsFromServer, getDocsFromCache} from 'firebase/firestore';
import {ref, getBytes} from 'firebase/storage';
import {httpsCallable} from 'firebase/functions';
import {createProfileDocumentAttachmentsRepository} from './profile-document-attachments-repository.mjs';
import {createProfileDocumentAttachmentsProvider} from './profile-document-attachments-provider.mjs';
import {encodeAttachmentUpload} from './profile-document-attachment-wire.mjs';
import {assertDocumentImageSignature} from './document-image-signature.mjs';

// Local candidate composition; identity and App Check are resolved on the bridge,
// never from a `trusted` object supplied by this browser.
export function createFirebaseProfileDocumentAttachments({context, auth, db, storage, functions}) {
    const getUser = () => auth.currentUser, isOnline = () => navigator.onLine !== false;
    const guard = () => {
        if (location.origin !== 'http://127.0.0.1:4188' || auth.app.options.projectId !== 'demo-vault-shell')
            throw Error('LOCAL_EMULATOR_ONLY');
        context.assertUnlocked();
        if (context.signal.aborted || getUser()?.uid !== context.user.uid) throw Error('VIEW_DISPOSED');
    };
    guard();
    const repository = createProfileDocumentAttachmentsRepository({context, getUser, isOnline, transport: {
        async read(path, {source}) {
            guard();
            const snap = await (source === 'server' ? getDocFromServer : getDocFromCache)(doc(db, path));
            guard();
            return snap.exists() ? snap.data() : null;
        },
        async list(path, {source}) {
            guard();
            const snap = await (source === 'server' ? getDocsFromServer : getDocsFromCache)(collection(db, path));
            guard();
            return snap.docs.map(item => ({...item.data(), id: item.id}));
        },
        async download(path, {maxBytes}) {
            guard();
            // Repository owns the post-await identity check and buffer clearing.
            return new Uint8Array(await getBytes(ref(storage, path), maxBytes));
        }
    }});
    const submit = async (name, request) => {
        guard();
        if (!isOnline()) throw Error('OFFLINE_NOT_ALLOWED');
        const result = await httpsCallable(functions, name)(request);
        guard();
        return result.data;
    };
    return createProfileDocumentAttachmentsProvider({context, getUser, repository, isOnline,
        validateImageBytes: assertDocumentImageSignature,
        confirm: async () => window.confirm('Cancellare definitivamente questo allegato? Il documento originale rimane conservato.'),
        hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join(''),
        service: {
            upload: request => submit('uploadProfileDocumentAttachment', encodeAttachmentUpload(request)),
            remove: ({command, digest}) => submit('removeProfileDocumentAttachment', {command, digest})
        },
        objectUrl: {
            create: (bytes, mimeType) => URL.createObjectURL(new Blob([bytes], {type: mimeType})),
            revoke: url => URL.revokeObjectURL(url)
        }
    });
}
