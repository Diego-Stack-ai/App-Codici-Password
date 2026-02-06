
import { auth, db, storage } from './firebase-config.js';
import { getContacts, addContact } from './db.js';
import {
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    setDoc,
    collection,
    addDoc,
    deleteDoc,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { logError } from './utils.js';

// --- DOM Elements ---
const avatarInput = document.getElementById('avatar-input');
const avatarImg = document.getElementById('user-avatar');
const loadingOverlay = document.getElementById('avatar-loading');
const userNameEl = document.getElementById('user-name');

const viewElements = document.querySelectorAll('[id$="-view"]');
const editElements = document.querySelectorAll('[id$="-edit"]');
const realEditButton = document.getElementById('action-edit-btn');
const realCancelButton = document.getElementById('action-cancel-btn');
const realSaveButton = document.getElementById('action-save-btn');
const qrContainer = document.getElementById('qrcode-container');
const fullContainer = document.getElementById('full-profile-container');
const addEmailBtn = document.getElementById('add-email-btn');
const addUtenzaBtn = document.getElementById('add-utenza-btn');
const addDocumentoBtn = document.getElementById('add-documento-btn');
const fileInputPrivate = document.getElementById('file-input-private');

// --- Global State ---
let qrConfig = {
    nome: true, cognome: true, cf: true, birth_date: true, birth_place: true, birth_province: true, birth_cap: true,
    residence_address: true, residence_civic: true, residence_city: true, residence_province: true, residence_cap: true,
    mobile_private: true, phone_private: true, notes: true
};
let contactEmails = [];
let userUtilities = [];
let userDocuments = [];
let existingAttachments = [];
let selectedFiles = [];
let isUploading = false;
let isExpanded = false;

const fieldMap = [
    'nome', 'cognome', 'cf', 'birth_date', 'birth_place', 'birth_province', 'birth_cap',
    'residence_address', 'residence_civic', 'residence_city', 'residence_province', 'residence_cap',
    'mobile_private', 'phone_private', 'note'
];

// --- HELPERS ---
function formatDateToIT(val) {
    if (!val || val === '-') return '-';
    // If it's already in gg/mm/aaaa format, return it
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val;

    try {
        // If it's YYYY-MM-DD (classic from input date)
        if (typeof val === 'string' && val.includes('-')) {
            const parts = val.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
                return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }

        const date = new Date(val);
        if (isNaN(date.getTime())) return val;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        logError("Date Formatter", e);
        return val;
    }
}

// --- UI TOAST ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');

    // Create toast if not exists (handling if main.js didn't create it or similar)
    if (!toast && window.showToast) {
        window.showToast(message, type);
        return;
    }

    if (!toast) return;

    msgEl.textContent = message;

    // Reset classes
    iconEl.className = "material-symbols-outlined text-xl";

    if (type === 'error') {
        iconEl.textContent = 'error';
        iconEl.classList.add('text-red-400');
    } else {
        iconEl.textContent = 'check_circle';
        iconEl.classList.add('text-green-400');
    }

    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

// --- EMAIL UI FUNCTIONS ---
function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    container.innerHTML = '';

    const visibleEmails = contactEmails.filter(e => e.visible);

    if (visibleEmails.length === 0) {
        container.innerHTML = `
                <div class="flex items-center gap-2 text-cyan-400/60 italic text-sm">
                    <span class="material-symbols-outlined text-lg">visibility_off</span>
                    <span>Nessuna email visibile</span>
                </div>`;
    } else {
        visibleEmails.forEach(e => {
            const div = document.createElement('div');
            div.className = "bg-cyan-500/5 border border-white/5 p-5 rounded-2xl shadow-sm flex flex-col gap-2 group mb-3 last:mb-0 relative overflow-hidden";

            let passwordHtml = '';
            if (e.password) {
                passwordHtml = `
                    <div class="mt-2 flex flex-col gap-1.5">
                        <label class="view-label text-cyan-400">Password</label>
                        <div class="glass-field glass-field-cyan group/field">
                            <span class="text-sm font-mono tracking-wider password-text flex-1">********</span>
                            <div class="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                                <button class="text-cyan-400 p-1 hover:bg-cyan-500/10 rounded-lg transition-colors visibility-toggle" 
                                    data-action="toggle-text-mask" data-secret="${e.password.replace(/'/g, "\\'")}">
                                    <span class="material-symbols-outlined text-lg">visibility_off</span>
                                </button>
                                <button class="copy-button text-gray-400 hover:text-white p-1 rounded-lg transition-colors" 
                                    data-action="copy-text" data-text="${e.password.replace(/'/g, "\\'")}">
                                    <span class="material-symbols-outlined text-lg">content_copy</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            let notesHtml = '';
            if (e.notes) {
                notesHtml = `
                    <div class="mt-2 pt-2 border-t border-white/10">
                        <p class="view-label text-cyan-400">Note Email</p>
                        <p class="selectable text-xs text-white/70 leading-tight pl-1">${e.notes.replace(/\n/g, '<br>')}</p>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="flex flex-col gap-1.5 mb-2">
                    <label class="view-label text-cyan-400">Indirizzo Email</label>
                    <div class="glass-field glass-field-cyan group/field">
                         <p class="text-sm font-medium break-all flex-1">${e.address}</p>
                         <div class="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                             <button class="text-cyan-400 p-1 hover:bg-cyan-500/10 rounded-lg transition-colors" data-action="navigate" data-href="mailto:${e.address}">
                                <span class="material-symbols-outlined text-lg">mail</span>
                             </button>
                             <button class="copy-button text-gray-400 hover:text-white p-1 rounded-lg transition-colors" data-action="copy-text" data-text="${e.address.replace(/'/g, "\\'")}">
                                <span class="material-symbols-outlined text-lg">content_copy</span>
                             </button>
                         </div>
                    </div>
                </div>
                ${passwordHtml}
                ${notesHtml}
            `;
            container.appendChild(div);
        });
    }
}

function renderEmailsEdit() {
    const container = document.getElementById('email-edit-container');
    if (!container) return;
    container.innerHTML = '';

    contactEmails.forEach((e, index) => {
        const row = document.createElement('div');
        row.className = "flex flex-col gap-3 bg-cyan-500/5 border border-white/5 p-5 rounded-2xl relative mb-4 last:mb-0";
        row.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="flex-1 flex items-center gap-2 bg-black/20  rounded-lg px-3 h-10 border border-white/5">
                        <span class="material-symbols-outlined text-[#CBD5E1] text-sm">mail</span>
                        <input type="email" value="${e.address || ''}" data-index="${index}"
                            class="email-input-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0" placeholder="Indirizzo email">
                    </div>
                    
                    <div class="flex items-center gap-1">
                         <!-- Visible Flag -->
                         <label class="flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-gray-100  rounded-full transition-colors" title="Mostra nel Profilo">
                             <input type="checkbox" class="email-vis-flag hidden" 
                                data-index="${index}" ${e.visible ? 'checked' : ''}>
                             <span class="material-symbols-outlined text-xl ${e.visible ? 'text-primary' : 'text-gray-300'}">${e.visible ? 'visibility' : 'visibility_off'}</span>
                         </label>

                         <!-- Delete -->
                         <button class="text-gray-300 hover:text-red-500 w-8 h-8 flex items-center justify-center transition-colors" data-action="delete-email" data-index="${index}">
                             <span class="material-symbols-outlined text-xl">delete</span>
                         </button>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <div class="flex-1 flex items-center gap-2 bg-black/20  rounded-lg px-3 h-10 border border-white/5">
                        <span class="material-symbols-outlined text-[#CBD5E1] text-sm">key</span>
                        <input type="password" value="${e.password || ''}" data-index="${index}"
                            class="email-pass-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0" placeholder="Password (opzionale)">
                        <button type="button" class="text-[#CBD5E1] hover:text-primary transition-colors" data-action="toggle-visibility">
                            <span class="material-symbols-outlined text-lg">visibility_off</span>
                        </button>
                    </div>
                    
                    <div class="flex items-center shrink-0">
                         <!-- QR Flag -->
                         <label class="flex items-center gap-1 cursor-pointer hover:bg-gray-100  px-2 py-1 rounded-md transition-colors" title="Includi nel QR">
                             <input type="checkbox" class="email-qr-flag form-checkbox w-3.5 h-3.5 text-primary rounded border-gray-300 focus:ring-0" 
                                data-index="${index}" ${e.qr ? 'checked' : ''}>
                             <span class="text-[10px] font-bold text-gray-500 uppercase">QR</span>
                         </label>
                    </div>
                </div>

                <div class="bg-black/20  rounded-lg border border-white/5  p-2">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="material-symbols-outlined text-slate-500 text-sm">sticky_note_2</span>
                        <span class="text-[10px] font-bold text-[#CBD5E1] uppercase">Note</span>
                    </div>
                    <textarea data-index="${index}"
                        class="email-notes-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-xs focus:ring-0 text-slate-800  placeholder:text-slate-400" 
                        rows="2" placeholder="Note specifiche per questa email...">${e.notes || ''}</textarea>
                </div>
            `;
        container.appendChild(row);
    });

    // Attach listeners
    container.querySelectorAll('.email-input-real').forEach(input => {
        input.addEventListener('input', (ev) => {
            contactEmails[ev.target.dataset.index].address = ev.target.value.trim();
        });
    });
    container.querySelectorAll('.email-pass-real').forEach(input => {
        input.addEventListener('input', (ev) => {
            contactEmails[ev.target.dataset.index].password = ev.target.value.trim();
        });
    });
    container.querySelectorAll('.email-notes-real').forEach(input => {
        input.addEventListener('input', (ev) => {
            contactEmails[ev.target.dataset.index].notes = ev.target.value.trim();
        });
    });
    container.querySelectorAll('.email-qr-flag').forEach(chk => {
        chk.addEventListener('change', (ev) => {
            contactEmails[ev.target.dataset.index].qr = ev.target.checked;
            updateQRCode(); // Live update QR
        });
    });
    container.querySelectorAll('.email-vis-flag').forEach(chk => {
        chk.addEventListener('change', (ev) => {
            contactEmails[ev.target.dataset.index].visible = ev.target.checked;
        });
    });
    container.querySelectorAll('button[data-action="delete-email"]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const index = parseInt(ev.currentTarget.dataset.index);
            deleteEmail(index);
        });
    });
}

