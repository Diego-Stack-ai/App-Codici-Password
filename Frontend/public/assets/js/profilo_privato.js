import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

/**
 * PROFILO PRIVATO MODULE (PROTOCOLLO BASE V3.6)
 */

let currentUserUid = null;
let currentUserData = {};
let contactEmails = [];
let userAddresses = [];
let contactPhones = [];
let userDocuments = [];

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        currentUserUid = user.uid;
        await loadUserData(user);
        setupAvatarEdit();
        setupDelegation();
    });
});

async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return;

        currentUserData = userDoc.data();

        // Populate Hero Header
        const fullName = `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim() || 'Utente';
        const nameDisplay = document.getElementById('user-display-name');
        if (nameDisplay) nameDisplay.textContent = fullName;

        const avatar = document.getElementById('profile-avatar');
        if (avatar) avatar.src = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";

        // Static Fields
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
        set('nome-view', fullName);
        set('cf-view', (currentUserData.cf || currentUserData.codiceFiscale || '').toUpperCase());
        set('birth_date-view', formatDateToIT(currentUserData.birth_date));
        set('birth_place-view', `${currentUserData.birth_place || ''} ${currentUserData.birth_province ? '(' + currentUserData.birth_province + ')' : ''}`.trim());
        set('note-view', currentUserData.note);

        // Dynamic Collections
        userAddresses = currentUserData.userAddresses || [];
        renderAddressesView();

        contactPhones = currentUserData.contactPhones || [];
        renderPhonesView();

        contactEmails = currentUserData.contactEmails || [];
        renderEmailsView();

        userDocuments = currentUserData.documenti || [];
        renderDocumentiView();

    } catch (e) {
        console.error(e);
        showToast("Errore caricamento dati", "error");
    }
}

function formatDateToIT(val) {
    if (!val || val === '-') return '-';
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = val.split('-');
        return `${d}/${m}/${y}`;
    }
    return val;
}

// --- AVATAR ---
function setupAvatarEdit() {
    const input = document.getElementById('avatar-input');
    if (!input) return;

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUserUid) return;

        showToast("Caricamento avatar...", "info");
        try {
            const sRef = ref(storage, `users/${currentUserUid}/avatar_${Date.now()}`);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, "users", currentUserUid), { photoURL: url });
            document.getElementById('profile-avatar').src = url;
            showToast("Avatar aggiornato!");
        } catch (error) {
            console.error(error);
            showToast("Errore upload", "error");
        }
    };
}

// --- RENDERERS ---

function renderAddressesView() {
    const container = document.getElementById('indirizzi-view-container');
    if (!container) return;
    container.innerHTML = '';

    // Add Button
    const addBtn = document.createElement('button');
    addBtn.className = 'glass-card p-4 w-full flex-center gap-2 text-blue-400 hover:bg-white/5 transition-all mb-4';
    addBtn.innerHTML = `<span class="material-symbols-outlined">add_location_alt</span><span class="text-[10px] font-black uppercase">Aggiungi Indirizzo</span>`;
    addBtn.addEventListener('click', () => window.editAddress(-1));
    container.appendChild(addBtn);

    userAddresses.forEach((addr, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card p-5 animate-in slide-in-from-bottom-2 duration-300';
        card.innerHTML = `
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-4 min-w-0">
                    <div class="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-center shrink-0">
                        <span class="material-symbols-outlined filled">${addr.type === 'Lavoro' ? 'work' : 'home'}</span>
                    </div>
                    <div class="flex-col min-w-0">
                        <span class="text-[9px] font-black uppercase text-white/20 tracking-widest">${addr.type || 'Indirizzo'}</span>
                        <span class="text-xs font-bold text-white uppercase truncate">${addr.address} ${addr.civic}</span>
                        <span class="text-[10px] font-medium text-white/40 uppercase">${addr.cap} ${addr.city} (${addr.province})</span>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="size-8 rounded-lg bg-white/5 flex-center text-white/20 hover:text-white transition-all" data-action="edit-address" data-idx="${idx}">
                        <span class="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button class="size-8 rounded-lg bg-red-500/5 flex-center text-red-400/40 hover:text-red-400 transition-all" data-action="delete-address" data-idx="${idx}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
            
            <div id="utilities-list-${idx}" class="mt-4 pt-4 border-t border-white/5 flex-col gap-2">
                <!-- Utilities injected here -->
            </div>
            
            <button class="mt-3 w-full py-2 rounded-lg bg-white/5 text-[9px] font-black uppercase text-blue-400 tracking-widest hover:bg-white/10" data-action="add-utility" data-idx="${idx}">
                + Utenza
            </button>
        `;
        container.appendChild(card);
        renderUtilitiesInAddress(idx);
    });
}

function renderUtilitiesInAddress(idx) {
    const list = document.getElementById(`utilities-list-${idx}`);
    if (!list) return;
    const addr = userAddresses[idx];
    const utils = addr.utilities || [];

    if (utils.length === 0) {
        list.innerHTML = `<span class="text-[9px] font-black uppercase text-white/10 text-center block">Nessuna utenza</span>`;
        return;
    }

    list.innerHTML = utils.map((u, uIdx) => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="flex-col">
                <span class="text-[8px] font-black uppercase text-white/20">${u.type}</span>
                <span class="text-[10px] font-bold text-white/60 tracking-wider">${u.value}</span>
            </div>
            <div class="flex items-center gap-1">
                 <button class="size-6 text-white/20 hover:text-white" data-action="open-attachment-manager" data-idx="${uIdx}" data-type="utility" data-parent="${idx}">
                    <span class="material-symbols-outlined text-sm">attach_file</span>
                </button>
                <button class="size-6 text-white/20 hover:text-white" data-action="edit-utenza" data-idx="${idx}" data-uidx="${uIdx}">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button class="size-6 text-red-400/40 hover:text-red-400" data-action="delete-utenza" data-idx="${idx}" data-uidx="${uIdx}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

function renderPhonesView() {
    const container = document.getElementById('telefoni-view-container');
    if (!container) return;
    container.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'glass-card p-4 w-full flex-center gap-2 text-blue-400 hover:bg-white/5 transition-all mb-4';
    addBtn.innerHTML = `<span class="material-symbols-outlined">add_call</span><span class="text-[10px] font-black uppercase">Aggiungi Numero</span>`;
    addBtn.addEventListener('click', () => window.editPhone(-1));
    container.appendChild(addBtn);

    contactPhones.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card p-4 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-400';
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="size-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex-center shrink-0">
                    <span class="material-symbols-outlined filled">call</span>
                </div>
                <div class="flex-col">
                    <span class="text-[8px] font-black uppercase text-white/20 tracking-widest">${p.type}</span>
                    <span class="text-xs font-black text-white tracking-widest">${p.number}</span>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="size-8 rounded-lg bg-white/5 flex-center text-white/20 hover:text-white transition-all" data-action="edit-phone" data-idx="${idx}">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button class="size-8 rounded-lg bg-red-500/5 flex-center text-red-400/40 hover:text-red-400 transition-all" data-action="delete-phone" data-idx="${idx}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    container.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'glass-card p-4 w-full flex-center gap-2 text-blue-400 hover:bg-white/5 transition-all mb-4';
    addBtn.innerHTML = `<span class="material-symbols-outlined">alternate_email</span><span class="text-[10px] font-black uppercase">Aggiungi Email</span>`;
    addBtn.addEventListener('click', () => window.editEmail(-1));
    container.appendChild(addBtn);

    contactEmails.forEach((e, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card p-4 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-500';
        card.innerHTML = `
            <div class="flex items-center gap-4 min-w-0">
                <div class="size-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex-center shrink-0">
                    <span class="material-symbols-outlined filled">mail</span>
                </div>
                <div class="flex-col min-w-0">
                    <span class="text-[8px] font-black uppercase text-white/20 tracking-widest">Account</span>
                    <span class="text-xs font-bold text-white truncate">${e.address}</span>
                    <span class="text-[10px] font-medium text-white/40 tracking-widest">${e.password ? '••••••••' : 'Nessuna PWD'}</span>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="size-8 rounded-lg bg-white/5 flex-center text-white/20 hover:text-white transition-all" data-action="edit-email" data-idx="${idx}">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button class="size-8 rounded-lg bg-red-500/5 flex-center text-red-400/40 hover:text-red-400 transition-all" data-action="delete-contact-email" data-idx="${idx}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    container.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'glass-card p-4 w-full flex-center gap-2 text-blue-400 hover:bg-white/5 transition-all mb-4';
    addBtn.innerHTML = `<span class="material-symbols-outlined">add_card</span><span class="text-[10px] font-black uppercase">Aggiungi Documento</span>`;
    addBtn.addEventListener('click', () => window.editUserDocument(-1));
    container.appendChild(addBtn);

    userDocuments.forEach((docItem, idx) => {
        const num = docItem.num_serie || docItem.id_number || docItem.cf || '-';
        const card = document.createElement('div');
        card.className = 'glass-card p-4 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-600';
        card.innerHTML = `
            <div class="flex items-center gap-4 min-w-0">
                <div class="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex-center shrink-0">
                    <span class="material-symbols-outlined filled">description</span>
                </div>
                <div class="flex-col min-w-0">
                    <span class="text-[8px] font-black uppercase text-white/20 tracking-widest">${docItem.type}</span>
                    <span class="text-xs font-black text-white tracking-widest truncate uppercase">${num}</span>
                    <span class="text-[10px] font-medium text-white/40 uppercase">${docItem.expiry_date ? 'Scadenza: ' + formatDateToIT(docItem.expiry_date) : ''}</span>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="size-8 rounded-lg bg-white/5 flex-center text-white/20 hover:text-white transition-all" data-action="open-attachment-manager" data-idx="${idx}" data-type="document">
                    <span class="material-symbols-outlined text-sm">attach_file</span>
                </button>
                <button class="size-8 rounded-lg bg-white/5 flex-center text-white/20 hover:text-white transition-all" data-action="edit-user-document" data-idx="${idx}">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button class="size-8 rounded-lg bg-red-500/5 flex-center text-red-400/40 hover:text-red-400 transition-all" data-action="delete-user-document" data-idx="${idx}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- ACTIONS ---

window.editSection = async (section) => {
    if (section === 'dati-personali') {
        const res = await window.showFormModal("Modifica Anagrafica", [
            { id: 'nome', label: 'Nome', value: currentUserData.nome || "", type: 'text' },
            { id: 'cognome', label: 'Cognome', value: currentUserData.cognome || "", type: 'text' },
            { id: 'cf', label: 'Codice Fiscale', value: currentUserData.cf || "", type: 'text', transform: 'uppercase' },
            { id: 'nascita', label: 'Data Nascita', value: currentUserData.birth_date || "", type: 'date' },
            { id: 'luogo', label: 'Luogo Nascita', value: currentUserData.birth_place || "", type: 'text' },
            { id: 'prov', label: 'Prov. Nascita', value: currentUserData.birth_province || "", type: 'text', transform: 'uppercase', maxLength: 2 }
        ]);
        if (res) {
            await updateDoc(doc(db, "users", currentUserUid), {
                nome: res.nome.trim(),
                cognome: res.cognome.trim(),
                cf: res.cf.trim().toUpperCase(),
                birth_date: res.nascita,
                birth_place: res.luogo.trim(),
                birth_province: res.prov.trim().toUpperCase()
            });
            window.location.reload();
        }
    } else if (section === 'note') {
        const res = await window.showFormModal("Note Anagrafica", [
            { id: 'note', label: 'Contenuto Note', value: currentUserData.note || "", type: 'textarea' }
        ]);
        if (res) {
            await updateDoc(doc(db, "users", currentUserUid), { note: res.note.trim() });
            window.location.reload();
        }
    }
};

window.editAddress = async (idx) => {
    const a = idx === -1 ? {} : userAddresses[idx];
    const res = await window.showFormModal(idx === -1 ? "Nuovo Indirizzo" : "Modifica Indirizzo", [
        { id: 'type', label: 'Tipo', value: a.type || 'Residenza', type: 'select', options: ['Residenza', 'Domicilio', 'Lavoro', 'Altro'] },
        { id: 'address', label: 'Indirizzo', value: a.address || '', type: 'text' },
        { id: 'civic', label: 'Civico', value: a.civic || '', type: 'text' },
        { id: 'cap', label: 'CAP', value: a.cap || '', type: 'text' },
        { id: 'city', label: 'Città', value: a.city || '', type: 'text' },
        { id: 'prov', label: 'Provincia', value: a.province || '', type: 'text', transform: 'uppercase', maxLength: 2 }
    ]);
    if (res) {
        const data = {
            type: res.type,
            address: res.address.trim(),
            civic: res.civic.trim(),
            cap: res.cap.trim(),
            city: res.city.trim(),
            province: res.prov.trim().toUpperCase(),
            utilities: a.utilities || []
        };
        if (idx === -1) userAddresses.push(data);
        else userAddresses[idx] = data;
        await saveAddresses();
    }
};

window.deleteAddress = async (idx) => {
    const ok = await showConfirmModal("ELIMINA", "Eliminare definitivamente questo indirizzo?", "Elimina", true);
    if (!ok) return;
    userAddresses.splice(idx, 1);
    await saveAddresses();
};

async function saveAddresses() {
    await updateDoc(doc(db, "users", currentUserUid), { userAddresses });
    window.location.reload();
}

window.addUtility = async (addrIdx) => {
    const res = await window.showFormModal("Nuova Utenza", [
        { id: 'type', label: 'Gestore / Tipo', value: '', type: 'text' },
        { id: 'val', label: 'Codice / Valore', value: '', type: 'text' }
    ]);
    if (res) {
        if (!userAddresses[addrIdx].utilities) userAddresses[addrIdx].utilities = [];
        userAddresses[addrIdx].utilities.push({ type: res.type.trim(), value: res.val.trim(), attachments: [] });
        await saveAddresses();
    }
};

window.editUtenza = async (addrIdx, uIdx) => {
    const u = userAddresses[addrIdx].utilities[uIdx];
    const res = await window.showFormModal("Modifica Utenza", [
        { id: 'type', label: 'Gestore / Tipo', value: u.type, type: 'text' },
        { id: 'val', label: 'Codice / Valore', value: u.value, type: 'text' }
    ]);
    if (res) {
        userAddresses[addrIdx].utilities[uIdx].type = res.type.trim();
        userAddresses[addrIdx].utilities[uIdx].value = res.val.trim();
        await saveAddresses();
    }
};

window.deleteUtenza = async (addrIdx, uIdx) => {
    const ok = await showConfirmModal("ELIMINA", "Eliminare questa utenza?", "Elimina", true);
    if (!ok) return;
    userAddresses[addrIdx].utilities.splice(uIdx, 1);
    await saveAddresses();
};

window.editPhone = async (idx) => {
    const p = idx === -1 ? {} : contactPhones[idx];
    const res = await window.showFormModal("Gestione Telefono", [
        { id: 'type', label: 'Tipo', value: p.type || 'Cellulare', type: 'select', options: ['Cellulare', 'Fisso', 'Lavoro', 'Altro'] },
        { id: 'num', label: 'Numero', value: p.number || '', type: 'tel' }
    ]);
    if (res) {
        const data = { type: res.type, number: res.num.trim() };
        if (idx === -1) contactPhones.push(data);
        else contactPhones[idx] = data;
        await updateDoc(doc(db, "users", currentUserUid), { contactPhones });
        window.location.reload();
    }
};

window.deletePhone = async (idx) => {
    const ok = await showConfirmModal("ELIMINA", "Eliminare questo numero?", "Elimina", true);
    if (!ok) return;
    contactPhones.splice(idx, 1);
    await updateDoc(doc(db, "users", currentUserUid), { contactPhones });
    window.location.reload();
};

window.editEmail = async (idx) => {
    const e = idx === -1 ? {} : contactEmails[idx];
    const res = await window.showFormModal("Gestione Email", [
        { id: 'addr', label: 'Indirizzo Email', value: e.address || '', type: 'email' },
        { id: 'pwd', label: 'Password (opzionale)', value: e.password || '', type: 'text' }
    ]);
    if (res) {
        const data = { address: res.addr.trim(), password: res.pwd.trim(), attachments: e.attachments || [] };
        if (idx === -1) contactEmails.push(data);
        else contactEmails[idx] = data;
        await updateDoc(doc(db, "users", currentUserUid), { contactEmails });
        window.location.reload();
    }
};

window.deleteContactEmail = async (idx) => {
    const ok = await showConfirmModal("ELIMINA", "Eliminare questo account email?", "Elimina", true);
    if (!ok) return;
    contactEmails.splice(idx, 1);
    await updateDoc(doc(db, "users", currentUserUid), { contactEmails });
    window.location.reload();
};

window.editUserDocument = async (idx) => {
    const d = idx === -1 ? {} : userDocuments[idx];
    const res = await window.showFormModal("Gestione Documento", [
        { id: 'type', label: 'Tipo', value: d.type || 'Carta d\'Identità', type: 'select', options: ['Carta d\'Identità', 'Patente', 'Passaporto', 'Codice Fiscale', 'Tessera Sanitaria', 'Altro'] },
        { id: 'num', label: 'Numero / Serie', value: d.num_serie || d.id_number || d.cf || '', type: 'text' },
        { id: 'expiry', label: 'Scadenza', value: d.expiry_date || '', type: 'date' }
    ]);
    if (res) {
        const data = { type: res.type, num_serie: res.num.trim(), expiry_date: res.expiry, attachments: d.attachments || [] };
        if (idx === -1) userDocuments.push(data);
        else userDocuments[idx] = data;
        await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
        window.location.reload();
    }
};

window.deleteUserDocument = async (idx) => {
    const ok = await showConfirmModal("ELIMINA", "Eliminare definitivamente questo documento?", "Elimina", true);
    if (!ok) return;
    userDocuments.splice(idx, 1);
    await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
    window.location.reload();
};

// --- ATTACHMENTS ---
let currentManagerType = null;
let currentManagerIdx = null;
let currentManagerParentIdx = null;

window.openAttachmentManager = (idx, type, parentIdx = null) => {
    currentManagerIdx = idx;
    currentManagerType = type;
    currentManagerParentIdx = parentIdx;

    let item;
    if (type === 'document') item = userDocuments[idx];
    else if (type === 'utility') item = userAddresses[parentIdx].utilities[idx];

    if (!item) return;

    const atts = item.attachments || [];
    const html = `
        <div class="flex-col-gap-3 mb-6">
            ${atts.length === 0 ? '<span class="text-[10px] text-white/20 text-center block py-4">NESSUN ALLEGATO</span>' :
            atts.map((a, i) => `
                <div class="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                    <span class="text-xs text-white/60 truncate max-w-[150px]">${a.name}</span>
                    <div class="flex gap-2">
                        <a href="${a.url}" target="_blank" class="size-8 flex-center text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"><span class="material-symbols-outlined text-sm">visibility</span></a>
                        <button data-action="remove-attachment" data-idx="${i}" class="size-8 flex-center text-red-400 hover:bg-red-400/10 rounded-lg transition-all"><span class="material-symbols-outlined text-sm">delete</span></button>
                    </div>
                </div>
              `).join('')}
        </div>
        <div class="flex gap-2">
            <button class="base-btn-secondary flex-1 py-3" data-action="trigger-upload">CARICA FILE</button>
            <input type="file" id="manager-upload" class="hidden" onchange="window.handleAttachmentUpload(this)">
        </div>
    `;

    // Using a simplified modal for attachments since ui-core.js might not support custom HTML easily in confirm modal
    // But we can use showFormModal structure if we adapt it.
    // For now, let's use a simpler custom modal injected via JS.
    injectAttachmentModal(html);
};

// --- DELEGATION ---
function setupDelegation() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const idx = parseInt(target.dataset.idx);
        const uIdx = parseInt(target.dataset.uidx);

        switch (action) {
            case 'edit-address': window.editAddress(idx); break;
            case 'delete-address': window.deleteAddress(idx); break;
            case 'add-utility': window.addUtility(idx); break;
            case 'edit-utenza': window.editUtenza(idx, uIdx); break;
            case 'delete-utenza': window.deleteUtenza(idx, uIdx); break;
            case 'edit-phone': window.editPhone(idx); break;
            case 'delete-phone': window.deletePhone(idx); break;
            case 'edit-email': window.editEmail(idx); break;
            case 'delete-contact-email': window.deleteContactEmail(idx); break;
            case 'edit-user-document': window.editUserDocument(idx); break;
            case 'delete-user-document': window.deleteUserDocument(idx); break;
            case 'open-attachment-manager':
                const type = target.dataset.type;
                const parent = target.dataset.parent ? parseInt(target.dataset.parent) : null;
                window.openAttachmentManager(idx, type, parent);
                break;
            case 'remove-attachment': window.removeAttachment(idx); break;
            case 'trigger-upload':
                const upload = document.getElementById('manager-upload');
                if (upload) upload.click();
                break;
        }
    });
}

function injectAttachmentModal(content) {
    const modal = document.createElement('div');
    modal.className = 'base-modal-overlay';
    modal.id = 'attachment-manager-modal';
    modal.innerHTML = `
        <div class="glass-card p-6 w-[90%] max-w-[400px] animate-in zoom-in-95 duration-300">
            <h3 class="text-sm font-black uppercase text-white mb-6">Gestione Allegati</h3>
            ${content}
            <button class="base-btn-primary w-full mt-6 py-3" onclick="document.getElementById('attachment-manager-modal').remove()">CHIUDI</button>
        </div>
    `;
    document.body.appendChild(modal);
}

window.handleAttachmentUpload = async (input) => {
    const file = input.files[0];
    if (!file) return;

    showToast("Caricamento...", "info");
    try {
        const path = `users/${currentUserUid}/attachments/${Date.now()}_${file.name}`;
        const sRef = ref(storage, path);
        const snap = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snap.ref);

        let target;
        if (currentManagerType === 'document') target = userDocuments[currentManagerIdx];
        else if (currentManagerType === 'utility') target = userAddresses[currentManagerParentIdx].utilities[currentManagerIdx];

        if (!target.attachments) target.attachments = [];
        target.attachments.push({ name: file.name, url, path });

        await syncData();
        document.getElementById('attachment-manager-modal')?.remove();
        showToast("Allegato salvato!");
    } catch (e) {
        console.error(e);
        showToast("Errore upload", "error");
    }
};

window.removeAttachment = async (idx) => {
    let target;
    if (currentManagerType === 'document') target = userDocuments[currentManagerIdx];
    else if (currentManagerType === 'utility') target = userAddresses[currentManagerParentIdx].utilities[currentManagerIdx];

    const att = target.attachments[idx];
    if (att.path) {
        try { await deleteObject(ref(storage, att.path)); } catch (e) { console.warn(e); }
    }
    target.attachments.splice(idx, 1);
    await syncData();
    document.getElementById('attachment-manager-modal')?.remove();
    showToast("Allegato rimosso");
};

async function syncData() {
    await updateDoc(doc(db, "users", currentUserUid), {
        documenti: userDocuments,
        userAddresses: userAddresses,
        contactPhones: contactPhones,
        contactEmails: contactEmails
    });
}

// --- SHARED FORM MODAL (Titanium V3.6) ---
window.showFormModal = (title, fields) => {
    return new Promise((res) => {
        const modal = document.createElement('div');
        modal.className = 'base-modal-overlay';
        modal.innerHTML = `
            <div class="glass-card p-6 w-[95%] max-w-[450px] animate-in zoom-in-95 duration-300">
                <h3 class="text-sm font-black uppercase text-white mb-6 tracking-widest">${title}</h3>
                <div class="flex-col-gap-4 max-h-[60vh] overflow-y-auto px-1">
                    ${fields.map(f => `
                        <div class="titanium-input-group">
                            <span class="material-symbols-outlined text-white/20">${getIconForLabel(f.label)}</span>
                            ${f.type === 'textarea' ?
                `<textarea id="fm-${f.id}" class="w-full bg-transparent border-none text-white text-xs outline-none p-2 min-h-[80px]" placeholder="${f.label}">${f.value}</textarea>` :
                f.type === 'select' ?
                    `<select id="fm-${f.id}" class="w-full bg-transparent border-none text-white text-xs outline-none cursor-pointer">
                                    ${f.options.map(o => `<option value="${o}" ${o === f.value ? 'selected' : ''}>${o}</option>`).join('')}
                                </select>` :
                    `<input id="fm-${f.id}" type="${f.type}" value="${f.value}" class="w-full bg-transparent border-none text-white text-xs outline-none" style="${f.transform === 'uppercase' ? 'text-transform:uppercase' : ''}" placeholder="${f.label}" />`
            }
                        </div>
                    `).join('')}
                </div>
                <div class="flex gap-3 mt-8">
                    <button class="base-btn-secondary flex-1 py-3 text-[10px]" id="fm-cancel">ANNULLA</button>
                    <button class="base-btn-primary flex-1 py-3 text-[10px]" id="fm-confirm">SALVA</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        function handleModalCancel() {
            modal.remove();
            res(null);
        }

        function handleModalConfirm() {
            const data = {};
            fields.forEach(f => { data[f.id] = document.getElementById(`fm-${f.id}`).value; });
            modal.remove();
            res(data);
        }

        modal.querySelector('#fm-cancel').addEventListener('click', handleModalCancel);
        modal.querySelector('#fm-confirm').addEventListener('click', handleModalConfirm);
    });
};

function getIconForLabel(label) {
    const l = label.toLowerCase();
    if (l.includes('nome')) return 'person';
    if (l.includes('cognome')) return 'person';
    if (l.includes('codice')) return 'fingerprint';
    if (l.includes('data')) return 'calendar_month';
    if (l.includes('luogo') || l.includes('prov')) return 'location_on';
    if (l.includes('note')) return 'sticky_note_2';
    if (l.includes('indirizzo') || l.includes('via')) return 'home';
    if (l.includes('città') || l.includes('cap')) return 'map';
    if (l.includes('tipo')) return 'category';
    if (l.includes('numero')) return 'numbers';
    if (l.includes('email')) return 'alternate_email';
    if (l.includes('pass')) return 'key';
    return 'edit';
}
