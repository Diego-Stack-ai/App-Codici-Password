/**
 * DETTAGLIO SCADENZA MODULE (V4.1)
 * Gestisce la visualizzazione del dettaglio di una scadenza.
 */

import { getFooterReady } from '../../footer-state.js';
import { auth, db, enableAppCheck, functions, storage } from '../../firebase-config.js?v=1.2.127';
import { deleteDoc, doc, serverTimestamp, updateDoc, runTransaction, onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";
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
    getReceivedDeadline
} from '../data/vault-repository.js';
import { deadlineRecipientsFromRecord } from './deadline-recipient-model.js';
import { deadlineDate, deadlineDateInputFields, deadlinePresentation } from './deadline-model.js';

let mountedDeadline = null;

async function deleteScadenza(userId, scadenzaId, sourceRef, active) {
    if (!active()) return;
    if (sourceRef?.type !== 'profileDocument') {
        await deleteDoc(doc(db, 'users', userId, 'scadenze', scadenzaId));
        return;
    }
    const profileRef = doc(db, 'users', userId);
    const deadlineRef = doc(db, 'users', userId, 'scadenze', scadenzaId);
    const documentId = sourceRef.id;
    await runTransaction(db, async transaction => {
        if (!active()) return;
        const snapshot = await transaction.get(profileRef);
        if (!active()) return;
        let changed = false, documents = [];
        if (snapshot.exists()) {
            documents = snapshot.data()?.documenti ?? [];
            if (!Array.isArray(documents)) throw new Error('PROFILE_DOCUMENTS_INVALID');
            documents = documents.map(item => {
                if (typeof documentId === 'string' && documentId && item?.id === documentId && item.expiryReference?.deadlineId === scadenzaId) {
                    changed = true;
                    return {...item, expiryReference: null};
                }
                return item;
            });
        }
        transaction.delete(deadlineRef);
        if (changed) transaction.update(profileRef, {documenti: documents});
    });
}

function clearDeadline(view = document) {
    for (const id of ['detail-title', 'detail-intestatario', 'detail-category', 'detail-date-day', 'detail-date-year',
        'display-veicolo', 'detail-note-body', 'detail-email1', 'detail-email2', 'detail-preavviso', 'detail-frequenza', 'detail-template',
        'detail-page-actions', 'display-attachments', 'display-reference-url']) {
        const element = view.getElementById(id);
        if (element) {
            for (const input of element.querySelectorAll?.('input') || []) input.value = '';
            clearElement(element);
        }
    }
    for (const id of ['section-vehicle', 'section-attachments', 'section-reference-url', 'section-emails', 'section-planning', 'section-template']) {
        view.getElementById(id)?.classList.add('hidden');
    }
}

/**
 * DETTAGLIO SCADENZA MODULE (V5.0 ADAPTER) - RESET NOTIFICHE
 */
