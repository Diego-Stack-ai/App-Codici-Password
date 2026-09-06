function text(value) {
    return String(value || '').trim();
}

function datePartsToIso(day, month, year) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function deadlineInputDate(isoValue, displayValue) {
    const iso = text(isoValue);
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (isoMatch) return datePartsToIso(Number(isoMatch[3]), Number(isoMatch[2]), Number(isoMatch[1]));

    const display = text(displayValue);
    const italianMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
    if (italianMatch) return datePartsToIso(Number(italianMatch[1]), Number(italianMatch[2]), Number(italianMatch[3]));

    const fallbackMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(display);
    return fallbackMatch ? datePartsToIso(Number(fallbackMatch[3]), Number(fallbackMatch[2]), Number(fallbackMatch[1])) : '';
}

export function deadlineDate(record = {}) {
    const value = record.dueDate || record.date;
    if (!value) return null;
    if (typeof value.toDate === 'function') {
        const result = value.toDate();
        return Number.isNaN(result?.getTime?.()) ? null : result;
    }
    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [day, month, year] = value.split('/').map(Number);
        const result = new Date(year, month - 1, day);
        return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
    }
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
}

export function deadlinePresentation(record = {}) {
    const owner = text(record.name) || 'Intestatario non specificato';
    const category = text(record.type || record.category || record.title) || 'Scadenza Generale';
    const vehicle = text(record.veicolo_modello);
    const legacyTitle = text(record.title);
    return {
        owner,
        category,
        vehicle,
        vehicleLabel: vehicle || 'Veicolo non specificato',
        title: legacyTitle || [category, text(record.name)].filter(Boolean).join(' - ') || 'Dettaglio Scadenza'
    };
}

export function deadlineDateInputFields(record = {}) {
    const raw = record.dueDate || record.date;
    if (typeof raw === 'string') {
        const iso = deadlineInputDate(raw, raw);
        if (iso) {
            const [year, month, day] = iso.split('-');
            return { isoValue: iso, displayValue: `${day}/${month}/${year}` };
        }
    }
    const value = deadlineDate(record);
    if (!value) return { isoValue: '', displayValue: text(raw) };
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = String(value.getFullYear());
    return { isoValue: `${year}-${month}-${day}`, displayValue: `${day}/${month}/${year}` };
}
