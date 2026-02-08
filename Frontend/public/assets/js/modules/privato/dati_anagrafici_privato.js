/**
 * DATI ANAGRAFICI PRIVATO MODULE (V4.2)
 * Gestione completa profilo, rubrica, utenze e documenti.
 */

import { auth, db, storage } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import {
    doc, getDoc, updateDoc, setDoc, collection, addDoc,
    deleteDoc, getDocs, query, orderBy, limit, where
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError, formatDateToIT } from '../../utils.js';

// --- STATE ---
let currentUser = null;
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
let isEditing = false;
let editingContactId = null;

const fieldMap = [
    'nome', 'cognome', 'cf', 'birth_date', 'birth_place', 'birth_province', 'birth_cap',
    'residence_address', 'residence_civic', 'residence_city', 'residence_province', 'residence_cap',
    'mobile_private', 'phone_private', 'note'
];

// --- DOM CACHE ---
const avatarImg = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name');
const qrContainer = document.getElementById('qrcode-container');
const rubricaCounter = document.getElementById('rubrica-counter');

document.addEventListener('DOMContentLoaded', () => {
    observeAuth(async (user) => {
        if (user) {
            currentUser = user;
            loadFromCache();
            await syncWithFirestore();
            setupLocalListeners();
        }
    });
});

/**
 * Sincronizzazione Iniziale
 */
async function syncWithFirestore() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            updateStateFromData(data);
            renderAll();
        } else {
            // Nuova config
            const initData = { email: currentUser.email, qrConfig, contactEmails: [{ address: currentUser.email, qr: true, visible: true }] };
            await setDoc(docRef, initData, { merge: true });
            updateStateFromData(initData);
            renderAll();
        }
    } catch (e) {
        logError("ProfileSync", e);
    }
}

function updateStateFromData(data) {
    if (data.qrConfig) qrConfig = data.qrConfig;
    if (data.contactEmails) contactEmails = data.contactEmails;
    if (data.utenze) userUtilities = data.utenze;
    if (data.documenti) userDocuments = data.documenti;
    if (data.allegati) existingAttachments = data.allegati;

    // UI Update
    if (userNameEl) userNameEl.textContent = `${data.nome || ''} ${data.cognome || ''}`.trim() || currentUser.displayName || "Utente";
    if (avatarImg && data.photoURL) avatarImg.src = data.photoURL;

    // Cache sync
    localStorage.setItem('userProfileCache', JSON.stringify({ ...data, email: currentUser.email }));
}

/**
 * Rendering Generale
 */
function renderAll() {
    if (isEditing) {
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
    updateQRCode();
}

/**
 * EMAILS SECTION
 */
function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    clearElement(container);

    const visible = contactEmails.filter(e => e.visible);
    if (visible.length === 0) {
        setChildren(container, createElement('div', { className: 'flex-center-gap text-cyan-400/60 italic text-sm py-4' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'visibility_off' }),
            createElement('span', { textContent: t('no_emails_visible') || 'Nessuna email visibile' })
        ]));
        return;
    }

    const items = visible.map(e => {
        const rows = [
            createElement('div', { className: 'flex flex-col gap-1.5 mb-2' }, [
                createElement('label', { className: 'view-label text-cyan-400', textContent: t('email_address') || 'Indirizzo Email' }),
                createElement('div', { className: 'glass-field glass-field-cyan group/field' }, [
                    createElement('p', { className: 'text-sm font-medium break-all flex-1', textContent: e.address }),
                    createElement('div', { className: 'flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity' }, [
                        createElement('button', { className: 'text-cyan-400 p-1 hover:bg-cyan-500/10 rounded-lg', dataset: { action: 'mailto', address: e.address } }, [
                            createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'mail' })
                        ]),
                        createElement('button', { className: 'copy-button text-gray-400 hover:text-white p-1 rounded-lg', dataset: { action: 'copy', text: e.address } }, [
                            createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'content_copy' })
                        ])
                    ])
                ])
            ])
        ];

        if (e.password) {
            rows.push(createElement('div', { className: 'mt-2 flex flex-col gap-1.5' }, [
                createElement('label', { className: 'view-label text-cyan-400', textContent: 'Password' }),
                createElement('div', { className: 'glass-field glass-field-cyan group/field' }, [
                    createElement('span', { className: 'text-sm font-mono tracking-wider password-text flex-1', textContent: '********' }),
                    createElement('div', { className: 'flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity' }, [
                        createElement('button', { className: 'text-cyan-400 p-1 visibility-toggle', dataset: { secret: e.password } }, [
                            createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'visibility_off' })
                        ]),
                        createElement('button', { className: 'copy-button text-gray-400 hover:text-white p-1', dataset: { action: 'copy', text: e.password } }, [
                            createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'content_copy' })
                        ])
                    ])
                ])
            ]));
        }

        if (e.notes) {
            rows.push(createElement('div', { className: 'mt-2 pt-2 border-t border-white/10' }, [
                createElement('p', { className: 'view-label text-cyan-400', textContent: t('notes') || 'Note' }),
                createElement('p', { className: 'selectable text-xs text-white/70 leading-tight pl-1', textContent: e.notes })
            ]));
        }

        return createElement('div', { className: 'bg-cyan-500/5 border border-white/5 p-5 rounded-2xl shadow-sm flex flex-col gap-2 group mb-3 last:mb-0 relative overflow-hidden' }, rows);
    });

    setChildren(container, items);
}

