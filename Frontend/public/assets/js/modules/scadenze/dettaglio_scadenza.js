/**
 * DETTAGLIO SCADENZA MODULE (V4.1)
 * Gestisce la visualizzazione del dettaglio di una scadenza.
 */

import { getFooterReady } from '../../footer-state.js';
import { auth, db, enableAppCheck, functions, storage } from '../../firebase-config.js?v=1.2.87';
import { deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from "/assets/js/vendor/firebase-runtime.js";
import { getBytes, ref } from "/assets/js/vendor/firebase-runtime.js";
import { httpsCallable } from "/assets/js/vendor/firebase-runtime.js";

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptAttachmentBytes, openDecryptedAttachment, openExternalUrl } from '../shared/attachment-security.js';
import {
    getDeadline,
    getDeadlineNotification,
    getReceivedDeadline,
    getUserProfile
} from '../data/vault-repository.js';
import { deadlineRecipientsFromRecord } from './deadline-recipient-model.js';
import { deadlineDate, deadlinePresentation } from './deadline-model.js';

let currentScadenza = null;
let currentScadenzaId = new URLSearchParams(window.location.search).get('id');
let currentReceivedDeadlineId = new URLSearchParams(window.location.search).get('received');

async function deleteScadenza(userId, scadenzaId) {
    if (currentScadenza?.sourceRef?.type !== 'profileDocument') {
        await deleteDoc(doc(db, 'users', userId, 'scadenze', scadenzaId));
        return;
    }
    const profileRef = doc(db, 'users', userId);
    const profile = await getUserProfile(userId);
    const documents = profile?.documenti || [];
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'scadenze', scadenzaId));
    batch.update(profileRef, {
        documenti: documents.map(item => item.id === currentScadenza.sourceRef.id
            ? { ...item, expiryReference: null }
            : item)
    });
    await batch.commit();
}

/**
 * DETTAGLIO SCADENZA MODULE (V5.0 ADAPTER) - RESET NOTIFICHE
 */
export async function initDettaglioScadenza(user) {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    currentScadenzaId = params.get('id');
    currentReceivedDeadlineId = params.get('received');
    if (!currentScadenzaId && !currentReceivedDeadlineId) {
        window.location.href = 'scadenze.html';
        return;
    }
    await loadScadenza(user.uid);
    setupFooterActions();
}

async function loadScadenza(uid) {
    try {
        currentScadenza = currentReceivedDeadlineId
            ? await getReceivedDeadline(uid, currentReceivedDeadlineId)
            : await getDeadline(uid, currentScadenzaId);
        if (!currentScadenza) {
            showToast("Scadenza non trovata", "error");
            return;
        }
        if (currentReceivedDeadlineId) currentScadenza.received = true;
        renderScadenza(currentScadenza);
        if (!currentReceivedDeadlineId) await markOpenedDeadlineNotification(uid);
    } catch (e) {
        console.error(e);
    }
}

async function markOpenedDeadlineNotification(uid) {
    const notificationId = new URLSearchParams(window.location.search).get('notification');
    if (!notificationId) return;
    try {
        const notificationRef = doc(db, 'users', uid, 'deadlineNotifications', notificationId);
        const notification = await getDeadlineNotification(uid, notificationId);
        if (notification?.deadlineId === currentScadenzaId && notification.status === 'unread') {
            await updateDoc(notificationRef, { status: 'viewed', readAt: serverTimestamp() });
        }
    } catch (error) {
        console.warn('[SCADENZE] Impossibile aggiornare lo stato della notifica', error);
    }
}

function setupFooterActions() {
    function initFooterFromDetail(detail) {
        const { center: footerCenter, right: footerRight } = detail;
        if (!footerRight || !footerCenter || !currentScadenza) return;

        const settLink = createElement('div', { id: 'footer-settings-link' });
        settLink.appendChild(
            createElement('a', {
                href: 'impostazioni.html',
                className: 'btn-icon-header footer-settings-link'
            }, [
                createElement('span', { className: 'material-symbols-outlined footer-settings-icon', textContent: 'tune' })
            ])
        );
        clearElement(footerRight);
        footerRight.appendChild(settLink);

        if (currentReceivedDeadlineId) {
            clearElement(footerCenter);
            return;
        }

        const deleteBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-danger', onclick: handleDelete
        }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })]);

        const editBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-scadenza',
            onclick: () => window.location.href = `aggiungi_scadenza.html?id=${currentScadenzaId}`
        }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })]);

        const fabWrapper = createElement('div', { className: 'fab-group' }, [deleteBtn, editBtn]);
        clearElement(footerCenter);
        footerCenter.appendChild(fabWrapper);
    }

    // V6.1: Late-subscriber safe — se il footer è già pronto, inizializza subito
    const _footerState = getFooterReady();
    if (_footerState) {
        initFooterFromDetail(_footerState);
    } else {
        document.addEventListener('footer:ready', (e) => initFooterFromDetail(e.detail), { once: true });
    }
}

