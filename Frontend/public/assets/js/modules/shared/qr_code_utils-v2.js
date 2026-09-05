// QR Code Utility Module (shared)
// Centralizes QR code generation and vCard construction for user profile/settings

/**
 * Dynamically loads the QRCode library if not already loaded.
 * @returns {Promise<void>}
 */
export async function ensureQRCodeLib() {
    if (typeof QRCode === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'assets/js/vendor/qrcode.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}
/**
 * Builds a vCard string from user data and inclusion config.
 * @param {Object} userData - User data object
 * @param {Object} inclusions - Fields to include (profilo_privato: qrCodeInclusions, impostazioni: qr_personal)
 * @param {Object} [options] - Optional: {contactPhones, contactEmails, userAddresses}
 * @returns {string} vCard string
 */
export function buildVCard(userData, inclusions, options = {}) {
    let v = ["BEGIN:VCARD", "VERSION:3.0"];
    const escapeVCard = (value) => String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');
    const selected = (items, references) => (Array.isArray(references) ? references : [])
        .map(reference => typeof reference === 'number'
            ? items[reference]
            : items.find(item => String(item?.id) === String(reference)))
        .filter(Boolean);
    const nome = inclusions.nome ? (userData.nome || '') : '';
    const cognome = inclusions.nome || inclusions.cognome ? (userData.cognome || '') : '';
    if (nome || cognome) {
        v.push(`N:${escapeVCard(cognome)};${escapeVCard(nome)};;;`);
        v.push(`FN:${escapeVCard(`${nome} ${cognome}`.trim())}`);
    }
    const fiscalCode = userData.cf || (userData.documenti || []).find(item =>
        String(item?.type || '').toLowerCase().includes('fiscale'))?.cf_value ||
        (userData.documenti || []).find(item => String(item?.type || '').toLowerCase().includes('fiscale'))?.num_serie;
    if (inclusions.cf && fiscalCode) {
        v.push(`X-CF:${escapeVCard(fiscalCode)}`);
    }
    if (inclusions.nascita && userData.birth_date) {
        v.push(`BDAY:${userData.birth_date}`);
        if (userData.birth_place) v.push(`X-BIRTHPLACE:${escapeVCard(userData.birth_place)}`);
    }
    // Phones
    if (Array.isArray(options.contactPhones) && Array.isArray(inclusions.phones)) {
        selected(options.contactPhones, inclusions.phones).forEach(p => {
            if (p.number) v.push(`TEL:${escapeVCard(p.number)}`);
        });
    }
    // Emails
    if (Array.isArray(options.contactEmails) && Array.isArray(inclusions.emails)) {
        selected(options.contactEmails, inclusions.emails).forEach(e => {
            if (e.address) v.push(`EMAIL:${escapeVCard(e.address)}`);
        });
    }
    // Addresses
    if (Array.isArray(options.userAddresses) && Array.isArray(inclusions.addresses)) {
        selected(options.userAddresses, inclusions.addresses).forEach(a => {
            if (a.address) v.push(`ADR:;;${escapeVCard(`${a.address} ${a.civic || ''}`.trim())};${escapeVCard(a.city)};;${escapeVCard(a.cap)};`);
        });
    }
    // impostazioni.js style (qr_personal)
    if (inclusions.contactPhones && Array.isArray(userData.contactPhones)) {
        userData.contactPhones.forEach(p => { if (p.shareQr && p.number) v.push(`TEL;TYPE=CELL:${p.number}`); });
    }
    if (inclusions.contactEmails && Array.isArray(userData.contactEmails)) {
        userData.contactEmails.forEach(e => { if (e.shareQr && e.address) v.push(`EMAIL;TYPE=INTERNET:${e.address}`); });
    }
    if (Array.isArray(options.customFields)) {
        options.customFields.filter(field => field?.includeInQr === true && field.encrypted !== true)
            .sort((a, b) => (a.qrOrder || 0) - (b.qrOrder || 0))
            .forEach(field => {
                const value = escapeVCard(field.value || '');
                if (!value) return;
                if (field.type === 'phone') v.push(`TEL:${value}`);
                else if (field.type === 'email') v.push(`EMAIL:${value}`);
                else if (field.type === 'url') v.push(`URL:${value}`);
                else v.push(`NOTE:${escapeVCard(field.qrLabel || field.label)}: ${value}`);
            });
    }
    v.push("END:VCARD");
    return v.join("\n");
}

/**
 * Renders a QR code into a container element.
 * @param {HTMLElement} container - The DOM element to render into
 * @param {string} text - The text to encode
 * @param {Object} options - {width, height, colorDark, colorLight, correctLevel}
 */
export function renderQRCode(container, text, options = {}) {
    if (!container || typeof QRCode === 'undefined') return;
    // Remove previous QR canvases/images
    container.querySelectorAll('canvas,img').forEach(el => el.remove());

    try {
        new QRCode(container, {
            text,
            width: options.width || 104,
            height: options.height || 104,
            colorDark: options.colorDark || '#000000',
            colorLight: options.colorLight || '#E3F2FD',
            correctLevel: options.correctLevel || (typeof QRCode.CorrectLevel !== 'undefined' ? QRCode.CorrectLevel.M : 1)
        });
    } catch (e) {
        console.error("QR Code Render Error:", e);

        // Fallback estremo: Riduci ancora correzione e aumenta padding
        try {
            new QRCode(container, {
                text,
                width: options.width || 104,
                height: options.height || 104,
                colorDark: options.colorDark || '#000000',
                colorLight: options.colorLight || '#E3F2FD',
                correctLevel: (typeof QRCode.CorrectLevel !== 'undefined' ? QRCode.CorrectLevel.L : 3)
            });
        } catch (retryError) {
            console.error("QR Code Retry Failed:", retryError);
            const message = document.createElement('div');
            message.style.cssText = 'color:red; font-size:0.75rem; text-align:center; padding:10px;';
            message.append('Dati eccessivi', document.createElement('br'), 'per il QR Code');
            container.replaceChildren(message);
            showToast("Dati eccessivi. Riduci i campi.", "warning");
        }
    }
}

