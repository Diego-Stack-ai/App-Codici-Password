/**
 * ACCOUNT PRIVATI MODULE (V4.2)
 * Gestione liste account: personali, condivisi, memorandum.
 */

import { db } from '../../firebase-config.js?v=1.2.96';
import { LOG } from '../../logger.js';
import { updateDoc, doc, writeBatch } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import {
    getRecordByPath,
    getUserProfile,
    listAcceptedInvites,
    listPrivateAccounts,
    listPrivateAccountsConfirmed
} from '../data/vault-repository.js';
import { accountModeFromRecord } from '../shared/account-mode-model.js';
import { createAccountListView } from '../shared/account-list-view.js';
import {createArchiveMetadata} from '../settings/archive-account-model.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let sortOrder = 'asc';

const THEMES = {
    standard: { accent: 'bg-blue-500', text: 'text-blue-400' },
    shared: { accent: 'bg-purple-500', text: 'text-purple-400' },
    memo: { accent: 'bg-amber-500', text: 'text-amber-400' },
    shared_memo: { accent: 'bg-emerald-500', text: 'text-emerald-400' }
};

const accountListView = createAccountListView({
    themes: THEMES,
    emptyStateClass: 'text-center py-10',
    emptyTextClass: 'opacity-40 text-xs uppercase font-black tracking-widest mb-6',
    getSubtitle: account => account.username || account.email || 'Utente Nascosto',
    onNavigate(account) {
        if (account._aziendaId) {
            window.location.href = `dettaglio_account_azienda.html?id=${account.id}&aziendaId=${account._aziendaId}&ownerId=${account.ownerId}`;
        } else {
            window.location.href = `dettaglio_account_privato.html?id=${account.id}${account.isOwner ? '' : `&ownerId=${account.ownerId}`}`;
        }
    },
    onPin: togglePin,
    onDelete: handleDelete,
    onArchive: handleArchive
});

/**
 * ACCOUNT PRIVATI MODULE (V5.0 ADAPTER)
 * Gestione liste account: personali, condivisi, memorandum.
 * - Entry Point: initAccountPrivati(user)
 */

export async function initAccountPrivati(user) {
    
    if (!user) return;
    currentUser = user;

    // Nota: initComponents() rimosso (gestito da main.js)

    setupUI();
    await loadAccounts();
    
}

