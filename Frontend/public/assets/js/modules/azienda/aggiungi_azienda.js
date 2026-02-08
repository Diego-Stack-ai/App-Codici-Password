/**
 * AGGIUNGI AZIENDA MODULE (V4.1)
 * Creazione di un nuovo profilo aziendale con gestione logo e sezioni collassabili.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let currentUser = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initProtocolUI();
    setupUI();

    observeAuth((user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            currentUser = user;
        }
    });

    setupCollapsibles();
    setupPasswordToggles();
});

async function initProtocolUI() {
    await initComponents();

    // Header Left
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => history.back()
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
        ]));
    }

    // Header Center
    const hCenter = document.getElementById('header-center');
    if (hCenter) {
        clearElement(hCenter);
        setChildren(hCenter, createElement('h2', {
            className: 'header-title',
            textContent: t('new_company') || 'Nuova Azienda'
        }));
    }

    // Header Right
    const hRight = document.getElementById('header-right');
    if (hRight) {
        clearElement(hRight);
        setChildren(hRight, createElement('a', {
            href: 'home_page.html',
            className: 'btn-icon-header'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'home' })
        ]));
    }

    // Footer Right
    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, createElement('button', {
            id: 'btn-save-azienda',
            className: 'base-btn-primary flex-center-gap',
            onclick: saveAzienda
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }),
            createElement('span', { textContent: t('save_company') || 'Salva Azienda' })
        ]));
    }
}

function setupUI() {
    const logoContainer = document.getElementById('logo-container');
    const inputLogo = document.getElementById('input-logo');
    if (logoContainer && inputLogo) {
        logoContainer.onclick = () => inputLogo.click();
        inputLogo.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const preview = document.getElementById('logo-preview');
                const placeholder = document.getElementById('logo-placeholder');
                if (preview) { preview.src = ev.target.result; preview.classList.remove('hidden'); }
                if (placeholder) placeholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        };
    }
}

function setupCollapsibles() {
    document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
        trigger.onclick = () => {
            const targetId = trigger.dataset.target;
            const target = document.getElementById(targetId);
            const chevron = trigger.querySelector('.chevron');
            if (target) {
                const isHidden = target.classList.toggle('hidden');
                trigger.classList.toggle('active', !isHidden);
                if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        };
    });
}

function setupPasswordToggles() {
    document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('span');
            if (input) {
                const isShield = input.classList.toggle('base-shield');
                if (icon) icon.textContent = isShield ? 'visibility' : 'visibility_off';
            }
        };
    });
}

async function saveAzienda() {
    if (!currentUser) return;

    const btn = document.getElementById('btn-save-azienda');
    const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

    const ragioneSociale = getValue('ragione-sociale');
    const pIva = getValue('piva');

    if (!ragioneSociale) return showToast(t('error_missing_company_name') || "Inserisci la Ragione Sociale.", "error");
    if (!pIva) return showToast(t('error_missing_vat') || "Inserisci la Partita IVA.", "error");

    const qrConfig = {};
    document.querySelectorAll('input[data-qr-field]').forEach(cb => {
        qrConfig[cb.dataset.qrField] = cb.checked;
    });

    let logoBase64 = null;
    const logoPreview = document.getElementById('logo-preview');
    if (logoPreview && !logoPreview.classList.contains('hidden') && logoPreview.src.startsWith('data:')) {
        logoBase64 = await resizeImage(logoPreview.src, 400);
    }

    const data = {
        ragioneSociale,
        partitaIva: pIva,
        codiceSDI: getValue('codice-sdi').toUpperCase(),
        indirizzoSede: getValue('indirizzo'),
        cittaSede: getValue('citta'),
        provinciaSede: getValue('provincia').toUpperCase(),
        capSede: getValue('cap'),
        numeroCCIAA: getValue('numero-cciaa'),
        dataIscrizione: getValue('data-iscrizione'),
        telefonoAzienda: getValue('telefono-azienda'),
        faxAzienda: getValue('fax-azienda'),
        aziendaEmail: getValue('email-pec'),
        aziendaEmailPassword: getValue('email-pec-password'),
        aziendaEmailPasswordNote: getValue('email-pec-note'),
        emails: {
            amministrazione: {
                email: getValue('email-amministrazione'),
                password: getValue('email-amministrazione-password')
            },
            personale: {
                email: getValue('email-personale'),
                password: getValue('email-personale-password')
            }
        },
        referenteNome: getValue('referente-nome'),
        referenteCognome: getValue('referente-cognome'),
        referenteCellulare: getValue('referente-cellulare'),
        note: getValue('note-azienda'),
        logo: logoBase64,
        qrConfig: qrConfig,
        colorIndex: Math.floor(Math.random() * 10),
        createdAt: serverTimestamp()
    };

    try {
        if (btn) {
            btn.disabled = true;
            setChildren(btn, [
                createElement('span', { className: 'material-symbols-outlined animate-spin text-xl', textContent: 'progress_activity' })
            ]);
        }

        const colRef = collection(db, "users", currentUser.uid, "aziende");
        await addDoc(colRef, data);

        showToast(t('success_save') || "Azienda salvata con successo!", "success");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1000);

    } catch (error) {
        logError("SaveAzienda", error);
        showToast(t('error_generic'), "error");
        if (btn) {
            btn.disabled = false;
            setChildren(btn, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }),
                createElement('span', { textContent: t('save_company') || 'Salva Azienda' })
            ]);
        }
    }
}

function resizeImage(base64Str, maxWidth = 300) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
}

