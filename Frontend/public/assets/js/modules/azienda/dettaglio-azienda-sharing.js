/**
 * DETTAGLIO ACCOUNT AZIENDA — SHARING MODULE (V1.0)
 * Gestione condivisione, visualizzazione ospiti e revoca accessi per account aziendali.
 * Estratto da dettaglio_account_azienda.js per ridurre la complessità del modulo principale.
 * Init: initSharingModule(ctx)
 */

import { auth, db } from '../../firebase-config.js';
import { LOG } from '../../logger.js';
import {
import { LOG } from '../../logger.js';
    doc, getDoc, collection, runTransaction
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, clearElement } from '../../dom-utils.js';
import { LOG } from '../../logger.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { LOG } from '../../logger.js';
import { t } from '../../translations.js';
import { LOG } from '../../logger.js';
import { sanitizeEmail } from '../../utils.js';

import { LOG } from '../../logger.js';
// --- STATE (inizializzato da initSharingModule, immutabile per tutta la vita della pagina) ---
let _currentUid = null;
let _currentAziendaId = null;
let _currentId = null;
let _isReadOnly = false;
let _onReload = null; // callback per ricaricare i dati dal modulo principale

/**
 * Inizializza il modulo con il contesto dell'account corrente.
 * Va chiamato in initDettaglioAccountAzienda dopo aver impostato lo stato.
 * @param {Object} ctx
 * @param {Function} ctx.onReload - callback asincrono per ricaricare loadAccount()
 */
export function initSharingModule({ currentUid, currentAziendaId, currentId, isReadOnly, onReload }) {
    _currentUid = currentUid;
    _currentAziendaId = currentAziendaId;
    _currentId = currentId;
    _isReadOnly = isReadOnly;
    _onReload = onReload;
}

/**
 * Renderizza la mappa di condivisione dell'account (sezione sharedWith).
 */
export function renderSharingMap(account) {
    const listContainer = document.getElementById('guests-list');
    const mgmtSection = document.getElementById('shared-management-section');

    if (!listContainer) return;

    clearElement(listContainer);

    if (account.visibility !== 'shared' || !account.sharedWith || Object.keys(account.sharedWith).length === 0) {
        if (mgmtSection) mgmtSection.classList.add('hidden');
        listContainer.appendChild(createElement('p', { className: 'text-[10px] opacity-40 italic', textContent: 'Nessuna condivisione attiva' }));
        return;
    }

    if (mgmtSection) mgmtSection.classList.remove('hidden');

    const guests = Object.values(account.sharedWith);

    for (const inv of guests) {
        if (inv.status === 'rejected') continue;

        const displayStatus = inv.status === 'pending'
            ? (t('status_pending') || 'In attesa')
            : (t('status_accepted') || 'Accettato');
        const statusClass = inv.status === 'pending'
            ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';

        const items = [
            createElement('span', {
                className: `text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
                textContent: displayStatus
            })
        ];

        if (!_isReadOnly) {
            items.push(createElement('button', {
                className: 'btn-icon-header ml-2 hover:text-red-400 transition-colors',
                onclick: () => revokeRecipientV3(inv.email)
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]));
        }

        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between' }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: inv.email.charAt(0).toUpperCase() }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: inv.email.split('@')[0] }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: inv.email })
                ])
            ]),
            createElement('div', { className: 'flex items-center gap-2' }, items)
        ]);
        listContainer.appendChild(div);
    }
}

/**
 * Renderizza la lista ospiti con verifica live dello stato invito (legacy/alternativo).
 */
export async function renderGuests(guests) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    if (!guests || guests.length === 0) {
        list.appendChild(createElement('p', { className: 'text-xs text-white/40 italic ml-1', textContent: t('no_active_access') || 'Nessun accesso attivo' }));
        return;
    }

    let needsUpdate = false;
    let updatedGuests = [...guests];

    for (let i = 0; i < guests.length; i++) {
        let item = guests[i];
        if (typeof item !== 'object') item = { email: item, status: 'accepted' };

        if (item.status === 'rejected') continue;

        const displayEmail = item.email;
        let isPending = item.status === 'pending';
        let displayStatus = t('status_pending') || 'In attesa';
        let statusClass = 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse';

        if (isPending) {
            try {
                const inviteId = `${_currentId}_${sanitizeEmail(displayEmail)}`;
                const invSnap = await getDoc(doc(db, "invites", inviteId));

                if (invSnap.exists()) {
                    const invData = invSnap.data();
                    if (invData.status === 'accepted') {
                        isPending = false;
                        displayStatus = t('status_accepted') || 'Accettato';
                        statusClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
                        updatedGuests[i] = { ...item, status: 'accepted' };
                        needsUpdate = true;
                    } else if (invData.status === 'rejected') {
                        updatedGuests[i] = { ...item, status: 'rejected' };
                        needsUpdate = true;
                        continue;
                    }
                }
            } catch (e) { console.warn("LiveCheck failed", e); }
        } else {
            displayStatus = t('status_accepted') || 'Accettato';
            statusClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
        }

        const div = createElement('div', { className: 'rubrica-list-item flex items-center justify-between mb-2' }, [
            createElement('div', { className: 'flex items-center gap-3' }, [
                createElement('div', {
                    className: 'w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex-center text-[10px] font-bold text-white/40',
                    textContent: displayEmail.charAt(0).toUpperCase()
                }),
                createElement('div', { className: 'flex flex-col' }, [
                    createElement('p', { className: 'text-xs font-bold text-white m-0', textContent: displayEmail.split('@')[0] }),
                    createElement('p', { className: 'text-[10px] text-white/30 m-0', textContent: displayEmail })
                ])
            ]),
            createElement('div', { className: 'flex items-center gap-2' }, [
                createElement('span', {
                    className: `text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
                    textContent: displayStatus
                }),
                !_isReadOnly ? createElement('button', {
                    className: 'ml-1 p-2 rounded-lg bg-transparent border-none text-red-600 hover:text-red-500 hover:scale-110 transition-all cursor-pointer flex items-center justify-center',
                    style: 'outline: none !important; border: none !important; box-shadow: none !important; background: transparent !important;',
                    onclick: () => revokeRecipientV3(displayEmail)
                }, [
                    createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
                ]) : null
            ])
        ]);
        list.appendChild(div);
    }

    if (needsUpdate) {
        try {
            const docRef = doc(db, "users", _currentUid, "aziende", _currentAziendaId, "accounts", _currentId);
            const { updateDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
            await updateDoc(docRef, { sharedWith: updatedGuests });
        } catch (e) { console.error("Auto-Healing di Stato update failed", e); }
    }
}

