/**
 * PROTOCOLLO BASE UI PAGES
 * Gestisce la logica specifica per singole sezioni o pagine dell'app
 */

/**
 * [PAGE: ACCOUNT PRIVATI] GESTIONE CARD ESPANDIBILI
 */
export function setupAccountCards() {
    const cards = document.querySelectorAll('.account-card');
    cards.forEach(card => {
        const header = card.querySelector('.account-header');
        if (!header) return;

        const body = card.querySelector('.account-body');
        const icon = header.querySelector('.expand-icon');

        header.addEventListener('click', () => {
            if (body) body.classList.toggle('hidden');
            if (icon) icon.classList.toggle('rotate-180');
        });
    });
}

/**
 * [PAGE: DATI ANAGRAFICI] GESTIONE MODALITÀ MODIFICA
 */
export function setupEditMode() {
    const editButton = document.getElementById('edit-button');
    if (!editButton) return;

    const viewElements = document.querySelectorAll('[id$="-view"]');
    const editElements = document.querySelectorAll('[id$="-edit"]');
    const editActions = document.getElementById('edit-actions');
    const cancelButton = document.getElementById('cancel-button');

    const toggleEdit = (isEditing) => {
        viewElements.forEach(el => el.classList.toggle('hidden', isEditing));
        editElements.forEach(el => el.classList.toggle('hidden', !isEditing));
        editButton.classList.toggle('hidden', isEditing);
        if (editActions) editActions.classList.toggle('hidden', !isEditing);
    };

    editButton.addEventListener('click', () => toggleEdit(true));
    if (cancelButton) cancelButton.addEventListener('click', () => toggleEdit(false));
}

/**
 * [PAGE: DETTAGLIO ACCOUNT] GESTIONE QR CODE E VISTA DETTAGLIO
 */
export function setupAccountDetailView() {
    const uiToggle = document.getElementById('ui-toggle');
    if (uiToggle) {
        const detailGroups = document.querySelectorAll('.form-group-aperta');
        uiToggle.addEventListener('change', function () {
            detailGroups.forEach(group => group.classList.toggle('hidden', this.checked));
        });
    }

    // QR Code logic if container exists
    const qrcodeContainer = document.getElementById('qrcode');
    if (qrcodeContainer && typeof QRCode !== 'undefined') {
        const dataToEncode = qrcodeContainer.dataset.content || "No Data";
        new QRCode(qrcodeContainer, {
            text: dataToEncode,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#E3F2FD",
            correctLevel: QRCode.CorrectLevel.M
        });
    }
}

/**
 * [PAGE: DETTAGLIO ACCOUNT] COPIA QR CODE NEGLI APPUNTI
 */
export function setupCopyQrCode() {
    const copyQrButton = document.getElementById('copy-qr-button');
    if (!copyQrButton) return;

    copyQrButton.addEventListener('click', () => {
        const canvas = document.querySelector('#qrcode canvas');
        if (canvas) {
            canvas.toBlob(blob => {
                const item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item])
                    .then(() => {
                        if (window.showToast) window.showToast('Immagine QR Copiata!');
                    })
                    .catch(err => console.error('QR Copy failed', err));
            });
        }
    });
}
