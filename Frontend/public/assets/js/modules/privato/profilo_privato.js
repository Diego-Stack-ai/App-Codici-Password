/**
 * PROFILO PRIVATO MODULE (V4.3 - Consolidated)
 * Gestione profilo con form dinamici e protocollo DOM sicuro.
 */

import { auth, db, storage } from '../../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { ensureQRCodeLib, buildVCard, renderQRCode } from '../shared/qr_code_utils.js';
import { logError, formatDateToIT } from '../../utils.js';
import { encrypt, decrypt, ensureMasterKey, clearSession, isAutoUnlockActive } from '../core/security-manager.js';

// 🛡️ ESPOSIZIONE GLOBALE (V3.2 — Audit Ready)
window.ensureMasterKey = ensureMasterKey;
window.clearSession = clearSession;
window.isAutoUnlockActive = isAutoUnlockActive;
window.encrypt = encrypt;
window.decrypt = decrypt;

export { encrypt, decrypt };

function createCopyBtn(text) {
    return createElement('button', {
        className: 'btn-action-mini',
        title: 'Copia',
        onclick: (e) => {
            e.stopPropagation();
            if (!text || text === '-') return;
            navigator.clipboard.writeText(text);
            showToast(t('copied') || 'Copiato!', 'success');
        }
    }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'content_copy' })
    ]);
}

// --- STATE ---
let currentUserUid = null;
let currentUserData = {};
let contactEmails = [];
let userAddresses = [];
let contactPhones = [];
let userDocuments = [];
let profileLabels = {
    addressTypes: ['Residenza', 'Domicilio', 'Ufficio', 'Altro'],
    utilityTypes: ['Codice POD', 'Contatore Acqua', 'Contatore Metano', 'Fibra', 'Altro'],
    phoneLabels: ['Cellulare', 'Fisso', 'Principale', 'Altro'],
    emailLabels: ['Personale', 'Lavoro', 'Principale', 'Email di recupero', 'Altro'],
    documentTypes: ['Carta Identità', 'Patente', 'Codice Fiscale', 'Passaporto', 'Altro']
};

// QR Code inclusion preferences (which fields to include in vCard)
let qrCodeInclusions = {
    nome: false,
    cf: false,
    nascita: false,
    phones: [], // array of indices
    emails: [], // array of indices
    addresses: [] // array of indices
};

// --- DOM CACHE ---
const avatarImg = document.getElementById('profile-avatar');
const nameDisplay = document.getElementById('user-display-name');

/**
 * PROFILO PRIVATO MODULE (V5.0 ADAPTER)
 * Gestione profilo utente.
 * - Entry Point: initProfiloPrivato(user)
 */

export async function initProfiloPrivato(user) {
    console.log("[PROFILO] Init V5.0...");
    if (!user) return;

    currentUserUid = user.uid;

    await loadUserData(user);

    // Setup UI Handlers
    setupAvatarEdit();
    setupDelegation();
    setupPersonalDataCopy();
    initProxyDropdowns();
    setupCollapsibleSections();
    setupQRToggles();

    console.log("[PROFILO] Ready.");
}

/**
 * Caricamento Dati
 */