function deleteEmail(index) {
    if (confirm("Eliminare questa email?")) {
        contactEmails.splice(index, 1);
        renderEmailsEdit();
        renderEmailsView();
        updateQRCode();
    }
}

if (addEmailBtn) {
    addEmailBtn.addEventListener('click', () => {
        contactEmails.push({ address: "", qr: false, visible: true });
        renderEmailsEdit();
    });
}

// --- UTENZE UI FUNCTIONS ---
function getUtenzaIcon(type) {
    const map = {
        'Codice POD': { icon: 'bolt', color: 'text-amber-500', bg: 'bg-amber-50' },
        'Seriale Contatore Metano': { icon: 'local_fire_department', color: 'text-orange-600', bg: 'bg-orange-50' },
        'Seriale Contatore Acqua': { icon: 'water_drop', color: 'text-blue-500', bg: 'bg-blue-50' }
    };
    return map[type] || { icon: 'tag', color: 'text-[#CBD5E1]', bg: 'bg-black/20' };
}

function renderUtenzeView() {
    const container = document.getElementById('utenze-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (userUtilities.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-4 text-center">
                <p class="text-sm text-[#CBD5E1] italic">Nessuna utenza registrata</p>
            </div>`;
        return;
    }

    userUtilities.forEach((u, index) => {
        const div = document.createElement('div');
        div.className = "bg-amber-500/5 p-5 rounded-2xl border border-white/5 shadow-sm flex flex-col gap-1 group relative overflow-hidden";

        const style = getUtenzaIcon(u.type);

        let notesHtml = '';
        if (u.notes) {
            notesHtml = `
                    <div class="mt-2 pt-2 border-t border-white/10">
                        <p class="view-label text-amber-500">Note</p>
                        <p class="text-xs text-white/70 leading-tight pl-1">${u.notes.replace(/\n/g, '<br>')}</p>
                    </div>
                `;
        }

        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 ${style.bg} ${style.color} rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-base">${style.icon}</span>
                    </div>
                    <label class="view-label text-amber-500">${u.type || 'Utenza'}</label>
                </div>
            </div>
            <div class="glass-field glass-field-amber group/field mt-1">
                <p class="text-sm font-bold text-white truncate flex-1 min-h-[1.25rem]">${u.value || '-'}</p>
                <button class="copy-button text-amber-500 opacity-0 group-hover/field:opacity-100 transition-opacity" data-action="copy-text" data-text="${(u.value || '').replace(/'/g, "\\'")}">
                    <span class="material-symbols-outlined text-lg">content_copy</span>
                </button>
            </div>
            ${notesHtml}
        `;
        container.appendChild(div);
    });
}

