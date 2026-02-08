/**
 * ACCOUNT AZIENDA LIST (V4.1)
 * Gestione liste account per una specifica azienda.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let allAccounts = [];
let companyData = null;
let sortOrder = 'asc';
let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const companyId = urlParams.get('id');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.querySelector('.flex.flex-col.gap-4.mt-2');
    const searchInput = document.querySelector('input[type="text"]');
    const sortBtn = document.getElementById('sort-btn');

    if (!companyId) {
        showToast("ID Azienda mancante", "error");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1500);
        return;
    }

    observeAuth(async (user) => {
        if (user) {
            currentUser = user;
            await loadCompanyAndAccounts();
        } else {
            if (listContainer) {
                clearElement(listContainer);
                setChildren(listContainer, [
                    createElement('p', { className: 'text-center py-10 opacity-50', textContent: t('login_required') || 'Effettua il login.' })
                ]);
            }
        }
    });

    // Event Listeners
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            sortBtn.classList.toggle('bg-primary/10', sortOrder === 'desc');
            showToast(`${t('sorting') || 'Ordinamento'}: ${sortOrder.toUpperCase()}`);
            renderAccounts();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => renderAccounts());
    }
});

async function loadCompanyAndAccounts() {
    const listContainer = document.querySelector('.flex.flex-col.gap-4.mt-2');
    const headerTitle = document.querySelector('header h1');
    const headerLogoText = document.querySelector('header .text-white.font-bold');

    try {
        const companyDoc = await getDoc(doc(db, "users", currentUser.uid, "aziende", companyId));
        if (!companyDoc.exists()) {
            showToast("Azienda non trovata", "error");
            return;
        }
        companyData = { id: companyDoc.id, ...companyDoc.data() };

        if (headerTitle) headerTitle.textContent = companyData.ragioneSociale || 'Azienda';
        if (headerLogoText) headerLogoText.textContent = (companyData.ragioneSociale || 'A').substring(0, 2).toUpperCase();

        const accountsQ = query(collection(db, "users", currentUser.uid, "accounts"), where("type", "==", "azienda"));
        const snapshot = await getDocs(accountsQ);
        const rawAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allAccounts = rawAccounts.filter(acc => (acc.companyId === companyId) || (acc.company === companyData.ragioneSociale));
        renderAccounts();

    } catch (e) {
        logError("LoadCompanyAccounts", e);
        if (listContainer) {
            clearElement(listContainer);
            setChildren(listContainer, [
                createElement('p', { className: 'text-center text-red-500 py-10', textContent: `${t('error_generic')}: ${e.message}` })
            ]);
        }
    }
}

function renderAccounts() {
    const listContainer = document.querySelector('.flex.flex-col.gap-4.mt-2');
    const searchInput = document.querySelector('input[type="text"]');
    if (!listContainer) return;

    const term = searchInput ? searchInput.value.toLowerCase() : '';
    let filtered = allAccounts.filter(acc => {
        if (!term) return true;
        return (acc.nomeAccount || acc.title || '').toLowerCase().includes(term) ||
            (acc.username || '').toLowerCase().includes(term);
    });

    if (filtered.length === 0) {
        clearElement(listContainer);
        setChildren(listContainer, [
            createElement('div', { className: 'flex flex-col items-center justify-center py-10 opacity-50' }, [
                createElement('span', { className: 'material-symbols-outlined text-4xl mb-2 text-slate-300', textContent: 'folder_off' }),
                createElement('p', { className: 'text-sm font-medium text-slate-500', textContent: t('no_accounts_found') || 'Nessun account trovato.' })
            ])
        ]);
        return;
    }

    filtered.sort((a, b) => {
        const pinA = !!a.isPinned;
        const pinB = !!b.isPinned;
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;
        const nameA = (a.nomeAccount || a.title || '').toLowerCase();
        const nameB = (b.nomeAccount || b.title || '').toLowerCase();
        if (pinA && pinB) return nameA.localeCompare(nameB);
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    clearElement(listContainer);
    const fragment = document.createDocumentFragment();
    filtered.forEach(acc => fragment.appendChild(createAccountCard(acc)));
    listContainer.appendChild(fragment);
}

function createAccountCard(acc) {
    const isPinned = !!acc.isPinned;
    const pinClass = isPinned ? 'text-primary fill-current rotate-45' : 'text-slate-300 hover:text-primary';
    const detailLink = `dettaglio_account_azienda.html?id=${acc.id}&ownerId=${currentUser.uid}`;

    const btnPin = createElement('button', {
        className: `btn-pin absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 transition-colors ${pinClass}`,
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); togglePin(acc.id); }
    }, [
        createElement('span', { className: 'material-symbols-outlined text-[20px]', textContent: 'push_pin' })
    ]);

    return createElement('div', { className: 'relative group' }, [
        createElement('a', {
            href: detailLink,
            className: "block bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2 hover:shadow-md transition-shadow"
        }, [
            createElement('div', { className: 'flex items-start justify-between' }, [
                createElement('div', { className: 'flex items-center gap-3' }, [
                    createElement('div', { className: 'size-10 rounded-lg bg-blue-50 flex items-center justify-center text-primary' }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: getIconForCategory(acc.category) })
                    ]),
                    createElement('div', {}, [
                        createElement('h3', { className: 'font-bold text-slate-900 text-sm', textContent: acc.nomeAccount || acc.title || 'Senza Nome' }),
                        createElement('p', { className: 'text-xs text-slate-500', textContent: acc.category || 'Generico' })
                    ])
                ])
            ]),
            createElement('div', {
                className: 'mt-2 text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg truncate',
                textContent: acc.username || 'Nessun username'
            })
        ]),
        btnPin
    ]);
}

function getIconForCategory(cat) {
    if (!cat) return 'folder';
    const c = cat.toLowerCase();
    if (c.includes('banca')) return 'account_balance';
    if (c.includes('carta')) return 'credit_card';
    if (c.includes('fisco')) return 'receipt_long';
    if (c.includes('servizi')) return 'cloud';
    if (c.includes('pec')) return 'mail';
    return 'folder';
}

async function togglePin(id) {
    const item = allAccounts.find(a => a.id === id);
    if (!item) return;

    if (!item.isPinned) {
        const count = allAccounts.filter(a => a.isPinned).length;
        if (count >= 3) {
            showToast(t('max_pinned_reached') || "Massimo 3 account fissati.", "error");
            return;
        }
    }

    const newState = !item.isPinned;
    item.isPinned = newState;
    renderAccounts();

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), { isPinned: newState });
        showToast(newState ? (t('account_pinned') || "Account fissato") : (t('pin_removed') || "Pin rimosso"));
    } catch (err) {
        logError("TogglePin", err);
        showToast(t('error_generic'), "error");
        item.isPinned = !newState;
        renderAccounts();
    }
}