async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return;

        currentUserData = userDoc.data();

        // 🔐 PROTOCOLLO BLINDA (V6.1.5): Decrittazione Granulare Universale
        const masterKey = await ensureMasterKey();
        if (masterKey) {
            const isEncryptedValue = (val) => {
                if (!val || typeof val !== 'string' || val.length < 30) return false;
                return /^[A-Za-z0-9+/]+={0,2}$/.test(val);
            };

            const decryptIfPossible = async (val) => {
                if (val === undefined || val === null) return '';
                if (!isEncryptedValue(val)) return val;
                try { return await decrypt(val, masterKey); } catch (e) { return val; }
            };

            // Dati personali
            currentUserData.nome = await decryptIfPossible(currentUserData.nome);
            currentUserData.cognome = await decryptIfPossible(currentUserData.cognome);
            currentUserData.birth_place = await decryptIfPossible(currentUserData.birth_place);
            currentUserData.note = await decryptIfPossible(currentUserData.note);

            // Telefoni
            if (Array.isArray(currentUserData.contactPhones)) {
                currentUserData.contactPhones = await Promise.all(currentUserData.contactPhones.map(async p => ({
                    ...p,
                    number: await decryptIfPossible(p.number)
                })));
            }

            // Indirizzi
            if (Array.isArray(currentUserData.userAddresses)) {
                currentUserData.userAddresses = await Promise.all(currentUserData.userAddresses.map(async a => ({
                    ...a,
                    address: await decryptIfPossible(a.address),
                    civic: await decryptIfPossible(a.civic),
                    city: await decryptIfPossible(a.city),
                    cap: await decryptIfPossible(a.cap),
                    province: await decryptIfPossible(a.province),
                    utilities: await Promise.all((a.utilities || []).map(async u => ({
                        ...u,
                        value: await decryptIfPossible(u.value)
                    })))
                })));
            }

            // Documenti (Copertura Totale)
            if (Array.isArray(currentUserData.documenti)) {
                currentUserData.documenti = await Promise.all(currentUserData.documenti.map(async d => ({
                    ...d,
                    num_serie: await decryptIfPossible(d.num_serie),
                    cf_value: await decryptIfPossible(d.cf_value),
                    id_number: await decryptIfPossible(d.id_number),
                    license_number: await decryptIfPossible(d.license_number),
                    cf: await decryptIfPossible(d.cf),
                    rilasciato_da: await decryptIfPossible(d.rilasciato_da),
                    luogo_rilascio: await decryptIfPossible(d.luogo_rilascio),
                    username: await decryptIfPossible(d.username),
                    password: await decryptIfPossible(d.password),
                    pin: await decryptIfPossible(d.pin),
                    puk: await decryptIfPossible(d.puk),
                    codice_app: await decryptIfPossible(d.codice_app),
                    note: await decryptIfPossible(d.note)
                })));
            }

            // Email
            if (Array.isArray(currentUserData.contactEmails)) {
                currentUserData.contactEmails = await Promise.all(currentUserData.contactEmails.map(async e => ({
                    ...e,
                    password: await decryptIfPossible(e.password),
                    note: await decryptIfPossible(e.note)
                })));
            }
            console.log("[VaultCheck] Decrittazione granulare V6.1.5 completata.");
        }

        // Hero Header
        const fullNameRaw = `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim();
        const finalFullName = (fullNameRaw && !fullNameRaw.includes('[ERROR]')) ? fullNameRaw : (user.displayName || 'Utente');

        if (nameDisplay) nameDisplay.textContent = finalFullName;
        if (avatarImg) avatarImg.src = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";

        // View Population
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
        set('nome-view', finalFullName);

        // CF Mapping: Always derived from Documents list (as requested)
        let cf = '';
        if (currentUserData.documenti) {
            const cfDoc = currentUserData.documenti.find(d => d.type && d.type.toLowerCase().includes('fiscale'));
            if (cfDoc) cf = cfDoc.cf_value || cfDoc.num_serie || cfDoc.id_number || '';
        }
        set('cf-view', cf.toUpperCase() || '-');

        set('birth_date-view', formatDateToIT(currentUserData.birth_date));
        set('birth_place-view', `${currentUserData.birth_place || ''} ${currentUserData.birth_province ? '(' + currentUserData.birth_province + ')' : ''}`.trim());
        set('note-view', currentUserData.note);

        // Sub-collections
        userAddresses = currentUserData.userAddresses || [];
        contactPhones = currentUserData.contactPhones || [];
        contactEmails = currentUserData.contactEmails || [];
        userDocuments = currentUserData.documenti || [];

        // Load Custom Labels
        const labelsSnap = await getDoc(doc(db, "users", user.uid, "settings", "profileLabels"));
        if (labelsSnap.exists()) {
            profileLabels = { ...profileLabels, ...labelsSnap.data() };
        }

        // Load QR Code Inclusions
        const qrSnap = await getDoc(doc(db, "users", user.uid, "settings", "qrCodeInclusions"));
        if (qrSnap.exists()) {
            qrCodeInclusions = { ...qrCodeInclusions, ...qrSnap.data() };
        }

        // Memo Personale
        // Rimossa logica memo

        renderAllSections();
        generateProfileQRCode();
    } catch (e) {
        logError("LoadProfile", e);
        showToast(t('error_generic'), "error");
    }
}

function renderAllSections() {
    renderAddressesView();
    renderPhonesView();
    renderEmailsView();
    renderDocumentiView();
}

/**
 * PHONES
 */
function renderPhonesView() {
    const container = document.getElementById('telefoni-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_call' }),
        createElement('span', { textContent: t('add_phone') || 'Aggiungi Telefono' })
    ]);
    btnAdd.onclick = () => window.addPhone();
    container.appendChild(btnAdd);

    const cards = contactPhones.map((phone, idx) => createPhoneCard(phone, idx));
    setChildren(container, [btnAdd, ...cards]);
}

function createPhoneCard(phone, idx) {
    const card = createElement('div', {
        className: 'form-card',
        style: 'margin-bottom: 1.25rem; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); border: none;'
    }, [
        createElement('div', { className: 'card-header-row' }, [
            createElement('div', { className: 'card-icon-stack' }, [
                createElement('div', { className: 'card-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined filled', textContent: 'call' })
                ]),
                createElement('span', { className: 'card-title-accent', textContent: phone.label || 'Telefono' })
            ]),
            createElement('div', { className: 'card-actions-row' }, [
                createElement('button', { className: 'btn-edit-section', onclick: () => window.editPhone(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', onclick: () => window.deletePhone(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                ])
            ])
        ]),
        createElement('div', { className: 'card-fields-container' }, [
            createElement('div', { className: 'card-field-group' }, [
                createElement('div', { className: 'field-header' }, [
                    createElement('input', {
                        type: 'checkbox',
                        className: 'qr-checkbox',
                        checked: qrCodeInclusions.phones.includes(idx),
                        onclick: (e) => { e.stopPropagation(); toggleQRInclusion('phones', idx); }
                    }),
                    createElement('label', { className: 'qr-mini-label', textContent: 'QR' }),
                    createElement('span', { className: 'data-label', textContent: 'Numero' })
                ]),
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value', textContent: phone.number || '-' }),
                    createCopyBtn(phone.number)
                ])
            ])
        ])
    ]);
    return card;
}

window.addPhone = async () => {
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.phoneLabels, configKey: 'phoneLabels' },
        { key: 'number', label: 'Numero', icon: 'call' }
    ];
    showProfileModal('Aggiungi Telefono', fields, {}, async (newData) => {
        try {
            contactPhones.push(newData);
            await syncData();
            renderPhonesView();
            showToast(t('success_save'), "success");
        } catch (e) {
            contactPhones.pop();
            console.error('[addPhone] Errore:', e);
            showToast("Errore durante il salvataggio del telefono.", "error");
        }
    });
};

window.editPhone = async (idx) => {
    const phone = contactPhones[idx];
    if (!phone.label) phone.label = profileLabels.phoneLabels[0];
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.phoneLabels, configKey: 'phoneLabels' },
        { key: 'number', label: 'Numero', icon: 'call' }
    ];
    showProfileModal('Modifica Telefono', fields, phone, async (newData) => {
        const backup = { ...contactPhones[idx] };
        try {
            contactPhones[idx] = newData;
            await syncData();
            renderPhonesView();
            showToast(t('success_save'), "success");
        } catch (e) {
            contactPhones[idx] = backup;
            console.error('[editPhone] Errore:', e);
            showToast("Errore durante la modifica del telefono.", "error");
        }
    });
};

window.deletePhone = async (idx) => {
    if (!confirm(t('confirm_delete') || 'Eliminare questo telefono?')) return;
    const backup = [...contactPhones];
    try {
        contactPhones.splice(idx, 1);
        await syncData();
        renderPhonesView();
        showToast(t('success_delete') || 'Telefono eliminato', "success");
    } catch (e) {
        contactPhones = backup;
        console.error('[deletePhone] Errore:', e);
        showToast("Errore durante l'eliminazione del telefono.", "error");
    }
};

/**
 * AVATAR
 */
function setupAvatarEdit() {
    const input = document.getElementById('avatar-input');
    if (!input) return;

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUserUid) return;

        showToast(t('uploading_avatar') || "Caricamento avatar...", "info");
        try {
            const sRef = ref(storage, `users/${currentUserUid}/avatar_${Date.now()}`);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, "users", currentUserUid), { photoURL: url });
            if (avatarImg) avatarImg.src = url;
            showToast(t('avatar_updated') || "Avatar aggiornato!");
        } catch (error) {
            logError("AvatarUpload", error);
            showToast(t('error_upload'), "error");
        }
    };
}

function setupPersonalDataCopy() {
    const bind = (btnId, viewId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = () => {
                const text = document.getElementById(viewId)?.textContent;
                if (text && text !== '-') {
                    navigator.clipboard.writeText(text);
                    showToast(t('copied') || 'Copiato!', 'success');
                }
            };
        }
    };
    bind('copy-nome', 'nome-view');
    bind('copy-cf', 'cf-view');
    bind('copy-nascita', 'birth_date-view'); // Default to date for birth
}

async function saveProfileLabels() {
    if (!currentUserUid) return;
    try {
        await updateDoc(doc(db, "users", currentUserUid, "settings", "profileLabels"), profileLabels);
    } catch (e) {
        // Se il doc non esiste, usa setDoc
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
        await setDoc(doc(db, "users", currentUserUid, "settings", "profileLabels"), profileLabels);
    }
}

/**
 * QR CODE TOGGLES
 */
function setupQRToggles() {
    // Personal data toggles
    const toggles = [
        { id: 'qr-toggle-nome', field: 'nome' },
        { id: 'qr-toggle-cf', field: 'cf' },
        { id: 'qr-toggle-nascita', field: 'nascita' }
    ];

    toggles.forEach(({ id, field }) => {
        const btn = document.getElementById(id);
        if (btn) {
            // Set initial state
            btn.checked = qrCodeInclusions[field];

            // Add click handler
            btn.onclick = async () => {
                qrCodeInclusions[field] = btn.checked;
                await saveQRInclusions();
                generateProfileQRCode();
            };
        }
    });
}

function updateToggleState(btn, isActive) {
    if (btn.type === 'checkbox') {
        btn.checked = isActive;
    } else {
        // Toggle logical state via classes or attributes if needed, or keep for now if it's a legacy behavior
        // But for "Pure HTML", we should avoid direct style injection
        if (isActive) {
            btn.classList.add('active');
            btn.title = 'Rimuovi dal QR Code';
        } else {
            btn.classList.remove('active');
            btn.title = 'Aggiungi al QR Code';
        }
    }
}

async function saveQRInclusions() {
    if (!currentUserUid) return;
    try {
        await updateDoc(doc(db, "users", currentUserUid, "settings", "qrCodeInclusions"), qrCodeInclusions);
    } catch (e) {
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
        await setDoc(doc(db, "users", currentUserUid, "settings", "qrCodeInclusions"), qrCodeInclusions);
    }
}

async function toggleQRInclusion(type, idx) {
    const array = qrCodeInclusions[type];
    const index = array.indexOf(idx);

    if (index > -1) {
        // Remove from QR
        array.splice(index, 1);
    } else {
        // Add to QR
        array.push(idx);
    }

    await saveQRInclusions();

    // Re-render the section to update button state
    if (type === 'emails') renderEmailsView();
    else if (type === 'phones') renderPhonesView();
    else if (type === 'addresses') renderAddressesView();

    // Regenerate QR code
    generateProfileQRCode();
}

/**
 * QR CODE GENERATION
 */
async function generateProfileQRCode() {
    await ensureQRCodeLib();
    const container = document.getElementById('qrcode-header');
    if (!container) return;
    // Build vCard string with only selected fields
    const vcard = buildVCard(currentUserData, qrCodeInclusions, {
        contactPhones,
        contactEmails,
        userAddresses
    });
    // Clear previous QR code
    clearElement(container);
    renderQRCode(container, vcard, { width: 104, height: 104, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 2 });
    // Add click handler to show enlarged QR
    container.onclick = () => showEnlargedQR(vcard);
    // Also make zoom icon clickable
    const zoomIcon = document.getElementById('qr-zoom-icon');
    if (zoomIcon) {
        zoomIcon.onclick = () => showEnlargedQR(vcard);
    }
}

function showEnlargedQR(vcard) {
    // Rimuovi eventuali modali QR già aperti
    document.getElementById('qr-zoom-modal-dynamic')?.remove();

    const qrSize = Math.min(window.innerWidth * 0.7, 300);

    const modal = createElement('div', { id: 'qr-zoom-modal-dynamic', className: 'modal-overlay' }, [
        createElement('div', { className: 'modal-profile-box modal-box-qr' }, [
            createElement('h3', {
                className: 'modal-title',
                textContent: 'QR Code Profilo',
                dataset: { t: 'qr_code_profile' }
            }),
            createElement('div', { id: 'qr-enlarged', className: 'qr-zoom-container' }),
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: 'Chiudi',
                dataset: { t: 'close' },
                onclick: () => {
                    modal.classList.remove('active');
                    setTimeout(() => modal.remove(), 300);
                }
            })
        ])
    ]);

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    // Chiusura al click fuori
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    };

    // Render QR
    renderQRCode(document.getElementById('qr-enlarged'), vcard, { width: qrSize, height: qrSize, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 3 });
}


/**
 * COLLAPSIBLE SECTIONS
 */
function setupCollapsibleSections() {
    const headers = document.querySelectorAll('.collapsible-header');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const sectionName = header.dataset.section;
            const container = document.getElementById(`${sectionName}-view-container`);

            if (!container) return;

            // Toggle collapsed state
            const isCollapsed = header.classList.contains('collapsed');

            if (isCollapsed) {
                // Expand
                header.classList.remove('collapsed');
                container.classList.remove('collapsed');
            } else {
                // Collapse
                header.classList.add('collapsed');
                container.classList.add('collapsed');
            }
        });
    });
}

/**
 * CUSTOM DROPDOWNS ENGINE
 */
function initProxyDropdowns() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.dropdown-trigger');
        const container = trigger?.closest('[data-custom-select]');
        const menu = container?.querySelector('.base-dropdown-menu');

        // Chiudi tutti gli altri
        document.querySelectorAll('.base-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        if (trigger && menu) {
            e.stopPropagation();
            menu.classList.toggle('show');
        } else if (!e.target.closest('.base-dropdown-menu')) {
            document.querySelectorAll('.base-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });
}

function syncCustomDropdowns(container, configKey = null) {
    const select = container.querySelector('select');
    const labelEl = container.querySelector('.dropdown-label');
    const menu = container.querySelector('.base-dropdown-menu');

    if (!select || !labelEl || !menu) return;

    clearElement(menu);
    Array.from(select.options).forEach(opt => {
        const item = createElement('div', {
            className: `base-dropdown-item ${opt.selected ? 'active' : ''}`,
            dataset: { value: opt.value },
            style: 'display: flex; justify-content: space-between; align-items: center;'
        }, [
            createElement('span', { textContent: opt.textContent }),
            (configKey && opt.value !== '') ? createElement('div', { className: 'flex-center-row', style: 'gap: 4px;' }, [
                createElement('button', {
                    className: 'btn-action-mini',
                    style: 'width: 20px; height: 20px; border-radius: 4px; background: rgba(0,0,0,0.05); color: #000;',
                    onclick: async (ev) => {
                        ev.stopPropagation();
                        const newName = prompt("Rinomina voce:", opt.value);
                        if (newName && newName.trim() && newName !== opt.value) {
                            const idx = profileLabels[configKey].indexOf(opt.value);
                            if (idx > -1) {
                                profileLabels[configKey][idx] = newName.trim();
                                await saveProfileLabels();
                                // Re-render logic needed or just re-open the current master modal
                                showToast("Voce aggiornata!");
                                // Trigger Refresh
                                if (window._currentModalRefresh) window._currentModalRefresh();
                            }
                        }
                    }
                }, [createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 12px;', textContent: 'edit' })]),
                createElement('button', {
                    className: 'btn-action-mini',
                    style: 'width: 20px; height: 20px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #ef4444;',
                    onclick: async (ev) => {
                        ev.stopPropagation();
                        if (confirm(`Eliminare "${opt.value}"?`)) {
                            profileLabels[configKey] = profileLabels[configKey].filter(v => v !== opt.value);
                            await saveProfileLabels();
                            showToast("Voce eliminata!");
                            if (window._currentModalRefresh) window._currentModalRefresh();
                        }
                    }
                }, [createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 12px;', textContent: 'delete' })])
            ]) : null
        ]);

        item.onclick = (e) => {
            if (e.target.closest('button')) return; // Avoid selection when clicking actions
            e.stopPropagation();
            select.value = opt.value;
            select.dispatchEvent(new Event('change'));
            labelEl.textContent = opt.textContent;
            menu.classList.remove('show');
            menu.querySelectorAll('.base-dropdown-item').forEach(i => i.classList.toggle('active', i.dataset.value === select.value));
        };
        menu.appendChild(item);
    });

    // Add "Manage/New" button
    if (configKey) {
        const btnAdd = createElement('div', {
            className: 'base-dropdown-item',
            style: 'border-top: 1px dashed rgba(0,0,0,0.1); margin-top: 4px; color: var(--accent); font-weight: 800; display: flex; align-items: center; gap: 8px;',
            onclick: async (e) => {
                e.stopPropagation();
                const newLabel = prompt("Aggiungi nuova voce:");
                if (newLabel && newLabel.trim()) {
                    if (!profileLabels[configKey].includes(newLabel.trim())) {
                        profileLabels[configKey].push(newLabel.trim());
                        await saveProfileLabels();
                        showToast("Vode aggiunta!");
                        if (window._currentModalRefresh) window._currentModalRefresh();
                    } else {
                        showToast("Voce già esistente", "info");
                    }
                }
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 18px;', textContent: 'add_circle' }),
            createElement('span', { textContent: 'Aggiungi voce...' })
        ]);
        menu.appendChild(btnAdd);
    }

    const initialOpt = select.options[select.selectedIndex];
    if (initialOpt) labelEl.textContent = initialOpt.textContent;
}

/**
 * ADDRESSES
 */
function renderAddressesView() {
    const container = document.getElementById('indirizzi-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_location_alt' }),
        createElement('span', { textContent: t('add_address') })
    ]);
    btnAdd.onclick = () => window.editAddress(-1);
    container.appendChild(btnAdd);

    const cards = userAddresses.map((addr, idx) => createAddressCard(addr, idx));
    setChildren(container, [btnAdd, ...cards]);
}

function createAddressCard(addr, idx) {
    const card = createElement('div', {
        className: 'form-card',
        style: 'margin-bottom: 1.25rem; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); border: none;'
    }, [
        createElement('div', { className: 'card-header-row' }, [
            createElement('div', { className: 'card-icon-stack' }, [
                createElement('div', { className: 'card-icon-box' }, [
                    createElement('span', { className: 'material-symbols-outlined filled', textContent: addr.type === 'Lavoro' ? 'work' : 'home' })
                ]),
                createElement('span', { className: 'card-title-accent', textContent: addr.type || t('profile_addresses') })
            ]),
            createElement('div', { className: 'card-actions-row' }, [
                createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-address', idx } }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-address', idx } }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                ])
            ])
        ]),
        createElement('div', { className: 'card-fields-container' }, [
            createElement('div', { className: 'card-field-group' }, [
                createElement('div', { className: 'field-header' }, [
                    createElement('input', {
                        type: 'checkbox',
                        className: 'qr-checkbox',
                        checked: qrCodeInclusions.addresses.includes(idx),
                        onclick: (e) => { e.stopPropagation(); toggleQRInclusion('addresses', idx); }
                    }),
                    createElement('label', { className: 'qr-mini-label', textContent: 'QR' }),
                    createElement('span', { className: 'data-label', textContent: t('label_address') })
                ]),
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value', textContent: `${addr.address}, ${addr.civic}` }),
                    createCopyBtn(`${addr.address}, ${addr.civic}`)
                ])
            ]),
            createElement('div', { className: 'card-field-group' }, [
                createElement('span', { className: 'data-label', textContent: t('label_locality') }),
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value', textContent: `${addr.cap} ${addr.city} (${addr.province})` }),
                    createCopyBtn(`${addr.cap} ${addr.city} (${addr.province})`)
                ])
            ])
        ])
    ]);

    const utilsList = createElement('div', { className: 'card-utility-list' });
    renderUtilitiesInCard(addr.utilities || [], utilsList, idx);
    card.appendChild(utilsList);

    const btnAddUtil = createElement('button', {
        className: 'btn-upload-trigger',
        dataset: { action: 'add-utility', idx }
    }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_circle' }),
        createElement('span', { textContent: t('add_utility') })
    ]);
    card.appendChild(btnAddUtil);

    return card;
}

function renderUtilitiesInCard(utils, list, addrIdx) {
    if (utils.length === 0) {
        setChildren(list, createElement('span', { className: 'card-no-data', textContent: t('no_utilities') }));
        return;
    }
    const items = utils.map((u, uIdx) => {
        return createElement('div', { className: 'card-utility-item' }, [
            createElement('div', { className: 'card-utility-header' }, [
                createElement('span', { className: 'data-label', textContent: u.type }),
                createElement('div', { className: 'card-actions-row' }, [
                    createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-utility', idx: addrIdx, uidx: uIdx } }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
                    ]),
                    createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-utility', idx: addrIdx, uidx: uIdx } }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
                    ])
                ])
            ]),
            createElement('div', { className: 'field-value-row' }, [
                createElement('span', { className: 'data-value', textContent: u.value }),
                createCopyBtn(u.value)
            ])
        ]);
    });
    setChildren(list, items);
}

/**
 * EMAILS
 */
function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'alternate_email' }),
        createElement('span', { textContent: t('add_email') })
    ]);
    btnAdd.onclick = () => window.editEmail(-1);

    const items = contactEmails.map((e, idx) => {
        return createElement('div', {
            className: 'form-card',
            style: 'margin-bottom: 1.25rem; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); border: none;'
        }, [
            createElement('div', { className: 'card-header-row' }, [
                createElement('div', { className: 'field-header' }, [
                    createElement('input', {
                        type: 'checkbox',
                        className: 'qr-checkbox',
                        checked: qrCodeInclusions.emails.includes(idx),
                        onclick: (ev) => { ev.stopPropagation(); toggleQRInclusion('emails', idx); }
                    }),
                    createElement('label', { className: 'qr-mini-label', textContent: 'QR' }),
                    createElement('span', { className: 'card-title-accent', textContent: e.label || 'Email' })
                ]),
                createElement('div', { className: 'card-actions-row' }, [
                    createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-email', idx } }, [
                        createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                    ]),
                    createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-email', idx } }, [
                        createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                    ])
                ])
            ]),
            createElement('div', { className: 'card-fields-container' }, [
                createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value truncate', textContent: e.address || '-' }),
                    createCopyBtn(e.address)
                ]),
                e.password ? createElement('div', { className: 'field-value-row' }, [
                    createElement('span', { className: 'data-value-sub', textContent: '••••••••', dataset: { pwd: e.password, visible: 'false' } }),
                    createElement('div', { className: 'flex-center-row', style: 'gap: 0.5rem;' }, [
                        createElement('button', {
                            className: 'btn-action-mini',
                            onclick: (event) => {
                                event.stopPropagation();
                                const span = event.currentTarget.parentElement.parentElement.querySelector('.data-value-sub');
                                const isVisible = span.dataset.visible === 'true';
                                span.textContent = isVisible ? '••••••••' : span.dataset.pwd;
                                span.dataset.visible = !isVisible;
                                event.currentTarget.querySelector('span').textContent = isVisible ? 'visibility' : 'visibility_off';
                            }
                        }, [
                            createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'visibility' })
                        ]),
                        createCopyBtn(e.password)
                    ])
                ]) : createElement('span', { className: 'data-value-sub', textContent: 'No PWD' }),
                e.note ? createElement('div', { className: 'note-display-lite', style: 'margin-top: 8px; font-size: 11px; opacity: 0.6; color: var(--text-secondary); line-height: 1.4; border-left: 2px solid var(--accent); padding-left: 8px;' }, [
                    createElement('span', { textContent: e.note })
                ]) : null
            ])
        ]);
    });

    setChildren(container, [btnAdd, ...items]);
}

window.addEmail = async () => {
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.emailLabels, configKey: 'emailLabels' },
        { key: 'address', label: 'Indirizzo Email', icon: 'alternate_email', type: 'text' },
        { key: 'password', label: 'Password (opzionale)', icon: 'key', type: 'password' },
        { key: 'note', label: 'Note (opzionale)', icon: 'notes', type: 'textarea' }
    ];
    showProfileModal('Aggiungi Email', fields, { label: profileLabels.emailLabels[0] }, async (newData) => {
        try {
            contactEmails.push(newData);
            await syncData(); // [FIX] cifratura via syncData invece di updateDoc diretto
            renderEmailsView();
            showToast(t('success_save'), "success");
        } catch (e) {
            contactEmails.pop(); // rollback locale
            console.error('[addEmail] Errore:', e);
            showToast("Errore durante il salvataggio dell'email.", "error");
        }
    });
};

window.editEmail = async (idx) => {
    if (idx === -1) { window.addEmail(); return; }
    const email = contactEmails[idx];
    if (!email.label) email.label = profileLabels.emailLabels[0];
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.emailLabels, configKey: 'emailLabels' },
        { key: 'address', label: 'Indirizzo Email', icon: 'alternate_email', type: 'text' },
        { key: 'password', label: 'Password (opzionale)', icon: 'key', type: 'password' },
        { key: 'note', label: 'Note (opzionale)', icon: 'notes', type: 'textarea' }
    ];
    showProfileModal('Modifica Email', fields, email, async (newData) => {
        const backup = { ...contactEmails[idx] };
        try {
            contactEmails[idx] = newData;
            await syncData(); // [FIX] cifratura via syncData invece di updateDoc diretto
            renderEmailsView();
            showToast(t('success_save'), "success");
        } catch (e) {
            contactEmails[idx] = backup; // rollback locale
            console.error('[editEmail] Errore:', e);
            showToast("Errore durante la modifica dell'email.", "error");
        }
    });
};

window.deleteEmail = async (idx) => {
    if (!confirm(t('confirm_delete') || 'Eliminare questa email?')) return;
    const backup = [...contactEmails];
    try {
        contactEmails.splice(idx, 1);
        await syncData(); // [FIX] usa syncData — filtra + cifra + scrive
        contactEmails = (contactEmails || []).filter(e => e != null); // assicura array locale pulito
        renderEmailsView();
        console.log(`[Email] Eliminata email #${idx}. Rimanenti: ${contactEmails.length}`);
        showToast(t('success_delete') || 'Email eliminata con successo', "success");
    } catch (e) {
        contactEmails = backup; // rollback locale
        console.error('[deleteEmail] Errore:', e);
        showToast("Errore durante l'eliminazione. Riprova.", "error");
    }
};

