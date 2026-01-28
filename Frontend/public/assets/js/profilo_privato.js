import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { storage } from './firebase-config.js'; // Added storage import
import { t } from './translations.js';

/**
 * PROFILO PRIVATO MODULE (Titanium Account V3.0)
 */

let currentUserUid = null;
let currentUserData = {};
let contactEmails = [];
let userUtilities = [];
let userDocuments = [];
let contactPhones = []; // New Dynamic Phones Array
let userAddresses = []; // New Dynamic Addresses Array

document.addEventListener('DOMContentLoaded', () => {
    setupAccordions();
    setupAvatarEdit();
});

// Helper for Toast Notifications (Protocol Compliance)
function notify(msg, type = 'success') {
    if (window.showToast) window.showToast(msg, type);
    else console.log(`[${type}] ${msg}`);
}

// --- LOGIC: SECTION EDIT (SEQUENTIAL MODALS) ---
window.editSection = async (section) => {
    if (!currentUserUid) return;

    try {
        if (section === 'dati-personali') {
            const nome = await window.showInputModal("Nome", currentUserData.nome || "");
            if (nome === null) return;

            const cognome = await window.showInputModal("Cognome", currentUserData.cognome || "");
            if (cognome === null) return;

            const cf = await window.showInputModal("Codice Fiscale", currentUserData.cf || currentUserData.codiceFiscale || "");
            if (cf === null) return;

            const nascita = await window.showInputModal("Data Nascita (AAAA-MM-GG)", currentUserData.birth_date || "");
            if (nascita === null) return;

            const l_nasc = await window.showInputModal("Luogo di Nascita", currentUserData.birth_place || "");
            if (l_nasc === null) return;

            const p_nasc = await window.showInputModal("Provincia Nascita (XX)", currentUserData.birth_province || "");
            if (p_nasc === null) return;

            await updateDoc(doc(db, "users", currentUserUid), {
                nome: nome.trim(),
                cognome: cognome.trim(),
                cf: cf.trim().toUpperCase(),
                birth_date: nascita.trim(),
                birth_place: l_nasc.trim(),
                birth_province: p_nasc.trim().toUpperCase()
            });
            window.location.reload();
        }

        // Legacy 'residenza' section removed in favor of dynamic list

        // Legacy 'contatti' section removed in favor of dynamic list

        if (section === 'note') {
            const note = await window.showInputModal("Note Anagrafica", currentUserData.note || "");
            if (note === null) return;

            await updateDoc(doc(db, "users", currentUserUid), {
                note: note.trim()
            });
            window.location.reload();
        }

    } catch (e) {
        console.error("Edit error:", e);
        notify("Errore durante il salvataggio: " + e.message, 'error');
    }
};

