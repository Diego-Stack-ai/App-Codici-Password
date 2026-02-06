import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            currentUser = user;
        }
    });

    // 1. Iniezione Azioni nel Footer
    const interval = setInterval(() => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight) {
            clearInterval(interval);
            footerRight.innerHTML = `
                <button id="btn-save-azienda" class="base-btn-primary flex-center-gap" title="Salva Azienda">
                    <span class="material-symbols-outlined">save</span>
                    <span data-t="save_company">Salva Azienda</span>
                </button>
            `;
            setupSaveListener();
        }
    }, 100);

    // 2. Gestione Logo Preview
    const logoContainer = document.getElementById('logo-container');
    const inputLogo = document.getElementById('input-logo');
    if (logoContainer && inputLogo) {
        logoContainer.addEventListener('click', () => inputLogo.click());
        inputLogo.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('logo-preview');
                    const placeholder = document.getElementById('logo-placeholder');
                    preview.src = event.target.result;
                    preview.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 3. Gestione Sezioni Collassabili
    document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const targetId = trigger.dataset.target;
            const target = document.getElementById(targetId);
            const chevron = trigger.querySelector('.chevron');

            if (target) {
                const isHidden = target.classList.contains('hidden');
                target.classList.toggle('hidden');
                trigger.classList.toggle('active');

                if (chevron) {
                    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            }
        });
    });

    // 4. Toggle Password Visibility
    document.querySelectorAll('.btn-toggle-pass').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('span');

            if (input) {
                input.classList.toggle('base-shield');
                icon.textContent = input.classList.contains('base-shield') ? 'visibility' : 'visibility_off';
            }
        });
    });
});

function setupSaveListener() {
    const btnSave = document.getElementById('btn-save-azienda');
    if (!btnSave) return;

    btnSave.addEventListener('click', async () => {
        if (!auth.currentUser) return;

        const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

        const ragioneSociale = getValue('ragione-sociale');
        const pIva = getValue('piva');

        if (!ragioneSociale) return showToast("Inserisci la Ragione Sociale.", "error");
        if (!pIva) return showToast("Inserisci la Partita IVA.", "error");

        // QR Config
        const qrConfig = {};
        document.querySelectorAll('input[data-qr-field]').forEach(cb => {
            qrConfig[cb.dataset.qrField] = cb.checked;
        });

        // Logo
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
            // Email secondarie
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
            btnSave.disabled = true;
            btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin text-xl">progress_activity</span>`;

            const colRef = collection(db, "users", auth.currentUser.uid, "aziende");
            await addDoc(colRef, data);

            showToast("Azienda salvata con successo!", "success");
            setTimeout(() => window.location.href = 'lista_aziende.html', 1000);

        } catch (error) {
            console.error(error);
            showToast("Errore: " + error.message, "error");
            btnSave.disabled = false;
            btnSave.innerHTML = `<span class="material-symbols-outlined">save</span> <span data-t="save_company">Salva Azienda</span>`;
        }
    });
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