/**
 * DOCUMENTS
 */
function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    clearElement(container);

    const btnAdd = createElement('button', { className: 'btn-upload-trigger' }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: 'add_card' }),
        createElement('span', { textContent: t('add_doc') })
    ]);
    btnAdd.onclick = () => window.editUserDocument(-1);

    const items = userDocuments.map((docItem, idx) => {
        const num = docItem.num_serie || docItem.cf_value || docItem.id_number || docItem.license_number || docItem.cf || '-';
        const subDetails = [];
        if (docItem.categoria) subDetails.push(docItem.categoria);
        if (docItem.rilasciato_da) subDetails.push(docItem.rilasciato_da);
        if (docItem.luogo_rilascio) subDetails.push(docItem.luogo_rilascio);
        if (docItem.id_number) subDetails.push(docItem.id_number);

        return createElement('div', { className: 'form-card' }, [
            createElement('div', { className: 'card-header-row' }, [
                createElement('div', { className: 'card-icon-stack' }, [
                    createElement('div', { className: 'card-icon-box' }, [
                        createElement('span', { className: 'material-symbols-outlined filled', textContent: 'description' })
                    ]),
                    createElement('span', { className: 'card-title-accent', textContent: docItem.type })
                ]),
                createElement('div', { className: 'card-actions-row' }, [
                    createElement('button', { className: 'btn-edit-section', dataset: { action: 'edit-doc', idx } }, [
                        createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                    ]),
                    createElement('button', { className: 'btn-edit-section btn-delete', dataset: { action: 'delete-doc', idx } }, [
                        createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'delete' })
                    ])
                ])
            ]),
            createElement('div', { className: 'card-fields-container' }, [
                createElement('div', { className: 'card-field-group' }, [
                    createElement('div', { className: 'field-value-row' }, [
                        createElement('span', { className: 'data-value', textContent: num }),
                        createCopyBtn(num)
                    ]),
                    subDetails.length > 0 ? createElement('span', { className: 'data-value-sub', style: 'display: block; margin-bottom: 4px;', textContent: subDetails.join(' - ') }) : null,
                    docItem.pin || docItem.puk || docItem.codice_app ? createElement('div', { className: 'flex-col-gap', style: 'margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;' }, [
                        docItem.pin ? createElement('div', { className: 'field-value-row' }, [
                            createElement('span', { className: 'data-label-xs', style: 'width: 80px;', textContent: 'PIN:' }),
                            createElement('span', { className: 'data-value-sm', textContent: docItem.pin }),
                            createCopyBtn(docItem.pin)
                        ]) : null,
                        docItem.puk ? createElement('div', { className: 'field-value-row' }, [
                            createElement('span', { className: 'data-label-xs', style: 'width: 80px;', textContent: 'PUK:' }),
                            createElement('span', { className: 'data-value-sm', textContent: docItem.puk }),
                            createCopyBtn(docItem.puk)
                        ]) : null,
                        docItem.codice_app ? createElement('div', { className: 'field-value-row' }, [
                            createElement('span', { className: 'data-label-xs', style: 'width: 80px;', textContent: 'Cod. App:' }),
                            createElement('span', { className: 'data-value-sm', textContent: docItem.codice_app }),
                            createCopyBtn(docItem.codice_app)
                        ]) : null
                    ]) : null,
                    docItem.data_rilascio ? createElement('div', { className: 'flex-center-row', style: 'gap: 4px; opacity: 0.8; margin-top: 8px; margin-bottom: 2px;' }, [
                        createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'history' }),
                        createElement('span', { className: 'data-value-sub', textContent: `Emesso: ${formatDateToIT(docItem.data_rilascio)}` })
                    ]) : null,
                    docItem.expiry_date ? createElement('div', { className: 'flex-center-row', style: 'gap: 4px; opacity: 0.8;' }, [
                        createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'event' }),
                        createElement('span', { className: 'data-value-sub', textContent: `Scadenza: ${formatDateToIT(docItem.expiry_date)}` })
                    ]) : null,
                    docItem.note ? createElement('p', { className: 'note-text', style: 'margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;', textContent: docItem.note }) : null
                ])
            ])
        ]);
    });
    setChildren(container, [btnAdd, ...items]);
}

