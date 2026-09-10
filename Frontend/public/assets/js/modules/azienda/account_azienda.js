/**
 * ACCOUNT AZIENDA MODULE (V5.0 Compliant)
 * Gestione lista account per una specifica azienda, allineata allo stile Account Privati.
 */

import { db } from '../../firebase-config.js?v=1.2.93';
import { doc, updateDoc, deleteDoc } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import {listCompanyAccounts} from '../data/vault-repository.js';
import { createAccountListView } from '../shared/account-list-view.js';
import {createArchiveMetadata} from '../settings/archive-account-model.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let sortOrder = 'asc';
let currentAziendaId = null;

const THEMES = {
    standard: { accent: 'theme-accent-standard', text: 'theme-text-standard' },
    shared: { accent: 'theme-accent-shared', text: 'theme-text-shared' },
    memo: { accent: 'theme-accent-memo', text: 'theme-text-memo' },
    shared_memo: { accent: 'theme-accent-shared-memo', text: 'theme-text-shared-memo' }
};

const accountListView = createAccountListView({
    themes: THEMES,
    emptyStateClass: 'empty-state-box',
    emptyTextClass: 'empty-state-text',
    getSubtitle: account => account.username || account.account || '...',
    onNavigate(account) {
        window.location.href = `dettaglio_account_azienda.html?id=${account.id}&aziendaId=${currentAziendaId}`;
    },
    onPin: togglePin,
    onDelete: handleDelete,
    onArchive: handleArchive
});

// --- INITIALIZATION ---
export async function initAccountAziendaList(user) {
    if (!user) { window.location.href = 'login-v115.html'; return; }

    currentUser = user;
    const urlParams = new URLSearchParams(window.location.search);
    currentAziendaId = urlParams.get('id');

    if (!currentAziendaId) { window.location.href = 'lista_aziende.html'; return; }

    setupUI();
    try {
        await loadAccounts();
    } catch (e) {
        logError("InitAccountAzienda", e);
        const container = document.getElementById('accounts-container');
        if (container) {
            clearElement(container);
            setChildren(container, createElement('p', {
                className: 'error-message-box',
                textContent: t('error_loading_accounts') || "Errore caricamento dati."
            }));
        }
    }
}

function setupUI() {
    // Header e navigazione Back restano sotto il controllo del componente
    // condiviso, così Account Azienda torna coerentemente a Lista Aziende.

    // Search & Sort Listeners
    const searchInput = document.getElementById('account-search');
    if (searchInput) searchInput.addEventListener('input', filterAndRender);

    const sortBtn = document.getElementById('sort-btn');
    const sortLabel = document.getElementById('sort-label');
    if (sortBtn && sortLabel) {
        sortBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
            sortLabel.textContent = (sortOrder === 'asc') ? 'A-Z' : 'Z-A';
            filterAndRender();
        });
    }



    // 4. Footer FAB (Add Account)
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter && currentAziendaId) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('a', {
                href: `form_account_azienda.html?aziendaId=${currentAziendaId}`,
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('add_account') || 'Nuovo Account',
                dataset: { label: t('add_short') || 'Aggiungi' }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
            ])
        ]));
    }
}

async function loadAccounts() {
    if (!currentUser || !currentAziendaId) return;
    try {
        allAccounts = (await listCompanyAccounts(currentUser.uid, currentAziendaId))
            .map(account => ({...account, isOwner: true}));

        // 🔐 DECRIPTAZIONE GLOBALE (Auto-Unlock Compliant)
        const vaultKeyMaterial = await ensureVaultKeyMaterial().catch(() => null);
        if (vaultKeyMaterial) {
            allAccounts = await Promise.all(allAccounts.map(async acc => {
                if (acc._encrypted) {
                    try {
                        acc.username = acc.username ? await decrypt(acc.username, vaultKeyMaterial) : acc.username;
                        acc.account = acc.account ? await decrypt(acc.account, vaultKeyMaterial) : acc.account;
                        // La password non è necessaria alla lista e viene
                        // decifrata soltanto nella pagina di dettaglio.
                    } catch (e) {
                        console.warn("[Azienda] Decryption failed for:", acc.id);
                    }
                }
                return acc;
            }));
        }

        filterAndRender();
    } catch (e) {
        logError("LoadAccounts", e);
        throw e;
    }
}

function filterAndRender() {
    const term = document.getElementById('account-search')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        if (acc.isArchived) return false;
        if (!term) return true;
        const n = (acc.nomeAccount || "").toLowerCase();
        const u = (acc.username || "").toLowerCase();
        const a = (acc.account || "").toLowerCase();
        return n.includes(term) || u.includes(term) || a.includes(term);
    });

    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const nA = (a.nomeAccount || "").toLowerCase();
        const nB = (b.nomeAccount || "").toLowerCase();
        return sortOrder === 'asc' ? nA.localeCompare(nB) : nB.localeCompare(nA);
    });

    accountListView.render(filtered);
}

// --- ACTIONS ---

async function togglePin(acc) {
    if (!currentAziendaId) return;
    try {
        const newVal = !acc.isPinned;
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", acc.id), { isPinned: newVal });
        acc.isPinned = newVal;
        filterAndRender();
    } catch (e) { logError("Pin", e); }
}

async function handleArchive(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;
    try {
        const account = allAccounts.find(candidate => candidate.id === id);
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), createArchiveMetadata(account));
        showToast(t('success_archived'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Archive", e); }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) {
        filterAndRender(); // Reset swipe
        return;
    }
    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id));
        showToast(t('success_deleted'));
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) { logError("Delete", e); }
}
