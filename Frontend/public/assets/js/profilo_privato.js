import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- GLOBAL UTILS ---
window.toggleSection = function (id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if (!el) return;

    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        el.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
};

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '-';
}

function formatDateToIT(val) {
    if (!val || val === '-') return '-';
    // If it's YYYY-MM-DD
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = val.split('-');
        return `${d}/${m}/${y}`;
    }
    return val;
}

function showToast(message) {
    // Check if a global toast exists or create a simple alert fallback
    // In a real Titanium app, this would use the global toast system.
    // We'll trust the user has a toast container or just log it.
    let toast = document.getElementById('toast-container');
    if (toast && window.showToast) {
        window.showToast(message);
    } else {
        console.log("Toast:", message);
        // Fallback simple toast injection if missing
        if (!document.getElementById('simple-toast')) {
            const t = document.createElement('div');
            t.id = 'simple-toast';
            t.className = "fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] transition-opacity opacity-0 pointer-events-none";
            document.body.appendChild(t);
        }
        const t = document.getElementById('simple-toast');
        t.innerText = message;
        t.classList.remove('opacity-0');
        setTimeout(() => t.classList.add('opacity-0'), 3000);
    }
}

// --- CONFIG & HELPERS ---
function getUtenzaIcon(type) {
    const map = {
        'Codice POD': { icon: 'bolt', color: 'text-amber-600 dark:text-amber-500', bg: 'bg-amber-500/10' },
        'Seriale Contatore Metano': { icon: 'local_fire_department', color: 'text-orange-600 dark:text-orange-600', bg: 'bg-orange-500/10' },
        'Seriale Contatore Acqua': { icon: 'water_drop', color: 'text-blue-600 dark:text-blue-500', bg: 'bg-blue-500/10' }
    };
    return map[type] || { icon: 'tag', color: 'text-slate-400', bg: 'bg-slate-500/10' };
}

