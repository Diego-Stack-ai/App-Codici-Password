import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc, getDoc, updateDoc, deleteDoc, serverTimestamp,
    collection, addDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let currentUid = null;
let currentAziendaId = null;
let currentAccountId = null;
let accountData = {};
let bankAccounts = [];
let myContacts = [];

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentAziendaId = urlParams.get('aziendaId');
    currentAccountId = urlParams.get('id');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUid = user.uid;
            await loadAccount();
            loadRubrica();
            initFormEvents();
            setupFooterActions();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Delegated actions for banking
    document.getElementById('iban-list-container')?.addEventListener('click', (e) => {
        const btnRemoveIban = e.target.closest('.btn-remove-iban');
        const btnAddCard = e.target.closest('.btn-add-card');
        const btnRemoveCard = e.target.closest('.btn-remove-card');

        if (btnRemoveIban) removeIban(parseInt(btnRemoveIban.dataset.idx));
        else if (btnAddCard) addCard(parseInt(btnAddCard.dataset.idx));
        else if (btnRemoveCard) removeCard(parseInt(btnRemoveCard.dataset.ibanIdx), parseInt(btnRemoveCard.dataset.cardIdx));
    });

    // Visibility and Copy
    document.body.addEventListener('click', (e) => {
        const btnToggle = e.target.closest('.btn-toggle-pass');
        const btnCopy = e.target.closest('.btn-copy-val');
        if (btnToggle) {
            const input = document.getElementById(btnToggle.dataset.target);
            const isShield = input.classList.toggle('base-shield');
            btnToggle.querySelector('span').textContent = isShield ? 'visibility' : 'visibility_off';
        } else if (btnCopy) {
            const val = document.getElementById(btnCopy.dataset.target).value;
            if (val) navigator.clipboard.writeText(val).then(() => showToast("Copiato!", "success"));
        }
    });

    // Delegated actions for guests
    document.getElementById('guests-list')?.addEventListener('click', (e) => {
        const btnRevoke = e.target.closest('.btn-revoke');
        if (btnRevoke) handleRevoke(btnRevoke.dataset.email);
    });
});

async function loadAccount() {
    try {
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentAccountId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            showToast("Non trovato", "error");
            return;
        }
        accountData = snap.data();

        // Populate basic fields
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('nome-account', accountData.nomeAccount);
        set('sito-web', accountData.sitoWeb);
        set('codice-societa', accountData.codiceSocieta);
        set('numero-iscrizione', accountData.numeroIscrizione);
        set('utente', accountData.utente);
        set('account', accountData.account);
        set('password', accountData.password);
        set('referente-nome', accountData.referenteNome);
        set('referente-telefono', accountData.referenteTelefono);
        set('referente-cellulare', accountData.referenteCellulare);
        set('note', accountData.note || accountData.nota);

        // Flags
        document.getElementById('flag-shared').checked = !!accountData.shared;
        document.getElementById('flag-memo').checked = !!accountData.hasMemo;
        document.getElementById('flag-memo-shared').checked = !!accountData.isMemoShared;
        toggleSharingUI(accountData.shared || accountData.isMemoShared);

        if (accountData.sharedWith) renderGuests(accountData.sharedWith);

        // Logo
        if (accountData.logo) {
            const prev = document.getElementById('account-logo-preview');
            prev.src = accountData.logo;
            prev.classList.remove('hidden');
            document.getElementById('logo-placeholder').classList.add('hidden');
        }

        // Banking
        if (accountData.banking) {
            bankAccounts = Array.isArray(accountData.banking) ? accountData.banking : [accountData.banking];
        }
        if (bankAccounts.length === 0) bankAccounts = [{ iban: '', cards: [] }];
        renderBankAccounts();

    } catch (e) {
        console.error(e);
        showToast("Errore caricamento", "error");
    }
}

