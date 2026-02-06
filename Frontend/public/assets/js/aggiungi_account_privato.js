import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { showToast } from './ui-core.js';
import { collection, addDoc, getDocs, updateDoc, doc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// STATE
let currentUser = null;
let invitedEmails = [];
let myContacts = [];
let bankAccounts = []; // { iban: '', cards: [] }

// DOM ELEMENTS
const inviteInput = document.getElementById('invite-email');
const suggestions = document.getElementById('rubrica-suggestions');
const btnAddInvite = document.getElementById('btn-add-invite-list');
const invitedList = document.getElementById('invited-emails-list');

// MAIN
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadRubrica(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    setupUI();
    setupLogoUpload();

    // Trigger per file-input e logo-input (Rimozione onclick dal HTML)
    const btnLogo = document.getElementById('btn-trigger-logo');
    if (btnLogo) btnLogo.addEventListener('click', () => document.getElementById('logo-input').click());

    const btnFile = document.getElementById('btn-trigger-file');
    if (btnFile) btnFile.addEventListener('click', () => document.getElementById('file-input').click());

    // --- PROTOCOLLO: INIEZIONE AZIONI NEL FOOTER ---
    const injectFooterActions = () => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight) {
            footerRight.innerHTML = `
                <button id="save-btn" class="btn-icon-header" title="Sincronizza Protocollo">
                    <span class="material-symbols-outlined">send</span>
                </button>
            `;
            setupSave(); // Call setupSave after injection
        }
    };
    setTimeout(injectFooterActions, 500);
});

// FUNCTIONS
async function loadRubrica(uid) {
    try {
        const snap = await getDocs(collection(db, "users", uid, "contacts"));
        myContacts = snap.docs.map(d => d.data());
    } catch (e) {
        console.error("Rubrica error:", e);
    }
}