function getDocumentIcon(type) {
    const map = {
        'Passaporto': { icon: 'pnp_only', color: 'text-blue-700 dark:text-blue-500', bg: 'bg-blue-500/10' },
        'Carta Identità': { icon: 'badge', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
        'Patente': { icon: 'directions_car', color: 'text-green-600 dark:text-green-500', bg: 'bg-green-500/10' },
        'Codice fiscale': { icon: 'credit_card', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10' }
    };
    return map[type] || { icon: 'description', color: 'text-slate-400', bg: 'bg-slate-500/10' };
}

function getFieldsForDocType(type) {
    if (type === 'Passaporto') return [
        { key: 'emission_date', label: 'Emissione' },
        { key: 'expiry_date', label: 'Scadenza' },
        { key: 'num_serie', label: 'N. Serie' },
        { key: 'emission_place', label: 'Luogo' }
    ];
    if (type === 'Carta Identità') return [
        { key: 'id_number', label: 'Numero C.I.' },
        { key: 'expiry_date', label: 'Scadenza' },
        { key: 'issued_by', label: 'Emessa da' }
    ];
    if (type === 'Patente') return [
        { key: 'license_number', label: 'Numero' },
        { key: 'expiry_date', label: 'Scadenza' },
        { key: 'issued_by', label: 'Ente' }
    ];
    if (type === 'Codice fiscale') return [
        { key: 'cf_value', label: 'Codice' },
        { key: 'expiry_date', label: 'Scadenza' }
    ];
    return [];
}

// --- STATE ---
let contactEmails = [];
let userUtilities = [];
let userDocuments = [];

// --- RENDERING FUNCTIONS ---

function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    container.innerHTML = '';

    const visibleEmails = contactEmails.filter(e => e.visible);

    if (visibleEmails.length === 0) {
        container.innerHTML = `
                <div class="flex items-center gap-2 text-cyan-500/60 italic text-sm justify-center py-2">
                    <span class="material-symbols-outlined text-lg">visibility_off</span>
                    <span>Nessuna email visibile</span>
                </div>`;
        return;
    }

    visibleEmails.forEach(e => {
        const div = document.createElement('div');
        div.className = "bg-cyan-500/5 dark:bg-cyan-500/5 border border-cyan-500/10 dark:border-white/5 p-4 rounded-xl shadow-sm flex flex-col gap-3 group relative overflow-hidden transition-all hover:border-cyan-500/30";

        let passwordHtml = '';
        if (e.password) {
            passwordHtml = `
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider pl-1">Password</label>
                        <div class="glass-field glass-field-cyan group/field flex items-center justify-between">
                            <span class="text-sm font-mono tracking-wider password-text flex-1 text-slate-700 dark:text-white/90">********</span>
                            <div class="flex items-center gap-1">
                                <button class="text-cyan-500 p-1 hover:bg-cyan-500/10 rounded-lg transition-colors" 
                                    onclick="const txt = this.parentElement.previousElementSibling; 
                                             const isMasked = txt.textContent === '********';
                                             txt.textContent = isMasked ? '${e.password.replace(/'/g, "\\'")}' : '********';
                                             this.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';">
                                    <span class="material-symbols-outlined text-lg">visibility_off</span>
                                </button>
                                <button class="text-slate-400 hover:text-cyan-500 p-1 rounded-lg transition-colors" 
                                    onclick="navigator.clipboard.writeText('${e.password.replace(/'/g, "\\'")}').then(() => showToast('Password copiata!'))">
                                    <span class="material-symbols-outlined text-lg">content_copy</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
        }

        div.innerHTML = `
                <div class="flex flex-col gap-1">
                    <label class="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider pl-1">Email</label>
                    <div class="glass-field glass-field-cyan group/field flex items-center justify-between">
                         <p class="text-sm font-medium break-all flex-1 text-slate-900 dark:text-white">${e.address}</p>
                         <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/field:opacity-100 transition-opacity">
                             <a href="mailto:${e.address}" class="text-cyan-500 p-1 hover:bg-cyan-500/10 rounded-lg transition-colors">
                                <span class="material-symbols-outlined text-lg">mail</span>
                             </a>
                             <button class="text-slate-400 hover:text-cyan-500 p-1 rounded-lg transition-colors" onclick="navigator.clipboard.writeText('${e.address.replace(/'/g, "\\'")}').then(() => showToast('Email copiata!'))">
                                <span class="material-symbols-outlined text-lg">content_copy</span>
                             </button>
                         </div>
                    </div>
                </div>
                ${passwordHtml}
            `;
        container.appendChild(div);
    });
}

function renderUtenzeView() {
    const container = document.getElementById('utenze-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (userUtilities.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-2 text-center">
                <p class="text-sm text-slate-400 italic">Nessuna utenza registrata</p>
            </div>`;
        return;
    }

    userUtilities.forEach((u) => {
        const div = document.createElement('div');
        div.className = "bg-amber-500/5 border border-amber-500/10 dark:border-white/5 p-4 rounded-xl shadow-sm flex flex-col gap-1 group relative overflow-hidden transition-all hover:border-amber-500/30";

        const style = getUtenzaIcon(u.type);

        div.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 ${style.bg} ${style.color} rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-base">${style.icon}</span>
                    </div>
                    <label class="text-[10px] uppercase font-bold tracking-wider ${style.color}">${u.type || 'Utenza'}</label>
                </div>
            </div>
            <div class="glass-field glass-field-amber group/field mt-1 flex items-center justify-between">
                <p class="text-sm font-bold text-slate-900 dark:text-white truncate flex-1 min-h-[1.25rem]">${u.value || '-'}</p>
                <button class="text-amber-500 opacity-100 sm:opacity-0 sm:group-hover/field:opacity-100 transition-opacity" 
                    onclick="navigator.clipboard.writeText('${(u.value || '').replace(/'/g, "\\'")}').then(() => showToast('Copiato!'))">
                    <span class="material-symbols-outlined text-lg">content_copy</span>
                </button>
            </div>
            ${u.notes ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-2 italic pl-1">${u.notes}</p>` : ''}
        `;
        container.appendChild(div);
    });
}

function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (userDocuments.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-2 text-center">
                <p class="text-sm text-slate-400 italic">Nessun documento registrato</p>
            </div>`;
        return;
    }

    userDocuments.forEach((doc) => {
        const div = document.createElement('div');
        div.className = "bg-violet-500/5 border border-violet-500/10 dark:border-white/5 p-4 rounded-xl shadow-sm flex flex-col gap-3 group relative overflow-hidden transition-all hover:border-violet-500/30";

        const style = getDocumentIcon(doc.type);
        const fields = getFieldsForDocType(doc.type);

        let fieldsHtml = '';
        fields.forEach(f => {
            if (doc[f.key]) {
                let val = doc[f.key];
                if (f.key.includes('date')) val = formatDateToIT(val);
                fieldsHtml += `
                    <div>
                        <span class="text-[9px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider block mb-0.5">${f.label}</span>
                        <p class="text-sm font-medium text-slate-900 dark:text-white">${val}</p>
                    </div>
                 `;
            }
        });

        div.innerHTML = `
            <div class="flex justify-between items-center mb-1 border-b border-violet-500/10 pb-2">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 ${style.bg} ${style.color} rounded-lg flex items-center justify-center">
                        <span class="material-symbols-outlined text-lg">${style.icon}</span>
                    </div>
                    <label class="font-bold text-sm ${style.color}">${doc.type || 'Documento'}</label>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                ${fieldsHtml}
            </div>
             ${doc.notes ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 italic border-t border-violet-500/10 pt-2">${doc.notes}</p>` : ''}
        `;
        container.appendChild(div);
    });
}

// --- MAIN LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Basic Info
        setText('profile-email', user.email);
        const avatar = document.getElementById('profile-avatar');
        if (user.photoURL && avatar) avatar.src = user.photoURL;

        // Fetch Firestore Data
        const docRef = doc(db, "users", user.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            const fullName = `${data.nome || ''} ${data.cognome || ''}`.trim() || "Utente";

            // Header Info
            setText('profile-name', fullName);
            document.title = fullName;

            // SECTION 1: Dati Personali
            setText('nome-view', data.nome);
            setText('cognome-view', data.cognome);
            setText('cf-view', data.cf || data.codiceFiscale);
            setText('birth_date-view', formatDateToIT(data.birth_date));
            setText('birth_place-view', `${data.birth_place || ''} ${data.birth_province ? '(' + data.birth_province + ')' : ''}`.trim());

            // SECTION 2: Residenza
            const addressFull = `${data.residence_address || ''} ${data.residence_civic || ''}`.trim();
            const cityFull = `${data.residence_cap || ''} ${data.residence_city || ''} ${data.residence_province ? '(' + data.residence_province + ')' : ''}`.trim();
            setText('field-address-full', addressFull);
            setText('field-city-full', cityFull);

            // SECTION 5: Contatti
            const mobile = data.mobile_private || '-';
            setText('mobile_private-view', mobile);

            const btnCall = document.getElementById('btn-call-mobile-sm');
            if (btnCall) {
                if (mobile !== '-') {
                    btnCall.onclick = () => window.location.href = `tel:${mobile.replace(/\s/g, '')}`;
                    btnCall.classList.remove('opacity-50', 'pointer-events-none');
                } else {
                    btnCall.classList.add('opacity-50', 'pointer-events-none');
                }
            }

            const phone = data.phone_private || '-';
            setText('phone_private-view', phone);

            const btnCallPhone = document.getElementById('btn-call-phone-sm');
            if (btnCallPhone) {
                if (phone !== '-') {
                    btnCallPhone.onclick = () => window.location.href = `tel:${phone.replace(/\s/g, '')}`;
                    btnCallPhone.classList.remove('opacity-50', 'pointer-events-none');
                } else {
                    btnCallPhone.classList.add('opacity-50', 'pointer-events-none');
                }
            }

            // SECTION 7: Note
            setText('note-view', data.note || '-');

            // --- LOAD COMPLEX DATA ---

            // Emails
            contactEmails = data.contactEmails || [];
            // Legacy support
            if (contactEmails.length === 0 && (data.email || user.email)) {
                contactEmails.push({ address: data.email || user.email, visible: true });
            }
            renderEmailsView();

            // Utenze
            userUtilities = data.utenze || [];
            renderUtenzeView();

            // Documenti
            userDocuments = data.documenti || [];
            renderDocumentiView();


            // QR Code Generation
            const qrContainer = document.getElementById('qrcode');
            if (typeof QRCode !== 'undefined' && qrContainer) {
                qrContainer.innerHTML = '';
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nTEL;TYPE=CELL:${mobile}\nEMAIL:${user.email}\nEND:VCARD`;
                new QRCode(qrContainer, {
                    text: vcard,
                    width: 128,
                    height: 128,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }

        } else {
            console.warn("User doc not found");
            setText('profile-name', "Profilo non completato");
        }

    } catch (e) {
        console.error("Profile load error", e);
        setText('profile-name', "Errore Caricamento");
    }
});
