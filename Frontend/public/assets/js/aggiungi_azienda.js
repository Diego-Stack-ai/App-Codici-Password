// Script estratto da aggiungi_nuova_azienda.html
// Gestione salvataggio nuova azienda e logica UI relativa
// Refactored for Firebase Modular SDK (v11)

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- UI TOAST ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast) return;

    msgEl.textContent = message;

    // Reset classes
    iconEl.className = "material-symbols-outlined text-xl";

    if (type === 'error') {
        iconEl.textContent = 'error';
        iconEl.classList.add('text-red-400');
    } else {
        iconEl.textContent = 'check_circle';
        iconEl.classList.add('text-green-400');
    }

    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded (Modular Mode) - External Script");

    // Toggle logic for sections
    window.toggleLocationSection = function (sectionId) {
        const section = document.getElementById(sectionId);
        const arrow = document.getElementById(`arrow-${sectionId}`);
        if (!section) return;

        const isExpanded = section.style.maxHeight && section.style.maxHeight !== '0px';

        if (isExpanded) {
            section.style.maxHeight = '0px';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        } else {
            section.style.maxHeight = '1000px';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    };

    const btnSave = document.getElementById('btn-save-azienda');
    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            console.log("Logged in:", user.uid);
        } else {
            console.log("Not logged in");
        }
    });


    // Logo Preview Function (Global to be accessible by inline onchange)
    window.previewLogo = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('logo-preview').src = e.target.result;
                document.getElementById('logo-preview').classList.remove('hidden');
                document.getElementById('logo-placeholder').classList.add('hidden');
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.previewReferentePhoto = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('referente-photo-preview').src = e.target.result;
                document.getElementById('referente-photo-preview').classList.remove('hidden');
                document.getElementById('referente-photo-placeholder').classList.add('hidden');
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    // Helper Toggle Password
    window.togglePasswordVisibility = function (id) {
        const input = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (!input) return;

        input.classList.toggle('titanium-shield');
        if (input.classList.contains('titanium-shield')) {
            if (icon) icon.textContent = 'visibility';
        } else {
            if (icon) icon.textContent = 'visibility_off';
        }
    };

    // Helper to copy to clipboard
    window.copyToClipboard = function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        const text = el.value || el.innerText;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copiato negli appunti!");
        }).catch(err => {
            console.error("Errore copia:", err);
        });
    };

    // Helper to resize image
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

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            if (!currentUser) {
                showToast("Devi essere loggato per salvare.", "error");
                return;
            }

            // Helpers
            const getValue = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            // Data Gathering
            const ragioneSociale = getValue('ragione-sociale');
            const pIva = getValue('piva');

            // Validation
            if (!ragioneSociale) {
                showToast("Inserisci la Ragione Sociale.", "error");
                return;
            }
            if (!pIva) {
                showToast("Inserisci la Partita IVA.", "error");
                return;
            }

            // Collect QR Config
            const qrConfig = {};
            document.querySelectorAll('input[data-qr-field]').forEach(cb => {
                const field = cb.getAttribute('data-qr-field');
                if (field) qrConfig[field] = cb.checked;
            });

            // Handle Photos
            let logoBase64 = null;
            const logoPreview = document.getElementById('logo-preview');
            if (logoPreview && !logoPreview.classList.contains('hidden') && logoPreview.src.startsWith('data:')) {
                logoBase64 = await resizeImage(logoPreview.src, 400);
            }

            let referentePhotoBase64 = null;
            const refPreview = document.getElementById('referente-photo-preview');
            if (refPreview && !refPreview.classList.contains('hidden') && refPreview.src.startsWith('data:')) {
                referentePhotoBase64 = await resizeImage(refPreview.src, 300);
            }

            // Assign Random Color Index (0-9)
            const randomColorIndex = Math.floor(Math.random() * 10);

            // Collect Altre Sedi (Fixed Groups)
            const altreSedi = [];
            const types = [
                { id: 'admin', tipo: 'Sede Amministrativa' },
                { id: 'oper', tipo: 'Sede Operativa' },
                { id: 'comm', tipo: 'Sede Commerciale' }
            ];

            types.forEach(t => {
                const addr = getValue(`${t.id}-indirizzo`);
                if (addr) {
                    altreSedi.push({
                        tipo: t.tipo,
                        indirizzo: addr,
                        civico: getValue(`${t.id}-civico`),
                        citta: getValue(`${t.id}-citta`),
                        provincia: getValue(`${t.id}-provincia`).toUpperCase(),
                        cap: getValue(`${t.id}-cap`)
                    });
                }
            });

            const emails = {
                pec: {
                    email: getValue('email-pec'),
                    password: getValue('email-pec-password'),
                    note: getValue('email-pec-note')
                },
                amministrazione: {
                    email: getValue('email-amministrazione'),
                    password: getValue('email-amministrazione-password'),
                    note: getValue('email-amministrazione-note')
                },
                personale: {
                    email: getValue('email-personale'),
                    password: getValue('email-personale-password'),
                    note: getValue('email-personale-note')
                },
                manutenzione: {
                    email: getValue('email-manutenzione'),
                    password: getValue('email-manutenzione-password'),
                    note: getValue('email-manutenzione-note')
                },
                attrezzatura: {
                    email: getValue('email-attrezzatura'),
                    password: getValue('email-attrezzatura-password'),
                    note: getValue('email-attrezzatura-note')
                },
                magazzino: {
                    email: getValue('email-magazzino'),
                    password: getValue('email-magazzino-password'),
                    note: getValue('email-magazzino-note')
                }
            };

            const aziendaData = {
                ragioneSociale,
                partitaIva: pIva,
                codiceSDI: getValue('codice-sdi').toUpperCase(),
                referenteTitolo: getValue('referente-titolo'),
                referenteNome: getValue('referente-nome'),
                referenteCognome: getValue('referente-cognome'),
                referenteCellulare: getValue('referente-cellulare'),
                referentePhoto: referentePhotoBase64,
                indirizzoSede: getValue('indirizzo'),
                civicoSede: getValue('civico'),
                cittaSede: getValue('citta'),
                provinciaSede: getValue('provincia').toUpperCase(),
                capSede: getValue('cap'),
                numeroCCIAA: getValue('numero-cciaa'),
                dataIscrizione: getValue('data-iscrizione'),
                telefonoAzienda: getValue('telefono-azienda'),
                faxAzienda: getValue('fax-azienda'),
                // Primary Email Fields (for backward compatibility and QR)
                aziendaEmail: emails.pec.email,
                aziendaEmailPassword: emails.pec.password,
                aziendaEmailPasswordNote: emails.pec.note,
                // Full categorical emails
                emails: emails,
                note: getValue('note-azienda'),
                logo: logoBase64,
                qrConfig: qrConfig,
                colorIndex: randomColorIndex,
                altreSedi: altreSedi,
                createdAt: serverTimestamp()
            };

            try {
                btnSave.disabled = true;
                btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin text-xl mr-2">progress_activity</span> Salvataggio...`;

                // Modular SDK: addDoc(collection(...), data)
                const colRef = collection(db, "users", currentUser.uid, "aziende");
                await addDoc(colRef, aziendaData);

                showToast("Azienda salvata con successo!");
                setTimeout(() => window.location.href = 'lista_aziende.html', 1000);

            } catch (error) {
                console.error("Salvataggio fallito:", error);
                showToast("Errore salvataggio: " + error.message, "error");
                btnSave.disabled = false;
                btnSave.innerText = "Salva Azienda";
            }
        });
    } else {
        alert("CRITICAL: Save button not found!");
    }
});
