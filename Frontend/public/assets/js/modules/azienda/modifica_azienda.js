/**
 * MODIFICA AZIENDA MODULE (V5.0 ADAPTER)
 * Gestione anagrafica, allegati, sedi e contatti di un'azienda esistente.
 * - Entry Point: initModificaAzienda(user)
 */

import { auth, db, storage } from '../../firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let currentUid = null;
let currentAziendaId = null;
let selectedFiles = [];
let existingAttachments = [];
let eventsInitialized = false; // Prevent multiple listeners on body

// --- INITIALIZATION ---
export async function initModificaAzienda(user) {
    console.log("[EDIT-AZIENDA] Init V5.0...");
    if (!user) return;
    currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    currentAziendaId = urlParams.get('id');

    if (!currentAziendaId) {
        showToast("ID mancante", "error");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1500);
        return;
    }

    initProtocolUI();
    await loadAzienda();
    initFormEvents();

    console.log("[EDIT-AZIENDA] Ready.");
}

async function initProtocolUI() {
    console.log('[modifica_azienda] Configurazione azioni footer...');

    // Footer Center - Pulsante Delete
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('button', {
            id: 'btn-delete',
            className: 'footer-action-btn btn-danger',
            onclick: deleteAzienda
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'delete_forever' })
        ]));
    }

    // Footer Right
    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, createElement('button', {
            id: 'btn-save',
            className: 'footer-action-btn btn-primary',
            onclick: saveAzienda
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]));
    }
}

async function loadAzienda() {
    try {
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            showToast(t('error_not_found'), "error");
            return;
        }
        const data = snap.data();
        populateForm(data);
    } catch (e) {
        logError("LoadAzienda", e);
        showToast(t('error_generic'), "error");
    }
}

function initFormEvents() {
    // Logo & Photos
    document.getElementById('btn-trigger-logo')?.addEventListener('click', () => document.getElementById('logo-upload')?.click());
    document.getElementById('logo-upload')?.addEventListener('change', (e) => handleImagePreview(e, 'logo-preview', 'logo-placeholder'));

    document.getElementById('btn-trigger-ref-photo')?.addEventListener('click', () => document.getElementById('referente-photo-upload')?.click());
    document.getElementById('referente-photo-upload')?.addEventListener('change', (e) => handleImagePreview(e, 'referente-photo-preview', 'referente-photo-placeholder'));

    // Toggles & Sections
    document.body.addEventListener('click', (e) => {
        // Se il click è su un elemento che deve fermare la propagazione del toggle (es. input, button cestino)
        if (e.target.closest('[data-stop-propagation]')) return;

        const btnToggle = e.target.closest('.btn-toggle-section');
        if (btnToggle) {
            e.preventDefault();
            toggleSection(btnToggle.dataset.target, btnToggle);
        }

        const btnPass = e.target.closest('.btn-toggle-pass');
        if (btnPass) {
            const input = document.getElementById(btnPass.dataset.target);
            if (input) {
                const isShield = input.classList.toggle('base-shield');
                const icon = btnPass.querySelector('span');
                if (icon) icon.textContent = isShield ? 'visibility' : 'visibility_off';
            }
        }
    });

    // Attachments Premium
    const btnUpload = document.getElementById('btn-trigger-upload');
    if (btnUpload) {
        btnUpload.onclick = openSourceSelector;
    }

    // Modal Events
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.querySelectorAll('[data-source]').forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.source;
                const input = document.getElementById(`input-${type}`);
                if (input) input.click();
                closeSourceSelector();
            };
        });
        document.getElementById('btn-cancel-source').onclick = closeSourceSelector;
    }

    // Hidden Inputs listeners
    ['input-camera', 'input-gallery', 'input-file'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                selectedFiles.push(...files);
                renderAttachments();
            }
            e.target.value = '';
        });
    });

    // Extra Emails
    document.getElementById('btn-add-email')?.addEventListener('click', () => addExtraEmail());
    // Extra Sedi
    document.getElementById('btn-add-sede')?.addEventListener('click', () => addExtraSede());
}

window.openSourceSelector = openSourceSelector;
window.closeSourceSelector = closeSourceSelector;

