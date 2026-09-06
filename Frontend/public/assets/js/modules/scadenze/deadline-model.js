function text(value) {
    return String(value || '').trim();
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