function renderUtenzeEdit() {
    const container = document.getElementById('utenze-edit-container');
    if (!container) return;
    container.innerHTML = '';

    userUtilities.forEach((u, index) => {
        const row = document.createElement('div');
        row.className = "flex flex-col gap-3 bg-amber-500/5 border border-white/5 p-5 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 relative mb-4";

        const style = getUtenzaIcon(u.type);

        row.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <div class="flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5">
                    <span class="material-symbols-outlined ${style.color} text-sm">${style.icon}</span>
                    <select class="utenza-type-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0 font-bold" data-index="${index}">
                        <option value="" disabled ${!u.type ? 'selected' : ''}>Tipo utenza...</option>
                        <option value="Codice POD" ${u.type === 'Codice POD' ? 'selected' : ''}>Codice POD (Luce)</option>
                        <option value="Seriale Contatore Metano" ${u.type === 'Seriale Contatore Metano' ? 'selected' : ''}>Metano (Gas)</option>
                        <option value="Seriale Contatore Acqua" ${u.type === 'Seriale Contatore Acqua' ? 'selected' : ''}>Acqua</option>
                    </select>
                </div>
                <button class="text-gray-300 hover:text-red-500 w-8 h-8 flex items-center justify-center transition-colors" data-action="delete-utenza" data-index="${index}">
                    <span class="material-symbols-outlined text-xl">delete</span>
                </button>
            </div>

            <div class="flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5">
                <span class="material-symbols-outlined text-[#CBD5E1] text-sm">tag</span>
                <input type="text" value="${u.value || ''}" data-index="${index}"
                    class="utenza-value-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0 font-mono" placeholder="Valore/Codice">
            </div>

            <div class="bg-black/20 rounded-lg border border-white/5 p-2">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-slate-500 text-sm">sticky_note_2</span>
                    <span class="text-[10px] font-bold text-[#CBD5E1] uppercase">Note Utenza</span>
                </div>
                <textarea data-index="${index}"
                    class="utenza-notes-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-xs focus:ring-0 text-slate-800 placeholder:text-slate-400" 
                    rows="2" placeholder="Note specifiche...">${u.notes || ''}</textarea>
            </div>
        `;
        container.appendChild(row);
    });

    // Attach listeners
    container.querySelectorAll('.utenza-type-real').forEach(sel => {
        sel.addEventListener('change', (ev) => {
            userUtilities[ev.target.dataset.index].type = ev.target.value;
        });
    });
    container.querySelectorAll('.utenza-value-real').forEach(inp => {
        inp.addEventListener('input', (ev) => {
            userUtilities[ev.target.dataset.index].value = ev.target.value.trim();
        });
    });
    container.querySelectorAll('.utenza-notes-real').forEach(tx => {
        tx.addEventListener('input', (ev) => {
            userUtilities[ev.target.dataset.index].notes = ev.target.value.trim();
        });
    });
    container.querySelectorAll('button[data-action="delete-utenza"]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const index = parseInt(ev.currentTarget.dataset.index);
            if (confirm("Eliminare questa utenza?")) {
                userUtilities.splice(index, 1);
                renderUtenzeEdit();
            }
        });
    });
}

if (addUtenzaBtn) {
    addUtenzaBtn.addEventListener('click', () => {
        userUtilities.push({ type: "", value: "", notes: "" });
        renderUtenzeEdit();
    });
}

// --- DOCUMENTI UI FUNCTIONS ---
function getDocumentIcon(type) {
    const map = {
        'Passaporto': { icon: 'pnp_only', color: 'text-blue-700', bg: 'bg-blue-50' },
        'Carta Identità': { icon: 'badge', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        'Patente': { icon: 'directions_car', color: 'text-green-600', bg: 'bg-green-50' },
        'Codice fiscale': { icon: 'credit_card', color: 'text-red-500', bg: 'bg-red-50' }
    };
    return map[type] || { icon: 'description', color: 'text-[#CBD5E1]', bg: 'bg-black/20' };
}

function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (userDocuments.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-4 text-center">
                <p class="text-sm text-[#CBD5E1] italic">Nessun documento registrato</p>
            </div>`;
        return;
    }

    userDocuments.forEach((doc, index) => {
        const div = document.createElement('div');
        div.className = "bg-violet-500/5 p-5 rounded-2xl border border-white/5 shadow-sm flex flex-col gap-2 group relative overflow-hidden";

        const style = getDocumentIcon(doc.type);

        // Build fields list based on type
        let fieldsHtml = '';
        const fields = getFieldsForDocType(doc.type);

        fields.forEach(f => {
            if (doc[f.key]) {
                const isFullWidth = f.key === 'homepage' || f.key === 'app_code' || f.key === 'emission_place';
                let val = doc[f.key];
                if (f.key.toLowerCase().includes('date')) {
                    val = formatDateToIT(val);
                }
                const safeVal = val.toString().replace(/'/g, "\\'");

                fieldsHtml += `
                    <div class="flex flex-col gap-1.5 ${isFullWidth ? 'col-span-2' : ''} mb-2">
                        <span class="text-[9px] text-violet-400 font-bold uppercase tracking-wider px-1">${f.label}</span>
                        <div class="glass-field glass-field-violet group/field">
                            <span class="text-sm font-semibold text-white break-all flex-1">${val}</span>
                            <button class="text-violet-400 opacity-0 group-hover/field:opacity-100 transition-opacity" 
                                data-action="copy-text" data-text="${safeVal}">
                                <span class="material-symbols-outlined text-[17px]">content_copy</span>
                            </button>
                        </div>
                    </div>
                `;
            }
        });

        let notesHtml = '';
        if (doc.notes) {
            notesHtml = `
                <div class="mt-2 pt-2 border-t border-white/10 col-span-2">
                    <p class="view-label text-violet-400">Note Documento</p>
                    <p class="text-xs text-white/70 leading-tight pl-1 italic">${doc.notes.replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 ${style.bg} ${style.color} rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-lg">${style.icon}</span>
                    </div>
                    <label class="view-label text-violet-400">${doc.type || 'Documento'}</label>
                </div>
                <a href="gestione_allegati.html?context=profile&docType=${encodeURIComponent(doc.type || '')}" 
                    class="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-slate-100 text-[#CBD5E1] rounded-lg transition-colors border border-white/5"
                    title="Vedi allegati per questo documento">
                    <span class="material-symbols-outlined text-sm">attach_file</span>
                    <span class="text-[10px] font-bold uppercase">Allegati</span>
                </a>
            </div>
            <div class="grid grid-cols-2 gap-x-2">
                ${fieldsHtml || '<p class="text-[10px] text-[#F1F5F9] italic pl-3 col-span-2">Dati non inseriti</p>'}
                ${notesHtml}
            </div>
        `;
        container.appendChild(div);
    });
}

function getFieldsForDocType(type) {
    if (type === 'Passaporto') return [
        { key: 'emission_date', label: 'Data emissione' },
        { key: 'emission_place', label: 'Luogo (Questura/Consolato)' },
        { key: 'registration_date', label: 'Data registrazione' },
        { key: 'num_serie', label: 'Numero di serie' },
        { key: 'country_code', label: 'Codice nazione' }
    ];
    if (type === 'Carta Identità') return [
        { key: 'id_number', label: 'Numero C.I.' },
        { key: 'issued_by', label: 'Emessa da' },
        { key: 'emission_date', label: 'Data emissione' },
        { key: 'expiry_date', label: 'Data scadenza' },
        { key: 'homepage', label: 'Home Page' },
        { key: 'username', label: 'Username' },
        { key: 'password', label: 'Password' },
        { key: 'pin', label: 'PIN' },
        { key: 'puk', label: 'PUK' },
        { key: 'app_code', label: 'Codice App' }
    ];
    if (type === 'Patente') return [
        { key: 'license_number', label: 'Numero Patente' },
        { key: 'issued_by', label: 'Emessa da' },
        { key: 'emission_date', label: 'Data emissione' },
        { key: 'expiry_date', label: 'Data scadenza' }
    ];
    if (type === 'Codice fiscale') return [
        { key: 'cf_value', label: 'Codice Fiscale' },
        { key: 'expiry_date', label: 'Data scadenza' }
    ];
    return [];
}

function renderDocumentiEdit() {
    const container = document.getElementById('documenti-edit-container');
    if (!container) return;
    container.innerHTML = '';

    userDocuments.forEach((doc, index) => {
        const row = document.createElement('div');
        row.className = "flex flex-col gap-3 bg-violet-500/5 border border-white/5 p-5 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 relative mb-4";

        const style = getDocumentIcon(doc.type);
        const fields = getFieldsForDocType(doc.type);

        let fieldsInputsHtml = '';
        fields.forEach(f => {
            const isFullWidth = f.key === 'homepage' || f.key === 'app_code' || f.key === 'emission_place';
            fieldsInputsHtml += `
                <div class="flex flex-col gap-1 ${isFullWidth ? 'col-span-2' : ''}">
                    <span class="text-[10px] text-[#CBD5E1] font-bold uppercase pl-1">${f.label}</span>
                    <div class="flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5">
                        <input type="${f.key.includes('date') ? 'date' : 'text'}" value="${doc[f.key] || ''}" 
                            class="doc-field-input w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0" 
                            data-index="${index}" data-key="${f.key}" placeholder="${f.label}...">
                    </div>
                </div>
            `;
        });

        row.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <div class="flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5">
                    <span class="material-symbols-outlined ${style.color} text-sm">${style.icon}</span>
                    <select class="documento-type-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0 font-bold" data-index="${index}">
                        <option value="" disabled ${!doc.type ? 'selected' : ''}>Tipo documento...</option>
                        <option value="Passaporto" ${doc.type === 'Passaporto' ? 'selected' : ''}>Passaporto</option>
                        <option value="Carta Identità" ${doc.type === 'Carta Identità' ? 'selected' : ''}>Carta Identità</option>
                        <option value="Patente" ${doc.type === 'Patente' ? 'selected' : ''}>Patente</option>
                        <option value="Codice fiscale" ${doc.type === 'Codice fiscale' ? 'selected' : ''}>Codice fiscale</option>
                    </select>
                </div>
                <div class="flex items-center gap-1">
                    <a href="gestione_allegati.html?context=profile&docType=${encodeURIComponent(doc.type || '')}" 
                        class="w-10 h-10 flex items-center justify-center bg-black/20 hover:bg-slate-100 text-[#CBD5E1] rounded-lg border border-white/5 transition-colors"
                        title="Gestisci allegati">
                        <span class="material-symbols-outlined">attach_file</span>
                    </a>
                    <button class="text-gray-300 hover:text-red-500 w-10 h-10 flex items-center justify-center transition-colors border border-white/5 rounded-lg" data-action="delete-documento" data-index="${index}">
                        <span class="material-symbols-outlined text-xl">delete</span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-x-3 gap-y-2">
                ${fieldsInputsHtml}
            </div>

            <div class="bg-black/20 rounded-lg border border-white/5 p-2 mt-2">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-slate-500 text-sm">sticky_note_2</span>
                    <span class="text-[10px] font-bold text-[#CBD5E1] uppercase">Note Documento</span>
                </div>
                <textarea data-index="${index}"
                    class="doc-notes-real w-full bg-transparent text-[#F1F5F9] border-none p-0 text-xs focus:ring-0 text-slate-800 placeholder:text-slate-400" 
                    rows="2" placeholder="Note aggiuntive per questo documento...">${doc.notes || ''}</textarea>
            </div>
        `;
        container.appendChild(row);
    });

    // Attach listeners
    container.querySelectorAll('.documento-type-real').forEach(sel => {
        sel.addEventListener('change', (ev) => {
            userDocuments[ev.target.dataset.index].type = ev.target.value;
            renderDocumentiEdit(); // Re-render to show correct fields
        });
    });
    container.querySelectorAll('.doc-field-input').forEach(inp => {
        inp.addEventListener('input', (ev) => {
            const idx = ev.target.dataset.index;
            const key = ev.target.dataset.key;
            userDocuments[idx][key] = ev.target.value;
        });
    });
    container.querySelectorAll('.doc-notes-real').forEach(tx => {
        tx.addEventListener('input', (ev) => {
            userDocuments[ev.target.dataset.index].notes = ev.target.value;
        });
    });
    container.querySelectorAll('button[data-action="delete-documento"]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const index = parseInt(ev.currentTarget.dataset.index);
            if (confirm("Eliminare questo documento?")) {
                userDocuments.splice(index, 1);
                renderDocumentiEdit();
            }
        });
    });
}

if (addDocumentoBtn) {
    addDocumentoBtn.addEventListener('click', () => {
        userDocuments.push({ type: "", notes: "" });
        renderDocumentiEdit();
    });
}

// --- HELPERS ---
window.copyResidence = function () {
    const fields = [
        { id: 'residence_address', label: 'Indirizzo' },
        { id: 'residence_civic', label: 'Civico' },
        { id: 'residence_city', label: 'Città' },
        { id: 'residence_province', label: 'Provincia' },
        { id: 'residence_cap', label: 'CAP' }
    ];

    let textToCopy = "Dati Residenza:\n";
    let hasData = false;

    fields.forEach(f => {
        let val = "";
        const editEl = document.getElementById(f.id + '-edit');
        if (editEl && !editEl.classList.contains('hidden')) {
            val = editEl.value;
        } else {
            const viewEl = document.getElementById(f.id + '-view');
            if (viewEl) val = viewEl.textContent;
        }

        if (val && val !== '-') {
            textToCopy += `${f.label}: ${val}\n`;
            hasData = true;
        }
    });

    if (hasData) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Dati residenza copiati!");
        });
    } else {
        showToast("Nessun dato da copiare", "error");
    }
}

window.copyPersonalData = function () {
    const fields = [
        { id: 'nome', label: 'Nome' },
        { id: 'cognome', label: 'Cognome' },
        { id: 'cf', label: 'Codice Fiscale' },
        { id: 'birth_date', label: 'Data di Nascita' },
        { id: 'birth_place', label: 'Luogo di Nascita' },
        { id: 'birth_province', label: 'Provincia' },
        { id: 'birth_cap', label: 'CAP' }
    ];

    let textToCopy = "Dati Personali:\n";
    let hasData = false;

    fields.forEach(f => {
        let val = "";
        const editEl = document.getElementById(f.id + '-edit');
        if (editEl && !editEl.classList.contains('hidden')) {
            val = editEl.value;
        } else {
            const viewEl = document.getElementById(f.id + '-view');
            if (viewEl) val = viewEl.textContent;
        }

        if (val && val !== '-') {
            // Apply formatting for dates if it's the raw value from edit input
            if (f.id.includes('date') && val.includes('-')) {
                val = formatDateToIT(val);
            }
            textToCopy += `${f.label}: ${val}\n`;
            hasData = true;
        }
    });

    if (hasData) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Dati personali copiati!");
        });
    } else {
        showToast("Nessun dato da copiare", "error");
    }
}

// Toggle removed as container is always visible now

// --- ATTACHMENTS ---
function renderAttachmentsView() {
    const container = document.getElementById('attachments-view-container');
    if (!container) return;
    container.innerHTML = '';

    const allFiles = [...existingAttachments];
    if (userDocuments) {
        userDocuments.forEach(doc => {
            if (doc.allegati && Array.isArray(doc.allegati)) {
                doc.allegati.forEach(a => {
                    allFiles.push({ ...a, source: doc.type });
                });
            }
        });
    }

    if (allFiles.length === 0) {
        container.innerHTML = '<p class="text-sm text-[#CBD5E1] italic py-2">Nessun allegato presente</p>';
        return;
    }

    allFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5";

        const extension = file.name.split('.').pop().toLowerCase();
        let icon = 'description';
        let iconColor = 'text-[#CBD5E1]';

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            icon = 'image';
            iconColor = 'text-blue-500';
        } else if (extension === 'pdf') {
            icon = 'picture_as_pdf';
            iconColor = 'text-red-500';
        }

        div.innerHTML = `
            <span class="material-symbols-outlined ${iconColor}">${icon}</span>
            <div class="flex flex-col min-w-0 flex-1">
                <a href="${file.url}" target="_blank" class="text-sm font-medium text-[#F1F5F9] hover:text-primary hover:underline truncate">${file.name}</a>
                ${file.source ? `<span class="text-[10px] text-[#CBD5E1] opacity-70">da ${file.source}</span>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

function renderAttachmentsEdit() {
    const container = document.getElementById('attachments-list-edit');
    if (!container) return;
    container.innerHTML = '';

    // 1. Existing Files
    existingAttachments.forEach((file, index) => {
        const item = createAttachmentItem(file.name, true, index);
        container.appendChild(item);
    });

    // 2. New Files
    selectedFiles.forEach((file, index) => {
        const item = createAttachmentItem(file.name, false, index);
        container.appendChild(item);
    });
}

function createAttachmentItem(name, isExisting, index) {
    const div = document.createElement('div');
    div.className = "flex items-center justify-between p-3 bg-white  rounded-xl border border-slate-400/20  animate-in fade-in slide-in-from-left-2 duration-300";

    const extension = name.split('.').pop().toLowerCase();
    let icon = 'description';
    let iconColor = 'text-[#CBD5E1]';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        icon = 'image';
        iconColor = 'text-blue-500';
    } else if (extension === 'pdf') {
        icon = 'picture_as_pdf';
        iconColor = 'text-red-500';
    }

    div.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
            <span class="material-symbols-outlined ${iconColor}">${icon}</span>
            <div class="flex flex-col min-w-0">
                <span class="text-xs font-bold text-slate-700  truncate">${name}</span>
                <span class="text-[10px] text-[#CBD5E1]">${isExisting ? 'Già caricato' : 'Nuovo file'}</span>
            </div>
        </div>
        <button type="button" class="remove-btn p-1 text-[#F1F5F9] hover:text-red-500 transition-colors" data-index="${index}" data-existing="${isExisting}">
            <span class="material-symbols-outlined text-sm">close</span>
        </button>
    `;

    div.querySelector('.remove-btn').onclick = (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const existing = e.currentTarget.dataset.existing === 'true';
        if (existing) {
            existingAttachments.splice(idx, 1);
        } else {
            selectedFiles.splice(idx, 1);
        }
        renderAttachmentsEdit();
    };
    return div;
}

// --- DIRECT UPLOAD STATE ---
let isDirectUpload = false;

if (document.getElementById('quick-add-attachment-btn')) {
    document.getElementById('quick-add-attachment-btn').addEventListener('click', () => {
        isDirectUpload = true;
        if (fileInputPrivate) fileInputPrivate.click();
    });
}

if (fileInputPrivate) {
    fileInputPrivate.addEventListener('change', async (e) => {
        if (!e.target.files || e.target.files.length === 0) {
            isDirectUpload = false; // Reset if cancelled
            return;
        }

        const files = Array.from(e.target.files);

        if (isDirectUpload) {
            // IMMEDIATE UPLOAD
            const user = auth.currentUser;
            if (!user) return;

            try {
                showToast("Caricamento allegato in corso...");
                const uploaded = [];
                for (const file of files) {
                    const fileRef = ref(storage, `users/${user.uid}/attachments/${Date.now()}_${file.name}`);
                    await uploadBytes(fileRef, file);
                    const url = await getDownloadURL(fileRef);
                    uploaded.push({ name: file.name, url, type: file.type });
                }

                existingAttachments = [...existingAttachments, ...uploaded];

                // Save to Firestore immediately
                await updateDoc(doc(db, "users", user.uid), {
                    allegati: existingAttachments
                });
                saveToCache({ allegati: existingAttachments });

                renderAttachmentsView(); // Update view
                showToast("Allegato aggiunto con successo!");
                const w = document.getElementById('allegati-wrapper');
                if (w && w.classList.contains('hidden')) {
                    if (window.toggleAllegati) window.toggleAllegati();
                    else w.classList.remove('hidden');
                }

            } catch (err) {
                console.error("Direct upload error:", err);
                showToast("Errore caricamento: " + err.message, "error");
            } finally {
                isDirectUpload = false;
                e.target.value = '';
            }

        } else {
            // EDIT MODE (PENDING)
            files.forEach(file => {
                selectedFiles.push(file);
            });
            renderAttachmentsEdit();
            e.target.value = '';
        }
    });
}

// --- EXPOSE QR FUNCTIONS TO WINDOW ---
window.openQRZoom = function () {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-90');
            modal.querySelector('div').classList.add('scale-100');
        }, 10);
    }
};

window.closeQRZoom = function () {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.remove('scale-100');
        modal.querySelector('div').classList.add('scale-90');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

// --- CACHE ---
function loadFromCache() {
    const cached = localStorage.getItem('userProfileCache');
    if (!cached) return;

    try {
        const data = JSON.parse(cached);
        window.LOG("Lettura cache...");

        if (data.photoURL && avatarImg) avatarImg.src = data.photoURL;
        if (data.displayName && userNameEl) userNameEl.textContent = data.displayName;

        if (data.qrConfig) {
            qrConfig = data.qrConfig;
            applyQRConfig();
        }

        fieldMap.forEach(field => {
            const val = data[field] || "-";
            const displayVal = (field.toLowerCase().includes('date') && val !== '-') ? formatDateToIT(val) : val;

            const viewEl = document.getElementById(`${field}-view`);
            const editEl = document.getElementById(`${field}-edit`);

            if (viewEl) viewEl.textContent = displayVal;
            if (editEl && val !== '-') editEl.value = val;
        });

        if (data.contactEmails && Array.isArray(data.contactEmails)) {
            contactEmails = data.contactEmails;
        } else if (data.email) {
            contactEmails = [{ address: data.email, qr: true, visible: true }];
        }

        if (data.utenze && Array.isArray(data.utenze)) {
            userUtilities = data.utenze;
        }

        if (data.documenti && Array.isArray(data.documenti)) {
            userDocuments = data.documenti;
        }

        renderEmailsView();
        renderEmailsEdit();
        renderUtenzeView();
        renderUtenzeEdit();
        renderDocumentiView();
        renderDocumentiEdit();

    } catch (e) { logError("Profile Cache Load", e); }
}

function saveToCache(data) {
    const current = JSON.parse(localStorage.getItem('userProfileCache') || '{}');
    const updated = { ...current, ...data };
    localStorage.setItem('userProfileCache', JSON.stringify(updated));
}

loadFromCache();

// --- MAIN AUTH SUBSCRIPTION ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.LOG("No user session.");
        return;
    }

    window.LOG("Login: " + user.email);

    let displayName = user.displayName;
    let photoURL = user.photoURL;
    const email = user.email;

    let cacheUpdate = { email, photoURL };

    if (photoURL && !isUploading) {
        avatarImg.src = photoURL;
    }

    // Fetch Firestore
    try {
        const docRef = doc(db, "users", user.uid);
        window.LOG("Download dati DB...");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            fieldMap.forEach(field => {
                let val = data[field];
                if (field === 'cf' && !val && data.codiceFiscale) val = data.codiceFiscale;
                val = val || "";

                const viewEl = document.getElementById(`${field}-view`);
                const editEl = document.getElementById(`${field}-edit`);

                const displayVal = (field.toLowerCase().includes('date') && val) ? formatDateToIT(val) : (val || "-");

                if (viewEl) viewEl.textContent = displayVal;
                if (editEl) editEl.value = val;

                cacheUpdate[field] = val;
            });

            if (data.nome || data.cognome) {
                displayName = `${data.nome || ''} ${data.cognome || ''}`.trim();
            } else {
                displayName = displayName || "Utente";
            }
            userNameEl.textContent = displayName;
            cacheUpdate.displayName = displayName;

            if (data.qrConfig) {
                qrConfig = data.qrConfig;
            }
            cacheUpdate.qrConfig = qrConfig;
            applyQRConfig();


            if (data.contactEmails) {
                contactEmails = data.contactEmails;
            } else {
                const legacyEmail = data.email || user.email;
                if (legacyEmail) {
                    contactEmails = [{ address: legacyEmail, qr: true, visible: true }];
                }
            }
            cacheUpdate.contactEmails = contactEmails;

            if (data.utenze) {
                userUtilities = data.utenze;
            } else {
                userUtilities = [];
            }
            cacheUpdate.utenze = userUtilities;

            if (data.documenti) {
                userDocuments = data.documenti;
            } else {
                userDocuments = [];
            }
            cacheUpdate.documenti = userDocuments;

            renderEmailsView();
            renderEmailsEdit();
            renderUtenzeView();
            renderUtenzeEdit();
            renderDocumentiView();
            renderDocumentiEdit();
            try { updateQRCode(); } catch (e) { console.warn("QR Init Warning", e); }

            if (data.allegati && Array.isArray(data.allegati)) {
                existingAttachments = data.allegati;
            } else {
                existingAttachments = [];
            }

            // Fetch SUBCOLLECTION 'personal_documents' (from Gestione Allegati page)
            try {
                const subCol = collection(db, "users", user.uid, "personal_documents");
                const subSnap = await getDocs(query(subCol, orderBy('createdAt', 'desc')));
                const subFiles = subSnap.docs.map(d => {
                    const fd = d.data();
                    return {
                        name: fd.name,
                        url: fd.url,
                        type: fd.type || 'file',
                        source: 'Foto/Allegati'
                    };
                });
                existingAttachments = [...existingAttachments, ...subFiles];
            } catch (errSub) {
                logError("Profile Subcollection (Allegati)", errSub);
            }

            renderAttachmentsView();
            renderAttachmentsEdit();

        } else {
            // Init new user
            const initEmails = [{ address: email, qr: true, visible: true }];
            await setDoc(docRef, { email, qrConfig, contactEmails: initEmails }, { merge: true });
            contactEmails = initEmails;
            renderEmailsView();
            renderEmailsEdit();
        }

        saveToCache(cacheUpdate);
        window.LOG("Dati sincronizzati.");

        if (window.loadTopAccounts) window.loadTopAccounts(user.uid);
        if (window.loadCounters) window.loadCounters(user.uid);
        if (window.loadContacts) window.loadContacts(user.uid);
        if (window.loadAttachmentCounters) window.loadAttachmentCounters(user.uid);

    } catch (err) {
        logError("Profile Master Load", err);
        alert("Errore Inizializzazione Dati");
    }
});

