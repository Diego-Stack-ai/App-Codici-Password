// Local laboratory: translate only the two canonical detail destinations.
// Return decoded identifiers once; consumers must pass them directly to the repository.
function fail(code) { throw new Error(code); }
function validSegment(value) {
    return typeof value === 'string' && value.trim().length > 0 &&
        value !== '.' && value !== '..' && !/[\\/%\u0000-\u001f\u007f]/u.test(value);
}

export function parseAccountDestination(url, {uid, companyId = 'company'} = {}) {
    if (!validSegment(uid)) fail('AUTH_REQUIRED');
    if (typeof url !== 'string' || /[#\s\\]/u.test(url)) fail('INVALID_ACCOUNT_DESTINATION');
    const match = /^(dettaglio_account_privato|dettaglio_account_azienda)\.html\?([^?]+)$/u.exec(url);
    if (!match) fail('INVALID_ACCOUNT_DESTINATION');
    const domain = match[1] === 'dettaglio_account_privato' ? 'private' : 'company';
    const allowed = new Set(domain === 'private' ? ['id', 'ownerId'] : ['id', 'aziendaId', 'ownerId']);
    const values = new Map();
    for (const pair of match[2].split('&')) {
        const separator = pair.indexOf('=');
        const name = pair.slice(0, separator);
        if (separator < 1 || !allowed.has(name) || values.has(name)) fail('INVALID_ROUTE_PARAMETERS');
        let value;
        try { value = decodeURIComponent(pair.slice(separator + 1).replaceAll('+', ' ')); }
        catch { fail('INVALID_ROUTE_PARAMETERS'); }
        if (!validSegment(value)) fail('INVALID_RECORD_ID');
        values.set(name, value);
    }
    if (!values.has('id')) fail('INVALID_ROUTE_PARAMETERS');
    if (values.has('ownerId') && values.get('ownerId') !== uid) fail('OWNER_MISMATCH');
    const result = {domain, id: values.get('id')};
    if (domain === 'company') {
        if (!values.has('aziendaId')) fail('INVALID_ROUTE_PARAMETERS');
        if (!validSegment(companyId)) fail('INVALID_RECORD_ID');
        if (values.get('aziendaId') !== companyId) fail('COMPANY_MISMATCH');
        result.companyId = companyId;
    }
    return Object.freeze(result);
}
