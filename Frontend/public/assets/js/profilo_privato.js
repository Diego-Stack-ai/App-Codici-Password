import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { storage } from './firebase-config.js'; // Added storage import
import { t } from './translations.js';

/**
 * PROFILO PRIVATO MODULE (PROTOCOLLO BASE Account V3.3)
 */

let currentUserUid = null;
let currentUserData = {};
let contactEmails = [];
let userAddresses = []; // New Dynamic Addresses Array
let contactPhones = []; // New Dynamic Phones Array
let userDocuments = [];

document.addEventListener('DOMContentLoaded', () => {
    setupAccordions();
    setupAvatarEdit();
});

// Helper for Toast Notifications (Protocol Compliance)
window.showToast = function (msg, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
        color: white; padding: 0.75rem 1.5rem; border-radius: 50px;
        font-weight: 600; font-size: 0.9rem; z-index: 100000;
        backdrop-filter: blur(10px); box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        opacity: 0; transition: opacity 0.3s, bottom 0.3s;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.bottom = '3rem';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.bottom = '2rem';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
};

function notify(msg, type = 'success') {
    window.showToast(msg, type);
}

// --- LOGIC: SECTION EDIT (UNIFIED FORM MODAL) ---
window.editSection = async (section) => {
    if (!currentUserUid) return;

    try {
        if (section === 'dati-personali') {
            const result = await window.showFormModal("Modifica Dati Personali", [
                { id: 'nome', label: 'Nome', value: currentUserData.nome || "", type: 'text' },
                { id: 'cognome', label: 'Cognome', value: currentUserData.cognome || "", type: 'text' },
                { id: 'cf', label: 'Codice Fiscale', value: currentUserData.cf || currentUserData.codiceFiscale || "", type: 'text', transform: 'uppercase' },
                { id: 'nascita', label: 'Data Nascita (AAAA-MM-GG)', value: currentUserData.birth_date || "", type: 'date' },
                { id: 'luogo', label: 'Luogo di Nascita', value: currentUserData.birth_place || "", type: 'text' },
                { id: 'prov', label: 'Provincia Nascita (XX)', value: currentUserData.birth_province || "", type: 'text', transform: 'uppercase', maxLength: 2 }
            ]);

            if (result) {
                await updateDoc(doc(db, "users", currentUserUid), {
                    nome: result.nome.trim(),
                    cognome: result.cognome.trim(),
                    cf: result.cf.trim().toUpperCase(),
                    birth_date: result.nascita.trim(),
                    birth_place: result.luogo.trim(),
                    birth_province: result.prov.trim().toUpperCase()
                });
                window.location.reload();
            }
        }

        if (section === 'note') {
            const result = await window.showFormModal("Note Anagrafica", [
                { id: 'note', label: 'Note', value: currentUserData.note || "", type: 'textarea' }
            ]);

            if (result) {
                await updateDoc(doc(db, "users", currentUserUid), {
                    note: result.note.trim()
                });
                window.location.reload();
            }
        }

        if (section === 'residenza') {
            // Sezione globale residenza (se servisse un edit massivo, ma ora è gestito per singolo item)
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

// --- LOGIC: ACCORDIONS (Rule 3.4 compliance) ---
window.setupAccordions = function () {
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        // Remove existing to avoid double listeners if re-rendered
        acc.replaceWith(acc.cloneNode(true));
    });

    document.querySelectorAll('.accordion-header').forEach(acc => {
        acc.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = acc.dataset.target;
            const content = document.getElementById(targetId);
            if (!content) return;

            const isVisible = content.classList.contains('show');
            if (isVisible) {
                content.classList.remove('show');
            } else {
                content.classList.add('show');
            }
        });
    });
}

function setText(id, text, skipCopy = false) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text || '-';
        // Aggiungi pulsante di copia se non è un placeholder e non è richiesto lo skip
        if (!skipCopy && text && text !== '-') {
            addCopyButtonToField(id);
        }
    }
}

