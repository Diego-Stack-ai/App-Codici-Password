/**
 * PROFILO PRIVATO — SHARED STATE MODULE (V1.0)
 * Oggetto stato condiviso tra tutti i sotto-moduli del profilo privato.
 * Usato da: profilo_privato.js, profilo-sync.js
 *
 * NOTA: È un singolo oggetto mutabile esportato. Tutti i moduli che lo importano
 * lavorano sulla STESSA istanza — le modifiche (comprese le ri-assegnazioni di proprietà)
 * sono visibili a tutti i moduli importatori senza circular dependencies.
 */

export const state = {
    currentUserUid: null,
    currentUserData: {},
    contactEmails: [],
    userAddresses: [],
    contactPhones: [],
    userDocuments: [],

    profileLabels: {
        addressTypes: ['Residenza', 'Domicilio', 'Ufficio', 'Altro'],
        utilityTypes: ['Codice POD', 'Contatore Acqua', 'Contatore Metano', 'Fibra', 'Altro'],
        phoneLabels: ['Cellulare', 'Fisso', 'Principale', 'Altro'],
        emailLabels: ['Personale', 'Lavoro', 'Principale', 'Email di recupero', 'Altro'],
        documentTypes: ['Carta Identità', 'Patente', 'Codice Fiscale', 'Passaporto', 'Altro']
    },

    qrCodeInclusions: {
        nome: false,
        cf: false,
        nascita: false,
        phones: [],
        emails: [],
        addresses: []
    }
};