function openSourceSelector() {
    console.log("Opening Source Selector Modifica Azienda");
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Modale non trovato");
    }
}

function closeSourceSelector() {
    const modal = document.getElementById('source-selector-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function handleImagePreview(e, previewId, placeholderId) {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.getElementById(previewId);
            const placeholder = document.getElementById(placeholderId);
            if (img) { img.src = ev.target.result; img.classList.remove('hidden'); }
            if (placeholder) placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function toggleSection(id, btn) {
    const el = document.getElementById(id);
    const arrow = btn.querySelector('.chevron') || btn.querySelector('.icon-chevron') || document.getElementById('arrow-' + id);
    if (!el) return;

    // Se ha la classe hidden-content, la rimuoviamo per permettere il calcolo delle dimensioni
    if (el.classList.contains('hidden-content')) {
        el.classList.remove('hidden-content');
        el.style.maxHeight = '0px'; // Assicuriamo che parta da 0 se era nascosto via classe
    }

    const isOpen = el.style.maxHeight && el.style.maxHeight !== '0px';

    if (isOpen) {
        el.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
        // Opzionale: rimettiamo la classe dopo la transizione (400ms)
        setTimeout(() => {
            if (el.style.maxHeight === '0px') el.classList.add('hidden-content');
        }, 400);
    } else {
        // Rimuoviamo preventivamente la classe se presente (doppio controllo)
        el.classList.remove('hidden-content');
        // Forza il ricalcolo per permettere la transizione da 0 a scrollHeight
        const contentHeight = el.scrollHeight;
        el.style.maxHeight = contentHeight + 'px';
        if (arrow) arrow.style.transform = 'rotate(180deg)';

        // Per evitare problemi con contenuti dinamici che cambiano altezza, 
        // dopo la transizione possiamo mettere 'none' o 'max-content'
        setTimeout(() => {
            if (el.style.maxHeight !== '0px') el.style.maxHeight = 'none';
        }, 400);
    }
}

function populateForm(data) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    set('ragione-sociale', data.ragioneSociale);
    set('tipo-sede-legale', data.tipoSedeLegale || 'Sede Legale');
    set('telefono-azienda', data.telefonoAzienda);
    set('fax-azienda', data.faxAzienda);
    set('piva', data.partitaIva);
    set('codice-sdi', data.codiceSDI);
    set('referente-titolo', data.referenteTitolo);
    set('referente-nome', data.referenteNome);
    set('referente-cognome', data.referenteCognome);
    set('referente-cellulare', data.referenteCellulare);
    set('indirizzo', data.indirizzoSede);
    set('civico', data.civicoSede);
    set('citta', data.cittaSede);
    set('provincia', data.provinciaSede);
    set('cap', data.capSede);
    set('numero-cciaa', data.numeroCCIAA);
    set('data-iscrizione', data.dataIscrizione);
    set('note-azienda', data.note);

    if (data.emails) {
        set('type-pec', data.emails.pec?.tipo || 'PEC Aziendale');
        set('email-pec', data.emails.pec?.email);
        set('email-pec-password', data.emails.pec?.password);
        set('email-pec-note', data.emails.pec?.note);
        set('type-amministrazione', data.emails.amministrazione?.tipo || 'Amministrazione');
        set('email-amministrazione', data.emails.amministrazione?.email);
        set('email-amministrazione-password', data.emails.amministrazione?.password);
        set('email-amministrazione-note', data.emails.amministrazione?.note);
        set('type-personale', data.emails.personale?.tipo || 'Personale');
        set('email-personale', data.emails.personale?.email);
        set('email-personale-password', data.emails.personale?.password);
        set('email-personale-note', data.emails.personale?.note);

        // Extra Sedi
        const sediContainer = document.getElementById('altre-sedi-container');
        if (sediContainer) clearElement(sediContainer);

        if (data.altreSedi && Array.isArray(data.altreSedi)) {
            data.altreSedi.forEach(s => addExtraSede(s));
        } else {
            // Tentativo recupero legacy (admin/oper) se l'array non esisteva
            // Ma se non esisteva, è perché è la prima volta o sono vuoti.
            // Possiamo opzionalmente aggiungere una sede vuota se vogliamo, ma meglio di no.
        }
        const container = document.getElementById('email-extra-container');
        if (container) clearElement(container);

        // 1. Check for custom keys (legacy or manual db entries)
        const fixedKeys = ['pec', 'amministrazione', 'personale', 'extra'];
        Object.keys(data.emails).forEach(key => {
            if (!fixedKeys.includes(key)) {
                const obj = data.emails[key];
                if (obj && typeof obj === 'object') {
                    addExtraEmail({
                        tipo: key, // Use key as type label
                        email: obj.email || '',
                        password: obj.password || '',
                        note: obj.note || ''
                    });
                }
            }
        });

        // 2. Check for new array format
        if (data.emails.extra && Array.isArray(data.emails.extra)) {
            data.emails.extra.forEach(item => addExtraEmail(item));
        }
    }

    if (data.logo) {
        const p = document.getElementById('logo-preview');
        const h = document.getElementById('logo-placeholder');
        if (p) { p.src = data.logo; p.classList.remove('hidden'); }
        if (h) h.classList.add('hidden');
    }
    if (data.referentePhoto) {
        const p = document.getElementById('referente-photo-preview');
        const h = document.getElementById('referente-photo-placeholder');
        if (p) { p.src = data.referentePhoto; p.classList.remove('hidden'); }
        if (h) h.classList.add('hidden');
    }



    document.querySelectorAll('input[data-qr-field]').forEach(cb => {
        const field = cb.dataset.qrField;
        if (data.qrConfig && data.qrConfig.hasOwnProperty(field)) cb.checked = data.qrConfig[field];
    });

    existingAttachments = data.allegati || [];
    renderAttachments();
}

function renderAttachments() {
    const list = document.getElementById('attachments-list');
    if (!list) return;
    clearElement(list);

    const all = [
        ...existingAttachments.map((f, i) => ({ ...f, existing: true, idx: i })),
        ...selectedFiles.map((f, i) => ({ name: f.name, existing: false, idx: i }))
    ];

    const cards = all.map(f => {
        const type = (f.name || "").toLowerCase();
        let icon = 'description';
        let color = 'text-white/20';

        if (type.endsWith('.pdf')) { icon = 'picture_as_pdf'; color = 'text-icon-red'; }
        else if (type.match(/\.(jpg|jpeg|png|gif|webp)$/)) { icon = 'image'; color = 'text-icon-purple'; }

        return createElement('div', {
            className: 'attachment-item-edit'
        }, [
            createElement('div', { className: 'flex items-center gap-3' }, [
                createElement('span', {
                    className: `material-symbols-outlined ${color}`,
                    textContent: icon
                }),
                createElement('div', { className: 'flex-col' }, [
                    createElement('span', {
                        className: 'text-[10px] font-black text-white/80 uppercase truncate max-w-[150px]',
                        textContent: f.name
                    }),
                    createElement('span', {
                        className: 'text-[8px] font-bold text-white/20 uppercase tracking-widest',
                        textContent: f.existing ? (t('uploaded')) : (t('new'))
                    })
                ])
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-remove-item',
                onclick: () => removeAttachment(f.idx, f.existing)
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'close' })
            ])
        ]);
    });

    setChildren(list, cards.length ? cards : [
        createElement('p', { className: 'no-attachments-text', 'data-t': 'no_attachments', textContent: t('no_attachments') })
    ]);
}