/**
 * DELEGATION & MODALS (Form logic remains in UI-CORE if generic, or here if specific)
 */
function setupDelegation() {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const idx = parseInt(target.dataset.idx);
        const uIdx = parseInt(target.dataset.uidx);

        switch (action) {
            case 'edit-section': editSection(target.dataset.target); break;
            case 'edit-address': window.editAddress(idx); break;
            case 'delete-address': deleteAddress(idx); break;
            case 'add-utility': window.addUtility(idx); break;
            case 'edit-utility': window.editUtility(idx, uIdx); break;
            case 'delete-utility': deleteUtility(idx, uIdx); break;
            case 'edit-phone': window.editPhone(idx); break;
            case 'delete-phone': deletePhone(idx); break;
            case 'edit-email': window.editEmail(idx); break;
            case 'delete-email': deleteEmail(idx); break;
            case 'edit-doc': window.editUserDocument(idx); break;
            case 'delete-doc': deleteDocumento(idx); break;
        }
    });
}

async function syncData() {
    console.log("[VaultCheck] Avvio sincronizzazione protetta...");
    try {
        const user = auth.currentUser;
        if (!user) {
            showToast("Sessione scaduta: ricarica la pagina.", "error");
            return;
        }

        // Sanificazione array
        userAddresses = (userAddresses || []).filter(a => a != null);
        contactPhones = (contactPhones || []).filter(p => p != null);
        contactEmails = (contactEmails || []).filter(e => e != null);
        userDocuments = (userDocuments || []).filter(d => d != null);

        // Verifica MasterKey
        const masterKey = await ensureMasterKey();
        if (!masterKey) {
            showToast("Chiave Master mancante: impossibile cifrare.", "error");
            return;
        }

        console.log("[VaultCheck] Cifratura in corso...");

        // Cifratura Documenti (Selective Encryption V7.5)
        const encryptedDocuments = await Promise.all(userDocuments.map(async d => ({
            ...d,
            num_serie: await encrypt(d.num_serie || '', masterKey),
            cf_value: await encrypt(d.cf_value || '', masterKey),
            id_number: await encrypt(d.id_number || '', masterKey),
            license_number: await encrypt(d.license_number || '', masterKey),
            cf: await encrypt(d.cf || '', masterKey),
            username: await encrypt(d.username || '', masterKey),
            password: await encrypt(d.password || '', masterKey),
            pin: await encrypt(d.pin || '', masterKey),
            puk: await encrypt(d.puk || '', masterKey),
            codice_app: await encrypt(d.codice_app || '', masterKey),
            note: await encrypt(d.note || '', masterKey)
        })));

        // Cifratura Email (Selective: solo password e note)
        const encryptedEmails = await Promise.all(contactEmails.map(async e => ({
            ...e,
            password: await encrypt(e.password || '', masterKey),
            note: await encrypt(e.note || '', masterKey)
        })));

        // Cifratura Indirizzi (V7.5: Indirizzo in chiaro, solo Utenze cifrate)
        const encryptedAddresses = await Promise.all(userAddresses.map(async a => ({
            ...a,
            // address, civic, city, cap, province rimangono in chiaro
            utilities: await Promise.all((a.utilities || []).map(async u => ({
                ...u,
                value: await encrypt(u.value || '', masterKey)
            })))
        })));

        // Cifratura Telefoni (V7.5: Numero in chiaro)
        const encryptedPhones = [...contactPhones];

        // Commit finale su Firestore
        const finalUpdate = {
            nome: currentUserData.nome || '', // V7.5 In Chiaro
            cognome: currentUserData.cognome || '', // V7.5 In Chiaro
            birth_date: currentUserData.birth_date || '', // plaintext
            birth_place: currentUserData.birth_place || '', // V7.5 In Chiaro
            birth_province: currentUserData.birth_province || '', // plaintext
            note: await encrypt(currentUserData.note || '', masterKey),
            userAddresses: encryptedAddresses,
            contactPhones: encryptedPhones,
            contactEmails: encryptedEmails,
            documenti: encryptedDocuments,
            _encrypted: true
        };

        // Rimuovi eventuali undefined residui per sicurezza Firebase
        Object.keys(finalUpdate).forEach(key => finalUpdate[key] === undefined && delete finalUpdate[key]);

        await updateDoc(doc(db, "users", user.uid), finalUpdate);

        console.log("[VaultCheck] Sincronizzazione V6.1 completata con successo.");
        showToast(t('success_save'), "success");
    } catch (e) {
        logError("SyncData", e);
        showToast("Errore di sicurezza durante il salvataggio.", "error");
    }
}