// --- AVATAR UPLOAD ---
if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showToast("Inizio aggiornamento foto...");

        const user = auth.currentUser;
        if (!user) return;

        try {
            isUploading = true;
            loadingOverlay.classList.remove('hidden');
            window.LOG("Upload immagine...");

            if (user.photoURL && user.photoURL.includes('firebase')) {
                try {
                    // Need to get ref from URL
                    const oldRef = ref(storage, user.photoURL);
                    await deleteObject(oldRef);
                } catch (e) { logError("Delete Old Avatar", e); }
            }

            const storageRef = ref(storage, `users/${user.uid}/profile_v2_${Date.now()}.jpg`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            await updateProfile(user, { photoURL: url });
            await updateDoc(doc(db, "users", user.uid), { photoURL: url });

            avatarImg.src = url;
            saveToCache({ photoURL: url });
            window.LOG("Avatar salvato!");
            showToast("Foto aggiornata su tutti i dispositivi!");

        } catch (error) {
            logError("Avatar Upload", error);
            showToast("Errore caricamento foto", 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
            isUploading = false;
            avatarInput.value = "";
        }
    });
}

// --- SAVE FUNCTION ---
realSaveButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const icon = realSaveButton.querySelector('span');
    const oldIcon = icon.textContent;
    icon.textContent = "sync";
    icon.classList.add('animate-spin');
    realSaveButton.disabled = true;
    window.LOG("Salvataggio dati...");

    try {
        const updateData = {};

        fieldMap.forEach(field => {
            const editEl = document.getElementById(`${field}-edit`);
            if (editEl) {
                updateData[field] = editEl.value.trim();
            }
        });

        updateData.qrConfig = qrConfig;
        updateData.contactEmails = contactEmails;
        updateData.utenze = userUtilities;
        updateData.documenti = userDocuments;

        // Upload new attachments
        if (selectedFiles.length > 0) {
            const uploaded = [];
            for (const file of selectedFiles) {
                const fileRef = ref(storage, `users/${user.uid}/attachments/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                const url = await getDownloadURL(fileRef);
                uploaded.push({ name: file.name, url, type: file.type });
            }
            existingAttachments = [...existingAttachments, ...uploaded];
            updateData.allegati = existingAttachments;
        } else {
            updateData.allegati = existingAttachments; // Save deletes
        }

        await updateDoc(doc(db, "users", user.uid), updateData);
        saveToCache(updateData);

        // Update name in Auth
        const fullName = `${updateData.nome || ''} ${updateData.cognome || ''}`.trim();
        if (fullName) {
            await updateProfile(user, { displayName: fullName });
            userNameEl.textContent = fullName;
        }

        selectedFiles = [];
        renderAttachmentsEdit();
        renderAttachmentsView();

        showToast("Dati salvati con successo!");
        toggleEdit(false);

    } catch (e) {
        logError("Profile Save", e);
        showToast("Errore durante il salvataggio", "error");
    } finally {
        icon.textContent = oldIcon;
        icon.classList.remove('animate-spin');
        realSaveButton.disabled = false;
    }
});

function toggleEdit(on) {
    const addEmailBtn = document.getElementById('add-email-btn');
    const addUtenzaBtn = document.getElementById('add-utenza-btn');

    if (on) {
        // Edit Mode On
        viewElements.forEach(el => el.classList.add('hidden'));
        editElements.forEach(el => {
            const container = el.closest('.edit-container');
            if (container) {
                container.classList.remove('hidden');
                el.classList.remove('hidden');
            } else {
                el.classList.remove('hidden');
            }
        });

        document.getElementById('email-view-container').classList.add('hidden');
        document.getElementById('email-edit-container').classList.remove('hidden');
        if (addEmailBtn) addEmailBtn.classList.remove('hidden');

        document.getElementById('utenze-view-container').classList.add('hidden');
        document.getElementById('utenze-edit-container').classList.remove('hidden');
        if (addUtenzaBtn) addUtenzaBtn.classList.remove('hidden');

        document.getElementById('documenti-view-container').classList.add('hidden');
        document.getElementById('documenti-edit-container').classList.remove('hidden');
        if (addDocumentoBtn) addDocumentoBtn.classList.remove('hidden');

        const noteSave = document.getElementById('note-save-container');
        if (noteSave) noteSave.classList.remove('hidden');
    } else {
        // View Mode On
        viewElements.forEach(el => el.classList.remove('hidden'));
        editElements.forEach(el => {
            const container = el.closest('.edit-container');
            if (container) {
                container.classList.add('hidden');
                el.classList.add('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        document.getElementById('email-view-container').classList.remove('hidden');
        document.getElementById('email-edit-container').classList.add('hidden');
        if (addEmailBtn) addEmailBtn.classList.add('hidden');

        document.getElementById('utenze-view-container').classList.remove('hidden');
        document.getElementById('utenze-edit-container').classList.add('hidden');
        if (addUtenzaBtn) addUtenzaBtn.classList.add('hidden');

        document.getElementById('documenti-view-container').classList.remove('hidden');
        document.getElementById('documenti-edit-container').classList.add('hidden');
        if (addDocumentoBtn) addDocumentoBtn.classList.add('hidden');

        const noteSave = document.getElementById('note-save-container');
        if (noteSave) noteSave.classList.add('hidden');
    }

    // Button Toggles
    if (realEditButton) realEditButton.classList.toggle('hidden', on);
    if (realSaveButton) realSaveButton.classList.toggle('hidden', !on);
    if (realCancelButton) realCancelButton.classList.toggle('hidden', !on);

    // Copy/Call button logic
    const copyBtns = document.querySelectorAll('.copy-button');
    copyBtns.forEach(btn => {
        if (btn.getAttribute('data-copy-target')) {
            btn.style.display = on ? 'none' : 'inline-block';
        }
    });

    const callBtns = document.querySelectorAll('.call-button');
    callBtns.forEach(btn => {
        btn.style.display = on ? 'none' : 'inline-block';
    });

    // QR Visibility
    document.querySelectorAll('.qr-check').forEach(el => el.classList.toggle('hidden', !on));

    // Attachments Toggle
    const attachView = document.getElementById('attachments-view-container');
    const attachEdit = document.getElementById('attachments-edit-container');
    const quickAddBtn = document.getElementById('quick-add-attachment-btn');

    if (attachView) attachView.classList.toggle('hidden', on);
    if (attachEdit) attachEdit.classList.toggle('hidden', !on);
    if (quickAddBtn) quickAddBtn.classList.toggle('hidden', on);

    if (on) {
        applyQRConfig();
        renderEmailsEdit();
        renderUtenzeEdit();
        renderDocumentiEdit();
        renderAttachmentsEdit();
    } else {
        renderEmailsView();
        renderUtenzeView();
        renderDocumentiView();
        renderAttachmentsView();
    }
}


function applyQRConfig() {
    document.querySelectorAll('input[data-qr-field]').forEach(chk => {
        const f = chk.getAttribute('data-qr-field');
        chk.checked = !!qrConfig[f];
        chk.addEventListener('change', () => {
            qrConfig[f] = chk.checked;
            updateQRCode();
        });
    });
}

// Make accessible globally
// window.updateQRCode = updateQRCode; // Not needed, listeners attached via JS

function updateQRCode() {
    if (typeof QRCode === 'undefined') {
        console.warn("QRCode library not loaded");
        return;
    }
    if (!qrContainer) return;
    qrContainer.innerHTML = "";

    const vals = {};
    // Retrieve data primarily from VIEW elements (what is seen)
    fieldMap.forEach(f => {
        let v = "";
        const viewEl = document.getElementById(f + '-view');
        if (viewEl) {
            v = viewEl.textContent.trim();
            if (v === '-') v = ""; // Ignore placeholders
        }
        // Fallback to edit if view is empty or missing
        if (!v) {
            const editEl = document.getElementById(f + '-edit');
            if (editEl) v = editEl.value.trim();
        }
        vals[f] = v;
    });

    // Special handling for Note (fieldMap has 'note', config uses 'notes')
    const noteEl = document.getElementById('note-view');
    if (noteEl && noteEl.textContent !== '-') vals['note'] = noteEl.textContent.trim();

    let v = "BEGIN:VCARD\nVERSION:3.0\n";

    if (qrConfig['nome'] || qrConfig['cognome']) {
        let fn = (qrConfig['nome'] ? vals.nome : "") + " " + (qrConfig['cognome'] ? vals.cognome : "");
        v += `FN:${fn.trim()}\n`;
        v += `N:${qrConfig['cognome'] ? vals.cognome : ""};${qrConfig['nome'] ? vals.nome : ""};;;\n`;
    }

    if (qrConfig['mobile_private'] && vals.mobile_private) v += `TEL;TYPE=CELL:${vals.mobile_private}\n`;
    if (qrConfig['phone_private'] && vals.phone_private) v += `TEL;TYPE=HOME:${vals.phone_private}\n`;

    contactEmails.forEach(e => {
        if (e.qr && e.address) {
            v += `EMAIL:${e.address.trim()}\n`;
        }
    });

    if (qrConfig['birth_date'] && vals.birth_date) {
        // Expecting DD/MM/YYYY from View
        let bday = vals.birth_date;
        if (bday.includes('/')) {
            const parts = bday.split('/'); // dd, mm, yyyy
            if (parts.length === 3) bday = parts[2] + parts[1] + parts[0];
        } else {
            bday = bday.replace(/-/g, '');
        }
        v += `BDAY:${bday}\n`;
    }

    const adrFields = ['residence_address', 'residence_civic', 'residence_city', 'residence_province', 'residence_cap'];
    if (adrFields.some(f => qrConfig[f])) {
        let street = (qrConfig['residence_address'] ? vals.residence_address : "") + " " + (qrConfig['residence_civic'] ? vals.residence_civic : "");
        let city = qrConfig['residence_city'] ? vals.residence_city : "";
        let province = qrConfig['residence_province'] ? vals.residence_province : "";
        let cap = qrConfig['residence_cap'] ? vals.residence_cap : "";
        v += `ADR:;;${street.trim()};${city};${province};${cap};;\n`;
    }

    let extras = [];
    if (qrConfig['cf'] && vals.cf) extras.push(`CF: ${vals.cf}`);
    if ((qrConfig['birth_place'] && vals.birth_place) || (qrConfig['birth_province'] && vals.birth_province)) {
        extras.push(`Nato a: ${vals.birth_place || ""} (${vals.birth_province || ""})`);
    }
    // Mapping config 'notes' to val 'note'
    if (qrConfig['notes'] && vals.note) extras.push(`Note: ${vals.note}`);

    if (extras.length > 0) {
        v += `NOTE:${extras.join('\\n')}\n`;
    }

    v += "END:VCARD";

    try {
        if (qrContainer) {
            qrContainer.innerHTML = "";
            new QRCode(qrContainer, {
                text: v,
                width: 100, // Reduced to fit standard container
                height: 100,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    } catch (e) {
        console.error("QR Generated Error", e);
        qrContainer.innerHTML = '<span class="text-xs text-red-400">Error Lib</span>';
    }

    const zoomContainer = document.getElementById('qrcode-zoom-container');
    if (zoomContainer) {
        try {
            zoomContainer.innerHTML = "";
            new QRCode(zoomContainer, {
                text: v,
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (e) { logError("QR Code Zoom Generation", e); }
    }
}

realEditButton.addEventListener('click', () => toggleEdit(true));
realCancelButton.addEventListener('click', () => toggleEdit(false));

window.toggleDocumenti = function () {
    const wrapper = document.getElementById('documenti-wrapper');
    const chevron = document.getElementById('documenti-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleUtenze = function () {
    const wrapper = document.getElementById('utenze-wrapper');
    const chevron = document.getElementById('utenze-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleEmails = function () {
    const wrapper = document.getElementById('emails-wrapper');
    const chevron = document.getElementById('emails-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleDatiPersonali = function () {
    const wrapper = document.getElementById('dati-personali-wrapper');
    const chevron = document.getElementById('dati-personali-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleResidenza = function () {
    const wrapper = document.getElementById('residenza-wrapper');
    const chevron = document.getElementById('residenza-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleContatti = function () {
    const wrapper = document.getElementById('contatti-wrapper');
    const chevron = document.getElementById('contatti-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleNote = function () {
    const wrapper = document.getElementById('note-wrapper');
    const chevron = document.getElementById('note-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

window.toggleAllegati = function () {
    const wrapper = document.getElementById('allegati-wrapper');
    const chevron = document.getElementById('allegati-chevron');
    if (wrapper) {
        wrapper.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = !wrapper.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }
};

// --- RUBRICA CONTATTI LOGIC ---
let contactsList = [];
let editingContactId = null; // Track if we are editing

// Expose to window
window.toggleRubrica = function () {
    const content = document.getElementById('rubrica-content');
    const chevron = document.getElementById('rubrica-chevron');
    if (content) {
        content.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = content.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)'; // Fix rotation logic
        }
    }
};

window.toggleAddContactForm = function () {
    const form = document.getElementById('add-contact-form');
    if (form) {
        form.classList.toggle('hidden');
        // Reset state when closing/opening manually if desired, 
        // but here we keep values if just toggling visibility.
        // If we want to "Add New" cleanly, we should reset inputs if editingContactId was set.
        if (!form.classList.contains('hidden') && !editingContactId) {
            // Just opened for add, ensure clean?
            // Optional: document.getElementById('contact-nome').value = ''; etc.
        }
    }
};

function resetRubricaLayout() {
    const content = document.getElementById('rubrica-content');
    const chevron = document.getElementById('rubrica-chevron');
    if (content) {
        content.classList.add('hidden');
    }
    if (chevron) {
        // Default state (Closed): Chevron rotated 180deg
        chevron.style.transform = 'rotate(180deg)';
    }
}
// Force close on load/reload/back-navigation
resetRubricaLayout();
// Also listen for pageshow event which handles bfcache (Back/Forward Cache) restoration
window.addEventListener('pageshow', resetRubricaLayout);

function renderContacts(list) {
    const container = document.getElementById('contacts-list');
    const counter = document.getElementById('rubrica-counter');
    if (counter) counter.textContent = `(${list.length})`;

    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p class="text-center text-xs text-[#CBD5E1] py-2">Nessun contatto salvato.</p>';
        return;
    }

    list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    list.forEach(c => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-2 bg-white  rounded-lg border border-gray-100  shadow-sm";
        // Escape strings for onclick safety
        const safeNome = (c.nome || '').replace(/'/g, "\\'");
        const safeCognome = (c.cognome || '').replace(/'/g, "\\'");
        const safeEmail = (c.email || '').replace(/'/g, "\\'");

        div.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    ${(c.nome || c.email || '?').charAt(0)}
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-bold text-gray-800  truncate">${c.nome} ${c.cognome || ''}</p>
                    <p class="text-xs text-gray-500  truncate">${c.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                 <button class="edit-contact-btn p-1.5 text-gray-500 hover:text-blue-600 transition-colors" 
                    onclick="openEditContact('${c.id}', '${safeNome}', '${safeCognome}', '${safeEmail}')">
                    <span class="material-symbols-outlined text-base">edit</span>
                 </button>
                 <button class="delete-contact-btn p-1.5 text-[#CBD5E1] hover:text-red-500 transition-colors" data-id="${c.id}">
                    <span class="material-symbols-outlined text-base">delete</span>
                 </button>
            </div>
        `;
        container.appendChild(div);
    });

    // Attach Delete listeners
    document.querySelectorAll('.delete-contact-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm("Eliminare questo contatto?")) {
                await deleteContact(id);
            }
        };
    });
}

