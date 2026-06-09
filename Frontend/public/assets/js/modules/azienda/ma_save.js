/**
 * MA SAVE (V1.0)
 * Salvataggio, cancellazione azienda e resize immagini.
 * Estratto da modifica_azienda.js (righe 634–791).
 *
 * Import graph: ma_state, firebase, storage, security-manager, dom-utils, ui-core, utils, translations
 */

import { state } from './ma_state.js';
import { db, storage } from '../../firebase-config.js';
import { doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";
import { createElement, setChildren } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { encrypt, ensureMasterKey } from '../core/security-manager.js';

// ─── SAVE ─────────────────────────────────────────────────────────────────────

export async function saveAzienda() {
    const ragioneSociale = document.getElementById('ragione-sociale')?.value.trim();
    if (!ragioneSociale) { showToast(t('error_missing_company_name'), "error"); return; }

    const btn = document.getElementById('btn-save');
    if (btn) {
        btn.disabled = true;
        setChildren(btn, createElement('span', { className: 'material-symbols-outlined animate-spin text-sm', textContent: 'sync' }));
    }

    // 🔐 PROTOCOLLO BLINDA: Crittografia Dati Sensibili
    let masterKey;
    try {
        masterKey = await ensureMasterKey();
    } catch (e) {
        showToast("Accesso negato: Chiave di crittografia richiesta.", "error");
        if (btn) {
            btn.disabled = false;
            setChildren(btn, createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }));
        }
        return;
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

        const data = {
            ragioneSociale,
            tipoSedeLegale: document.getElementById('tipo-sede-legale')?.value.trim() || 'Sede Legale',
            telefonoAzienda: document.getElementById('telefono-azienda')?.value.trim(),
            faxAzienda: document.getElementById('fax-azienda')?.value.trim(),
            partitaIva: document.getElementById('piva')?.value.trim(),
            formaGiuridica: document.getElementById('forma-giuridica')?.value.trim() || '',
            referenteTitolo: document.getElementById('referente-ruolo')?.value.trim() || '',
            referenteNome: document.getElementById('referente-nome')?.value.trim() || '',
            referenteCognome: document.getElementById('referente-cognome')?.value.trim() || '',
            referenteCellulare: document.getElementById('referente-cellulare')?.value.trim() || '',
            indirizzoSede: document.getElementById('indirizzo')?.value.trim() || '',
            civicoSede: document.getElementById('civico')?.value.trim() || '',
            cittaSede: document.getElementById('citta')?.value.trim() || '',
            provinciaSede: document.getElementById('provincia')?.value.trim().toUpperCase() || '',
            capSede: document.getElementById('cap')?.value.trim() || '',
            numeroCCIAA: document.getElementById('cciaa')?.value.trim() || '',
            dataIscrizione: document.getElementById('data-iscrizione')?.value || '',
            emails: {
                pec: document.getElementById('type-pec') ? {
                    tipo: document.getElementById('type-pec').value.trim(),
                    email: document.getElementById('email-pec')?.value.trim(),
                    password: await encrypt(document.getElementById('email-pec-password')?.value.trim() || '', masterKey),
                    note: document.getElementById('email-pec-note')?.value.trim()
                } : null,
                amministrazione: document.getElementById('type-amministrazione') ? {
                    tipo: document.getElementById('type-amministrazione').value.trim(),
                    email: document.getElementById('email-amministrazione')?.value.trim(),
                    password: await encrypt(document.getElementById('email-amministrazione-password')?.value.trim() || '', masterKey),
                    note: document.getElementById('email-amministrazione-note')?.value.trim()
                } : null,
                personale: document.getElementById('type-personale') ? {
                    tipo: document.getElementById('type-personale').value.trim(),
                    email: document.getElementById('email-personale')?.value.trim(),
                    password: await encrypt(document.getElementById('email-personale-password')?.value.trim() || '', masterKey),
                    note: document.getElementById('email-personale-note')?.value.trim()
                } : null,
                extra: await Promise.all(
                    Array.from(document.querySelectorAll('.email-extra-item')).map(async el => ({
                        tipo: el.querySelector('.email-type')?.value.trim(),
                        email: el.querySelector('.email-value')?.value.trim(),
                        password: await encrypt(el.querySelector('.email-pass')?.value.trim() || '', masterKey),
                        note: el.querySelector('.email-note')?.value.trim(),
                        qr: el.querySelector('.email-qr')?.checked
                    }))
                )
            },
            note: await encrypt(document.getElementById('note-azienda')?.value.trim() || '', masterKey),
            qrConfig,
            altreSedi,
            updatedAt: serverTimestamp(),
            _encrypted: true
        };

        if (!state.currentAziendaId) {
            data.createdAt = serverTimestamp();
            data.colorIndex = Math.floor(Math.random() * 10);
        }

        // Logo & Photo
        const logoSrc = document.getElementById('logo-preview')?.src;
        if (logoSrc?.startsWith('data:')) data.logo = await resizeImage(logoSrc, 400);
        const refSrc = document.getElementById('referente-photo-preview')?.src;
        if (refSrc?.startsWith('data:')) data.referentePhoto = await resizeImage(refSrc, 300);

        // Upload nuovi allegati
        const newAtt = [];
        for (const file of state.selectedFiles) {
            const sRef = ref(storage, `users/${state.currentUid}/aziende_allegati/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(sRef, file);
            const url = await getDownloadURL(snap.ref);
            newAtt.push({ name: file.name, url, type: file.type, size: file.size, date: new Date().toISOString() });
        }
        data.allegati = [...state.existingAttachments, ...newAtt];

        if (state.currentAziendaId) {
            await updateDoc(doc(db, "users", state.currentUid, "aziende", state.currentAziendaId), data);
            showToast(t('success_save') || "Azienda salvata con successo!", "success");
            setTimeout(() => window.location.href = `dati_azienda.html?id=${state.currentAziendaId}`, 1000);
        } else {
            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
            const colRef = collection(db, "users", state.currentUid, "aziende");
            const newDoc = await addDoc(colRef, data);
            showToast(t('success_save') || "Azienda creata con successo!", "success");
            setTimeout(() => window.location.href = `dati_azienda.html?id=${newDoc.id}`, 1000);
        }
    } catch (e) {
        logError("Save", e);
        showToast(t('error_generic'), "error");
        if (btn) {
            btn.disabled = false;
            setChildren(btn, createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }));
        }
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteAzienda() {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg') || "Eliminare definitivamente l'azienda?")) return;
    try {
        await deleteDoc(doc(db, "users", state.currentUid, "aziende", state.currentAziendaId));
        showToast(t('success_deleted'), "success");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1000);
    } catch (e) { logError("Delete", e); showToast(t('error_generic'), "error"); }
}

// ─── RESIZE IMAGE ─────────────────────────────────────────────────────────────

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
