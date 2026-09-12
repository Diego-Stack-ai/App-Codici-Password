export const PROFILE_TABS = Object.freeze([
    'overview', 'personal', 'contacts', 'addresses', 'documents', 'digital-card'
]);

export const PROFILE_WIDGET_FIELD_LIMIT = 30;
export const PROFILE_WIDGET_TABS = Object.freeze(['personal', 'contacts', 'addresses', 'documents']);

export const QR_FORBIDDEN_TYPES = new Set([
    'password', 'pin', 'puk', 'secret', 'attachment', 'pdf', 'photo', 'sensitive'
]);

export function hasLegacyEmailPassword(email) {
    return Boolean(String(email?.password || '').trim());
}

export function buildProfileAccountLinkDraft(contact, contactType = 'email') {
    return {
        profileContactId: contact?.id || '',
        contactType,
        value: contactType === 'phone' ? (contact?.number || '') : (contact?.address || '')
    };
}

export function linkProfileEmailToAccount(email, accountId, { passwordTransferred = false } = {}) {
    return {
        ...email,
        linkedAccountId: accountId,
        password: passwordTransferred ? '' : (email.password || '')
    };
}

export function prepareProfileEmailAccountValues(email, account = {}) {
    return {
        username: account.username || email.address || '',
        password: account.password || email.password || '',
        note: account.note || email.note || ''
    };
}

export function isProfileEmailPasswordTransferred(legacyPassword, savedPassword) {
    return typeof legacyPassword === 'string' && legacyPassword.length > 0 &&
        legacyPassword !== '--ERRORE--' && legacyPassword === savedPassword;
}

export function filterProfileAccounts(accounts, search = '', scope = 'all') {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    return accounts.filter(account => {
        if (scope === 'personal' && account.companyId) return false;
        if (scope.startsWith('company:') && account.companyId !== scope.slice(8)) return false;
        const text = normalize([account.name, account.username, account.companyName, account.companyId ? 'azienda' : 'personale'].join(' '));
        return terms.every(term => text.includes(term));
    });
}

export function profileAccountUrl(accountId, companyId = '', { edit = false, contactId = '' } = {}) {
    const params = new URLSearchParams();
    if (accountId) params.set('id', accountId);
    if (companyId) params.set('aziendaId', companyId);
    if (contactId) params.set('profileContactId', contactId);
    return `${edit ? 'form' : 'dettaglio'}_account_${companyId ? 'azienda' : 'privato'}.html?${params}`;
}

function normalizedDeadlineText(value) {
    return String(value || '').trim().toLocaleLowerCase('it');
}

function deadlineIsoDate(deadline = {}) {
    const value = deadline.dueDate || deadline.date || '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    return '';
}

export function findCompatibleDocumentDeadlines(documentItem = {}, deadlines = []) {
    return deadlines.filter(deadline =>
        normalizedDeadlineText(deadline.type || deadline.category) === normalizedDeadlineText(documentItem.type) &&
        deadlineIsoDate(deadline) === String(documentItem.expiry_date || '').slice(0, 10)
    );
}

export function buildProfileDocumentDeadlineDraft(documentItem = {}, profile = {}) {
    const documentType = String(documentItem.type || 'Documento').trim();
    return {
        profileDocumentId: documentItem.id,
        documentType,
        name: [profile.nome, profile.cognome].filter(Boolean).join(' ').trim(),
        detail: [documentType, documentItem.num_serie || documentItem.id_number || documentItem.cf_value]
            .filter(Boolean).join(' - '),
        dueDate: documentItem.expiry_date
    };
}

export function resolveProfileDocumentDeadlineState(documents = [], deadlines = []) {
    return documents.map(documentItem => {
        if (documentItem?.expiryReference?.deadlineId) return documentItem;
        const explicit = deadlines.find(deadline =>
            deadline?.sourceRef?.type === 'profileDocument' && deadline.sourceRef.id === documentItem?.id
        );
        if (explicit) return {...documentItem, expiryReference: {deadlineId: explicit.id}};
        const compatible = findCompatibleDocumentDeadlines(documentItem, deadlines);
        return compatible.length === 1
            ? {...documentItem, compatibleDeadlineId: compatible[0].id}
            : documentItem;
    });
}

