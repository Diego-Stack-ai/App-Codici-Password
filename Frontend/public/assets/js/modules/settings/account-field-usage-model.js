const FIELD_DEFINITIONS = Object.freeze([
    {key: 'nomeAccount', label: 'Nome account', group: 'Base', areas: ['privato', 'azienda'], required: true},
    {key: 'username', label: 'Username / email', group: 'Credenziali', areas: ['privato', 'azienda']},
    {key: 'account', label: 'Account / codice', group: 'Credenziali', areas: ['privato', 'azienda']},
    {key: 'password', label: 'Password', group: 'Credenziali', areas: ['privato', 'azienda']},
    {key: 'url', label: 'Sito web', group: 'Base', areas: ['privato', 'azienda']},
    {key: 'note', label: 'Note', group: 'Base', areas: ['privato', 'azienda']},
    {key: 'logo', label: 'Logo', group: 'Base', areas: ['privato', 'azienda']},
    {key: 'linkedProfileEmail', label: 'Email collegata al profilo', group: 'Collegamenti', areas: ['privato']},
    {key: 'referenteNome', label: 'Nome referente', group: 'Referente', areas: ['privato', 'azienda']},
    {key: 'referenteTelefono', label: 'Telefono referente', group: 'Referente', areas: ['privato', 'azienda']},
    {key: 'referenteCellulare', label: 'Cellulare referente', group: 'Referente', areas: ['privato', 'azienda']},
    {key: 'numeroIscrizione', label: 'Numero iscrizione', group: 'Dati societari', areas: ['azienda']},
    {key: 'codiceSocieta', label: 'Codice società', group: 'Dati societari', areas: ['azienda']},
    {key: 'iban', label: 'IBAN', group: 'Banca', areas: ['privato', 'azienda']},
    {key: 'passwordDispositiva', label: 'Password dispositiva', group: 'Banca', areas: ['privato', 'azienda']},
    {key: 'bankReferenteNome', label: 'Nome referente banca', group: 'Banca', areas: ['privato', 'azienda']},
    {key: 'bankReferenteTelefono', label: 'Telefono referente banca', group: 'Banca', areas: ['privato', 'azienda']},
    {key: 'bankReferenteCellulare', label: 'Cellulare referente banca', group: 'Banca', areas: ['privato', 'azienda']},
    {key: 'cardType', label: 'Tipo carta', group: 'Carta', areas: ['privato', 'azienda']},
    {key: 'cardHolder', label: 'Titolare carta', group: 'Carta', areas: ['privato', 'azienda']},
    {key: 'cardNumber', label: 'Numero carta', group: 'Carta', areas: ['privato', 'azienda']},
    {key: 'cardExpiry', label: 'Scadenza carta', group: 'Carta', areas: ['privato', 'azienda']},
    {key: 'cardPin', label: 'PIN carta', group: 'Carta', areas: ['privato', 'azienda']},
    {key: 'cardCcv', label: 'CCV carta', group: 'Carta', areas: ['privato', 'azienda']}
].filter(field => field.areas.length));

function classify(field, used, eligible) {
    if (field.required) return {status: 'Primario', recommendation: 'Mantieni come campo primario'};
    if (!used) return {status: 'Mai usato', recommendation: 'Nascondi dal modulo principale'};
    if (used === 1) return {status: 'Usato una volta', recommendation: 'Trasforma o mantieni come widget'};
    const percentage = eligible ? (used / eligible) * 100 : 0;
    if (percentage >= 50) return {status: 'Frequente', recommendation: 'Promuovi a campo primario'};
    return {status: 'Occasionale', recommendation: 'Mantieni o trasforma in widget'};
}

function usageRow(field, records) {
    const eligibleRecords = records.filter(record => field.areas.includes(record.area));
    const readable = eligibleRecords.filter(record => record.fields[field.key] !== null);
    const usedRecords = readable.filter(record => record.fields[field.key] === true);
    const privateUsed = usedRecords.filter(record => record.area === 'privato').length;
    const companyUsed = usedRecords.filter(record => record.area === 'azienda').length;
    const decision = classify(field, usedRecords.length, readable.length);
    return Object.freeze({
        key: field.key,
        label: field.label,
        group: field.group,
        privateUsed,
        companyUsed,
        used: usedRecords.length,
        eligible: readable.length,
        unavailable: eligibleRecords.length - readable.length,
        percentage: readable.length ? Math.round((usedRecords.length / readable.length) * 100) : 0,
        ...decision
    });
}

function normalizedLabel(label) {
    return String(label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');
}

function widgetRows(entries, records) {
    const accountAreas = new Map(records.map(record => [record.accountKey, record.area]));
    const groups = new Map();
    entries.forEach(entry => {
        const labelKey = normalizedLabel(entry.label);
        if (!labelKey || !accountAreas.has(entry.accountKey)) return;
        const current = groups.get(labelKey) || {label: String(entry.label).trim(), accounts: new Map()};
        const existing = current.accounts.get(entry.accountKey);
        if (entry.filled === true || existing !== true) current.accounts.set(entry.accountKey, entry.filled);
        groups.set(labelKey, current);
    });
    return [...groups.values()].map(group => {
        const readable = [...group.accounts].filter(([, filled]) => filled !== null);
        const used = readable.filter(([, filled]) => filled === true);
        const privateUsed = used.filter(([key]) => accountAreas.get(key) === 'privato').length;
        const companyUsed = used.filter(([key]) => accountAreas.get(key) === 'azienda').length;
        return Object.freeze({
            label: group.label,
            privateUsed,
            companyUsed,
            used: used.length,
            eligible: records.length,
            unavailable: group.accounts.size - readable.length,
            percentage: records.length ? Math.round((used.length / records.length) * 100) : 0,
            status: used.length === 1 ? 'Widget usato una volta' : `Widget usato ${used.length} volte`,
            recommendation: used.length ? 'Widget esistente' : 'Widget mai compilato'
        });
    }).sort((left, right) => right.used - left.used || left.label.localeCompare(right.label, 'it'));
}

export function buildAccountFieldUsageReport({records = [], widgetEntries = [], archivedExcluded = 0} = {}) {
    const fields = FIELD_DEFINITIONS.map(field => usageRow(field, records));
    return Object.freeze({
        generatedAt: new Date().toISOString(),
        totals: Object.freeze({
            accounts: records.length,
            privateAccounts: records.filter(record => record.area === 'privato').length,
            companyAccounts: records.filter(record => record.area === 'azienda').length,
            archivedExcluded
        }),
        fields,
        widgets: widgetRows(widgetEntries, records)
    });
}

export {FIELD_DEFINITIONS};
