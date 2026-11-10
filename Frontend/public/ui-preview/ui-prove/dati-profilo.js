// Profilo inventato per la quarta prova: nessun dato reale.
export const CONTATTI = [
    {id: 'c1', tipo: 'Cellulare', valore: '333 123 4567', qr: true, account: 'Operatore Mobile'},
    {id: 'c2', tipo: 'Fisso', valore: '0444 123456', qr: true, account: 'Fibra Casa'},
    {id: 'c3', tipo: 'Email', valore: 'mario.rossi@example.com', qr: false, account: null},
];

export const INDIRIZZI = [
    {
        id: 'i1', tipo: 'Residenza', via: 'Via Roma, 12', localita: '36100 Vicenza (VI)', qr: true,
        utenze: [
            {id: 'u1', tipo: 'Codice POD', valore: 'IT001E00000001', account: 'Energia Casa'},
            {id: 'u2', tipo: 'Codice PDR', valore: '00881234567890', account: 'Energia Casa'},
        ],
    },
    {id: 'i2', tipo: 'Domicilio', via: 'Via dei Mille, 5', localita: '36071 Arzignano (VI)', qr: false, utenze: []},
];

const oggi = new Date();
const traGiorni = giorni => new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + giorni).toISOString().slice(0, 10);

export const DOCUMENTI = [
    {id: 'd1', tipo: 'Codice fiscale', numero: 'RSSMRA80A01H501U', secondario: 'Tessera n. 80380000000000000001', scadenza: traGiorni(520), allegati: [{id: 'f1', lato: 'Fronte', stile: 'tessera'}, {id: 'f2', lato: 'Retro', stile: 'tessera-retro'}], account: null},
    {id: 'd2', tipo: 'Carta d’identità', numero: 'CA00000AA', secondario: 'Comune di Vicenza', scadenza: traGiorni(35), allegati: [{id: 'f3', lato: 'Fronte', stile: 'identita'}, {id: 'f4', lato: 'Retro', stile: 'identita-retro'}], account: null},
    {id: 'd3', tipo: 'Patente di guida', numero: 'VI1234567A', secondario: 'Categorie A, B', scadenza: traGiorni(1210), allegati: [{id: 'f5', lato: 'Fronte', stile: 'patente'}, {id: 'f6', lato: 'Retro', stile: 'patente-retro'}], account: 'Portale Automobilista'},
];
