/**
 * Rendering e apertura sicura degli allegati incorporati nell'anagrafica azienda.
 */

import { auth, storage } from '../../firebase-config.js?v=1.2.154';
import { getBytes, ref, onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { logError } from '../../utils.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptAttachmentBytes, openDecryptedAttachment, openExternalUrl } from '../shared/attachment-security.js';

let attachmentRender = 0;
export function renderCompanyEmbeddedAttachments(attachments) {
    const generation = ++attachmentRender;
    const ownerUid = auth.currentUser?.uid;
    const container = document.getElementById('allegati-list');
    if (!container) return;
    clearElement(container);

    if (!Array.isArray(attachments) || attachments.length === 0) {
        setChildren(container, createElement('p',{className:'form-card no-attachments-text',textContent:'Nessun documento allegato. Usa Modifica documenti per aggiungerlo.'}));
        return;
    }
    setChildren(container, attachments.map(attachment => createElement('button', {
        type: 'button',
        onclick: () => openCompanyAttachment(attachment, () => generation === attachmentRender
            && container.isConnected && Boolean(ownerUid) && auth.currentUser?.uid === ownerUid),
        className: 'attachment-item group'
    }, [
        createElement('div', { className: 'attachment-info' }, [
            createElement('span', { className: 'material-symbols-outlined icon-accent-blue', textContent: 'description' }),
            createElement('span', { className: 'attachment-name', textContent: attachment.name || attachment.nome })
        ]),
        createElement('span', { className: 'material-symbols-outlined attachment-icon-open', textContent: 'open_in_new' })
    ])));
}

async function openCompanyAttachment(attachment, isActive = () => true) {
    const uid = auth.currentUser?.uid;
    let invalid = false, unsubscribe = () => {};
    const invalidate = () => { invalid = true; };
    const active = () => !invalid && Boolean(uid) && auth.currentUser?.uid === uid && isActive();
    if (!active()) return;
    globalThis.addEventListener?.('vault-session-locked', invalidate);
    globalThis.addEventListener?.('pagehide', invalidate);
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) invalidate(); });
    try {
        if (!active()) return;
        if (!attachment.encryption) {
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        if (!active()) return;
        const bytes = await getBytes(ref(storage, attachment.storagePath), 25 * 1024 * 1024 + 1024);
        if (!active()) return;
        const clear = await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        if (!active()) return;
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        if (!active()) return;
        logError('OpenCompanyAttachment', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
    } finally {
        unsubscribe();
        globalThis.removeEventListener?.('vault-session-locked', invalidate);
        globalThis.removeEventListener?.('pagehide', invalidate);
    }
}