function renderEmailsEdit() {
    const container = document.getElementById('email-edit-container');
    if (!container) return;
    clearElement(container);

    const items = contactEmails.map((e, idx) => {
        return createElement('div', { className: 'flex flex-col gap-3 bg-cyan-500/5 border border-white/5 p-5 rounded-2xl relative mb-4 last:mb-0' }, [
            // Row 1: Address
            createElement('div', { className: 'flex items-center gap-2' }, [
                createElement('div', { className: 'flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5' }, [
                    createElement('span', { className: 'material-symbols-outlined text-[#CBD5E1] text-sm', textContent: 'mail' }),
                    createElement('input', {
                        type: 'email',
                        className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0',
                        value: e.address || '',
                        placeholder: 'Indirizzo email',
                        oninput: (ev) => contactEmails[idx].address = ev.target.value.trim()
                    })
                ]),
                createElement('div', { className: 'flex items-center gap-1' }, [
                    createElement('label', { className: 'flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-white/5 rounded-full transition-colors' }, [
                        createElement('input', {
                            type: 'checkbox',
                            className: 'hidden',
                            checked: e.visible,
                            onchange: (ev) => { e.visible = ev.target.checked; renderEmailsEdit(); }
                        }),
                        createElement('span', {
                            className: `material-symbols-outlined text-xl ${e.visible ? 'text-cyan-400' : 'text-gray-500'}`,
                            textContent: e.visible ? 'visibility' : 'visibility_off'
                        })
                    ]),
                    createElement('button', { className: 'text-gray-500 hover:text-red-500 w-8 h-8 flex-center', onclick: () => deleteEmail(idx) }, [
                        createElement('span', { className: 'material-symbols-outlined text-xl', textContent: 'delete' })
                    ])
                ])
            ]),
            // Row 2: Password & QR
            createElement('div', { className: 'flex items-center gap-2' }, [
                createElement('div', { className: 'flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5' }, [
                    createElement('span', { className: 'material-symbols-outlined text-[#CBD5E1] text-sm', textContent: 'key' }),
                    createElement('input', {
                        type: 'password',
                        className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0',
                        value: e.password || '',
                        placeholder: 'Password (opzionale)',
                        oninput: (ev) => contactEmails[idx].password = ev.target.value.trim()
                    })
                ]),
                createElement('label', { className: 'flex items-center gap-1 cursor-pointer hover:bg-white/5 px-2 py-1 rounded-md' }, [
                    createElement('input', {
                        type: 'checkbox',
                        className: 'form-checkbox w-3.5 h-3.5 text-cyan-400 rounded border-gray-300 focus:ring-0',
                        checked: !!e.qr,
                        onchange: (ev) => { e.qr = ev.target.checked; updateQRCode(); }
                    }),
                    createElement('span', { className: 'text-[10px] font-bold text-gray-500 uppercase', textContent: 'QR' })
                ])
            ]),
            // Notes
            createElement('div', { className: 'bg-black/20 rounded-lg border border-white/5 p-2' }, [
                createElement('div', { className: 'flex items-center gap-2 mb-1' }, [
                    createElement('span', { className: 'material-symbols-outlined text-slate-500 text-sm', textContent: 'sticky_note_2' }),
                    createElement('span', { className: 'text-[10px] font-bold text-[#CBD5E1] uppercase', textContent: 'Note' })
                ]),
                createElement('textarea', {
                    className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-xs focus:ring-0 min-h-[40px]',
                    placeholder: 'Note specifiche...',
                    oninput: (ev) => contactEmails[idx].notes = ev.target.value.trim()
                }, [e.notes || ''])
            ])
        ]);
    });

    setChildren(container, items);
}

