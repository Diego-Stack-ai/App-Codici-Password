import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, addDoc, getDocs, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { showToast } from './ui-core.js';
import { initComponents } from './components.js';

// --- TITANIUM STATE ---
let currentUser = null;
let invitedEmails = [];
let myContacts = [];
let bankAccounts = [{ iban: '', cards: [], passwordDispositiva: '', referenteNome: '', referenteCognome: '', referenteTelefono: '', referenteCellulare: '', nota: '' }];

// --- DOM ELEMENTS ---
const inviteInput = document.getElementById('invite-email');
const suggestions = document.getElementById('rubrica-suggestions');
const btnAddInvite = document.getElementById('btn-add-invite-list');
const invitedList = document.getElementById('invited-emails-list');

// --- INITIALIZATION ---
initComponents();

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
    setupSave();
});

function loadRubrica(uid) {
    getDocs(collection(db, "users", uid, "contacts")).then(snap => {
        myContacts = snap.docs.map(d => d.data());
    }).catch(e => logError("Rubrica Load", e));
}

function setupUI() {
    // 1. IBAN Management
    document.getElementById('btn-add-iban').onclick = () => {
        bankAccounts.push({ iban: '', cards: [], passwordDispositiva: '', referenteNome: '', referenteCognome: '', referenteTelefono: '', referenteCellulare: '', nota: '' });
        renderBankAccounts();
    };
    renderBankAccounts();

    // 2. Shared Management Toggle
    const flagShared = document.getElementById('flag-shared');
    if (flagShared) {
        flagShared.addEventListener('change', () => {
            const mgmt = document.getElementById('shared-management');
            if (mgmt) mgmt.classList.toggle('hidden', !flagShared.checked);
        });
    }

    // 3. Invites Logic
    if (btnAddInvite) {
        btnAddInvite.onclick = () => {
            const email = inviteInput.value.trim();
            if (email && !invitedEmails.includes(email)) {
                invitedEmails.push(email);
                renderInvitedList();
                inviteInput.value = '';
            }
        };
    }
}

/**
 * RENDERING: COORDINATE BANCARIE (Titanium Glass Style)
 */