export function createProfileItemId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function stableLegacyId(prefix, item, index) {
    if (item?.id) return String(item.id);
    const source = [prefix, item?.label, item?.type, item?.address, item?.number, item?.num_serie, index]
        .filter(value => value !== undefined && value !== null)
        .join('|')
        .toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-legacy-${(hash >>> 0).toString(36)}`;
}

function normalizeItems(items, prefix) {
    return (Array.isArray(items) ? items : []).filter(Boolean).map((item, index) => ({
        ...item,
        id: stableLegacyId(prefix, item, index),
        isPrimary: item?.isPrimary === true
    }));
}

export function normalizeLegacyProfile(userData = {}) {
    const phones = normalizeItems(userData.contactPhones, 'phone');
    const emails = normalizeItems(userData.contactEmails, 'email');
    const addresses = normalizeItems(userData.userAddresses, 'address').map(address => ({
        ...address,
        utilities: normalizeItems(address.utilities, `utility-${address.id}`)
    }));
    const documents = normalizeItems(userData.documenti, 'document');
    return { ...userData, contactPhones: phones, contactEmails: emails, userAddresses: addresses, documenti: documents };
}

export function resolvePrimary(items = []) {
    return items.find(item => item?.isPrimary === true) || items[0] || null;
}

export function buildProfileOverview(profile = {}, now = new Date()) {
    const documents = Array.isArray(profile.documenti) ? profile.documenti : [];
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + 90);
    const expiringDocuments = documents.filter(item => {
        if (!item?.expiry_date) return false;
        const expiry = new Date(`${item.expiry_date}T00:00:00`);
        return !Number.isNaN(expiry.getTime()) && expiry >= now && expiry <= threshold;
    }).sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)));
    const fiscalDocument = documents.find(item => String(item?.type || '').toLowerCase().includes('fiscale'));
    return {
        fullName: [profile.nome, profile.cognome].filter(Boolean).join(' ').trim(),
        fiscalCode: fiscalDocument?.cf_value || fiscalDocument?.num_serie || fiscalDocument?.id_number || fiscalDocument?.cf || '',
        primaryPhone: resolvePrimary(profile.contactPhones),
        primaryEmail: resolvePrimary(profile.contactEmails),
        primaryAddress: resolvePrimary(profile.userAddresses),
        expiringDocuments
    };
}

export function isQrEligibleField(field = {}) {
    if (field.includeInQr !== true) return false;
    if (field.sensitivity === 'secret' || field.encrypted === true && field.sensitivity === 'high') return false;
    return !QR_FORBIDDEN_TYPES.has(String(field.type || '').toLowerCase());
}

export function validateProfileWidget(widget = {}) {
    const errors = [];
    if (!String(widget.title || '').trim()) errors.push('title');
    if (!PROFILE_WIDGET_TABS.includes(widget.tab)) errors.push('tab');
    if (!['small', 'medium', 'wide'].includes(widget.size)) errors.push('size');
    if (!Array.isArray(widget.fields)) errors.push('fields');
    else if (widget.fields.length > PROFILE_WIDGET_FIELD_LIMIT) errors.push('field-limit');
    else if (widget.fields.some(field => field.includeInQr === true && !isQrEligibleField(field))) errors.push('unsafe-qr-field');
    return { valid: errors.length === 0, errors };
}

export function migrateQrIndexesToIds(inclusions = {}, profile = {}) {
    const mapIndexes = (key, items) => (Array.isArray(inclusions[key]) ? inclusions[key] : [])
        .map(value => typeof value === 'number' ? items[value]?.id : value)
        .filter(Boolean);
    return {
        ...inclusions,
        phones: mapIndexes('phones', profile.contactPhones || []),
        emails: mapIndexes('emails', profile.contactEmails || []),
        addresses: mapIndexes('addresses', profile.userAddresses || []),
        schemaVersion: 2
    };
}
