/**
 * DATI AZIENDA MODULE (V4.2)
 * Visualizzazione dettagliata anagrafica aziendale, QR vCard, sedi e allegati.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// Carica QRCode library locale
const qrcodeScript = document.createElement('script');
qrcodeScript.src = '../../vendor/qrcode.min.js';
document.head.appendChild(qrcodeScript);

// --- STATE ---
let currentAziendaId = new URLSearchParams(window.location.search).get('id');
let currentAziendaData = null;
let currentLocations = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initProtocolUI();
    setupEventListeners();

    observeAuth(async (user) => {
        if (user && currentAziendaId) {
            await loadData(user.uid);
        } else if (!user) {
            window.location.href = 'index.html';
        }
    });
});

async function initProtocolUI() {
    console.log('[dati_azienda] UI Base gestita da main.js');

    // Footer Right
    // Footer Center Actions
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('button', {
            id: 'footer-btn-edit',
            className: 'btn-floating-add !bg-amber-500',
            title: t('edit') || 'Modifica',
            onclick: () => window.location.href = `modifica_azienda.html?id=${currentAziendaId}`
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
        ]));
    }
}

function setupEventListeners() {
    document.getElementById('btn-zoom-qr')?.addEventListener('click', openQRZoom);
    document.getElementById('btn-close-qr')?.addEventListener('click', closeQRZoom);
    document.getElementById('qr-zoom-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'qr-zoom-modal') closeQRZoom();
    });

    document.getElementById('toggle-allegati-btn')?.addEventListener('click', () => {
        const container = document.getElementById('allegati-container');
        const chevron = document.getElementById('allegati-chevron');
        if (container) {
            const isHidden = container.classList.toggle('hidden');
            if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        }
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
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };

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
        className: `location-tab-btn flex-center-col gap-1 min-w-[70px] p-2 rounded-xl transition-all border ${i === 0 ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/40'}`,
        onclick: () => switchLocation(i)
    }, [
        createElement('span', { className: 'material-symbols-outlined text-lg', textContent: l.icon }),
        createElement('span', { className: 'text-[9px] font-black uppercase tracking-tighter truncate w-full text-center', textContent: l.tipo })
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

    const btnMap = document.getElementById('btn-vedi-mappa');
    if (btnMap) {
        btnMap.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr + ' ' + cityFull)}`, '_blank');
        btnMap.disabled = !fullAddr && !cityFull;
    }

    document.querySelectorAll('.location-tab-btn').forEach((btn, i) => {
        const isActive = i === index;
        btn.classList.toggle('bg-blue-500/20', isActive);
        btn.classList.toggle('border-blue-500/30', isActive);
        btn.classList.toggle('text-blue-400', isActive);
        btn.classList.toggle('bg-white/5', !isActive);
        btn.classList.toggle('border-white/5', !isActive);
        btn.classList.toggle('text-white/40', !isActive);
    });

    const thumb = document.getElementById('location-map-thumbnail');
    if (thumb && (fullAddr || cityFull)) {
        const query = encodeURIComponent(`${fullAddr}, ${cityFull}, Italy`);
        clearElement(thumb);
        setChildren(thumb, createElement('iframe', {
            style: "width:300px; height:300px; border:0; position:absolute; top:-100px; left:-100px; pointer-events:none;",
            loading: "lazy",
            src: `https://maps.google.com/maps?q=${query}&z=15&output=embed`
        }));
    }
}

function renderEmailCategories(data) {
    const wrap = document.getElementById('wrapper-email-section');
    const container = document.getElementById('email-list-container');
    if (!container) return;

    const cats = [
        { id: 'pec', label: 'PEC', icon: 'verified_user', email: data.aziendaEmail || data.emails?.pec?.email },
        { id: 'amministrazione', label: 'Amm.ne', icon: 'payments', email: data.emails?.amministrazione?.email },
        { id: 'personale', label: 'Personale', icon: 'group', email: data.emails?.personale?.email },
        { id: 'manutenzione', label: 'Manutenz.', icon: 'build_circle', email: data.emails?.manutenzione?.email },
        { id: 'attrezzatura', label: 'Attrezzat.', icon: 'precision_manufacturing', email: data.emails?.attrezzatura?.email },
        { id: 'magazzino', label: 'Magazzino', icon: 'inventory_2', email: data.emails?.magazzino?.email }
    ].filter(c => c.email);

    if (cats.length > 0) {
        wrap?.classList.remove('hidden');
        const items = cats.map(c => createElement('div', { className: 'glass-card flex items-center justify-between p-4 group' }, [
            createElement('div', { className: 'flex items-center gap-3' }, [
                createElement('div', { className: 'size-10 rounded-xl bg-purple-500/10 text-purple-400 flex-center border border-purple-500/10 shrink-0' }, [
                    createElement('span', { className: 'material-symbols-outlined text-xl', textContent: c.icon })
                ]),
                createElement('div', { className: 'flex flex-col min-w-0' }, [
                    createElement('span', { className: 'text-[9px] font-black uppercase text-white/40 tracking-widest', textContent: c.label }),
                    createElement('a', { href: `mailto:${c.email}`, className: 'text-sm font-bold text-white truncate break-all', textContent: c.email })
                ])
            ]),
            createElement('span', {
                className: 'material-symbols-outlined text-xs opacity-20 group-hover:opacity-100 transition-opacity cursor-pointer',
                textContent: 'content_copy',
                onclick: () => { navigator.clipboard.writeText(c.email).then(() => showToast(t('copied'), 'success')); }
            })
        ]));
        setChildren(container, items);
    }
}

function handleLogoAndQR(data) {
    const logoImg = document.getElementById('azienda-logo');
    const logoPlace = document.getElementById('azienda-logo-placeholder');
    if (data.logo && logoImg) {
        logoImg.src = data.logo;
        logoImg.classList.remove('hidden');
        logoPlace?.classList.add('hidden');
    }

    const vcard = buildVCard(data);
    const options = { width: 100, height: 100, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M };

    const qrCont = document.getElementById('qrcode-container');
    if (qrCont) { clearElement(qrCont); new QRCode(qrCont, { ...options, text: vcard }); }

    const qrZoom = document.getElementById('qrcode-zoom-container');
    if (qrZoom) { clearElement(qrZoom); new QRCode(qrZoom, { ...options, width: 300, height: 300, text: vcard }); }
}

function buildVCard(data) {
    let v = "BEGIN:VCARD\nVERSION:3.0\n";
    v += `FN:${data.ragioneSociale}\nORG:${data.ragioneSociale}\n`;
    if (data.referenteCellulare) v += `TEL;TYPE=CELL:${data.referenteCellulare}\n`;
    if (data.telefonoAzienda) v += `TEL;TYPE=WORK,VOICE:${data.telefonoAzienda}\n`;
    if (data.aziendaEmail) v += `EMAIL;TYPE=PREF,INTERNET:${data.aziendaEmail}\n`;
    v += "END:VCARD";
    return v;
}

function openQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.children[1].classList.remove('scale-90');
            modal.children[1].classList.add('scale-100');
        }, 10);
    }
}

function closeQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('opacity-100');
        modal.children[1].classList.remove('scale-100');
        modal.children[1].classList.add('scale-90');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
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