async function deleteAddress(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo indirizzo?')) return;
    try {
        userAddresses.splice(idx, 1);
        userAddresses = userAddresses.filter(a => a !== undefined && a !== null);
        await syncData();
        renderAddressesView();
        console.log(`[Address] Eliminato indirizzo #${idx}. Rimanenti: ${userAddresses.length}`);
    } catch (e) {
        console.error('[Address] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione dell\'indirizzo.', 'error');
    }
}

async function deleteUtility(aIdx, uIdx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questa utenza?')) return;
    try {
        userAddresses[aIdx].utilities.splice(uIdx, 1);
        userAddresses[aIdx].utilities = (userAddresses[aIdx].utilities || []).filter(u => u !== undefined && u !== null);
        await syncData();
        renderAddressesView();
        console.log(`[Utility] Eliminata utenza #${uIdx} dall'indirizzo #${aIdx}`);
    } catch (e) {
        console.error('[Utility] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione dell\'utenza.', 'error');
    }
}

async function deletePhone(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo numero?')) return;
    try {
        contactPhones.splice(idx, 1);
        contactPhones = contactPhones.filter(p => p !== undefined && p !== null);
        await syncData();
        renderPhonesView();
        console.log(`[Phone] Eliminato numero #${idx}. Rimanenti: ${contactPhones.length}`);
    } catch (e) {
        console.error('[Phone] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione del numero.', 'error');
    }
}