function removeAttachment(idx, existing) {
    if (existing) existingAttachments.splice(idx, 1);
    else selectedFiles.splice(idx, 1);
    renderAttachments();
}

function addExtraEmail(data = null) {
    const container = document.getElementById('email-extra-container');
    if (!container) return;
    const uniqueId = 'email-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const bodyId = `body_${uniqueId}`;
    const arrowId = `arrow-${bodyId}`;

    const wrapper = createElement('div', { className: 'glass-card inside-card email-extra-item' });

    // HEADER
    const header = createElement('div', {
        className: 'email-card-header btn-toggle-section',
        'data-target': bodyId
    }, [
        createElement('input', {
            id: `type_${uniqueId}`,
            type: 'text',
            className: 'email-type-input email-type',
            placeholder: t('email_type_placeholder') || 'TIPO EMAIL',
            value: data ? data.tipo : '',
            'data-stop-propagation': true,
            autocomplete: 'new-password'
        }),
        createElement('div', { className: 'email-actions-group' }, [
            createElement('div', { className: 'field-action-qr opacity-40' }, [
                createElement('input', {
                    id: `qr_${uniqueId}`,
                    type: 'checkbox',
                    className: 'checkbox-qr email-qr',
                    checked: data ? (data.qr !== false) : true,
                    'data-stop-propagation': true
                }),
                createElement('label', { for: `qr_${uniqueId}`, className: 'sr-only', textContent: 'QR' })
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-remove-item',
                'data-stop-propagation': true,
                onclick: () => wrapper.remove()
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]),
            createElement('span', {
                id: arrowId,
                className: 'material-symbols-outlined icon-chevron transition-transform',
                textContent: 'expand_more'
            })
        ])
    ]);

    // BODY
    const body = createElement('div', {
        id: bodyId,
        className: 'email-card-body collapsible-section'
    }, [
        // Email Input
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: t('email_address') }),
            createElement('div', { className: 'detail-field-box border-glow' }, [
                createElement('input', {
                    type: 'email',
                    className: 'detail-field-input email-value',
                    placeholder: 'codex@codex.it',
                    value: data ? data.email : '',
                    autocomplete: 'new-password'
                })
            ])
        ]),
        // Password Input
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: t('password') }),
            createElement('div', { className: 'detail-field-box border-glow' }, [
                createElement('input', {
                    type: 'text',
                    className: 'detail-field-input base-shield email-pass',
                    placeholder: 'Password',
                    value: data ? data.password : '',
                    autocomplete: 'new-password'
                }),
                createElement('div', { className: 'detail-field-actions pr-2' }, [
                    createElement('button', {
                        type: 'button',
                        className: 'btn-toggle-pass'
                    }, [
                        createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'visibility' })
                    ])
                ])
            ])
        ]),
        // Note Input
        createElement('div', { className: 'glass-field-container' }, [
            createElement('label', { className: 'view-label', textContent: t('notes') }),
            createElement('div', { className: 'detail-field-box border-glow note-box' }, [
                createElement('textarea', {
                    className: 'form-textarea email-note',
                    placeholder: 'Note accessorie email...',
                    textContent: data ? data.note : '',
                    autocomplete: 'new-password'
                })
            ])
        ])
    ]);

    setChildren(wrapper, [header, body]);
    container.appendChild(wrapper);
}

