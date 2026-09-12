/**
 * Rendering e apertura sicura degli allegati incorporati nell'anagrafica azienda.
 */

import { storage } from '../../firebase-config.js?v=1.2.100';
import { getBytes, ref } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { logError } from '../../utils.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptAttachmentBytes, openDecryptedAttachment, openExternalUrl } from '../shared/attachment-security.js';

export function renderCompanyEmbeddedAttachments(attachments) {
    const container = document.getElementById('allegati-list');
    if (!container) return;
    clearElement(container);

    if (!Array.isArray(attachments) || attachments.length === 0) return;
    setChildren(container, attachments.map(attachment => createElement('button', {
        type: 'button',
        onclick: () => openCompanyAttachment(attachment),
        className: 'attachment-item group'
    }, [
        createElement('div', { className: 'attachment-info' }, [
            createElement('span', { className: 'material-symbols-outlined icon-accent-blue', textContent: 'description' }),
            createElement('span', { className: 'attachment-name', textContent: attachment.name || attachment.nome })
        ]),
        createElement('span', { className: 'material-symbols-outlined attachment-icon-open', textContent: 'open_in_new' })
    ])));
}

async function openCompanyAttachment(attachment) {
    try {
        if (!attachment.encryption) {
            if (!openExternalUrl(attachment.url)) throw new Error('URL allegato non valido.');
            return;
        }
        if (!attachment.storagePath) throw new Error('Percorso allegato mancante.');
        const vaultKey = await ensureVaultKeyMaterial();
        const bytes = await getBytes(ref(storage, attachment.storagePath), 25 * 1024 * 1024 + 1024);
        const clear = await decryptAttachmentBytes(bytes, attachment.encryption, vaultKey);
        openDecryptedAttachment(clear, attachment);
    } catch (error) {
        logError('OpenCompanyAttachment', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
    }
}