async function deleteEmail(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questa email?')) return;
    try {
        contactEmails.splice(idx, 1);
        contactEmails = contactEmails.filter(e => e !== undefined && e !== null);
        await syncData();
        renderEmailsView();
        console.log(`[Email] Eliminata email #${idx}. Rimanenti: ${contactEmails.length}`);
    } catch (e) {
        console.error('[Email] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione dell\'email.', 'error');
    }
}

async function deleteDocumento(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo documento?')) return;
    try {
        userDocuments.splice(idx, 1);
        userDocuments = userDocuments.filter(d => d !== undefined && d !== null);
        await syncData();
        renderDocumentiView();
        console.log(`[Doc] Eliminato documento #${idx}. Rimanenti: ${userDocuments.length}`);
    } catch (e) {
        console.error('[Doc] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione del documento.', 'error');
    }
}

// Global exposure for Modal Handlers (Simulated as legacy window pattern but inside module)
/**
 * MODAL ENGINE (Specific for Profile)
 */
// Global exposure for Modal Handlers (Simulated as legacy window pattern but inside module)
/**
 * MODAL ENGINE (Specific for Profile)
 */
function showProfileModal(title, fields, currentValues, onSave) {
    try {
        const modalId = 'profile-edit-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = createElement('div', { id: modalId, className: 'modal-overlay' });
        const modalBox = createElement('div', { className: 'modal-box modal-profile-box' });

        const header = createElement('div', { className: 'modal-header' }, [
            createElement('h3', { className: 'modal-title', textContent: title }),
            createElement('div', { className: 'modal-accent-bar' })
        ]);

        // 🛡️ Trappola Anti-autofill V7.0 (Sempre presente all'inizio del form)
        const trap = createElement('div', { className: 'anti-autofill-trap', ariaHidden: 'true', style: 'position: absolute; left: -9999px;' }, [
            createElement('input', { type: 'text', name: 'user_login_trap', autocomplete: 'username', tabindex: '-1' }),
            createElement('input', { type: 'password', name: 'password_trap', autocomplete: 'current-password', tabindex: '-1' })
        ]);

        const form = createElement('div', { className: 'flex-col-gap', style: 'padding-bottom: 2rem;' });
        form.appendChild(trap);
        const formScroll = createElement('div', {
            className: 'modal-form-scroll vertical-scroll',
            style: 'max-height: 65vh; overflow-y: auto; padding-right: 5px;'
        }, [form]);
        const inputs = {};

        fields.forEach(f => {
            const val = currentValues[f.key] || '';
            let finalInputEl; // Elemento DOM da visualizzare
            let valueInput;   // Elemento DOM da cui leggere il valore (input o hidden select)

            if (f.type === 'select') {
                // --- CUSTOM SELECT LOGIC (Rounded & Styled) ---
                const hiddenSelect = createElement('select', { className: 'hidden-select', style: 'display:none;' },
                    (f.options || []).map(opt => createElement('option', { value: opt, textContent: opt, selected: opt === val }))
                );
                valueInput = hiddenSelect;

                finalInputEl = createElement('div', { className: 'custom-select-wrapper', style: 'position: relative; width: 100%;' }, [
                    hiddenSelect,
                    // Trigger
                    createElement('div', {
                        className: 'glass-field-input custom-select-trigger',
                        style: 'cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding-right: 0.5rem;',
                        onclick: (e) => {
                            e.stopPropagation();
                            const currentMenu = e.currentTarget.nextElementSibling;
                            // Chiudi tutti gli altri
                            document.querySelectorAll('.custom-select-menu.show').forEach(m => {
                                if (m !== currentMenu) m.classList.remove('show');
                            });
                            currentMenu.classList.toggle('show');
                        }
                    }, [
                        createElement('span', { className: 'selected-text', textContent: val || 'Seleziona...' }),
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'expand_more' })
                    ]),
                    // Menu Dropdown
                    createElement('div', { className: 'custom-select-menu vertical-scroll' },
                        (f.options || []).map(opt => createElement('div', {
                            className: 'custom-option',
                            textContent: opt,
                            onclick: (e) => {
                                e.stopPropagation();
                                const wrapper = e.currentTarget.closest('.custom-select-wrapper');
                                const sel = wrapper.querySelector('select');
                                const txt = wrapper.querySelector('.selected-text');
                                const menu = wrapper.querySelector('.custom-select-menu');

                                sel.value = opt;
                                txt.textContent = opt;
                                sel.dispatchEvent(new Event('change'));
                                menu.classList.remove('show');
                            }
                        }))
                    )
                ]);
            } else if (f.type === 'textarea' || f.key === 'note') {
                // --- TEXTAREA LOGIC (Auto-expanding) ---
                valueInput = createElement('textarea', {
                    className: 'glass-field-input vertical-scroll',
                    value: val,
                    placeholder: f.label,
                    style: 'width: 100%; border: none; background: transparent; color: inherit; padding: 12px 14px; resize: none; min-height: 150px; font-family: inherit; line-height: 1.6;',
                    oninput: (e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = (e.target.scrollHeight) + 'px';
                    }
                });
                finalInputEl = valueInput;
                // Initial size trigger
                setTimeout(() => {
                    valueInput.style.height = 'auto';
                    valueInput.style.height = (valueInput.scrollHeight) + 'px';
                }, 100);
            } else {
                // --- STANDARD INPUT LOGIC ---
                const k = (f.key || '').toLowerCase();
                const isSensitive = k.includes('pin') || k.includes('puk') || k.includes('password') ||
                    k.includes('num_serie') || k.includes('cf') || k.includes('username') ||
                    k.includes('id_number') || k.includes('license') || k.includes('app_code');

                const inputEl = createElement('input', {
                    type: 'text',
                    className: `glass-field-input ${isSensitive ? 'base-shield' : ''}`,
                    value: val,
                    placeholder: f.label,
                    style: 'flex: 1; border: none; background: transparent; color: inherit; padding: 0; min-width: 0;',
                    autocomplete: 'off',
                    autocorrect: 'off',
                    spellcheck: 'false'
                });
                valueInput = inputEl;

                if (isSensitive) {
                    const toggleBtn = createElement('button', {
                        className: 'btn-view-toggle',
                        style: 'background: transparent; border: none; color: var(--accent-primary, #6366f1); cursor: pointer; padding: 0 8px; display: flex; align-items: center; justify-content: center; min-width: 40px; opacity: 0.8;',
                        onclick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const icon = toggleBtn.querySelector('span');
                            if (inputEl.classList.contains('base-shield')) {
                                inputEl.classList.remove('base-shield');
                                icon.textContent = 'visibility';
                                toggleBtn.style.opacity = '1';
                            } else {
                                inputEl.classList.add('base-shield');
                                icon.textContent = 'visibility_off';
                                toggleBtn.style.opacity = '0.8';
                            }
                        }
                    }, [
                        createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 22px; color: inherit;', textContent: 'visibility_off' })
                    ]);
                    // Wrapper box per allineare input e occhio
                    finalInputEl = createElement('div', {
                        className: 'flex-center-row',
                        style: 'width: 100%; display: flex; align-items: center;'
                    }, [inputEl, toggleBtn]);
                } else {
                    finalInputEl = inputEl;
                }
            }

            // Container
            const isLong = f.type === 'textarea' || f.key === 'note';
            const fieldContainer = createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: f.label }),
                createElement('div', {
                    className: 'glass-field-box',
                    style: isLong ? 'display: block; padding: 0;' : 'padding-left: 1rem;'
                }, [
                    finalInputEl
                ])
            ]);

            // Map for saving
            inputs[f.key] = valueInput;

            form.appendChild(fieldContainer);
        });

        const actions = createElement('div', { className: 'modal-actions' }, [
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: t('cancel') || 'Annulla',
                onclick: () => closeModal()
            }),
            createElement('button', {
                className: 'btn-modal btn-primary',
                textContent: t('save') || 'Salva',
                onclick: async () => {
                    try {
                        const newData = {};
                        fields.forEach(f => {
                            if (inputs[f.key]) newData[f.key] = inputs[f.key].value.trim();
                        });
                        await onSave(newData);
                        closeModal();
                    } catch (e) {
                        console.error("Save Error:", e);
                        showToast(t('error_generic'), "error");
                    }
                }
            })
        ]);

        function closeModal() {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }

        setChildren(modalBox, [header, formScroll, actions]);
        modal.appendChild(modalBox);
        document.body.appendChild(modal);
        // Force reflow
        void modal.offsetWidth;
        setTimeout(() => modal.classList.add('active'), 10);
    } catch (e) {
        console.error("ShowProfileModal Error:", e);
        showToast("Errore interfaccia: " + e.message, "error");
    }
}