function initFormEvents() {
    document.getElementById('btn-trigger-logo')?.addEventListener('click', () => document.getElementById('logo-input').click());
    document.getElementById('logo-input')?.addEventListener('change', handleLogoChange);
    document.getElementById('btn-add-iban')?.addEventListener('click', () => {
        bankAccounts.push({ iban: '', cards: [] });
        renderBankAccounts();
    });

    const flags = ['flag-shared', 'flag-memo', 'flag-memo-shared'];
    flags.forEach(fid => {
        document.getElementById(fid)?.addEventListener('change', (e) => {
            if (e.target.checked) {
                flags.filter(x => x !== fid).forEach(other => document.getElementById(other).checked = false);
            }
            toggleSharingUI(document.getElementById('flag-shared').checked || document.getElementById('flag-memo-shared').checked);
        });
    });

    // Invitations
    const inviteInput = document.getElementById('invite-email');
    const suggestions = document.getElementById('rubrica-suggestions');
    inviteInput?.addEventListener('input', () => {
        const val = inviteInput.value.toLowerCase();
        if (!val) { suggestions.classList.add('hidden'); return; }
        const filt = myContacts.filter(c => (c.nome || '').toLowerCase().includes(val) || (c.email || '').toLowerCase().includes(val));
        if (filt.length === 0) { suggestions.classList.add('hidden'); return; }
        suggestions.classList.remove('hidden');
        suggestions.innerHTML = filt.map(c => `
            <div class="p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-colors" data-email="${c.email}">
                <p class="text-[10px] font-black uppercase text-white">${c.nome} ${c.cognome}</p>
                <p class="text-[9px] text-white/40">${c.email}</p>
            </div>
        `).join('');
    });

    suggestions?.addEventListener('click', (e) => {
        const item = e.target.closest('div[data-email]');
        if (item) {
            inviteInput.value = item.dataset.email;
            suggestions.classList.add('hidden');
        }
    });

    document.getElementById('btn-send-invite')?.addEventListener('click', sendInvite);

    // Sync banking data
    document.getElementById('iban-list-container')?.addEventListener('input', (e) => {
        const el = e.target;
        const iIdx = parseInt(el.dataset.ibanIdx);
        const cIdx = parseInt(el.dataset.cardIdx);
        if (isNaN(iIdx)) return;

        const acc = bankAccounts[iIdx];
        if (!isNaN(cIdx)) {
            const card = acc.cards[cIdx];
            if (el.classList.contains('input-card-type')) card.type = el.value;
            else if (el.classList.contains('input-card-tit')) card.titolare = el.value;
            else if (el.classList.contains('input-card-sub')) card.cardType = el.value;
            else if (el.classList.contains('input-card-num')) card.cardNumber = el.value;
            else if (el.classList.contains('input-card-exp')) card.expiry = formatExpiry(el);
            else if (el.classList.contains('input-card-ccv')) card.ccv = el.value;
            else if (el.classList.contains('input-card-pin')) card.pin = el.value;
            else if (el.classList.contains('input-card-note')) card.note = el.value;
        } else {
            if (el.classList.contains('input-iban')) acc.iban = el.value.toUpperCase();
            else if (el.classList.contains('input-disp')) acc.passwordDispositiva = el.value;
            else if (el.classList.contains('input-ref-nome')) acc.referenteNome = el.value;
            else if (el.classList.contains('input-ref-cognome')) acc.referenteCognome = el.value;
            else if (el.classList.contains('input-ref-tel')) acc.referenteTelefono = el.value;
            else if (el.classList.contains('input-ref-cel')) acc.referenteCellulare = el.value;
            else if (el.classList.contains('input-iban-note')) acc.nota = el.value;
        }
    });
}

function handleLogoChange(e) {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 300;
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                const min = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
                const data = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('account-logo-preview').src = data;
                document.getElementById('account-logo-preview').classList.remove('hidden');
                document.getElementById('logo-placeholder').classList.add('hidden');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    }
}

function setupFooterActions() {
    const interval = setInterval(() => {
        const fCenter = document.getElementById('footer-center-actions');
        const fRight = document.getElementById('footer-right-actions');
        if (fCenter && fRight) {
            clearInterval(interval);
            fCenter.innerHTML = `
                <button id="btn-delete" class="footer-action-btn text-red-400">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            `;
            fRight.innerHTML = `
                <button id="btn-save" class="footer-action-btn text-blue-400">
                    <span class="material-symbols-outlined">save</span>
                </button>
            `;
            document.getElementById('btn-save').onclick = saveAccount;
            document.getElementById('btn-delete').onclick = deleteAccount;
        }
    }, 100);
}

