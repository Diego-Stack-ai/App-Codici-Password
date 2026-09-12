/**
 * ACCOUNT AZIENDA MODULE (V5.0 Compliant)
 * Gestione lista account per una specifica azienda, allineata allo stile Account Privati.
 */

import { db } from '../../firebase-config.js?v=1.2.110';
import { doc, updateDoc, deleteDoc } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import {listCompanyAccounts} from '../data/vault-repository.js';
import { createAccountListView } from '../shared/account-list-view.js';
import {createArchiveMetadata} from '../settings/archive-account-model.js';

// Compatibility entry point: one active mount per canonical document.
let activeMount = null;
export async function initAccountAziendaList(user, options = {}) {
    activeMount?.destroy();
    const mounted = mountAccountAziendaList(user, options);
    activeMount = mounted;
    await mounted.ready;
    return mounted.destroy;
}

// Each mount owns its state, listeners and pending consumers.
export function mountAccountAziendaList(user, options = {}) {
    const lifecycle = new AbortController();
    const signal = lifecycle.signal;
    const query = options.search ?? window.location.search;
    const navigate = url => {
        if (signal.aborted) return;
        if (options.navigate) options.navigate(url);
        else window.location.href = url;
    };
    const content = document.getElementById('accounts-container');
    function assertActive() { if (signal.aborted) throw new DOMException('Page unmounted', 'AbortError'); }
    async function waitFor(promise) { const result = await promise; assertActive(); return result; }
    function destroy() {
        if (signal.aborted) return;
        lifecycle.abort();
        options.signal?.removeEventListener('abort', destroy);
        accountListView.destroy();
        allAccounts = [];
        currentUser = null;
        if (content) clearElement(content);
    }

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
            if (signal.aborted) return;
            navigate(`dettaglio_account_azienda.html?id=${account.id}&aziendaId=${currentAziendaId}`);
        },
        onPin: togglePin,
        onDelete: handleDelete,
        onArchive: handleArchive
    });

    // --- INITIALIZATION ---
    async function start() {
        if (!user) { navigate('login-v115.html'); return; }

        currentUser = user;
        const urlParams = new URLSearchParams(query);
        currentAziendaId = urlParams.get('id');

        if (!currentAziendaId) { navigate('lista_aziende.html'); return; }

        setupUI();
        try {
            await loadAccounts();
        } catch (e) {
            if (signal.aborted) return;
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
        if (searchInput) searchInput.addEventListener('input', filterAndRender, {signal});

        const sortBtn = document.getElementById('sort-btn');
        const sortLabel = document.getElementById('sort-label');
        if (sortBtn && sortLabel) {
            sortLabel.textContent = 'A-Z';
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
                sortLabel.textContent = (sortOrder === 'asc') ? 'A-Z' : 'Z-A';
                filterAndRender();
            }, {signal});
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
            allAccounts = (await waitFor(listCompanyAccounts(currentUser.uid, currentAziendaId)))
                .map(account => ({...account, isOwner: true}));

            // 🔐 DECRIPTAZIONE GLOBALE (Auto-Unlock Compliant)
            const vaultKeyMaterial = await waitFor(ensureVaultKeyMaterial().catch(() => null));
            if (vaultKeyMaterial) {
                allAccounts = await waitFor(Promise.all(allAccounts.map(async acc => {
                    if (acc._encrypted) {
                        try {
                            acc.username = acc.username ? await waitFor(decrypt(acc.username, vaultKeyMaterial)) : acc.username;
                            acc.account = acc.account ? await waitFor(decrypt(acc.account, vaultKeyMaterial)) : acc.account;
                            // La password non è necessaria alla lista e viene
                            // decifrata soltanto nella pagina di dettaglio.
                        } catch (e) {
                            if (signal.aborted) return;
                            console.warn("[Azienda] Decryption failed for:", acc.id);
                        }
                    }
                    return acc;
                })));
            }

            filterAndRender();
        } catch (e) {
            if (signal.aborted) return;
            logError("LoadAccounts", e);
            throw e;
        }
    }

    function filterAndRender() {
        if (signal.aborted) return;
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
        if (signal.aborted) return;
        if (!currentAziendaId) return;
        try {
            const newVal = !acc.isPinned;
            await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", acc.id), { isPinned: newVal });
            if (signal.aborted) return;
            acc.isPinned = newVal;
            filterAndRender();
        } catch (e) {
            if (signal.aborted) return;
            logError("Pin", e);
        }
    }

    async function handleArchive(item) {
        if (signal.aborted) return;
        const id = item.dataset.id;
        if (!currentAziendaId) return;
        try {
            const account = allAccounts.find(candidate => candidate.id === id);
            await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), createArchiveMetadata(account));
            if (signal.aborted) return;
            showToast(t('success_archived'));
            allAccounts = allAccounts.filter(a => a.id !== id);
            filterAndRender();
        } catch (e) {
            if (signal.aborted) return;
            logError("Archive", e);
        }
    }

    async function handleDelete(item) {
        if (signal.aborted) return;
        const id = item.dataset.id;
        if (!currentAziendaId) return;
        const confirmed = await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'));
        if (signal.aborted) return;
        if (!confirmed) {
            filterAndRender(); // Reset swipe
            return;
        }
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id));
            if (signal.aborted) return;
            showToast(t('success_deleted'));
            allAccounts = allAccounts.filter(a => a.id !== id);
            filterAndRender();
        } catch (e) {
            if (signal.aborted) return;
            logError("Delete", e);
        }
    }

    options.signal?.addEventListener('abort', destroy, {once: true});
    if (options.signal?.aborted) destroy();
    const ready = signal.aborted ? Promise.resolve() : start();
    return Object.freeze({ready, destroy});
}
