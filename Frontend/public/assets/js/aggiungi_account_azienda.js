import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let bankAccounts = [{
    iban: '',
    cards: [],
    passwordDispositiva: '',
    referenteNome: '',
    referenteCognome: '',
    referenteTelefono: '',
    referenteCellulare: '',
    nota: ''
}];

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
    // 1. Prefer Stored Index
    if (typeof colorIndex === 'number' && companyPalettes[colorIndex]) {
        return companyPalettes[colorIndex];
    }
    // 2. Fallback
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

    // Update Save Button Gradient
    const btnSave = document.getElementById('save-btn');
    if (btnSave) {
        btnSave.style.background = `linear-gradient(to right, ${theme.from}, ${theme.to})`;
        btnSave.style.boxShadow = `0 10px 15px -3px ${theme.from}4d`;
    }
}

// Helpers
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    let bgClass = 'bg-gray-800 text-white';
    if (type === 'error') bgClass = 'bg-red-500 text-white';
    if (type === 'success') bgClass = 'bg-green-500 text-white';
    toast.className = `${bgClass} px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-full opacity-0 pointer-events-auto`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Expose copyToClipboard globally for the HTML button
window.copyToClipboard = function (elementId) {
    const el = document.getElementById(elementId);
    if (el && el.value) {
        navigator.clipboard.writeText(el.value).then(() => showToast("Copiato!", "success"));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const aziendaId = urlParams.get('aziendaId');

    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
        btnBack.onclick = () => {
            if (aziendaId) window.location.href = `account_azienda.html?id=${aziendaId}`;
            else history.back();
        };
    }

    if (!aziendaId) {
        showToast("ID Azienda mancante", 'error');
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // Fetch Company Theme
            if (aziendaId) {
                try {
                    const docRef = doc(db, "users", user.uid, "aziende", aziendaId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const cData = docSnap.data();
                        if (cData.ragioneSociale || typeof cData.colorIndex === 'number') {
                            applyTheme(cData.ragioneSociale, cData.colorIndex);
                        }
                    }
                } catch (e) {
                    console.error("Theme Error", e);
                }
            }
        }
    });

    // Banking UI Logic
    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.addEventListener('click', () => {
            bankAccounts.push({
                iban: '',
                cards: [],
                passwordDispositiva: '',
                referenteNome: '',
                referenteCognome: '',
                referenteTelefono: '',
                referenteCellulare: '',
                nota: ''
            });
            renderBankAccounts();
        });
    }
    renderBankAccounts();

    // --- PROTOCOLLO: INIEZIONE AZIONI NEL FOOTER ---
    const injectFooterActions = () => {
        const footerCenter = document.getElementById('footer-actions-center');
        if (footerCenter) {
            footerCenter.innerHTML = `
                <button id="save-btn" class="btn-action-footer primary" title="Salva Account">
                    <span class="material-symbols-outlined">save</span>
                    <span>Salva Account</span>
                </button>
            `;
            setupSaveLogic();
        }
    };
    setTimeout(injectFooterActions, 500);
});

