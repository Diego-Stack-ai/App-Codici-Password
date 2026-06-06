/**
 * PROFILO PRIVATO MODULE (V5.0 — Refactored)
 * Gestione profilo con form dinamici e protocollo DOM sicuro.
 *
 * ARCHITETTURA:
 * - showProfileModal  → profilo-modal.js (UI engine autonomo)
 * - Stato condiviso   → questo file (currentUserData, contactPhones, ecc.)
 * - Entry Point       → initProfiloPrivato(user)
 *
 * SEZIONI:
 * 1. STATE & INIT
 * 2. DATA LOADING (loadUserData)
 * 3. PHONES
 * 4. AVATAR & LABELS & QR
 * 5. ADDRESSES & UTILITIES
 * 6. EMAILS
 * 7. DOCUMENTS
 * 8. DELEGATION & SYNC
 * 9. AZIONI (edit/add/delete con modal)
 */

import { auth, db, storage } from '../../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { showProfileModal } from './profilo-modal.js';
import { editSection, editAddress, editUserDocument, addUtility, editUtility } from './profilo-actions.js';
import { ensureQRCodeLib, buildVCard, renderQRCode } from '../shared/qr_code_utils.js';
import { logError, formatDateToIT } from '../../utils.js';
import { encrypt, decrypt, ensureMasterKey, clearSession, isAutoUnlockActive } from '../core/security-manager.js';
import { decryptIfPossible, isEncryptedValue } from '../core/crypto-utils.js';

// Le funzioni crypto sono disponibili solo via import ES6 (non esposte globalmente per sicurezza)
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
    
    if (!user) return;

    currentUserUid = user.uid;

    await loadUserData(user);

    const ctx = buildCtx();

    // Setup UI Handlers
    setupAvatarEdit();
    setupDelegation(ctx);
    setupPersonalDataCopy();
    initProxyDropdowns();
    setupQRToggles();
    setupCollapsibleSections();
    // saveProfileLabels() non va chiamata all'init — viene chiamata al cambio dropdown
}

