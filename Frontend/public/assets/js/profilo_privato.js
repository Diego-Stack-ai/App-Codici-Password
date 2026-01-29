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
    btn.style.cssText = `
        background:var(--surface-sub); border:1px solid var(--border-color); color:var(--text-primary); 
        cursor:pointer; padding:6px; border-radius:8px; display:flex; 
        align-items:center; justify-content:center; transition:all 0.2s;
    `;
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
            <div style="position:absolute; top:-20%; left:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%); filter:blur(30px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <div style="display:grid; gap:1.2rem;">
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#22d3ee; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Indirizzo Email</label>
                        <input type="email" id="new-email-addr" placeholder="esempio@dominio.it" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                    </div>
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#22d3ee; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Password Dedicata</label>
                        <input type="text" id="new-email-pass" placeholder="Password per l'invio" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-email').classList.remove('show')" class="titanium-btn-secondary" style="flex:1; border-radius:14px; font-weight:700; letter-spacing:1px;">ANNULLA</button>
                    <button onclick="window.saveNewEmail()" class="titanium-btn-primary" style="flex:1; border-radius:14px; background:linear-gradient(135deg, #0891b2, #22d3ee); border:none; color:#083344; font-weight:800; letter-spacing:1px; box-shadow:0 10px 20px -5px rgba(34, 211, 238, 0.3);">SALVA DATI</button>
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
    } else if (type === 'utility') {
        sourceArr = userUtilities;
        item = sourceArr[index];
        title = "Gestisci Allegati Utenza";
        sub = item?.type || '';
    }

    if (!item) return;

    // Deep copy
    currentManageAttachments = JSON.parse(JSON.stringify(item.attachments || []));

    const modal = document.createElement('div');
    modal.id = 'modal-manage-attach';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
    `;
    modal.innerHTML = `
        <div class="settings-vault" style="width:90%; max-width:400px; padding:2rem; background:var(--surface-vault); border:1px solid var(--border-color); border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <h3 style="color:var(--text-primary); margin-bottom:1.5rem; text-align:center;">${title}</h3>
            <p style="text-align:center; color:var(--text-secondary); font-size:0.8rem; margin-bottom:1rem;">${sub}</p>
            
            <div id="manager-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; max-height:200px; overflow-y:auto;"></div>

            <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <button class="auth-btn" style="flex:1; justify-content:center; background:var(--surface-sub); border:1px dashed var(--primary-blue); color:var(--primary-blue);" 
                        onclick="document.getElementById('manager-camera-input').click()">
                    <span class="material-symbols-outlined" style="font-size:18px; margin-right:0.5rem;">photo_camera</span>
                    Scatta
                </button>
                <button class="auth-btn" style="flex:1; justify-content:center; background:var(--surface-sub); border:1px dashed var(--primary-blue); color:var(--primary-blue);" 
                        onclick="document.getElementById('manager-file-input').click()">
                    <span class="material-symbols-outlined" style="font-size:18px; margin-right:0.5rem;">upload_file</span>
                    Libreria
                </button>
            </div>
            
            <input type="file" id="manager-camera-input" accept="image/*" capture="environment" style="display:none" onchange="window.addManagerFile(this)">
            <input type="file" id="manager-file-input" multiple style="display:none" onchange="window.addManagerFile(this)">

            <div style="display:flex; gap:1rem;">
                <button onclick="document.getElementById('modal-manage-attach').remove()" class="auth-btn" style="background:var(--surface-sub); color:var(--text-primary); justify-content:center;">Annulla</button>
                <button onclick="window.saveManagerAttachments()" class="auth-btn" style="background:var(--primary-blue); color:white; justify-content:center; box-shadow:0 4px 15px rgba(37, 99, 235, 0.3);">Salva</button>
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
        sourceArr = userUtilities;
        fieldName = 'utenze';
    }

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
            <div class="settings-vault" style="width:90%; max-width:350px; padding:2rem; background:var(--surface-vault); border:1px solid rgba(239, 68, 68, 0.3); border-radius:20px; text-align:center;">
                <span class="material-symbols-outlined" style="font-size:48px; color:#ef4444; margin-bottom:1rem;">warning</span>
                <h3 style="color:var(--text-primary); margin-bottom:1rem;">Conferma Azione</h3>
                <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:2rem;">${message}</p>
                
                <div style="display:flex; gap:1rem; justify-content:center;">
                    <button id="confirm-no-btn" class="auth-btn" style="background:var(--surface-sub); color:var(--text-primary); justify-content:center;">Annulla</button>
                    <button id="confirm-yes-btn" class="auth-btn" style="background:#ef4444; color:white; justify-content:center;">Elimina</button>
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