async function deleteEmail(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_email_msg') || 'Eliminare questa email?')) return;
    contactEmails.splice(idx, 1);
    renderEmailsEdit();
    updateQRCode();
}

/**
 * UTILITIES SECTION
 */
function getUtenzaIcon(type) {
    const map = {
        'Codice POD': { icon: 'bolt', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        'Seriale Contatore Metano': { icon: 'local_fire_department', color: 'text-orange-500', bg: 'bg-orange-500/10' },
        'Seriale Contatore Acqua': { icon: 'water_drop', color: 'text-blue-500', bg: 'bg-blue-500/10' }
    };
    return map[type] || { icon: 'tag', color: 'text-gray-400', bg: 'bg-white/5' };
}

function renderUtenzeView() {
    const container = document.getElementById('utenze-view-container');
    if (!container) return;
    clearElement(container);

    if (userUtilities.length === 0) {
        setChildren(container, createElement('div', { className: 'col-span-full py-4 text-center text-sm text-[#CBD5E1] italic', textContent: t('no_utilities_registered') || 'Nessuna utenza registrata' }));
        return;
    }

    const items = userUtilities.map(u => {
        const style = getUtenzaIcon(u.type);
        const rows = [
            createElement('div', { className: 'flex justify-between items-center mb-1' }, [
                createElement('div', { className: 'flex items-center gap-2' }, [
                    createElement('div', { className: `w-7 h-7 ${style.bg} ${style.color} rounded-lg flex-center` }, [
                        createElement('span', { className: 'material-symbols-outlined text-base', textContent: style.icon })
                    ]),
                    createElement('label', { className: 'view-label text-amber-500', textContent: u.type || 'Utenza' })
                ])
            ]),
            createElement('div', { className: 'glass-field glass-field-amber group/field mt-1' }, [
                createElement('p', { className: 'text-sm font-bold text-white truncate flex-1', textContent: u.value || '-' }),
                createElement('button', { className: 'copy-button text-amber-500 opacity-0 group-hover/field:opacity-100', dataset: { action: 'copy', text: u.value } }, [
                    createElement('span', { className: 'material-symbols-outlined text-lg', textContent: 'content_copy' })
                ])
            ])
        ];

        if (u.notes) {
            rows.push(createElement('div', { className: 'mt-2 pt-2 border-t border-white/10' }, [
                createElement('p', { className: 'view-label text-amber-500', textContent: t('notes') || 'Note' }),
                createElement('p', { className: 'text-xs text-white/70 leading-tight pl-1', textContent: u.notes })
            ]));
        }

        return createElement('div', { className: 'bg-amber-500/5 p-5 rounded-2xl border border-white/5 shadow-sm group relative overflow-hidden' }, rows);
    });

    setChildren(container, items);
}

function renderUtenzeEdit() {
    const container = document.getElementById('utenze-edit-container');
    if (!container) return;
    clearElement(container);

    const items = userUtilities.map((u, idx) => {
        const style = getUtenzaIcon(u.type);
        return createElement('div', { className: 'flex flex-col gap-3 bg-amber-500/5 border border-white/5 p-5 rounded-2xl relative mb-4' }, [
            createElement('div', { className: 'flex items-center justify-between gap-2' }, [
                createElement('div', { className: 'flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5' }, [
                    createElement('span', { className: `material-symbols-outlined ${style.color} text-sm`, textContent: style.icon }),
                    createElement('select', {
                        className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0 font-bold',
                        onchange: (ev) => { u.type = ev.target.value; renderUtenzeEdit(); }
                    }, [
                        createElement('option', { value: '', disabled: true, selected: !u.type, textContent: 'Tipo utenza...' }),
                        createElement('option', { value: 'Codice POD', selected: u.type === 'Codice POD', textContent: 'Codice POD (Luce)' }),
                        createElement('option', { value: 'Seriale Contatore Metano', selected: u.type === 'Seriale Contatore Metano', textContent: 'Metano (Gas)' }),
                        createElement('option', { value: 'Seriale Contatore Acqua', selected: u.type === 'Seriale Contatore Acqua', textContent: 'Acqua' })
                    ])
                ]),
                createElement('button', { className: 'text-gray-500 hover:text-red-500 w-8 h-8 flex-center', onclick: () => deleteUtenza(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined text-xl', textContent: 'delete' })
                ])
            ]),
            createElement('div', { className: 'bg-black/20 rounded-lg px-3 h-10 border border-white/5 flex items-center gap-2' }, [
                createElement('span', { className: 'material-symbols-outlined text-[#CBD5E1] text-sm', textContent: 'tag' }),
                createElement('input', {
                    type: 'text',
                    className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0 font-mono',
                    value: u.value || '',
                    placeholder: 'Valore/Codice',
                    oninput: (ev) => u.value = ev.target.value.trim()
                })
            ]),
            createElement('div', { className: 'bg-black/20 rounded-lg border border-white/5 p-2' }, [
                createElement('div', { className: 'flex items-center gap-2 mb-1' }, [
                    createElement('span', { className: 'material-symbols-outlined text-slate-500 text-sm', textContent: 'sticky_note_2' }),
                    createElement('span', { className: 'text-[10px] font-bold text-[#CBD5E1] uppercase', textContent: 'Note' })
                ]),
                createElement('textarea', {
                    className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-xs focus:ring-0 min-h-[40px]',
                    placeholder: 'Note...',
                    oninput: (ev) => u.notes = ev.target.value.trim()
                }, [u.notes || ''])
            ])
        ]);
    });

    setChildren(container, items);
}

async function deleteUtenza(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questa utenza?')) return;
    userUtilities.splice(idx, 1);
    renderUtenzeEdit();
}

/**
 * DOCUMENTS SECTION
 */
function getDocumentIcon(type) {
    const map = {
        'Passaporto': { icon: 'pnp_only', color: 'text-blue-700', bg: 'bg-blue-700/10' },
        'Carta Identità': { icon: 'badge', color: 'text-indigo-600', bg: 'bg-indigo-600/10' },
        'Patente': { icon: 'directions_car', color: 'text-green-600', bg: 'bg-green-600/10' },
        'Codice fiscale': { icon: 'credit_card', color: 'text-red-500', bg: 'bg-red-500/10' }
    };
    return map[type] || { icon: 'description', color: 'text-gray-400', bg: 'bg-white/5' };
}

function getFieldsForDocType(type) {
    if (type === 'Passaporto') return [
        { key: 'num_serie', label: 'Numero Serie' },
        { key: 'emission_date', label: 'Data Emissione', type: 'date' },
        { key: 'emission_place', label: 'Luogo' },
        { key: 'expiry_date', label: 'Scadenza', type: 'date' }
    ];
    if (type === 'Carta Identità') return [
        { key: 'id_number', label: 'Numero C.I.' },
        { key: 'issued_by', label: 'Emessa da' },
        { key: 'emission_date', label: 'Data Emissione', type: 'date' },
        { key: 'expiry_date', label: 'Scadenza', type: 'date' },
        { key: 'pin', label: 'PIN' },
        { key: 'puk', label: 'PUK' }
    ];
    if (type === 'Patente') return [
        { key: 'license_number', label: 'Numero Patente' },
        { key: 'emission_date', label: 'Data Emissione', type: 'date' },
        { key: 'expiry_date', label: 'Scadenza', type: 'date' }
    ];
    if (type === 'Codice fiscale') return [
        { key: 'cf_value', label: 'Codice Fiscale' },
        { key: 'expiry_date', label: 'Scadenza', type: 'date' }
    ];
    return [];
}

function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    clearElement(container);

    if (userDocuments.length === 0) {
        setChildren(container, createElement('div', { className: 'col-span-full py-4 text-center text-sm text-[#CBD5E1] italic', textContent: t('no_docs_registered') || 'Nessun documento registrato' }));
        return;
    }

    const items = userDocuments.map(doc => {
        const style = getDocumentIcon(doc.type);
        const fields = getFieldsForDocType(doc.type);
        const fieldNodes = fields.map(f => {
            const val = doc[f.key] ? (f.type === 'date' ? formatDateToIT(doc[f.key]) : doc[f.key]) : '-';
            return createElement('div', { className: 'flex flex-col gap-1.5 mb-2' }, [
                createElement('span', { className: 'text-[9px] text-violet-400 font-bold uppercase tracking-wider px-1', textContent: f.label }),
                createElement('div', { className: 'glass-field glass-field-violet group/field' }, [
                    createElement('span', { className: 'text-sm font-semibold text-white break-all flex-1', textContent: val }),
                    createElement('button', { className: 'text-violet-400 opacity-0 group-hover/field:opacity-100', dataset: { action: 'copy', text: val } }, [
                        createElement('span', { className: 'material-symbols-outlined text-[17px]', textContent: 'content_copy' })
                    ])
                ])
            ]);
        });

        return createElement('div', { className: 'bg-violet-500/5 p-5 rounded-2xl border border-white/5 shadow-sm flex flex-col gap-2 group relative overflow-hidden' }, [
            createElement('div', { className: 'flex justify-between items-center mb-1' }, [
                createElement('div', { className: 'flex items-center gap-2' }, [
                    createElement('div', { className: `w-8 h-8 ${style.bg} ${style.color} rounded-lg flex-center` }, [
                        createElement('span', { className: 'material-symbols-outlined text-lg', textContent: style.icon })
                    ]),
                    createElement('label', { className: 'view-label text-violet-400', textContent: doc.type || 'Documento' })
                ]),
                createElement('a', {
                    href: `gestione_allegati.html?context=profile&docType=${encodeURIComponent(doc.type || '')}`,
                    className: 'flex items-center gap-1.5 px-3 py-1.5 bg-black/20 hover:bg-white/10 text-[#CBD5E1] rounded-lg border border-white/5'
                }, [
                    createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'attach_file' }),
                    createElement('span', { className: 'text-[10px] font-bold uppercase', textContent: 'Allegati' })
                ])
            ]),
            createElement('div', { className: 'grid grid-cols-2 gap-x-2' }, fieldNodes)
        ]);
    });

    setChildren(container, items);
}