/** Context object per profilo-actions.js — raccoglie lo stato condiviso */
function buildCtx() {
    return {
        currentUserUid,
        currentUserData,
        userAddresses,
        userDocuments,
        profileLabels,
        syncData,
        renderAddressesView,
        renderDocumentiView,
        loadUserData
    };
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
            // Dati personali
            currentUserData.nome = await decryptIfPossible(currentUserData.nome, masterKey);
            currentUserData.cognome = await decryptIfPossible(currentUserData.cognome, masterKey);
            currentUserData.birth_place = await decryptIfPossible(currentUserData.birth_place, masterKey);
            currentUserData.note = await decryptIfPossible(currentUserData.note, masterKey);

            // Telefoni
            if (Array.isArray(currentUserData.contactPhones)) {
                currentUserData.contactPhones = await Promise.all(currentUserData.contactPhones.map(async p => ({
                    ...p,
                    number: await decryptIfPossible(p.number, masterKey)
                })));
            }

            // Indirizzi
            if (Array.isArray(currentUserData.userAddresses)) {
                currentUserData.userAddresses = await Promise.all(currentUserData.userAddresses.map(async a => ({
                    ...a,
                    address: await decryptIfPossible(a.address, masterKey),
                    civic: await decryptIfPossible(a.civic, masterKey),
                    city: await decryptIfPossible(a.city, masterKey),
                    cap: await decryptIfPossible(a.cap, masterKey),
                    province: await decryptIfPossible(a.province, masterKey),
                    utilities: await Promise.all((a.utilities || []).map(async u => ({
                        ...u,
                        value: await decryptIfPossible(u.value, masterKey)
                    })))
                })));
            }

            // Documenti (Copertura Totale V7.0)
            if (Array.isArray(currentUserData.documenti)) {
                currentUserData.documenti = await Promise.all(currentUserData.documenti.map(async d => {
                    const dec = { ...d };
                    const fields = [
                        'num_serie', 'cf_value', 'id_number', 'license_number', 'cf',
                        'rilasciato_da', 'luogo_rilascio', 'username', 'password',
                        'pin', 'puk', 'codice_app', 'note', 'categoria', 'home_page'
                    ];
                    for (const f of fields) {
                        if (dec[f]) dec[f] = await decryptIfPossible(dec[f], masterKey);
                    }
                    return dec;
                }));
            }

            // Email
            if (Array.isArray(currentUserData.contactEmails)) {
                currentUserData.contactEmails = await Promise.all(currentUserData.contactEmails.map(async e => ({
                    ...e,
                    password: await decryptIfPossible(e.password, masterKey),
                    note: await decryptIfPossible(e.note, masterKey)
                })));
            }
            window.LOG("[VaultCheck] Decrittazione granulare V6.1.5 completata.");
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
    btnAdd.onclick = () => addPhone();
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
                createElement('button', { className: 'btn-edit-section', onclick: () => editPhone(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined icon-edit', textContent: 'edit' })
                ]),
                createElement('button', { className: 'btn-edit-section btn-delete', onclick: () => deletePhone(idx) }, [
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

async function addPhone() {
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

async function editPhone(idx) {
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
                        const newName = await showInputModal('Rinomina voce', opt.value, 'Nuovo nome etichetta...');
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
                        const okDel = await showConfirmModal(`Eliminare "${opt.value}"?`);
                        if (okDel) {
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
                const newLabel = await showInputModal('Aggiungi voce', '', 'Nome nuova etichetta...');
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
    btnAdd.onclick = () => editAddress(-1);
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
    btnAdd.onclick = () => editEmail(-1);

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

async function addEmail() {
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

async function editEmail(idx) {
    if (idx === -1) { addEmail(); return; }
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
    btnAdd.onclick = () => editUserDocument(-1);

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

                    // Blocco Dati Accesso / Sicurezza (PIN, PUK, Username, Password)
                    (docItem.username || docItem.password || docItem.pin || docItem.puk || docItem.codice_app) ? createElement('div', {
                        className: 'flex-col-gap-xs',
                        style: 'margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;'
                    }, [
                        docItem.username ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'USERNAME:' }),
                            createElement('span', { className: 'data-value truncate', style: 'flex: 1;', textContent: docItem.username }),
                            createCopyBtn(docItem.username)
                        ]) : null,

                        docItem.password ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'PASSWORD:' }),
                            createElement('span', {
                                className: 'data-value base-shield',
                                style: 'flex: 1;',
                                textContent: docItem.password,
                                dataset: { pwd: docItem.password, visible: 'false' }
                            }),
                            createElement('div', { className: 'flex-center-row', style: 'gap: 4px;' }, [
                                createElement('button', {
                                    className: 'btn-action-mini',
                                    onclick: (e) => {
                                        const span = e.currentTarget.parentElement.parentElement.querySelector('.data-value');
                                        const isVisible = span.dataset.visible === 'true';
                                        span.classList.toggle('base-shield', isVisible);
                                        span.dataset.visible = !isVisible;
                                        e.currentTarget.querySelector('span').textContent = isVisible ? 'visibility' : 'visibility_off';
                                    }
                                }, [createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 16px;', textContent: 'visibility' })]),
                                createCopyBtn(docItem.password)
                            ])
                        ]) : null,

                        docItem.pin ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'PIN:' }),
                            createElement('span', { className: 'data-value', style: 'flex: 1;', textContent: docItem.pin }),
                            createCopyBtn(docItem.pin)
                        ]) : null,

                        docItem.puk ? createElement('div', { className: 'field-value-row', style: 'margin-bottom: 4px;' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'PUK:' }),
                            createElement('span', { className: 'data-value', style: 'flex: 1;', textContent: docItem.puk }),
                            createCopyBtn(docItem.puk)
                        ]) : null,

                        docItem.codice_app ? createElement('div', { className: 'field-value-row' }, [
                            createElement('span', { className: 'data-label', style: 'width: 100px;', textContent: 'APP CODE:' }),
                            createElement('span', { className: 'data-value', style: 'flex: 1;', textContent: docItem.codice_app }),
                            createCopyBtn(docItem.codice_app)
                        ]) : null
                    ].filter(Boolean)) : null,

                    createElement('div', { className: 'flex-col-gap-xs', style: 'margin-top: 10px; opacity: 0.8;' }, [
                        docItem.data_rilascio ? createElement('div', { className: 'flex-center-row', style: 'gap: 6px;' }, [
                            createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'history' }),
                            createElement('span', { className: 'data-value-sub', textContent: `Emesso: ${formatDateToIT(docItem.data_rilascio)}` })
                        ]) : null,

                        docItem.expiry_date ? createElement('div', { className: 'flex-center-row', style: 'gap: 6px;' }, [
                            createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 14px;', textContent: 'event' }),
                            createElement('span', { className: 'data-value-sub', textContent: `Scadenza: ${formatDateToIT(docItem.expiry_date)}` })
                        ]) : null
                    ].filter(Boolean)),

                    docItem.home_page ? createElement('div', { className: 'flex-center-row', style: 'gap: 6px; margin-top: 10px;' }, [
                        createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 18px; color: var(--accent);', textContent: 'language' }),
                        createElement('a', {
                            href: docItem.home_page.startsWith('http') ? docItem.home_page : `https://${docItem.home_page}`,
                            target: '_blank',
                            className: 'data-value-sub truncate underline',
                            style: 'color: var(--accent);',
                            textContent: docItem.home_page
                        })
                    ]) : null,

                    docItem.note ? createElement('p', { className: 'note-text', style: 'margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; font-style: italic;', textContent: docItem.note }) : null
                ])
            ])
        ]);
    });
    setChildren(container, [btnAdd, ...items]);
}

