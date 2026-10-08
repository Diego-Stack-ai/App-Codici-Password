// Disposable synthetic fixture for browser download/decryption checks. This is
// not a substitute for the file-picker upload test, which remains separate.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, getDocFromServer, terminate} from 'firebase/firestore';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {sealDocumentImageWithVaultMaterial} from './profile-document-attachment-seal.mjs';
import {planProfileDocumentAttachmentUpload} from './prepare-profile-document-attachment.mjs';
import {encodeAttachmentUpload} from './profile-document-attachment-wire.mjs';

const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, 'preview-fixture');
const auth = initializeAuth(app, {persistence: inMemoryPersistence});
connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
let capability;
try {
    const {user} = await signInWithEmailAndPassword(auth, 'a@example.invalid', 'LOGIN-SOLO-EMULATORE!123');
    const source = await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url), 'utf8');
    const cryptoApi = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const security = (await getDocFromServer(doc(db, `users/${user.uid}/settings/security`))).data();
    const key = await cryptoApi.unwrapVaultKey(security.vaultKeyEnvelope, 'MASTER-FITTIZIA-A!123');
    const context = {user, signal: new AbortController().signal, assertUnlocked() {}};
    capability = createProfileDocumentAttachmentCapability({context, getUser: () => user,
        seal: options => sealDocumentImageWithVaultMaterial(key, options)});
    // Public application placeholder icon, no personal photograph or user file.
    const bytes = new Uint8Array(await readFile(new URL('../../Frontend/public/assets/images/google-avatar.png', import.meta.url)));
    const plan = await planProfileDocumentAttachmentUpload({context, getUser: () => user, capability,
        documents: [{id: 'document'}], attachments: [], documentId: 'document', bytes, mimeType: 'image/png',
        operationId: `preview-${crypto.randomUUID()}`, hash: value => createHash('sha256').update(value).digest('hex')});
    const response = await fetch('http://127.0.0.1:4188/demo-vault-shell/europe-west1/uploadProfileDocumentAttachment', {
        method: 'POST', headers: {'content-type': 'application/json', origin: 'http://127.0.0.1:4188',
            authorization: `Bearer ${await user.getIdToken()}`, 'x-firebase-appcheck': 'synthetic-app-check'},
        body: JSON.stringify({data: encodeAttachmentUpload(plan)})});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.status, 'confirmed');
    console.log('Synthetic preview ready for user A; no browser upload result claimed.');
} finally {capability?.dispose(); await terminate(db); await deleteApp(app);}