function addExtraSede(data = null) {
    const container = document.getElementById('altre-sedi-container');
    if (!container) return;
    const uniqueId = 'sede-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const bodyId = `body_${uniqueId}`;
    const arrowId = `arrow-${bodyId}`;

    const wrapper = createElement('div', { className: 'glass-card inside-card extra-sede-item' });

    // HEADER
    const header = createElement('div', {
        className: 'email-card-header btn-toggle-section',
        'data-target': bodyId
    }, [
        createElement('div', { className: 'flex items-center gap-3 flex-1' }, [
            createElement('span', { className: 'material-symbols-outlined text-icon-purple', textContent: 'domain' }),
            createElement('input', {
                id: `tipo_${uniqueId}`,
                type: 'text',
                className: 'email-type-input sede-tipo',
                placeholder: t('office_type_placeholder') || 'TIPO SEDE',
                value: data ? (data.tipo || '').replace('Sede ', '') : '',
                'data-stop-propagation': true,
                autocomplete: 'new-password'
            })
        ]),
        createElement('div', { className: 'email-actions-group' }, [
            createElement('div', { className: 'field-action-qr opacity-40' }, [
                createElement('input', {
                    id: `qr_${uniqueId}`,
                    type: 'checkbox',
                    className: 'checkbox-qr sede-qr',
                    checked: data ? (data.qr !== false) : true,
                    'data-stop-propagation': true
                }),
                createElement('label', { for: `qr_${uniqueId}`, className: 'sr-only', textContent: 'QR' })
            ]),
            createElement('button', {
                type: 'button',
                className: 'btn-remove-item',
                'data-stop-propagation': true,
                onclick: () => wrapper.remove()
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'delete' })
            ]),
            createElement('span', {
                id: arrowId,
                className: 'material-symbols-outlined icon-chevron transition-transform',
                textContent: 'expand_more'
            })
        ])
    ]);

    // BODY
    const body = createElement('div', {
        id: bodyId,
        className: 'email-card-body collapsible-section'
    }, [
        createElement('div', { className: 'form-grid-3' }, [
            createFieldBox('Indirizzo', 'address', 'text', data?.indirizzo, 'sede-indirizzo', 'Via / Piazza', 'address_placeholder'),
            createFieldBox('N.', '', 'text', data?.civico, 'sede-civico', 'N.', 'civic_number', true)
        ]),
        createElement('div', { className: 'form-grid-3' }, [
            createFieldBox('Città', 'city', 'text', data?.citta, 'sede-citta', 'Città', 'city'),
            createFieldBox('Prov', 'province', 'text', data?.provincia, 'sede-provincia', 'PR', 'province_short', true, true),
            createFieldBox('CAP', 'cap', 'tel', data?.cap, 'sede-cap', 'CAP', 'cap', true)
        ])
    ]);

    setChildren(wrapper, [header, body]);
    container.appendChild(wrapper);
}

