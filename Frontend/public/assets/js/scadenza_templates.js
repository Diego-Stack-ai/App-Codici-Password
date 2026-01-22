/**
 * scadenza_templates.js
 * CONFIGURAZIONE REGOLE SCADENZE
 * 
 * Contiene:
 * - VEHICLES: Lista veicoli
 * - EMAILS: Lista email destinatari
 * - DEADLINE_RULES: Regole per ogni "Oggetto Email"
 */

export const VEHICLES = [];

export const EMAILS = [
    'estergraziano@libero.it',
    'boschettodiego@gmail.com',
    'amministrazione.bmservice@gmail.com',
    'federicab040501@gmail.com',
    'gretab180503@gmail.com',
    'paxtibisrl@gmail.com',
    '-'
];

/**
 * DEADLINE_RULES
 * Key: Oggetto Email (da visualizzare nel Dropdown)
 */
export const DEADLINE_RULES = {
    'La Revisione Moto': {
        freq: 7, period: 14, hasVehicle: true,
        emailTextOptions: ["la revisione del motociclo targato"]
    },
    'L’Assicurazione': {
        freq: 7, period: 14, hasVehicle: true,
        emailTextOptions: [
            "l'assicurazione del motociclo targato",
            "l'assicurazione dell'auto targata"
        ]
    },
    'La Revisione Auto': {
        freq: 7, period: 14, hasVehicle: true,
        emailTextOptions: ["la revisione dell'auto targata"]
    },
    'Il Bollo': {
        freq: 7, period: 14, hasVehicle: true,
        emailTextOptions: [
            "Il bollo del motociclo targato",
            "Il bollo dell'auto targata",
            "Il bollo del carrello targato"
        ]
    },
    'Il Tagliando': {
        freq: 7, period: 7, hasVehicle: true,
        emailTextOptions: [
            "Il tagliando del motociclo targato",
            "Il tagliando dell'auto targata"
        ]
    },
    'L’Olio motore': {
        freq: 7, period: 14, hasVehicle: true,
        emailTextOptions: ["Olio motore da controllare"]
    },
    'Il Comodato d\'uso': {
        freq: 7, period: 28, hasVehicle: true,
        emailTextOptions: ["Il comodato d'uso dell'auto targata"]
    }
};

/**
 * Helper to build the final email body.
 * Rules: [Template Text] [Plate] e in scadenza con data [DD/MM/YYYY]
 */
export function buildEmailBody(selectedText, detail, dateStr) {
    let body = selectedText || '';
    if (detail) {
        // Se nel testo c'è già il dettaglio o è un documento, concateniamo bene
        if (!body.includes(detail)) body += ` ${detail}`;
    }
    body += ` e in scadenza con data ${dateStr}`;
    return body.trim();
}

/**
 * Helper to build the final Subject.
 * Rules: [Object] [Dettaglio]
 */
export function buildEmailSubject(objectName, detail) {
    let sub = objectName || '';
    if (detail) sub += ` ${detail}`;
    return sub.trim();
}
