import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Fallback sicuro per window.t
window.t = window.t || ((k) => k);

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

    const btnSave = document.getElementById('save-btn');
    if (btnSave) {
        btnSave.style.background = `linear-gradient(to right, ${theme.from}, ${theme.to})`;
        btnSave.style.boxShadow = `0 10px 15px -3px ${theme.from}4d`;
    }
}

// Helpers
const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const aziendaId = urlParams.get('aziendaId');

    if (!aziendaId) {
        showToast("ID Azienda mancante", 'error');
    }

    // Static Event Listeners
    const btnTogglePass = document.getElementById('btn-toggle-password');
    if (btnTogglePass) {
        btnTogglePass.addEventListener('click', () => {
            const input = document.getElementById('password');
            const icon = btnTogglePass.querySelector('span');

            const isMasked = input.type === "password";
            input.type = isMasked ? "text" : "password";

            if (isMasked) input.classList.remove('base-shield');
            else input.classList.add('base-shield');

            icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        });
    }

    const btnCopyPass = document.getElementById('btn-copy-password');
    if (btnCopyPass) {
        btnCopyPass.addEventListener('click', () => {
            const val = document.getElementById('password').value;
            if (val) {
                navigator.clipboard.writeText(val).then(() => showToast("Password copiata!", "success"));
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
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

    // Iniezione Save Button nel Footer
    const interval = setInterval(() => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight) {
            clearInterval(interval);
            footerRight.innerHTML = `
                <button id="save-btn" class="base-btn-primary flex-center-gap" title="Salva Account">
                    <span class="material-symbols-outlined">save</span>
                    <span data-t="save_account">Salva Account</span>
                </button>
            `;
            setupSaveLogic();
        }
    }, 100);
});