function setupUI() {
    // Override freccia back -> sempre verso area_privata.html
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => window.location.href = 'area_privata.html'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
        ]));
    }

    const searchInput = document.getElementById('account-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    // Sort Button Logic (Toggle)
    const sortBtn = document.getElementById('sort-btn');
    const sortLabel = document.getElementById('sort-label');

    if (sortBtn && sortLabel) {
        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle Sort Order
            sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';

            // Update UI
            sortLabel.textContent = (sortOrder === 'asc') ? 'A-Z' : 'Z-A';

            // Re-render
            filterAndRender();
        });
    }

    // Aggiungi pulsanti FAB nel footer center
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        const type = new URLSearchParams(window.location.search).get('type') || 'standard';
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('a', {
                href: 'archivio_account.html',
                className: 'btn-fab-action btn-fab-archive',
                title: t('account_archive') || 'Archivio',
                dataset: { label: t('archive') || 'Archivio' }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'inventory_2' })
            ]),
            createElement('button', {
                id: 'add-account-btn',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('add_account') || 'Nuovo Account',
                dataset: { label: t('add_short') || 'Aggiungi' },
                onclick: () => window.location.href = `form_account_privato.html?type=${type}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
            ])
        ]));
    }
}

/**
 * LOADING ENGINE
 */
async function loadAccounts() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const requireServerRefresh = (urlParams.get('afterWrite') === '1' || urlParams.get('m6refresh') === '1') && navigator.onLine;
        let sharedWithMe = [];

        // 1. Invitations Accepted
        LOG('[ACCOUNTS] Searching invites for authenticated user');
        // Account propri e inviti sono indipendenti: avviamo entrambe le letture
        // subito, mantenendo invariato il successivo assemblaggio delle card.
        const ownAccountsPromise = requireServerRefresh
            ? listPrivateAccountsConfirmed(currentUser.uid)
            : listPrivateAccounts(currentUser.uid);
        const invites = await listAcceptedInvites(currentUser.email);
        LOG(`[ACCOUNTS] Found ${invites.length} accepted invites.`);

        const invitePromises = invites.map(async inv => {
            const inviteId = inv.id;
            try {
                const senderId = inv.senderId || inv.senderUid || inv.ownerId;
                if (!senderId) {
                    console.error(`[ACCOUNTS] Invite ${inviteId} skipped: missing sender/owner ID`);
                    return null;
                }

                let accPath = `users/${senderId}/accounts/${inv.accountId}`;
                // Consider empty string or null as no azienda
                if (inv.aziendaId && inv.aziendaId.trim() !== "") {
                    accPath = `users/${senderId}/aziende/${inv.aziendaId}/accounts/${inv.accountId}`;
                }

                LOG(`[ACCOUNTS] Fetching doc: ${accPath} for invite ${inviteId}`);
                const sharedAccount = await getRecordByPath(accPath);

                if (sharedAccount) {
                    LOG('[ACCOUNTS] Shared account loaded');
                    return { ...sharedAccount, isOwner: false, ownerId: senderId, _isGuest: true, _aziendaId: inv.aziendaId };
                } else {
                    console.warn(`[ACCOUNTS] NOT FOUND: Account doc at ${accPath}. Check permissions or if deleted.`);
                }
            } catch (e) {
                console.error(`[ACCOUNTS] ERROR loading ${inviteId}:`, e.message);
            }
            return null;
        });
        sharedWithMe = (await Promise.all(invitePromises)).filter(Boolean);
        LOG(`[ACCOUNTS] Total shared accounts successfully loaded: ${sharedWithMe.length}`);

        // 2. Own Accounts
        LOG('[ACCOUNTS] Loading own accounts');
        const ownRecords = await ownAccountsPromise;
        if (requireServerRefresh) {
            const pilot = await import('../data/private-account-offline-pilot.js');
            const handoffRecord = pilot.consumePrivateAccountHandoff(currentUser.uid);
            if (handoffRecord && !ownRecords.some(record => record.id === handoffRecord.id)) {
                ownRecords.push(handoffRecord);
            }
        }
        LOG(`[ACCOUNTS] Found ${ownRecords.length} own accounts.`);
        const ownAccounts = ownRecords.map(data => {
            const isRealOwner = !data.ownerId || data.ownerId === currentUser.uid;
            return {
                ...data,
                id: data.id,
                isOwner: isRealOwner,
                ownerId: data.ownerId || currentUser.uid,
                _isGuest: !isRealOwner
            };
        }).filter(a => !a.isArchived);

        allAccounts = [...ownAccounts, ...sharedWithMe];

        if (requireServerRefresh) {
            urlParams.delete('afterWrite');
            urlParams.delete('m6refresh');
            const cleanQuery = urlParams.toString();
            window.history.replaceState(null, '', `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}`);
        }

        // 🔐 DECRIPTAZIONE GLOBALE (Auto-Unlock Compliant)
        const vaultKeyMaterial = await ensureVaultKeyMaterial().catch(() => null);
        if (vaultKeyMaterial) {
            allAccounts = await Promise.all(allAccounts.map(async acc => {
                if (acc._encrypted) {
                    try {
                        acc.username = acc.username ? await decrypt(acc.username, vaultKeyMaterial) : acc.username;
                        acc.account = acc.account ? await decrypt(acc.account, vaultKeyMaterial) : acc.account;
                        // La password non è visibile né ricercabile nella lista:
                        // resta cifrata finché non viene aperto il dettaglio.
                    } catch (e) {
                        console.error("[Accounts] Decryption failed for:", acc.id, e);
                    }
                }
                return acc;
            }));
        }

        filterAndRender();
    } catch (e) {
        logError("LoadAccounts", e);
        showToast(t('error_generic'), "error");
    }
}

/**
 * FILTER & RENDER
 */
function filterAndRender() {
    const type = new URLSearchParams(window.location.search).get('type') || 'standard';
    const searchVal = document.getElementById('account-search')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        const mode = accountModeFromRecord(acc);
        if (type === 'standard') return mode === 'account-private';
        if (type === 'shared') return mode === 'account-shared';
        if (type === 'memo') return mode === 'memo-private';
        if (type === 'shared_memo') return mode === 'memo-shared';
        return true;
    });

    if (searchVal) {
        filtered = filtered.filter(acc =>
            (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
            (acc.username || '').toLowerCase().includes(searchVal)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const nA = (a.nomeAccount || '').toLowerCase();
        const nB = (b.nomeAccount || '').toLowerCase();
        return sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
    });

    accountListView.render(filtered);
}

/**
 * ACTIONS
 */
async function togglePin(acc) {
    if (!acc.isOwner) { showToast(t('error_only_owner_pin') || "Solo il proprietario può fissare l'account", "info"); return; }
    try {
        const newVal = !acc.isPinned;
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", acc.id), { isPinned: newVal });
        acc.isPinned = newVal;
        filterAndRender();
    } catch (e) { logError("Pin", e); }
}

async function handleArchive(item) {
    const id = item.dataset.id;
    if (item.dataset.owner !== 'true') { showToast(t('error_only_owner_archive'), "error"); filterAndRender(); return; }
    try {
        const account = allAccounts.find(candidate => candidate.id === id);
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), createArchiveMetadata(account));
        showToast(t('success_archived'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Archive", e); }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (item.dataset.owner !== 'true') { showToast(t('error_only_owner_delete'), "error"); filterAndRender(); return; }
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) { filterAndRender(); return; }
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userProfile = await getUserProfile(currentUser.uid);
        const emails = userProfile?.contactEmails || [];
        const hasProfileLink = emails.some(email => email.linkedAccountId === id);
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", currentUser.uid, "accounts", id));
        if (hasProfileLink) {
            batch.update(userRef, {
                contactEmails: emails.map(email => email.linkedAccountId === id
                    ? { ...email, linkedAccountId: null }
                    : email)
            });
        }
        await batch.commit();
        showToast(t('success_deleted'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Delete", e); }
}