// Open Edit Mode
window.openEditContact = function (id, nome, cognome, email) {
    editingContactId = id;
    document.getElementById('contact-nome').value = nome;
    document.getElementById('contact-cognome').value = cognome;
    document.getElementById('contact-email').value = email;

    // Change button text
    const btn = document.getElementById('btn-add-contact');
    if (btn) btn.textContent = "Aggiorna";

    // Show form
    const form = document.getElementById('add-contact-form');
    if (form && form.classList.contains('hidden')) {
        form.classList.remove('hidden');
    }
    // Change Add title
    const title = form.querySelector('span');
    if (title) title.textContent = "Modifica Contatto";
};

async function deleteContact(contactId) {
    const user = auth.currentUser;
    if (!user || !contactId) return;
    try {
        await deleteDoc(doc(db, "users", user.uid, "contacts", contactId));
        showToast("Contatto eliminato");
        window.loadContacts(user.uid);
    } catch (e) {
        logError("Contact Delete", e);
        showToast("Errore eliminazione contatto", "error");
    }
}

// Add/Update Contact Logic
const btnAddContact = document.getElementById('btn-add-contact');
if (btnAddContact) {
    btnAddContact.addEventListener('click', async () => {
        const nome = document.getElementById('contact-nome').value.trim();
        const cognome = document.getElementById('contact-cognome').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const user = auth.currentUser;

        if (!user) return;
        if (!email) {
            alert("L'email è obbligatoria");
            return;
        }

        try {
            btnAddContact.disabled = true;
            btnAddContact.textContent = "...";

            if (editingContactId) {
                // UPDATE EXISTING
                await updateDoc(doc(db, "users", user.uid, "contacts", editingContactId), {
                    nome,
                    cognome,
                    email
                });
                showToast("Contatto aggiornato!");
            } else {
                // ADD NEW
                await addContact(user.uid, {
                    nome,
                    cognome,
                    email,
                    createdAt: new Date().toISOString()
                });
                showToast("Contatto aggiunto!");
            }

            // Reset UI
            document.getElementById('contact-nome').value = '';
            document.getElementById('contact-cognome').value = '';
            document.getElementById('contact-email').value = '';
            editingContactId = null;
            btnAddContact.textContent = "Salva";

            const form = document.getElementById('add-contact-form');
            if (form) {
                form.classList.add('hidden');
                form.querySelector('span').textContent = "Nuovo Contatto"; // Reset Title
            }

            window.loadContacts(user.uid);

        } catch (e) {
            logError("Contact Update/Add", e);
            alert("Errore salvataggio contatto");
            btnAddContact.textContent = editingContactId ? "Aggiorna" : "Salva";
        } finally {
            btnAddContact.disabled = false;
        }
    });
}

