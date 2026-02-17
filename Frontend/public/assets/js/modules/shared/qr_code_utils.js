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
    const nome = inclusions.nome ? (userData.nome || '') : '';
    const cognome = inclusions.cognome ? (userData.cognome || '') : '';
    if (nome || cognome) {
        v.push(`N:${cognome};${nome};;;`);
        v.push(`FN:${nome} ${cognome}`.trim());
    }
    if (inclusions.cf && userData.cf) {
        v.push(`X-CF:${userData.cf}`);
    }
    if (inclusions.nascita && userData.birth_date) {
        v.push(`BDAY:${userData.birth_date}`);
        if (userData.birth_place) v.push(`X-BIRTHPLACE:${userData.birth_place}`);
    }
    // Phones
    if (Array.isArray(options.contactPhones) && Array.isArray(inclusions.phones)) {
        inclusions.phones.forEach(idx => {
            const p = options.contactPhones[idx];
            if (p && p.number) v.push(`TEL:${p.number}`);
        });
    }
    // Emails
    if (Array.isArray(options.contactEmails) && Array.isArray(inclusions.emails)) {
        inclusions.emails.forEach(idx => {
            const e = options.contactEmails[idx];
            if (e && e.address) v.push(`EMAIL:${e.address}`);
        });
    }
    // Addresses
    if (Array.isArray(options.userAddresses) && Array.isArray(inclusions.addresses)) {
        inclusions.addresses.forEach(idx => {
            const a = options.userAddresses[idx];
            if (a && a.address) v.push(`ADR:;;${a.address} ${a.civic};${a.city};;${a.cap};`);
        });
    }
    // impostazioni.js style (qr_personal)
    if (inclusions.contactPhones && Array.isArray(userData.contactPhones)) {
        userData.contactPhones.forEach(p => { if (p.shareQr && p.number) v.push(`TEL;TYPE=CELL:${p.number}`); });
    }
    if (inclusions.contactEmails && Array.isArray(userData.contactEmails)) {
        userData.contactEmails.forEach(e => { if (e.shareQr && e.address) v.push(`EMAIL;TYPE=INTERNET:${e.address}`); });
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
    new QRCode(container, {
        text,
        width: options.width || 104,
        height: options.height || 104,
        colorDark: options.colorDark || '#000000',
        colorLight: options.colorLight || '#E3F2FD',
        correctLevel: options.correctLevel || (QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 1)
    });
}