function setupUI() {
    // Flags Mutual Exclusion
    const flagShared = document.getElementById('flag-shared');
    const flagMemo = document.getElementById('flag-memo');
    const flagMemoShared = document.getElementById('flag-memo-shared');

    if (flagShared && flagMemo && flagMemoShared) {
        const flags = [flagShared, flagMemo, flagMemoShared];
        flags.forEach(el => {
            el.addEventListener('change', () => {
                if (el.checked) {
                    flags.forEach(other => { if (other !== el) other.checked = false; });
                }
                const mgmt = document.getElementById('shared-management');
                if (mgmt) mgmt.classList.toggle('hidden', !flagShared.checked && !flagMemoShared.checked);
            });
        });
    }

    // Main Password Toggle
    const btnToggle = document.getElementById('btn-toggle-password');
    const passInput = document.getElementById('account-password');
    if (btnToggle && passInput) {
        btnToggle.addEventListener('click', () => {
            passInput.classList.toggle('base-shield');
            btnToggle.querySelector('span').textContent = passInput.classList.contains('base-shield') ? 'visibility_off' : 'visibility';
        });
    }

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

    if (bankAccounts.length === 0) {
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
    }
    renderBankAccounts();

    // Invites Autocomplete
    if (inviteInput && suggestions) {
        inviteInput.addEventListener('input', () => {
            const val = inviteInput.value.toLowerCase();
            if (!val) { suggestions.classList.add('hidden'); return; }
            const filtered = myContacts.filter(c => (c.nome || '').toLowerCase().includes(val) || (c.email || '').toLowerCase().includes(val));
            if (filtered.length === 0) { suggestions.classList.add('hidden'); return; }
            suggestions.classList.remove('hidden');
            suggestions.innerHTML = filtered.map(c => `
                <div class="p-3 hover:bg-primary/5 cursor-pointer border-b border-gray-100 dark:border-gray-800" data-email="${c.email}">
                    <p class="text-xs font-bold pointer-events-none">${c.nome} ${c.cognome}</p>
                    <p class="text-[10px] text-gray-400 pointer-events-none">${c.email}</p>
                </div>
            `).join('');

            // Add click listeners to the divs we just created
            suggestions.querySelectorAll('div').forEach(div => {
                div.addEventListener('click', () => {
                    inviteInput.value = div.dataset.email;
                    suggestions.classList.add('hidden');
                });
            });
        });
    }

    // Add Invite Button
    if (btnAddInvite) {
        btnAddInvite.addEventListener('click', () => {
            const email = inviteInput.value.trim();
            if (email && !invitedEmails.includes(email)) {
                invitedEmails.push(email);
                renderInvitedList();
                inviteInput.value = '';
            }
        });
    }
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
                <span class="text-[10px] font-bold text-primary uppercase tracking-widest" data-t="account_counter">Conto #${ibanIdx + 1}</span>
                ${bankAccounts.length > 1 ? `
                    <button type="button" class="text-white/20 hover:text-red-500 transition-colors btn-remove-iban" data-idx="${ibanIdx}">
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
                    <input type="text" class="w-full bg-transparent border-none h-14 px-4 text-base text-[#0A162A] font-mono focus:ring-0 uppercase iban-input font-bold" 
                        data-iban-idx="${ibanIdx}" value="${account.iban}" placeholder="IT00..." />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Pass. Dispositiva</label>
                    <div class="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                        <input type="text" class="dispositiva-input base-shield w-full bg-transparent border-none h-11 px-4 text-sm focus:ring-0" 
                            data-iban-idx="${ibanIdx}" value="${account.passwordDispositiva || ''}" placeholder="Password..." />
                        <button type="button" class="p-2 text-gray-400 btn-toggle-shield">
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
                    <button type="button" class="text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5 btn-add-card" data-idx="${ibanIdx}">
                        <span class="material-symbols-outlined text-sm">add</span> Aggiungi carta
                    </button>
                </div>
                <div class="card-list-container space-y-4">
                    ${account.cards.map((card, cardIdx) => renderCardEntry(ibanIdx, cardIdx, card)).join('')}
                </div>
            </div>
        `;
        container.appendChild(ibanDiv);

        // Add Listeners
        ibanDiv.querySelector('.btn-remove-iban')?.addEventListener('click', () => removeIban(ibanIdx));
        ibanDiv.querySelector('.btn-add-card')?.addEventListener('click', () => addCard(ibanIdx));
        ibanDiv.querySelectorAll('.btn-toggle-shield').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = btn.previousElementSibling;
                input.classList.toggle('base-shield');
                btn.querySelector('span').textContent = input.classList.contains('base-shield') ? 'visibility' : 'visibility_off';
            });
        });

        // Listeners for Cards
        ibanDiv.querySelectorAll('.card-entry-item').forEach(cardEl => {
            const cIdx = parseInt(cardEl.dataset.card);
            cardEl.querySelector('.btn-remove-card')?.addEventListener('click', () => removeCard(ibanIdx, cIdx));
        });
    });
}