function addCopyButtonToField(id) {
    const el = document.getElementById(id);
    if (!el) return;

    const parent = el.parentNode;
    if (!parent) return;

    if (parent.querySelector('.btn-copy-inline')) return;

    const btn = document.createElement('button');
    btn.className = 'btn-copy-inline';
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>';
    btn.onclick = (e) => {
        e.stopPropagation();
        const textToCopy = el.textContent;
        if (textToCopy && textToCopy !== '-') {
            navigator.clipboard.writeText(textToCopy).then(() => window.showToast('Copiato!'));
        }
    };

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'space-between';
    wrapper.style.width = '100%';
    wrapper.style.gap = '0.5rem';

    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(btn);
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

    // 1. ADD PANE (Internal Pane V3.0) - ULTRA PREMIUM DESIGN
    const addPane = document.createElement('div');
    addPane.id = 'pane-add-email';
    addPane.className = 'accordion-content';
    addPane.innerHTML = `
        <div class="settings-group" style="margin-top:0.5rem; margin-bottom:2rem; padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--surface-vault); backdrop-filter:blur(20px); border-radius:24px; position:relative;">
            <!-- Glow Background Effect -->
            <div style="position:absolute; top:-20%; left:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <h4 style="color:var(--text-primary); margin-bottom:1.2rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; font-weight:800;">Nuovo Account Email</h4>
                <div style="display:grid; gap:1rem;">
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Indirizzo Email</label>
                        <input type="email" id="new-email-addr" placeholder="esempio@dominio.it" class="base-input">
                    </div>
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Password Dedicata</label>
                        <input type="text" id="new-email-pass" placeholder="Password per l'invio" class="base-input">
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-email').classList.remove('show')" class="base-btn-secondary" style="flex:1;">ANNULLA</button>
                    <button onclick="window.saveNewEmail()" class="base-btn-primary" style="flex:1;">SALVA</button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(addPane);

    // 2. Add New Email Button (Trigger for Pane)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn accordion-header';
    addBtn.dataset.target = 'pane-add-email';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem; width:100%;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">alternate_email</span> Aggiungi Email`;
    container.appendChild(addBtn);

    const visibleEmails = contactEmails.filter(e => e.visible);

    if (visibleEmails.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = "text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;";
        p.textContent = "Nessuna email visibile";
        container.appendChild(p);
        window.setupAccordions();
        return;
    }

    visibleEmails.forEach(e => {
        const index = contactEmails.indexOf(e);
        const div = document.createElement('fieldset');
        div.className = "glass-field-base glass-field-cyan";

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
                    <div style="display:flex; align-items:center; gap:1.2rem; flex:1; min-width:0;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0;">
                            <span style="font-size:0.55rem; font-weight:900; color:#3b82f6; letter-spacing:0.02em;">QR</span>
                            <input type="checkbox" class="qr-check" style="margin:0; width:14px; height:14px;" 
                                ${e.shareQr ? 'checked' : ''} 
                                onchange="window.toggleQrShare('emails', ${index})">
                        </div>
                        <span class="field-value" style="word-break:break-all;">${e.address}</span>
                    </div>
                    <div class="base-action-grid">
                         <button class="base-action-btn btn-edit" 
                                 onclick="event.preventDefault(); window.editEmail(${index})">
                             <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                         </button>
                         <button class="base-action-btn btn-delete" 
                                 onclick="event.preventDefault(); window.deleteEmail(${index})">
                             <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                         </button>
                         <button class="base-action-btn btn-copy" 
                                 onclick="event.preventDefault(); navigator.clipboard.writeText('${e.address.replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                            <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
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
// DEPRECATED: Modals removed in favor of Internal Panes V3.0

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

    const btn = document.querySelector('#pane-add-email .titanium-btn-primary');
    if (btn) {
        btn.textContent = 'SALVANDO...';
        btn.disabled = true;
    }

    try {
        contactEmails.push({
            address: addr,
            password: pass || '',
            visible: true,
            attachments: []
        });

        await updateDoc(doc(db, "users", currentUserUid), { contactEmails });
        window.location.reload();
    } catch (e) {
        notify("Errore: " + e.message, 'error');
        if (btn) {
            btn.textContent = 'SALVA ACCOUNT';
            btn.disabled = false;
        }
    }
};

window.editEmail = async (index) => {
    const e = contactEmails[index];
    if (!e) return;

    const result = await window.showFormModal("Modifica Email", [
        { id: 'address', label: 'Indirizzo Email', value: e.address, type: 'email' },
        { id: 'password', label: 'Password Dedicata', value: e.password || "", type: 'text' }
    ]);

    if (result) {
        e.address = result.address.trim();
        e.password = result.password.trim();
        saveEmails();
    }
};

window.deleteContactEmail = async (index) => {
    const confirmed = await window.showConfirmModal("Eliminare questa email?");
    if (!confirmed) return;
    contactEmails.splice(index, 1);
    saveEmails();
};

window.editContactEmailPassword = async (index) => {
    // Deprecated: password is now in the main editEmail form
    window.editEmail(index);
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
let currentManageParentIndex = null; // Used for nested items like utilities in addresses
let currentManageAttachments = [];

window.openAttachmentManager = (index, type = 'email', parentIndex = null) => {
    currentManageIndex = index;
    currentManageParentIndex = parentIndex;
    managerTargetType = type;

    let sourceArr, item, title, sub;
    if (type === 'email') {
        sourceArr = contactEmails;
        item = sourceArr[index];
        title = "Gestisci Allegati Email";
        sub = item?.address || '';
    } else if (type === 'document') {
        sourceArr = userDocuments;
        item = sourceArr[index];
        title = "Gestisci Allegati Documento";
        sub = item?.type || '';
        sub = item?.type || '';
    } else if (type === 'utility') {
        sourceArr = userAddresses[parentIndex].utilities;
        item = sourceArr[index];
        title = "Gestisci Allegati Utenza";
        sub = item?.type || '';
    }

    if (!item) return;
    currentManageAttachments = JSON.parse(JSON.stringify(item.attachments || []));

    const modal = document.createElement('div');
    modal.id = 'modal-manage-attach';
    modal.className = 'base-modal-overlay';
    modal.innerHTML = `
        <div class="settings-vault" style="width:100%; max-width:400px; padding:2rem; position:relative; overflow:hidden;">
            <!-- Glow Effect -->
            <div style="position:absolute; top:-10%; left:-10%; width:200px; height:200px; background:radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
            
            <h3 style="color:var(--text-primary); margin-bottom:1rem; text-align:center; position:relative; z-index:1;">${title}</h3>
            <p style="text-align:center; color:var(--text-secondary); font-size:0.8rem; margin-bottom:1.5rem; position:relative; z-index:1;">${sub}</p>
            
            <div id="manager-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1.5rem; max-height:200px; overflow-y:auto; position:relative; z-index:1;"></div>

            <div style="display:flex; gap:0.75rem; margin-bottom:1.5rem; position:relative; z-index:1;">
                <button class="base-btn-secondary" style="flex:1; font-size:0.85rem;" onclick="document.getElementById('manager-camera-input').click()">
                    <span class="material-symbols-outlined" style="font-size:18px;">photo_camera</span> Scatta
                </button>
                <button class="base-btn-secondary" style="flex:1; font-size:0.85rem;" onclick="document.getElementById('manager-file-input').click()">
                    <span class="material-symbols-outlined" style="font-size:18px;">upload_file</span> Libreria
                </button>
            </div>
            
            <input type="file" id="manager-camera-input" accept="image/*" capture="environment" style="display:none" onchange="window.addManagerFile(this)">
            <input type="file" id="manager-file-input" multiple style="display:none" onchange="window.addManagerFile(this)">

            <div style="display:flex; gap:1rem; position:relative; z-index:1;">
                <button onclick="document.getElementById('modal-manage-attach').remove()" class="base-btn-secondary" style="flex:1;">Annulla</button>
                <button onclick="window.saveManagerAttachments()" class="base-btn-primary" style="flex:1;">Salva</button>
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
        div.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:var(--surface-sub); border:1px solid var(--border-color); padding:0.5rem; border-radius:8px;";
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
            let folder;
            if (managerTargetType === 'email') folder = 'email_attachments';
            else if (managerTargetType === 'document') folder = 'doc_attachments';
            else if (managerTargetType === 'utility') folder = 'utility_attachments';

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
    let sourceArr, fieldName;
    if (managerTargetType === 'email') {
        sourceArr = contactEmails;
        fieldName = 'contactEmails';
    } else if (managerTargetType === 'document') {
        sourceArr = userDocuments;
        fieldName = 'documenti';
    } else if (managerTargetType === 'utility') {
        sourceArr = userAddresses[currentManageParentIndex].utilities;
        fieldName = 'userAddresses';
    }

    // Update local state
    sourceArr[currentManageIndex].attachments = currentManageAttachments;

    // Save to Firestore
    try {
        const payload = managerTargetType === 'utility' ? { userAddresses } : { [fieldName]: sourceArr };
        await updateDoc(doc(db, "users", currentUserUid), payload);
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
        modal.className = 'base-modal-overlay';
        modal.innerHTML = `
            <div class="settings-vault" style="width:100%; max-width:350px; padding:2.5rem 2rem; border:1px solid rgba(239, 68, 68, 0.2); position:relative; overflow:hidden; text-align:center;">
                <div style="position:absolute; top:-10%; left:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%); filter:blur(30px); pointer-events:none;"></div>
                
                <span class="material-symbols-outlined" style="font-size:48px; color:#ef4444; margin-bottom:1rem; position:relative; z-index:1;">warning</span>
                <h3 style="color:var(--text-primary); margin-bottom:0.75rem; position:relative; z-index:1;">Conferma Azione</h3>
                <p style="color:var(--text-secondary); font-size:0.95rem; margin-bottom:2rem; position:relative; z-index:1; line-height:1.5;">${message}</p>
                
                <div style="display:flex; gap:1rem; justify-content:center; position:relative; z-index:1;">
                    <button id="confirm-no-btn" class="base-btn-secondary" style="flex:1;">Annulla</button>
                    <button id="confirm-yes-btn" class="base-btn-primary" style="flex:1; background:linear-gradient(135deg, #dc2626, #ef4444); box-shadow:0 10px 20px -5px rgba(239, 68, 68, 0.4);">Elimina</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#confirm-no-btn').onclick = () => { modal.remove(); resolve(false); };
        modal.querySelector('#confirm-yes-btn').onclick = () => { modal.remove(); resolve(true); };
    });
};

window.showFormModal = (title, fields) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'dynamic-form-modal';
        modal.className = 'base-modal-overlay';

        let fieldsHtml = '';
        fields.forEach(f => {
            const type = f.type || 'text';
            const extraStyles = f.transform === 'uppercase' ? 'text-transform: uppercase;' : '';
            const maxLength = f.maxLength ? `maxlength="${f.maxLength}"` : '';

            if (type === 'select' && f.options) {
                fieldsHtml += `
                    <div class="glass-field-base" style="margin-bottom:1rem;">
                        <label class="field-label" style="color:var(--text-secondary);">${f.label}</label>
                        <select id="modal-field-${f.id}" class="base-input">
                            ${f.options.map(opt => `<option value="${opt}" ${opt === f.value ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else if (type === 'textarea') {
                fieldsHtml += `
                    <div class="glass-field-base" style="margin-bottom:1rem;">
                        <label class="field-label" style="color:var(--text-secondary);">${f.label}</label>
                        <textarea id="modal-field-${f.id}" class="base-input" style="min-height:80px; resize:none;">${f.value}</textarea>
                    </div>
                `;
            } else {
                fieldsHtml += `
                    <div class="glass-field-base" style="margin-bottom:1rem;">
                        <label class="field-label" style="color:var(--text-secondary);">${f.label}</label>
                        <input type="${type}" id="modal-field-${f.id}" value="${f.value}" ${maxLength} class="base-input" style="${extraStyles}">
                    </div>
                `;
            }
        });

        modal.innerHTML = `
            <div class="settings-vault" style="width:100%; max-width:450px; padding:2rem; position:relative; overflow:hidden;">
                <!-- Contextual Background Glow -->
                <div style="position:absolute; top:-10%; right:-10%; width:200px; height:200px; background:radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
                
                <h3 style="color:var(--text-primary); margin-bottom:1.5rem; text-align:center; position:relative; z-index:1;">${title}</h3>
                <div style="max-height:60vh; overflow-y:auto; padding-right:5px; position:relative; z-index:1;">
                    ${fieldsHtml}
                </div>
                <div style="display:flex; gap:1rem; margin-top:2rem; position:relative; z-index:1;">
                    <button id="modal-cancel-btn" class="base-btn-secondary" style="flex:1;">ANNULLA</button>
                    <button id="modal-confirm-btn" class="base-btn-primary" style="flex:1;">SALVA</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#modal-cancel-btn').onclick = () => {
            modal.remove();
            resolve(null);
        };

        modal.querySelector('#modal-confirm-btn').onclick = () => {
            const result = {};
            fields.forEach(f => {
                result[f.id] = document.getElementById(`modal-field-${f.id}`).value;
            });
            modal.remove();
            resolve(result);
        };
    });
};

window.showInputModal = (title, initialValue = '') => {
    return window.showFormModal(title, [{ id: 'val', label: 'Valore', value: initialValue, type: 'text' }])
        .then(res => res ? res.val : null);
};


// --- RENDERING: ADDRESSES (DYNAMIC LIST) ---
function renderAddressesView() {
    const container = document.getElementById('indirizzi-view-container');
    if (!container) return;
    container.innerHTML = '';

    // 1. ADD PANE (Internal Pane V3.0) - ULTRA PREMIUM DESIGN
    const addPane = document.createElement('div');
    addPane.id = 'pane-add-address';
    addPane.className = 'accordion-content';
    addPane.innerHTML = `
        <div class="settings-group" style="margin-top:0.5rem; margin-bottom:2rem; padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--surface-vault); backdrop-filter:blur(20px); border-radius:24px; position:relative;">
            <!-- Glow Background Effect -->
            <div style="position:absolute; top:-20%; left:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <h4 style="color:var(--text-primary); margin-bottom:1.2rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; font-weight:800;">Nuovo Indirizzo</h4>
                <div style="display:grid; gap:1rem;">
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Tipo Unità</label>
                        <select id="addr-type" class="base-input">
                            <option value="Residenza">Residenza</option>
                            <option value="Domicilio">Domicilio</option>
                            <option value="Lavoro">Lavoro</option>
                            <option value="Altro">Altro</option>
                        </select>
                    </div>
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Via / Piazza</label>
                        <input type="text" id="addr-street" placeholder="Es. Via Roma" class="base-input">
                    </div>
                    <div class="base-responsive-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                         <div class="glass-field-base">
                            <label class="field-label" style="color:var(--text-secondary);">Civico</label>
                            <input type="text" id="addr-civic" placeholder="Es. 10/A" class="base-input">
                        </div>
                        <div class="glass-field-base">
                            <label class="field-label" style="color:var(--text-secondary);">CAP</label>
                            <input type="text" id="addr-cap" placeholder="Es. 35030" class="base-input">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.75rem;">
                         <div class="glass-field-base">
                            <label class="field-label" style="color:var(--text-secondary);">Città</label>
                            <input type="text" id="addr-city" placeholder="Es. Padova" class="base-input">
                        </div>
                        <div class="glass-field-base">
                            <label class="field-label" style="color:var(--text-secondary);">Prov.</label>
                            <input type="text" id="addr-prov" placeholder="PD" class="base-input" maxlength="2" style="text-transform:uppercase;">
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-address').classList.remove('show')" class="base-btn-secondary" style="flex:1;">ANNULLA</button>
                    <button onclick="window.confirmSaveAddress(null)" class="base-btn-primary" style="flex:1;">SALVA</button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(addPane);

    // 2. Add Button (Trigger for Pane)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn accordion-header';
    addBtn.dataset.target = 'pane-add-address';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem; width:100%;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add_location_alt</span> Aggiungi Indirizzo`;
    container.appendChild(addBtn);

    if (userAddresses.length === 0) {
        container.innerHTML += `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessun indirizzo registrato</p>`;
        window.setupAccordions();
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
                <div style="display:flex; align-items:flex-start; flex:1; min-width:0; gap:1.2rem;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0; margin-top:0.3rem;">
                        <span style="font-size:0.55rem; font-weight:900; color:#3b82f6; letter-spacing:0.02em;">QR</span>
                        <input type="checkbox" class="qr-check" style="margin:0; width:14px; height:14px;"
                               ${addr.shareQr ? 'checked' : ''} 
                               onchange="window.toggleQrShare('addresses', ${index})">
                    </div>
                    <div>
                        <div style="font-size:0.95rem; font-weight:700; margin-bottom:0.25rem; word-break:break-word;">${fullAddr || '-'}</div>
                        <div style="font-size:0.75rem; opacity:0.7; word-break:break-word;">${cityInfo}</div>
                    </div>
                </div>
                <div class="base-action-grid">
                    <button class="base-action-btn btn-view" 
                            title="Visualizza Dettagli"
                            onclick="event.preventDefault(); window.showAddressDetails(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
                    </button>
                    <button class="base-action-btn btn-copy" 
                            title="Copia Indirizzo"
                            onclick="event.preventDefault(); navigator.clipboard.writeText('${(fullAddr + ' ' + cityInfo).replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                        <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                    </button>
                    <button class="base-action-btn btn-edit" 
                            title="Modifica"
                            onclick="event.preventDefault(); window.editAddress(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                    </button>
                    <button class="base-action-btn btn-delete" 
                            title="Elimina"
                            onclick="event.preventDefault(); window.deleteAddress(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                    </button>
                </div>
            </div>
            
            <!-- SEZIONE UTENZE DENTRO L'INDIRIZZO -->
            <div id="utenze-container-${index}" style="margin-top:1.5rem; padding-top:1.2rem; border-top:1px dashed rgba(255,255,255,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span class="material-symbols-outlined" style="font-size:18px; color:var(--primary-blue);">bolt</span>
                        <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-secondary);">Utenze Associate</span>
                    </div>
                    <button onclick="event.preventDefault(); window.openAddUtilityPane(${index})" 
                            style="background:rgba(34, 211, 238, 0.1); border:1px solid rgba(34, 211, 238, 0.2); color:#22d3ee; border-radius:8px; padding:4px 8px; font-size:0.7rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        <span class="material-symbols-outlined" style="font-size:14px;">add</span> AGGIUNGI
                    </button>
                </div>
                
                <div id="pane-add-utility-${index}" class="accordion-content" style="margin-bottom:1rem;">
                    <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:16px; border:1px solid var(--border-color);">
                        <div style="display:grid; gap:0.75rem;">
                            <input type="text" id="util-type-${index}" placeholder="Tipo (Luce, Gas...)" class="base-input" style="font-size:0.85rem; padding:0.6rem;">
                            <input type="text" id="util-value-${index}" placeholder="Codice POD/PDR" class="base-input" style="font-size:0.85rem; padding:0.6rem; font-family:monospace;">
                            <div style="display:flex; gap:0.5rem;">
                                <button onclick="window.closeAddUtilityPane(${index})" class="base-btn-secondary" style="flex:1; padding:0.5rem; font-size:0.75rem;">ANNULLA</button>
                                <button onclick="window.confirmSaveUtility(${index})" class="base-btn-primary" style="flex:1; padding:0.5rem; font-size:0.75rem;">SALVA</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="utilities-list-${index}" class="flex-col-gap-3">
                    <!-- Lista Renderizzata via JS -->
                </div>
            </div>
        `;
        container.appendChild(div);
        renderUtilitiesInAddress(index);
    });
}

