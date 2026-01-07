document.addEventListener('DOMContentLoaded', function() {

    // Funzione di navigazione (deprecata, ma mantenuta per retrocompatibilità se necessario)
    window.navigateTo = function(page) {
        window.location.href = `${page}.html`;
    };

    // 1. Gestione Toggle Password
    function setupPasswordToggles() {
        const togglePasswordButtons = document.querySelectorAll('.toggle-password');
        togglePasswordButtons.forEach(button => {
            button.addEventListener('click', function() {
                const passwordInput = this.previousElementSibling;
                if (passwordInput && (passwordInput.type === 'password' || passwordInput.type === 'text')) {
                    const isPassword = passwordInput.type === 'password';
                    passwordInput.type = isPassword ? 'text' : 'password';
                    this.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
                }
            });
        });
    }

    // 2. Gestione Copia negli Appunti
    function setupCopyButtons() {
        const copyButtons = document.querySelectorAll('.copy-button');
        copyButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetId = this.dataset.copyTarget;
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    const valueToCopy = targetElement.value || targetElement.textContent;
                    navigator.clipboard.writeText(valueToCopy).then(() => {
                        // Feedback per l'utente (es. tooltip, cambio icona)
                        const icon = this.querySelector('.material-symbols-outlined');
                        const originalIcon = icon.textContent;
                        icon.textContent = 'done';
                        setTimeout(() => {
                            icon.textContent = originalIcon;
                        }, 1500);
                    }).catch(err => {
                        console.error('Errore durante la copia:', err);
                    });
                }
            });
        });
    }

    // 3. Gestione Schede Espandibili (account_privati.html)
    function setupAccountCards() {
        const accountCards = document.querySelectorAll('.account-card');
        accountCards.forEach(card => {
            const header = card.querySelector('.account-header');
            const body = card.querySelector('.account-body');
            const icon = header.querySelector('.expand-icon');

            header.addEventListener('click', () => {
                body.classList.toggle('hidden');
                icon.classList.toggle('rotate-180');
            });
        });
    }

    // 4. Gestione Modalità Modifica (dati_anagrafici_privato.html)
    function setupEditMode() {
        const editButton = document.getElementById('edit-button');
        const cancelButton = document.getElementById('cancel-button');
        const saveButton = document.getElementById('save-button');
        const editActions = document.getElementById('edit-actions');

        if (editButton) {
            const viewElements = document.querySelectorAll('[id$="-view"]');
            const editElements = document.querySelectorAll('[id$="-edit"]');

            const toggleEdit = (isEditing) => {
                viewElements.forEach(el => el.classList.toggle('hidden', isEditing));
                editElements.forEach(el => el.classList.toggle('hidden', !isEditing));
                editButton.classList.toggle('hidden', isEditing);
                editActions.classList.toggle('hidden', !isEditing);
            };

            editButton.addEventListener('click', () => toggleEdit(true));
            cancelButton.addEventListener('click', () => toggleEdit(false));
            saveButton.addEventListener('click', () => {
                // Qui andrebbe la logica di salvataggio
                alert('Dati salvati (simulato)');
                toggleEdit(false);
            });
        }
    }

    // 5. Gestione UI Chiusa/Aperta e QR Code (dettaglio_account_privato.html)
    function setupAccountDetailView() {
        const uiToggle = document.getElementById('ui-toggle');
        const qrcodeContainer = document.getElementById('qrcode');

        if (uiToggle) {
             const detailGroups = document.querySelectorAll('.form-group-aperta');
             uiToggle.addEventListener('change', function() {
                detailGroups.forEach(group => {
                    group.classList.toggle('hidden', this.checked);
                });
             });
        }

        if (qrcodeContainer) {
            // Simula la generazione del QR code basata sui dati dell'account
             const dataToEncode = "Username: mario.rossi@gmail.com\nPassword: SuperSecretPassword123";
             new QRCode(qrcodeContainer, {
                text: dataToEncode,
                width: 128,
                height: 128,
             });
        }
    }


    // 6. Gestione Copia QR Code
    function setupCopyQrCode() {
        const copyQrButton = document.getElementById('copy-qr-button');
        if (copyQrButton) {
            copyQrButton.addEventListener('click', () => {
                const canvas = document.querySelector('#qrcode canvas');
                if (canvas) {
                    canvas.toBlob(function(blob) {
                        navigator.clipboard.write([new ClipboardItem({'image/png': blob})])
                        .then(() => {
                            const icon = copyQrButton.querySelector('.material-symbols-outlined');
                            const originalText = copyQrButton.textContent;
                            copyQrButton.textContent = 'Copiato!';
                            setTimeout(() => {
                                copyQrButton.innerHTML = `<span class="material-symbols-outlined text-base align-middle mr-1">content_copy</span> ${originalText.trim()}`;
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('Errore durante la copia del QR code:', err);
                            alert('Impossibile copiare il QR code.');
                        });
                    }, 'image/png');
                }
            });
        }
    }

    // Inizializzazione di tutte le funzionalità
    setupPasswordToggles();
    setupCopyButtons();
    setupAccountCards();
    setupEditMode();
    setupAccountDetailView();
    setupCopyQrCode();
});
