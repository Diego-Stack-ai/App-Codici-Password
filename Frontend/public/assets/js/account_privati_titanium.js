import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { showToast } from './ui-core.js';
import { t } from './translations.js';

// --- TITANIUM STATE (v10.1) ---
let allAccounts = [];
let currentUser = null;
let currentSwipeList = null;
let sharedAccountIds = new Set();
let sortOrder = 'asc';
const TITANIUM_PAGE_ID = "PRIVATO_MATRIX_V10";

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Titanium Module Initialized: ${TITANIUM_PAGE_ID}`);

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    // 0. TRADUZIONI (Immediata)
    updatePageTranslations();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            initTitaniumUI();
            await loadAccounts();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Global Pin/Unpin function
    window.togglePin = async (id, isOwner, ownerId) => {
        if (!currentUser) return;
        const acc = allAccounts.find(a => a.id === id);
        if (!acc) return;

        const newVal = !acc.isPinned;
        acc.isPinned = newVal;
        filterAndRender();

        try {
            if (isOwner) {
                await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), { isPinned: newVal });
                showToast(newVal ? t('account_pinned') || "Account fissato in alto" : t('pin_removed') || "Fissaggio rimosso", "success");
            } else {
                showToast(t('shared_pin_warning') || "Dati condivisi: Pin non persistente", "warning");
            }
        } catch (e) {
            logError("Pin Toggle", e);
            acc.isPinned = !newVal; // Revert
            filterAndRender();
        }
    };

    // Unified Visibility Toggle (Titanium Reveal Strategy)
    window.toggleReveal = (id) => {
        const card = document.getElementById(`acc-${id}`);
        if (!card) return;

        const eye = card.querySelector('.reveal-eye');
        const labels = card.querySelectorAll('[data-reveal]');

        const isHidden = eye.textContent === 'visibility';
        const dots = '********';

        if (isHidden) {
            eye.textContent = 'visibility_off';
            labels.forEach(label => {
                label.textContent = label.getAttribute('data-real-value');
            });
        } else {
            eye.textContent = 'visibility';
            labels.forEach(label => {
                label.textContent = dots;
            });
        }
    };
});

/**
 * DATA LOADING ENGINE
 */
async function loadAccounts() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const type = urlParams.get('type') || 'standard';

        let sharedWithMeAccounts = [];
        sharedAccountIds.clear();

        // 1. Inizializzazione Firebase
        const colRef = collection(db, "users", currentUser.uid, "accounts");
        const ownSnap = await getDocs(colRef);

        // 2. Load Shared
        try {
            const invitesQ = query(collection(db, "invites"),
                where("recipientEmail", "==", currentUser.email),
                where("status", "==", "accepted")
            );
            const invitesSnap = await getDocs(invitesQ);
            const promises = invitesSnap.docs.map(async invDoc => {
                const invData = invDoc.data();
                try {
                    const ownerUid = invData.ownerId || invData.senderUid; // Support both just in case
                    const accSnap = await getDoc(doc(db, "users", ownerUid, "accounts", invData.accountId));
                    if (accSnap.exists()) {
                        sharedAccountIds.add(accSnap.id);
                        return { ...accSnap.data(), id: accSnap.id, isOwner: false, ownerId: ownerUid, _isShared: true };
                    }
                } catch (e) { }
                return null;
            });
            sharedWithMeAccounts = (await Promise.all(promises)).filter(a => a !== null);
        } catch (e) { }

        // 3. Merge and Normalize Flags
        try {
            allAccounts = [...ownSnap.docs.map(doc => {
                const d = doc.data();
                const isShared = !!d.shared || !!d.isMemoShared;
                const isMemo = !!d.isMemo || d.type === 'memorandum' || !!d.hasMemo;
                return {
                    ...d,
                    id: doc.id,
                    isOwner: true,
                    ownerId: currentUser.uid,
                    _isShared: isShared,
                    _isMemo: isMemo
                };
            }).filter(a => !a.isArchived), ...sharedWithMeAccounts.map(a => {
                const isShared = true; // By definition if it's in this list
                const isMemo = !!a.isMemo || a.type === 'memorandum' || !!a.hasMemo || !!a.isMemoShared;
                return {
                    ...a,
                    _isShared: isShared,
                    _isMemo: isMemo
                };
            })];
        } catch (mergeErr) {
            console.error("Merge error", mergeErr);
            allAccounts = [];
        }

        filterAndRender();

    } catch (error) {
        logError("Accounts Engine", error);
        const container = document.getElementById('accounts-container');
        if (container) {
            container.innerHTML = `<div class="col-span-full py-10 text-center text-red-400">${t('sync_error') || 'Errore Sincronizzazione Protetti'}</div>`;
        }
        showToast(t('sync_error') || "Errore sicronizzazione dati", "error");
    }
}

/**
 * Protocol UI Initialization (Fixed 3-Zone Header)
 */
function initTitaniumUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'standard';

    // 1. Header Population
    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');

    if (hLeft) {
        hLeft.innerHTML = `
            <button onclick="history.back()" class="btn-icon-header">
                <span class="material-symbols-outlined">arrow_back</span>
            </button>
        `;
    }

    if (hCenter) {
        let key = 'section_personal_accounts';
        if (type === 'shared') key = 'section_shared_accounts';
        if (type === 'memo') key = 'section_note';
        if (type === 'shared_memo') key = 'section_shared_note';

        hCenter.innerHTML = `
            <h2 class="header-title" data-t="${key}">${t(key)}</h2>
        `;
    }

    if (hRight) {
        hRight.innerHTML = `
            <a href="aggiungi_account_privato.html" class="btn-icon-header">
                <span class="material-symbols-outlined">add</span>
            </a>
        `;
    }

    // 2. Footer Placeholder
    const footerStack = document.getElementById('footer-placeholder');
    if (footerStack) {
        footerStack.innerHTML = `
            <footer class="titanium-footer">
                <div class="header-balanced-container" style="justify-content: center; width: 100%;">
                    <span class="text-[9px] font-bold uppercase tracking-[0.4em] opacity-30">${t('version') || 'Titanium V3.5'}</span>
                </div>
            </footer>
        `;
    }
}

/**
 * FILTERING & SORTING (Titanium Pure)
 */
function filterAndRender() {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'standard';
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';

    let filtered = allAccounts.filter(acc => {
        if (type === 'standard') return !acc._isShared && !acc._isMemo;
        if (type === 'shared') return acc._isShared && !acc._isMemo;
        if (type === 'memo') return !acc._isShared && acc._isMemo;
        if (type === 'shared_memo') return acc._isShared && acc._isMemo;
        return true;
    });

    if (searchVal) {
        filtered = filtered.filter(acc =>
            (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
            (acc.username || '').toLowerCase().includes(searchVal)
        );
    }

    filtered.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (a.nomeAccount || '').toLowerCase().localeCompare((b.nomeAccount || '').toLowerCase());
    });

    renderList(filtered);
}

/**
 * RENDERING ENGINE (Titanium Matrix V2.0)
 */
function renderList(list) {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    // --- ACCENT COLORS MAPPING (Aligned with Area Privata) ---
    const getAccentColors = (acc) => {
        const isBanking = (Array.isArray(acc.banking) && acc.banking.length > 0) || (acc.banking && acc.banking.iban);
        if (isBanking) return { key: 'emerald', via: 'via-emerald-500/40', bg: 'bg-emerald-500', hex: '#10b981' };
        if (acc._isMemo) return { key: 'amber', via: 'via-amber-500/40', bg: 'bg-amber-500', hex: '#f59e0b' };
        if (acc._isShared) return { key: 'rose', via: 'via-rose-500/40', bg: 'bg-rose-500', hex: '#f43f5e' };
        return { key: 'blue', via: 'via-blue-500/40', bg: 'bg-blue-500', hex: '#3b82f6' };
    };

    if (list.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-30 select-none">
                <span class="material-symbols-outlined text-5xl mb-3">folder_open</span>
                <p class="text-xs uppercase tracking-widest font-bold">${t('no_accounts_found') || 'Nessun account protetto'}</p>
            </div>`;
        return;
    }

    try {
        container.innerHTML = list.map(acc => {
            const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
            const isPinned = !!acc.isPinned;
            const colors = getAccentColors(acc);

            return `
                <div class="swipe-row relative group h-full" 
                     id="acc-${acc.id}" 
                     data-id="${acc.id}"
                     data-owner="${acc.isOwner}">
                    
                    <!-- BACKGROUND ACTIONS (Swipe) -->
                    <div class="absolute inset-0 flex transition-opacity pointer-events-none">
                        <div class="w-full flex justify-start items-center bg-red-600/20 pl-8 rounded-[24px]">
                            <span class="material-symbols-outlined text-red-500">delete</span>
                        </div>
                        <div class="w-full flex justify-end items-center bg-amber-600/20 pr-8 rounded-[24px]">
                            <span class="material-symbols-outlined text-amber-500">archive</span>
                        </div>
                    </div>
    
                    <!-- FOREGROUND: Titanium Solid Card -->
                    <div onclick="window.location.href='dettaglio_account_privato.html?id=${acc.id}${acc.isOwner ? '' : '&owner=' + acc.ownerId}'" 
                         class="swipe-content matrix-card-compact matrix-${colors.key} border-glow transition-all duration-300">
                        
                        <!-- Top Matrix Accent -->
                        <div class="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent ${colors.via} to-transparent"></div>
    
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                    <div class="relative">
                                        <img src="${avatar}" class="size-6 rounded-md object-cover bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-0.5">
                                        <div class="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ${colors.bg} border border-white dark:border-[#0a0f1e]"></div>
                                    </div>
                                    <div class="flex flex-col min-w-0">
                                        <h3 class="font-black text-[12px] leading-tight truncate max-w-[140px]">${acc.nomeAccount || t('account')}</h3>
                                    </div>
                                </div>
    
                                <div class="flex items-center gap-1">
                                    <button onclick="event.stopPropagation(); window.togglePin('${acc.id}', ${acc.isOwner})" 
                                            class="size-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${isPinned ? 'text-blue-600' : 'text-slate-300 dark:text-white/20'}">
                                        <span class="material-symbols-outlined text-[13px] ${isPinned ? 'filled' : ''}">push_pin</span>
                                    </button>
                                    <button onclick="event.stopPropagation(); window.toggleReveal('${acc.id}')" 
                                            class="size-6 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-300 dark:text-white/20 hover:text-slate-600 dark:hover:text-white">
                                        <span class="material-symbols-outlined text-[13px] reveal-eye">visibility</span>
                                    </button>
                                </div>
                            </div>
    
                            <div class="space-y-0.5 mt-1 relative z-10">
                            ${acc.username ? renderField("User", acc.username, "person") : ''}
                            ${acc.account || acc.codice ? renderField("Acc", acc.account || acc.codice, "identifier") : ''}
                            ${acc.password ? renderField("Pass", acc.password, "key", true) : ''}
                        </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    } catch (renderErr) {
        console.error("Render error", renderErr);
        container.innerHTML = '<div class="col-span-full py-10 text-center text-red-500">Errore Rendering Matrix</div>';
    }

    // Re-init Swipe Logic
    new SwipeList('.swipe-row', {
        threshold: 0.2,
        onSwipeLeft: (item) => handleArchive(item),
        onSwipeRight: (item) => handleDelete(item)
    });
}

/**
 * HELPER: RENDERING FIELD (Titanium Style)
 */
function renderField(label, value, icon, isSensitive = false) {
    const displayValue = isSensitive ? '********' : value;
    const safeValue = String(value || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
        <div class="matrix-field-compact group/field">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="material-symbols-outlined text-slate-400 dark:text-white/20 text-[14px]">${icon}</span>
                <span data-reveal 
                      data-real-value="${safeValue}" 
                      class="truncate">
                    ${displayValue}
                </span>
            </div>
            <button onclick="event.stopPropagation(); navigator.clipboard.writeText('${safeValue}').then(() => window.showToast(t('copied_to_protocol') || 'Copiato nel protocollo', 'success'))"
                    class="size-6 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-white/5 text-slate-300 dark:text-white/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all opacity-0 group-hover/field:opacity-100">
                <span class="material-symbols-outlined text-[14px]">content_copy</span>
            </button>
        </div>`;
}

/**
 * SWIPE ACTIONS
 */
async function handleArchive(item) {
    const id = item.dataset.id;
    const confirmed = await window.showConfirmModal(
        t('archive_title_confirm') || "ARCHIVIAZIONE",
        t('archive_desc_confirm') || "Vuoi spostare questo account nell'archivio?",
        t('archive_btn_confirm') || "ARCHIVIA",
        t('cancel') || "ANNULLA"
    );

    if (confirmed) {
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "accounts", id), { isArchived: true });
            window.showToast(t('account_archived') || "Account archiviato", "success");
            loadAccounts();
        } catch (e) { logError("Archive", e); }
    } else {
        filterAndRender(); // Reset UI Swipe state
    }
}

