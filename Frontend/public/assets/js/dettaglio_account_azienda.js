// Gestione dettaglio account azienda e logica UI
// Refactored for Firebase Modular SDK (v11)

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- UI TOAST HELPER ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold shadow-2xl opacity-100 transition-opacity pointer-events-none z-[100] ${type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`;
    setTimeout(() => toast.classList.remove('opacity-100'), 3000);
}

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
    document.documentElement.style.setProperty('--primary-color', theme.from);
    document.documentElement.style.setProperty('--primary-dark', theme.to);
}

// --- GLOBAL HELPERS (Local aliases for backwards compatibility or specialized overrides) ---
// Note: window.copyText and window.makeCall are defined globally in main.js

window.toggleReferente = function () {
    const content = document.getElementById('referente-content');
    const chevron = document.getElementById('referente-chevron');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

window.toggleAccessi = function () {
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

window.toggleBanking = function () {
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

window.openAttachments = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const aziendaId = urlParams.get('aziendaId');
    if (id && aziendaId && auth.currentUser) {
        window.location.href = `gestione_allegati.html?id=${id}&aziendaId=${aziendaId}&ownerId=${auth.currentUser.uid}&type=azienda`;
    }
};

window.toggleSharingUI = function (show) {
    const section = document.getElementById('shared-management');
    if (section) {
        if (show) section.classList.remove('hidden');
        else section.classList.add('hidden');
    }
};

window.closeSaveModal = () => {
    const modal = document.getElementById('save-modal');
    if (modal) modal.classList.add('hidden');
};


// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded (Re-Authored) - DETAIL ACCOUNT AZIENDA");

    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('id');
    const aziendaId = urlParams.get('aziendaId');

    if (!accountId || !aziendaId) {
        alert("ID account o azienda mancante.");
        window.location.href = 'lista_aziende.html';
        return;
    }

    // Back Button
    const btnBack = document.getElementById('btn-back');
    if (btnBack) btnBack.onclick = () => window.history.back(); // Use history.back() for better UX

    let currentUser = null;
    let originalData = {};

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
                alert("Account non trovato.");
                // Redirect logic if needed
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
                    <div class="space-y-4 p-4 bg-white/50 rounded-2xl border border-black/5">
                        <div class="flex items-center justify-between border-b border-black/5 pb-2">
                            <span class="text-[10px] font-bold text-primary uppercase tracking-widest">Conto #${idx + 1}</span>
                        </div>

                        <!-- IBAN -->
                        <div class="flex flex-col gap-1.5">
                            <span class="text-[11px] font-bold text-gray-400 uppercase ml-1">IBAN</span>
                            <div class="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden">
                                <input readonly
                                    class="flex-1 bg-transparent border-none h-12 px-4 text-sm font-bold focus:ring-0 text-[#0A162A] uppercase font-mono"
                                    value="${bank.iban || ''}">
                                <button onclick="copyText('${bank.iban}')" class="p-3 text-gray-400 hover:text-primary border-l border-black/5">
                                    <span class="material-symbols-outlined text-base">content_copy</span>
                                </button>
                            </div>
                        </div>

                        <!-- PASSWORD & NOTA -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div class="flex flex-col gap-1.5">
                                 <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Pass. Dispositiva</span>
                                 <div class="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden">
                                     <input readonly type="text"
                                         class="titanium-shield flex-1 bg-transparent border-none h-10 px-4 text-sm focus:ring-0 text-[#0A162A]"
                                         value="${bank.passwordDispositiva || ''}">
                                     <button onclick="const p=this.previousElementSibling; p.classList.toggle('titanium-shield'); this.querySelector('span').textContent=p.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                                         <span class="material-symbols-outlined text-sm">visibility</span>
                                     </button>
                                     <button onclick="copyText(this.parentElement.querySelector('input').value)" class="p-2 text-gray-400 hover:text-primary border-l border-black/5">
                                         <span class="material-symbols-outlined text-sm">content_copy</span>
                                     </button>
                                 </div>
                             </div>
                            <div class="flex flex-col gap-1.5">
                                <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Nota IBAN</span>
                                <div class="selectable bg-blue-50/50 p-2.5 rounded-xl text-xs text-blue-800 border border-blue-100 min-h-[40px] flex items-center">
                                    ${bank.nota || '-'}
                                </div>
                            </div>
                        </div>

                        <!-- SEZIONE REFERENTE BANCA -->
                        <div class="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-3">
                            <div class="flex items-center gap-2 text-primary">
                                <span class="material-symbols-outlined text-sm">contact_phone</span>
                                <span class="text-[10px] font-bold uppercase tracking-widest">Referente Banca</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <span class="text-[9px] font-bold text-gray-400 uppercase ml-1">Nome e Cognome</span>
                                <p class="text-sm font-bold text-slate-900 ml-1">${bank.referenteNome || ''} ${bank.referenteCognome || ''}</p>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[9px] font-bold text-gray-400 uppercase ml-1">Telefono</span>
                                    <div class="flex items-center gap-2 p-2 rounded-xl bg-white border border-black/5 cursor-pointer hover:bg-gray-50 transition-colors" onclick="makeCall('${bank.referenteTelefono}')" title="Chiama">
                                        <span class="material-symbols-outlined text-[16px] text-primary">call</span>
                                        <span class="text-xs font-bold text-slate-700">${bank.referenteTelefono || '-'}</span>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[9px] font-bold text-gray-400 uppercase ml-1">Cellulare</span>
                                    <div class="flex items-center gap-2 p-2 rounded-xl bg-white border border-black/5 cursor-pointer hover:bg-gray-50 transition-colors" onclick="makeCall('${bank.referenteCellulare}')" title="Chiama">
                                        <span class="material-symbols-outlined text-[16px] text-primary">smartphone</span>
                                        <span class="text-xs font-bold text-slate-700">${bank.referenteCellulare || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Carte collegate -->
                        ${(bank.cards || []).length > 0 ? `
                            <div class="space-y-4 pt-2">
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Strumenti collegati</span>
                                ${bank.cards.map((card, cIdx) => `
                                    <div class="bg-white p-4 rounded-xl border border-black/5 shadow-sm space-y-4">
                                         <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-2">
                                                <span class="material-symbols-outlined text-primary text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                                                <span class="text-xs font-bold text-primary uppercase">${card.type === 'Debit' ? 'Bancomat' : 'Carta di Credito'}</span>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Titolare</span>
                                                <div class="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-black/5">
                                                    <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-[#0A162A]" value="${card.titolare || ''}">
                                                    <button onclick="copyText('${card.titolare}')" class="p-2 text-gray-400 hover:text-primary">
                                                        <span class="material-symbols-outlined text-base">content_copy</span>
                                                    </button>
                                                </div>
                                            </div>
                                            ${card.type !== 'Debit' ? `
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Tipo Carta</span>
                                                <div class="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-black/5">
                                                    <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-[#0A162A]" value="${card.cardType || ''}">
                                                </div>
                                            </div>
                                            ` : ''}
                                        </div>

                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Numero</span>
                                            <div class="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-black/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-[#0A162A]" value="${card.cardNumber || ''}">
                                                <button onclick="copyText('${card.cardNumber}')" class="p-2 text-gray-400 hover:text-primary">
                                                    <span class="material-symbols-outlined text-base">content_copy</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div class="grid grid-cols-3 gap-3">
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Scadenza</span>
                                                <div class="flex items-center bg-slate-50 rounded-lg h-10 px-3 text-sm text-[#0A162A] border border-black/5">
                                                    ${card.expiry || '-'}
                                                </div>
                                            </div>
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">CCV</span>
                                                <div class="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-black/5">
                                                    <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-[#0A162A]" value="${card.ccv || ''}">
                                                    <button onclick="copyText('${card.ccv}')" class="p-2 text-gray-400 hover:text-primary">
                                                        <span class="material-symbols-outlined text-sm">content_copy</span>
                                                    </button>
                                                </div>
                                            </div>
                                             <div class="flex flex-col gap-1.5">
                                                 <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">PIN</span>
                                                  <div class="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-black/5">
                                                      <input readonly type="text" class="titanium-shield pin-field flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-[#0A162A]" 
                                                         value="${card.pin || ''}">
                                                      <button onclick="const i=this.previousElementSibling; i.classList.toggle('titanium-shield'); this.querySelector('span').textContent=i.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                                                          <span class="material-symbols-outlined text-sm">visibility</span>
                                                      </button>
                                                  </div>
                                             </div>
                                        </div>

                                        ${card.note ? `
                                            <div class="flex flex-col gap-1.5">
                                                <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Note Strumento</span>
                                                <div class="selectable bg-slate-50 p-3 rounded-lg text-xs text-gray-600 italic border border-black/5">
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
        window.toggleSharingUI(isSharing);

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
                <button onclick="window.handleRevoke('${email}')" class="text-red-400 hover:text-red-600 transition-colors shrink-0" title="Rimuovi Accesso">
                    <span class="material-symbols-outlined text-sm">remove_circle</span>
                </button>
            `;
            container.appendChild(div);
        });
    }

    window.handleRevoke = async (email) => {
        if (!confirm(`Revocare l'accesso a ${email}?`)) return;
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
            btn.onclick = () => {
                const input = btn.parentElement.querySelector('input');
                window.copyText(input.value);
            };
        });
        const copyNoteBtn = document.getElementById('copy-note');
        if (copyNoteBtn) copyNoteBtn.onclick = () => window.copyText(document.getElementById('detail-note').textContent);

        // Toggle Password Visibility (Titanium Reveal Strategy)
        const toggle = document.getElementById('toggle-password');
        const passInput = document.getElementById('detail-password');
        const userInput = document.getElementById('detail-username');
        const accInput = document.getElementById('detail-account');

        if (toggle && passInput) {
            toggle.onclick = () => {
                passInput.classList.toggle('titanium-shield');
                if (userInput) userInput.classList.toggle('titanium-shield');
                if (accInput) accInput.classList.toggle('titanium-shield');

                const isMasked = passInput.classList.contains('titanium-shield');
                toggle.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';
            };
        }

        // Open Website
        const webBtn = document.getElementById('open-website');
        const webInput = document.getElementById('detail-website');
        if (webBtn && webInput) {
            webBtn.onclick = () => {
                let url = webInput.value.trim();
                if (!url) return;
                if (!url.startsWith('http')) url = 'https://' + url;
                window.open(url, '_blank');
            };
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

        // Edit Redirect
        const btnEditHeader = document.getElementById('btn-edit-header');
        if (btnEditHeader) {
            btnEditHeader.onclick = () => {
                window.location.href = `modifica_account_azienda.html?id=${encodeURIComponent(accountId)}&aziendaId=${encodeURIComponent(aziendaId)}`;
            };
        }

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
                        window.toggleSharingUI(true);
                        // Auto open accordion
                        const content = document.getElementById('accessi-content');
                        const chevron = document.getElementById('accessi-chevron');
                        if (content && content.classList.contains('hidden')) {
                            content.classList.remove('hidden');
                            if (chevron) chevron.style.transform = 'rotate(180deg)';
                        }
                    } else {
                        window.toggleSharingUI(false);
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
            btnSave.onclick = async () => {
                const isShared = checkShared.checked || checkMemoShared.checked;
                const newGuestEmail = inviteSelect ? inviteSelect.value : '';

                // Validation: if sharing, must have a guest selected OR existing guests
                const guestsContainer = document.getElementById('guests-list');
                const hasGuests = guestsContainer && !guestsContainer.textContent.includes('Nessun accesso attivo');

                if (isShared && !hasGuests && !newGuestEmail) {
                    alert("Seleziona una persona da invitare o verifica che ci siano già accessi attivi.");
                    window.closeSaveModal();
                    window.toggleSharingUI(true);
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
                    window.closeSaveModal();

                    // Reload Data
                    await loadAccountDetails(currentUser.uid, aziendaId, accountId);
                    if (inviteSelect) inviteSelect.value = "";

                } catch (e) {
                    console.error(e);
                    showToast("Errore salvataggio: " + e.message, 'error');
                } finally {
                    btnSave.disabled = false;
                }
            };
        }
    }

});
