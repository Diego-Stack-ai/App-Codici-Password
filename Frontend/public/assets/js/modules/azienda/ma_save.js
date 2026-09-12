/**
 * MA SAVE (V1.0)
 * Salvataggio, cancellazione azienda e resize immagini.
 * Estratto da modifica_azienda.js (righe 634–791).
 *
 * Import graph: ma_state, firebase, storage, security-manager, dom-utils, ui-core, utils, translations
 */

import { state } from './ma_state.js';
import { db, storage } from '../../firebase-config.js?v=1.2.111';
import { doc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from "/assets/js/vendor/firebase-runtime.js";
import { ref, uploadBytes, getDownloadURL } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { encrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { createStorageObjectName, encryptAttachmentFile, validateAttachmentFile } from '../shared/attachment-security.js';

function sameContactValue(left, right) {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left), otherKeys = Object.keys(right);
    return keys.length === otherKeys.length && keys.every(key =>
        Object.hasOwn(right, key) && sameContactValue(left[key], right[key]));
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

export async function saveAzienda() {
    const ragioneSociale = document.getElementById('ragione-sociale')?.value.trim();
    if (!ragioneSociale) { showToast(t('error_missing_company_name'), "error"); return; }

    const btn = document.getElementById('btn-save');
    if (btn) {
        btn.disabled = true;
        setChildren(btn, createElement('span', { className: 'material-symbols-outlined animate-spin action-icon-compact', textContent: 'sync' }));
    }

    // 🔐 PROTOCOLLO BLINDA: Crittografia Dati Sensibili
    let vaultKeyMaterial;
    try {
        vaultKeyMaterial = await ensureVaultKeyMaterial();
    } catch (e) {
        showToast("Accesso negato: Chiave di crittografia richiesta.", "error");
        if (btn) {
            btn.disabled = false;
            setChildren(btn, createElement('span', { className: 'material-symbols-outlined', textContent: 'save' }));
        }
        return;
    }

    try {
        if (!vaultKeyMaterial) throw new Error('Sblocca il Vault prima di salvare.');
        if (state.currentAziendaId && !state.formLoaded) throw new Error('Ricarica l’azienda prima di salvare.');
        const original = state.originalCompany || {};
        const qrConfig = {...original.qrConfig};
        document.querySelectorAll('input[data-qr-field]').forEach(cb => qrConfig[cb.dataset.qrField] = cb.checked);

        const altreSedi = Array.from(document.querySelectorAll('.extra-sede-item')).map(el => ({
            ...(original.altreSedi || []).find((item,index)=>(item.id || 'sede-'+index) === el.dataset.sedeId),
            id: el.dataset.sedeId,
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
            codiceSDI: document.getElementById('codice-sdi')?.value.trim() || '',
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
                ...original.emails,
                pec: document.getElementById('type-pec') ? {
                    ...original.emails?.pec,
                    tipo: document.getElementById('type-pec').value.trim(),
                    email: document.getElementById('email-pec')?.value.trim(),
                    password: await encrypt(document.getElementById('email-pec-password')?.value || '', vaultKeyMaterial),
                    note: document.getElementById('email-pec-note')?.value.trim()
                } : null,
                amministrazione: document.getElementById('type-amministrazione') ? {
                    ...original.emails?.amministrazione,
                    tipo: document.getElementById('type-amministrazione').value.trim(),
                    email: document.getElementById('email-amministrazione')?.value.trim(),
                    password: await encrypt(document.getElementById('email-amministrazione-password')?.value.trim() || '', vaultKeyMaterial),
                    note: document.getElementById('email-amministrazione-note')?.value.trim()
                } : null,
                personale: document.getElementById('type-personale') ? {
                    ...original.emails?.personale,
                    tipo: document.getElementById('type-personale').value.trim(),
                    email: document.getElementById('email-personale')?.value.trim(),
                    password: await encrypt(document.getElementById('email-personale-password')?.value.trim() || '', vaultKeyMaterial),
                    note: document.getElementById('email-personale-note')?.value.trim()
                } : null,
                extra: await Promise.all(
                    Array.from(document.querySelectorAll('.email-extra-item')).map(async el => ({
                        ...(original.emails?.extra || []).find((item,index) => (item.id || 'extra-' + index) === el.dataset.contactId),
                        id: el.dataset.contactId,
                        tipo: el.querySelector('.email-type')?.value.trim(),
                        email: el.querySelector('.email-value')?.value.trim(),
                        password: await encrypt(el.querySelector('.email-pass')?.value.trim() || '', vaultKeyMaterial),
                        note: el.querySelector('.email-note')?.value.trim(),
                        qr: el.querySelector('.email-qr')?.checked
                    }))
                )
            },
            note: await encrypt(document.getElementById('note-azienda')?.value.trim() || '', vaultKeyMaterial),
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
            validateAttachmentFile(file);
            const storagePath = `users/${state.currentUid}/aziende_allegati/${createStorageObjectName(file)}`;
            const sRef = ref(storage, storagePath);
            const encryptedFile = await encryptAttachmentFile(file, vaultKeyMaterial);
            const snap = await uploadBytes(sRef, encryptedFile.blob, {
                contentType: 'application/octet-stream', customMetadata: { encrypted: 'v1' }
            });
            const url = await getDownloadURL(snap.ref);
            newAtt.push({
                name: file.name, url, storagePath, type: file.type, size: file.size,
                encryption: encryptedFile.metadata, date: new Date().toISOString()
            });
        }
        data.allegati = [...state.existingAttachments, ...newAtt];

        if (state.currentAziendaId) {
            await runTransaction(db, async transaction => {
                const ref = doc(db, 'users', state.currentUid, 'aziende', state.currentAziendaId);
                const snap = await transaction.get(ref);
                if (!snap.exists()) throw new Error('Azienda non disponibile');
                const current = snap.data();
                for (const key of ['emails', 'aziendaEmail', 'aziendaEmailPassword', 'phoneAccountLinks', 'telefonoAzienda', 'faxAzienda', 'referenteCellulare']) {
                    if (!sameContactValue(current[key] ?? null, original[key] ?? null)) throw new Error('Contatti modificati: ricarica prima di salvare.');
                }
                const oldContacts = [original.emails?.pec, original.emails?.amministrazione, original.emails?.personale, ...(original.emails?.extra || [])].filter(Boolean);
                const newContacts = [data.emails.pec, data.emails.amministrazione, data.emails.personale, ...data.emails.extra].filter(Boolean);
                if (oldContacts.some(old => old.linkedAccountId && !newContacts.some(item => item.linkedAccountId === old.linkedAccountId && item.email === old.email))) throw new Error('Scollega l’Account prima di eliminare o cambiare l’email.');
                for (const field of ['telefonoAzienda','faxAzienda','referenteCellulare']) {
                    if (original.phoneAccountLinks?.[field]?.linkedAccountId && data[field] !== (original[field] || '')) throw new Error('Scollega l’Account prima di cambiare il telefono.');
                }
                transaction.update(ref, data);
            });
            showToast(t('success_save') || "Azienda salvata con successo!", "success");
            window.location.replace(`dati_azienda.html?id=${state.currentAziendaId}&afterWrite=1`);
        } else {
            const { collection, addDoc } = await import("/assets/js/vendor/firebase-runtime.js");
            const colRef = collection(db, "users", state.currentUid, "aziende");
            const newDoc = await addDoc(colRef, data);
            showToast(t('success_save') || "Azienda creata con successo!", "success");
            window.location.replace(`dati_azienda.html?id=${newDoc.id}&afterWrite=1`);
        }
    } catch (e) {
        logError("Save", e);
        showToast(e.message?.startsWith('Scollega') || e.message?.startsWith('Contatti modificati') ? e.message : t('error_generic'), "error");
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
