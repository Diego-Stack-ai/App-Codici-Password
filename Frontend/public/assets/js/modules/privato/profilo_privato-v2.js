import { getDocSmart as getDoc } from "/assets/js/offline-firestore.js";
/**
 * PROFILO PRIVATO MODULE (V6.0 — Modular)
 * Entry point e orchestratore del profilo privato utente.
 *
 * ARCHITETTURA MODULARE:
 * - Stato condiviso     → questo file (let declarations module-scope)
 * - Crittografia/Sync   → profilo-sync.js
 * - QR Code             → profilo-qr.js
 * - Telefoni + Email    → profilo-phones-emails.js
 * - Indirizzi + Docs    → profilo-addresses-docs.js
 * - UI (avatar, label, dropdown, collapsible) → profilo-ui.js
 * - Azioni (edit/add)   → profilo-actions.js
 * - Modal               → profilo-modal.js
 *
 * Pattern: init-with-callbacks
 *   Ogni modulo riceve un getState(() => { ... }) e un oggetto callbacks.
 *   getState() è una closure sul module-scope: restituisce sempre i valori correnti.
 *   Nessuna dipendenza circolare.
 *
 * Entry Point: initProfiloPrivato(user)
 */

import { auth, db, storage } from '../../firebase-config.js?v=1.2.38';
import { LOG } from '../../logger.js';
import { onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";
import { deleteField, doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, getDownloadURL } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { editSection, editAddress, editUserDocument, addUtility, editUtility } from './profilo-actions-v2.js';
import { logError, formatDateToIT } from '../../utils.js';
import { encrypt, decrypt, ensureMasterKey, clearSession, isAutoUnlockActive } from '../core/security-manager.js';
import { decryptIfPossible, isEncryptedValue } from '../core/crypto-utils.js';
import { syncData as _syncData } from './profilo-sync.js';
import { normalizeLegacyProfile, migrateQrIndexesToIds } from './profile-model.js';

// — Moduli estratti
import { initQRModule, setupQRToggles, toggleQRInclusion, setQRScalar, getProfileVCard, generateProfileQRCode } from './profilo-qr-v2.js';
import { initPhonesEmailsModule, renderPhonesView, renderEmailsView, editPhone, editEmail } from './profilo-phones-emails-v2.js';
import { initAddressesDocsModule, renderAddressesView, renderDocumentiView } from './profilo-addresses-docs-v2.js?v=1.2.38';
import { initUIModule, setupAvatarEdit, setupPersonalDataCopy, setupCollapsibleSections, initProxyDropdowns } from './profilo-ui.js';
import { initProfileDashboard, renderProfileOverview, renderDigitalCard } from './profilo-dashboard.js';
import { initProfileWidgets, setWidgetFieldQr } from './profilo-widgets.js';
import { connectEmailAccount, createDeadlineFromDocument, openLinkedAccount } from './profilo-links.js';

// Le funzioni crypto sono disponibili solo via import ES6 (non esposte globalmente per sicurezza)
export { encrypt, decrypt };

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentUserUid = null;
let currentUserData = {};
let contactEmails = [];
let userAddresses = [];
let contactPhones = [];
let userDocuments = [];
let customWidgets = [];
let profileLabels = {
    addressTypes: ['Residenza', 'Domicilio', 'Ufficio', 'Altro'],
    utilityTypes: ['Codice POD', 'Contatore Acqua', 'Contatore Metano', 'Fibra', 'Altro'],
    phoneLabels: ['Cellulare', 'Fisso', 'Principale', 'Altro'],
    emailLabels: ['Personale', 'Lavoro', 'Principale', 'Email di recupero', 'Altro'],
    documentTypes: ['Carta Identità', 'Patente', 'Codice Fiscale', 'Passaporto', 'Altro']
};

let qrCodeInclusions = {
    nome: false,
    cf: false,
    nascita: false,
    phones: [],
    emails: [],
    addresses: []
};

// ─── DOM CACHE ────────────────────────────────────────────────────────────────

const avatarImg = document.getElementById('profile-avatar');
const nameDisplay = document.getElementById('user-display-name');

// ─── INIT ─────────────────────────────────────────────────────────────────────

export async function initProfiloPrivatoV2(user) {
    if (!user) return;
    currentUserUid = user.uid;
    await loadUserData(user, false);
    const ctx = buildCtx();

    // Inizializza tutti i moduli con getState + callbacks
    initQRModule(
        () => ({ qrCodeInclusions, currentUserUid, currentUserData, contactPhones, contactEmails, userAddresses, customWidgets }),
        { renderPhonesView, renderEmailsView, renderAddressesView }
    );

    // La dashboard deve essere disponibile appena i dati e il modulo QR sono pronti.
    // Gli inizializzatori legacy successivi non possono così lasciare una pagina vuota.
    initProfileDashboard(
        () => ({ currentUserData, contactPhones, contactEmails, userAddresses, userDocuments, qrCodeInclusions, customWidgets }),
        { toggleQRInclusion, setQRScalar, setWidgetFieldQr, getVCard: getProfileVCard, downloadVCard, shareVCard }
    );

    initPhonesEmailsModule(
        () => ({ contactPhones, contactEmails, profileLabels, qrCodeInclusions }),
        { syncData, toggleQRInclusion, deletePhone, deleteEmail, connectEmailAccount, openLinkedAccount }
    );

    initAddressesDocsModule(
        () => ({ userAddresses, qrCodeInclusions, userDocuments }),
        {
            toggleQRInclusion,
            onAddAddress: () => editAddress(-1, buildCtx()),
            onAddDoc: () => editUserDocument(-1, buildCtx()),
            createDeadlineFromDocument: documentItem => createDeadlineFromDocument(documentItem, syncData)
        }
    );

    initUIModule(
        () => ({ currentUserUid, profileLabels })
    );

    // Setup UI
    setupAvatarEdit();
    setupDelegation(ctx);
    setupPersonalDataCopy();
    initProxyDropdowns();
    setupQRToggles();
    setupCollapsibleSections();

    await initProfileWidgets({ onChanged: widgets => {
        customWidgets = widgets;
        renderDigitalCard();
        generateProfileQRCode();
    } });

    // Render sezioni ora che tutti i moduli sono inizializzati.
    renderAllSections();
    generateProfileQRCode();
}

/** Context object per profilo-actions.js */
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

// ─── DATA LOADING ─────────────────────────────────────────────────────────────

async function loadUserData(user, renderImmediately = true) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        currentUserData = userDoc.data();

        // 🔐 PROTOCOLLO BLINDA (V6.1.5): Decrittazione Granulare Universale
        const masterKey = await ensureMasterKey();
        if (masterKey) {
            currentUserData.nome = await decryptIfPossible(currentUserData.nome, masterKey);
            currentUserData.cognome = await decryptIfPossible(currentUserData.cognome, masterKey);
            currentUserData.birth_place = await decryptIfPossible(currentUserData.birth_place, masterKey);
            currentUserData.note = await decryptIfPossible(currentUserData.note, masterKey);

            if (Array.isArray(currentUserData.contactPhones)) {
                currentUserData.contactPhones = await Promise.all(currentUserData.contactPhones.map(async p => ({
                    ...p,
                    number: await decryptIfPossible(p.number, masterKey)
                })));
            }

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

            if (Array.isArray(currentUserData.contactEmails)) {
                currentUserData.contactEmails = await Promise.all(currentUserData.contactEmails.map(async e => ({
                    ...e,
                    password: await decryptIfPossible(e.password, masterKey),
                    note: await decryptIfPossible(e.note, masterKey)
                })));
            }
            LOG('[VaultCheck] Decrittazione granulare V6.1.5 completata.');
        }

        currentUserData = normalizeLegacyProfile(currentUserData);

        // Hero Header
        const fullNameRaw = `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim();
        const finalFullName = (fullNameRaw && !fullNameRaw.includes('[ERROR]')) ? fullNameRaw : (user.displayName || 'Utente');
        if (nameDisplay) nameDisplay.textContent = finalFullName;
        if (avatarImg) avatarImg.src = currentUserData.photoURL || user.photoURL || 'assets/images/user-avatar-5.png';

        // View Population
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '-'; };
        set('nome-view', finalFullName);

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

        // Custom Labels
        const labelsSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'profileLabels'));
        if (labelsSnap.exists()) {
            Object.assign(profileLabels, labelsSnap.data()); // in-place per preservare i riferimenti nei moduli
        }

        // QR Code Inclusions
        const qrSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'qrCodeInclusions'));
        if (qrSnap.exists()) {
            Object.assign(qrCodeInclusions, qrSnap.data()); // in-place per preservare i riferimenti nei moduli
        }
        Object.assign(qrCodeInclusions, migrateQrIndexesToIds(qrCodeInclusions, currentUserData));

        if (renderImmediately) {
            renderAllSections();
            generateProfileQRCode();
        }
    } catch (e) {
        logError('LoadProfile', e);
        showToast(t('error_generic'), 'error');
    }
}

function renderAllSections() {
    renderAddressesView();
    renderPhonesView();
    renderEmailsView();
    renderDocumentiView();
    renderProfileOverview();
    renderDigitalCard();
    focusAssistantDocument();
}

function downloadVCard() {
    const blob = new Blob([getProfileVCard()], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'profilo.vcf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareVCard() {
    const file = new File([getProfileVCard()], 'profilo.vcf', { type: 'text/vcard' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Tessera digitale', files: [file] });
    } else {
        downloadVCard();
        showToast('Condivisione non disponibile: vCard scaricata.', 'info');
    }
}

function focusAssistantDocument() {
    const rawIndex = new URLSearchParams(window.location.search).get('assistantDoc');
    if (!/^\d+$/.test(rawIndex || '')) return;
    const target = document.querySelector(`[data-assistant-doc-index="${rawIndex}"]`);
    if (!target) return;
    const header = document.querySelector('[data-section="documenti"]');
    const container = document.getElementById('documenti-view-container');
    header?.classList.remove('collapsed');
    container?.classList.remove('collapsed');
    target.classList.add('assistant-focus-card');
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

// ─── SYNC WRAPPER ─────────────────────────────────────────────────────────────

/**
 * Wrapper locale: sanifica e inietta lo stato corrente in profilo-sync.js.
 */
async function syncData() {
    userAddresses = (userAddresses || []).filter(a => a != null);
    contactPhones = (contactPhones || []).filter(p => p != null);
    contactEmails = (contactEmails || []).filter(e => e != null);
    userDocuments = (userDocuments || []).filter(d => d != null);
    return _syncData({ currentUserUid, currentUserData, userAddresses, contactPhones, contactEmails, userDocuments });
}

// ─── DELEGATION ───────────────────────────────────────────────────────────────

function setupDelegation(ctx) {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const idx = parseInt(target.dataset.idx);
        const uIdx = parseInt(target.dataset.uidx);

        switch (action) {
            // profilo-actions.js
            case 'edit-section':  editSection(target.dataset.target, ctx); break;
            case 'edit-address':  editAddress(idx, ctx); break;
            case 'add-utility':   addUtility(idx, ctx); break;
            case 'edit-utility':  editUtility(idx, uIdx, ctx); break;
            case 'edit-doc':      editUserDocument(idx, ctx); break;
            // profilo-phones-emails.js
            case 'edit-phone':    editPhone(idx); break;
            case 'edit-email':    editEmail(idx); break;
            // Delete — rimaste qui (mutano lo stato module-scope)
            case 'delete-address': deleteAddress(idx); break;
            case 'delete-utility': deleteUtility(idx, uIdx); break;
            case 'delete-phone':   deletePhone(idx); break;
            case 'delete-email':   deleteEmail(idx); break;
            case 'delete-doc':     deleteDocumento(idx); break;
        }
    });
}

// ─── DELETE FUNCTIONS ─────────────────────────────────────────────────────────

async function deleteAddress(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo indirizzo?')) return;
    try {
        userAddresses.splice(idx, 1);
        userAddresses = userAddresses.filter(a => a !== undefined && a !== null);
        await syncData();
        renderAddressesView();
        LOG(`[Address] Eliminato indirizzo #${idx}. Rimanenti: ${userAddresses.length}`);
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
        LOG(`[Utility] Eliminata utenza #${uIdx} dall'indirizzo #${aIdx}`);
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
        LOG(`[Phone] Eliminato numero #${idx}. Rimanenti: ${contactPhones.length}`);
    } catch (e) {
        console.error('[Phone] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione del numero.', 'error');
    }
}