function renderDocumentiEdit() {
    const container = document.getElementById('documenti-edit-container');
    if (!container) return;
    clearElement(container);

    const items = userDocuments.map((d, idx) => {
        const style = getDocumentIcon(d.type);
        const fields = getFieldsForDocType(d.type);

        const fieldInputs = fields.map(f => {
            return createElement('div', { className: 'flex flex-col gap-1' }, [
                createElement('span', { className: 'text-[10px] text-[#CBD5E1] font-bold uppercase pl-1', textContent: f.label }),
                createElement('div', { className: 'flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5' }, [
                    createElement('input', {
                        type: f.type === 'date' ? 'date' : 'text',
                        className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0',
                        value: d[f.key] || '',
                        oninput: (ev) => d[f.key] = ev.target.value
                    })
                ])
            ]);
        });

        return createElement('div', { className: 'flex flex-col gap-3 bg-violet-500/5 border border-white/5 p-5 rounded-2xl relative mb-4' }, [
            createElement('div', { className: 'flex items-center justify-between gap-2' }, [
                createElement('div', { className: 'flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 h-10 border border-white/5' }, [
                    createElement('span', { className: `material-symbols-outlined ${style.color} text-sm`, textContent: style.icon }),
                    createElement('select', {
                        className: 'w-full bg-transparent text-[#F1F5F9] border-none p-0 text-sm focus:ring-0 font-bold',
                        onchange: (ev) => { d.type = ev.target.value; renderDocumentiEdit(); }
                    }, [
                        createElement('option', { value: '', disabled: true, textContent: 'Tipo documento...' }),
                        createElement('option', { value: 'Carta Identità', selected: d.type === 'Carta Identità', textContent: 'Carta Identità' }),
                        createElement('option', { value: 'Patente', selected: d.type === 'Patente', textContent: 'Patente' }),
                        createElement('option', { value: 'Passaporto', selected: d.type === 'Passaporto', textContent: 'Passaporto' }),
                        createElement('option', { value: 'Codice fiscale', selected: d.type === 'Codice fiscale', textContent: 'Codice fiscale' })
                    ])
                ]),
                createElement('button', { className: 'text-gray-500 hover:text-red-500 w-10 h-10 flex-center border border-white/5 rounded-lg', onclick: () => deleteDocumento(idx) }, [
                    createElement('span', { className: 'material-symbols-outlined text-xl', textContent: 'delete' })
                ])
            ]),
            createElement('div', { className: 'grid grid-cols-2 gap-x-3 gap-y-2' }, fieldInputs)
        ]);
    });

    setChildren(container, items);
}