// Implementazione Azioni
async function editSection(sectionId) {
    if (sectionId === 'dati-personali') {
        const fields = [
            { key: 'nome', label: 'Nome', icon: 'person' },
            { key: 'cognome', label: 'Cognome', icon: 'person' },
            { key: 'birth_date', label: 'Data di Nascita', type: 'date', icon: 'calendar_today' },
            { key: 'birth_place', label: 'Luogo di Nascita', icon: 'location_city' },
            { key: 'birth_province', label: 'Provincia Nascita (es. PD)', icon: 'map' }
        ];
        showProfileModal('Dati Personali', fields, currentUserData, async (newData) => {
            try {
                const masterKey = await ensureMasterKey();
                const clearData = {
                    nome: newData.nome || '',
                    cognome: newData.cognome || '',
                    birth_date: newData.birth_date || '',
                    birth_place: newData.birth_place || '',
                    birth_province: newData.birth_province || ''
                };
                await updateDoc(doc(db, "users", currentUserUid), clearData);
                Object.assign(currentUserData, newData); // mantieni valori in chiaro in memoria
                await loadUserData(auth.currentUser);
                showToast(t('success_save'), "success");
            } catch (e) { logError("EditSection", e); showToast(t('error_generic'), "error"); }
        });
    } else if (sectionId === 'note') {
        const fields = [{ key: 'note', label: 'Note', type: 'textarea', icon: 'description' }];
        showProfileModal('Note Anagrafica', fields, currentUserData, async (newData) => {
            try {
                // [FIX] Cifra la nota prima di scrivere su Firestore
                const masterKey = await ensureMasterKey();
                const encryptedNote = await encrypt(newData.note || '', masterKey);
                await updateDoc(doc(db, "users", currentUserUid), { note: encryptedNote });
                currentUserData.note = newData.note; // mantieni in memoria il valore in chiaro
                // Ricarica il profilo (loadUserData decripta automaticamente)
                await loadUserData(auth.currentUser);
                showToast(t('success_save'), "success");
            } catch (e) { logError("EditSectionNote", e); showToast(t('error_generic'), "error"); }
        });
    }
}

