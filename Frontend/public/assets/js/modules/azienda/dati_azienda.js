/**
 * DATI AZIENDA MODULE (V5.0 ADAPTER)
 * Visualizzazione dettagliata anagrafica aziendale, QR vCard, sedi e allegati.
 * - Entry Point: initDatiAzienda(user)
 */

import { auth, db } from '../../firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

import { ensureQRCodeLib, renderQRCode } from '../shared/qr_code_utils.js';

// --- STATE ---
let currentAziendaId = null;
let currentAziendaData = null;
let currentLocations = [];

// --- INITIALIZATION ---
export async function initDatiAzienda(user) {
    console.log("[DATI-AZIENDA] Init V5.0...");
    if (!user) return;

    // Assicura caricamento libreria QR in modo passivo
    await ensureQRCodeLib();

    currentAziendaId = new URLSearchParams(window.location.search).get('id');
    if (!currentAziendaId) {
        window.location.href = 'lista_aziende.html';
        return;
    }

    initProtocolUI();
    setupEventListeners();
    await loadData(user.uid);

    console.log("[DATI-AZIENDA] Ready.");
}

async function initProtocolUI() {
    console.log('[dati_azienda] UI Base gestita da main.js');

    // Footer Right
    // Footer Center Actions
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        const editBtn = createElement('button', {
            id: 'footer-btn-edit',
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('edit') || 'Modifica',
            dataset: { label: t('edit_short') || 'Edita' },
            onclick: () => window.location.href = `modifica_azienda.html?id=${currentAziendaId}`
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
        ]);

        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [editBtn]));
    }
}