function setupSaveLogic() {
    const btnSave = document.getElementById('save-btn');
    if (!btnSave) return;

    const urlParams = new URLSearchParams(window.location.search);
    const aziendaId = urlParams.get('aziendaId');

    btnSave.onclick = async function () {
        if (!auth.currentUser) return;

        const nome = document.getElementById('nome-account').value.trim();
        const utente = document.getElementById('utente').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!nome) return showToast("Inserisci Nome Account", "error");
        if (!utente) return showToast("Inserisci Utente", "error");
        if (!password) return showToast("Inserisci Password", "error");

        const data = {
            nomeAccount: nome,
            sitoWeb: document.getElementById('sito-web').value.trim(),
            codiceSocieta: document.getElementById('codice-societa').value.trim(),
            numeroIscrizione: document.getElementById('numero-iscrizione').value.trim(),
            utente: utente,
            account: document.getElementById('account').value.trim(),
            password: password,
            referenteNome: document.getElementById('referente-nome').value.trim(),
            referenteTelefono: document.getElementById('referente-telefono').value.trim(),
            referenteCellulare: document.getElementById('referente-cellulare').value.trim(),
            note: document.getElementById('note').value.trim(),
            banking: bankAccounts.filter(b => b.iban.length > 5),
            createdAt: serverTimestamp()
        };

        try {
            btnSave.disabled = true;
            btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Salvataggio...`;

            const colRef = collection(db, "users", auth.currentUser.uid, "aziende", aziendaId, "accounts");
            await addDoc(colRef, data);

            showToast("Account salvato!", 'success');
            setTimeout(() => {
                window.location.href = `account_azienda.html?id=${aziendaId}`;
            }, 1000);

        } catch (e) {
            console.error(e);
            showToast("Errore: " + e.message, 'error');
            btnSave.disabled = false;
            btnSave.innerHTML = `<span class="material-symbols-outlined">save</span> Salva Account`;
        }
    };
}
// --- BANKING FUNCTIONS ---
function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = '';

    bankAccounts.forEach((account, ibanIdx) => {
        const ibanDiv = document.createElement('div');
        ibanDiv.className = "bg-white/50 p-4 rounded-2xl border border-black/5 space-y-4 relative animate-in fade-in slide-in-from-top-4 duration-500";

        ibanDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-primary uppercase tracking-widest">Conto #${ibanIdx + 1}</span>
                ${bankAccounts.length > 1 ? `
                    <button type="button" class="text-gray-400 hover:text-red-500 transition-colors" onclick="removeIban(${ibanIdx})">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                ` : ''}
            </div>
            
            <div class="flex flex-col gap-2">
                <label class="text-[#0A162A] text-xs font-bold uppercase tracking-wide opacity-50 pl-1">IBAN</label>
                <div class="flex w-full items-center rounded-xl border border-black/5 bg-white overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
                    <div class="pl-4 text-gray-400 flex items-center justify-center">
                        <span class="material-symbols-outlined">account_balance</span>
                    </div>
                    <input type="text" class="iban-input w-full bg-transparent border-none h-14 px-4 text-base text-[#0A162A] font-mono focus:ring-0 uppercase font-bold" 
                        data-iban-idx="${ibanIdx}" value="${account.iban}" placeholder="IT00..." />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Pass. Dispositiva</label>
                    <div class="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                        <input type="text" class="dispositiva-input titanium-shield w-full bg-transparent border-none h-11 px-4 text-sm focus:ring-0" 
                            data-iban-idx="${ibanIdx}" value="${account.passwordDispositiva || ''}" placeholder="Password..." />
                        <button type="button" onclick="const i=this.previousElementSibling; i.classList.toggle('titanium-shield'); this.querySelector('span').textContent=i.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                            <span class="material-symbols-outlined text-sm">visibility</span>
                        </button>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Nota IBAN</label>
                    <textarea class="iban-nota-input w-full bg-white rounded-xl border border-black/5 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary/20 resize-none" 
                        data-iban-idx="${ibanIdx}" rows="1" placeholder="Note per questo IBAN...">${account.nota || ''}</textarea>
                </div>
            </div>

            <!-- SEZIONE REFERENTE -->
            <div class="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-3">
                <div class="flex items-center gap-2 text-primary">
                    <span class="material-symbols-outlined text-sm">contact_phone</span>
                    <span class="text-[10px] font-bold uppercase tracking-widest">Referente Banca</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Nome</label>
                        <input type="text" class="ref-nome-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteNome || ''}" placeholder="Nome" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Cognome</label>
                        <input type="text" class="ref-cognome-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteCognome || ''}" placeholder="Cognome" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Telefono</label>
                        <input type="text" class="ref-tel-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteTelefono || ''}" placeholder="Tel." />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Cellulare</label>
                        <input type="text" class="ref-cell-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteCellulare || ''}" placeholder="Cell." />
                    </div>
                </div>
            </div>

            <div class="space-y-3 pl-4 border-l-2 border-primary/10 py-1">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Carte collegate</span>
                    <button type="button" class="text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5" onclick="addCard(${ibanIdx})">
                        <span class="material-symbols-outlined text-sm">add</span> Aggiungi carta
                    </button>
                </div>
                <div class="card-list-container space-y-4">
                    ${account.cards.map((card, cardIdx) => renderCardEntry(ibanIdx, cardIdx, card)).join('')}
                </div>
            </div>
        `;
        container.appendChild(ibanDiv);
    });

    // Event Listeners for Banking are handled globally now
}