function renderCardEntry(ibanIdx, cardIdx, card) {
    return `
        <div class="bg-white p-4 rounded-xl border border-black/5 shadow-sm space-y-4 relative card-entry-item" data-iban="${ibanIdx}" data-card="${cardIdx}">
             <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-400 text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                    <span class="text-[10px] font-bold text-gray-500 uppercase">Strumento #${cardIdx + 1}</span>
                </div>
                <button type="button" class="text-gray-300 hover:text-red-500 transition-colors btn-remove-card">
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
                            <input type="text" class="pin-input base-shield w-full bg-transparent border-none h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.pin || ''}" placeholder="****" />
                            <button type="button" class="p-2 text-gray-400 btn-toggle-shield">
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

async function removeIban(ibanIdx) {
    const confirmed = await window.showConfirmModal(
        window.t('delete_iban_title') || "ELIMINA IBAN",
        window.t('delete_iban_confirm') || "Eliminare interamente questo IBAN e tutte le carte collegate?",
        window.t('delete') || "ELIMINA",
        window.t('cancel') || "ANNULLA"
    );
    if (confirmed) {
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
                renderBankAccounts(); // Re-render to show/hide "Tipo Carta"
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

function setupLogoUpload() {
    const logoInput = document.getElementById('logo-input');
    if (!logoInput) return;

    logoInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const size = 200;
                    canvas.width = size;
                    canvas.height = size;

                    const min = Math.min(img.width, img.height);
                    const sx = (img.width - min) / 2;
                    const sy = (img.height - min) / 2;

                    ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

                    const resizedData = canvas.toDataURL('image/jpeg', 0.8);
                    const preview = document.getElementById('account-logo-preview');
                    const placeholder = document.getElementById('logo-placeholder');
                    if (preview && placeholder) {
                        preview.src = resizedData;
                        preview.classList.remove('hidden');
                        placeholder.classList.add('hidden');
                    }
                };
                img.src = e.target.result;
            }
            reader.readAsDataURL(this.files[0]);
        }
    });
}

function setupSave() {
    const btn = document.getElementById('save-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (!currentUser) return;

        const icon = btn.querySelector('span');
        const originalIcon = icon.textContent;

        btn.disabled = true;
        icon.textContent = "sync";
        icon.classList.add('animate-spin');

        try {
            // Logo processing (grab from preview src if available)
            let logoBase64 = null;
            const preview = document.getElementById('account-logo-preview');
            if (preview && !preview.classList.contains('hidden') && preview.src.startsWith('data:')) {
                logoBase64 = preview.src;
            }

            const newAccount = {
                userId: currentUser.uid,
                type: 'privato',
                nomeAccount: document.getElementById('account-name').value,
                url: document.getElementById('account-url').value,
                logo: logoBase64,
                username: document.getElementById('account-username').value,
                codice: document.getElementById('account-code').value,
                password: document.getElementById('account-password').value,
                banking: bankAccounts.filter(b => b.iban.length > 5),
                referente: {
                    nome: document.getElementById('ref-name').value,
                    telefono: document.getElementById('ref-phone').value,
                    cellulare: document.getElementById('ref-mobile').value
                },
                note: document.getElementById('account-note').value,
                shared: document.getElementById('flag-shared').checked,
                hasMemo: document.getElementById('flag-memo').checked,
                isMemoShared: document.getElementById('flag-memo-shared').checked,
                createdAt: new Date().toISOString(),
                sharedWith: []
            };

            if (!newAccount.nomeAccount) {
                if (window.showToast) window.showToast(window.t("account_name_required") || "Inserisci almeno il nome dell'account", "error");
                throw new Error("Missing Name");
            }

            const docRef = await addDoc(collection(db, "users", currentUser.uid, "accounts"), newAccount);
            const accountId = docRef.id;

            if (invitedEmails.length > 0) {
                const invitesCollection = collection(db, "invites");
                const sharedWithUpdate = [];

                for (const email of invitedEmails) {
                    await addDoc(invitesCollection, {
                        accountId: accountId,
                        accountName: newAccount.nomeAccount,
                        ownerId: currentUser.uid,
                        ownerEmail: currentUser.email,
                        recipientEmail: email,
                        status: 'pending',
                        type: 'privato',
                        createdAt: new Date().toISOString()
                    });

                    sharedWithUpdate.push({
                        email: email,
                        status: 'pending',
                        invitedAt: new Date().toISOString()
                    });
                }

                await updateDoc(docRef, {
                    sharedWith: arrayUnion(...sharedWithUpdate)
                });
            }

            icon.textContent = "check_circle";
            icon.classList.remove('animate-spin');

            setTimeout(() => {
                window.location.href = 'account_privati.html';
            }, 500);

        } catch (e) {
            console.error(e);
            if (window.showToast) window.showToast((window.t("save_error") || "Errore salvataggio: ") + e.message, "error");
            btn.disabled = false;
            icon.textContent = originalIcon;
            icon.classList.remove('animate-spin');
        }
    });
}

// Global Exports
window.toggleAccessi = () => {
    const content = document.getElementById('accessi-content');
    const chevron = document.getElementById('accessi-chevron');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

window.copyToClipboard = (elementId) => {
    const input = document.getElementById(elementId);
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value);
};