async function deleteDocumento(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo documento?')) return;
    userDocuments.splice(idx, 1);
    renderDocumentiEdit();
}

/**
 * ATTACHMENTS SECTION
 */
function renderAttachmentsView() {
    const container = document.getElementById('attachments-view-container');
    if (!container) return;
    clearElement(container);

    if (existingAttachments.length === 0) {
        setChildren(container, createElement('p', { className: 'text-sm text-[#CBD5E1] italic py-2', textContent: 'Nessun allegato presente' }));
        return;
    }

    const items = existingAttachments.map(f => {
        const ext = (f.name || '').split('.').pop().toLowerCase();
        let icon = 'description';
        let color = 'text-[#CBD5E1]';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { icon = 'image'; color = 'text-blue-400'; }
        if (ext === 'pdf') { icon = 'picture_as_pdf'; color = 'text-red-400'; }

        return createElement('div', { className: 'flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5' }, [
            createElement('span', { className: `material-symbols-outlined ${color}`, textContent: icon }),
            createElement('div', { className: 'flex flex-col min-w-0 flex-1' }, [
                createElement('a', { href: f.url, target: '_blank', className: 'text-sm font-medium text-[#F1F5F9] hover:text-cyan-400 truncate', textContent: f.name })
            ])
        ]);
    });
    setChildren(container, items);
}