// --- COUNTERS LOGIC ---
window.loadCounters = async function (uid) {
    if (!uid) return;
    try {
        window.LOG("Calcolo contatori...");
        const accountsRef = collection(db, "users", uid, "accounts");

        // 1. Standard & Memo (Owned by user)
        let ownSharedCount = 0;
        try {
            const allSnap = await getDocs(accountsRef);
            let totalStandard = 0;
            let totalMemo = 0;
            let ownSharedStandard = 0;
            let ownSharedMemo = 0;

            allSnap.forEach(doc => {
                const d = doc.data();
                if (d.isArchived) return;
                // FIX: Allow 'memorandum' type to be processed, not just 'privato'
                const isValidType = !d.type || d.type === 'privato' || d.type === 'memorandum' || d.category === 'memorandum';
                if (!isValidType) return;

                const isShared = !!d.shared || !!d.isMemoShared;
                // Robust check for Memo matches account_privati.html
                const isMemo = !!d.hasMemo || !!d.isMemoShared || d.type === 'memorandum' || d.category === 'memorandum';

                // GHOST/LEGACY CHECK: If ownerId exists and is NOT me, it's a ghost copy.
                // We SKIP it here entirely because the Shared logic below (Invites) handles the real shared items.
                if (d.ownerId && d.ownerId !== auth.currentUser.uid) return;

                if (isShared) {
                    // Shared items go STRICTLY to shared counts
                    if (isMemo) ownSharedMemo++;
                    else ownSharedStandard++;
                } else if (isMemo) {
                    // Private Memos (Not shared)
                    totalMemo++;
                } else {
                    // Private Standard Accounts (Not shared)
                    totalStandard++;
                }
            });

            updateBadge('count-standard', totalStandard);
            updateBadge('count-memo', totalMemo);
            // We pass the partials to the shared section to add with 'received' items
            window.ownSharedStandard = ownSharedStandard;
            window.ownSharedMemo = ownSharedMemo; // Store for next block
        } catch (e) { logError("Owned Accounts Counter", e); }

        // 2. Shared WITH me (Requires Index)
        // 2. Shared WITH me (ALIGNMENT FIX: Use Invites collection)
        // Previously used collectionGroup on accounts, which found "legacy" shares without invites.
        // Now using same logic as account_privati.html list.
        try {
            const invitesSnap = await getDocs(query(
                collection(db, "invites"),
                where("recipientEmail", "==", email),
                where("status", "==", "accepted")
            ));

            let sharedWithMeStandard = 0;
            let sharedWithMeMemo = 0;

            // We need to fetch the accounts to know if they are memos
            // Optimization: We can't know if it's memo without fetching the account or storing type in invite.
            // Invite doc HAS 'type'. We can use that if reliable.
            // Looking at save logic: 'type': 'privato' or 'azienda'.
            // Unreliable for Distinction between "Account" and "Memo".
            // However, fetching all accounts just for a badge might be heavy?
            // User has minimal data presumably. Let's fetch for correctness.

            const inviteDocs = invitesSnap.docs;
            const accountPromises = inviteDocs.map(async invDoc => {
                const inv = invDoc.data();
                if (!inv.ownerId || !inv.accountId) return null;

                try {
                    // Path logic (similar to list)
                    let accRef;
                    if (inv.aziendaId) {
                        accRef = doc(db, "users", inv.ownerId, "aziende", inv.aziendaId, "accounts", inv.accountId);
                    } else {
                        accRef = doc(db, "users", inv.ownerId, "accounts", inv.accountId);
                    }
                    const accSnap = await getDoc(accRef);
                    if (accSnap.exists()) return accSnap.data();
                } catch (e) { logError("Invite Account Detail Fetch", e); return null; }
                return null;
            });

            const sharedAccounts = (await Promise.all(accountPromises)).filter(a => a !== null && !a.isArchived);

            sharedAccounts.forEach(d => {
                const isMemo = !!d.hasMemo || !!d.isMemoShared || d.type === 'memorandum' || d.category === 'memorandum';
                if (isMemo) sharedWithMeMemo++;
                else sharedWithMeStandard++;
            });

            // SOMMA: Miei condivisi + Condivisi con me
            const finalSharedStandard = (window.ownSharedStandard || 0) + sharedWithMeStandard;
            const finalSharedMemo = (window.ownSharedMemo || 0) + sharedWithMeMemo;

            updateBadge('count-shared', finalSharedStandard);
            updateBadge('count-shared-memo', finalSharedMemo);

        } catch (e) {
            logError("Shared Accounts Counter", e);
            updateBadge('count-shared', window.ownSharedStandard || 0);
            updateBadge('count-shared-memo', window.ownSharedMemo || 0);
        }

        // 3. Invites
        try {
            const invitesSnap = await getDocs(query(collection(db, "invites"), where("recipientEmail", "==", auth.currentUser.email), where("status", "==", "pending")));
            // update if needed
        } catch (e) { logError("Pending Invites Counter", e); }

    } catch (e) {
        logError("General Dashboard Counters", e);
    }
};

