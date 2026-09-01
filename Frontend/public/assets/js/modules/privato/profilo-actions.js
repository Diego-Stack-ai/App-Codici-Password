/**
 * PROFILO ACTIONS (V1.0)
 * Funzioni di modifica (edit/add) per sezioni del profilo privato.
 * Estratto da profilo_privato.js per ridurne le dimensioni.
 *
 * Pattern: ogni funzione riceve un `ctx` (context object) con lo stato
 * condiviso del modulo principale, evitando dipendenze circolari.
 *
 * ctx = {
 *   currentUserUid,    // string
 *   currentUserData,   // object (mutabile)
 *   userAddresses,     // array (mutabile)
 *   userDocuments,     // array (mutabile)
 *   profileLabels,     // object con tipi/etichette
 *   syncData,          // async function
 *   renderAddressesView, // function
 *   renderDocumentiView, // function
 *   loadUserData,      // async function
 * }
 */

import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { auth, db } from '../../firebase-config.js?v=1.1.8';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { encrypt, ensureMasterKey } from '../core/security-manager.js';
import { showProfileModal } from './profilo-modal.js';

/**
 * Apre il modal per modificare una sezione dati (dati-personali, note).
 */
export async function editSection(sectionId, ctx) {
    const { currentUserUid, currentUserData, loadUserData } = ctx;

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
                const clearData = {
                    nome: newData.nome || '',
                    cognome: newData.cognome || '',
                    birth_date: newData.birth_date || '',
                    birth_place: newData.birth_place || '',
                    birth_province: newData.birth_province || ''
                };
                await updateDoc(doc(db, "users", currentUserUid), clearData);
                Object.assign(currentUserData, newData);
                await loadUserData(auth.currentUser);
                showToast(t('success_save'), "success");
            } catch (e) { logError("EditSection", e); showToast(t('error_generic'), "error"); }
        });
    } else if (sectionId === 'note') {
        const fields = [{ key: 'note', label: 'Note', type: 'textarea', icon: 'description' }];
        showProfileModal('Note Anagrafica', fields, currentUserData, async (newData) => {
            try {
                const masterKey = await ensureMasterKey();
                const encryptedNote = await encrypt(newData.note || '', masterKey);
                await updateDoc(doc(db, "users", currentUserUid), { note: encryptedNote });
                currentUserData.note = newData.note;
                await loadUserData(auth.currentUser);
                showToast(t('success_save'), "success");
            } catch (e) { logError("EditSectionNote", e); showToast(t('error_generic'), "error"); }
        });
    }
}

/**
 * Apre il modal per aggiungere o modificare un indirizzo.
 * @param {number} idx - Indice indirizzo, -1 per nuovo
 */
export async function editAddress(idx, ctx) {
    const { userAddresses, profileLabels, syncData, renderAddressesView } = ctx;
    const isNew = idx === -1;
    const addr = isNew
        ? { type: profileLabels.addressTypes[0], address: '', civic: '', cap: '', city: '', province: '', utilities: [] }
        : userAddresses[idx];

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
}

/**
 * Apre il modal per aggiungere o modificare un documento.
 * @param {number} idx - Indice documento, -1 per nuovo
 */
export async function editUserDocument(idx, ctx) {
    const { userDocuments, profileLabels, syncData, renderDocumentiView } = ctx;
    const isNew = idx === -1;
    let tempDoc = isNew
        ? { type: profileLabels.documentTypes[0], num_serie: '', expiry_date: '' }
        : { ...userDocuments[idx] };

    const getDocumentFields = (type) => {
        const base = [
            { key: 'type', label: 'Tipo Documento', icon: 'badge', type: 'select', options: profileLabels.documentTypes, configKey: 'documentTypes' }
        ];
        const typeLower = (type || '').toLowerCase();

        if (typeLower.includes('identità')) {
            return [...base,
                { key: 'num_serie', label: 'Numero Carta', icon: 'numbers' },
                { key: 'rilasciato_da', label: t('label_issued_by'), icon: 'account_balance' },
                { key: 'luogo_rilascio', label: t('label_release_place'), icon: 'location_on' },
                { key: 'data_rilascio', label: t('label_issue_date'), type: 'date', icon: 'history' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'home_page', label: 'Home Page / Sito', icon: 'language' },
                { key: 'username', label: 'Username / CF', icon: 'person' },
                { key: 'password', label: 'Password', icon: 'lock' },
                { key: 'pin', label: t('label_pin'), icon: 'password' },
                { key: 'puk', label: t('label_puk'), icon: 'security' },
                { key: 'codice_app', label: t('label_app_code'), icon: 'apps' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        } else if (typeLower.includes('patente')) {
            return [...base,
                { key: 'num_serie', label: 'Patente', icon: 'numbers' },
                { key: 'home_page', label: 'Home Page / Sito', icon: 'language' },
                { key: 'rilasciato_da', label: t('label_issued_by'), icon: 'account_balance' },
                { key: 'data_rilascio', label: t('label_issue_date'), type: 'date', icon: 'history' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        } else if (typeLower.includes('fiscale')) {
            return [...base,
                { key: 'num_serie', label: 'Codice Fiscale', icon: 'badge' },
                { key: 'home_page', label: 'Home Page / Sito', icon: 'language' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'id_number', label: t('label_id_number'), icon: 'numbers' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        } else if (typeLower.includes('passaporto')) {
            return [...base,
                { key: 'num_serie', label: 'Numero Passaporto', icon: 'numbers' },
                { key: 'home_page', label: 'Home Page / Sito', icon: 'language' },
                { key: 'rilasciato_da', label: t('label_issued_by'), icon: 'account_balance' },
                { key: 'data_rilascio', label: t('label_issue_date'), type: 'date', icon: 'history' },
                { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
                { key: 'note', label: 'Note', icon: 'description' }
            ];
        }
        return [...base,
            { key: 'num_serie', label: 'Numero / Codice', icon: 'numbers' },
            { key: 'home_page', label: 'Home Page / Sito', icon: 'language' },
            { key: 'expiry_date', label: t('label_expiry_date'), type: 'date', icon: 'calendar_today' },
            { key: 'note', label: 'Note', icon: 'description' }
        ];
    };

    const openModal = (currentVals) => {
        const fields = getDocumentFields(currentVals.type);
        showProfileModal(isNew ? 'Nuovo Documento' : 'Modifica Documento', fields, currentVals, async (newData) => {
            const finalData = { ...currentVals, ...newData };
            if (finalData.type.toLowerCase().includes('patente')) finalData.license_number = finalData.num_serie;
            if (finalData.type.toLowerCase().includes('fiscale')) finalData.cf_value = finalData.num_serie;
            if (isNew) {
                userDocuments.push(finalData);
            } else {
                userDocuments[idx] = finalData;
            }
            await syncData();
            renderDocumentiView();
        });

        // Cambio tipo documento → riapertura modale con campi aggiornati
        const modal = document.getElementById('profile-edit-modal');
        const typeSelect = modal?.querySelector('select');
        if (typeSelect) {
            typeSelect.onchange = (e) => {
                openModal({ ...currentVals, type: e.target.value });
            };
        }
    };

    openModal(tempDoc);
}

/**
 * Apre il modal per aggiungere una utenza a un indirizzo.
 */
export async function addUtility(addrIdx, ctx) {
    const { userAddresses, profileLabels, syncData, renderAddressesView } = ctx;
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
}

/**
 * Apre il modal per modificare una utenza esistente.
 */
export async function editUtility(addrIdx, uIdx, ctx) {
    const { userAddresses, profileLabels, syncData, renderAddressesView } = ctx;
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
}