function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = '';

    bankAccounts.forEach((acc, idx) => {
        const div = document.createElement('div');
        div.className = "bg-[#0a0f1e]/40 backdrop-blur-2xl rounded-[32px] border border-white/5 border-glow p-6 space-y-6 shadow-xl relative overflow-hidden";
        div.innerHTML = `
            <div class="saetta opacity-5"></div>
            <div class="flex items-center justify-between relative z-10">
                <span class="text-[9px] font-black uppercase tracking-widest text-blue-400">Conto Corrente #${idx + 1}</span>
                ${bankAccounts.length > 1 ? `
                    <button type="button" class="text-white/20 hover:text-red-500 transition-colors" onclick="removeIban(${idx})">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                ` : ''}
            </div>
            
            <div class="space-y-2">
                <label class="text-[9px] font-black uppercase tracking-widest text-white/20 ml-2">Codice IBAN</label>
                <div class="h-14 relative">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/20">account_balance</span>
                    <input type="text" value="${acc.iban}" oninput="updateIbanField(${idx}, 'iban', this.value)" 
                           class="w-full h-full pl-12 pr-6 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold text-white uppercase font-mono focus:ring-2 focus:ring-blue-500/30">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-white/20 ml-2">Pass. Dispositiva</label>
                    <input type="password" value="${acc.passwordDispositiva}" oninput="updateIbanField(${idx}, 'passwordDispositiva', this.value)"
                           class="w-full h-12 px-5 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30">
                </div>
                <div class="space-y-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-white/20 ml-2">Referente Banca</label>
                    <input type="text" value="${acc.referenteNome}" oninput="updateIbanField(${idx}, 'referenteNome', this.value)"
                           class="w-full h-12 px-5 rounded-2xl bg-black/40 border border-white/5 text-sm font-bold text-white focus:ring-2 focus:ring-blue-500/30">
                </div>
            </div>

            <div class="pt-4 border-t border-white/5">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-[9px] font-black uppercase tracking-widest text-white/20">Carte collegate</span>
                    <button type="button" class="text-blue-400 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors" onclick="addCard(${idx})">+ Inserisci Carta</button>
                </div>
                <div class="space-y-3">
                    ${acc.cards.map((card, cIdx) => renderCard(idx, cIdx, card)).join('')}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderCard(iIdx, cIdx, card) {
    return `
        <div class="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4 relative group">
            <button onclick="removeCard(${iIdx}, ${cIdx})" class="absolute top-2 right-2 p-1 text-white/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
            <div class="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Tipo (Visa/Debit)" value="${card.cardType || ''}" 
                       oninput="updateCardField(${iIdx}, ${cIdx}, 'cardType', this.value)"
                       class="h-10 px-4 rounded-xl bg-black/40 border border-white/5 text-[10px] font-bold text-white uppercase tracking-widest focus:ring-1 focus:ring-blue-500/50">
                <input type="text" placeholder="Numero Carta" value="${card.cardNumber || ''}" 
                       oninput="updateCardField(${iIdx}, ${cIdx}, 'cardNumber', this.value)"
                       class="h-10 px-4 rounded-xl bg-black/40 border border-white/5 text-[10px] font-bold text-white font-mono focus:ring-1 focus:ring-blue-500/50">
            </div>
            <div class="grid grid-cols-3 gap-3">
                <input type="text" placeholder="Exp" value="${card.expiry || ''}" oninput="updateCardField(${iIdx}, ${cIdx}, 'expiry', this.value)"
                       class="h-10 px-4 rounded-xl bg-black/40 border border-white/5 text-[10px] text-center font-bold text-white">
                <input type="text" placeholder="CCV" value="${card.ccv || ''}" oninput="updateCardField(${iIdx}, ${cIdx}, 'ccv', this.value)"
                       class="h-10 px-4 rounded-xl bg-black/40 border border-white/5 text-[10px] text-center font-bold text-white">
                <input type="text" placeholder="PIN" value="${card.pin || ''}" oninput="updateCardField(${iIdx}, ${cIdx}, 'pin', this.value)"
                       class="h-10 px-4 rounded-xl bg-black/40 border border-white/5 text-[10px] text-center font-bold text-white">
            </div>
        </div>
    `;
}

// --- HELPER WRAPPERS FOR DYNAMIC DATA ---
window.updateIbanField = (idx, field, val) => bankAccounts[idx][field] = val;
window.updateCardField = (iIdx, cIdx, field, val) => bankAccounts[iIdx].cards[cIdx][field] = val;
window.removeIban = (idx) => { bankAccounts.splice(idx, 1); renderBankAccounts(); };
window.addCard = (idx) => { bankAccounts[idx].cards.push({ cardType: '', cardNumber: '', expiry: '', ccv: '', pin: '' }); renderBankAccounts(); };
window.removeCard = (iIdx, cIdx) => { bankAccounts[iIdx].cards.splice(cIdx, 1); renderBankAccounts(); };

/**
 * LOGO & SAVE LOGIC
 */
function setupLogoUpload() {
    const input = document.getElementById('logo-input');
    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('account-logo-preview');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            document.getElementById('logo-placeholder').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    };
}

function renderInvitedList() {
    invitedList.innerHTML = invitedEmails.map(e => `
        <div class="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center gap-2">
            <span class="text-[10px] font-bold text-white/80">${e}</span>
            <button onclick="removeEmail('${e}')" class="text-white/40 hover:text-white"><span class="material-symbols-outlined text-xs">close</span></button>
        </div>
    `).join('');
}
window.removeEmail = (e) => { invitedEmails = invitedEmails.filter(x => x !== e); renderInvitedList(); };

function setupSave() {
    const btn = document.getElementById('save-btn');
    btn.onclick = async () => {
        if (!currentUser) return;

        const name = document.getElementById('account-name').value;
        if (!name) { showToast("Specificare nome account", "error"); return; }

        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-white/50">sync</span> <span class="tracking-widest">Sincronizzazione in corso...</span>`;

        try {
            const logo = document.getElementById('account-logo-preview').src;
            const newAcc = {
                userId: currentUser.uid,
                nomeAccount: name,
                username: document.getElementById('account-username').value,
                codice: document.getElementById('account-code').value,
                password: document.getElementById('account-password').value,
                url: document.getElementById('account-url').value,
                note: document.getElementById('account-note').value,
                shared: document.getElementById('flag-shared').checked,
                hasMemo: document.getElementById('flag-memo').checked,
                logo: logo.startsWith('data:') ? logo : null,
                bankAccounts: bankAccounts.filter(b => b.iban),
                createdAt: new Date().toISOString(),
                ownerEmail: currentUser.email
            };

            const docRef = await addDoc(collection(db, "users", currentUser.uid, "accounts"), newAcc);

            // Handle Invites
            if (newAcc.shared && invitedEmails.length > 0) {
                for (const email of invitedEmails) {
                    await addDoc(collection(db, "invites"), {
                        accountId: docRef.id,
                        accountName: name,
                        ownerId: currentUser.uid,
                        recipientEmail: email,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });
                }
            }

            showToast("Protocollo sincronizzato!", "success");
            setTimeout(() => window.location.href = 'account_privati.html', 800);

        } catch (e) {
            logError("Account Save", e);
            showToast("Errore durante il salvataggio", "error");
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };
}