window.loadContacts = async function (uid) {
    if (!uid) return;
    try {
        window.LOG("Caricamento rubrica...", uid);
        const contacts = await getContacts(uid);
        renderContacts(contacts);
    } catch (e) {
        logError("Rubrica Load", e);
    }
};

function updateBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;

    const labels = {
        'count-standard': 'Account',
        'count-shared': 'Account Condivisi',
        'count-memo': 'Memorandum',
        'count-shared-memo': 'Memorandum Condivisi'
    };

    const label = labels[id] || 'Dati';
    el.textContent = `${label} (${count})`;
}

// Placeholder for top accounts if used
window.loadTopAccounts = async function (uid) {
    const list = document.getElementById('top-accounts-list');
    if (!list || !uid) return;

    try {
        const q = query(
            collection(db, "users", uid, "accounts"),
            orderBy("views", "desc"),
            limit(10)
        );

        const snap = await getDocs(q);
        list.innerHTML = ''; // Clear spinner

        if (snap.empty) {
            list.innerHTML = '<p class="text-xs text-[#CBD5E1] text-center py-4">Nessun account recente.</p>';
            return;
        }

        snap.forEach(doc => {
            const acc = doc.data();
            const div = document.createElement('a');
            div.href = `dettaglio_account_privato.html?id=${doc.id}`;
            div.className = "flex items-center justify-between p-3 bg-gray-50  rounded-lg hover:bg-gray-100  transition-colors border border-gray-100 ";

            // Icon logic (logo or vibrant squircle)
            const logoUrl = acc.logo || acc.avatar;
            let iconHtml = '';

            if (logoUrl) {
                iconHtml = `<img class="h-8 w-8 rounded-full object-cover bg-white/20 shadow-sm" src="${logoUrl}" alt="">`;
            } else if (window.getAccountIcon) {
                iconHtml = window.getAccountIcon(acc.nomeAccount, 'h-8 w-8');
            } else {
                iconHtml = `
                    <div class="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                        ${(acc.nomeAccount || '?').charAt(0)}
                    </div>`;
            }

            div.innerHTML = `
                <div class="flex items-center gap-3">
                    ${iconHtml}
                    <div>
                        <p class="text-sm font-bold text-black ">${acc.nomeAccount || 'Senza Nome'}</p>
                        <p class="text-[10px] text-[#CBD5E1] flex items-center gap-1">
                            <span class="material-symbols-outlined text-[10px]">visibility</span>
                            ${acc.views || 0} visite
                        </p>
                    </div>
                </div>
                <span class="material-symbols-outlined text-gray-300 text-sm">chevron_right</span>
            `;
            list.appendChild(div);
        });

    } catch (e) {
        logError("Top Accounts Dashboard", e);
        list.innerHTML = '<p class="text-xs text-red-400 text-center py-2">Errore caricamento.</p>';
    } finally {
        // Ensure spinner is removed
        const spinner = list.querySelector('.animate-spin');
        if (spinner) spinner.parentElement.remove();
    }
};