export async function initDettaglioScadenza(user, options = {}) {
    mountedDeadline?.destroy();
    if (!user) return {destroy() {}};
    const params = new URLSearchParams(window.location.search);
    const scope = Object.freeze({uid: user.uid, id: params.get('id'), receivedId: params.get('received'), notificationId: params.get('notification')});
    if (!scope.id && !scope.receivedId) {
        window.location.href = 'scadenze.html';
        return;
    }
    const root = document.querySelector('.base-container');
    const owned = new Map(), footers = new Set(), cleanups = new Set();
    const view = {getElementById(id) { if (!owned.has(id)) owned.set(id, document.getElementById(id)); return owned.get(id); }};
    clearDeadline(view);
    let destroyed = false, unsubscribe = () => {}, confirmationPending = false;
    const mount = {scope, record: null, actionPending: false, renderVersion: 0, signal: new AbortController(),
        active() {
            if (!destroyed && (mountedDeadline !== mount || auth.currentUser?.uid !== scope.uid || options.signal?.aborted ||
                root?.isConnected === false || (options.isActive && !options.isActive()))) mount.destroy();
            return !destroyed;
        },
        destroy() {
            if (destroyed) return;
            destroyed = true; mount.record = null; mount.signal.abort(); unsubscribe();
            options.signal?.removeEventListener('abort', mount.destroy);
            globalThis.removeEventListener?.('vault-session-locked', mount.destroy);
            globalThis.removeEventListener?.('pagehide', mount.destroy);
            for (const cleanup of cleanups) cleanup();
            cleanups.clear();
            if (mountedDeadline === mount) { clearDeadline(view); for (const footer of footers) clearElement(footer); }
        },
        own: cleanup => { if (destroyed) cleanup(); else cleanups.add(cleanup); },
        ownFooter: footer => footers.add(footer),
        clearFooters: () => { for (const footer of footers) clearElement(footer); },
        confirmAction(...args) {
            if (!mount.active() || confirmationPending) return Promise.resolve(false);
            confirmationPending = true;
            const pending = showConfirmModal(...args);
            const modal = document.getElementById('protocol-confirm-modal');
            const cancel = () => { modal?.querySelector('#confirm-cancel-btn')?.click(); modal?.remove(); };
            mount.signal.signal.addEventListener('abort', cancel, {once: true});
            return pending.finally(() => { confirmationPending = false; mount.signal.signal.removeEventListener('abort', cancel); });
        }
    };
    mountedDeadline = mount;
    options.signal?.addEventListener('abort', mount.destroy, {once: true});
    globalThis.addEventListener?.('vault-session-locked', mount.destroy, {once: true});
    globalThis.addEventListener?.('pagehide', mount.destroy, {once: true});
    unsubscribe = onAuthStateChanged(auth, current => { if (current?.uid !== scope.uid) mount.destroy(); });
    if (!mount.active()) { unsubscribe(); return mount; }
    const existingFooter = getFooterReady();
    if (existingFooter?.center) { mount.ownFooter(existingFooter.center); clearElement(existingFooter.center); }
    await loadScadenza(mount);
    if (mount.active()) setupFooterActions(mount);
    return mount;
}

async function loadScadenza(mount) {
    const {uid, id, receivedId} = mount.scope;
    try {
        const record = receivedId ? await getReceivedDeadline(uid, receivedId) : await getDeadline(uid, id);
        if (!mount.active()) return;
        if (!record) {
            showToast("Scadenza non trovata", "error");
            return;
        }
        mount.record = {...record, received: Boolean(receivedId)};
        if (!renderScadenza(mount.record, mount)) return;
        if (!receivedId) await markOpenedDeadlineNotification(mount);
    } catch (e) {
        if (mount.active()) {
            mount.record = null; mount.renderVersion++;
            clearDeadline(); mount.clearFooters();
            showToast('Impossibile caricare la scadenza.', 'error');
        }
    }
}

async function markOpenedDeadlineNotification(mount) {
    const {uid, id, notificationId} = mount.scope;
    if (!notificationId) return;
    try {
        const notificationRef = doc(db, 'users', uid, 'deadlineNotifications', notificationId);
        const notification = await getDeadlineNotification(uid, notificationId);
        if (!mount.active()) return;
        if (notification?.deadlineId === id && notification.status === 'unread') {
            await updateDoc(notificationRef, { status: 'viewed', readAt: serverTimestamp() });
        }
    } catch (error) {
        if (mount.active()) console.warn('[SCADENZE] Impossibile aggiornare lo stato della notifica');
    }
}

function setupFooterActions(mount) {
    function initFooterFromDetail(detail) {
        const { center: footerCenter, right: footerRight } = detail;
        if (!mount.active() || !footerRight || !footerCenter || !mount.record) return;
        mount.ownFooter(footerCenter);
        mount.ownFooter(footerRight);

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

        if (mount.scope.receivedId) {
            clearElement(footerCenter);
            return;
        }

        const deleteBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-danger', onclick: () => handleDelete(mount)
        }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })]);

        const editBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-scadenza',
            onclick: () => { if (mount.active()) window.location.href = `aggiungi_scadenza.html?id=${encodeURIComponent(mount.scope.id)}`; }
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
        const onReady = event => initFooterFromDetail(event.detail);
        document.addEventListener('footer:ready', onReady, {once: true});
        mount.own(() => document.removeEventListener('footer:ready', onReady));
    }
}