function setupEventListeners() {
    document.getElementById('btn-zoom-qr')?.addEventListener('click', openQRZoom);
    document.getElementById('btn-close-qr')?.addEventListener('click', closeQRZoom);
    document.getElementById('qr-zoom-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'qr-zoom-modal') closeQRZoom();
    });

    document.getElementById('toggle-referente-btn')?.addEventListener('click', () => {
        const container = document.getElementById('referente-container');
        const chevron = document.getElementById('referente-chevron');
        if (container) {
            const isHidden = container.classList.toggle('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });

    document.getElementById('toggle-allegati-btn')?.addEventListener('click', () => {
        const container = document.getElementById('allegati-container');
        const chevron = document.getElementById('allegati-chevron');
        if (container) {
            const isHidden = container.classList.toggle('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });

    document.getElementById('toggle-fiscal-btn')?.addEventListener('click', () => {
        const container = document.getElementById('fiscal-container');
        const chevron = document.getElementById('fiscal-chevron');
        if (container) {
            const isHidden = container.classList.toggle('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });

    document.getElementById('toggle-email-btn')?.addEventListener('click', () => {
        const container = document.getElementById('email-list-container');
        const chevron = document.getElementById('email-chevron');
        if (container) {
            const isHidden = container.classList.toggle('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });

    document.getElementById('btn-add-email')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `modifica_azienda.html?id=${currentAziendaId}#section-email`;
    });

    document.getElementById('btn-edit-fiscal')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `modifica_azienda.html?id=${currentAziendaId}`;
    });

    // Edit Note
    const btnEditNote = document.getElementById('btn-edit-note');
    const btnCancelNote = document.getElementById('btn-cancel-note');
    const noteView = document.getElementById('note-azienda');
    const noteEdit = document.getElementById('note-azienda-edit');

    btnEditNote?.addEventListener('click', async () => {
        const isEditing = !noteEdit.classList.contains('hidden');
        if (!isEditing) {
            noteEdit.value = noteView.textContent === '-' ? '' : noteView.textContent;
            noteView.classList.add('hidden');
            noteEdit.classList.remove('hidden');
            btnEditNote.textContent = t('save') || 'Salva';
            btnCancelNote?.classList.remove('hidden');
        } else {
            const newNote = noteEdit.value.trim();
            try {
                btnEditNote.disabled = true;
                await updateDoc(doc(db, "users", auth.currentUser.uid, "aziende", currentAziendaId), { note: newNote });
                noteView.textContent = newNote || '-';
                showToast(t('success_save'), 'success');
                exitNoteEdit();
            } catch (e) {
                logError("UpdateNote", e);
                showToast(t('error_generic'), 'error');
            } finally {
                btnEditNote.disabled = false;
            }
        }
    });

    btnCancelNote?.addEventListener('click', exitNoteEdit);

    function exitNoteEdit() {
        noteView.classList.remove('hidden');
        noteEdit.classList.add('hidden');
        btnEditNote.textContent = t('edit') || 'Modifica';
        btnCancelNote?.classList.add('hidden');
    }
}

async function loadData(uid) {
    try {
        const snap = await getDoc(doc(db, "users", uid, "aziende", currentAziendaId));
        if (snap.exists()) {
            currentAziendaData = snap.data();
            populateFields(currentAziendaData);
            handleLogoAndQR(currentAziendaData);
            renderAllegati(currentAziendaData.allegati);
        } else {
            showToast(t('error_not_found'), "error");
        }
    } catch (e) {
        logError("LoadData", e);
    }
}

function populateFields(data) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = val || '';
            } else {
                el.textContent = val || '-';
            }
        }
    };

    // Aggiorna titolo Header (quello creato da initComponents)
    const hTitle = document.querySelector('.base-header .header-title');
    if (hTitle) {
        hTitle.textContent = data.ragioneSociale || t('company_details');
    }

    set('ragione-sociale', data.ragioneSociale);
    set('forma-giuridica', data.formaGiuridica);
    set('referente-nome', `${data.referenteNome || ''} ${data.referenteCognome || ''}`.trim());
    set('referente-ruolo', data.referenteTitolo);
    set('referente-cellulare', data.referenteCellulare);

    const btnCallRef = document.getElementById('btn-call-referente');
    if (btnCallRef) btnCallRef.href = data.referenteCellulare ? `tel:${data.referenteCellulare}` : '#';

    const btnCallTel = document.getElementById('btn-call-tel');
    if (btnCallTel) btnCallTel.href = data.telefonoAzienda ? `tel:${data.telefonoAzienda}` : '#';

    set('telefono-azienda', data.telefonoAzienda);
    set('fax-azienda', data.faxAzienda);
    set('piva', data.partitaIva);
    set('codice-sdi', data.codiceSDI);
    set('cciaa', data.numeroCCIAA);
    set('note-azienda', data.note);

    if (data.dataIscrizione) {
        const p = data.dataIscrizione.split('-');
        set('data-iscrizione', p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : data.dataIscrizione);
    }

    const refPhoto = document.getElementById('referente-photo');
    const refPlace = document.getElementById('referente-photo-placeholder');
    if (data.referentePhoto && refPhoto) {
        refPhoto.src = data.referentePhoto;
        refPhoto.classList.remove('hidden');
        refPlace?.classList.add('hidden');
    }

    setupLocations(data);
    renderEmailCategories(data);
}

function setupLocations(data) {
    currentLocations = [
        { tipo: 'Legale', icon: 'gavel', data: { indirizzo: data.indirizzoSede, civico: data.civicoSede, citta: data.cittaSede, cap: data.capSede, prov: data.provinciaSede } }
    ];
    if (data.altreSedi && Array.isArray(data.altreSedi)) {
        data.altreSedi.forEach(s => {
            currentLocations.push({ tipo: s.tipo.replace('Sede ', ''), icon: 'domain', data: s });
        });
    }

    const tabs = document.getElementById('locations-tabs-container');
    if (!tabs) return;

    const btns = currentLocations.map((l, i) => createElement('button', {
        className: `location-tab-btn ${i === 0 ? 'active' : ''}`,
        onclick: () => switchLocation(i)
    }, [
        createElement('span', { className: 'material-symbols-outlined', textContent: l.icon }),
        createElement('span', { textContent: l.tipo })
    ]));

    setChildren(tabs, btns);
    switchLocation(0);
}

function switchLocation(index) {
    const loc = currentLocations[index];
    const d = loc.data;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
    const fullAddr = `${d.indirizzo || ''} ${d.civico || ''}`.trim();
    const cityFull = `${d.cap || ''} ${d.citta || ''} ${d.prov ? '(' + d.prov + ')' : ''}`.trim();

    set('indirizzo-completo', fullAddr || 'Indirizzo non specificato');
    set('citta-cap-prov', cityFull || '-');


    document.querySelectorAll('.location-tab-btn').forEach((btn, i) => {
        const isActive = i === index;
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
    });

}

function renderEmailCategories(data) {
    const wrap = document.getElementById('wrapper-email-section');
    const container = document.getElementById('email-list-container');
    if (!container) return;

    const emailEntries = [
        { id: 'pec', label: data.emails?.pec?.tipo || 'PEC', icon: 'verified_user', email: data.aziendaEmail || data.emails?.pec?.email, password: data.emails?.pec?.password || data.aziendaEmailPassword },
        { id: 'amministrazione', label: data.emails?.amministrazione?.tipo || 'Amm.ne', icon: 'payments', email: data.emails?.amministrazione?.email, password: data.emails?.amministrazione?.password },
        { id: 'personale', label: data.emails?.personale?.tipo || 'Personale', icon: 'group', email: data.emails?.personale?.email, password: data.emails?.personale?.password }
    ].filter(c => c.email);

    // Add Extra Emails
    if (data.emails?.extra && Array.isArray(data.emails.extra)) {
        data.emails.extra.forEach((e, i) => {
            if (e.email) {
                emailEntries.push({
                    id: `extra-${i}`,
                    label: e.tipo || 'Email',
                    icon: 'mail',
                    email: e.email,
                    password: e.password
                });
            }
        });
    }

    if (emailEntries.length > 0) {
        wrap?.classList.remove('hidden');
        clearElement(container);

        // Grouping all in one box as requested
        const mainBox = createElement('div', { className: 'glass-card email-cards-container' });

        emailEntries.forEach((c, idx) => {
            const item = createElement('div', { className: 'email-item-group' }, [
                // Header (Icon + Label)
                createElement('div', { className: 'email-item-header' }, [
                    createElement('div', { className: 'email-type-badge' }, [
                        createElement('div', { className: 'email-icon-box' }, [
                            createElement('span', { className: 'material-symbols-outlined icon-medium', textContent: c.icon })
                        ]),
                        createElement('span', { className: 'email-label-text', textContent: c.label })
                    ])
                ]),
                // Email Field
                createElement('div', { className: 'email-detail-row group' }, [
                    createElement('span', { className: 'email-text-value', textContent: c.email }),
                    createElement('div', { className: 'email-action-group' }, [
                        createElement('button', {
                            className: 'email-action-icon',
                            onclick: () => { navigator.clipboard.writeText(c.email).then(() => showToast(t('copied'), 'success')); }
                        }, [createElement('span', { className: 'material-symbols-outlined icon-small', textContent: 'content_copy' })]),
                        createElement('a', {
                            href: `mailto:${c.email}`,
                            className: 'email-action-icon'
                        }, [createElement('span', { className: 'material-symbols-outlined icon-small', textContent: 'mail' })])
                    ])
                ]),
                // Password Field (if exists)
                c.password ? createElement('div', { className: 'email-detail-row group' }, [
                    createElement('div', { className: 'flex items-center gap-2 flex-1 min-w-0' }, [
                        createElement('span', { className: 'material-symbols-outlined icon-field-left opacity-low', textContent: 'key' }),
                        createElement('span', {
                            id: `pwd-${c.id}`,
                            className: 'email-text-value field-password',
                            dataset: { password: c.password, hidden: 'true' },
                            textContent: '••••••••'
                        })
                    ]),
                    createElement('div', { className: 'email-action-group' }, [
                        createElement('button', {
                            className: 'email-action-icon',
                            onclick: (e) => togglePwd(c.id, e.currentTarget)
                        }, [createElement('span', { className: 'material-symbols-outlined icon-small', textContent: 'visibility' })]),
                        createElement('button', {
                            className: 'email-action-icon',
                            onclick: () => { navigator.clipboard.writeText(c.password).then(() => showToast(t('copied'), 'success')); }
                        }, [createElement('span', { className: 'material-symbols-outlined icon-small', textContent: 'content_copy' })])
                    ])
                ]) : null
            ].filter(Boolean));
            mainBox.appendChild(item);
        });

        container.appendChild(mainBox);
    }
}

function togglePwd(id, btn) {
    const el = document.getElementById(`pwd-${id}`);
    const icon = btn.querySelector('span');
    if (el && icon) {
        const isHidden = el.dataset.hidden === 'true';
        el.textContent = isHidden ? el.dataset.password : '••••••••';
        el.dataset.hidden = isHidden ? 'false' : 'true';
        icon.textContent = isHidden ? 'visibility_off' : 'visibility';
    }
}

async function handleLogoAndQR(data) {
    const logoImg = document.getElementById('azienda-logo');
    const logoPlace = document.getElementById('azienda-logo-placeholder');
    if (data.logo && logoImg) {
        logoImg.src = data.logo;
        logoImg.classList.remove('hidden');
        logoPlace?.classList.add('hidden');
    }

    const vcard = buildVCard(data);

    // Render Preview
    const qrCont = document.getElementById('qrcode-container');
    if (qrCont) {
        renderQRCode(qrCont, vcard, {
            width: 104,
            height: 104,
            colorDark: "#000000",
            colorLight: "#E3F2FD"
        });
    }

    // Render Zoom (Lazy ideally, but kept here for stability if already present)
    const qrZoom = document.getElementById('qrcode-zoom-container');
    if (qrZoom) {
        renderQRCode(qrZoom, vcard, {
            width: 300,
            height: 300,
            colorDark: "#000000",
            colorLight: "#E3F2FD"
        });
    }
}

function buildVCard(data) {
    const config = data.qrConfig || {};
    let v = "BEGIN:VCARD\nVERSION:3.0\n";

    // Ragione Sociale (FN, ORG)
    // Default true if config missing (retrocompatibility), explicit false check
    if (config.ragioneSociale !== false) {
        v += `FN:${data.ragioneSociale || 'Azienda'}\nORG:${data.ragioneSociale || ''}\n`;
    }

    // Referente
    const nome = (config.referenteNome !== false) ? (data.referenteNome || '') : '';
    const cognome = (config.referenteCognome !== false) ? (data.referenteCognome || '') : '';
    const titolo = (config.referenteTitolo !== false) ? (data.referenteTitolo || '') : '';

    if (nome || cognome) {
        v += `N:${cognome};${nome};;;\n`;
    }
    if (titolo) {
        v += `TITLE:${titolo}\n`;
    }

    // Cellulare Referente
    if (config.referenteCellulare !== false && data.referenteCellulare) {
        v += `TEL;TYPE=CELL:${data.referenteCellulare}\n`;
    }

    // Email (PEC)
    const pecEmail = data.emails?.pec?.email || data.aziendaEmail;
    if (config.aziendaEmail !== false && pecEmail) {
        v += `EMAIL;TYPE=WORK,INTERNET:${pecEmail}\n`;
    }

    // Email (Amministrazione)
    const adminEmail = data.emails?.amministrazione?.email;
    if (config.adminEmail && adminEmail) {
        v += `EMAIL;TYPE=WORK,INTERNET:${adminEmail}\n`;
    }

    // Email (Personale)
    const persEmail = data.emails?.personale?.email;
    if (config.persEmail && persEmail) {
        v += `EMAIL;TYPE=HOME,INTERNET:${persEmail}\n`;
    }

    // Extra Emails
    if (data.emails?.extra && Array.isArray(data.emails.extra)) {
        data.emails.extra.forEach(e => {
            if (e.qr !== false && e.email) {
                v += `EMAIL;TYPE=WORK,INTERNET:${e.email}\n`;
            }
        });
    }

    // Extra Data in NOTE or Custom Fields
    let notes = [];
    if (config.partitaIva !== false && data.partitaIva) notes.push(`P.IVA: ${data.partitaIva}`);
    if (config.codiceSDI !== false && data.codiceSDI) notes.push(`SDI: ${data.codiceSDI}`);
    if (config.numeroCCIAA !== false && data.numeroCCIAA) notes.push(`CCIAA: ${data.numeroCCIAA}`);

    if (config.dataIscrizione !== false && data.dataIscrizione) {
        const d = data.dataIscrizione.split('-');
        const dIT = d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : data.dataIscrizione;
        notes.push(`Iscr: ${dIT}`);
    }

    // Sede Legale (qrLegale)
    if (config.qrLegale !== false) {
        const addr = data.indirizzoSede || '';
        const civ = data.civicoSede || '';
        const cit = data.cittaSede || '';
        const prov = data.provinciaSede || '';
        const cap = data.capSede || '';
        if (addr || cit) {
            v += `ADR;TYPE=WORK,PREF:;;${addr} ${civ};${cit};${prov};${cap};Italiana\n`;
        }
    }

    // Altre Sedi (Dynamic Loop)
    if (data.altreSedi && Array.isArray(data.altreSedi)) {
        data.altreSedi.forEach(sede => {
            if (sede.qr !== false && (sede.indirizzo || sede.citta)) {
                let typeParams = 'WORK';
                const tLower = (sede.tipo || '').toLowerCase();
                if (tLower.includes('amm')) typeParams = 'WORK,POSTAL';
                else if (tLower.includes('oper') || tLower.includes('magazz') || tLower.includes('logis')) typeParams = 'WORK,PARCEL';

                v += `ADR;TYPE=${typeParams}:;;${sede.indirizzo || ''} ${sede.civico || ''};${sede.citta || ''};${sede.provincia || ''};${sede.cap || ''};Italiana\n`;

                // Add to notes for visibility if reader doesn't support multiple ADRs well
                notes.push(`${sede.tipo || 'Sede'}: ${sede.indirizzo || ''} ${sede.citta || ''}`);
            }
        });
    }

    if (notes.length > 0) {
        v += `NOTE:${notes.join(' - ')}\n`;
    }

    v += "END:VCARD";
    return v;
}

function openQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) modal.classList.add('active');
}

function closeQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) modal.classList.remove('active');
}

function renderAllegati(allegati) {
    const container = document.getElementById('allegati-list');
    if (!container || !allegati || allegati.length === 0) return;

    const items = allegati.map(a => createElement('a', {
        href: a.url,
        target: '_blank',
        className: 'attachment-item group'
    }, [
        createElement('div', { className: 'attachment-info' }, [
            createElement('span', { className: 'material-symbols-outlined icon-accent-blue', textContent: 'description' }),
            createElement('span', { className: 'attachment-name', textContent: a.name || a.nome })
        ]),
        createElement('span', { className: 'material-symbols-outlined attachment-icon-open', textContent: 'open_in_new' })
    ]));

    setChildren(container, items);
}

