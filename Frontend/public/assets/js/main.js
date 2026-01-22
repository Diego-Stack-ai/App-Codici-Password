/**
 * Genera l'HTML per un'icona account di default moderna e vibrante.
 * @param {string} name - Il nome dell'account.
 * @param {string} sizeClass - Classi Tailwind per la dimensione (es. 'h-10 w-10').
 * @returns {string} HTML dell'icona.
 */
window.getAccountIcon = function (name, sizeClass = 'h-10 w-10') {
    const nameClean = name || 'Account';
    const gradients = [
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-purple-500 to-indigo-600',
        'from-orange-500 to-red-600',
        'from-pink-500 to-rose-600',
        'from-cyan-500 to-blue-600',
        'from-indigo-500 to-violet-600'
    ];

    // Hash-based selection
    let hash = 0;
    for (let i = 0; i < nameClean.length; i++) {
        hash = nameClean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradient = gradients[Math.abs(hash) % gradients.length];
    const initial = nameClean.charAt(0).toUpperCase();

    // Determina dimensione font
    const isSmall = sizeClass.includes('h-8') || sizeClass.includes('h-6');
    const fontSize = isSmall ? 'text-[12px]' : 'text-[16px]';

    return `
        <div class="${sizeClass} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shadow-sm border border-white/20 overflow-hidden shrink-0">
            <span class="${fontSize} uppercase tracking-tighter">${initial}</span>
        </div>`;
};

/**
 * Funzioni globali per utilità UI
 */
window.makeCall = function (number) {
    if (!number || number === '-' || number === '') return;
    // Remove spaces, dashes, etc. for the tel link
    const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
    window.location.href = `tel:${cleanNumber}`;
};

window.copyText = function (text, buttonElement) {
    if (!text || text === '-' || text === '') return;
    navigator.clipboard.writeText(text).then(() => {
        if (buttonElement && buttonElement.querySelector) {
            const icon = buttonElement.querySelector('.material-symbols-outlined');
            if (icon) {
                const originalIcon = icon.textContent;
                icon.textContent = 'done';
                setTimeout(() => {
                    icon.textContent = originalIcon;
                }, 1500);
            }
        }
        window.showToast('Copiato!');
    }).catch(err => console.error('Copy Error:', err));
};

/**
 * Mostra un messaggio toast universale
 */
window.showToast = function (message, type = 'success') {
    let toast = document.getElementById('toast') || document.getElementById('toast-container');
    if (!toast) return;

    const msgEl = document.getElementById('toast-message') || toast;
    const iconEl = document.getElementById('toast-icon');

    if (msgEl) msgEl.textContent = message;

    if (iconEl) {
        iconEl.textContent = type === 'error' ? 'error' : 'check_circle';
        iconEl.className = `material-symbols-outlined text-xl ${type === 'error' ? 'text-red-400' : 'text-green-400'}`;
    }

    toast.classList.remove('opacity-0', 'translate-y-10', 'hidden');
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
};

/**
 * Formatta data da YYYY-MM-DD a DD/MM/YYYY
 */
window.formatDateToIT = function (dateString) {
    if (!dateString) return '-';
    if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
};

document.addEventListener('DOMContentLoaded', function () {

    // Funzione di navigazione (deprecata, ma mantenuta per retrocompatibilità se necessario)
    window.navigateTo = function (page) {
        window.location.href = `${page}.html`;
    };

    // 1. Gestione Toggle Password
    function setupPasswordToggles() {
        const togglePasswordButtons = document.querySelectorAll('.toggle-password');
        togglePasswordButtons.forEach(button => {
            button.addEventListener('click', function () {
                const passwordInput = this.previousElementSibling;
                if (passwordInput && (passwordInput.type === 'password' || passwordInput.type === 'text')) {
                    const isPassword = passwordInput.type === 'password';
                    passwordInput.type = isPassword ? 'text' : 'password';
                    const icon = this.querySelector('.material-symbols-outlined');
                    if (icon) icon.textContent = isPassword ? 'visibility_off' : 'visibility';
                }
            });
        });
    }

    // 2. Gestione Copia negli Appunti
    function setupCopyButtons() {
        // Support both classes: .copy-button (legacy/privato) and .copy-btn (new/azienda)
        const copyButtons = document.querySelectorAll('.copy-button, .copy-btn');
        copyButtons.forEach(button => {
            // Remove old listeners to prevent duplicates if function called multiple times
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                // DATA ATTRIBUTE: data-copy-target
                const targetId = this.dataset.copyTarget; // CamelCase for data-copy-target
                if (targetId) {
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        const valueToCopy = targetElement.value || targetElement.textContent;
                        if (valueToCopy && valueToCopy !== '-') {
                            navigator.clipboard.writeText(valueToCopy).then(() => {
                                // Feedback
                                const icon = this.querySelector('.material-symbols-outlined');
                                if (icon) {
                                    const originalIcon = icon.textContent;
                                    icon.textContent = 'done';
                                    setTimeout(() => {
                                        icon.textContent = originalIcon;
                                    }, 1500);
                                }
                                // Try to use toast if available
                                if (typeof showToast === 'function') {
                                    showToast('Copiato!');
                                }
                            }).catch(err => console.error('Copy Error:', err));
                        }
                    }
                }
            });
        });
    }

    // 2.1 Gestione Chiamate (New)
    function setupCallButtons() {
        const callButtons = document.querySelectorAll('.call-button');
        callButtons.forEach(button => {
            button.onclick = (e) => {
                e.stopPropagation();
                const sourceId = button.getAttribute('data-call-source');
                const sourceEl = document.getElementById(sourceId);
                if (sourceEl) {
                    const phoneNumber = sourceEl.textContent.trim();
                    if (phoneNumber && phoneNumber !== '-') {
                        window.location.href = `tel:${phoneNumber.replace(/\s/g, '')}`;
                    }
                }
            };
        });
    }

    // 3. Gestione Schede Espandibili (account_privati.html)
    function setupAccountCards() {
        const accountCards = document.querySelectorAll('.account-card');
        accountCards.forEach(card => {
            const header = card.querySelector('.account-header');
            if (!header) return; // Skip if it's the new simplified card

            const body = card.querySelector('.account-body');
            const icon = header.querySelector('.expand-icon');

            header.addEventListener('click', () => {
                if (body) body.classList.toggle('hidden');
                if (icon) icon.classList.toggle('rotate-180');
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
            uiToggle.addEventListener('change', function () {
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
                    canvas.toBlob(function (blob) {
                        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
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

    // Init Call Buttons
    setupCallButtons();
});