/**
 * Revoca l'accesso di un singolo ospite tramite transazione atomica (V3.1).
 */
async function revokeRecipientV3(email) {
    if (!email) return;
    const ok = await showConfirmModal(
        t('confirm_revoke_title') || "REVOCA ACCESSO",
        `${t('confirm_revoke_msg') || "Vuoi rimuovere l'accesso per"} ${email}?`,
        t('revoke') || "Revoca"
    );
    if (!ok) return;

    try {
        await runTransaction(db, async (transaction) => {
            const accRef = doc(db, "users", _currentUid, "aziende", _currentAziendaId, "accounts", _currentId);
            const targetSanitized = sanitizeEmail(email);
            const inviteId = `${_currentId}_${targetSanitized}`;
            const invRef = doc(db, "invites", inviteId);

            const accSnap = await transaction.get(accRef);
            if (!accSnap.exists()) return;

            const data = accSnap.data();
            const sharedWith = { ...data.sharedWith } || {};
            const wasAccepted = sharedWith[targetSanitized]?.status === 'accepted';

            // 1. Rimuovi ospite dalla mappa
            delete sharedWith[targetSanitized];

            let newCount = data.acceptedCount || 0;
            if (wasAccepted) newCount = Math.max(0, newCount - 1);

            const hasActiveGuests = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
            const newVisibility = hasActiveGuests ? "shared" : "private";

            // V5.2 AUTO-HEALING: Se torna privato e non era Memo esplicito, torna ad essere Account
            let newType = data.type;
            if (newVisibility === 'private' && data.type === 'memo' && data.isExplicitMemo !== true) {
                newType = 'account';
            }

            transaction.update(accRef, {
                sharedWith: sharedWith,
                acceptedCount: newCount,
                visibility: newVisibility,
                type: newType,
                updatedAt: new Date().toISOString()
            });

            // 2. Elimina l'invito tecnico
            transaction.delete(invRef);

            // 3. Notifica al proprietario
            const ownerNotifRef = doc(collection(db, "users", _currentUid, "notifications"));
            transaction.set(ownerNotifRef, {
                title: "Accesso Revocato",
                message: `Hai revocato l'accesso a ${email} per l'account ${data.nomeAccount || 'selezionato'}.`,
                accountName: data.nomeAccount || 'Account',
                type: "share_revoked",
                accountId: _currentId,
                guestEmail: email,
                timestamp: new Date().toISOString(),
                read: false
            });

            // 4. Notifica all'ospite (se aveva accettato)
            const guestUid = wasAccepted ? data.sharedWith[targetSanitized]?.uid : null;
            if (guestUid) {
                const guestNotifRef = doc(collection(db, "users", guestUid, "notifications"));
                transaction.set(guestNotifRef, {
                    title: "Accesso Revocato",
                    message: `Il proprietario ha rimosso il tuo accesso a: ${data.nomeAccount || 'un account condiviso'}.`,
                    accountName: data.nomeAccount || 'Account',
                    type: "share_revoked",
                    ownerEmail: auth.currentUser?.email || 'Proprietario',
                    timestamp: new Date().toISOString(),
                    read: false
                });
                LOG(`[V5.9-REVOKE] Notification sent to guest: ${guestUid}`);
            }
        });

        showToast("Accesso revocato con successo");
        if (_onReload) await _onReload();
    } catch (e) {
        console.error("RevokeRecipient failed", e);
        showToast(t('error_generic'), 'error');
    }
}