async function deleteEmail(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questa email?')) return;
    try {
        const linkedAccountId = contactEmails[idx]?.linkedAccountId;
        contactEmails.splice(idx, 1);
        contactEmails = contactEmails.filter(e => e !== undefined && e !== null);
        await syncData();
        if (linkedAccountId) {
            try {
                await updateDoc(doc(db, 'users', currentUserUid, 'accounts', linkedAccountId), { linkedProfileField: deleteField() });
            } catch (unlinkError) {
                console.warn('[Email] Account collegato non disponibile durante la rimozione del riferimento:', unlinkError);
            }
        }
        renderEmailsView();
        LOG(`[Email] Eliminata email #${idx}. Rimanenti: ${contactEmails.length}`);
    } catch (e) {
        console.error('[Email] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione dell\'email.', 'error');
    }
}

async function deleteDocumento(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), 'Eliminare questo documento?')) return;
    try {
        const linkedDeadlineId = userDocuments[idx]?.expiryReference?.deadlineId;
        userDocuments.splice(idx, 1);
        userDocuments = userDocuments.filter(d => d !== undefined && d !== null);
        await syncData();
        if (linkedDeadlineId) {
            try {
                await updateDoc(doc(db, 'users', currentUserUid, 'scadenze', linkedDeadlineId), { sourceRef: deleteField() });
            } catch (unlinkError) {
                console.warn('[Documento] Scadenza collegata non disponibile durante la rimozione del riferimento:', unlinkError);
            }
        }
        renderDocumentiView();
        LOG(`[Doc] Eliminato documento #${idx}. Rimanenti: ${userDocuments.length}`);
    } catch (e) {
        console.error('[Doc] Errore eliminazione:', e);
        showToast('Errore durante l\'eliminazione del documento.', 'error');
    }
}

// ─── SECTION 9: AZIONI ────────────────────────────────────────────────────────
// editSection, editAddress, editUserDocument, addUtility, editUtility
// sono in ./profilo-actions.js (context-based pattern)