async function handleDelete() {
    try {
        const ok = await showConfirmModal("ELIMINA SCADENZA", "Sei sicuro?", "Elimina", true);
        if (ok) {
            await deleteScadenza(auth.currentUser.uid, currentScadenzaId);
            window.location.href = 'scadenze.html';
        }
    } catch (error) { showToast("Errore", "error"); }
}

async function handleReceivedDeadlineAction(action, nextDueDate = '') {
    if (!currentReceivedDeadlineId || !currentScadenza) return;
    if (action === 'complete') {
        const confirmed = await showConfirmModal(
            'SCADENZA GESTITA',
            'Confermi di aver gestito questa scadenza? Il proprietario riceverà un avviso.',
            'Conferma'
        );
        if (!confirmed) return;
    }
    try {
        document.querySelectorAll('#detail-page-actions button').forEach(button => { button.disabled = true; });
        enableAppCheck();
        const result = (await httpsCallable(functions, 'manageReceivedDeadline')({
            receivedDeadlineId: currentReceivedDeadlineId,
            action,
            nextDueDate
        })).data;
        currentScadenza.completed = action === 'complete';
        if (result?.dueDate) currentScadenza.dueDate = result.dueDate;
        renderScadenza(currentScadenza);
        showToast(
            action === 'complete' ? 'Scadenza segnata come gestita' : 'Prossima scadenza aggiornata',
            'success'
        );
    } catch (error) {
        console.error('[RECEIVED DEADLINE]', error);
        showToast(error?.message || 'Aggiornamento della scadenza non riuscito', 'error');
        renderReceivedDeadlineActions(currentScadenza);
    }
}

function renderReceivedDeadlineActions(scadenza) {
    const actions = document.getElementById('detail-page-actions');
    if (!actions) return;
    const canManage = scadenza.permission === 'manage';
    const ownerLabel = scadenza.ownerLabel || 'il proprietario';
    const children = [
        createElement('div', { className: 'received-deadline-heading' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: canManage ? 'handshake' : 'visibility' }),
            createElement('div', {}, [
                createElement('strong', { textContent: canManage ? 'Puoi gestire questa scadenza' : 'Scadenza in sola lettura' }),
                createElement('p', { textContent: `Ricevuta da ${ownerLabel}` })
            ])
        ])
    ];

    if (scadenza.completed) {
        children.push(createElement('p', {
            className: 'received-deadline-status',
            textContent: 'Questa scadenza risulta gestita. Puoi inserire una nuova data per riattivarla.'
        }));
    }
    if (canManage) {
        const dateFields = deadlineDateInputFields(scadenza);
        const nextDate = createElement('input', {
            id: 'received-next-date',
            className: 'input',
            type: 'date',
            value: dateFields.isoValue,
            min: new Date().toISOString().slice(0, 10),
            ariaLabel: 'Prossima data della scadenza'
        });
        const managementButtons = [];
        if (!scadenza.completed) {
            managementButtons.push(createElement('button', {
                className: 'btn-modal btn-secondary',
                type: 'button',
                textContent: 'Segna come gestita',
                onclick: () => handleReceivedDeadlineAction('complete')
            }));
        }
        managementButtons.push(createElement('button', {
            className: 'btn-modal btn-primary',
            type: 'button',
            textContent: 'Conferma e aggiorna',
            onclick: () => {
                if (!nextDate.value) {
                    showToast('Inserisci la prossima data', 'error');
                    return;
                }
                handleReceivedDeadlineAction('renew', nextDate.value);
            }
        }));
        children.push(createElement('label', {
            className: 'received-deadline-date-label',
            textContent: 'Prossima scadenza'
        }, [nextDate]));
        children.push(createElement('div', { className: 'received-deadline-buttons' }, managementButtons));
    }
    setChildren(actions, children);
}