window.showInputModal = (title, initialValue = '') => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;
        modal.innerHTML = `
            <div class="settings-vault" style="width:90%; max-width:350px; padding:2rem; background:var(--surface-vault); border:1px solid var(--border-color); border-radius:20px;">
                <h3 style="color:var(--text-primary); margin-bottom:1.5rem; text-align:center;">${title}</h3>
                <input type="text" id="modal-input-field" value="${initialValue}" 
                       style="width:100%; padding:1rem; background:var(--surface-sub); border:1px solid var(--border-color); border-radius:12px; color:var(--text-primary); margin-bottom:1.5rem; outline:none;">
                <div style="display:flex; gap:1rem;">
                    <button id="input-cancel-btn" class="auth-btn" style="flex:1; background:var(--surface-sub); color:var(--text-primary); justify-content:center;">Annulla</button>
                    <button id="input-confirm-btn" class="auth-btn" style="flex:1; background:var(--primary-blue); color:white; justify-content:center;">Conferma</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const input = modal.querySelector('#modal-input-field');
        input.focus();
        input.select();

        modal.querySelector('#input-cancel-btn').onclick = () => {
            modal.remove();
            resolve(null);
        };
        modal.querySelector('#input-confirm-btn').onclick = () => {
            const val = input.value;
            modal.remove();
            resolve(val);
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = input.value;
                modal.remove();
                resolve(val);
            }
        };
    });
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
            <div style="position:absolute; top:-20%; right:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%); filter:blur(30px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <div style="display:grid; gap:1rem;">
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Tipo Unità</label>
                        <select id="addr-type" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%;">
                            <option value="Residenza">Residenza</option>
                            <option value="Domicilio">Domicilio</option>
                            <option value="Lavoro">Lavoro</option>
                            <option value="Altro">Altro</option>
                        </select>
                    </div>
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Via / Piazza</label>
                        <input type="text" id="addr-street" placeholder="Es. Via Roma" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                         <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                            <label class="field-label" style="font-size:0.65rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Civico</label>
                            <input type="text" id="addr-civic" placeholder="Es. 10/A" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                        </div>
                        <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                            <label class="field-label" style="font-size:0.65rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">CAP</label>
                            <input type="text" id="addr-cap" placeholder="Es. 35030" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:0.75rem;">
                         <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                            <label class="field-label" style="font-size:0.65rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Città</label>
                            <input type="text" id="addr-city" placeholder="Es. Padova" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                        </div>
                        <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                            <label class="field-label" style="font-size:0.65rem; color:#10b981; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Prov.</label>
                            <input type="text" id="addr-prov" placeholder="PD" class="titanium-input" maxlength="2" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; text-transform:uppercase;">
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-address').classList.remove('show')" class="titanium-btn-secondary" style="flex:1; border-radius:14px; font-weight:700;">ANNULLA</button>
                    <button onclick="window.confirmSaveAddress(null)" class="titanium-btn-primary" style="flex:1; border-radius:14px; background:linear-gradient(135deg, #059669, #10b981); border:none; color:#064e3b; font-weight:800; box-shadow:0 10px 20px -5px rgba(16, 185, 129, 0.3);">CONFERMA</button>
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
            <div style="color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; margin-bottom:0.25rem;">${label}</div>
            <div style="color:var(--text-primary); font-size:1.1rem; font-weight:500;">${value || '-'}</div>
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
    const addr = userAddresses[index];
    if (!addr) return;

    // Use System Modals (InputModal) for single fields as per Rule 3.4 for editing
    // Or open a full modal if multiple fields are needed.
    // For Addresses, we have multiple fields, let's use the standard System Modal logic but customized.

    const type = await window.showInputModal("Tipo (Residenza, Lavoro...)", addr.type);
    if (type === null) return;

    const street = await window.showInputModal("Via / Piazza", addr.address);
    if (street === null) return;

    const civic = await window.showInputModal("Civico", addr.civic);
    if (civic === null) return;

    const cap = await window.showInputModal("CAP", addr.cap);
    if (cap === null) return;

    const city = await window.showInputModal("Città", addr.city);
    if (city === null) return;

    const prov = await window.showInputModal("Provincia", addr.province);
    if (prov === null) return;

    userAddresses[index] = { type, address: street, civic, cap, city, province: prov.toUpperCase() };
    saveAddresses();
};

window.confirmSaveAddress = async (editIndex) => {
    const type = document.getElementById('addr-type').value;
    const address = document.getElementById('addr-street').value.trim();
    const city = document.getElementById('addr-city').value.trim();
    const civic = document.getElementById('addr-civic').value.trim();
    const cap = document.getElementById('addr-cap').value.trim();
    const prov = document.getElementById('addr-prov').value.trim().toUpperCase();

    if (!address || !city) {
        notify("Inserisci almeno Indirizzo e Città", 'error');
        return;
    }

    const data = { type, address, civic, cap, city, province: prov };
    if (editIndex !== null) userAddresses[editIndex] = data;
    else userAddresses.push(data);

    saveAddresses();
};

window.editAddress = async (index) => {
    const a = userAddresses[index];
    if (!a) return;

    // Use InputModal for quick edits of primary fields
    const newStreet = await window.showInputModal(`Modifica Indirizzo (${a.type})`, a.address);
    if (newStreet !== null) {
        a.address = newStreet.trim();
        saveAddresses();
    }
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

    // 1. ADD PANE (Internal Pane V3.0) - ULTRA PREMIUM DESIGN
    const addPane = document.createElement('div');
    addPane.id = 'pane-add-phone';
    addPane.className = 'accordion-content';
    addPane.innerHTML = `
        <div class="settings-group" style="margin-top:0.5rem; margin-bottom:2rem; padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--surface-vault); backdrop-filter:blur(20px); border-radius:24px; position:relative;">
            <!-- Glow Background Effect -->
            <div style="position:absolute; bottom:-20%; left:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(244, 63, 94, 0.15) 0%, transparent 70%); filter:blur(30px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <div style="display:grid; gap:1.2rem;">
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#f43f5e; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Destinazione</label>
                        <select id="new-phone-type" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%;">
                            <option value="Cellulare">Cellulare</option>
                            <option value="Fisso">Fisso</option>
                            <option value="Lavoro">Lavoro</option>
                            <option value="Altro">Altro</option>
                        </select>
                    </div>
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#f43f5e; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Numero di Telefono</label>
                        <input type="tel" id="new-phone-number" placeholder="+39 340 1234..." class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1.1rem; letter-spacing:1px;">
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-phone').classList.remove('show')" class="titanium-btn-secondary" style="flex:1; border-radius:14px; font-weight:700;">ANNULLA</button>
                    <button onclick="window.confirmAddPhone()" class="titanium-btn-primary" style="flex:1; border-radius:14px; background:linear-gradient(135deg, #e11d48, #f43f5e); border:none; color:white; font-weight:800; box-shadow:0 10px 20px -5px rgba(244, 63, 94, 0.3);">SALVA NUMERO</button>
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
function renderUtenzeView() {
    const container = document.getElementById('utenze-view-container');
    if (!container) return;
    container.innerHTML = '';

    // 1. ADD PANE (Internal Pane V3.0) - ULTRA PREMIUM DESIGN
    let addrOptions = '<option value="" style="color:black;">Nessun indirizzo collegato</option>';
    userAddresses.forEach(a => {
        const val = `${a.address}, ${a.city} (${a.type})`;
        addrOptions += `<option value="${val}" style="color:black;">${a.type}: ${a.address}, ${a.city}</option>`;
    });

    const addPane = document.createElement('div');
    addPane.id = 'pane-add-utility';
    addPane.className = 'accordion-content';
    addPane.innerHTML = `
        <div class="settings-group" style="margin-top:0.5rem; margin-bottom:2rem; padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--surface-vault); backdrop-filter:blur(20px); border-radius:24px; position:relative;">
            <!-- Glow Background Effect -->
            <div style="position:absolute; top:-20%; right:-10%; width:150px; height:150px; background:radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, transparent 70%); filter:blur(30px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <div style="display:grid; gap:1.2rem;">
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Tipologia Servizio</label>
                        <input type="text" id="util-type" placeholder="Es. Energia Elettrica, Gas, Fibra" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem;">
                    </div>
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Codice Utente / POD</label>
                        <input type="text" id="util-value" placeholder="Es. IT001E..." class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1.1rem; letter-spacing:1px; font-family:monospace;">
                    </div>
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Indirizzo Fornitura</label>
                        <select id="util-address" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%;">
                            ${addrOptions}
                        </select>
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-utility').classList.remove('show')" class="titanium-btn-secondary" style="flex:1; border-radius:14px; font-weight:700;">ANNULLA</button>
                    <button onclick="window.confirmSaveUtility(null)" class="titanium-btn-primary" style="flex:1; border-radius:14px; background:linear-gradient(135deg, #d97706, #fbbf24); border:none; color:#451a03; font-weight:800; box-shadow:0 10px 20px -5px rgba(251, 191, 36, 0.3);">CONFERMA UTENZA</button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(addPane);

    // 2. Add Button (Trigger)
    const addBtn = document.createElement('button');
    addBtn.className = 'auth-btn accordion-header';
    addBtn.dataset.target = 'pane-add-utility';
    addBtn.style.cssText = "text-align:center; justify-content:center; margin-bottom:1rem; min-height:3rem; padding:0.5rem 1rem; font-size:0.9rem; width:100%;";
    addBtn.innerHTML = `<span class="material-symbols-outlined" style="margin-right:0.5rem;">add_circle</span> Aggiungi Utenza`;
    container.appendChild(addBtn);

    if (userUtilities.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = "text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;";
        p.textContent = "Nessuna utenza registrata";
        container.appendChild(p);
        window.setupAccordions();
        return;
    }

    const validLabels = userAddresses.map(a => `${a.address}, ${a.city} (${a.type})`);
    userUtilities.forEach((u, index) => {
        const div = document.createElement('fieldset');
        div.className = "glass-field-titanium glass-field-amber";
        div.style.marginBottom = "0.75rem";

        let addrHtml = u.address_label ? `
            <div style="font-size:0.75rem; opacity:0.8; margin-top:0.3rem; display:flex; align-items:center; gap:0.4rem; color:${validLabels.includes(u.address_label) ? 'inherit' : '#ef4444'};">
                <span class="material-symbols-outlined" style="font-size:14px;">home</span>
                ${u.address_label}
            </div>` : '';

        // Sezione Allegati Utenza
        let utenteAttachmentsHtml = '<span class="field-value" style="opacity:0.7;">-</span>';
        if (u.attachments && u.attachments.length > 0) {
            utenteAttachmentsHtml = `<div style="display:flex; flex-direction:column; gap:0.5rem;">`;
            u.attachments.forEach((att, attIndex) => {
                utenteAttachmentsHtml += `
                    <div style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
                             <span class="material-symbols-outlined" style="font-size:16px;">attachment</span>
                             <a href="${att.url}" target="_blank" style="color:#22d3ee; text-decoration:underline; font-size:0.85rem; word-break:break-all; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${att.name}</a>
                        </div>
                    </div>
                `;
            });
            utenteAttachmentsHtml += `</div>`;
        }

        const attachmentsSection = `
            <div style="width:100%; margin-top:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                     <span class="field-label" style="opacity:0.7;">Allegati</span>
                     <button onclick="event.preventDefault(); window.openAttachmentManager(${index}, 'utility')" 
                             style="background:none; border:none; color:#22d3ee; cursor:pointer; display:flex; align-items:center;">
                        <span class="material-symbols-outlined">add_circle</span>
                     </button>
                 </div>
                 ${utenteAttachmentsHtml}
            </div>
        `;

        div.innerHTML = `
            <legend class="field-label">${u.type || 'Utenza'}</legend>
            <div style="display:flex; flex-direction:column; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:start; width:100%; gap:0.5rem;">
                    <div style="flex:1; min-width:0;">
                        <span class="field-value" style="font-size:1.1rem; word-break:break-all;">${u.value || '-'}</span>
                        ${addrHtml}
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-shrink:0;">
                        <button class="titanium-action-btn btn-edit" onclick="window.editUtenza(${index})">
                            <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
                        </button>
                        <button class="titanium-action-btn btn-delete" onclick="window.deleteUtenza(${index})">
                            <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                        </button>
                        <button class="titanium-action-btn btn-copy" onclick="navigator.clipboard.writeText(\`${u.value?.replace(/`/g, '\\`') || ''}\`).then(() => window.showToast('Copiato!'))">
                            <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                        </button>
                    </div>
                </div>
                ${attachmentsSection}
            </div>
        `;
        container.appendChild(div);
    });
}

// Unified Utility Logic
window.editUtenza = async (index) => {
    const u = userUtilities[index];
    if (!u) return;

    const val = await window.showInputModal(`Modifica Valore (${u.type})`, u.value);
    if (val !== null) {
        u.value = val.trim();
        saveUtenze();
    }
};

window.confirmSaveUtility = (editIndex) => {
    const typeEl = document.getElementById('util-type');
    const valEl = document.getElementById('util-value');
    const addrEl = document.getElementById('util-address');

    if (!typeEl || !valEl) return;

    const type = typeEl.value.trim();
    const val = valEl.value.trim();
    const addr = addrEl ? addrEl.value : '';

    if (!type || !val) {
        notify("Inserisci Tipo e Valore", 'error');
        return;
    }

    const newUtil = { type, value: val, address_label: addr };
    if (editIndex !== null) userUtilities[editIndex] = newUtil;
    else userUtilities.push(newUtil);

    saveUtenze();
};

window.deleteUtenza = async (index) => {
    const confirmed = await window.showConfirmModal("Eliminare questa utenza?");
    if (!confirmed) return;

    userUtilities.splice(index, 1);
    saveUtenze();
};

function saveUtenze() {
    updateDoc(doc(db, "users", currentUserUid), {
        utenze: userUtilities
    }).then(() => {
        renderUtenzeView();
    }).catch(e => notify("Errore salvataggio: " + e.message, 'error'));
}

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
            <!-- Glow Background Effect -->
            <div style="position:absolute; top:-20%; left:20%; width:150px; height:150px; background:radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%); filter:blur(30px); pointer-events:none;"></div>
            
            <div style="padding:1.5rem; position:relative; z-index:1;">
                <div style="display:grid; gap:1.2rem;">
                    <!-- Dropdown Tipo -->
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label class="field-label" style="font-size:0.65rem; color:#a78bfa; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Tipologia Documento</label>
                        <select id="new-doc-type-select-main" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%;">
                            ${optionsHtml}
                        </select>
                    </div>

                    <!-- Input Numero (Sempre Visibile) -->
                    <div class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                        <label id="label-num-doc" class="field-label" style="font-size:0.65rem; color:#a78bfa; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Numero</label>
                        <input type="text" id="new-doc-number" placeholder="Inserisci numero..." class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%;">
                    </div>

                    <!-- Gruppo Campi Opzionali (Dinamici) -->
                    <div id="dynamic-doc-fields" style="display:grid; gap:1.2rem;">
                        <!-- Data Scadenza -->
                        <div id="row-expiry" class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color);">
                            <label class="field-label" style="font-size:0.65rem; color:#a78bfa; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Data di Scadenza</label>
                            <input type="date" id="new-doc-expiry" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%; color-scheme:dark;">
                        </div>

                        <!-- Ente Rilascio (Patente/Passaporto/CI) -->
                        <div id="row-emission" class="glass-field-titanium" style="padding:0.75rem 1rem; border:1px solid var(--border-color); display:none;">
                            <label class="field-label" style="font-size:0.65rem; color:#a78bfa; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; display:block; font-weight:800;">Ente / Luogo Rilascio</label>
                            <input type="text" id="new-doc-emission" placeholder="Es. Prefettura di Roma" class="titanium-input" style="background:transparent; border:none; padding:0; height:auto; color:var(--text-primary); font-size:1rem; width:100%;">
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:0.75rem; margin-top:1.8rem;">
                    <button onclick="document.getElementById('pane-add-document').classList.remove('show')" class="titanium-btn-secondary" style="flex:1; border-radius:14px; font-weight:700;">ANNULLA</button>
                    <button id="btn-save-document-inline" class="titanium-btn-primary" style="flex:1; border-radius:14px; background:linear-gradient(135deg, #7c3aed, #a78bfa); border:none; color:white; font-weight:800; box-shadow:0 10px 20px -5px rgba(124, 58, 237, 0.3);">SALVA DOCUMENTO</button>
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
        div.className = "glass-field-titanium glass-field-violet";
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
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <span class="field-value" style="font-size:1.1rem;">${num}</span>
                        <div style="font-size:0.75rem; opacity:0.6;">${expiry}</div>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="titanium-action-btn btn-copy" title="Copia Numero" onclick="navigator.clipboard.writeText('${num.replace(/'/g, "\\'")}').then(() => window.showToast('Copiato!'))">
                            <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                        </button>
                        <button class="titanium-action-btn btn-view" onclick="window.showDocumentDetails(${index})"><span class="material-symbols-outlined" style="font-size:18px;">visibility</span></button>
                        <button class="titanium-action-btn btn-edit" onclick="window.editUserDocument(${index})"><span class="material-symbols-outlined" style="font-size:18px;">edit</span></button>
                        <button class="titanium-action-btn btn-delete" onclick="window.deleteUserDocument(${index})"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>
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
    const newNum = await window.showInputModal(`Modifica Numero(${docItem.type})`, currentNum);

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
            <div style="padding:0.75rem; background:var(--surface-sub); border-radius:12px; border:1px solid var(--border-color); margin-bottom:0.5rem;">
                <span style="opacity:0.6; font-size:0.7rem; text-transform:uppercase; display:block; margin-bottom:0.25rem; color:var(--text-secondary);">${label}</span>
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
        imgHtml += `<div style="margin-top:1.2rem;"><p style="opacity:0.6; font-size:0.8rem; margin-bottom:0.5rem; color:#94a3b8;">Fronte</p><img src="${docItem.id_url_front}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 4px 12px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
    }
    if (docItem.id_url_back) {
        imgHtml += `<div style="margin-top:1.2rem;"><p style="opacity:0.6; font-size:0.8rem; margin-bottom:0.5rem; color:#94a3b8;">Retro</p><img src="${docItem.id_url_back}" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 4px 12px rgba(0,0,0,0.3);" onclick="window.open(this.src, '_blank')"></div>`;
    }

    const modal = document.createElement('div');
    modal.id = 'doc-details-modal';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); display:flex; align-items:center; justify-content:center; z-index:99999; padding:1.5rem;";

    modal.innerHTML = `
        <div class="settings-vault" style="width:100%; max-width:480px; max-height:85vh; overflow-y:auto; padding:2rem; background:var(--surface-vault); border-radius:28px; border:1px solid var(--border-color); position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <button id="close-doc-details-x" 
                    style="position:absolute; top:1.2rem; right:1.2rem; background:var(--surface-sub); border:none; color:var(--text-primary); border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">
                <span class="material-symbols-outlined" style="font-size:24px;">close</span>
            </button>
            <h3 style="color:var(--text-primary); margin-bottom:1.8rem; text-align:center; font-size:1.5rem; font-weight:700; letter-spacing:-0.01em;">Dettagli Documento</h3>
            <div style="display:flex; flex-direction:column;">${fieldsHtml}</div>
            ${imgHtml}
            <button id="close-doc-details-btn" class="auth-btn" style="background:var(--primary-blue); color:white; width:100%; justify-content:center; margin-top:2rem; height:3.8rem; font-weight:700; font-size:1rem; border-radius:16px;">Chiudi</button>
        </div>
    `;

    document.body.appendChild(modal);

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

            window.setupAccordions();

            // QR Code Placeholder (Removed from layout)
            const qrContainer = document.getElementById('qrcode');
            if (qrContainer) qrContainer.innerHTML = '';
        }
    } catch (e) {
        console.error("Profile load error", e);
    }
});
