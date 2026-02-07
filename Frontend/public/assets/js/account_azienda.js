import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { t } from './translations.js';
import { initComponents } from './components.js';

// --- STATE ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sortOrder = 'asc';
let currentAziendaId = null;
const APP_VERSION = "v1.0 (Company)";

const logDebug = (msg) => console.log(`[${APP_VERSION}] ${msg}`);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const urlParams = new URLSearchParams(window.location.search);
        currentAziendaId = urlParams.get('id'); // ID Azienda from URL

        if (!currentAziendaId) {
            window.location.href = 'lista_aziende.html';
            return;
        }

        // 1. Init UI (Protocol Standard)
        await initProtocolUI();
        // 2. Load Data
        await loadAccounts();
    } else {
        setTimeout(() => window.location.href = 'index.html', 1000);
    }
});

async function initProtocolUI() {
    await initComponents();

    // Header Setup
    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');

    if (hLeft) {
        hLeft.innerHTML = `<button id="btn-back-area" class="btn-icon-header"><span class="material-symbols-outlined">arrow_back</span></button>`;
        document.getElementById('btn-back-area').addEventListener('click', () => {
            window.location.href = 'lista_aziende.html';
        });
    }
    if (hCenter) {
        let titleKey = "company_accounts";
        // Fetch company name for better title? Optional. For now static or Generic.
        hCenter.innerHTML = `<h2 class="header-title" data-t="${titleKey}">Account Azienda</h2>`;
    }
    if (hRight) {
        hRight.innerHTML = `
            <div class="flex items-center gap-2">
                <button id="sort-btn" class="btn-icon-header" title="Ordina">
                    <span class="material-symbols-outlined">sort_by_alpha</span>
                </button>
                <a href="home_page.html" class="btn-icon-header">
                    <span class="material-symbols-outlined">home</span>
                </a>
            </div>
        `;
        document.getElementById('sort-btn').onclick = toggleSort;
    }

    // Footer Functional Center: Add Button
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        fCenter.innerHTML = `
            <button id="add-account-btn" class="btn-floating-add" style="background: rgba(80, 150, 255, 0.6)">
                <span class="material-symbols-outlined">add</span>
            </button>
        `;
        document.getElementById('add-account-btn').addEventListener('click', () => {
            window.location.href = `form_account_azienda.html?aziendaId=${currentAziendaId}`;
        });
    }

    // Apply translations to everything
    const searchInput = document.getElementById('account-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }
}

window.togglePin = async (id) => {
    if (!currentUser || !currentAziendaId) return;
    const acc = allAccounts.find(a => a.id === id);
    if (!acc) return;

    const newVal = !acc.isPinned;
    acc.isPinned = newVal;
    filterAndRender();

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), { isPinned: newVal });
    } catch (e) {
        logError("Pin Toggle Company", e);
        acc.isPinned = !newVal; // Revert
        filterAndRender();
        showToast("Errore nel modificare lo stato Pin", "error");
    }
};

async function loadAccounts() {
    try {
        logDebug("Caricamento account azienda...");

        const colRef = collection(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts");
        const snap = await getDocs(colRef);

        allAccounts = snap.docs.map(doc => {
            const d = doc.data();
            return {
                ...d,
                id: doc.id,
                _isShared: false, // Company accounts usually standard
                _isMemo: false
            };
        }).filter(a => !a.isArchived);

        logDebug(`Caricati ${allAccounts.length} account aziendali`);
        filterAndRender();

    } catch (error) {
        logError("Accounts Master Load", error);
        showToast("Errore caricamento dati.", "error");
    }
}

function filterAndRender() {
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';

    let filtered = allAccounts;

    // Search Filter
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

        if (sortOrder === 'desc') {
            return nB.localeCompare(nA);
        }
        return nA.localeCompare(nB);
    });

    renderList(filtered);
}

