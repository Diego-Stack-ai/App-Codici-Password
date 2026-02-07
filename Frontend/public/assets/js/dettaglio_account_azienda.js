// Gestione dettaglio account azienda e logica UI
// Refactored for Firebase Modular SDK (v11)

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

import { showToast } from './ui-core.js';

// Fallback sicuro per window.t
window.t = window.t || ((k) => k);

// --- THEME LOGIC ---
const companyPalettes = [
    { from: '#10b981', to: '#047857', name: 'Green' },   // Green
    { from: '#3b82f6', to: '#1d4ed8', name: 'Blue' },    // Blue
    { from: '#8b5cf6', to: '#6d28d9', name: 'Purple' },  // Purple
    { from: '#f59e0b', to: '#b45309', name: 'Orange' },  // Orange
    { from: '#ec4899', to: '#be185d', name: 'Pink' },    // Pink
    { from: '#ef4444', to: '#b91c1c', name: 'Red' },     // Red
    { from: '#06b6d4', to: '#0e7490', name: 'Cyan' },    // Cyan
    { from: '#6366f1', to: '#4338ca', name: 'Indigo' },  // Indigo
    { from: '#84cc16', to: '#4d7c0f', name: 'Lime' },    // Lime
    { from: '#14b8a6', to: '#0f766e', name: 'Teal' },    // Teal
];

function getCompanyColor(companyName, colorIndex) {
    if (typeof colorIndex === 'number' && companyPalettes[colorIndex]) {
        return companyPalettes[colorIndex];
    }
    if (!companyName) return companyPalettes[0];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % companyPalettes.length;
    return companyPalettes[index];
}

function applyTheme(companyName, colorIndex) {
    const theme = getCompanyColor(companyName, colorIndex);
    const container = document.querySelector('.base-container');
    if (container) {
        // Convert hex to rgb for CSS variables
        const hex = theme.from;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        container.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
        container.style.setProperty('--accent-hex', hex);
    }

    // Legacy support
    document.documentElement.style.setProperty('--primary-color', theme.from);
    document.documentElement.style.setProperty('--primary-dark', theme.to);

    const heroBar = document.getElementById('hero-accent-bar');
    if (heroBar) {
        heroBar.style.backgroundColor = theme.from;
        heroBar.style.boxShadow = `0 0 15px ${theme.from}66`;
    }
    const statusDot = document.getElementById('hero-status-dot');
    if (statusDot) {
        statusDot.style.backgroundColor = theme.from;
        statusDot.style.boxShadow = `0 0 15px ${theme.from}66`;
    }
}

// --- GLOBAL HELPERS (Local aliases for backwards compatibility or specialized overrides) ---
// Note: window.copyText and window.makeCall are defined globally in main.js