function createFieldBox(labelText, labelT, type, val, cls, place, placeT, center = false, uppercase = false) {
    const uniqueId = `field_${Math.random().toString(36).substr(2, 5)}`;
    const fieldId = `id_${cls}_${uniqueId}`;
    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', for: fieldId, 'data-t': labelT, textContent: t(labelT) || labelText }),
        createElement('div', { className: 'detail-field-box border-glow' }, [
            createElement('input', {
                id: fieldId,
                type: type,
                name: `${cls}_${uniqueId}`,
                className: `detail-field-input ${cls} ${center ? 'text-center' : ''} ${uppercase ? 'uppercase' : ''}`,
                value: val || '',
                placeholder: place,
                'data-t-placeholder': placeT,
                maxLength: uppercase ? 2 : (cls.includes('cap') ? 5 : undefined),
                autocomplete: 'new-password', autocorrect: 'off', spellcheck: 'false'
            })
        ])
    ]);
}

async function saveAzienda() {
    const ragioneSociale = document.getElementById('ragione-sociale')?.value.trim();
    if (!ragioneSociale) { showToast(t('error_missing_company_name'), "error"); return; }

    const btn = document.getElementById('btn-save');
    if (btn) {
        btn.disabled = true;
        setChildren(btn, createElement('span', { className: 'material-symbols-outlined animate-spin text-sm', textContent: 'sync' }));
    }

    try {
        const qrConfig = {};
        document.querySelectorAll('input[data-qr-field]').forEach(cb => qrConfig[cb.dataset.qrField] = cb.checked);

        const altreSedi = Array.from(document.querySelectorAll('.extra-sede-item')).map(el => ({
            tipo: el.querySelector('.sede-tipo')?.value.trim(),
            indirizzo: el.querySelector('.sede-indirizzo')?.value.trim(),
            civico: el.querySelector('.sede-civico')?.value.trim(),
            citta: el.querySelector('.sede-citta')?.value.trim(),
            provincia: el.querySelector('.sede-provincia')?.value.trim().toUpperCase(),
            cap: el.querySelector('.sede-cap')?.value.trim(),
            qr: el.querySelector('.sede-qr')?.checked
        })).filter(s => s.tipo || s.indirizzo);

        // Add default QR flags for dynamic sedi into qrConfig (virtual keys qrSede_Index?)
        // Actually, we store 'qr' property inside the object in altreSedi array.
        // buildVCard needs to handle this property directly from the object.

        const data = {
            ragioneSociale,
            tipoSedeLegale: document.getElementById('tipo-sede-legale')?.value.trim() || 'Sede Legale',
            telefonoAzienda: document.getElementById('telefono-azienda')?.value.trim(),
            faxAzienda: document.getElementById('fax-azienda')?.value.trim(),
            partitaIva: document.getElementById('piva')?.value.trim(),
            codiceSDI: document.getElementById('codice-sdi')?.value.trim().toUpperCase(),
            referenteTitolo: document.getElementById('referente-titolo')?.value.trim(),
            referenteNome: document.getElementById('referente-nome')?.value.trim(),
            referenteCognome: document.getElementById('referente-cognome')?.value.trim(),
            referenteCellulare: document.getElementById('referente-cellulare')?.value.trim(),
            indirizzoSede: document.getElementById('indirizzo')?.value.trim(),
            civicoSede: document.getElementById('civico')?.value.trim(),
            cittaSede: document.getElementById('citta')?.value.trim(),
            provinciaSede: document.getElementById('provincia')?.value.trim().toUpperCase(),
            capSede: document.getElementById('cap')?.value.trim(),
            numeroCCIAA: document.getElementById('numero-cciaa')?.value.trim(),
            dataIscrizione: document.getElementById('data-iscrizione')?.value,
            emails: {
                pec: document.getElementById('type-pec') ? {
                    tipo: document.getElementById('type-pec').value.trim(),
                    email: document.getElementById('email-pec')?.value.trim(),
                    password: document.getElementById('email-pec-password')?.value.trim(),
                    note: document.getElementById('email-pec-note')?.value.trim()
                } : null,
                amministrazione: document.getElementById('type-amministrazione') ? {
                    tipo: document.getElementById('type-amministrazione').value.trim(),
                    email: document.getElementById('email-amministrazione')?.value.trim(),
                    password: document.getElementById('email-amministrazione-password')?.value.trim(),
                    note: document.getElementById('email-amministrazione-note')?.value.trim()
                } : null,
                personale: document.getElementById('type-personale') ? {
                    tipo: document.getElementById('type-personale').value.trim(),
                    email: document.getElementById('email-personale')?.value.trim(),
                    password: document.getElementById('email-personale-password')?.value.trim(),
                    note: document.getElementById('email-personale-note')?.value.trim()
                } : null,
                extra: Array.from(document.querySelectorAll('.email-extra-item')).map(el => ({
                    tipo: el.querySelector('.email-type')?.value.trim(),
                    email: el.querySelector('.email-value')?.value.trim(),
                    password: el.querySelector('.email-pass')?.value.trim(),
                    note: el.querySelector('.email-note')?.value.trim(),
                    qr: el.querySelector('.email-qr')?.checked
                })).filter(e => e.tipo || e.email)
            },
            note: document.getElementById('note-azienda')?.value.trim(),
            qrConfig,
            altreSedi,
            updatedAt: serverTimestamp()
        };

        // Logo & Photo
        const logoSrc = document.getElementById('logo-preview')?.src;
        if (logoSrc?.startsWith('data:')) data.logo = await resizeImage(logoSrc, 400);
        const refSrc = document.getElementById('referente-photo-preview')?.src;
        if (refSrc?.startsWith('data:')) data.referentePhoto = await resizeImage(refSrc, 300);

        // Upload new attachments
        const newAtt = [];
        for (const file of selectedFiles) {
            const sRef = ref(storage, `users/${currentUid}/aziende_allegati/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(sRef, file);
            const url = await getDownloadURL(snap.ref);
            newAtt.push({ name: file.name, url, type: file.type, size: file.size, date: new Date().toISOString() });
        }
        data.allegati = [...existingAttachments, ...newAtt];

        await updateDoc(doc(db, "users", currentUid, "aziende", currentAziendaId), data);
        showToast(t('success_save') || "Azienda salvata con successo!", "success");
        setTimeout(() => window.location.href = `dati_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) {
        logError("Save", e);
        showToast(t('error_generic'), "error");
        if (btn) {
            btn.disabled = false;
            setChildren(btn, createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }));
        }
    }
}

async function deleteAzienda() {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg') || "Eliminare definitivamente l'azienda?")) return;
    try {
        await deleteDoc(doc(db, "users", currentUid, "aziende", currentAziendaId));
        showToast(t('success_deleted'), "success");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1000);
    } catch (e) { logError("Delete", e); showToast(t('error_generic'), "error"); }
}

function resizeImage(base64, maxW = 300) {
    return new Promise(res => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxW) { h *= maxW / w; w = maxW; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            res(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
}