function setupAvatarEdit() {
    const input = document.getElementById('avatar-input');
    if (!input) return;

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUserUid) return;

        notify("Caricamento avatar...", 'info');

        try {
            const storageRef = ref(storage, `users/${currentUserUid}/avatar_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update Firestore
            await updateDoc(doc(db, "users", currentUserUid), {
                photoURL: downloadURL
            });

            // Update UI immediately and reload
            const avatarImg = document.getElementById('profile-avatar');
            if (avatarImg) avatarImg.src = downloadURL;

            notify("Avatar aggiornato con successo!");
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Avatar upload error:", error);
            notify("Errore durante l'upload dell'avatar", 'error');
        }
    };
}


// --- STATE ---
// (Variables moved to top)

// --- LOGIC: ACCORDIONS ---
function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.addEventListener('click', () => {
            const targetId = acc.dataset.target;
            const content = document.getElementById(targetId);
            const chevron = acc.querySelector('.settings-chevron');
            if (!content) return;

            const isVisible = content.classList.contains('show');

            if (isVisible) {
                content.classList.remove('show');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            } else {
                content.classList.add('show');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            }
        });
    });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '-';
}

function formatDateToIT(val) {
    if (!val || val === '-') return '-';
    try {
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = val.split('-');
            return `${d}/${m}/${y}`;
        }
    } catch (e) { console.warn("Date format error", e); }
    return val;
}

// ... RENDERING FUNCTIONS (renderEmailsView, renderUtenzeView, renderDocumentiView) ...

function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    container.innerHTML = '';

    const visibleEmails = contactEmails.filter(e => e.visible);

    // Add New Email Button (Top)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add</span> Aggiungi Email`;
    addBtn.onclick = () => window.openAddEmailModal();
    container.appendChild(addBtn);

    if (visibleEmails.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = "text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;";
        p.textContent = "Nessuna email visibile";
        container.appendChild(p);
        return;
    }

    visibleEmails.forEach(e => {
        const index = contactEmails.indexOf(e);
        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-cyan";

        // Inner wrapper for content layout
        const contentWrapperStyle = "display:flex; flex-direction:column; gap:1rem; width:100%;";

        let passwordHtml = '';
        if (e.password) {
            passwordHtml = `
                <div style="width:100%; margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                    <span class="field-label" style="display:block; margin-bottom:0.5rem; opacity:0.7;">Password</span>
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <span class="field-value" style="font-family:monospace;">********</span>
                        <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                             <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                                onclick="event.preventDefault(); window.editContactEmailPassword(${index})">
                                <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
                            </button>
                             <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                                onclick="event.preventDefault(); const txt = this.parentElement.previousElementSibling; 
                                         const isMasked = txt.textContent === '********';
                                         txt.textContent = isMasked ? '${e.password.replace(/'/g, "\\'")}' : '********';
                                         this.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';">
                                <span class="material-symbols-outlined" style="font-size:18px;">visibility_off</span>
                            </button>
                             <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                                onclick="event.preventDefault(); navigator.clipboard.writeText('${e.password.replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                                <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Attachments Logic
        let attachmentsHtml = '<span class="field-value" style="opacity:0.7;">-</span>';
        if (e.attachments && e.attachments.length > 0) {
            attachmentsHtml = `<div style="display:flex; flex-direction:column; gap:0.5rem;">`;
            e.attachments.forEach((att, attIndex) => {
                attachmentsHtml += `
                    <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                             <span class="material-symbols-outlined" style="font-size:16px;">attachment</span>
                             <a href="${att.url}" target="_blank" style="color:#22d3ee; text-decoration:underline; font-size:0.85rem; word-break:break-all; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${att.name}</a>
                        </div>
                        <button onclick="event.preventDefault(); window.deleteSingleAttachment(${index}, ${attIndex})" 
                                style="background:none; border:none; color:rgba(239, 68, 68, 0.8); cursor:pointer; padding:0 0.5rem;">
                             <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                        </button>
                    </div>
                `;
            });
            attachmentsHtml += `</div>`;
        }

        const attachmentsSection = `
            <div style="width:100%; margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                     <span class="field-label" style="opacity:0.7;">Allegati</span>
                     <button onclick="event.preventDefault(); window.openAttachmentManager(${index})" 
                             style="background:none; border:none; color:#22d3ee; cursor:pointer; display:flex; align-items:center;">
                        <span class="material-symbols-outlined">add_circle</span>
                     </button>
                 </div>
                 ${attachmentsHtml}
            </div>
        `;

        div.innerHTML = `
            <legend class="field-label">Email</legend>
            <div style="${contentWrapperStyle}">
                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                    <div style="display:flex; align-items:center;">
                        <input type="checkbox" class="qr-check" 
                               ${e.shareQr ? 'checked' : ''} 
                               onchange="window.toggleQrShare('emails', ${index})">
                        <span class="field-value">${e.address}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                         <button class="titanium-action-btn btn-edit" 
                                onclick="event.preventDefault(); window.editContactEmail(${index})">
                            <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
                        </button>
                         <button class="titanium-action-btn btn-delete" 
                                onclick="event.preventDefault(); window.deleteContactEmail(${index})">
                            <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                        </button>
                         <button class="titanium-action-btn btn-copy" 
                                onclick="event.preventDefault(); navigator.clipboard.writeText('${e.address.replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                            <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                        </button>
                    </div>
                </div>
                ${passwordHtml}
                ${attachmentsSection}
            </div>
        `;
        container.appendChild(div);
    });


}

// --- EDIT FUNCTIONS ---
window.openAddEmailModal = () => {
    // Create Modal HTML
    const modal = document.createElement('div');
    modal.id = 'modal-add-email';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;
    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px;">
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">Aggiungi Email</h3>
            
            <div style="display:flex; flex-direction:column; gap:1rem;">
                <input type="email" id="new-email-addr" placeholder="Indirizzo Email" 
                       style="width:100%; padding:1rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white;">
                
                <input type="text" id="new-email-pass" placeholder="Password" 
                       style="width:100%; padding:1rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white;">
                
                <div>
                    <!-- Attachments removed from creation flow -->
                </div>

                <div style="display:flex; gap:1rem; margin-top:1rem;">
                    <button onclick="window.closeAddEmailModal()" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                    <button onclick="window.saveNewEmail()" class="auth-btn" style="background:#2563eb; justify-content:center;">Salva</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.closeAddEmailModal = () => {
    const m = document.getElementById('modal-add-email');
    if (m) m.remove();
};

window.saveNewEmail = async () => {
    const addr = document.getElementById('new-email-addr').value;
    const pass = document.getElementById('new-email-pass').value;

    if (!addr) {
        notify("Inserisci l'indirizzo email.", 'error');
        return;
    }

    // Show Loading
    const btn = document.querySelector('#modal-add-email button[onclick*="saveNewEmail"]');
    btn.innerHTML = 'Salvando...';
    btn.disabled = true;

    try {
        const newEmailObj = {
            address: addr,
            password: pass || '',
            visible: true,
            attachments: []
        };

        contactEmails.push(newEmailObj);

        await updateDoc(doc(db, "users", currentUserUid), {
            contactEmails: contactEmails
        });

        window.location.reload();
    } catch (e) {
        console.error(e);
        notify("Errore salvataggio: " + e.message, 'error');
        btn.innerHTML = 'Salva';
        btn.disabled = false;
    }
};

window.editContactEmail = async (index) => {
    const e = contactEmails[index];
    if (!e) return;
    const newAddr = await window.showInputModal("Modifica Indirizzo Email", e.address);
    if (newAddr === null) return;
    e.address = newAddr.trim();
    saveEmails();
};

window.deleteContactEmail = async (index) => {
    const confirmed = await window.showConfirmModal("Eliminare questa email?");
    if (!confirmed) return;
    contactEmails.splice(index, 1);
    saveEmails();
};

window.editContactEmailPassword = async (index) => {
    const e = contactEmails[index];
    if (!e) return;
    const newPass = await window.showInputModal("Modifica Password Email", e.password || "");
    if (newPass === null) return;
    e.password = newPass.trim();
    saveEmails();
};

async function saveEmails() {
    try {
        await updateDoc(doc(db, "users", currentUserUid), {
            contactEmails: contactEmails
        });
        window.location.reload();
    } catch (err) {
        notify("Errore salvataggio: " + err.message, 'error');
    }
}

// --- REFACTORED ATTACHMENT MANAGER (Generic) ---
let managerTargetType = 'email'; // 'email' | 'document'
let currentManageIndex = null;
let currentManageAttachments = [];

window.openAttachmentManager = (index, type = 'email') => {
    currentManageIndex = index;
    managerTargetType = type;

    // Select Source
    const sourceArr = (type === 'email') ? contactEmails : userDocuments;
    const item = sourceArr[index];

    if (!item) return;

    // Deep copy
    currentManageAttachments = JSON.parse(JSON.stringify(item.attachments || []));

    const title = (type === 'email') ? "Gestisci Allegati Email" : "Gestisci Allegati Documento";
    const sub = (type === 'email') ? item.address : item.type;

    const modal = document.createElement('div');
    modal.id = 'modal-manage-attach';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;
    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px;">
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">${title}</h3>
            <p style="text-align:center; color:rgba(255,255,255,0.5); font-size:0.8rem; margin-bottom:1rem;">${sub}</p>
            
            <div id="manager-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; max-height:200px; overflow-y:auto;"></div>

            <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <button class="auth-btn" style="flex:1; justify-content:center; background:rgba(37, 99, 235, 0.1); border:1px dashed rgba(37, 99, 235, 0.3);" 
                        onclick="document.getElementById('manager-camera-input').click()">
                    <span class="material-symbols-outlined" style="font-size:18px; margin-right:0.5rem;">photo_camera</span>
                    Scatta
                </button>
                <button class="auth-btn" style="flex:1; justify-content:center; background:rgba(37, 99, 235, 0.1); border:1px dashed rgba(37, 99, 235, 0.3);" 
                        onclick="document.getElementById('manager-file-input').click()">
                    <span class="material-symbols-outlined" style="font-size:18px; margin-right:0.5rem;">upload_file</span>
                    Libreria
                </button>
            </div>
            
            <input type="file" id="manager-camera-input" accept="image/*" capture="environment" style="display:none" onchange="window.addManagerFile(this)">
            <input type="file" id="manager-file-input" multiple style="display:none" onchange="window.addManagerFile(this)">

            <div style="display:flex; gap:1rem;">
                <button onclick="document.getElementById('modal-manage-attach').remove()" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                <button onclick="window.saveManagerAttachments()" class="auth-btn" style="background:#2563eb; justify-content:center;">Salva</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    window.renderManagerAttachments();
};

window.renderManagerAttachments = () => {
    const list = document.getElementById('manager-list');
    if (!list) return;
    list.innerHTML = '';
    if (currentManageAttachments.length === 0) {
        list.innerHTML = `<p style="text-align:center; opacity:0.3; font-size:0.8rem; padding:1rem;">Nessun allegato</p>`;
        return;
    }
    currentManageAttachments.forEach((att, idx) => {
        const div = document.createElement('div');
        div.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:8px;";
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden;">
                <span class="material-symbols-outlined" style="font-size:16px; opacity:0.7;">description</span>
                <a href="${att.url}" target="_blank" style="color:#22d3ee; text-decoration:underline; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${att.name}</a>
            </div>
            <button onclick="window.removeManagerFile(${idx})" style="background:none; border:none; color:rgba(255,50,50,0.8); cursor:pointer; padding:2px;">
                <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>
        `;
        list.appendChild(div);
    });
};

window.removeManagerFile = (idx) => {
    currentManageAttachments.splice(idx, 1);
    window.renderManagerAttachments();
};

window.addManagerFile = async (input) => {
    if (input.files && input.files.length > 0) {
        const btn = document.querySelector('#modal-manage-attach button[onclick*="saveManagerAttachments"]');
        btn.innerHTML = 'Caricamento...';
        btn.disabled = true;

        try {
            const folder = (managerTargetType === 'email') ? 'email_attachments' : 'doc_attachments';

            for (let i = 0; i < input.files.length; i++) {
                const file = input.files[i];
                const storageRef = ref(storage, `users/${currentUserUid}/${folder}/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                currentManageAttachments.push({ name: file.name, url: url });
            }
            window.renderManagerAttachments();
        } catch (e) {
            notify("Errore upload: " + e.message, 'error');
        } finally {
            btn.innerHTML = 'Salva';
            btn.disabled = false;
            input.value = '';
        }
    }
};

window.saveManagerAttachments = async () => {
    if (currentManageIndex === null) return;

    // Select Source
    const sourceArr = (managerTargetType === 'email') ? contactEmails : userDocuments;
    const fieldName = (managerTargetType === 'email') ? 'contactEmails' : 'documenti';

    // Update local state
    sourceArr[currentManageIndex].attachments = currentManageAttachments;

    // Save to Firestore
    try {
        await updateDoc(doc(db, "users", currentUserUid), {
            [fieldName]: sourceArr
        });
        window.location.reload();
    } catch (e) {
        notify("Errore salvataggio: " + e.message, 'error');
    }
};

window.deleteSingleAttachment = async (index, attIndex, type = 'email') => {
    const confirmed = await window.showConfirmModal("Eliminare questo allegato?");
    if (!confirmed) return;

    const sourceArr = (type === 'email') ? contactEmails : userDocuments;
    const item = sourceArr[index];
    if (!item || !item.attachments) return;

    const att = item.attachments[attIndex];

    if (att && att.url) {
        try { await deleteObject(ref(storage, att.url)); } catch (e) { console.warn(e); }
    }

    item.attachments.splice(attIndex, 1);
    const fieldName = (type === 'email') ? 'contactEmails' : 'documenti';

    try {
        await updateDoc(doc(db, "users", currentUserUid), { [fieldName]: sourceArr });
        window.location.reload();
    } catch (e) { notify("Errore eliminazione: " + e.message, 'error'); }
};

window.showConfirmModal = (message) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;
        modal.innerHTML = `
            <div class="settings-vault" style="width:90%; max-width:350px; padding:2rem; background:#0f1932; border:1px solid rgba(239, 68, 68, 0.3); border-radius:20px; text-align:center;">
                <span class="material-symbols-outlined" style="font-size:48px; color:#ef4444; margin-bottom:1rem;">warning</span>
                <h3 style="color:white; margin-bottom:1rem;">Conferma Azione</h3>
                <p style="color:rgba(255,255,255,0.7); font-size:0.9rem; margin-bottom:2rem;">${message}</p>
                
                <div style="display:flex; gap:1rem; justify-content:center;">
                    <button id="confirm-no-btn" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                    <button id="confirm-yes-btn" class="auth-btn" style="background:#ef4444; justify-content:center;">Elimina</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#confirm-no-btn').onclick = () => {
            modal.remove();
            resolve(false);
        };
        modal.querySelector('#confirm-yes-btn').onclick = () => {
            modal.remove();
            resolve(true);
        };
    });
};

// --- RENDERING: ADDRESSES (DYNAMIC LIST) ---
function renderAddressesView() {
    const container = document.getElementById('indirizzi-view-container');
    if (!container) return;
    container.innerHTML = '';

    // Add Button
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add_location_alt</span> Aggiungi Indirizzo`;
    addBtn.onclick = () => window.openAddAddressModal();
    container.appendChild(addBtn);

    if (userAddresses.length === 0) {
        container.innerHTML += `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessun indirizzo registrato</p>`;
        return;
    }

    userAddresses.forEach((addr, index) => {
        const fullAddr = `${addr.address || ''} ${addr.civic || ''}`.trim();
        const cityInfo = `${addr.cap || ''} ${addr.city || ''} ${addr.province ? '(' + addr.province + ')' : ''}`.trim();

        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-emerald";
        div.style.marginBottom = "0.75rem";
        div.innerHTML = `
            <legend class="field-label">${addr.type || 'Indirizzo'}</legend>
                <div style="display:flex; justify-content:space-between; align-items:start; width:100%; gap:0.5rem;">
                <div style="display:flex; align-items:flex-start; flex:1; min-width:0;">
                    <input type="checkbox" class="qr-check" style="margin-top:0.3rem;"
                           ${addr.shareQr ? 'checked' : ''} 
                           onchange="window.toggleQrShare('addresses', ${index})">
                    <div>
                        <div style="font-size:1.1rem; margin-bottom:0.25rem; word-break:break-word;">${fullAddr || '-'}</div>
                        <div style="font-size:0.8rem; opacity:0.7; word-break:break-word;">${cityInfo}</div>
                    </div>
                </div>
                <div class="titanium-action-grid">
                    <!-- VIEW BUTTON -->
                    <button class="titanium-action-btn btn-view" 
                            title="Visualizza Dettagli"
                            onclick="event.preventDefault(); window.showAddressDetails(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
                    </button>
                    <!-- COPY BUTTON -->
                    <button class="titanium-action-btn btn-copy" 
                            title="Copia Indirizzo"
                            onclick="event.preventDefault(); navigator.clipboard.writeText('${(fullAddr + ' ' + cityInfo).replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                        <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                    </button>
                    <!-- EDIT BUTTON -->
                    <button class="titanium-action-btn btn-edit" 
                            title="Modifica"
                            onclick="event.preventDefault(); window.editAddress(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                    </button>
                    <!-- DELETE BUTTON -->
                    <button class="titanium-action-btn btn-delete" 
                            title="Elimina"
                            onclick="event.preventDefault(); window.deleteAddress(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

window.showAddressDetails = (index) => {
    const addr = userAddresses[index];
    if (!addr) return;

    const modal = document.createElement('div');
    modal.id = 'modal-address-details';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 10000;
    `;

    // Helper to create read-only field
    const field = (label, value) => `
        <div style="margin-bottom:1rem;">
            <div style="color:rgba(255,255,255,0.5); font-size:0.75rem; text-transform:uppercase; margin-bottom:0.25rem;">${label}</div>
            <div style="color:white; font-size:1.1rem; font-weight:500;">${value || '-'}</div>
        </div>
    `;

    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <button onclick="document.getElementById('modal-address-details').remove()" 
                    style="position:absolute; top:1rem; right:1rem; background:transparent; border:none; color:white; cursor:pointer;">
                <span class="material-symbols-outlined">close</span>
            </button>
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">Dettagli Indirizzo</h3>
            
            ${field('Tipo', addr.type)}
            ${field('Indirizzo', addr.address)}
            
            <div style="display:flex; gap:1rem;">
                <div style="flex:1;">${field('Civico', addr.civic)}</div>
                <div style="flex:1;">${field('CAP', addr.cap)}</div>
            </div>

            ${field('Città', addr.city)}
            ${field('Provincia', addr.province)}

            <button onclick="document.getElementById('modal-address-details').remove()" class="auth-btn" style="width:100%; justify-content:center; margin-top:1rem;">Chiudi</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.openAddAddressModal = (editIndex = null) => {
    const isEdit = editIndex !== null;
    const data = isEdit ? userAddresses[editIndex] : { type: 'Residenza', address: '', civic: '', cap: '', city: '', province: '' };

    const modal = document.createElement('div');
    modal.id = 'modal-address';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    // Style helper
    const inputStyle = "width:100%; padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; margin-bottom:1rem;";

    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:450px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px; max-height:90vh; overflow-y:auto;">
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">${isEdit ? 'Modifica' : 'Aggiungi'} Indirizzo</h3>
            
            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Tipo</label>
            <select id="addr-type" style="${inputStyle} color:black;">
                <option value="Residenza" ${data.type === 'Residenza' ? 'selected' : ''}>Residenza</option>
                <option value="Domicilio" ${data.type === 'Domicilio' ? 'selected' : ''}>Domicilio</option>
                <option value="Lavoro" ${data.type === 'Lavoro' ? 'selected' : ''}>Lavoro</option>
                <option value="Altro" ${data.type === 'Altro' ? 'selected' : ''}>Altro</option>
            </select>

            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Via / Piazza</label>
            <input type="text" id="addr-street" value="${data.address || ''}" placeholder="Via Roma" style="${inputStyle}">

            <div style="display:flex; gap:1rem;">
                <div style="flex:1;">
                    <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Civico</label>
                    <input type="text" id="addr-civic" value="${data.civic || ''}" placeholder="10" style="${inputStyle}">
                </div>
                <div style="flex:1;">
                    <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">CAP</label>
                    <input type="text" id="addr-cap" value="${data.cap || ''}" placeholder="00100" style="${inputStyle}">
                </div>
            </div>

            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Città</label>
            <input type="text" id="addr-city" value="${data.city || ''}" placeholder="Roma" style="${inputStyle}">

            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Provincia (Sigla)</label>
            <input type="text" id="addr-prov" value="${data.province || ''}" placeholder="RM" style="${inputStyle}">

            <div style="display:flex; gap:1rem; margin-top:1rem;">
                <button onclick="document.getElementById('modal-address').remove()" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                <button onclick="window.confirmSaveAddress(${editIndex})" class="auth-btn" style="background:#2563eb; justify-content:center;">Salva</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmSaveAddress = (editIndex) => {
    const type = document.getElementById('addr-type').value;
    const address = document.getElementById('addr-street').value.trim();
    const civic = document.getElementById('addr-civic').value.trim();
    const cap = document.getElementById('addr-cap').value.trim();
    const city = document.getElementById('addr-city').value.trim();
    const prov = document.getElementById('addr-prov').value.trim().toUpperCase();

    if (!address || !city) {
        notify("Inserisci almeno Indirizzo e Città", 'error');
        return;
    }

    const newAddr = { type, address, civic, cap, city, province: prov };

    if (editIndex !== null) {
        userAddresses[editIndex] = newAddr;
    } else {
        userAddresses.push(newAddr);
    }

    document.getElementById('modal-address').remove();
    saveAddresses();
};

window.editAddress = (index) => {
    window.openAddAddressModal(index);
};

window.deleteAddress = async (index) => {
    const addr = userAddresses[index];
    if (!addr) return;

    // Generate Label to check usage
    const labelToCheck = `${addr.address}, ${addr.city} (${addr.type})`;

    // Check if used in utilities
    const usedIn = userUtilities.filter(u => u.address_label === labelToCheck);

    let msg = "Eliminare questo indirizzo?";
    if (usedIn.length > 0) {
        msg = `ATTENZIONE: Questo indirizzo è associato a ${usedIn.length} utenze. Se lo elimini, quelle utenze perderanno il riferimento. Confermi l'eliminazione?`;
    }

    const confirmed = await window.showConfirmModal(msg);
    if (!confirmed) return;

    userAddresses.splice(index, 1);
    saveAddresses();
};

async function saveAddresses() {
    try {
        // Sync Legacy Fields with first 'Residenza'
        const res = userAddresses.find(a => a.type === 'Residenza') || {}; // If empty, will save as undefined/empty which is fine or keep old? Best to sync what is there.

        // If find returns undefined, we pass empty strings to clear legacy fields if Residenza is deleted? Or keep last known?
        // Let's clear if no Residenza exists to simulate source of truth.

        await updateDoc(doc(db, "users", currentUserUid), {
            userAddresses: userAddresses,
            // Sync Legacy
            residence_address: res.address || "",
            residence_civic: res.civic || "",
            residence_cap: res.cap || "",
            residence_city: res.city || "",
            residence_province: res.province || ""
        });
        window.location.reload();
    } catch (err) {
        notify("Errore salvataggio: " + err.message, 'error');
    }
}

// --- RENDERING: PHONES (DYNAMIC LIST) ---
function renderPhonesView() {
    const container = document.getElementById('telefoni-view-container');
    if (!container) return;
    container.innerHTML = '';

    // Add Button (Top)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add_call</span> Aggiungi Numero`;
    addBtn.onclick = () => window.openAddPhoneModal();
    container.appendChild(addBtn);

    if (contactPhones.length === 0) {
        container.innerHTML += `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessun numero registrato</p>`;
        return;
    }

    contactPhones.forEach((p, index) => {
        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-rose";
        div.style.marginBottom = "0.75rem";
        div.innerHTML = `
            <legend class="field-label">${p.type || 'Telefono'}</legend>
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:0.5rem;">
                <div style="display:flex; align-items:center;">
                    <input type="checkbox" class="qr-check" 
                           ${p.shareQr ? 'checked' : ''} 
                           onchange="window.toggleQrShare('phones', ${index})">
                    <span class="field-value" style="font-size:1.1rem;">${p.number || '-'}</span>
                </div>
                <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                    <button class="titanium-action-btn btn-edit" 
                            onclick="event.preventDefault(); window.editPhone(${index})">
                        <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
                    </button>
                    <button class="titanium-action-btn btn-delete" 
                            onclick="event.preventDefault(); window.deletePhone(${index})">
                        <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                    </button>
                    <button class="titanium-action-btn btn-copy" 
                            onclick="event.preventDefault(); navigator.clipboard.writeText('${(p.number || '').replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                        <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

window.openAddPhoneModal = () => {
    const modal = document.createElement('div');
    modal.id = 'modal-add-phone';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px;">
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">Aggiungi Numero</h3>
            
            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Tipo</label>
            <select id="new-phone-type" style="width:100%; padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:black; margin-bottom:1rem;">
                <option value="Cellulare">Cellulare</option>
                <option value="Fisso">Fisso</option>
                <option value="Primario">Primario</option>
                <option value="Lavoro">Lavoro</option>
                <option value="Altro">Altro</option>
            </select>

            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Numero</label>
            <input type="tel" id="new-phone-number" placeholder="+39 ..." 
                   style="width:100%; padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; margin-bottom:1.5rem;">

            <div style="display:flex; gap:1rem;">
                <button onclick="document.getElementById('modal-add-phone').remove()" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                <button onclick="window.confirmAddPhone()" class="auth-btn" style="background:#2563eb; justify-content:center;">Salva</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmAddPhone = () => {
    const type = document.getElementById('new-phone-type').value;
    const num = document.getElementById('new-phone-number').value.trim();
    if (!num) {
        notify("Inserisci un numero valido", 'error');
        return;
    }
    contactPhones.push({ type: type, number: num });
    savePhones();
};

window.editPhone = async (index) => {
    const p = contactPhones[index];
    const newNum = await window.showInputModal(`Modifica Numero (${p.type})`, p.number);
    if (newNum !== null) {
        p.number = newNum.trim();
        savePhones();
    }
};

window.deletePhone = async (index) => {
    const confirmed = await window.showConfirmModal("Eliminare questo numero?");
    if (!confirmed) return;
    contactPhones.splice(index, 1);
    savePhones();
};

async function savePhones() {
    try {
        // Sync Legacy Fields
        let mobile = null;
        let phone = null;

        const cell = contactPhones.find(p => p.type === 'Cellulare' || p.type === 'Primario');
        if (cell) mobile = cell.number;

        const land = contactPhones.find(p => p.type === 'Fisso' || p.type === 'Lavoro');
        if (land) phone = land.number;

        await updateDoc(doc(db, "users", currentUserUid), {
            contactPhones: contactPhones,
            mobile_private: mobile, // Keep sync for backward compatibility
            phone_private: phone
        });
        window.location.reload();
    } catch (err) {
        notify("Errore salvataggio: " + err.message, 'error');
    }
}

// --- RENDERING: UTENZE ---
// --- RENDERING: UTENZE ---
function renderUtenzeView() {
    const container = document.getElementById('utenze-view-container');
    if (!container) return;
    container.innerHTML = '';

    // Add New Utenza Button (Top)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add_circle</span> Aggiungi Utenza`;
    addBtn.onclick = () => window.openUtilityModal();
    container.appendChild(addBtn);

    if (userUtilities.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = "text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;";
        p.textContent = "Nessuna utenza registrata";
        container.appendChild(p);
        return;
    }

    // Cache valid address labels
    const validLabels = userAddresses.map(a => `${a.address}, ${a.city} (${a.type})`);

    userUtilities.forEach((u, index) => {
        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-amber";
        div.style.marginBottom = "0.75rem";

        let addrHtml = '';
        if (u.address_label) {
            const isValid = validLabels.includes(u.address_label);
            const tooltip = isValid ? '' : 'Indirizzo non trovato (Cancellato o Modificato)';

            let iconElement;
            let textColor;

            if (isValid) {
                iconElement = `<span class="material-symbols-outlined" style="font-size:14px;">home</span>`;
                textColor = 'inherit';
            } else {
                // Warning: Red Circle with Yellow/Amber Triangle
                iconElement = `
                    <div style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; border:2px solid #ef4444; border-radius:50%; background:rgba(239,68,68,0.1); flex-shrink:0;">
                        <span class="material-symbols-outlined" style="font-size:16px; color:#eab308; font-variation-settings:'FILL' 1;">warning</span>
                    </div>
                `;
                textColor = '#ef4444';
            }

            addrHtml = `
                <div style="font-size:0.75rem; opacity:0.8; margin-top:0.3rem; display:flex; align-items:center; gap:0.4rem; color:${textColor};" title="${tooltip}">
                    ${iconElement} 
                    ${u.address_label}
                </div>
            `;
        }

        div.innerHTML = `
            <legend class="field-label">${u.type || 'Utenza'}</legend>
            <div style="display:flex; justify-content:space-between; align-items:start; width:100%; gap:0.5rem;">
                <div style="flex:1; min-width:0;">
                    <span class="field-value" style="font-size:1.1rem; word-break:break-all;">${u.value || '-'}</span>
                    ${addrHtml}
                </div>
                <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                    <button class="titanium-action-btn btn-edit" 
                            onclick="event.preventDefault(); window.editUtenza(${index})">
                        <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
                    </button>
                    <button class="titanium-action-btn btn-delete" 
                            onclick="event.preventDefault(); window.deleteUtenza(${index})">
                        <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                    </button>
                    <button class="titanium-action-btn btn-copy" 
                            onclick="event.preventDefault(); navigator.clipboard.writeText('${(u.value || '').replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                        <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Unified Modal for Add/Edit Utility
window.openUtilityModal = (editIndex = null) => {
    const isEdit = editIndex !== null;
    const data = isEdit ? userUtilities[editIndex] : { type: '', value: '', address_label: '' };

    // Prepare Address Options
    let addrOptions = '<option value="" style="color:black;">Nessun indirizzo collegato</option>';
    userAddresses.forEach(a => {
        const val = `${a.address}, ${a.city} (${a.type})`;
        const selected = (data.address_label === val) ? 'selected' : '';
        addrOptions += `<option value="${val}" style="color:black;" ${selected}>${a.type}: ${a.address}, ${a.city}</option>`;
    });

    const modal = document.createElement('div');
    modal.id = 'modal-utility';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    // Style helper
    const inputStyle = "width:100%; padding:0.8rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; margin-bottom:1rem;";

    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px;">
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">${isEdit ? 'Modifica' : 'Aggiungi'} Utenza</h3>
            
            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Tipo (es. Luce, Gas, POD)</label>
            <input type="text" id="util-type" value="${data.type || ''}" placeholder="Energia Elettrica" style="${inputStyle}">

            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Codice / Valore</label>
            <input type="text" id="util-value" value="${data.value || ''}" placeholder="IT001E..." style="${inputStyle}">

            <label style="display:block; color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.8rem;">Indirizzo Collegato</label>
            <select id="util-address" style="${inputStyle} color:black;">
                ${addrOptions}
            </select>

            <div style="display:flex; gap:1rem; margin-top:1rem;">
                <button onclick="document.getElementById('modal-utility').remove()" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                <button onclick="window.confirmSaveUtility(${editIndex})" class="auth-btn" style="background:#2563eb; justify-content:center;">Salva</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmSaveUtility = (editIndex) => {
    const type = document.getElementById('util-type').value.trim();
    const val = document.getElementById('util-value').value.trim();
    const addr = document.getElementById('util-address').value;

    if (!type || !val) {
        notify("Inserisci Tipo e Valore", 'error');
        return;
    }

    const newUtil = { type: type, value: val, address_label: addr };

    if (editIndex !== null) {
        userUtilities[editIndex] = newUtil;
    } else {
        userUtilities.push(newUtil);
    }

    document.getElementById('modal-utility').remove();
    saveUtenze();
};

window.editUtenza = (index) => {
    window.openUtilityModal(index);
};

window.deleteUtenza = async (index) => {
    const confirmed = await window.showConfirmModal("Eliminare questa utenza?");
    if (!confirmed) return;
    userUtilities.splice(index, 1);
    saveUtenze();
};

async function saveUtenze() {
    try {
        await updateDoc(doc(db, "users", currentUserUid), {
            utenze: userUtilities
        });
        window.location.reload();
    } catch (err) {
        notify("Errore salvataggio: " + err.message, 'error');
    }
}

// --- RENDERING: DOCUMENTI ---
function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    container.innerHTML = '';

    // Add New Document Button (Moved to TOP)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add</span> Aggiungi Documento`;
    addBtn.onclick = () => window.openAddDocumentModal();
    container.appendChild(addBtn);

    if (!userDocuments || userDocuments.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = "text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;";
        p.textContent = "Nessun documento registrato";
        container.appendChild(p);
        return;
    }

    userDocuments.forEach((docItem, index) => {
        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-violet";
        div.style.marginBottom = "1rem";

        const wrapperStyle = "display:flex; flex-direction:column; align-items:flex-start; height:auto; padding:0.5rem 0; width:100%;";

        let info = [];
        // Robust Resolution of Document Number/ID
        let num = docItem.num_serie || docItem.id_number || docItem.license_number || docItem.codice_fiscale || docItem.cf || docItem.numero || docItem.cf_value;

        // Special Case: If it's a Fiscal Code document but has no number, try to fetch from user profile
        if (!num && (docItem.type === 'Codice Fiscale' || docItem.type === 'Tessera Sanitaria')) {
            num = currentUserData.cf || currentUserData.codiceFiscale;
        }

        if (num) info.push(num);
        if (docItem.expiry_date) info.push("Scadenza: " + (window.formatDateToIT ? window.formatDateToIT(docItem.expiry_date) : docItem.expiry_date));

        // Attachments Logic
        let attachmentsHtml = '<span class="field-value" style="opacity:0.7; font-size:0.8rem;">Nessun allegato</span>';
        if (docItem.attachments && docItem.attachments.length > 0) {
            attachmentsHtml = `<div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">`;
            docItem.attachments.forEach((att, attIndex) => {
                attachmentsHtml += `
                    <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between; background:rgba(255,255,255,0.03); padding:0.4rem; border-radius:8px;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                             <span class="material-symbols-outlined" style="font-size:16px; opacity:0.7;">attachment</span>
                             <a href="${att.url}" target="_blank" style="color:#22d3ee; text-decoration:none; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${att.name}</a>
                        </div>
                        <button onclick="event.preventDefault(); window.deleteSingleAttachment(${index}, ${attIndex}, 'document')" 
                                style="background:none; border:none; color:rgba(239, 68, 68, 0.8); cursor:pointer; padding:0 0.5rem; display:flex; align-items:center;">
                             <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                        </button>
                    </div>
                `;
            });
            attachmentsHtml += `</div>`;
        }

        const attachmentsSection = `
            <div style="width:100%; margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.7rem;">
                     <span class="field-label" style="opacity:0.7; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em;">Allegati</span>
                     <button onclick="event.preventDefault(); window.openAttachmentManager(${index}, 'document')" 
                             style="background:none; border:none; color:#22d3ee; cursor:pointer; display:flex; align-items:center; gap:0.3rem; font-size:0.8rem;">
                        <span class="material-symbols-outlined" style="font-size:18px;">add_circle</span>
                        Aggiungi
                     </button>
                 </div>
                 ${attachmentsHtml}
            </div>
        `;

        div.innerHTML = `
            <legend class="field-label" style="font-weight:700; color:#a78bfa;">${docItem.type || 'Documento'}</legend>
            <div style="${wrapperStyle}">
                <div style="width:100%; display:flex; justify-content:space-between; align-items:start;">
                    <div style="display:flex; flex-direction:column; gap:0.3rem; flex:1;">
                        <span class="field-value" style="font-size:1.1rem; letter-spacing:0.02em;">${info[0] || '---'}</span>
                        <span style="font-size:0.75rem; opacity:0.6; font-weight:600; color:#94a3b8;">${info[1] || ''}</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; flex-shrink:0;">
                         <!-- VIEW BUTTON -->
                         <button class="action-view-doc" data-index="${index}" title="Visualizza Dettagli"
                                style="width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; cursor:pointer;">
                            <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
                        </button>
                         <!-- COPY BUTTON -->
                         <button style="width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; cursor:pointer;" 
                                title="Copia Numero"
                                onclick="event.preventDefault(); navigator.clipboard.writeText('${(info[0] || '').replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                            <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                        </button>
                        <!-- EDIT BUTTON -->
                        <button class="action-edit-doc" data-index="${index}" title="Modifica" 
                                style="width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(37, 99, 235, 0.2); border:1px solid rgba(37, 99, 235, 0.3); color:#60a5fa; cursor:pointer;">
                            <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                        </button>
                        <!-- DELETE BUTTON -->
                        <button class="action-delete-doc" data-index="${index}" title="Elimina" 
                                style="width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(239, 68, 68, 0.15); border:1px solid rgba(239, 68, 68, 0.3); color:#f87171; cursor:pointer;">
                            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                        </button>
                    </div>
                </div>
                ${attachmentsSection}
            </div>
        `;

        // Programmatic listeners for better stability
        div.querySelector('.action-view-doc').onclick = (e) => { e.preventDefault(); window.showDocumentDetails(index); };
        div.querySelector('.action-edit-doc').onclick = (e) => { e.preventDefault(); window.editUserDocument(index); };
        div.querySelector('.action-delete-doc').onclick = (e) => { e.preventDefault(); window.deleteUserDocument(index); };

        container.appendChild(div);
    });

}

window.deleteUserDocument = async (index) => {
    const confirmed = await window.showConfirmModal("Eliminare questo documento e i suoi allegati?");
    if (!confirmed) return;

    const docItem = userDocuments[index];
    if (docItem.attachments && docItem.attachments.length > 0) {
        await Promise.all(docItem.attachments.map(async (att) => {
            if (att.url) {
                try { await deleteObject(ref(storage, att.url)); } catch (e) { console.warn(e); }
            }
        }));
    }
    // Legacy cleanup
    if (docItem.id_url_front) try { await deleteObject(ref(storage, docItem.id_url_front)); } catch (e) { }
    if (docItem.id_url_back) try { await deleteObject(ref(storage, docItem.id_url_back)); } catch (e) { }

    userDocuments.splice(index, 1);
    try {
        await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
        window.location.reload();
    } catch (e) { notify("Errore eliminazione: " + e.message, 'error'); }
};

window.openAddDocumentModal = () => {
    const allTypes = ['Carta d\'Identità', 'Patente', 'Passaporto', 'Codice Fiscale', 'Tessera Sanitaria'];
    const available = allTypes.filter(t => !userDocuments.some(d => d.type === t));

    // Aggiungi opzione "Altro" sempre
    available.push('Altro');

    // FIX: Style color:black for options ensures visibility on white native dropdowns
    const optionsHtml = available.map(t => `<option value="${t}" style="color:black;">${t}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'modal-add-doc';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;

    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:#0f1932; border:1px solid rgba(255,255,255,0.1); border-radius:20px;">
            <h3 style="color:white; margin-bottom:1.5rem; text-align:center;">Aggiungi Documento</h3>
            
            <p style="color:rgba(255,255,255,0.6); margin-bottom:0.5rem; font-size:0.9rem;">Seleziona il tipo di documento:</p>
            <select id="new-doc-type-select" style="width:100%; padding:1rem; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; margin-bottom:1.5rem; appearance:none;">
                ${optionsHtml}
            </select>

            <div style="display:flex; gap:1rem;">
                <button onclick="document.getElementById('modal-add-doc').remove()" class="auth-btn" style="background:rgba(255,255,255,0.1); justify-content:center;">Annulla</button>
                <button onclick="window.confirmAddDocType()" class="auth-btn" style="background:#2563eb; justify-content:center;">Avanti</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmAddDocType = () => {
    const select = document.getElementById('new-doc-type-select');
    if (!select) return;
    const type = select.value;
    if (type) {
        window.initNewDocument(type);
    }
};

window.initNewDocument = async (type) => {
    const modal = document.getElementById('modal-add-doc');
    if (modal) modal.remove();

    const num = await window.showInputModal(`Numero ${type}`, "");
    if (num === null) return;

    const expiry = await window.showInputModal("Scadenza (YYYY-MM-DD)", "");
    if (expiry === null) return;

    userDocuments.push({
        type: type,
        num_serie: num,
        expiry_date: expiry,
        attachments: []
    });

    try {
        await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
        window.location.reload();
    } catch (e) { notify(e.message, 'error'); }
};

window.editUserDocument = async (index) => {
    const docItem = userDocuments[index];
    if (!docItem) return;

    const currentNum = docItem.num_serie || docItem.id_number || docItem.license_number || "";
    const newNum = await window.showInputModal(`Modifica Numero (${docItem.type})`, currentNum);

    if (newNum !== null) {
        docItem.num_serie = newNum;
        if (docItem.id_number) docItem.id_number = newNum;
        if (docItem.license_number) docItem.license_number = newNum;
    } else return;

    const newExpiry = await window.showInputModal("Modifica Scadenza (YYYY-MM-DD)", docItem.expiry_date || "");
    if (newExpiry !== null) {
        docItem.expiry_date = newExpiry;
    }

    try {
        await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
        window.location.reload();
    } catch (e) { notify("Errore modifica: " + e.message, 'error'); }
};

window.showDocumentDetails = (index) => {
    const docItem = userDocuments[index];
    if (!docItem) {
        notify("Errore: Documento non trovato.", 'error');
        return;
    }

    let fieldsHtml = '';
    const addField = (label, val) => {
        if (!val) return;
        fieldsHtml += `
            <div style="padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.05); margin-bottom:0.5rem;">
                <span style="opacity:0.5; font-size:0.7rem; text-transform:uppercase; display:block; margin-bottom:0.25rem; color:#94a3b8;">${label}</span>
                <span style="font-size:1rem; color:white; font-weight:500; word-break:break-all;">${val}</span>
            </div>
        `;
    };

    addField("Tipo Documento", docItem.type);
    addField("Numero / ID", docItem.num_serie || docItem.id_number || docItem.license_number || docItem.codice_fiscale);
    addField("Data Scadenza", window.formatDateToIT ? window.formatDateToIT(docItem.expiry_date) : docItem.expiry_date);
    addField("Data Rilascio", window.formatDateToIT ? window.formatDateToIT(docItem.emission_date) : docItem.emission_date);
    addField("Ente Rilascio", docItem.emission_body);
    addField("Luogo Rilascio", docItem.emission_place);

    let imgHtml = '';
    if (docItem.id_url_front) {
        imgHtml += `<div style="margin-top:1.2rem;"><p style="opacity:0.6; font-size:0.8rem; margin-bottom:0.5rem; color:#94a3b8;">Fronte</p><img src="${docItem.id_url_front}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 4px 12px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
    }
    if (docItem.id_url_back) {
        imgHtml += `<div style="margin-top:1.2rem;"><p style="opacity:0.6; font-size:0.8rem; margin-bottom:0.5rem; color:#94a3b8;">Retro</p><img src="${docItem.id_url_back}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 4px 12px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
    }

    const modal = document.createElement('div');
    modal.id = 'doc-details-modal';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); display:flex; align-items:center; justify-content:center; z-index:99999; padding:1.5rem;";

    modal.innerHTML = `
        <div class="settings-vault" style="width:100%; max-width:480px; max-height:85vh; overflow-y:auto; padding:2rem; background:#0f172a; border-radius:28px; border:1px solid rgba(255,255,255,0.1); position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <button id="close-doc-details-x" 
                    style="position:absolute; top:1.2rem; right:1.2rem; background:rgba(255,255,255,0.05); border:none; color:white; border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">
                <span class="material-symbols-outlined" style="font-size:24px;">close</span>
            </button>
            <h3 style="color:white; margin-bottom:1.8rem; text-align:center; font-size:1.5rem; font-weight:700; letter-spacing:-0.01em;">Dettagli Documento</h3>
            <div style="display:flex; flex-direction:column;">${fieldsHtml}</div>
            ${imgHtml}
            <button id="close-doc-details-btn" class="auth-btn" style="background:#3b82f6; width:100%; justify-content:center; margin-top:2rem; height:3.8rem; font-weight:700; font-size:1rem; border-radius:16px;">Chiudi</button>
        </div>
    `;

    document.body.appendChild(modal);

    // Explicit close handlers
    const closeFn = () => { if (modal) modal.remove(); };
    modal.querySelector('#close-doc-details-x').onclick = closeFn;
    modal.querySelector('#close-doc-details-btn').onclick = closeFn;
    modal.onclick = (e) => { if (e.target === modal) closeFn(); };
};

// --- QR CODE SHARING LOGIC ---
window.toggleQrShare = async (collection, indexOrField) => {
    try {
        if (collection === 'emails') {
            const item = contactEmails[indexOrField];
            if (item) {
                item.shareQr = !item.shareQr;
                await updateDoc(doc(db, "users", currentUserUid), { contactEmails: contactEmails });
            }
        } else if (collection === 'phones') {
            const item = contactPhones[indexOrField];
            if (item) {
                item.shareQr = !item.shareQr;
                savePhones();
            }
        } else if (collection === 'addresses') {
            const item = userAddresses[indexOrField];
            if (item) {
                item.shareQr = !item.shareQr;
                saveAddresses();
            }
        } else if (collection === 'personal') {
            if (!currentUserData.qr_personal) currentUserData.qr_personal = {};
            currentUserData.qr_personal[indexOrField] = !currentUserData.qr_personal[indexOrField];

            await updateDoc(doc(db, "users", currentUserUid), {
                qr_personal: currentUserData.qr_personal
            });
        }
    } catch (e) {
        notify("Errore salvataggio QR: " + e.message, 'error');
    }
};

function renderPersonalDataFlags() {
    const config = currentUserData.qr_personal || {};
    // Mapping: keys in qr_personal vs IDs in HTML
    const fields = [
        { key: 'nome', id: 'nome-view' },
        { key: 'cognome', id: 'cognome-view' },
        { key: 'cf', id: 'cf-view' },
        { key: 'nascita', id: 'birth_date-view' },
        { key: 'luogo', id: 'birth_place-view' }
    ];

    fields.forEach(f => {
        const valEl = document.getElementById(f.id);
        if (valEl) {
            // Check if already processed
            if (valEl.parentElement.classList.contains('qr-wrapper-row')) return;

            const parent = valEl.parentElement; // .field-item

            // Create wrapper for Checkbox + Value
            const wrapper = document.createElement('div');
            wrapper.className = 'qr-wrapper-row';
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.width = '100%';

            parent.insertBefore(wrapper, valEl);
            wrapper.appendChild(valEl);

            // Create Checkbox
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'qr-check';
            chk.checked = !!config[f.key];
            chk.onchange = () => window.toggleQrShare('personal', f.key);

            wrapper.insertBefore(chk, valEl);
        } else {
            // If toggle is called later (re-render?), update state
            const chk = document.getElementById(f.id).previousElementSibling;
            if (chk && chk.classList.contains('qr-check')) {
                chk.checked = !!config[f.key];
            }
        }
    });
}

// --- MAIN LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentUserUid = user.uid;

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();

            const fullName = `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim() || 'Utente';
            const mobile = currentUserData.mobile_private || '-';

            // Top Bar
            const firstName = currentUserData.nome || '';
            const lastName = currentUserData.cognome || '';
            setText('profile-firstname', firstName);
            setText('profile-lastname', lastName);
            // profile-email non esiste nell'HTML attuale, se lo aggiungessi servirebbe setText('profile-email', user.email);

            const avatar = document.getElementById('profile-avatar');
            if (avatar) avatar.src = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";

            // Dati Personali
            setText('nome-view', currentUserData.nome);
            setText('cognome-view', currentUserData.cognome);
            setText('cf-view', currentUserData.cf || currentUserData.codiceFiscale);
            setText('birth_date-view', formatDateToIT(currentUserData.birth_date));
            setText('birth_place-view', `${currentUserData.birth_place || ''} ${currentUserData.birth_province ? '(' + currentUserData.birth_province + ')' : ''}`.trim());

            // Render QR Flags
            renderPersonalDataFlags();

            // Residenza (Dynamic Migration)
            userAddresses = currentUserData.userAddresses || [];
            if (userAddresses.length === 0 && currentUserData.residence_address) {
                userAddresses.push({
                    type: 'Residenza',
                    address: currentUserData.residence_address,
                    civic: currentUserData.residence_civic || '',
                    cap: currentUserData.residence_cap || '',
                    city: currentUserData.residence_city || '',
                    province: currentUserData.residence_province || ''
                });
            }
            renderAddressesView();

            // Contatti
            // Contatti (Dynamic Migration)
            contactPhones = currentUserData.contactPhones || [];
            if (contactPhones.length === 0) {
                if (currentUserData.mobile_private) contactPhones.push({ type: 'Cellulare', number: currentUserData.mobile_private });
                if (currentUserData.phone_private) contactPhones.push({ type: 'Fisso', number: currentUserData.phone_private });
            }
            renderPhonesView();

            // Note
            setText('note-view', currentUserData.note || '-');

            // Complex Views
            contactEmails = currentUserData.contactEmails || [];
            if (contactEmails.length === 0 && (currentUserData.email || user.email)) {
                contactEmails.push({ address: currentUserData.email || user.email, visible: true, attachments: [] });
            }
            renderEmailsView();

            userUtilities = currentUserData.utenze || [];
            renderUtenzeView();

            userDocuments = currentUserData.documenti || [];
            renderDocumentiView();

            // QR Code Placeholder (Removed from layout)
            const qrContainer = document.getElementById('qrcode');
            if (qrContainer) qrContainer.innerHTML = '';
        }
    } catch (e) {
        console.error("Profile load error", e);
    }
});