function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-50"><p>${t('no_accounts_found') || 'Nessun account trovato'}</p></div>`;
        return;
    }

    container.innerHTML = list.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
        const accentColor = 'rgba(80, 150, 255, 0.6)'; // Blue standard for Company
        const isPinned = !!acc.isPinned;
        const dots = '••••••••';

        return `
            <div class="micro-account-card swipe-row cursor-pointer hover:bg-white/5 transition-all active:scale-95" id="acc-${acc.id}" 
                 data-id="${acc.id}" 
                 data-action="navigate" data-href="dettaglio_account_azienda.html?id=${acc.id}&aziendaId=${currentAziendaId}">
              
              <div class="swipe-backgrounds">
                 <div class="swipe-bg-left"><span class="material-symbols-outlined">delete</span></div>
                 <div class="swipe-bg-right"><span class="material-symbols-outlined">archive</span></div>
              </div>

              <div class="relative z-10 swipe-content">
                <div class="micro-account-content">
                    <div class="micro-account-avatar-box">
                        <img class="micro-account-avatar" src="${avatar}" alt="">
                        <div class="micro-item-badge-dot" style="background: ${accentColor}"></div>
                    </div>

                    <div class="micro-account-info">
                        <h3 class="micro-account-name">${acc.nomeAccount || t('without_name')}</h3>
                    </div>

                    <div class="micro-account-top-actions">
                        ${acc.password ? `
                        <button class="micro-btn-utility btn-toggle-visibility relative z-10" style="color: ${accentColor};" data-stop-propagation="true">
                            <span id="pass-eye-${acc.id}" class="material-symbols-outlined">visibility</span>
                        </button>` : ''}

                        <button class="micro-btn-utility btn-toggle-pin relative z-10 ${isPinned ? 'is-active' : ''}" data-stop-propagation="true">
                            <span class="material-symbols-outlined ${isPinned ? 'filled' : ''}">push_pin</span>
                        </button>
                    </div>
                </div>

                <div class="micro-data-display">
                    ${acc.username ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_user')}:</span>
                        <span class="micro-data-value">${acc.username}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline relative z-10" 
                                data-copy="${acc.username.replace(/"/g, '&quot;')}" title="${t('copy_username')}" data-stop-propagation="true">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>` : ''}
                    
                    ${acc.account ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_account')}:</span>
                        <span class="micro-data-value">${acc.account}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline relative z-10" 
                                data-copy="${acc.account.replace(/"/g, '&quot;')}" title="${t('copy_account')}" data-stop-propagation="true">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>` : ''}
                    
                    ${acc.password ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_password')}:</span>
                        <span class="micro-data-value" id="pass-text-${acc.id}">${dots}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline relative z-10" 
                                data-copy="${acc.password.replace(/"/g, '&quot;')}" title="${t('copy_password')}" data-stop-propagation="true">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>` : ''}
                </div>
              </div>
            </div>
            `;
    }).join('');

    container.querySelectorAll('.micro-account-card').forEach(card => {
        const id = card.dataset.id;

        const btnVisibility = card.querySelector('.btn-toggle-visibility');
        if (btnVisibility) {
            btnVisibility.onclick = (e) => {
                e.stopPropagation();
                window.toggleTripleVisibility(id);
            };
        }

        const btnPin = card.querySelector('.btn-toggle-pin');
        if (btnPin) {
            btnPin.onclick = (e) => {
                e.stopPropagation();
                window.togglePin(id);
            };
        }

        card.querySelectorAll('.copy-btn-dynamic').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const text = btn.getAttribute('data-copy');
                if (text) {
                    navigator.clipboard.writeText(text).then(() => {
                        if (window.showToast) window.showToast(t('copied') || "Copiato!", "success");
                    });
                }
            };
        });
    });

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

// --- ACTIONS ---

async function handleArchive(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;

    try {
        await updateDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id), {
            isArchived: true
        });
        showToast(t('success_archived') || "Archiviato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender(); // Re-render immediato
    } catch (e) {
        logError("Archive Account", e);
        showToast(t('error_generic'), "error");
        filterAndRender(); // Revert visuale se errore
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    if (!currentAziendaId) return;

    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) {
        filterAndRender(); // Restore swipe position
        return;
    }

    try {
        await deleteDoc(doc(db, "users", currentUser.uid, "aziende", currentAziendaId, "accounts", id));
        showToast(t('success_deleted') || "Eliminato", "success");
        allAccounts = allAccounts.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        logError("Delete Account", e);
        showToast(t('error_generic'), "error");
        filterAndRender();
    }
}

function toggleSort() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    filterAndRender();
}