function setupSaveLogic() {
    const btnSave = document.getElementById('save-btn');
    if (!btnSave) return;

    const urlParams = new URLSearchParams(window.location.search);
    const aziendaId = urlParams.get('aziendaId');

    btnSave.addEventListener('click', async () => {
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
            btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> <span data-t="saving">Salvataggio...</span>`;

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
            btnSave.innerHTML = `<span class="material-symbols-outlined">save</span> <span data-t="save_account">Salva Account</span>`;
        }
    });
}

// --- BANKING FUNCTIONS ---
function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = '';

    bankAccounts.forEach((account, ibanIdx) => {
        const ibanDiv = document.createElement('div');
        ibanDiv.className = "p-5 bg-slate-500/5 rounded-3xl border border-white/5 border-glow flex-col-gap-4 relative";

        ibanDiv.innerHTML = `
            <div class="flex items-center justify-between border-b border-white/5 pb-2">
                <span class="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Conto #${ibanIdx + 1}</span>
                ${bankAccounts.length > 1 ? `
                    <button type="button" class="btn-remove-iban text-white/40 hover:text-red-500 transition-colors" data-idx="${ibanIdx}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                ` : ''}
            </div>
            
            <div class="glass-field-container">
                <label class="view-label">IBAN</label>
                <div class="glass-field">
                    <span class="material-symbols-outlined opacity-70 mr-2">account_balance</span>
                    <input type="text" class="iban-input uppercase font-bold font-mono" 
                        data-iban-idx="${ibanIdx}" value="${account.iban}" placeholder="IT00..." />
                </div>
            </div>

            <div class="form-grid-2">
                <div class="glass-field-container">
                    <label class="view-label">Pass. Dispositiva</label>
                    <div class="glass-field">
                        <input type="text" class="dispositiva-input base-shield" 
                            data-iban-idx="${ibanIdx}" value="${account.passwordDispositiva || ''}" placeholder="Password..." />
                        <button type="button" class="btn-toggle-shield-bank glass-field-btn">
                            <span class="material-symbols-outlined text-sm">visibility</span>
                        </button>
                    </div>
                </div>
                <div class="glass-field-container">
                    <label class="view-label">Nota IBAN</label>
                    <div class="glass-field">
                        <input type="text" class="iban-nota-input" 
                            data-iban-idx="${ibanIdx}" value="${account.nota || ''}" placeholder="Note..." />
                    </div>
                </div>
            </div>

            <!-- SEZIONE REFERENTE BANCA -->
            <div class="bg-blue-500/5 p-4 rounded-2xl border border-white/5 flex-col-gap-3">
                <div class="flex items-center gap-2 text-blue-500">
                    <span class="material-symbols-outlined text-sm">contact_phone</span>
                    <span class="text-[10px] font-black uppercase tracking-widest">Referente Banca</span>
                </div>
                <div class="form-grid-2">
                    <div class="glass-field-container">
                        <label class="view-label">Nome</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 flex items-center px-3 h-10">
                            <input type="text" class="ref-nome-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" value="${account.referenteNome || ''}" placeholder="Nome" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label">Cognome</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 flex items-center px-3 h-10">
                             <input type="text" class="ref-cognome-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" value="${account.referenteCognome || ''}" placeholder="Cognome" />
                        </div>
                    </div>
                </div>
                <div class="form-grid-2">
                    <div class="glass-field-container">
                        <label class="view-label">Telefono</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 flex items-center px-3 h-10">
                             <input type="tel" class="ref-tel-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" value="${account.referenteTelefono || ''}" placeholder="Tel." />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label">Cellulare</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 flex items-center px-3 h-10">
                              <input type="tel" class="ref-cell-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" value="${account.referenteCellulare || ''}" placeholder="Cell." />
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex-col-gap-3 pl-4 border-l-2 border-white/5">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">Strumenti collegati</span>
                    <button type="button" class="btn-add-card text-blue-500 text-[10px] font-bold hover:underline flex items-center gap-0.5" data-idx="${ibanIdx}">
                        <span class="material-symbols-outlined text-sm">add</span> Aggiungi carta
                    </button>
                </div>
                <div class="flex-col-gap-4">
                    ${account.cards.map((card, cardIdx) => renderCardEntry(ibanIdx, cardIdx, card)).join('')}
                </div>
            </div>
        `;
        container.appendChild(ibanDiv);
    });

    // Attach Dynamic Listeners
    container.querySelectorAll('.btn-remove-iban').forEach(btn => {
        btn.onclick = () => removeIban(parseInt(btn.dataset.idx));
    });
    container.querySelectorAll('.btn-add-card').forEach(btn => {
        btn.onclick = () => addCard(parseInt(btn.dataset.idx));
    });
    container.querySelectorAll('.btn-toggle-shield-bank').forEach(btn => {
        btn.onclick = () => {
            const input = btn.previousElementSibling;
            input.classList.toggle('base-shield');
            btn.querySelector('span').textContent = input.classList.contains('base-shield') ? 'visibility' : 'visibility_off';
        };
    });
    container.querySelectorAll('.btn-remove-card').forEach(btn => {
        btn.onclick = () => removeCard(parseInt(btn.dataset.ibanIdx), parseInt(btn.dataset.cardIdx));
    });
    container.querySelectorAll('.type-input-select').forEach(select => {
        select.onchange = (e) => {
            const ibanIdx = select.dataset.ibanIdx;
            const cardIdx = select.dataset.cardIdx;
            bankAccounts[ibanIdx].cards[cardIdx].type = e.target.value;
            renderBankAccounts();
        };
    });
}

function renderCardEntry(ibanIdx, cardIdx, card) {
    return `
        <div class="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-sm flex-col-gap-4 relative">
             <div class="flex items-center justify-between border-b border-white/5 pb-2">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-blue-500 text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                    <span class="text-[10px] font-bold text-white/40 uppercase">Strumento #${cardIdx + 1}</span>
                </div>
                <button type="button" class="btn-remove-card text-white/20 hover:text-red-500 transition-colors" data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <div class="flex-col-gap-3">
                <div class="glass-field-container">
                    <label class="view-label">Tipo Strumento</label>
                    <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                        <select class="type-input-select glass-select" data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}">
                            <option value="Credit" ${card.type === 'Credit' ? 'selected' : ''}>Carta di credito (Credit)</option>
                            <option value="Debit" ${card.type === 'Debit' ? 'selected' : ''}>Bancomat (Debit)</option>
                        </select>
                    </div>
                </div>

                <div class="form-grid-2">
                    <div class="glass-field-container">
                        <label class="view-label">Titolare</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                            <input type="text" class="titolare-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.titolare || ''}" placeholder="Titolare..." />
                        </div>
                    </div>
                    <div class="glass-field-container ${card.type === 'Debit' ? 'hidden' : ''}">
                        <label class="view-label">Tipo Carta</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                            <input type="text" class="cardtype-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardType || ''}" placeholder="Visa, MC..." />
                        </div>
                    </div>
                </div>

                <div class="glass-field-container">
                    <label class="view-label">Numero</label>
                    <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                        <input type="text" class="number-input bg-transparent border-none text-sm text-white w-full outline-none font-mono" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardNumber || ''}" placeholder="**** **** **** ****" />
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div class="glass-field-container">
                        <label class="view-label">Scadenza</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                            <input type="text" class="expiry-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.expiry || ''}" placeholder="MM/AA" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label">CCV</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                            <input type="text" class="ccv-input bg-transparent border-none text-sm text-white w-full outline-none" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.ccv || ''}" placeholder="123" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label">PIN</label>
                        <div class="glass-field-small bg-white/5 rounded-xl border border-white/5 px-3 h-10 flex items-center">
                            <input type="text" class="pin-input base-shield bg-transparent border-none text-sm text-white w-full outline-none font-mono" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.pin || ''}" placeholder="****" />
                            <button type="button" class="btn-toggle-shield-bank glass-field-btn">
                                <span class="material-symbols-outlined text-sm">visibility</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="glass-field-container">
                    <label class="view-label">Note</label>
                    <div class="note-display-box" style="min-height: 60px;">
                        <textarea class="note-input bg-transparent border-none text-sm text-white w-full outline-none resize-none px-2 py-1" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" rows="2" placeholder="Note sulla carta...">${card.note || ''}</textarea>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Global actions (locally scoped helper)
function addCard(ibanIdx) {
    bankAccounts[ibanIdx].cards.push({ type: 'Credit', titolare: '', cardType: '', cardNumber: '', expiry: '', ccv: '', pin: '', note: '' });
    renderBankAccounts();
}

function removeCard(ibanIdx, cardIdx) {
    bankAccounts[ibanIdx].cards.splice(cardIdx, 1);
    renderBankAccounts();
}

function removeIban(ibanIdx) {
    if (window.showConfirmModal) {
        window.showConfirmModal("Elimina IBAN", "Sei sicuro di voler eliminare interamente questo IBAN e tutte le carte collegate?", () => {
            bankAccounts.splice(ibanIdx, 1);
            renderBankAccounts();
        });
    } else if (confirm("Eliminare?")) {
        bankAccounts.splice(ibanIdx, 1);
        renderBankAccounts();
    }
}

document.addEventListener('input', (e) => {
    const el = e.target;
    const ibanIdx = el.dataset.ibanIdx;

    if (ibanIdx !== undefined) {
        const account = bankAccounts[ibanIdx];

        if (el.dataset.cardIdx !== undefined) {
            const card = account.cards[el.dataset.cardIdx];
            if (el.classList.contains('titolare-input')) card.titolare = el.value;
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
            else if (el.classList.contains('number-input')) card.cardNumber = el.value;
        } else {
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