async function handleDelete(item) {
    const id = item.dataset.id;
    const confirmed = await window.showConfirmModal(
        t('delete_title_confirm') || "ELIMINAZIONE DEFINITIVA",
        t('delete_desc_confirm') || "Questa azione non può essere annullata. Rimuovere definitivamente l'account?",
        t('delete_btn_confirm') || "ELIMINA",
        t('cancel') || "ANNULLA"
    );

    if (confirmed) {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "accounts", id));
            window.showToast(t('protocol_deleted') || "Protocollo eliminato", "success");
            loadAccounts();
        } catch (e) { logError("Delete", e); }
    } else {
        filterAndRender(); // Reset UI Swipe state
    }
}

/**
 * [I18N] UPDATE PAGE TRANSLATIONS
 * Scansiona il DOM per attributi data-t e data-t-placeholder
 */
export function updatePageTranslations() {
    // 1. Testo diretto
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        const translated = t(key);
        if (!translated || translated === key) return;

        // Preserva icone se presenti
        const icon = el.querySelector('.material-symbols-outlined');
        if (icon) {
            let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "");
            if (textNode) {
                textNode.textContent = translated;
            } else {
                el.appendChild(document.createTextNode(translated));
            }
        } else {
            el.textContent = translated;
        }
    });

    // 2. Placeholder
    document.querySelectorAll('[data-t-placeholder]').forEach(el => {
        const key = el.getAttribute('data-t-placeholder');
        const translated = t(key);
        if (translated && translated !== key) {
            el.setAttribute('placeholder', translated);
        }
    });
}