function renderAttachmentsEdit() {
    const list = document.getElementById('attachments-list-edit');
    if (!list) return;
    clearElement(list);

    const full = [
        ...existingAttachments.map((f, i) => ({ ...f, existing: true, idx: i })),
        ...selectedFiles.map((f, i) => ({ name: f.name, existing: false, idx: i }))
    ];

    const nodes = full.map(f => {
        const ext = (f.name || '').split('.').pop().toLowerCase();
        let icon = 'description';
        let color = 'text-gray-400';
        if (['jpg', 'jpeg', 'png'].includes(ext)) { icon = 'image'; color = 'text-blue-500'; }
        if (ext === 'pdf') { icon = 'picture_as_pdf'; color = 'text-red-500'; }

        return createElement('div', { className: 'flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5' }, [
            createElement('div', { className: 'flex items-center gap-3 overflow-hidden' }, [
                createElement('span', { className: `material-symbols-outlined ${color}`, textContent: icon }),
                createElement('div', { className: 'flex flex-col min-w-0' }, [
                    createElement('span', { className: 'text-xs font-bold text-white truncate', textContent: f.name }),
                    createElement('span', { className: 'text-[10px] text-gray-500', textContent: f.existing ? 'Già caricato' : 'Nuovo file' })
                ])
            ]),
            createElement('button', {
                className: 'p-1 text-gray-500 hover:text-red-400',
                onclick: () => {
                    if (f.existing) existingAttachments.splice(f.idx, 1);
                    else selectedFiles.splice(f.idx, 1);
                    renderAttachmentsEdit();
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'close' })
            ])
        ]);
    });

    setChildren(list, nodes);
}

/**
 * QR CODE GEN
 */
function updateQRCode() {
    if (typeof QRCode === 'undefined' || !qrContainer) return;
    clearElement(qrContainer);

    const vals = {};
    fieldMap.forEach(f => {
        const vEl = document.getElementById(`${f}-view`);
        vals[f] = vEl?.textContent.trim() === '-' ? '' : (vEl?.textContent.trim() || '');
    });

    let v = "BEGIN:VCARD\nVERSION:3.0\n";
    if (qrConfig.nome || qrConfig.cognome) {
        let fn = `${qrConfig.nome ? vals.nome : ''} ${qrConfig.cognome ? vals.cognome : ''}`.trim();
        v += `FN:${fn}\nN:${qrConfig.cognome ? vals.cognome : ''};${qrConfig.nome ? vals.nome : ''};;;\n`;
    }
    if (qrConfig.mobile_private && vals.mobile_private) v += `TEL;TYPE=CELL:${vals.mobile_private}\n`;
    contactEmails.forEach(e => { if (e.qr && e.address) v += `EMAIL:${e.address}\n`; });

    // Altri campi...
    v += "END:VCARD";

    try {
        new QRCode(qrContainer, { text: v, width: 100, height: 100, colorDark: "#000000", colorLight: "#ffffff" });
    } catch (e) { logError("QR", e); }
}