const toggleReferente = function () {
    const content = document.getElementById('referente-content');
    const chevron = document.getElementById('referente-chevron');
    if (!content) return;
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

const toggleAccessi = function () {
    const content = document.getElementById('accessi-content');
    const chevron = document.getElementById('accessi-chevron');
    if (content && content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else if (content) {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

const toggleBanking = function () {
    const content = document.getElementById('banking-content');
    const chevron = document.getElementById('banking-chevron');
    if (content && content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else if (content) {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

const openAttachments = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const aziendaId = urlParams.get('aziendaId');
    if (id && aziendaId && auth.currentUser) {
        window.location.href = `gestione_allegati.html?id=${id}&aziendaId=${aziendaId}&ownerId=${auth.currentUser.uid}&type=azienda`;
    }
};

const toggleSharingUI = function (show) {
    const section = document.getElementById('shared-management');
    if (section) {
        if (show) section.classList.remove('hidden');
        else section.classList.add('hidden');
    }
};

const closeSaveModal = () => {
    const modal = document.getElementById('save-modal');
    if (modal) modal.classList.add('hidden');
};


// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('id');
    const aziendaId = urlParams.get('aziendaId');
    console.log("DOM Loaded (Re-Authored) - DETAIL ACCOUNT AZIENDA");

    // Toggle listeners for sections
    const btnToggleBanking = document.getElementById('btn-toggle-banking');
    if (btnToggleBanking) btnToggleBanking.addEventListener('click', toggleBanking);

    const btnToggleReferente = document.getElementById('btn-toggle-referente');
    if (btnToggleReferente) btnToggleReferente.addEventListener('click', toggleReferente);

    const btnOpenAttachments = document.getElementById('btn-open-attachments');
    if (btnOpenAttachments) btnOpenAttachments.addEventListener('click', openAttachments);

    const btnToggleAccessi = document.getElementById('btn-toggle-accessi');
    if (btnToggleAccessi) btnToggleAccessi.addEventListener('click', toggleAccessi);

    // TOGGLE PASSWORD LOGIC (Specific)
    const togglePwdBtnDetail = document.getElementById('toggle-password');
    const passwordInputDetail = document.getElementById('detail-password');

    if (togglePwdBtnDetail && passwordInputDetail) {
        // Stato iniziale
        passwordInputDetail.classList.add('base-shield');
        passwordInputDetail.type = "password";

        togglePwdBtnDetail.addEventListener('click', () => {
            const isMasked = passwordInputDetail.classList.contains('base-shield');
            passwordInputDetail.classList.toggle('base-shield');
            passwordInputDetail.type = isMasked ? "text" : "password";

            const icon = togglePwdBtnDetail.querySelector('span');
            if (icon) icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        });
    }

    if (!accountId || !aziendaId) {
        if (window.showToast) window.showToast("ID account o azienda mancante.", "error");
        window.location.href = 'lista_aziende.html';
        return;
    }

    let currentUser = null;
    let originalData = {};

    // --- PROTOCOLLO: INIEZIONE AZIONI NEL FOOTER ---
    const injectFooterActions = () => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight) {
            footerRight.innerHTML = `
                <button id="btn-edit-footer" class="btn-icon-header" title="Modifica Account">
                    <span class="material-symbols-outlined">edit</span>
                </button>
            `;
            const btnEdit = document.getElementById('btn-edit-footer');
            if (btnEdit) {
                btnEdit.addEventListener('click', () => {
                    window.location.href = `modifica_account_azienda.html?id=${encodeURIComponent(accountId)}&aziendaId=${encodeURIComponent(aziendaId)}`;
                });
            }
        }
        // Re-apply theme to footer actions
        if (originalData.nomeAccount) {
            applyTheme(originalData.ragioneSociale || originalData.nomeAccount, originalData.colorIndex);
        }
    };

    setTimeout(injectFooterActions, 500);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadAccountDetails(user.uid, aziendaId, accountId);
            await loadContacts(user.uid);
            setupListeners(); // Now uses closure variables
        } else {
            console.log("Logged out");
            window.location.href = 'index.html';
        }
    });

    // Back Button (Automated by header, but we keep this for legacy if header fails)
    const btnBack = document.getElementById('btn-back');
    if (btnBack) btnBack.addEventListener('click', () => window.history.back());
    async function loadAccountDetails(uid, azId, accId) {
        try {
            // Get Company Data (Theme)
            const azRef = doc(db, "users", uid, "aziende", azId);
            const azSnap = await getDoc(azRef);
            let companyName = "Azienda";
            let colorIndex = 0;

            if (azSnap.exists()) {
                const azData = azSnap.data();
                companyName = azData.ragioneSociale || "Azienda";
                colorIndex = azData.colorIndex;
            }
            applyTheme(companyName, colorIndex);

            // Get Account Data
            const accRef = doc(db, "users", uid, "aziende", azId, "accounts", accId);
            const accSnap = await getDoc(accRef);

            if (accSnap.exists()) {
                const data = accSnap.data();
                // Important: Update global originalData
                originalData = { ...data, docId: accId, aziendaId: azId };
                renderData(data);
            } else {
                if (window.showToast) window.showToast("Account non trovato.", "error");
            }
        } catch (error) {
            console.error("Error loading details:", error);
            showToast("Errore caricamento: " + error.message, 'error');
        }
    }

    function renderData(data) {
        // Headers
        const headerName = document.getElementById('header-nome-account');
        const headerCat = document.getElementById('header-categoria');
        const detailAvatar = document.getElementById('detail-avatar');

        if (headerName) headerName.textContent = data.nomeAccount || "-";
        if (headerCat) headerCat.textContent = data.categoria || "Account Azienda";

        if (detailAvatar) {
            if (window.getAccountIcon) {
                detailAvatar.innerHTML = window.getAccountIcon(data.nomeAccount, 'w-full h-full');
                detailAvatar.classList.add('bg-transparent');
                detailAvatar.textContent = '';
            } else {
                const initial = (data.nomeAccount || "?").charAt(0).toUpperCase();
                detailAvatar.textContent = initial;
            }
        }

        // Inputs
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = val || '';
        };

        setVal('detail-nomeAccount', data.nomeAccount);
        setVal('detail-username', data.username);
        setVal('detail-account', data.account || data.email);
        setVal('detail-codiceSocieta', data.codiceSocieta);
        setVal('detail-numeroIscrizione', data.numeroIscrizione);
        setVal('detail-password', data.password);
        setVal('detail-website', data.sitoWeb);

        setVal('detail-referenteNome', data.referenteNome);
        setVal('detail-referenteTelefono', data.referenteTelefono);
        setVal('detail-referenteCellulare', data.referenteCellulare);

        const elNote = document.getElementById('detail-note');
        if (elNote) elNote.textContent = data.note || "Nessuna nota.";

        // Banking Details
        const bankingArr = Array.isArray(data.banking) ? data.banking : (data.banking && data.banking.iban ? [data.banking] : []);
        const hasBanking = bankingArr.length > 0;
        const sectionBanking = document.getElementById('section-banking');
        if (sectionBanking) {
            sectionBanking.classList.toggle('hidden', !hasBanking);
        }

        if (hasBanking) {
            const bankingContent = document.getElementById('banking-content');
            if (bankingContent) {
                bankingContent.innerHTML = bankingArr.map((bank, idx) => `
                    <div class="space-y-4 p-4 bg-slate-500/5 rounded-2xl border border-white/5 border-glow">
                        <div class="flex items-center justify-between border-b border-white/5 pb-2">
                            <span class="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Conto #${idx + 1}</span>
                        </div>

                        <!-- IBAN -->
                        <div class="flex flex-col gap-1.5">
                            <span class="text-[11px] font-bold text-white/40 uppercase ml-1" data-t="iban">IBAN</span>
                            <div class="flex items-center bg-slate-500/5 rounded-xl border border-white/5 overflow-hidden backdrop-blur-sm border-glow">
                                <input readonly
                                    class="flex-1 bg-transparent border-none h-12 px-4 text-sm font-bold focus:ring-0 text-white uppercase font-mono"
                                    value="${bank.iban || ''}">
                                <button class="p-3 text-white/40 hover:text-white border-l border-white/5 btn-copy-iban" data-iban="${bank.iban || ''}">
                                    <span class="material-symbols-outlined text-base">content_copy</span>
                                </button>
                            </div>
                        </div>

                        <!-- PASSWORD & NOTA -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div class="flex flex-col gap-1.5">
                                 <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="dispositive_pass">Pass. Dispositiva</span>
                                 <div class="flex items-center bg-slate-500/5 rounded-xl border border-white/5 overflow-hidden backdrop-blur-sm border-glow">
                                     <input readonly type="text"
                                         class="base-shield flex-1 bg-transparent border-none h-10 px-4 text-sm focus:ring-0 text-white"
                                         value="${bank.passwordDispositiva || ''}">
                                     <button class="p-2 text-white/40 btn-toggle-shield-bank">
                                         <span class="material-symbols-outlined text-sm">visibility</span>
                                     </button>
                                     <button class="p-2 text-white/40 hover:text-white border-l border-white/5 btn-copy-field">
                                         <span class="material-symbols-outlined text-sm">content_copy</span>
                                     </button>
                                 </div>
                             </div>
                            <div class="flex flex-col gap-1.5">
                                <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="iban_note">Nota IBAN</span>
                                <div class="selectable bg-white/5 p-2.5 rounded-xl text-xs text-white/60 border border-white/5 min-h-[40px] flex items-center italic">
                                    ${bank.nota || '-'}
                                </div>
                            </div>
                        </div>

                        <!-- SEZIONE REFERENTE BANCA -->
                        <div class="bg-blue-500/5 p-4 rounded-2xl border border-white/5 space-y-3">
                            <div class="flex items-center gap-2 text-blue-500">
                                <span class="material-symbols-outlined text-sm">contact_phone</span>
                                <span class="text-[10px] font-black uppercase tracking-widest" data-t="bank_referent">Referente Banca</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <span class="text-[9px] font-bold text-white/40 uppercase ml-1" data-t="full_name">Nome e Cognome</span>
                                <p class="text-sm font-bold text-white ml-1">${bank.referenteNome || ''} ${bank.referenteCognome || ''}</p>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[9px] font-bold text-white/40 uppercase ml-1" data-t="phone">Telefono</span>
                                    <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors btn-make-call" data-num="${bank.referenteTelefono || ''}" title="Chiama">
                                        <span class="material-symbols-outlined text-[16px] text-blue-500">call</span>
                                        <span class="text-xs font-bold text-white/70">${bank.referenteTelefono || '-'}</span>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[9px] font-bold text-white/40 uppercase ml-1" data-t="mobile">Cellulare</span>
                                    <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors btn-make-call" data-num="${bank.referenteCellulare || ''}" title="Chiama">
                                        <span class="material-symbols-outlined text-[16px] text-blue-500">smartphone</span>
                                        <span class="text-xs font-bold text-white/70">${bank.referenteCellulare || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Carte collegate -->
                        ${(bank.cards || []).length > 0 ? `
                            <div class="space-y-4 pt-2">
                                <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1" data-t="linked_tools">Strumenti collegati</span>
                                ${bank.cards.map((card, cIdx) => `
                                    <div class="bg-white/5 p-4 rounded-xl border border-white/5 shadow-sm space-y-4">
                                         <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-2">
                                                <span class="material-symbols-outlined text-blue-500 text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                                                <span class="text-xs font-black text-blue-500 uppercase">${card.type === 'Debit' ? (window.t('bancomat') || 'Bancomat') : (window.t('credit_card') || 'Carta di Credito')}</span>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="holder">Titolare</span>
                                                <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                    <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-white" value="${card.titolare || ''}">
                                                    <button class="p-2 text-white/40 hover:text-white btn-copy-field">
                                                        <span class="material-symbols-outlined text-base">content_copy</span>
                                                    </button>
                                                </div>
                                            </div>
                                            ${card.type !== 'Debit' ? `
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="card_type">Tipo Carta</span>
                                                <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                    <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-white" value="${card.cardType || ''}">
                                                </div>
                                            </div>
                                            ` : ''}
                                        </div>

                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="number">Numero</span>
                                            <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-white" value="${card.cardNumber || ''}">
                                                <button class="p-2 text-white/40 hover:text-white btn-copy-field">
                                                    <span class="material-symbols-outlined text-base">content_copy</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-3 gap-3">
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="expiry">Scadenza</span>
                                                <div class="flex items-center bg-white/5 rounded-lg h-10 px-3 text-sm text-white border border-white/5">
                                                    ${card.expiry || '-'}
                                                </div>
                                            </div>
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="ccv">CCV</span>
                                                <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                    <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-white" value="${card.ccv || ''}">
                                                    <button class="p-2 text-white/40 hover:text-white btn-copy-field">
                                                        <span class="material-symbols-outlined text-sm">content_copy</span>
                                                    </button>
                                                </div>
                                            </div>
                                             <div class="flex flex-col gap-1.5">
                                                 <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="pin">PIN</span>
                                                  <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                      <input readonly type="text" class="base-shield pin-field flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-white" 
                                                         value="${card.pin || ''}">
                                                      <button class="p-2 text-white/40 btn-toggle-shield-bank">
                                                          <span class="material-symbols-outlined text-sm">visibility</span>
                                                      </button>
                                                  </div>
                                             </div>
                                        </div>

                                        ${card.note ? `
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="tool_note">Note Strumento</span>
                                                <div class="selectable bg-white/5 p-3 rounded-lg text-xs text-white/60 italic border border-white/5">
                                                    ${card.note}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('');

                // Attach dynamically generated listeners
                bankingContent.querySelectorAll('.btn-copy-iban').forEach(btn => {
                    btn.addEventListener('click', () => window.copyText(btn.dataset.iban));
                });
                bankingContent.querySelectorAll('.btn-toggle-shield-bank').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const p = btn.previousElementSibling;
                        p.classList.toggle('base-shield');
                        btn.querySelector('span').textContent = p.classList.contains('base-shield') ? 'visibility' : 'visibility_off';
                    });
                });
                bankingContent.querySelectorAll('.btn-copy-field').forEach(btn => {
                    btn.addEventListener('click', () => window.copyText(btn.parentElement.querySelector('input').value));
                });
                bankingContent.querySelectorAll('.btn-make-call').forEach(el => {
                    el.addEventListener('click', () => {
                        const num = el.dataset.num;
                        if (num && num !== '-' && num !== '') {
                            window.location.href = `tel:${num.replace(/\s+/g, '')}`;
                        }
                    });
                });
            }
        }

        // Flags
        const checkShared = document.getElementById('detail-shared');
        const checkMemo = document.getElementById('detail-hasMemo');
        const checkMemoShared = document.getElementById('detail-isMemoShared');

        if (checkShared) checkShared.checked = !!data.shared;
        if (checkMemo) checkMemo.checked = !!data.hasMemo;
        if (checkMemoShared) checkMemoShared.checked = !!data.isMemoShared;

        // Sharing UI State
        const isSharing = data.shared || data.isMemoShared;
        toggleSharingUI(isSharing);

        // Render Guests
        renderGuests(data.sharedWith || []);
    }

    async function loadContacts(uid) {
        const select = document.getElementById('invite-select');
        if (!select) return;

        try {
            const rubRef = collection(db, "users", uid, "contacts");
            const q = query(rubRef);
            const querySnapshot = await getDocs(q);

            select.innerHTML = '<option value="" disabled selected>Seleziona un contatto...</option>';

            querySnapshot.forEach(doc => {
                const c = doc.data();
                const opt = document.createElement('option');
                opt.value = c.email;
                opt.textContent = `${c.nome} ${c.cognome} (${c.email})`;
                select.appendChild(opt);
            });
            // NO onchange listener here.
        } catch (e) {
            console.warn("Contacts load error:", e);
        }
    }

    function renderGuests(list) {
        const container = document.getElementById('guests-list');
        if (!container) return;
        container.innerHTML = '';

        if (!list || list.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-2">Nessun accesso attivo.</p>';
            return;
        }

        const activeList = list.filter(item => {
            if (typeof item === 'object' && item.status === 'rejected') return false;
            return true;
        });

        if (activeList.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-2">Nessun accesso attivo.</p>';
            return;
        }

        activeList.forEach(guest => {
            let email = '';
            let status = 'accepted';
            let initial = '?';

            if (typeof guest === 'string') {
                email = guest;
                initial = guest.charAt(0).toUpperCase();
            } else {
                email = guest.email;
                status = guest.status;
                initial = email.charAt(0).toUpperCase();
            }

            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-800 mb-2";
            div.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        ${initial}
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-bold truncate">${email.split('@')[0]}</p>
                        <p class="text-[10px] text-gray-400 truncate flex items-center gap-1">
                            ${email} 
                            <span class="bg-gray-200 dark:bg-gray-600 px-1 rounded text-[9px] text-gray-600 dark:text-gray-300">${status}</span>
                        </p>
                    </div>
                </div>
                <button class="text-red-400 hover:text-red-600 transition-colors shrink-0 btn-revoke-guest" data-email="${email}" title="Rimuovi Accesso">
                    <span class="material-symbols-outlined text-sm">remove_circle</span>
                </button>
            `;
            const btnRevoke = div.querySelector('.btn-revoke-guest');
            btnRevoke.addEventListener('click', () => handleRevoke(email));
            container.appendChild(div);
        });
    }

    const handleRevoke = async (email) => {
        const confirmed = await window.showConfirmModal(
            "REVOCA ACCESSO",
            `Revocare l'accesso a ${email}?`,
            "REVOCA",
            "ANNULLA"
        );
        if (!confirmed) return;
        try {
            // 1. Update sharedWith array (removing object or string)
            // Since firestore arrayRemove only works for exact match, read-filter-write is safer for objects
            const accRef = doc(db, "users", currentUser.uid, "aziende", aziendaId, "accounts", accountId);
            const snap = await getDoc(accRef);
            if (snap.exists()) {
                const data = snap.data();
                let newList = (data.sharedWith || []).filter(item => {
                    const itemEmail = (typeof item === 'string') ? item : item.email;
                    return itemEmail !== email;
                });
                await updateDoc(accRef, { sharedWith: newList });

                // 2. Delete Invite doc
                const q = query(collection(db, "invites"),
                    where("accountId", "==", accountId),
                    where("recipientEmail", "==", email),
                    where("type", "==", "azienda") // Match type
                );
                const snapInv = await getDocs(q);
                const dels = snapInv.docs.map(d => deleteDoc(d.ref));
                await Promise.all(dels);

                showToast("Accesso revocato.");
                await loadAccountDetails(currentUser.uid, aziendaId, accountId);
            }
        } catch (e) {
            console.error(e);
            showToast("Errore revoca: " + e.message, 'error');
        }
    };

    function showSaveModal(isSharingActive) {
        const modal = document.getElementById('save-modal');
        if (!modal) return;

        const btnParams = document.getElementById('btn-save-modal');
        if (btnParams) {
            btnParams.innerHTML = isSharingActive ?
                '<span class="material-symbols-outlined text-lg">save</span> Salva Modifiche e invia l\'invito' :
                '<span class="material-symbols-outlined text-lg">save</span> Salva Modifiche';
        }
        modal.classList.remove('hidden');
    }

    function setupListeners() {
        // Copy btns
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.parentElement.querySelector('input');
                window.copyText(input.value);
            });
        });
        const copyNoteBtn = document.getElementById('copy-note');
        if (copyNoteBtn) copyNoteBtn.addEventListener('click', () => window.copyText(document.getElementById('detail-note').textContent));

        // Toggle Password Visibility (Titanium Reveal Strategy)
        const toggle = document.getElementById('toggle-password');
        const passInput = document.getElementById('detail-password');
        const userInput = document.getElementById('detail-username');
        const accInput = document.getElementById('detail-account');

        if (toggle && passInput) {
            toggle.addEventListener('click', () => {
                passInput.classList.toggle('base-shield');
                if (userInput) userInput.classList.toggle('base-shield');
                if (accInput) accInput.classList.toggle('base-shield');

                const isMasked = passInput.classList.contains('base-shield');
                toggle.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';
            });
        }

        // Open Website
        const webBtn = document.getElementById('open-website');
        const webInput = document.getElementById('detail-website');
        if (webBtn && webInput) {
            webBtn.addEventListener('click', () => {
                let url = webInput.value.trim();
                if (!url) return;
                if (!url.startsWith('http')) url = 'https://' + url;
                window.open(url, '_blank');
            });
        }

        // Call btns
        document.querySelectorAll('.call-btn').forEach(btn => {
            btn.onclick = () => {
                const num = btn.parentElement.querySelector('input').value.trim();
                if (num && num !== '-' && num !== '') {
                    window.location.href = `tel:${num.replace(/\s+/g, '')}`;
                }
            };
        });

        // Flags
        const checkShared = document.getElementById('detail-shared');
        const checkMemo = document.getElementById('detail-hasMemo');
        const checkMemoShared = document.getElementById('detail-isMemoShared');

        if (checkShared && checkMemo && checkMemoShared) {
            const flags = [checkShared, checkMemo, checkMemoShared];
            flags.forEach(el => {
                el.onchange = () => {
                    // Mutual exclusion
                    if (el.checked) {
                        flags.forEach(other => { if (other !== el) other.checked = false; });
                    }

                    const isSharing = checkShared.checked || checkMemoShared.checked;

                    if (isSharing) {
                        toggleSharingUI(true);
                        // Auto open accordion
                        const content = document.getElementById('accessi-content');
                        const chevron = document.getElementById('accessi-chevron');
                        if (content && content.classList.contains('hidden')) {
                            content.classList.remove('hidden');
                            if (chevron) chevron.style.transform = 'rotate(180deg)';
                        }
                    } else {
                        toggleSharingUI(false);
                        const content = document.getElementById('accessi-content');
                        if (content && !content.classList.contains('hidden')) {
                            content.classList.add('hidden'); // Close accordion
                        }
                    }

                    showSaveModal(isSharing);
                };
            });
        }

        // Save Button (Modal)
        const btnSave = document.getElementById('btn-save-modal');
        const inviteSelect = document.getElementById('invite-select');

        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                const isShared = checkShared.checked || checkMemoShared.checked;
                const newGuestEmail = inviteSelect ? inviteSelect.value : '';

                // Validation: if sharing, must have a guest selected OR existing guests
                const guestsContainer = document.getElementById('guests-list');
                const hasGuests = guestsContainer && !guestsContainer.textContent.includes('Nessun accesso attivo');

                if (isShared && !hasGuests && !newGuestEmail) {
                    if (window.showToast) window.showToast("Seleziona una persona da invitare o verifica che ci siano già accessi attivi.", "error");
                    closeSaveModal();
                    toggleSharingUI(true);
                    const content = document.getElementById('accessi-content');
                    if (content) content.classList.remove('hidden');
                    if (inviteSelect) inviteSelect.focus();
                    return;
                }

                btnSave.disabled = true;
                btnSave.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Elaborazione...';

                try {
                    // 1. Invite
                    if (newGuestEmail) {
                        await addDoc(collection(db, "invites"), {
                            accountId: accountId,
                            aziendaId: aziendaId,
                            accountName: document.getElementById('detail-nomeAccount').value,
                            ownerId: currentUser.uid,
                            ownerEmail: currentUser.email,
                            recipientEmail: newGuestEmail,
                            status: 'pending',
                            type: 'azienda',
                            createdAt: new Date().toISOString()
                        });

                        await updateDoc(doc(db, "users", currentUser.uid, "aziende", aziendaId, "accounts", accountId), {
                            sharedWith: arrayUnion({
                                email: newGuestEmail,
                                status: 'pending',
                                invitedAt: new Date().toISOString()
                            })
                        });
                    }

                    // 2. Save Flags
                    const updatePayload = {
                        shared: checkShared.checked,
                        hasMemo: checkMemo.checked,
                        isMemoShared: checkMemoShared.checked
                    };

                    const accRef = doc(db, "users", currentUser.uid, "aziende", aziendaId, "accounts", accountId);
                    await updateDoc(accRef, updatePayload);

                    showToast("Salvato con successo!");
                    closeSaveModal();

                    // Reload Data
                    await loadAccountDetails(currentUser.uid, aziendaId, accountId);
                    if (inviteSelect) inviteSelect.value = "";

                } catch (e) {
                    console.error(e);
                    showToast("Errore salvataggio: " + e.message, 'error');
                } finally {
                    btnSave.disabled = false;
                }
            });
        }
    }

});
