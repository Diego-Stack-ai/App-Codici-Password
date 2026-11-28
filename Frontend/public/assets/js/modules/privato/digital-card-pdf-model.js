// Proiezione della Tessera digitale per il PDF. Modulo puro, senza import.
// Le regole di selezione replicano buildVCard (shared/qr_code_utils-v2.js): entrano
// solo i campi scelti nella Tessera e le stesse esclusioni dei campi sensibili.
// La verifica di coincidenza è in tests/digital-card-pdf.test.mjs.

export const DIGITAL_CARD_PDF_TITLE = 'Tessera digitale';
const CUSTOM_FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'phone', 'email', 'address', 'url', 'select', 'boolean', 'identifier', 'expiry']);

const text = value => String(value ?? '').trim();

function selectedItems(items, references) {
    if (!Array.isArray(items) || !Array.isArray(references)) return [];
    return references
        .map(reference => typeof reference === 'number'
            ? items[reference]
            : items.find(item => String(item?.id) === String(reference)))
        .filter(Boolean);
}

export function isCardPhotoSelected(userData, inclusions) {
    return inclusions?.photo === true && /^https:\/\//i.test(userData?.photoURL || '');
}

export function eligibleCustomFields(customFields) {
    return (Array.isArray(customFields) ? customFields : [])
        .filter(field => field?.includeInQr === true && (field.encrypted === false || field.encrypted === undefined) &&
            field.sensitivity !== 'secret' && !field.valueEnc &&
            CUSTOM_FIELD_TYPES.has(String(field.type || '').trim().toLowerCase()))
        .sort((a, b) => (a.qrOrder || 0) - (b.qrOrder || 0));
}

export function buildDigitalCardPdfModel(userData = {}, inclusions = {}, options = {}, photo = null) {
    const rows = [];
    const push = (label, value) => {const clean = text(value); if (clean) rows.push({label, value: clean});};
    const nome = inclusions.nome ? text(userData.nome) : '';
    const cognome = inclusions.nome || inclusions.cognome ? text(userData.cognome) : '';
    push('Nome e cognome', `${nome} ${cognome}`.trim());
    const fiscalDocument = (userData.documenti || []).find(item => String(item?.type || '').toLowerCase().includes('fiscale'));
    const fiscalCode = fiscalDocument?.cf_value || fiscalDocument?.num_serie || fiscalDocument?.id_number || fiscalDocument?.cf;
    if (inclusions.cf) push('Codice fiscale', fiscalCode);
    if (inclusions.nascita && userData.birth_date) {
        push('Data di nascita', userData.birth_date);
        push('Luogo di nascita', userData.birth_place);
    }
    const labelled = (base, item) => text(item?.label) ? `${base} (${text(item.label)})` : base;
    for (const phone of selectedItems(options.contactPhones, inclusions.phones)) push(labelled('Telefono', phone), phone.number);
    for (const email of selectedItems(options.contactEmails, inclusions.emails)) push(labelled('Email', email), email.address);
    for (const address of selectedItems(options.userAddresses, inclusions.addresses)) {
        if (!text(address.address)) continue;
        const street = `${text(address.address)} ${text(address.civic)}`.trim();
        const place = `${text(address.cap)} ${text(address.city)}`.trim();
        push(text(address.type) ? `Indirizzo (${text(address.type)})` : 'Indirizzo', [street, place].filter(Boolean).join(', '));
    }
    if (inclusions.contactPhones && Array.isArray(userData.contactPhones)) {
        for (const phone of userData.contactPhones) if (phone?.shareQr) push('Telefono', phone.number);
    }
    if (inclusions.contactEmails && Array.isArray(userData.contactEmails)) {
        for (const email of userData.contactEmails) if (email?.shareQr) push('Email', email.address);
    }
    for (const field of eligibleCustomFields(options.customFields)) push(text(field.qrLabel || field.label) || 'Campo', field.value);
    if (!rows.length) throw Error('CARD_PDF_EMPTY');
    const includePhoto = isCardPhotoSelected(userData, inclusions) && typeof photo === 'string' && photo.startsWith('data:image/');
    return {title: DIGITAL_CARD_PDF_TITLE, photo: includePhoto ? photo : null, rows};
}