/**
 * ACTIONS & SAVE
 */
async function handleSave() {
    if (!currentUser) return;
    const btn = document.getElementById('action-save-btn');
    if (btn) btn.disabled = true;

    try {
        const payload = {};
        fieldMap.forEach(f => {
            const el = document.getElementById(`${f}-edit`);
            if (el) payload[f] = el.value.trim();
        });

        payload.qrConfig = qrConfig;
        payload.contactEmails = contactEmails;
        payload.utenze = userUtilities;
        payload.documenti = userDocuments;

        // Upload Allegati
        if (selectedFiles.length > 0) {
            for (const file of selectedFiles) {
                const sRef = ref(storage, `users/${currentUser.uid}/attachments/${Date.now()}_${file.name}`);
                const s = await uploadBytes(sRef, file);
                const url = await getDownloadURL(s.ref);
                existingAttachments.push({ name: file.name, url, type: file.type });
            }
        }
        payload.allegati = existingAttachments;

        await updateDoc(doc(db, "users", currentUser.uid), payload);

        // Update Auth Profile
        const full = `${payload.nome || ''} ${payload.cognome || ''}`.trim();
        if (full) await updateProfile(currentUser, { displayName: full });

        showToast(t('success_save'), "success");
        isEditing = false;
        renderAll();
        toggleEditUI(false);
    } catch (e) {
        logError("ProfileSave", e);
        showToast(t('error_generic'), "error");
        if (btn) btn.disabled = false;
    }
}

/**
 * UI Toggles & Static Listeners
 */
function setupLocalListeners() {
    const editBtn = document.getElementById('action-edit-btn');
    const cancelBtn = document.getElementById('action-cancel-btn');
    const saveBtn = document.getElementById('action-save-btn');

    editBtn?.addEventListener('click', () => { isEditing = true; toggleEditUI(true); renderAll(); });
    cancelBtn?.addEventListener('click', () => { isEditing = false; toggleEditUI(false); renderAll(); });
    saveBtn?.addEventListener('click', handleSave);

    // Dynamic inputs delegation
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'copy') {
            navigator.clipboard.writeText(btn.dataset.text).then(() => showToast(t('copied'), "success"));
        } else if (action === 'mailto') {
            window.location.href = `mailto:${btn.dataset.address}`;
        }
    });

    // Sub-buttons
    document.getElementById('add-email-btn')?.addEventListener('click', () => { contactEmails.push({ address: '', visible: true }); renderEmailsEdit(); });
    document.getElementById('add-utenza-btn')?.addEventListener('click', () => { userUtilities.push({ type: '', value: '' }); renderUtenzeEdit(); });
    document.getElementById('add-documento-btn')?.addEventListener('click', () => { userDocuments.push({ type: 'Carta Identità' }); renderDocumentiEdit(); });
}

function toggleEditUI(on) {
    const viewEls = document.querySelectorAll('[id$="-view"]');
    const editEls = document.querySelectorAll('[id$="-edit"]');

    viewEls.forEach(el => el.classList.toggle('hidden', on));
    editEls.forEach(el => {
        const container = el.closest('.edit-container');
        if (container) container.classList.toggle('hidden', !on);
        else el.classList.toggle('hidden', !on);
    });

    // Section containers
    ['email', 'utenze', 'documenti', 'attachments'].forEach(key => {
        document.getElementById(`${key}-view-container`)?.classList.toggle('hidden', on);
        document.getElementById(`${key}-edit-container`)?.classList.toggle('hidden', !on);
    });

    document.getElementById('action-edit-btn')?.classList.toggle('hidden', on);
    document.getElementById('action-save-btn')?.classList.toggle('hidden', !on);
    document.getElementById('action-cancel-btn')?.classList.toggle('hidden', !on);
}

function loadFromCache() {
    const cached = localStorage.getItem('userProfileCache');
    if (cached) {
        try {
            updateStateFromData(JSON.parse(cached));
            renderAll();
        } catch (e) { logError("CacheParse", e); }
    }
}

