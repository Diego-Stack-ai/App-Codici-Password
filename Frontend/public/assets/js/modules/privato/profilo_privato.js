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
    emailLabels: ['Personale', 'Lavoro', 'Principale', 'Altro'],
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

        // Hero Header
        const fullName = `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim() || user.displayName || 'Utente';
        if (nameDisplay) nameDisplay.textContent = fullName;
        if (avatarImg) avatarImg.src = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";

        // View Population
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
        set('nome-view', fullName);

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
    const card = createElement('div', { className: 'form-card' }, [
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
        contactPhones.push(newData);
        await updateDoc(doc(db, "users", currentUserUid), { contactPhones });
        renderPhonesView();
        showToast(t('success_save'), "success");
    });
};

window.editPhone = async (idx) => {
    const phone = contactPhones[idx];
    // Ensure label exists
    if (!phone.label) {
        phone.label = profileLabels.phoneLabels[0];
    }
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.phoneLabels, configKey: 'phoneLabels' },
        { key: 'number', label: 'Numero', icon: 'call' }
    ];
    showProfileModal('Modifica Telefono', fields, phone, async (newData) => {
        contactPhones[idx] = newData;
        await updateDoc(doc(db, "users", currentUserUid), { contactPhones });
        renderPhonesView();
        showToast(t('success_save'), "success");
    });
};

window.deletePhone = async (idx) => {
    if (!confirm(t('confirm_delete') || 'Eliminare questo telefono?')) return;
    contactPhones.splice(idx, 1);
    await updateDoc(doc(db, "users", currentUserUid), { contactPhones });
    renderPhonesView();
    showToast(t('success_delete') || 'Telefono eliminato', "success");
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
    const card = createElement('div', { className: 'form-card' }, [
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
        return createElement('div', { className: 'form-card' }, [
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
                    createElement('span', { className: 'data-value', textContent: e.address || '-' }),
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
                ]) : createElement('span', { className: 'data-value-sub', textContent: 'No PWD' })
            ])
        ]);
    });
    setChildren(container, [btnAdd, ...items]);
}

window.addEmail = async () => {
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.emailLabels, configKey: 'emailLabels' },
        { key: 'address', label: 'Indirizzo Email', icon: 'alternate_email', type: 'text' },
        { key: 'password', label: 'Password (opzionale)', icon: 'key', type: 'password' }
    ];
    showProfileModal('Aggiungi Email', fields, { label: profileLabels.emailLabels[0] }, async (newData) => {
        contactEmails.push(newData);
        await updateDoc(doc(db, "users", currentUserUid), { contactEmails });
        renderEmailsView();
        showToast(t('success_save'), "success");
    });
};

window.editEmail = async (idx) => {
    if (idx === -1) {
        window.addEmail();
        return;
    }
    const email = contactEmails[idx];
    // Ensure label exists
    if (!email.label) {
        email.label = profileLabels.emailLabels[0];
    }
    const fields = [
        { key: 'label', label: 'Etichetta', icon: 'label', type: 'select', options: profileLabels.emailLabels, configKey: 'emailLabels' },
        { key: 'address', label: 'Indirizzo Email', icon: 'alternate_email', type: 'text' },
        { key: 'password', label: 'Password (opzionale)', icon: 'key', type: 'password' }
    ];
    showProfileModal('Modifica Email', fields, email, async (newData) => {
        contactEmails[idx] = newData;
        await updateDoc(doc(db, "users", currentUserUid), { contactEmails });
        renderEmailsView();
        showToast(t('success_save'), "success");
    });
};

window.deleteEmail = async (idx) => {
    if (!confirm(t('confirm_delete') || 'Eliminare questa email?')) return;
    contactEmails.splice(idx, 1);
    await updateDoc(doc(db, "users", currentUserUid), { contactEmails });
    renderEmailsView();
    showToast(t('success_delete') || 'Email eliminata', "success");
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
        return createElement('div', { className: 'form-card' }, [
            createElement('div', { className: 'card-header-row' }, [
                createElement('div', { className: 'card-icon-stack' }, [
                    createElement('div', { className: 'card-icon-box' }, [
                        createElement('span', { className: 'material-symbols-outlined filled', textContent: 'description' })
                    ]),
                    createElement('span', { className: 'data-label', textContent: docItem.type })
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
                    createElement('span', { className: 'data-value-sub', textContent: docItem.expiry_date ? formatDateToIT(docItem.expiry_date) : '' })
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

// Internal Logic (Simulated common logic as previously refactored)
async function syncData() {
    try {
        await updateDoc(doc(db, "users", currentUserUid), {
            userAddresses, contactPhones, contactEmails, documenti: userDocuments
        });
        showToast(t('success_save'), "success");
    } catch (e) { logError("SyncData", e); showToast(t('error_generic'), "error"); }
}

async function deleteAddress(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo indirizzo?')) return;
    userAddresses.splice(idx, 1);
    await syncData(); renderAddressesView();
}

async function deleteUtility(aIdx, uIdx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questa utenza?')) return;
    userAddresses[aIdx].utilities.splice(uIdx, 1);
    await syncData(); renderAddressesView();
}

async function deletePhone(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo numero?')) return;
    contactPhones.splice(idx, 1);
    await syncData(); renderPhonesView();
}

async function deleteEmail(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questa email?')) return;
    contactEmails.splice(idx, 1);
    await syncData(); renderEmailsView();
}

async function deleteDocumento(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo documento?')) return;
    userDocuments.splice(idx, 1);
    await syncData(); renderDocumentiView();
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

        const form = createElement('div', { className: 'flex-col-gap' });
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
                                menu.classList.remove('show');
                            }
                        }))
                    )
                ]);
            } else {
                // --- STANDARD INPUT LOGIC ---
                valueInput = createElement('input', {
                    type: f.type || 'text',
                    className: 'glass-field-input',
                    value: val,
                    placeholder: f.label,
                    style: 'width: 100%; border: none; background: transparent; color: inherit; padding: 0;'
                });
                finalInputEl = valueInput;
            }

            // Container
            const fieldContainer = createElement('div', { className: 'glass-field-container' }, [
                createElement('label', { className: 'view-label', textContent: f.label }),
                createElement('div', { className: 'glass-field-box', style: 'padding-left: 1rem;' }, [
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

        setChildren(modalBox, [header, form, actions]);
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
                await updateDoc(doc(db, "users", currentUserUid), newData);
                Object.assign(currentUserData, newData);
                await loadUserData(auth.currentUser);
                showToast(t('success_save'), "success");
            } catch (e) { logError("EditSection", e); showToast(t('error_generic'), "error"); }
        });
    } else if (sectionId === 'note') {
        const fields = [{ key: 'note', label: 'Note', icon: 'description' }];
        showProfileModal('Note Anagrafica', fields, currentUserData, async (newData) => {
            try {
                await updateDoc(doc(db, "users", currentUserUid), newData);
                currentUserData.note = newData.note;
                await loadUserData(auth.currentUser);
                showToast(t('success_save'), "success");
            } catch (e) { logError("EditSectionNotice", e); showToast(t('error_generic'), "error"); }
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
    const docItem = isNew ? { type: profileLabels.documentTypes[0], num_serie: '', expiry_date: '' } : userDocuments[idx];

    // Ensure type exists for old documents
    if (!docItem.type) {
        docItem.type = profileLabels.documentTypes[0];
    }

    // Supporto per carichi legacy o mappature diverse
    const currentNum = docItem.num_serie || docItem.cf_value || docItem.license_number || docItem.id_number || '';

    const fields = [
        { key: 'type', label: 'Tipo Documento', icon: 'badge', type: 'select', options: profileLabels.documentTypes, configKey: 'documentTypes' },
        { key: 'num_serie', label: 'Numero / Codice', icon: 'numbers' },
        { key: 'expiry_date', label: 'Scadenza', type: 'date', icon: 'calendar_today' }
    ];

    // Preparazione valori correnti per il modal (normalizzazione temporanea)
    const modalValues = { ...docItem, num_serie: currentNum };

    showProfileModal(isNew ? 'Nuovo Documento' : 'Modifica Documento', fields, modalValues, async (newData) => {
        // Normalizzazione chiavi per compatibilità Firebase
        if (newData.type && newData.type.toLowerCase().includes('patente')) {
            newData.license_number = newData.num_serie;
        }
        if (newData.type && newData.type.toLowerCase().includes('fiscale')) {
            newData.cf_value = newData.num_serie;
        }

        if (isNew) {
            userDocuments.push(newData);
        } else {
            Object.assign(userDocuments[idx], newData);
        }
        await syncData();
        renderDocumentiView();
    });
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