async function saveAccount() {
    const nome = document.getElementById('nome-account').value.trim();
    if (!nome) { showToast("Nome obbligatorio", "error"); return; }

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span>`;

    try {
        const data = {
            nomeAccount: nome,
            sitoWeb: document.getElementById('sito-web').value.trim(),
            codiceSocieta: document.getElementById('codice-societa').value.trim(),
            numeroIscrizione: document.getElementById('numero-iscrizione').value.trim(),
            utente: document.getElementById('utente').value.trim(),
            account: document.getElementById('account').value.trim(),
            password: document.getElementById('password').value.trim(),
            referenteNome: document.getElementById('referente-nome').value.trim(),
            referenteTelefono: document.getElementById('referente-telefono').value.trim(),
            referenteCellulare: document.getElementById('referente-cellulare').value.trim(),
            note: document.getElementById('note').value.trim(),
            logo: document.getElementById('account-logo-preview').classList.contains('hidden') ? null : document.getElementById('account-logo-preview').src,
            shared: document.getElementById('flag-shared').checked,
            hasMemo: document.getElementById('flag-memo').checked,
            isMemoShared: document.getElementById('flag-memo-shared').checked,
            banking: bankAccounts.filter(b => b.iban.length > 5),
            updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentAccountId), data);
        showToast("Salvato con successo!", "success");
        setTimeout(() => window.location.href = `dettaglio_account_azienda.html?id=${currentAccountId}&aziendaId=${currentAziendaId}`, 1000);
    } catch (e) {
        console.error(e);
        showToast("Errore salvataggio", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">save</span>`;
    }
}

