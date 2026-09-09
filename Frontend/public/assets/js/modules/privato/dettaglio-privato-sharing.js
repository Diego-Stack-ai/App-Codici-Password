/**
 * Gestione delle condivisioni nel dettaglio Account privato.
 * Mantiene rendering e revoca fuori dal modulo principale della pagina.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.74';
import { LOG } from '../../logger.js';
import { doc, collection, runTransaction } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { sanitizeEmail } from '../../utils.js';

let currentUid = null;
let ownerId = null;
let accountId = null;
let readOnly = true;
let onReload = null;

export function initPrivateSharingModule(context) {
    currentUid = context.currentUid;
    ownerId = context.ownerId;
    accountId = context.accountId;
    readOnly = Boolean(context.readOnly);
    onReload = context.onReload;
}

function normalizeEmailForLookup(email) {
    return String(email || '').trim().toLowerCase();
}

export function renderPrivateSharingMap(account, contactNames = new Map()) {
    const listContainer = document.getElementById('guests-list');
    const managementSection = document.getElementById('shared-management-section');
    if (!listContainer) return;

    clearElement(listContainer);
    if (account.visibility !== 'shared' || !account.sharedWith || Object.keys(account.sharedWith).length === 0) {
        managementSection?.classList.add('hidden');
        listContainer.appendChild(createElement('p', {
            className: 'text-[10px] opacity-40 italic',
            textContent: 'Nessuna condivisione attiva'
        }));
        return;
    }

    managementSection?.classList.remove('hidden');
    for (const invitation of Object.values(account.sharedWith)) {
        if (invitation.status === 'rejected') continue;

        const pending = invitation.status === 'pending';
        const displayStatus = pending ? (t('status_pending') || 'In attesa') : (t('status_accepted') || 'Accettato');
        const statusClass = pending
            ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 animate-pulse'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20';
        const actions = [createElement('span', {
            className: `text-[8px] font-black uppercase px-2 py-1 rounded border ${statusClass}`,
            textContent: displayStatus
        })];

        if (!readOnly) {
            actions.push(createElement('button', {
                className: 'ml-2 p-2 rounded-lg bg-transparent border-none text-red-600 hover:text-red-500 hover:scale-110 transition-all cursor-pointer flex items-center justify-center sharing-revoke-button',
                onclick: () => revokeRecipient(invitation.email)
            }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })]));
        }

        listContainer.appendChild(createElement('div', {
            className: 'rubrica-list-item flex items-center justify-between'
        }, [
            createElement('div', { className: 'rubrica-item-info-row' }, [
                createElement('div', { className: 'rubrica-item-avatar', textContent: invitation.email.charAt(0).toUpperCase() }),
                createElement('div', { className: 'rubrica-item-info' }, [
                    createElement('p', {
                        className: 'truncate m-0 rubrica-item-name',
                        textContent: contactNames.get(normalizeEmailForLookup(invitation.email)) || invitation.email.split('@')[0]
                    }),
                    createElement('p', { className: 'truncate m-0 opacity-60 text-[10px]', textContent: invitation.email })
                ])
            ]),
            createElement('div', { className: 'flex items-center gap-2' }, actions)
        ]));
    }
}

async function revokeRecipient(email) {
    if (!email || readOnly || currentUid !== ownerId) return;
    const confirmed = await showConfirmModal(
        t('confirm_revoke_title') || 'REVOCA ACCESSO',
        `${t('confirm_revoke_msg') || "Vuoi rimuovere l'accesso per"} ${email}?`,
        t('revoke') || 'Revoca'
    );
    if (!confirmed) return;

    try {
        await runTransaction(db, async transaction => {
            const accountRef = doc(db, 'users', ownerId, 'accounts', accountId);
            const normalizedEmail = sanitizeEmail(email);
            const inviteRef = doc(db, 'invites', `${accountId}_${normalizedEmail}`);
            const snapshot = await transaction.get(accountRef);
            if (!snapshot.exists()) return;

            const data = snapshot.data();
            const sharedWith = { ...(data.sharedWith || {}) };
            const revokedInvitation = sharedWith[normalizedEmail];
            const wasAccepted = revokedInvitation?.status === 'accepted';
            const guestUid = wasAccepted ? revokedInvitation?.uid : null;
            delete sharedWith[normalizedEmail];

            const hasActiveGuests = Object.values(sharedWith)
                .some(guest => guest.status === 'pending' || guest.status === 'accepted');
            const visibility = hasActiveGuests ? 'shared' : 'private';
            const type = visibility === 'private' && data.type === 'memo' && data.isExplicitMemo !== true
                ? 'account'
                : data.type;

            transaction.update(accountRef, {
                sharedWith,
                sharedWithUids: Object.values(sharedWith)
                    .filter(guest => guest.status === 'accepted' && guest.uid)
                    .map(guest => guest.uid),
                acceptedCount: wasAccepted ? Math.max(0, (data.acceptedCount || 0) - 1) : (data.acceptedCount || 0),
                visibility,
                type,
                updatedAt: new Date().toISOString()
            });
            transaction.delete(inviteRef);

            transaction.set(doc(collection(db, 'users', ownerId, 'notifications')), {
                title: 'Accesso Revocato',
                message: `Hai revocato l'accesso a ${email} per l'account ${data.nomeAccount || 'selezionato'}.`,
                accountName: data.nomeAccount || 'Account',
                type: 'share_revoked',
                accountId,
                guestEmail: email,
                timestamp: new Date().toISOString(),
                read: false
            });

            if (guestUid) {
                transaction.set(doc(collection(db, 'users', guestUid, 'notifications')), {
                    title: 'Accesso Revocato',
                    message: `Il proprietario ha rimosso il tuo accesso a: ${data.nomeAccount || 'un account condiviso'}.`,
                    accountName: data.nomeAccount || 'Account',
                    type: 'share_revoked',
                    ownerEmail: auth.currentUser?.email || 'Proprietario',
                    timestamp: new Date().toISOString(),
                    read: false
                });
                LOG(`[V5.9-REVOKE] Notification sent to guest: ${guestUid}`);
            }
        });

        showToast('Accesso revocato con successo');
        if (onReload) await onReload();
    } catch (error) {
        console.error('RevokeRecipient failed', error);
        showToast(t('error_generic'), 'error');
    }
}