function renderScadenza(scadenza) {
    const presentation = deadlinePresentation(scadenza);
    const pageLabel = document.querySelector('.detail-page-label');
    if (pageLabel) pageLabel.textContent = scadenza.received ? 'Scadenza ricevuta' : 'Oggetto Scadenza';
    document.getElementById('detail-title').textContent = presentation.title;
    document.getElementById('detail-intestatario').textContent = presentation.owner;
    document.getElementById('detail-category').textContent = presentation.category;

    const actions = document.getElementById('detail-page-actions');
    if (actions && scadenza.sourceRef?.type === 'profileDocument') {
        setChildren(actions, createElement('button', {
            className: 'btn-modal btn-secondary',
            textContent: 'Apri documento nel Profilo',
            onclick: () => {
                window.location.href = `profilo_privato.html?profileTab=documents&profileDocumentId=${encodeURIComponent(scadenza.sourceRef.id)}`;
            }
        }));
    }

    const d = deadlineDate(scadenza);
    if (d) {
        document.getElementById('detail-date-day').textContent = `${d.getDate()} ${d.toLocaleString('it-IT', { month: 'short' }).toUpperCase()}`;
        document.getElementById('detail-date-year').textContent = d.getFullYear();
    }

    const vSec = document.getElementById('section-vehicle');
    if (presentation.vehicle) {
        vSec?.classList.remove('hidden');
        document.getElementById('display-veicolo').textContent = presentation.vehicle;
    }

    const attCont = document.getElementById('display-attachments');
    const attSec = document.getElementById('section-attachments');
    if (scadenza.attachments && scadenza.attachments.length > 0) {
        attSec?.classList.remove('hidden');
        clearElement(attCont);
        const items = scadenza.attachments.map(a => {
            const ext = a.name.split('.').pop().toLowerCase();
            return createElement('button', { type: 'button', onclick: () => openDeadlineAttachment(a), className: 'detail-list-item clickable' }, [
                createElement('div', { className: 'detail-list-item-left' }, [
                    createElement('div', { className: 'detail-list-icon-box' }, [
                        createElement('span', { className: `material-symbols-outlined`, textContent: 'description' })
                    ]),
                    createElement('span', { className: 'detail-list-item-title', textContent: a.name })
                ]),
                createElement('span', { className: 'material-symbols-outlined detail-list-item-arrow', textContent: 'open_in_new' })
            ]);
        });
        setChildren(attCont, items);
    }

    const referenceUrl = scadenza.referenceUrl || scadenza.url || '';
    const referenceUrlSection = document.getElementById('section-reference-url');
    const referenceUrlContainer = document.getElementById('display-reference-url');
    if (referenceUrl && referenceUrlSection && referenceUrlContainer) {
        referenceUrlSection.classList.remove('hidden');
        const linkButton = createElement('button', {
            type: 'button',
            className: 'detail-list-item clickable',
            onclick: () => openExternalUrl(referenceUrl)
        }, [
            createElement('div', { className: 'detail-list-item-left' }, [
                createElement('div', { className: 'detail-list-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'language' })
                ]),
                createElement('span', { className: 'detail-list-item-title', textContent: referenceUrl })
            ]),
            createElement('span', { className: 'material-symbols-outlined detail-list-item-arrow', textContent: 'open_in_new' })
        ]);
        setChildren(referenceUrlContainer, [linkButton]);
    }

    const noteBody = document.getElementById('detail-note-body');
    if (scadenza.notes && noteBody) noteBody.textContent = scadenza.notes;

    if (scadenza.received) {
        renderReceivedDeadlineActions(scadenza);
        return;
    }

    // Notifiche Email
    const emailSec = document.getElementById('section-emails');
    const recipientLines = deadlineRecipientsFromRecord(scadenza)
        .map(recipient => {
            const channels = [recipient.sendEmail ? 'Email' : '', recipient.sendPush ? 'Push' : ''].filter(Boolean).join(' + ') || 'Sospeso';
            return `${recipient.displayName ? `${recipient.displayName} — ` : ''}${recipient.email} (${channels})`;
        });
    const e1 = recipientLines[0];
    const e2 = recipientLines.length > 1 ? recipientLines.slice(1).join(' · ') : '';
    if (e1 || e2) {
        if (emailSec) emailSec.classList.remove('hidden');
        document.getElementById('detail-email1').textContent = e1 || '';
        document.getElementById('detail-email2').textContent = e2 || '';
    }

    // Pianificazione
    const planSec = document.getElementById('section-planning');
    // Mappatura retrocompatibile o attuale se salvate nel DB
    const preavviso = scadenza.notif_days_before || scadenza.period || '14';
    const frequenza = scadenza.notif_frequency || scadenza.freq || '7';
    if (planSec) {
        planSec.classList.remove('hidden'); // mostriamo sempre la pianificazione di default
        document.getElementById('detail-preavviso').textContent = preavviso + ' gg';
        document.getElementById('detail-frequenza').textContent = frequenza + ' gg';
    }

    // Template Testo
    const templateSec = document.getElementById('section-template');
    if (scadenza.templateText) {
        if (templateSec) templateSec.classList.remove('hidden');

        let compiledText = '';
        if (scadenza.mode === 'automezzi') {
            const subject = scadenza.templateText.trim();
            const vehicle = scadenza.veicolo_modello ? ` ${scadenza.veicolo_modello.trim()}` : '';
            compiledText = `E' in scadenza ${subject}${vehicle}`;
        } else if (scadenza.mode === 'documenti') {
            const subject = scadenza.templateText.trim();
            let code = scadenza.veicolo_modello ? scadenza.veicolo_modello.trim() : '';
            if (code.includes(' - ')) {
                code = code.split(' - ')[1].trim();
            }
            const vehicle = code ? ` ${code}` : '';
            compiledText = `E' in scadenza ${subject}${vehicle}`;
        } else {
            compiledText = `E' in scadenza ${scadenza.templateText.trim()}`;
        }

        document.getElementById('detail-template').textContent = compiledText;
    }
}

async function openDeadlineAttachment(attachment) {
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
        console.error('[DeadlineAttachment]', error);
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
    }
}