async function handleDelete(mount) {
    if (!mount.active() || mount.scope.receivedId || !mount.record || mount.actionPending) return;
    if (mount.record.sourceRef?.type === 'profileDocument' && globalThis.navigator?.onLine === false) {
        showToast('Per eliminare una scadenza collegata a un documento del Profilo serve la connessione.', 'warning');
        return;
    }
    mount.actionPending = true;
    const {uid, id} = mount.scope;
    const sourceRef = mount.record.sourceRef ? {...mount.record.sourceRef} : null;
    try {
        const ok = await mount.confirmAction('ELIMINA SCADENZA', 'Sei sicuro?', 'Elimina', t('cancel') || 'Annulla');
        if (mount.active() && ok) {
            await deleteScadenza(uid, id, sourceRef, () => mount.active());
            if (mount.active()) window.location.href = 'scadenze.html';
        }
    } catch (error) { if (mount.active()) showToast('Eliminazione della scadenza non riuscita.', 'error'); }
    finally { mount.actionPending = false; }
}

async function handleReceivedDeadlineAction(action, nextDueDate, mount, active) {
    if (!active() || !mount.scope.receivedId || mount.record?.permission !== 'manage' || mount.actionPending) return;
    mount.actionPending = true;
    const {uid, receivedId} = mount.scope;
    const record = mount.record;
    try {
        if (action === 'complete') {
            const confirmed = await mount.confirmAction(
                'SCADENZA GESTITA',
                'Confermi di aver gestito questa scadenza? Il proprietario riceverà un avviso.',
                'Conferma'
            );
            if (!active() || !confirmed) return;
        }
        if (!active() || mount.record?.permission !== 'manage') return;
        document.querySelectorAll('#detail-page-actions button').forEach(button => { button.disabled = true; });
        enableAppCheck();
        const result = (await httpsCallable(functions, 'manageReceivedDeadline')({
            expectedOwnerUid: uid,
            receivedDeadlineId: receivedId,
            action,
            nextDueDate
        })).data;
        if (!active()) return;
        mount.record = {...record, completed: action === 'complete', ...(result?.dueDate ? {dueDate: result.dueDate} : {})};
        if (!renderScadenza(mount.record, mount)) return;
        showToast(
            action === 'complete' ? 'Scadenza segnata come gestita' : 'Prossima scadenza aggiornata',
            'success'
        );
    } catch (error) {
        if (!active()) return;
        showToast('Aggiornamento della scadenza non riuscito', 'error');
        renderScadenza(mount.record, mount);
    } finally { mount.actionPending = false; }
}

function renderReceivedDeadlineActions(scadenza, mount, active) {
    if (!active()) return;
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
                onclick: () => handleReceivedDeadlineAction('complete', '', mount, active)
            }));
        }
        managementButtons.push(createElement('button', {
            className: 'btn-modal btn-primary',
            type: 'button',
            textContent: 'Conferma e aggiorna',
            onclick: () => {
                if (!active()) return;
                if (!nextDate.value) {
                    showToast('Inserisci la prossima data', 'error');
                    return;
                }
                return handleReceivedDeadlineAction('renew', nextDate.value, mount, active);
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

function renderScadenza(scadenza, mount) {
    if (!mount.active()) return false;
    try {
        renderDeadlineContents(scadenza, mount);
        return true;
    } catch (error) {
        if (mount.active()) {
            mount.record = null; mount.renderVersion++;
            clearDeadline(); mount.clearFooters();
            showToast('Impossibile visualizzare la scadenza.', 'error');
        }
        return false;
    }
}

function renderDeadlineContents(scadenza, mount) {
    const version = ++mount.renderVersion;
    const active = () => mount.active() && mount.record === scadenza && version === mount.renderVersion;
    clearDeadline();
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
                if (!active()) return;
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
            const attachment = {...a, encryption: a.encryption ? {...a.encryption} : null};
            return createElement('button', { type: 'button', onclick: () => openDeadlineAttachment(attachment, active), className: 'detail-list-item clickable' }, [
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
            onclick: () => { if (active()) openExternalUrl(referenceUrl); }
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
        renderReceivedDeadlineActions(scadenza, mount, active);
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

async function openDeadlineAttachment(attachment, active) {
    if (!active()) return;
    try {
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
        showToast('Impossibile aprire l’allegato cifrato.', 'error');
    }
}