async function deleteAccount() {
    const ok = await showConfirmModal("ELIMINA", "Sei sicuro di voler eliminare questo account?", "Elimina", true);
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentAccountId));
        showToast("Account eliminato", "success");
        setTimeout(() => window.location.href = `account_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) {
        console.error(e);
        showToast("Errore eliminazione", "error");
    }
}

function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = bankAccounts.map((b, idx) => `
        <div class="glass-card p-5 animate-in slide-in-from-top-2">
            <div class="flex items-center justify-between mb-4">
                <span class="text-[9px] font-black uppercase tracking-widest text-white/20">Conto #${idx + 1}</span>
                ${bankAccounts.length > 1 ? `
                    <button class="btn-remove-iban size-8 flex-center text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" data-idx="${idx}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                ` : ''}
            </div>
            <div class="flex-col-gap-3">
                <div class="titanium-input-group">
                    <span class="material-symbols-outlined">account_balance</span>
                    <input type="text" class="input-iban" data-iban-idx="${idx}" value="${b.iban || ''}" placeholder="IBAN (IT...)" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="titanium-input-group">
                        <span class="material-symbols-outlined">key</span>
                        <input type="text" class="input-disp base-shield" data-iban-idx="${idx}" value="${b.passwordDispositiva || ''}" placeholder="P. Dispositiva" />
                    </div>
                    <div class="titanium-input-group">
                        <span class="material-symbols-outlined">notes</span>
                        <input type="text" class="input-iban-note" data-iban-idx="${idx}" value="${b.nota || ''}" placeholder="Nota IBAN" />
                    </div>
                </div>
                <div class="bg-white/5 rounded-2xl p-4 flex-col-gap-3">
                    <span class="text-[9px] font-black uppercase text-white/20">Referente Banca</span>
                    <div class="grid grid-cols-2 gap-3">
                        <input type="text" class="input-ref-nome titanium-input-group !pl-4 h-10" data-iban-idx="${idx}" value="${b.referenteNome || ''}" placeholder="Nome" />
                        <input type="text" class="input-ref-cognome titanium-input-group !pl-4 h-10" data-iban-idx="${idx}" value="${b.referenteCognome || ''}" placeholder="Cognome" />
                        <input type="text" class="input-ref-tel titanium-input-group !pl-4 h-10" data-iban-idx="${idx}" value="${b.referenteTelefono || ''}" placeholder="Tel" />
                        <input type="text" class="input-ref-cel titanium-input-group !pl-4 h-10" data-iban-idx="${idx}" value="${b.referenteCellulare || ''}" placeholder="Cel" />
                    </div>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <span class="text-[9px] font-black text-white/20 uppercase">Strumenti di Pagamento</span>
                    <button class="btn-add-card flex items-center gap-1 text-emerald-400 font-black text-[9px] uppercase" data-idx="${idx}">
                        <span class="material-symbols-outlined text-sm">add</span> Aggiungi
                    </button>
                </div>
                <div class="flex-col-gap-2">
                    ${(b.cards || []).map((c, cIdx) => renderCard(idx, cIdx, c)).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

function renderCard(iIdx, cIdx, c) {
    return `
        <div class="bg-white/5 rounded-2xl p-4 relative group">
            <button class="btn-remove-card absolute top-2 right-2 text-white/10 hover:text-red-400" data-iban-idx="${iIdx}" data-card-idx="${cIdx}">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
            <div class="grid grid-cols-2 gap-3 mb-2">
                <select class="input-card-type titanium-input-group !pl-3 h-10 text-xs text-white bg-slate-800" data-iban-idx="${iIdx}" data-card-idx="${cIdx}">
                    <option value="Credit" ${c.type === 'Credit' ? 'selected' : ''}>Credit</option>
                    <option value="Debit" ${c.type === 'Debit' ? 'selected' : ''}>Debit</option>
                </select>
                <input type="text" class="input-card-sub titanium-input-group !pl-3 h-10 text-xs" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" value="${c.cardType || ''}" placeholder="Visa / MC..." />
            </div>
            <input type="text" class="input-card-tit titanium-input-group !pl-3 h-10 text-xs w-full mb-2" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" value="${c.titolare || ''}" placeholder="Titolare" />
            <input type="text" class="input-card-num titanium-input-group !pl-3 h-10 text-xs w-full mb-2" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" value="${c.cardNumber || ''}" placeholder="Numero Carta" />
            <div class="grid grid-cols-3 gap-3 mb-2">
                <input type="text" class="input-card-exp titanium-input-group !pl-3 h-10 text-xs" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" value="${c.expiry || ''}" placeholder="MM/AA" />
                <input type="text" class="input-card-ccv titanium-input-group !pl-3 h-10 text-xs" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" value="${c.ccv || ''}" placeholder="CCV" />
                <input type="text" class="input-card-pin titanium-input-group !pl-3 h-10 text-xs base-shield" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" value="${c.pin || ''}" placeholder="PIN" />
            </div>
            <textarea class="input-card-note w-full bg-black/20 border border-white/5 rounded-xl p-2 text-[10px] text-white/60 resize-none" data-iban-idx="${iIdx}" data-card-idx="${cIdx}" placeholder="Note sulla carta">${c.note || ''}</textarea>
        </div>
    `;
}

function formatExpiry(el) {
    let val = el.value.replace(/\D/g, '');
    if (val.length > 4) val = val.substring(0, 4);
    if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
    el.value = val;
    return val;
}

function addCard(idx) {
    bankAccounts[idx].cards.push({ type: 'Credit', titolare: '', cardType: '', cardNumber: '', expiry: '', ccv: '', pin: '', note: '' });
    renderBankAccounts();
}

function removeCard(iIdx, cIdx) {
    bankAccounts[iIdx].cards.splice(cIdx, 1);
    renderBankAccounts();
}

async function removeIban(idx) {
    const ok = await showConfirmModal("IBAN", "Eliminare questo IBAN?", "Elimina", true);
    if (ok) {
        bankAccounts.splice(idx, 1);
        renderBankAccounts();
    }
}

async function loadRubrica() {
    try {
        const snap = await getDocs(collection(db, "users", currentUid, "contacts"));
        myContacts = snap.docs.map(d => d.data());
    } catch (e) { console.error(e); }
}

async function sendInvite() {
    const el = document.getElementById('invite-email');
    const email = el.value.trim();
    if (!email) return;

    try {
        await addDoc(collection(db, "invites"), {
            accountId: currentAccountId,
            aziendaId: currentAziendaId,
            accountName: accountData.nomeAccount,
            ownerId: currentUid,
            ownerEmail: auth.currentUser.email,
            recipientEmail: email,
            status: 'pending',
            type: 'azienda',
            createdAt: serverTimestamp()
        });
        showToast("Invito inviato!", "success");
        el.value = '';
    } catch (e) { console.error(e); showToast("Invito fallito", "error"); }
}

function toggleSharingUI(show) {
    document.getElementById('shared-management')?.classList.toggle('hidden', !show);
}

function renderGuests(list) {
    const el = document.getElementById('guests-list');
    if (!el) return;
    el.innerHTML = list.map(g => `
        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 shadow-sm">
            <div class="flex items-center gap-3">
                <div class="size-8 rounded-full bg-blue-500/10 text-blue-400 flex-center">
                    <span class="material-symbols-outlined text-sm">person</span>
                </div>
                <div class="flex-col">
                    <p class="text-[10px] font-black text-white truncate">${(typeof g === 'object' ? g.email : g).split('@')[0]}</p>
                    <p class="text-[9px] text-white/40 truncate">${typeof g === 'object' ? g.email : g}</p>
                </div>
            </div>
            <button class="btn-revoke size-8 flex-center text-red-400" data-email="${typeof g === 'object' ? g.email : g}">
                <span class="material-symbols-outlined text-sm">remove_circle</span>
            </button>
        </div>
    `).join('');
}
