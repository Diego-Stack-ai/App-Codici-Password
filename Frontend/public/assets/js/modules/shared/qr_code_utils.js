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

    // HACK: Aggiungi padding alla fine dei dati per forzare la libreria a scegliere una Versione QR più grande (TypeNumber maggiore).
    // La libreria qrcode.js attuale sottostima l'overhead binario, causando overflow se il Type scelto è 'giusto giusto'.
    // Aggiungendo spazi (che sono safe dopo END:VCARD), forziamo il calcolo preliminare a salire di livello.
    let safeText = text;
    if (safeText.length > 50) {
        safeText += " ".repeat(150); // +150 char buffer to force next Version
    }

    try {
        new QRCode(container, {
            text: safeText,
            width: options.width || 104,
            height: options.height || 104,
            colorDark: options.colorDark || '#000000',
            colorLight: options.colorLight || '#E3F2FD',
            correctLevel: options.correctLevel || (typeof QRCode.CorrectLevel !== 'undefined' ? QRCode.CorrectLevel.M : 1)
        });
    } catch (e) {
        console.error("QR Code Render Error (Overflow) with padding:", e);

        // Fallback estremo: Riduci ancora correzione e aumenta padding
        try {
            new QRCode(container, {
                text: safeText + "   ", // Try minimal change
                width: options.width || 104,
                height: options.height || 104,
                colorDark: options.colorDark || '#000000',
                colorLight: options.colorLight || '#E3F2FD',
                correctLevel: (typeof QRCode.CorrectLevel !== 'undefined' ? QRCode.CorrectLevel.L : 3)
            });
        } catch (retryError) {
            console.error("QR Code Retry Failed:", retryError);
            container.innerHTML = '<div style="color:red; font-size:0.75rem; text-align:center; padding:10px;">Dati eccessivi<br>per il QR Code</div>';
            if (window.showToast) window.showToast("Dati eccessivi. Riduci i campi.", "warning");
        }
    }
}
