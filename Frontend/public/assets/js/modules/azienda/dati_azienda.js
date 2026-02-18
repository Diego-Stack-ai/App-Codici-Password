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

// Carica QRCode library locale con Promise
const qrcodeReady = new Promise((resolve) => {
    if (window.QRCode) return resolve();
    const script = document.createElement('script');
    script.src = 'assets/js/vendor/qrcode.min.js';
    script.onload = () => resolve();
    script.onerror = () => { console.error("Failed to load QRCode lib"); resolve(); };
    document.head.appendChild(script);
});

// --- STATE ---
let currentAziendaId = null;
let currentAziendaData = null;
let currentLocations = [];

// --- INITIALIZATION ---
export async function initDatiAzienda(user) {
    console.log("[DATI-AZIENDA] Init V5.0...");
    if (!user) return;

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
        className: `location-tab-btn flex-center-col gap-0.5 min-w-[55px] p-1 rounded-xl transition-all border outline-none ${i === 0 ? 'bg-white text-blue-600 border-transparent shadow-sm' : 'bg-white/5 border-white/5 text-white/40'}`,
        onclick: () => switchLocation(i)
    }, [
        createElement('span', { className: 'material-symbols-outlined text-xs', textContent: l.icon }),
        createElement('span', { className: 'text-3xs font-medium uppercase tracking-tight truncate w-full text-center', textContent: l.tipo })
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
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('text-blue-600', isActive);
        btn.classList.toggle('border-transparent', isActive);
        btn.classList.toggle('shadow-sm', isActive);

        btn.classList.toggle('bg-white/5', !isActive);
        btn.classList.toggle('border-white/5', !isActive);
        btn.classList.toggle('text-white/40', !isActive);

        // Forza rimozione outline e border neri se presenti
        if (isActive) {
            btn.style.borderColor = 'transparent';
            btn.style.outline = 'none';
            btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        } else {
            btn.style.borderColor = '';
            btn.style.boxShadow = '';
        }
    });

}

function renderEmailCategories(data) {
    const wrap = document.getElementById('wrapper-email-section');
    const container = document.getElementById('email-list-container');
    if (!container) return;

    const emailEntries = [
        { id: 'pec', label: 'PEC', icon: 'verified_user', email: data.aziendaEmail || data.emails?.pec?.email, password: data.emails?.pec?.password || data.aziendaEmailPassword },
        { id: 'amministrazione', label: 'Amm.ne', icon: 'payments', email: data.emails?.amministrazione?.email, password: data.emails?.amministrazione?.password },
        { id: 'personale', label: 'Personale', icon: 'group', email: data.emails?.personale?.email, password: data.emails?.personale?.password },
        { id: 'manutenzione', label: 'Manutenz.', icon: 'build_circle', email: data.emails?.manutenzione?.email, password: data.emails?.manutenzione?.password },
        { id: 'attrezzatura', label: 'Attrezzat.', icon: 'precision_manufacturing', email: data.emails?.attrezzatura?.email, password: data.emails?.attrezzatura?.password },
        { id: 'magazzino', label: 'Magazzino', icon: 'inventory_2', email: data.emails?.magazzino?.email, password: data.emails?.magazzino?.password }
    ].filter(c => c.email);

    if (emailEntries.length > 0) {
        wrap?.classList.remove('hidden');
        clearElement(container);

        // Grouping all in one box as requested
        const mainBox = createElement('div', { className: 'glass-card p-4 flex flex-col gap-4' });

        emailEntries.forEach((c, idx) => {
            const item = createElement('div', { className: `flex flex-col gap-2 ${idx > 0 ? 'border-t border-white/5 pt-4' : ''}` }, [
                createElement('div', { className: 'flex items-center justify-between' }, [
                    createElement('div', { className: 'flex items-center gap-3' }, [
                        createElement('div', { className: 'size-8 rounded-lg bg-purple-500/10 text-purple-400 flex-center border border-purple-500/10 shrink-0' }, [
                            createElement('span', { className: 'material-symbols-outlined text-base', textContent: c.icon })
                        ]),
                        createElement('span', { className: 'text-[9px] font-medium uppercase text-secondary tracking-widest', textContent: c.label })
                    ])
                ]),
                // Email Field
                createElement('div', { className: 'glass-container flex items-center justify-between bg-black/20 rounded-xl p-2 px-3 border border-white/5 group' }, [
                    createElement('span', { className: 'text-xs font-bold text-primary truncate min-w-0 flex-1', textContent: c.email }),
                    createElement('div', { className: 'flex items-center gap-2 ml-2' }, [
                        createElement('button', {
                            className: 'opacity-20 group-hover:opacity-100 transition-opacity p-1',
                            onclick: () => { navigator.clipboard.writeText(c.email).then(() => showToast(t('copied'), 'success')); }
                        }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'content_copy' })]),
                        createElement('a', {
                            href: `mailto:${c.email}`,
                            className: 'opacity-20 group-hover:opacity-100 transition-opacity p-1'
                        }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'mail' })])
                    ])
                ]),
                // Password Field (if exists)
                c.password ? createElement('div', { className: 'glass-container flex items-center justify-between bg-black/20 rounded-xl p-2 px-3 border border-white/5 group' }, [
                    createElement('div', { className: 'flex items-center gap-2 flex-1 min-w-0' }, [
                        createElement('span', { className: 'material-symbols-outlined text-xs text-amber-500/60', textContent: 'key' }),
                        createElement('span', {
                            id: `pwd-${c.id}`,
                            className: 'text-xs font-mono text-primary truncate field-password',
                            dataset: { password: c.password, hidden: 'true' },
                            textContent: '••••••••'
                        })
                    ]),
                    createElement('div', { className: 'flex items-center gap-2 ml-2' }, [
                        createElement('button', {
                            className: 'opacity-20 group-hover:opacity-100 transition-opacity p-1',
                            onclick: (e) => togglePwd(c.id, e.currentTarget)
                        }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'visibility' })]),
                        createElement('button', {
                            className: 'opacity-20 group-hover:opacity-100 transition-opacity p-1',
                            onclick: () => { navigator.clipboard.writeText(c.password).then(() => showToast(t('copied'), 'success')); }
                        }, [createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'content_copy' })])
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

    // Wait for lib
    await qrcodeReady;
    if (typeof QRCode === 'undefined') return;

    const options = { width: 100, height: 100, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: QRCode.CorrectLevel.M };

    const qrCont = document.getElementById('qrcode-container');
    if (qrCont) { clearElement(qrCont); new QRCode(qrCont, { ...options, text: vcard }); }

    const qrZoom = document.getElementById('qrcode-zoom-container');
    if (qrZoom) { clearElement(qrZoom); new QRCode(qrZoom, { ...options, width: 300, height: 300, text: vcard }); }
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

    // Email (PEC) - Key map: aziendaEmail (from modify page flag) -> matches data.emails.pec
    const pecEmail = data.emails?.pec?.email || data.aziendaEmail;
    if (config.aziendaEmail !== false && pecEmail) {
        v += `EMAIL;TYPE=WORK,INTERNET:${pecEmail}\n`;
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
        className: 'flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group'
    }, [
        createElement('div', { className: 'flex items-center gap-3' }, [
            createElement('span', { className: 'material-symbols-outlined text-blue-400', textContent: 'description' }),
            createElement('span', { className: 'text-xs text-white/80 font-medium', textContent: a.name || a.nome })
        ]),
        createElement('span', { className: 'material-symbols-outlined text-sm opacity-20 group-hover:opacity-100', textContent: 'open_in_new' })
    ]));

    setChildren(container, items);
}

