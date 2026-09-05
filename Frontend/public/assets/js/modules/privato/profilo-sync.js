/**
 * PROFILO PRIVATO — SYNC MODULE (V1.0)
 * Salvataggio cifrato dei dati del profilo utente su Firestore.
 * Estratto da profilo_privato.js per isolare la logica di crittografia.
 *
 * PATTERN: riceve i dati correnti come parametri espliciti (no stato globale).
 * Il modulo chiamante (profilo_privato.js) usa un wrapper locale che inietta
 * automaticamente le variabili di stato correnti.
 *
 * Import graph (no circular deps):
 *   profilo_privato.js → profilo-sync.js → firebase, security-manager, utils
 */

import { auth, db } from '../../firebase-config.js?v=1.2.40';
import { doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { encrypt, ensureMasterKey } from '../core/security-manager.js';
import { LOG } from '../../logger.js';

/**
 * Salvataggio cifrato di tutti i dati del profilo su Firestore (Vault V6.1).
 * Cifra selettivamente i campi sensibili usando la MasterKey.
 * I dati passati come parametri sono già sanificati dal chiamante.
 *
 * @param {Object} params
 * @param {string} params.currentUserUid
 * @param {Object} params.currentUserData
 * @param {Array}  params.userAddresses
 * @param {Array}  params.contactPhones
 * @param {Array}  params.contactEmails
 * @param {Array}  params.userDocuments
 */
export async function syncData({ currentUserUid, currentUserData, userAddresses, contactPhones, contactEmails, userDocuments }) {
    LOG("[VaultCheck] Avvio sincronizzazione protetta...");
    try {
        const user = auth.currentUser;
        if (!user) {
            showToast("Sessione scaduta: ricarica la pagina.", "error");
            return;
        }

        const masterKey = await ensureMasterKey();
        if (!masterKey) {
            showToast("Chiave Master mancante: impossibile cifrare.", "error");
            return;
        }

        LOG("[VaultCheck] Cifratura in corso...");

        // Cifratura Documenti (Selective Encryption V7.5)
        const encryptedDocuments = await Promise.all((userDocuments || []).map(async d => {
            const enc = { ...d };
            const fields = [
                'num_serie', 'cf_value', 'id_number', 'license_number', 'cf',
                'rilasciato_da', 'luogo_rilascio', 'username', 'password',
                'pin', 'puk', 'codice_app', 'note', 'categoria', 'home_page'
            ];
            for (const f of fields) {
                if (enc[f]) enc[f] = await encrypt(enc[f] || '', masterKey);
            }
            return enc;
        }));

        // Cifratura Email (Selective: solo password e note)
        const encryptedEmails = await Promise.all((contactEmails || []).map(async e => ({
            ...e,
            password: await encrypt(e.password || '', masterKey),
            note: await encrypt(e.note || '', masterKey)
        })));

        // Cifratura Indirizzi (V7.5: Indirizzo in chiaro, solo Utenze cifrate)
        const encryptedAddresses = await Promise.all((userAddresses || []).map(async a => ({
            ...a,
            // address, civic, city, cap, province rimangono in chiaro
            utilities: await Promise.all((a.utilities || []).map(async u => ({
                ...u,
                value: await encrypt(u.value || '', masterKey)
            })))
        })));

        // Cifratura Telefoni (V7.5: Numero in chiaro)
        const encryptedPhones = [...(contactPhones || [])];

        // Commit finale su Firestore
        const finalUpdate = {
            nome: currentUserData.nome || '',               // V7.5 In Chiaro
            cognome: currentUserData.cognome || '',         // V7.5 In Chiaro
            birth_date: currentUserData.birth_date || '',   // plaintext
            birth_place: currentUserData.birth_place || '', // V7.5 In Chiaro
            birth_province: currentUserData.birth_province || '', // plaintext
            note: await encrypt(currentUserData.note || '', masterKey),
            userAddresses: encryptedAddresses,
            contactPhones: encryptedPhones,
            contactEmails: encryptedEmails,
            documenti: encryptedDocuments,
            _encrypted: true
        };

        // Rimuovi undefined residui per sicurezza Firebase
        Object.keys(finalUpdate).forEach(key => finalUpdate[key] === undefined && delete finalUpdate[key]);

        await updateDoc(doc(db, "users", user.uid), finalUpdate);

        LOG("[VaultCheck] Sincronizzazione V6.1 completata con successo.");
        showToast(t('success_save'), "success");
    } catch (e) {
        logError("SyncData", e);
        showToast("Errore di sicurezza durante il salvataggio.", "error");
    }
}