// --- ATTACHMENT COUNTERS ---
window.loadAttachmentCounters = async function (uid) {
    if (!uid) return;
    try {
        const path = `users/${uid}/attachments`;
        const q = query(collection(db, path));
        const snap = await getDocs(q);

        const counts = {
            'dati-personali': 0,
            'residenza': 0,
            'utenze': 0,
            'documenti': 0,
            'contatti': 0,
            'note': 0
        };

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const cat = data.category || '';

            // Mapping based on common categories in gestione_allegati.html
            if (['Documento Identità', 'Codice Fiscale', 'Tessera Sanitaria'].includes(cat)) {
                counts['dati-personali']++;
            } else if (['Bolletta', 'Contratto'].includes(cat)) {
                counts['utenze']++;
            } else if (['Ricevuta', 'Modulo', 'Patente', 'Passaporto'].includes(cat)) {
                counts['documenti']++;
            }
            // You can add more mappings here if needed
        });

        // Update UI Badges
        Object.keys(counts).forEach(key => {
            updateSectionBadge(`count-${key}`, counts[key]);
        });

    } catch (e) {
        logError("Attachment Counters", e);
    }
};

function updateSectionBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.classList.remove('hidden');
        const valEl = el.querySelector('.count-val');
        if (valEl) valEl.textContent = count;
    } else {
        el.classList.add('hidden');
    }
}

function setupDelegation() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const index = parseInt(target.dataset.index);

        switch (action) {
            case 'toggle-text-mask':
                const wrapper = target.closest('.glass-field');
                if (wrapper) {
                    const txt = wrapper.querySelector('.password-text');
                    if (txt) {
                        const isMasked = txt.textContent === '********';
                        txt.textContent = isMasked ? target.dataset.secret : '********';
                        const span = target.querySelector('span');
                        if (span) span.textContent = isMasked ? 'visibility' : 'visibility_off';
                    }
                }
                break;
            case 'delete-email': deleteEmail(index); break;
            case 'delete-utenza':
                if (confirm("Eliminare questa utenza?")) {
                    userUtilities.splice(index, 1);
                    renderUtenzeEdit();
                }
                break;
            case 'delete-documento':
                if (confirm("Eliminare questo documento?")) {
                    userDocuments.splice(index, 1);
                    renderDocumentiEdit();
                }
                break;
        }
    });
}
setupDelegation();




