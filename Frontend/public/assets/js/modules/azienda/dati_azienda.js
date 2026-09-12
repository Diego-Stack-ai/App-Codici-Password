import { buildCompanyVCard as buildVCard } from './company-vcard.js';
import { initCompanyProfile } from './company-profile-ui.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
/**
 * DATI AZIENDA MODULE (V5.0 ADAPTER)
 * Visualizzazione dettagliata anagrafica aziendale, QR vCard, sedi e allegati.
 * - Entry Point: initDatiAzienda(user)
 */

import { auth, db } from '../../firebase-config.js?v=1.2.108';
import { doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import {getCompany} from '../data/vault-repository.js';

import { ensureQRCodeLib, renderQRCode } from '../shared/qr_code_utils.js';
import { encrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { renderCompanyEmbeddedAttachments } from './dati-azienda-attachments.js';

// --- STATE ---
let currentAziendaId = null;
let currentAziendaData = null;
let currentLocations = [];
let currentVCard = null;       // VCard string per lazy QR zoom
let isQRZoomRendered = false;  // Evita re-render ad ogni apertura del modal

// --- INITIALIZATION ---
export async function initDatiAzienda(user) {
    
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

    
}

async function initProtocolUI() {
    

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
                const key = await ensureVaultKeyMaterial();
                if (!key) throw new Error('Vault bloccato');
                await updateDoc(doc(db, "users", auth.currentUser.uid, "aziende", currentAziendaId), { note: await encrypt(newNote, key) });
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
        const company = await getCompany(uid, currentAziendaId);
        if (company) {
            currentAziendaData = structuredClone(company);

            const noteButton = document.getElementById('btn-edit-note');
            if (noteButton) noteButton.disabled = false;
            if (currentAziendaData.note) {
                try { currentAziendaData.note = await decryptRequiredValue(currentAziendaData.note, await ensureVaultKeyMaterial()); }
                catch { currentAziendaData.note = 'Nota non disponibile: sblocca il Vault.'; if (noteButton) noteButton.disabled = true; }
            }
            populateFields(currentAziendaData);
            handleLogoAndQR(currentAziendaData);
            renderCompanyEmbeddedAttachments(currentAziendaData.allegati);
            initCompanyProfile(currentAziendaData, currentAziendaId, {buildVCard, reload: () => loadData(uid)});
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

async function handleLogoAndQR(data) {
    const logoImg = document.getElementById('azienda-logo');
    const logoPlace = document.getElementById('azienda-logo-placeholder');
    if (data.logo && logoImg) {
        logoImg.src = data.logo;
        logoImg.classList.remove('hidden');
        logoPlace?.classList.add('hidden');
    }

    // Costruisce la vCard e la salva per il lazy zoom
    currentVCard = buildVCard(data);

    // Render Preview leggero (88x88 → box 100px con padding 6px) — non blocca il load
    const qrCont = document.getElementById('qrcode-container');
    if (qrCont && currentVCard) {
        // Optimization: Defer rendering (V7.0) to avoid 'load' handler violation
        setTimeout(() => {
            renderQRCode(qrCont, currentVCard, {
                width: 88,
                height: 88,
                colorDark: "#000000",
                colorLight: "#E3F2FD"
            });
        }, 50);
    }
    // Il QR zoom 300x300 viene generato in openQRZoom() alla prima apertura (lazy)
}


function openQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (!modal) return;
    modal.classList.add('active');

    // Lazy render: genera il QR 300x300 solo alla prima apertura
    if (!isQRZoomRendered && currentVCard) {
        const qrZoom = document.getElementById('qrcode-zoom-container');
        if (qrZoom) {
            renderQRCode(qrZoom, currentVCard, {
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#E3F2FD"
            });
            isQRZoomRendered = true;
        }
    }
}

function closeQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) modal.classList.remove('active');
}