window.openAddUtilityPane = (index) => {
    document.getElementById(`pane-add-utility-${index}`).classList.add('show');
};

window.closeAddUtilityPane = (index) => {
    document.getElementById(`pane-add-utility-${index}`).classList.remove('show');
    document.getElementById(`util-type-${index}`).value = '';
    document.getElementById(`util-value-${index}`).value = '';
};

function renderUtilitiesInAddress(addrIndex) {
    const container = document.getElementById(`utilities-list-${addrIndex}`);
    if (!container) return;
    container.innerHTML = '';

    const addr = userAddresses[addrIndex];
    const utils = addr.utilities || [];

    if (utils.length === 0) {
        container.innerHTML = `<p style="text-align:center; opacity:0.3; font-size:0.7rem; padding:0.5rem;">Nessuna utenza per questo indirizzo</p>`;
        return;
    }

    utils.forEach((u, uIdx) => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; flex-direction:column; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:0.8rem; border-radius:12px; gap:0.5rem;";

        let attachmentsHtml = '';
        if (u.attachments && u.attachments.length > 0) {
            u.attachments.forEach(att => {
                attachmentsHtml += `
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.2rem;">
                        <span class="material-symbols-outlined" style="font-size:14px; opacity:0.6;">attachment</span>
                        <a href="${att.url}" target="_blank" style="color:#22d3ee; font-size:0.75rem; text-decoration:underline; word-break:break-all;">${att.name}</a>
                    </div>
                `;
            });
        }

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:0.6rem; text-transform:uppercase; font-weight:800; color:var(--text-secondary); margin-bottom:2px;">${u.type}</div>
                    <div style="font-size:0.85rem; font-weight:600; font-family:monospace; word-break:break-all;">${u.value}</div>
                </div>
                <div style="display:flex; gap:0.4rem;">
                    <button class="base-action-btn" onclick="window.openAttachmentManager(${uIdx}, 'utility', ${addrIndex})" style="color:#22d3ee; background:none; border:none; cursor:pointer;"><span class="material-symbols-outlined" style="font-size:16px;">add_circle</span></button>
                    <button onclick="window.editUtenza(${addrIndex}, ${uIdx})" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;"><span class="material-symbols-outlined" style="font-size:16px;">edit</span></button>
                    <button onclick="window.deleteUtenza(${addrIndex}, ${uIdx})" style="background:none; border:none; color:rgba(239,68,68,0.7); cursor:pointer; padding:4px;"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
                </div>
            </div>
            ${attachmentsHtml ? `<div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:0.5rem;">${attachmentsHtml}</div>` : ''}
        `;
        container.appendChild(item);
    });
}

window.showAddressDetails = (index) => {
    const addr = userAddresses[index];
    if (!addr) return;

    const modal = document.createElement('div');
    modal.id = 'modal-address-details';
    modal.className = 'base-modal-overlay';

    // Helper to create read-only field
    const field = (label, value) => `
        <div style="padding:0.75rem; background:var(--surface-sub); border:1px solid var(--border-color); border-radius:12px; margin-bottom:0.75rem;">
            <div style="color:var(--text-secondary); font-size:0.65rem; text-transform:uppercase; font-weight:800; margin-bottom:0.25rem;">${label}</div>
            <div style="color:var(--text-primary); font-size:1rem; font-weight:500;">${value || '-'}</div>
        </div>
    `;

    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:var(--surface-vault); border:1px solid var(--border-color); border-radius:20px; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <button onclick="document.getElementById('modal-address-details').remove()" 
                    style="position:absolute; top:1rem; right:1rem; background:transparent; border:none; color:var(--text-primary); cursor:pointer;">
                <span class="material-symbols-outlined">close</span>
            </button>
            <h3 style="color:var(--text-primary); margin-bottom:1.5rem; text-align:center;">Dettagli Indirizzo</h3>
            
            ${field('Tipo', addr.type)}
            ${field('Indirizzo', addr.address)}
            
            <div style="display:flex; gap:1rem;">
                <div style="flex:1;">${field('Civico', addr.civic)}</div>
                <div style="flex:1;">${field('CAP', addr.cap)}</div>
            </div>

            ${field('Città', addr.city)}
            ${field('Provincia', addr.province)}

            <button onclick="document.getElementById('modal-address-details').remove()" class="auth-btn" style="width:100%; justify-content:center; margin-top:1rem; background:var(--primary-blue); color:white;">Chiudi</button>
        </div>
    `;
    document.body.appendChild(modal);
};

// DEPRECATED: Add Modal removed, only Edit Modal remains for complex data
window.editAddress = async (index) => {
    const a = userAddresses[index];
    if (!a) return;

    const result = await window.showFormModal("Modifica Indirizzo", [
        { id: 'type', label: 'Tipo Unità', value: a.type || 'Residenza', type: 'select', options: ['Residenza', 'Domicilio', 'Lavoro', 'Altro'] },
        { id: 'street', label: 'Via / Piazza', value: a.address || '', type: 'text' },
        { id: 'civic', label: 'Civico', value: a.civic || '', type: 'text' },
        { id: 'cap', label: 'CAP', value: a.cap || '', type: 'text' },
        { id: 'city', label: 'Città', value: a.city || '', type: 'text' },
        { id: 'prov', label: 'Provincia', value: a.province || '', type: 'text', transform: 'uppercase', maxLength: 2 }
    ]);

    if (result) {
        userAddresses[index] = {
            type: result.type,
            address: result.street.trim(),
            civic: result.civic.trim(),
            cap: result.cap.trim(),
            city: result.city.trim(),
            province: result.prov.trim().toUpperCase()
        };
        saveAddresses();
    }
};

window.deleteAddress = async (index) => {
    const addr = userAddresses[index];
    if (!addr) return;

    const confirmed = await window.showConfirmModal("Eliminare questo indirizzo?");
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

    // 1. ADD PANE (Internal Pane V3.0) - ULTRA PREMIUM DESIGN
    const addPane = document.createElement('div');
    addPane.id = 'pane-add-phone';
    addPane.className = 'accordion-content';
    addPane.innerHTML = `
        <div class="settings-group" style="margin-top:0.5rem; margin-bottom:2rem; padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--surface-vault); backdrop-filter:blur(20px); border-radius:24px; position:relative;">
            <div style="position:absolute; top:-20%; left:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(244, 63, 94, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <h4 style="color:var(--text-primary); margin-bottom:1.2rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; font-weight:800;">Nuovo Contatto Telefonico</h4>
                <div style="display:grid; gap:1rem;">
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Destinazione</label>
                        <select id="new-phone-type" class="base-input">
                            <option value="Cellulare">Cellulare</option>
                            <option value="Fisso">Fisso</option>
                            <option value="Lavoro">Lavoro</option>
                            <option value="Altro">Altro</option>
                        </select>
                    </div>
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Numero di Telefono</label>
                        <input type="tel" id="new-phone-number" placeholder="+39 340 ..." class="base-input">
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-phone').classList.remove('show')" class="base-btn-secondary" style="flex:1;">ANNULLA</button>
                    <button onclick="window.confirmAddPhone()" class="base-btn-primary" style="flex:1;">SALVA NUMERO</button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(addPane);

    // 2. Add Button (Trigger for Pane)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn accordion-header';
    addBtn.dataset.target = 'pane-add-phone';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem; width:100%;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add_call</span> Aggiungi Numero`;
    container.appendChild(addBtn);

    if (contactPhones.length === 0) {
        container.innerHTML += `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessun numero registrato</p>`;
        window.setupAccordions();
        return;
    }

    contactPhones.forEach((p, index) => {
        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-rose";
        div.style.marginBottom = "0.75rem";
        div.innerHTML = `
            <legend class="field-label">${p.type || 'Telefono'}</legend>
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:1.2rem; flex:1; min-width:0;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0;">
                        <span style="font-size:0.55rem; font-weight:900; color:#3b82f6; letter-spacing:0.02em;">QR</span>
                        <input type="checkbox" class="qr-check" style="margin:0; width:14px; height:14px;" 
                               ${p.shareQr ? 'checked' : ''} 
                               onchange="window.toggleQrShare('phones', ${index})">
                    </div>
                    <span class="field-value" style="font-size:0.95rem; flex:1;">${p.number || '-'}</span>
                </div>
                <div class="base-action-grid">
                    <button class="base-action-btn btn-edit" 
                            onclick="event.preventDefault(); window.editPhone(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                    </button>
                    <button class="base-action-btn btn-delete" 
                            onclick="event.preventDefault(); window.deletePhone(${index})">
                        <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                    </button>
                    <button class="base-action-btn btn-copy" 
                            onclick="event.preventDefault(); navigator.clipboard.writeText('${(p.number || '').replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                        <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// DEPRECATED: Phone modal removed

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
    if (!p) return;

    const result = await window.showFormModal(`Modifica Telefono`, [
        { id: 'type', label: 'Destinazione', value: p.type, type: 'select', options: ['Cellulare', 'Fisso', 'Lavoro', 'Altro'] },
        { id: 'number', label: 'Numero di Telefono', value: p.number, type: 'tel' }
    ]);

    if (result) {
        p.type = result.type;
        p.number = result.number.trim();
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

// --- RENDERING: UTENZE REMOVED (NOW NESTED IN ADDRESSES) ---
window.confirmSaveUtility = (addrIndex) => {
    const typeEl = document.getElementById(`util-type-${addrIndex}`);
    const valEl = document.getElementById(`util-value-${addrIndex}`);

    if (!typeEl || !valEl) return;

    const type = typeEl.value.trim();
    const val = valEl.value.trim();

    if (!type || !val) {
        notify("Inserisci Tipo e Valore", 'error');
        return;
    }

    if (!userAddresses[addrIndex].utilities) userAddresses[addrIndex].utilities = [];
    userAddresses[addrIndex].utilities.push({ type, value: val, attachments: [] });

    saveAddresses();
};

window.editUtenza = async (addrIndex, uIdx) => {
    const addr = userAddresses[addrIndex];
    const u = addr.utilities[uIdx];
    if (!u) return;

    const result = await window.showFormModal("Modifica Utenza", [
        { id: 'type', label: 'Gestore / Tipo', value: u.type || '', type: 'text' },
        { id: 'value', label: 'Valore (POD/PDR/Codice)', value: u.value || '', type: 'text' }
    ]);

    if (result) {
        u.type = result.type.trim();
        u.value = result.value.trim();
        saveAddresses();
    }
};

window.deleteUtenza = async (addrIndex, uIdx) => {
    const confirmed = await window.showConfirmModal("Eliminare questa utenza?");
    if (!confirmed) return;

    userAddresses[addrIndex].utilities.splice(uIdx, 1);
    saveAddresses();
};

// --- RENDERING: DOCUMENTI ---
function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    container.innerHTML = '';

    const allTypes = ['Carta d\'Identità', 'Patente', 'Passaporto', 'Codice Fiscale', 'Tessera Sanitaria', 'Altro'];
    const available = allTypes.filter(t => !userDocuments.some(d => d.type === t) || t === 'Altro');
    const optionsHtml = available.map(t => `<option value="${t}" style="color:black;">${t}</option>`).join('');

    // 1. ADD PANE (Internal Pane V3.0) - INTERACTIVE DYNAMIC DESIGN
    const addPane = document.createElement('div');
    addPane.id = 'pane-add-document';
    addPane.className = 'accordion-content';
    addPane.innerHTML = `
        <div class="settings-group" style="margin-top:0.5rem; margin-bottom:2rem; padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--surface-vault); backdrop-filter:blur(20px); border-radius:24px; position:relative;">
            <div style="position:absolute; top:-20%; left:20%; width:150px; height:150px; background:radial-gradient(circle, rgba(167, 139, 250, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <h4 style="color:var(--text-primary); margin-bottom:1.2rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; font-weight:800;">Nuovo Documento</h4>
                <div style="display:grid; gap:1rem;">
                    <div class="glass-field-base">
                        <label class="field-label" style="color:var(--text-secondary);">Tipologia Documento</label>
                        <select id="new-doc-type-select-main" class="base-input">
                            ${optionsHtml}
                        </select>
                    </div>

                    <div class="glass-field-base">
                        <label id="label-num-doc" class="field-label" style="color:var(--text-secondary);">Numero</label>
                        <input type="text" id="new-doc-number" placeholder="Inserisci numero..." class="base-input">
                    </div>

                    <div id="dynamic-doc-fields" style="display:grid; gap:1rem;">
                        <div id="row-expiry" class="glass-field-base">
                            <label class="field-label" style="color:var(--text-secondary);">Data di Scadenza</label>
                            <input type="date" id="new-doc-expiry" class="base-input" style="color-scheme:dark;">
                        </div>

                        <div id="row-emission" class="glass-field-base" style="display:none;">
                            <label class="field-label" style="color:var(--text-secondary);">Ente / Luogo Rilascio</label>
                            <input type="text" id="new-doc-emission" placeholder="Prefettura, Comune, ecc." class="base-input">
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-document').classList.remove('show')" class="base-btn-secondary" style="flex:1;">ANNULLA</button>
                    <button id="btn-save-document-inline" class="base-btn-primary" style="flex:1;">SALVA</button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(addPane);

    // Logic for Interactive UI
    const docSelect = addPane.querySelector('#new-doc-type-select-main');
    const docNumLabel = addPane.querySelector('#label-num-doc');
    const rowExpiry = addPane.querySelector('#row-expiry');
    const rowEmission = addPane.querySelector('#row-emission');
    const btnSave = addPane.querySelector('#btn-save-document-inline');

    const updateFieldsVisibility = (type) => {
        docNumLabel.textContent = `Numero ${type}`;

        // CF e Tessera Sanitaria non hanno ente (di solito)
        if (type === 'Codice Fiscale') {
            rowExpiry.style.display = 'none';
            rowEmission.style.display = 'none';

            // Suggerimento automatico se il campo è vuoto
            const numInput = document.getElementById('new-doc-number');
            if (numInput && !numInput.value) {
                numInput.value = currentUserData.cf || currentUserData.codiceFiscale || '';
            }
        } else if (type === 'Tessera Sanitaria') {
            rowExpiry.style.display = 'block';
            rowEmission.style.display = 'none';
        } else {
            rowExpiry.style.display = 'block';
            rowEmission.style.display = 'block';
        }
    };

    if (docSelect) {
        docSelect.onchange = () => updateFieldsVisibility(docSelect.value);
        updateFieldsVisibility(docSelect.value);
    }

    if (btnSave) {
        btnSave.onclick = async () => {
            const type = docSelect.value;
            const num = document.getElementById('new-doc-number').value.trim();
            const expiry = document.getElementById('new-doc-expiry').value;
            const emission = document.getElementById('new-doc-emission').value.trim();

            if (!num) {
                notify("Inserisci il numero del documento.", "error");
                return;
            }

            userDocuments.push({
                type: type,
                num_serie: num,
                expiry_date: expiry,
                emission_body: emission,
                attachments: []
            });

            try {
                await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
                window.location.reload();
            } catch (e) {
                notify("Errore salvataggio: " + e.message, 'error');
            }
        };
    }

    // 2. Add Button (Trigger)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn accordion-header';
    addBtn.dataset.target = 'pane-add-document';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem; width:100%;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">description</span> Aggiungi Documento`;
    container.appendChild(addBtn);

    if (!userDocuments || userDocuments.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = "text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;";
        p.textContent = "Nessun documento registrato";
        container.appendChild(p);
        window.setupAccordions();
        return;
    }

    userDocuments.forEach((docItem, index) => {
        const div = document.createElement('fieldset');
        div.className = "glass-field-base glass-field-violet";
        div.style.marginBottom = "1rem";

        let num = docItem.num_serie || docItem.id_number || docItem.license_number || docItem.cf_value || docItem.codice_fiscale || docItem.cf || docItem.codiceFiscale;
        if (!num && docItem.type?.toLowerCase() === 'codice fiscale') {
            num = currentUserData.cf || currentUserData.codiceFiscale;
        }
        if (!num) num = '-';
        let expiry = docItem.expiry_date ? "Scadenza: " + docItem.expiry_date : '';

        // Sezione Allegati Documento
        let docAttachmentsHtml = '<span class="field-value" style="opacity:0.7;">-</span>';
        if (docItem.attachments && docItem.attachments.length > 0) {
            docAttachmentsHtml = `<div style="display:flex; flex-direction:column; gap:0.5rem;">`;
            docItem.attachments.forEach((att, attIndex) => {
                docAttachmentsHtml += `
                    <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                             <span class="material-symbols-outlined" style="font-size:16px;">attachment</span>
                             <a href="${att.url}" target="_blank" style="color:#22d3ee; text-decoration:underline; font-size:0.85rem; word-break:break-all; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${att.name}</a>
                        </div>
                    </div>
                `;
            });
            docAttachmentsHtml += `</div>`;
        }

        const docAttachmentsSection = `
            <div style="width:100%; margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                     <span class="field-label" style="opacity:0.7;">Allegati</span>
                     <button onclick="event.preventDefault(); window.openAttachmentManager(${index}, 'document')" 
                             style="background:none; border:none; color:#22d3ee; cursor:pointer; display:flex; align-items:center;">
                        <span class="material-symbols-outlined">add_circle</span>
                     </button>
                 </div>
                 ${docAttachmentsHtml}
            </div>
        `;

        div.innerHTML = `
            <legend class="field-label">${docItem.type || 'Documento'}</legend>
            <div style="display:flex; flex-direction:column; gap:0.5rem; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:start; width:100%;">
                    <div style="flex:1; min-width:0;">
                        <span class="field-value">${num}</span>
                        <div style="font-size:0.75rem; opacity:0.6;">${expiry}</div>
                    </div>
                    <div class="base-action-grid">
                        <button class="base-action-btn btn-copy" title="Copia Numero" onclick="navigator.clipboard.writeText('${num.replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                            <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
                        </button>
                        <button class="base-action-btn btn-view" onclick="window.showDocumentDetails(${index})"><span class="material-symbols-outlined" style="font-size:16px;">visibility</span></button>
                        <button class="base-action-btn btn-edit" onclick="window.editUserDocument(${index})"><span class="material-symbols-outlined" style="font-size:16px;">edit</span></button>
                        <button class="base-action-btn btn-delete" onclick="window.deleteUserDocument(${index})"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
                    </div>
                </div>
                ${docAttachmentsSection}
            </div>
        `;
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

// DEPRECATED: Document modal selectors removed

window.confirmAddDocType = () => {
    // Funzione mantenuta per retrocompatibilità, ora la logica è nel listener diretto
    const select = document.getElementById('new-doc-type-select-main');
    if (select && select.value) {
        window.initNewDocument(select.value);
    }
};

window.initNewDocument = async (type) => {
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

    const currentNum = docItem.num_serie || docItem.id_number || docItem.license_number || docItem.cf_value || docItem.codice_fiscale || docItem.cf || docItem.codiceFiscale || "";

    const result = await window.showFormModal("Modifica Documento", [
        { id: 'type', label: 'Tipo Documento', value: docItem.type || '', type: 'text' },
        { id: 'num', label: 'Numero / Serie', value: currentNum, type: 'text' },
        { id: 'expiry', label: 'Data Scadenza (AAAA-MM-GG)', value: docItem.expiry_date || '', type: 'date' }
    ]);

    if (result) {
        docItem.type = result.type.trim();
        docItem.num_serie = result.num.trim();
        docItem.expiry_date = result.expiry.trim();

        // Mantieni sync legacy
        if (docItem.id_number) docItem.id_number = result.num.trim();
        if (docItem.license_number) docItem.license_number = result.num.trim();

        try {
            await updateDoc(doc(db, "users", currentUserUid), { documenti: userDocuments });
            window.location.reload();
        } catch (e) { notify("Errore modifica: " + e.message, 'error'); }
    }
};

window.showDocumentDetails = (index) => {
    const docItem = userDocuments[index];
    if (!docItem) return;

    let fieldsHtml = '';
    const addField = (label, val) => {
        if (!val) return;
        fieldsHtml += `
            <div style="padding:0.75rem; background:var(--surface-sub); border:1px solid var(--border-color); border-radius:12px; margin-bottom:0.75rem;">
                <span style="color:var(--text-secondary); font-size:0.65rem; text-transform:uppercase; font-weight:800; display:block; margin-bottom:0.25rem;">${label}</span>
                <span style="font-size:1rem; color:var(--text-primary); font-weight:500; word-break:break-all;">${val}</span>
            </div>
        `;
    };

    addField("Tipo Documento", docItem.type);
    let docNum = docItem.num_serie || docItem.id_number || docItem.license_number || docItem.cf_value || docItem.codice_fiscale || docItem.cf || docItem.codiceFiscale;
    if (!docNum && docItem.type?.toLowerCase() === 'codice fiscale') {
        docNum = currentUserData.cf || currentUserData.codiceFiscale;
    }
    addField("Numero / ID", docNum);
    addField("Data Scadenza", window.formatDateToIT ? window.formatDateToIT(docItem.expiry_date) : docItem.expiry_date);
    addField("Data Rilascio", window.formatDateToIT ? window.formatDateToIT(docItem.emission_date) : docItem.emission_date);
    addField("Ente Rilascio", docItem.emission_body);
    addField("Luogo Rilascio", docItem.emission_place);

    let imgHtml = '';
    if (docItem.id_url_front) {
        imgHtml += `<div style="margin-top:1.2rem;"><p style="opacity:0.6; font-size:0.8rem; margin-bottom:0.5rem; color:#94a3b8;">Fronte</p><img src="${docItem.id_url_front}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 30px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
    }
    if (docItem.id_url_back) {
        imgHtml += `<div style="margin-top:1.2rem;"><p style="opacity:0.6; font-size:0.8rem; margin-bottom:0.5rem; color:#94a3b8;">Retro</p><img src="${docItem.id_url_back}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 30px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
    }

    const modal = document.createElement('div');
    modal.id = 'doc-details-modal';
    modal.className = 'base-modal-overlay';

    modal.innerHTML = `
        <div class="settings-vault" style="width:100%; max-width:480px; max-height:85vh; overflow-y:auto; padding:2rem; position:relative;">
            <div style="position:absolute; top:-10%; right:-10%; width:200px; height:200px; background:radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%); filter:blur(40px); pointer-events:none;"></div>
            
            <button id="close-doc-details-x" 
                    style="position:absolute; top:1.2rem; right:1.2rem; background:var(--surface-sub); border:1px solid var(--border-color); color:var(--text-primary); border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; z-index:10;">
                <span class="material-symbols-outlined" style="font-size:24px;">close</span>
            </button>
            <h3 style="color:var(--text-primary); margin-bottom:1.5rem; text-align:center;">Dettagli Documento</h3>
            <div style="position:relative; z-index:1;">
                ${fieldsHtml}
                ${imgHtml}
            </div>
            <button id="close-doc-details-btn" class="base-btn-primary" style="width:100%; margin-top:2rem;">Chiudi</button>
        </div>
    `;

    document.body.appendChild(modal);

    const closeFn = () => { if (modal) modal.remove(); };
    modal.querySelector('#close-doc-details-x').onclick = closeFn;
    modal.querySelector('#close-doc-details-btn').onclick = closeFn;
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
            wrapper.style.gap = '1.2rem'; // Extra space between QR and data

            parent.insertBefore(wrapper, valEl);

            // Container for QR Label + Checkbox
            const qrBox = document.createElement('div');
            qrBox.style.display = 'flex';
            qrBox.style.flexDirection = 'column';
            qrBox.style.alignItems = 'center';
            qrBox.style.gap = '2px';
            qrBox.style.flexShrink = '0';

            // Create Label
            const label = document.createElement('span');
            label.textContent = 'QR';
            label.style.fontSize = '0.55rem';
            label.style.fontWeight = '900';
            label.style.color = '#3b82f6';
            label.style.letterSpacing = '0.02em';

            // Create Checkbox
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'qr-check';
            chk.style.margin = '0';
            chk.style.width = '14px';
            chk.style.height = '14px';
            chk.checked = !!config[f.key];
            chk.onchange = () => window.toggleQrShare('personal', f.key);

            qrBox.appendChild(label);
            qrBox.appendChild(chk);

            wrapper.appendChild(qrBox);
            wrapper.appendChild(valEl);
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

            const fullName = `${currentUserData.nome || ''} ${currentUserData.cognome || ''} `.trim() || 'Utente';
            const mobile = currentUserData.mobile_private || '-';

            // Top Bar
            const firstName = currentUserData.nome || '';
            const lastName = currentUserData.cognome || '';
            setText('profile-firstname', firstName, true);
            setText('profile-lastname', lastName, true);
            // profile-email non esiste nell'HTML attuale, se lo aggiungessi servirebbe setText('profile-email', user.email);

            const avatar = document.getElementById('profile-avatar');
            if (avatar) avatar.src = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";

            // Dati Personali
            setText('nome-view', currentUserData.nome);
            setText('cognome-view', currentUserData.cognome);
            setText('cf-view', currentUserData.cf || currentUserData.codiceFiscale);
            setText('birth_date-view', formatDateToIT(currentUserData.birth_date));
            setText('birth_place-view', `${currentUserData.birth_place || ''} ${currentUserData.birth_province ? '(' + currentUserData.birth_province + ')' : ''} `.trim());

            // Render QR Flags
            renderPersonalDataFlags();

            // Residenza & Utenze (Dynamic Migration)
            userAddresses = currentUserData.userAddresses || [];
            if (userAddresses.length === 0 && currentUserData.residence_address) {
                userAddresses.push({
                    type: 'Residenza',
                    address: currentUserData.residence_address,
                    civic: currentUserData.residence_civic || '',
                    cap: currentUserData.residence_cap || '',
                    city: currentUserData.residence_city || '',
                    province: currentUserData.residence_province || '',
                    utilities: []
                });
            }

            // AUTO MIGRATION: Se ci sono utenze globali, spostale nella prima residenza
            const globalUtils = currentUserData.utenze || [];
            if (globalUtils.length > 0 && userAddresses.length > 0) {
                if (!userAddresses[0].utilities || userAddresses[0].utilities.length === 0) {
                    userAddresses[0].utilities = globalUtils;
                    // Reset global utenze to avoid loop or duplication
                    await updateDoc(doc(db, "users", user.uid), {
                        userAddresses: userAddresses,
                        utenze: []
                    });
                }
            }
            renderAddressesView();

            // Contatti
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

            userDocuments = currentUserData.documenti || [];
            renderDocumentiView();

            window.setupAccordions();

            // QR Code Placeholder (Removed from layout)
            const qrContainer = document.getElementById('qrcode');
            if (qrContainer) qrContainer.innerHTML = '';
        }
    } catch (e) {
        console.error("Profile load error", e);
    }
});