/**
 * DELEGATION & MODALS (Form logic remains in UI-CORE if generic, or here if specific)
 */
// ─── SECTION 8: DELEGATION & SYNC ────────────────────────────────────────────

function setupDelegation(ctx) {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const idx = parseInt(target.dataset.idx);
        const uIdx = parseInt(target.dataset.uidx);

        switch (action) {
            // Azioni estratte in profilo-actions.js
            case 'edit-section': editSection(target.dataset.target, ctx); break;
            case 'edit-address': editAddress(idx, ctx); break;
            case 'add-utility': addUtility(idx, ctx); break;
            case 'edit-utility': editUtility(idx, uIdx, ctx); break;
            case 'edit-doc': editUserDocument(idx, ctx); break;
            // Azioni delete rimaste qui (usano syncData e array direttamente)
            case 'delete-address': deleteAddress(idx); break;
            case 'delete-utility': deleteUtility(idx, uIdx); break;
            case 'edit-phone': editPhone(idx); break;
            case 'delete-phone': deletePhone(idx); break;
            case 'edit-email': editEmail(idx); break;
            case 'delete-email': deleteEmail(idx); break;
            case 'delete-doc': deleteDocumento(idx); break;
        }
    });
}

async function syncData() {
    window.LOG("[VaultCheck] Avvio sincronizzazione protetta...");
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

        window.LOG("[VaultCheck] Cifratura in corso...");

        // Cifratura Documenti (Selective Encryption V7.5)
        const encryptedDocuments = await Promise.all(userDocuments.map(async d => {
            const enc = { ...d };
            const fields = [
                'num_serie', 'cf_value', 'id_number', 'license_number', 'cf',
                'rilasciato_da', 'luogo_rilascio', 'username', 'password',
                'pin', 'puk', 'codice_app', 'note', 'categoria', 'home_page'
            ];
            for (const f of fields) {
                if (enc[f]) enc[f] = await encrypt(enc[f] || '', masterKey);
            }
            return enc;
        }));

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

        window.LOG("[VaultCheck] Sincronizzazione V6.1 completata con successo.");
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
        window.LOG(`[Address] Eliminato indirizzo #${idx}. Rimanenti: ${userAddresses.length}`);
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
        window.LOG(`[Utility] Eliminata utenza #${uIdx} dall'indirizzo #${aIdx}`);
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
        window.LOG(`[Phone] Eliminato numero #${idx}. Rimanenti: ${contactPhones.length}`);
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
        window.LOG(`[Email] Eliminata email #${idx}. Rimanenti: ${contactEmails.length}`);
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
        window.LOG(`[Doc] Eliminato documento #${idx}. Rimanenti: ${userDocuments.length}`);
    } catch (e) {
        console.error('[Doc] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione del documento.', 'error');
    }
}

// ─── SECTION 9: AZIONI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// editSection, editAddress, editUserDocument, addUtility, editUtility
// sono in ./profilo-actions.js (context-based pattern)