window.editAddress = async (idx) => {
    const isNew = idx === -1;
    const addr = isNew ? { type: profileLabels.addressTypes[0], address: '', civic: '', cap: '', city: '', province: '', utilities: [] } : userAddresses[idx];
    const fields = [
        { key: 'type', label: 'Tipo', icon: 'label', type: 'select', options: profileLabels.addressTypes, configKey: 'addressTypes' },
        { key: 'address', label: 'Indirizzo', icon: 'home' },
        { key: 'civic', label: 'Civico', icon: 'numbers' },
        { key: 'cap', label: 'CAP', icon: 'mail_outline' },
        { key: 'city', label: 'Città', icon: 'location_city' },
        { key: 'province', label: 'Provincia', icon: 'map' }
    ];
    showProfileModal(isNew ? 'Nuovo Indirizzo' : 'Modifica Indirizzo', fields, addr, async (newData) => {
        if (isNew) {
            newData.utilities = [];
            userAddresses.push(newData);
        } else {
            Object.assign(userAddresses[idx], newData);
        }
        await syncData();
        renderAddressesView();
    });
};



window.editUserDocument = async (idx) => {
    const isNew = idx === -1;
    let tempDoc = isNew ? { type: profileLabels.documentTypes[0], num_serie: '', expiry_date: '' } : { ...userDocuments[idx] };

    const getDocumentFields = (type) => {
        const base = [
            { key: 'type', label: 'Tipo Documento', icon: 'badge', type: 'select', options: profileLabels.documentTypes, configKey: 'documentTypes' }
        ];

        const typeLower = (type || '').toLowerCase();

        if (typeLower.includes('identità')) {
            return [
                ...base,
                { key: 'num_serie', label: 'Numero Carta', icon: 'numbers' },
                { key: 'rilasciato_da', label: t('label_issued_by'), icon: 'account_balance' },
                { key: 'luogo_rilascio', label: t('label_release_place'), icon: 'location_on' },
                { key: 'data_rilascio', label: t('label_issue_date'), type: 'date', icon: 'history' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'username', label: 'Username / CF', icon: 'person' },
                { key: 'password', label: 'Password', icon: 'lock' },
                { key: 'pin', label: t('label_pin'), icon: 'password' },
                { key: 'puk', label: t('label_puk'), icon: 'security' },
                { key: 'codice_app', label: t('label_app_code'), icon: 'apps' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        } else if (typeLower.includes('patente')) {
            return [
                ...base,
                { key: 'num_serie', label: 'Patente', icon: 'numbers' },
                { key: 'rilasciato_da', label: t('label_issued_by'), icon: 'account_balance' },
                { key: 'data_rilascio', label: t('label_issue_date'), type: 'date', icon: 'history' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        } else if (typeLower.includes('fiscale')) {
            return [
                ...base,
                { key: 'num_serie', label: 'Codice Fiscale', icon: 'badge' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'id_number', label: t('label_id_number'), icon: 'numbers' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        } else if (typeLower.includes('passaporto')) {
            return [
                ...base,
                { key: 'num_serie', label: 'Numero Passaporto', icon: 'numbers' },
                { key: 'rilasciato_da', label: t('label_issued_by'), icon: 'account_balance' },
                { key: 'data_rilascio', label: t('label_issue_date'), type: 'date', icon: 'history' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        }

        return [
            ...base,
            { key: 'num_serie', label: 'Numero / Codice', icon: 'numbers' },
            { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
            { key: 'note', label: 'Note', icon: 'description' }
        ];
    };

    const openModal = (currentVals) => {
        const fields = getDocumentFields(currentVals.type);
        showProfileModal(isNew ? 'Nuovo Documento' : 'Modifica Documento', fields, currentVals, async (newData) => {
            // Merge remaining temp fields if any (to avoid losing data when switching types)
            const finalData = { ...currentVals, ...newData };

            // Normalize for legacy compatibility if needed
            if (finalData.type.toLowerCase().includes('patente')) finalData.license_number = finalData.num_serie;
            if (finalData.type.toLowerCase().includes('fiscale')) finalData.cf_value = finalData.num_serie;

            if (isNew) {
                userDocuments.push(finalData);
            } else {
                userDocuments[idx] = finalData;
            }
            await syncData();
            renderDocumentiView();
        });

        // Add change listener to the type select
        const modal = document.getElementById('profile-edit-modal');
        const typeSelect = modal?.querySelector('select');
        if (typeSelect) {
            typeSelect.onchange = (e) => {
                const newType = e.target.value;
                // Capture current values from inputs before refreshing
                const currentInputs = modal.querySelectorAll('input');
                const capturedData = { ...currentVals, type: newType };
                currentInputs.forEach(inp => {
                    const key = inp.closest('.glass-field-container')?.querySelector('.view-label')?.textContent;
                    // We need a better way to map label back to key, or just find by key if we had IDs
                    // But in showProfileModal we stored inputs in a local 'inputs' object.
                    // Instead of brittle DOM traversal, let's just use the current values and the new type for now.
                    // Or better: modify showProfileModal to support updating fields.
                });

                // For now, just re-open with new type
                openModal({ ...currentVals, type: newType });
            };
        }
    };

    openModal(tempDoc);
};

window.addUtility = async (addrIdx) => {
    const fields = [
        { key: 'type', label: 'Tipo', icon: 'bolt', type: 'select', options: profileLabels.utilityTypes, configKey: 'utilityTypes' },
        { key: 'value', label: 'Codice / Identificativo', icon: 'vpn_key' }
    ];
    showProfileModal('Aggiungi Utenza', fields, {}, async (newData) => {
        if (!userAddresses[addrIdx].utilities) userAddresses[addrIdx].utilities = [];
        userAddresses[addrIdx].utilities.push(newData);
        await syncData();
        renderAddressesView();
    });
};

window.editUtility = async (addrIdx, uIdx) => {
    const util = userAddresses[addrIdx].utilities[uIdx];
    const fields = [
        { key: 'type', label: 'Tipo', icon: 'bolt', type: 'select', options: profileLabels.utilityTypes, configKey: 'utilityTypes' },
        { key: 'value', label: 'Codice / Identificativo', icon: 'vpn_key' }
    ];
    showProfileModal('Modifica Utenza', fields, util, async (newData) => {
        Object.assign(userAddresses[addrIdx].utilities[uIdx], newData);
        await syncData();
        renderAddressesView();
    });
};

// 🛡️ ESPOSIZIONE DIAGNOSTICA (V3.2 — Audit Ready)
window.profiloPrivato = {
    async decryptAll() {
        if (typeof auth.currentUser === 'object') {
            return await loadUserData(auth.currentUser);
        }
    },
    async encryptAllIfNeeded() {
        // Logica di self-healing: se dati sono in chiaro e masterKey è pronta, cifra e salva.
        const masterKey = await ensureMasterKey().catch(() => null);
        if (!masterKey || !currentUserData) return;

        if (!currentUserData._encrypted) {
            console.log("[VaultCheck] Avvio cifratura profilo...");
            // Esempio: cifra la nota se presente
            if (currentUserData.note && currentUserData.note.length < 60) {
                currentUserData.note = await encrypt(currentUserData.note, masterKey);
                currentUserData._encrypted = true;
                await syncData();
            }
        }
    }
};