function renderCardEntry(ibanIdx, cardIdx, card) {
    return `
        <div class="bg-white p-4 rounded-xl border border-black/5 shadow-sm space-y-4 relative">
             <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-400 text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                    <span class="text-[10px] font-bold text-gray-500 uppercase">Strumento #${cardIdx + 1}</span>
                </div>
                <button type="button" class="text-gray-300 hover:text-red-500 transition-colors" onclick="removeCard(${ibanIdx}, ${cardIdx})">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <div class="grid grid-cols-1 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Tipo Strumento</label>
                    <select class="type-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}">
                        <option value="Credit" ${card.type === 'Credit' ? 'selected' : ''}>Carta di credito (Credit)</option>
                        <option value="Debit" ${card.type === 'Debit' ? 'selected' : ''}>Bancomat (Debit)</option>
                    </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Titolare</label>
                        <input type="text" class="titolare-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.titolare || ''}" placeholder="Titolare..." />
                    </div>
                    <div class="flex flex-col gap-1.5 ${card.type === 'Debit' ? 'hidden' : ''}">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Tipo Carta</label>
                        <input type="text" class="cardtype-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardType || ''}" placeholder="Visa, MC..." />
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Numero</label>
                    <input type="text" class="number-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm font-mono focus:ring-1 focus:ring-primary/20" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardNumber || ''}" placeholder="**** **** **** ****" />
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Scadenza</label>
                        <input type="text" class="expiry-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.expiry || ''}" placeholder="MM/AA" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">CCV</label>
                        <input type="text" class="ccv-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.ccv || ''}" placeholder="123" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">PIN</label>
                        <div class="flex items-center bg-slate-50 rounded-lg overflow-hidden border border-black/5">
                            <input type="text" class="pin-input titanium-shield w-full bg-transparent border-none h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.pin || ''}" placeholder="****" />
                            <button type="button" onclick="const i=this.previousElementSibling; i.classList.toggle('titanium-shield'); this.querySelector('span').textContent=i.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                                <span class="material-symbols-outlined text-sm">visibility</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Note</label>
                    <textarea class="note-input w-full bg-slate-50 border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary/20 resize-none" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" rows="2" placeholder="Note sulla carta...">${card.note || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

// Global actions
window.addCard = (ibanIdx) => {
    bankAccounts[ibanIdx].cards.push({ type: 'Credit', titolare: '', cardType: '', cardNumber: '', expiry: '', ccv: '', pin: '', note: '' });
    renderBankAccounts();
};

window.removeCard = (ibanIdx, cardIdx) => {
    bankAccounts[ibanIdx].cards.splice(cardIdx, 1);
    renderBankAccounts();
};

window.removeIban = (ibanIdx) => {
    if (confirm("Eliminare interamente questo IBAN e tutte le carte collegate?")) {
        bankAccounts.splice(ibanIdx, 1);
        renderBankAccounts();
    }
};

document.addEventListener('input', (e) => {
    const el = e.target;
    const ibanIdx = el.dataset.ibanIdx;

    if (ibanIdx !== undefined) {
        const account = bankAccounts[ibanIdx];

        if (el.dataset.cardIdx !== undefined) {
            const card = account.cards[el.dataset.cardIdx];
            if (el.classList.contains('type-input')) {
                card.type = el.value;
                renderBankAccounts();
            }
            else if (el.classList.contains('titolare-input')) card.titolare = el.value;
            else if (el.classList.contains('cardtype-input')) card.cardType = el.value;
            else if (el.classList.contains('expiry-input')) {
                let val = el.value.replace(/\D/g, '');
                if (val.length > 4) val = val.substring(0, 4);
                if (val.length > 2) {
                    val = val.substring(0, 2) + '/' + val.substring(2);
                }
                el.value = val;
                card.expiry = val;
            }
            else if (el.classList.contains('ccv-input')) card.ccv = el.value;
            else if (el.classList.contains('pin-input')) card.pin = el.value;
            else if (el.classList.contains('note-input')) card.note = el.value;
        } else {
            // IBAN Level Fields
            if (el.classList.contains('iban-input')) account.iban = el.value.trim().toUpperCase();
            else if (el.classList.contains('dispositiva-input')) account.passwordDispositiva = el.value;
            else if (el.classList.contains('ref-nome-input')) account.referenteNome = el.value;
            else if (el.classList.contains('ref-cognome-input')) account.referenteCognome = el.value;
            else if (el.classList.contains('ref-tel-input')) account.referenteTelefono = el.value;
            else if (el.classList.contains('ref-cell-input')) account.referenteCellulare = el.value;
            else if (el.classList.contains('iban-nota-input')) account.nota = el.value;
        }
    }
});
